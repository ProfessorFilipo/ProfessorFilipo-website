// renderer.js — desenha a árvore de refutação (tableau) como SVG.
//
// Layout em duas passadas, técnica clássica de árvore:
//   1. leafWidth(branch): quantas "colunas-folha" cada ramo ocupa
//      (folha = 1; ramo com filhos = soma dos filhos).
//   2. assign(): posiciona cada ramo centralizado na fatia horizontal
//      proporcional ao seu leafWidth, empilhando fórmulas verticalmente.
//
// SVG foi escolhido (em vez de HTML/CSS) principalmente por causa da
// exportação: dá pra serializar e gerar PNG/SVG nativamente, sem
// depender de bibliotecas como html2canvas (ver decisão registrada no
// Notion / na memória do projeto).

import { formulaToString } from './ast.js';

const FONT_FAMILY = "'Source Serif 4', serif";
const FONT_SIZE = 15;
const LINE_HEIGHT = 26;
const FORK_GAP = 40;
const COL_PADDING = 28;
const MIN_COL_WIDTH = 70;
const TOP_MARGIN = 24;
const SIDE_MARGIN = 24;
const BOTTOM_MARGIN = 30;

let measureCanvas = null;
function measureTextWidth(text) {
  if (!measureCanvas) measureCanvas = document.createElement('canvas');
  const ctx = measureCanvas.getContext('2d');
  ctx.font = `${FONT_SIZE}px ${FONT_FAMILY}`;
  return ctx.measureText(text).width;
}

function leafWidth(branch) {
  if (!branch.children.length) return 1;
  return branch.children.reduce((sum, c) => sum + leafWidth(c), 0);
}

function computeColumnWidth(root) {
  let max = MIN_COL_WIDTH;
  (function walk(branch) {
    for (const entry of branch.formulas) {
      const w = measureTextWidth(formulaToString(entry.node)) + COL_PADDING * 2;
      if (w > max) max = w;
    }
    branch.children.forEach(walk);
  })(root);
  return max;
}

/**
 * Calcula as posições de todo o layout a partir do resultado de
 * buildTableau(). Não desenha nada — retorna dados puros de geometria,
 * o que facilita testar o layout isoladamente da renderização.
 */
export function layoutTableau(tableauResult) {
  const root = tableauResult.root;
  const colWidth = computeColumnWidth(root);
  const totalWidthPx = leafWidth(root) * colWidth;

  const texts = [];
  const forkLines = [];
  const leafMarkers = [];

  function assign(branch, xStart, widthPx, y, startIndex) {
    // branch.formulas é cumulativo (cada fork() copia tudo do ramo-pai) —
    // só desenhamos as entradas NOVAS deste segmento, a partir de
    // startIndex (o tamanho que o ramo-pai já tinha ao bifurcar).
    const newFormulas = branch.formulas.slice(startIndex);
    const centerX = xStart + widthPx / 2;
    newFormulas.forEach((entry, i) => {
      texts.push({
        x: centerX,
        y: y + i * LINE_HEIGHT,
        text: formulaToString(entry.node),
        branchId: branch.id,
      });
    });
    const endY = y + newFormulas.length * LINE_HEIGHT;

    if (!branch.children.length) {
      leafMarkers.push({
        x: centerX,
        y: endY + 6,
        closed: branch.closed,
        status: branch.status,
      });
      return endY;
    }

    const totalChildLeafW = branch.children.reduce((s, c) => s + leafWidth(c), 0);
    let cursorX = xStart;
    let maxChildEndY = endY;
    for (const child of branch.children) {
      const childLeafW = leafWidth(child);
      const childWidthPx = (widthPx * childLeafW) / totalChildLeafW;
      const childCenterX = cursorX + childWidthPx / 2;
      forkLines.push({ x1: centerX, y1: endY, x2: childCenterX, y2: endY + FORK_GAP - 10 });
      const childEndY = assign(child, cursorX, childWidthPx, endY + FORK_GAP, branch.formulas.length);
      if (childEndY > maxChildEndY) maxChildEndY = childEndY;
      cursorX += childWidthPx;
    }
    return maxChildEndY;
  }

  const totalHeightPx = assign(root, 0, totalWidthPx, LINE_HEIGHT * 0.7, 0);

  return {
    texts,
    forkLines,
    leafMarkers,
    width: totalWidthPx,
    height: totalHeightPx,
  };
}

function escapeXML(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Renderiza o resultado de buildTableau() como uma string SVG completa
 * e independente (viewBox + xmlns), pronta pra injetar via innerHTML ou
 * baixar como arquivo .svg.
 */
export function renderTableauSVG(tableauResult) {
  const layout = layoutTableau(tableauResult);
  const w = layout.width + SIDE_MARGIN * 2;
  const h = layout.height + TOP_MARGIN + BOTTOM_MARGIN;
  const dx = SIDE_MARGIN;
  const dy = TOP_MARGIN;

  const lines = layout.forkLines
    .map((f) => `<line x1="${(f.x1 + dx).toFixed(1)}" y1="${(f.y1 + dy).toFixed(1)}" x2="${(f.x2 + dx).toFixed(1)}" y2="${(f.y2 + dy).toFixed(1)}" class="lm-fork-line"/>`)
    .join('');

  const texts = layout.texts
    .map((t) => `<text x="${(t.x + dx).toFixed(1)}" y="${(t.y + dy).toFixed(1)}" text-anchor="middle" class="lm-formula-text">${escapeXML(t.text)}</text>`)
    .join('');

  const markers = layout.leafMarkers
    .map((m) => {
      let symbol = '○';
      let cls = 'lm-leaf-open';
      if (m.closed) {
        symbol = '×';
        cls = 'lm-leaf-closed';
      } else if (m.status === 'undeterminado') {
        symbol = '⋯';
        cls = 'lm-leaf-undetermined';
      }
      return `<text x="${(m.x + dx).toFixed(1)}" y="${(m.y + dy).toFixed(1)}" text-anchor="middle" class="lm-leaf-marker ${cls}">${symbol}</text>`;
    })
    .join('');

  return `<svg viewBox="0 0 ${w.toFixed(1)} ${h.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" xmlns="http://www.w3.org/2000/svg" class="lm-tableau-svg" role="img" aria-label="Árvore de refutação">
<g>${lines}</g>
<g>${texts}</g>
<g>${markers}</g>
</svg>`;
}

/**
 * Serializa um elemento <svg> já no DOM (ex.: this.svgEl) para um Blob
 * PNG, desenhando-o numa <canvas> off-screen. Usado pelo botão
 * "exportar PNG" (fase 4) — exposto aqui desde já porque a lógica é só
 * geometria de canvas, sem nenhuma dependência do resto da UI.
 */
export function svgElementToPngBlob(svgEl, scale = 2) {
  return new Promise((resolve, reject) => {
    const xml = new XMLSerializer().serializeToString(svgEl);
    const svgBlob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      const w = svgEl.viewBox.baseVal.width || svgEl.clientWidth;
      const h = svgEl.viewBox.baseVal.height || svgEl.clientHeight;
      const canvas = document.createElement('canvas');
      canvas.width = w * scale;
      canvas.height = h * scale;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('toBlob retornou null'))), 'image/png');
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}
