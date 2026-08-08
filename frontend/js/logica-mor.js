/**
 * logica-mor.js — orquestrador da página da ferramenta Lógica Mór.
 * Liga o motor lógico (frontend/tools/logica-mor/js/) à UI: modo de
 * análise (fórmula única vs argumento), teclado virtual, exemplos
 * prontos, e o resultado (veredito + árvore SVG).
 *
 * Fase 1: análise completa de uma vez (sem navegação passo a passo —
 * isso é a Fase 2, que vai consumir o array `steps` já retornado por
 * buildTableau sem precisar mudar nada aqui).
 */
import { parse } from '../tools/logica-mor/js/parser.js';
import { checkSatisfiability, checkTautology, checkValidity } from '../tools/logica-mor/js/tableau.js';
import { renderTableauSVG } from '../tools/logica-mor/js/renderer.js';
import { EXAMPLE_LEVELS } from '../tools/logica-mor/js/examples.js';
import { isPropositional, generateTruthTable } from '../tools/logica-mor/js/evaluator.js';

const KEYS = ['¬', '∧', '∨', '→', '↔', '∀', '∃', '⊢', '(', ')', ','];
const TURNSTILE_UNICODE = '⊢';
const TURNSTILE_ASCII = '|-';

(function () {
  const root = document.getElementById('lm-tool');
  if (!root) return;

  const state = { mode: 'formula', premises: [''] };

  const modeFormulaBtn = document.getElementById('lm-mode-formula');
  const modeArgumentBtn = document.getElementById('lm-mode-argument');
  const premisesWrap = document.getElementById('lm-premises');
  const addPremiseBtn = document.getElementById('lm-add-premise');
  const mainInput = document.getElementById('lm-main-input');
  const mainLabel = document.getElementById('lm-main-label');
  const keyboard = document.getElementById('lm-keyboard');
  const analyzeBtn = document.getElementById('lm-analyze-btn');
  const feedbackEl = document.getElementById('lm-feedback');
  const examplesEl = document.getElementById('lm-examples');
  const resultEl = document.getElementById('lm-result');
  const verdictEl = document.getElementById('lm-verdict');
  const counterexampleEl = document.getElementById('lm-counterexample');
  const treeWrap = document.getElementById('lm-tree-wrap');

  let lastFocusedInput = mainInput;

  // ---------- teclado virtual ----------
  KEYS.forEach((symbol) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'lm-key';
    btn.textContent = symbol;
    btn.addEventListener('mousedown', (e) => e.preventDefault()); // não rouba o foco do input
    btn.addEventListener('click', () => insertAtCursor(lastFocusedInput, symbol));
    keyboard.appendChild(btn);
  });

  function insertAtCursor(input, text) {
    if (!input) return;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    input.value = input.value.slice(0, start) + text + input.value.slice(end);
    input.focus();
    input.selectionStart = input.selectionEnd = start + text.length;
  }

  function trackFocus(input) {
    input.addEventListener('focus', () => (lastFocusedInput = input));
  }
  trackFocus(mainInput);

  // ---------- modo de análise ----------
  function setMode(mode) {
    state.mode = mode;
    modeFormulaBtn.classList.toggle('sel', mode === 'formula');
    modeArgumentBtn.classList.toggle('sel', mode === 'argument');
    premisesWrap.style.display = mode === 'argument' ? '' : 'none';
    addPremiseBtn.style.display = mode === 'argument' ? '' : 'none';
    mainLabel.textContent = mode === 'argument' ? 'CONCLUSÃO' : 'FÓRMULA';
    clearFeedback();
  }
  modeFormulaBtn.addEventListener('click', () => setMode('formula'));
  modeArgumentBtn.addEventListener('click', () => setMode('argument'));

  // ---------- premissas dinâmicas ----------
  function renderPremises() {
    premisesWrap.innerHTML = '';
    state.premises.forEach((value, i) => {
      const row = document.createElement('div');
      row.className = 'lm-premise-row';

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'lm-formula-input';
      input.placeholder = `Premissa ${i + 1}`;
      input.value = value;
      input.addEventListener('input', () => (state.premises[i] = input.value));
      trackFocus(input);
      row.appendChild(input);

      if (state.premises.length > 1) {
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'lm-premise-remove';
        removeBtn.textContent = 'REMOVER';
        removeBtn.addEventListener('click', () => {
          state.premises.splice(i, 1);
          renderPremises();
        });
        row.appendChild(removeBtn);
      }

      premisesWrap.appendChild(row);
    });
  }
  renderPremises();

  addPremiseBtn.addEventListener('click', () => {
    state.premises.push('');
    renderPremises();
  });

  // ---------- feedback do parser ----------
  function clearFeedback() {
    feedbackEl.innerHTML = '';
    feedbackEl.style.display = 'none';
    mainInput.classList.remove('lm-input-error');
  }

  function showFeedback(kind, html) {
    feedbackEl.className = `lm-feedback lm-fb-${kind}`;
    feedbackEl.innerHTML = html;
    feedbackEl.style.display = '';
  }

  // ---------- notação de sequente (premissas ⊢ conclusão) ----------
  // ⊢ não é um conectivo lógico — é uma relação de nível diferente
  // (consequência entre um conjunto de premissas e uma conclusão), que
  // o motor já expressa via checkValidity(premissas, conclusão). Em vez
  // de ensinar o parser DE FÓRMULAS a engolir esse símbolo (o que não
  // faria sentido semanticamente — não existe um nó de AST pra "⊢"),
  // a UI reconhece a notação inteira digitada de uma vez e decompõe
  // automaticamente nos campos que já existem no modo "argumento".
  function splitTopLevel(str, separator) {
    const parts = [];
    let depth = 0;
    let current = '';
    for (const ch of str) {
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
      if (ch === separator && depth === 0) {
        parts.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    parts.push(current);
    return parts;
  }

  function detectSequent(text) {
    let idx = text.indexOf(TURNSTILE_UNICODE);
    let sepLen = TURNSTILE_UNICODE.length;
    if (idx === -1) {
      idx = text.indexOf(TURNSTILE_ASCII);
      sepLen = TURNSTILE_ASCII.length;
    }
    if (idx === -1) return null;
    const premisesText = text.slice(0, idx).trim();
    const conclusionText = text.slice(idx + sepLen).trim();
    const premises = premisesText
      ? splitTopLevel(premisesText, ',').map((s) => s.trim()).filter(Boolean)
      : [];
    return { premises, conclusion: conclusionText };
  }

  // Se o campo principal contiver "⊢" (ou "|-"), decompõe em premissas +
  // conclusão e alterna o modo automaticamente. "⊢ φ" sem nada antes
  // (nenhuma premissa) vira modo fórmula única — é a notação padrão pra
  // dizer "φ é um teorema", que já é exatamente o que o modo fórmula
  // testa (tautologia/contradição/contingência).
  function maybeExpandSequent() {
    const seq = detectSequent(mainInput.value);
    if (!seq) return false;
    if (seq.premises.length === 0) {
      setMode('formula');
      mainInput.value = seq.conclusion;
    } else {
      setMode('argument');
      state.premises = seq.premises;
      renderPremises();
      mainInput.value = seq.conclusion;
    }
    return true;
  }

  // ---------- exemplos prontos ----------
  EXAMPLE_LEVELS.forEach((level) => {
    const levelWrap = document.createElement('div');
    levelWrap.className = 'lm-example-level';

    const label = document.createElement('p');
    label.className = 'lm-example-level-label';
    label.textContent = level.label;
    levelWrap.appendChild(label);

    const row = document.createElement('div');
    row.className = 'lm-example-row';
    level.examples.forEach((ex) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'lm-example-btn';
      btn.textContent = ex.title;
      btn.addEventListener('click', () => loadExample(ex));
      row.appendChild(btn);
    });
    levelWrap.appendChild(row);

    examplesEl.appendChild(levelWrap);
  });

  function loadExample(ex) {
    if (ex.mode === 'argument') {
      setMode('argument');
      state.premises = [...ex.premises];
      renderPremises();
      mainInput.value = ex.conclusion;
    } else {
      setMode('formula');
      mainInput.value = ex.formula;
    }
    clearFeedback();
    resultEl.style.display = 'none';
    analyze();
  }

  // ---------- análise ----------
  function parseOrFail(text, label) {
    const result = parse(text.trim());
    if (!result.ok) {
      throw { label, ...result.error };
    }
    if (result.warnings && result.warnings.length) {
      return { ast: result.ast, warnings: result.warnings.map((w) => ({ label, ...w })) };
    }
    return { ast: result.ast, warnings: [] };
  }

  function analyze() {
    clearFeedback();
    resultEl.style.display = 'none';

    maybeExpandSequent();

    let mainText = mainInput.value.trim();
    if (!mainText) {
      showFeedback('error', state.mode === 'argument'
        ? 'Digite a conclusão do argumento.'
        : 'Digite uma fórmula para analisar.');
      return;
    }

    const allWarnings = [];
    let tableauResult;
    let verdictHTML;
    let verdictClass;
    let counterexample = null;

    try {
      if (state.mode === 'argument') {
        const premiseTexts = state.premises.map((p) => p.trim()).filter(Boolean);
        if (!premiseTexts.length) {
          showFeedback('error', 'Adicione ao menos uma premissa, ou mude para o modo "Fórmula única".');
          return;
        }
        const premiseASTs = premiseTexts.map((text, i) => {
          const { ast, warnings } = parseOrFail(text, `Premissa ${i + 1}`);
          allWarnings.push(...warnings);
          return ast;
        });
        const { ast: conclusionAST, warnings } = parseOrFail(mainText, 'Conclusão');
        allWarnings.push(...warnings);

        tableauResult = checkValidity(premiseASTs, conclusionAST);
        verdictClass = tableauResult.valid ? 'good' : 'bad';
        verdictHTML = tableauResult.valid
          ? 'ARGUMENTO VÁLIDO — as premissas implicam a conclusão'
          : 'ARGUMENTO INVÁLIDO — encontrado um contraexemplo';
        counterexample = tableauResult.counterexample;
      } else {
        const { ast, warnings } = parseOrFail(mainText, 'Fórmula');
        allWarnings.push(...warnings);

        if (isPropositional(ast)) {
          const { classification } = generateTruthTable(ast);
          if (classification === 'tautologia') {
            // Prova por refutação clássica: nega a fórmula e mostra a
            // árvore fechando — mais revelador do que só confirmar que
            // a fórmula original é satisfazível (o que é trivial pra
            // qualquer tautologia).
            tableauResult = checkTautology(ast);
            verdictClass = 'good';
            verdictHTML = 'TAUTOLOGIA — verdadeira em qualquer valoração (a árvore abaixo é da <em>negação</em> da fórmula, mostrando por que ela não pode ser falsa)';
            counterexample = null;
          } else if (classification === 'contradição') {
            tableauResult = checkSatisfiability(ast);
            verdictClass = 'bad';
            verdictHTML = 'CONTRADIÇÃO — falsa em qualquer valoração';
            counterexample = null;
          } else {
            tableauResult = checkSatisfiability(ast);
            verdictClass = 'warn';
            verdictHTML = 'CONTINGÊNCIA — verdadeira em algumas valorações, falsa em outras (a árvore mostra uma valoração que a torna verdadeira)';
            counterexample = tableauResult.model;
          }
        } else {
          tableauResult = checkSatisfiability(ast);
          verdictClass = tableauResult.satisfiable ? 'good' : 'bad';
          verdictHTML = tableauResult.satisfiable
            ? 'SATISFAZÍVEL — existe uma interpretação que torna a fórmula verdadeira'
            : 'INSATISFAZÍVEL — nenhuma interpretação torna a fórmula verdadeira (contradição)';
          counterexample = tableauResult.model;
        }
      }
    } catch (err) {
      if (err && err.label !== undefined) {
        showFeedback('error', `<strong>${err.label}:</strong> ${err.message} (posição ${err.pos})`);
      } else {
        showFeedback('error', 'Ocorreu um erro inesperado ao analisar. Confira a fórmula.');
        console.error(err);
      }
      return;
    }

    if (allWarnings.length) {
      const items = allWarnings.map((w) => `<li><strong>${w.label}:</strong> ${w.message}</li>`).join('');
      showFeedback('warning', `<ul style="margin:0;padding-left:20px;">${items}</ul>`);
    }

    if (tableauResult.limitReached) {
      const note = document.createElement('p');
      note.textContent = '⚠ O limite de passos foi atingido antes de todos os ramos se decidirem — a árvore abaixo pode estar incompleta.';
      verdictHTML += `<br><small>${note.textContent}</small>`;
    }

    verdictEl.className = `lm-verdict lm-verdict-${verdictClass}`;
    verdictEl.innerHTML = verdictHTML;

    if (counterexample) {
      const dominioLine = counterexample.domain.length
        ? `Domínio: ${counterexample.domain.join(', ')}<br>`
        : '';
      const positivos = counterexample.positiveLiterals.length ? counterexample.positiveLiterals.join(', ') : '—';
      const negativos = counterexample.negativeLiterals.length ? counterexample.negativeLiterals.join(', ') : '—';
      counterexampleEl.innerHTML = `<strong>${state.mode === 'argument' ? 'Contraexemplo' : 'Modelo (interpretação que satisfaz)'}</strong>
        ${dominioLine}Verdadeiro: ${positivos}<br>
        Falso: ${negativos}`;
      counterexampleEl.style.display = '';
    } else {
      counterexampleEl.style.display = 'none';
    }

    treeWrap.innerHTML = renderTableauSVG(tableauResult);
    resultEl.style.display = '';
    resultEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  analyzeBtn.addEventListener('click', analyze);
  mainInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') analyze();
  });

  setMode('formula');
})();
