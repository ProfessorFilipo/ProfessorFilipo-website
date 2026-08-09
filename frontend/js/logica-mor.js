/**
 * logica-mor.js — orquestrador da página da ferramenta Lógica Mór.
 * Liga o motor lógico (frontend/tools/logica-mor/js/) à UI: modo de
 * análise (fórmula única vs argumento), teclado virtual, exemplos
 * prontos, o resultado (veredito + árvore SVG) e a navegação passo a
 * passo pela expansão da árvore (Fase 2).
 */
import { parse } from '../tools/logica-mor/js/parser.js';
import { checkSatisfiability, checkTautology, checkValidity } from '../tools/logica-mor/js/tableau.js';
import { renderTableauSVG, layoutTableau } from '../tools/logica-mor/js/renderer.js';
import { EXAMPLE_LEVELS } from '../tools/logica-mor/js/examples.js';
import { isPropositional, generateTruthTable } from '../tools/logica-mor/js/evaluator.js';

const KEYS = ['¬', '∧', '∨', '→', '↔', '∀', '∃', '⊢', '(', ')', ','];
const TURNSTILE_UNICODE = '⊢';
const TURNSTILE_ASCII = '|-';

(function () {
  const root = document.getElementById('lm-tool');
  if (!root) return;

  const state = { mode: 'formula', premises: [''] };
  let currentTableauResult = null;
  let currentTotalSteps = 0;
  let currentStepCaptions = [];
  let currentStep = 0;

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
  const equivalentNoteEl = document.getElementById('lm-equivalent-note');
  const counterexampleEl = document.getElementById('lm-counterexample');
  const treeWrap = document.getElementById('lm-tree-wrap');
  const stepNavEl = document.getElementById('lm-step-nav');
  const stepCounterEl = document.getElementById('lm-step-counter');
  const stepCaptionEl = document.getElementById('lm-step-caption');
  const stepStartBtn = document.getElementById('lm-step-start');
  const stepPrevBtn = document.getElementById('lm-step-prev');
  const stepNextBtn = document.getElementById('lm-step-next');
  const stepEndBtn = document.getElementById('lm-step-end');
  const truthTableWrap = document.getElementById('lm-truth-table-wrap');
  const truthTableToggle = document.getElementById('lm-truth-table-toggle');
  const truthTablePanel = document.getElementById('lm-truth-table-panel');
  const truthTableEl = document.getElementById('lm-truth-table');

  truthTableToggle.addEventListener('click', () => {
    const isOpen = truthTablePanel.classList.toggle('open');
    truthTableToggle.setAttribute('aria-expanded', String(isOpen));
  });

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
  function applyModeDOM(mode) {
    modeFormulaBtn.classList.toggle('sel', mode === 'formula');
    modeArgumentBtn.classList.toggle('sel', mode === 'argument');
    premisesWrap.style.display = mode === 'argument' ? '' : 'none';
    addPremiseBtn.style.display = mode === 'argument' ? '' : 'none';
    mainLabel.textContent = mode === 'argument' ? 'CONCLUSÃO' : 'FÓRMULA';
  }

  function setMode(mode) {
    // Ao sair do modo argumento pro modo fórmula única, o campo principal
    // até então só mostrava a conclusão — as premissas ficavam fora de
    // vista (ainda existiam no estado, só escondidas). Em vez de
    // reconstruir com "→" (que é logicamente equivalente, mas troca o
    // símbolo que o aluno digitou — confuso, mesmo estando correto:
    // ⊢ não é sempre → em todo sistema lógico, só coincide na lógica
    // clássica que esta ferramenta implementa), mostra a MESMA notação
    // de sequente que o aluno já pode digitar direto: "premissa1,
    // premissa2 ⊢ conclusão". Nenhum símbolo é trocado — só reformata de
    // campos separados pra uma linha só. Ao analisar essa linha de novo,
    // maybeExpandSequent() já reconhece o ⊢ e volta pro modo argumento
    // sozinho.
    if (state.mode === 'argument' && mode === 'formula') {
      const premises = state.premises.map((p) => p.trim()).filter(Boolean);
      const conclusion = mainInput.value.trim();
      if (premises.length) {
        mainInput.value = conclusion ? `${premises.join(', ')} ⊢ ${conclusion}` : premises.join(', ');
        state.premises = [''];
      }
    } else if (state.mode === 'formula' && mode === 'argument') {
      // Caminho inverso do de cima — se o campo já contém um sequente
      // (por ter sido reconstruído na troca anterior, ou por ter sido
      // digitado direto), reconhece e preenche as premissas de novo. Sem
      // isso, ir e voltar entre os dois modos fazia as premissas
      // sumirem — o texto continuava lá, só nunca era relido de volta
      // pros campos, e só era detectado na hora de clicar "Analisar", não
      // na troca de modo em si.
      const seq = detectSequent(mainInput.value);
      if (seq && seq.premises.length) {
        state.premises = seq.premises;
        mainInput.value = seq.conclusion;
      }
    }

    state.mode = mode;
    applyModeDOM(mode);
    renderPremises();
    clearFeedback();
  }
  modeFormulaBtn.addEventListener('click', () => setMode('formula'));
  modeArgumentBtn.addEventListener('click', () => setMode('argument'));

  // ---------- reset — limpa tudo como se a página tivesse acabado de
  // carregar (não reaproveita setMode(), que faz reconstrução/detecção
  // de sequente — aqui é pra zerar de verdade, sem preservar nada) ----------
  function resetForm() {
    state.mode = 'formula';
    state.premises = [''];
    mainInput.value = '';
    applyModeDOM('formula');
    renderPremises();
    clearFeedback();
    resultEl.style.display = 'none';
    lastFocusedInput = mainInput;
    mainInput.focus();
  }
  document.getElementById('lm-reset-btn').addEventListener('click', resetForm);

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

  // ---------- exemplos prontos (acordeão — cada nível abre/fecha
  // independente dos outros, todos começam fechados pra não ocupar a
  // tela toda ao carregar a página) ----------
  EXAMPLE_LEVELS.forEach((level, i) => {
    const levelWrap = document.createElement('div');
    levelWrap.className = 'lm-example-level';

    const panelId = `lm-example-panel-${i}`;
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'lm-example-toggle';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-controls', panelId);
    toggle.innerHTML = `<span>${level.label}<span class="lm-example-toggle-count">(${level.examples.length})</span></span><span class="lm-example-toggle-icon">▸</span>`;
    levelWrap.appendChild(toggle);

    const panel = document.createElement('div');
    panel.className = 'lm-example-panel';
    panel.id = panelId;

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
    panel.appendChild(row);
    levelWrap.appendChild(panel);

    toggle.addEventListener('click', () => {
      const isOpen = panel.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(isOpen));
    });

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
  function escapeHTML(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function buildTruthTableHTML(table) {
    const header = table.propositions.map((p) => `<th>${escapeHTML(p)}</th>`).join('') + '<th>resultado</th>';
    const rows = table.rows
      .map((row) => {
        const cells = table.propositions.map((p) => `<td>${row.valuation[p] ? 'V' : 'F'}</td>`).join('');
        const resultCell = `<td class="${row.result ? 'lm-tt-true' : 'lm-tt-false'}">${row.result ? 'V' : 'F'}</td>`;
        return `<tr>${cells}${resultCell}</tr>`;
      })
      .join('');
    return `<thead><tr>${header}</tr></thead><tbody>${rows}</tbody>`;
  }

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
    let equivalentNote = null;
    let indeterminate = false;
    let truthTable = null;

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
        if (tableauResult.limitReached) {
          // O ramo que não fechou pode significar duas coisas bem
          // diferentes: o argumento é mesmo inválido, OU ele é válido mas
          // precisaria de mais passos pra provar (o método não teve tempo
          // de terminar). "allClosed=false" não distingue essas duas
          // situações — então NÃO dá pra afirmar "inválido" com confiança
          // aqui, mesmo que tecnicamente nenhum ramo tenha fechado ainda.
          indeterminate = true;
          verdictClass = 'warn';
          verdictHTML = 'INDETERMINADO — o motor não conseguiu decidir dentro do limite de passos';
        } else {
          verdictClass = tableauResult.valid ? 'good' : 'bad';
          verdictHTML = tableauResult.valid
            ? 'ARGUMENTO VÁLIDO — as premissas implicam a conclusão'
            : 'ARGUMENTO INVÁLIDO — encontrado um contraexemplo';
          counterexample = tableauResult.counterexample;
        }

        // Nota só informativa, nunca editável e nunca substitui o que foi
        // digitado — o "⊢" não é sempre equivalente a "→" em qualquer
        // sistema lógico (só coincide na lógica clássica, por conta do
        // teorema da dedução), então mostrar isso como uma reformulação
        // alternativa, claramente rotulada, evita confundir a notação
        // que o aluno efetivamente escreveu com uma reescrita silenciosa.
        const premisesPart = premiseTexts.map((p) => `(${p})`).join(' ∧ ');
        equivalentNote = `Forma equivalente por conjunção e implicação (válida aqui pelo teorema da dedução, na lógica clássica): ${premisesPart} → (${mainText})`;
      } else {
        const { ast, warnings } = parseOrFail(mainText, 'Fórmula');
        allWarnings.push(...warnings);

        // Tabela-verdade só faz sentido pra fórmula única puramente
        // proposicional (generateTruthTable não lida com predicados —
        // domínio potencialmente infinito) — independente do resultado
        // válido/inválido/indeterminado abaixo, então calculada à parte.
        if (isPropositional(ast)) {
          truthTable = generateTruthTable(ast);
        }

        // Classificação unificada por tableaux (funciona pra proposicional
        // e pra predicados igual — testa validade E satisfatibilidade,
        // sem depender de tabela-verdade, que só serve pro caso
        // puramente proposicional):
        //   1) É válida/tautologia? (nega e testa se fecha)
        //   2) Se não fechou por ter batido o limite de passos, é
        //      indeterminado — "não é tautologia" só é uma conclusão
        //      segura quando o ramo da negação genuinamente ficou aberto
        //      (decidido), não quando o motor só não teve tempo de decidir.
        //   3) Senão, testa se é insatisfazível/contradição — mesma lógica.
        //   4) Só resta contingente quando ambos os testes concluíram de
        //      verdade, sem bater o limite em nenhum dos dois.
        const tautologyResult = checkTautology(ast);
        if (tautologyResult.isTautology) {
          // Prova por refutação clássica: nega a fórmula e mostra a
          // árvore fechando — mais revelador do que só confirmar que a
          // fórmula original é satisfazível (trivial pra qualquer válida).
          tableauResult = tautologyResult;
          verdictClass = 'good';
          verdictHTML = 'VÁLIDA / TAUTOLOGIA — verdadeira em qualquer interpretação (a árvore abaixo é da <em>negação</em> da fórmula, mostrando por que ela não pode ser falsa)';
          counterexample = null;
        } else if (tautologyResult.limitReached) {
          indeterminate = true;
          tableauResult = tautologyResult;
          verdictClass = 'warn';
          verdictHTML = 'INDETERMINADO — o motor não conseguiu decidir dentro do limite de passos';
        } else {
          const satResult = checkSatisfiability(ast);
          if (satResult.limitReached && !satResult.satisfiable) {
            indeterminate = true;
            tableauResult = satResult;
            verdictClass = 'warn';
            verdictHTML = 'INDETERMINADO — o motor não conseguiu decidir dentro do limite de passos';
          } else if (!satResult.satisfiable) {
            tableauResult = satResult;
            verdictClass = 'bad';
            verdictHTML = 'CONTRADIÇÃO / INSATISFAZÍVEL — falsa em qualquer interpretação';
            counterexample = null;
          } else {
            tableauResult = satResult;
            verdictClass = 'warn';
            verdictHTML = 'CONTINGENTE — verdadeira em algumas interpretações, falsa em outras (a árvore mostra uma interpretação que a torna verdadeira)';
            counterexample = satResult.model;
          }
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

    verdictEl.className = `lm-verdict lm-verdict-${verdictClass}`;
    verdictEl.innerHTML = verdictHTML;

    if (equivalentNote && !indeterminate) {
      equivalentNoteEl.textContent = equivalentNote;
      equivalentNoteEl.style.display = '';
    } else {
      equivalentNoteEl.style.display = 'none';
    }

    if (indeterminate) {
      // Nada de despejar uma árvore gigante e inútil (formatos com padrão
      // ∀∃ podem gerar centenas de nós antes de bater o limite de passos,
      // sem nunca decidir) nem um "contraexemplo" que não foi de fato
      // confirmado — melhor ser transparente sobre a limitação do que
      // mostrar uma parede de texto sem valor pedagógico.
      counterexampleEl.style.display = 'none';
      stepNavEl.style.display = 'none';
      stepCaptionEl.style.display = 'none';
      truthTableWrap.style.display = 'none';
      treeWrap.innerHTML = `<p style="font-family:var(--serif);font-size:14.5px;padding:14px;margin:0;">
        A expansão bateu o limite de ${tableauResult.stepCount} passos sem que todos os ramos se decidissem — comum em fórmulas com padrão ∀∃ (ida e volta entre universal e existencial), que podem não terminar nesse método. Isso <strong>não</strong> significa que a resposta seja "inválido"/"insatisfazível" — só que o motor não conseguiu confirmar nem refutar dentro do orçamento de passos.
        Um contramodelo pequeno pode muito bem existir mesmo assim; encontrar o menor exigiria uma busca por modelo finito, um método diferente do que essa ferramenta usa hoje.
      </p>`;
      resultEl.style.display = '';
      resultEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return;
    }

    if (truthTable) {
      truthTableEl.innerHTML = buildTruthTableHTML(truthTable);
      truthTableWrap.style.display = '';
      truthTablePanel.classList.remove('open');
      truthTableToggle.setAttribute('aria-expanded', 'false');
    } else {
      truthTableWrap.style.display = 'none';
    }

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

    startStepNavigation(tableauResult);
    resultEl.style.display = '';
    resultEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // ---------- navegação passo a passo ----------
  // A árvore final já é calculada de uma vez pelo motor (buildTableau
  // continua fazendo tudo de uma vez, sem mudança nenhuma nisso) — o
  // "passo a passo" aqui é só controlar QUANTO da árvore já calculada
  // fica visível, usando os revealStep que renderTableauSVG já calcula
  // pra cada elemento. As posições nunca mudam ao navegar, só o que
  // está visível.
  function startStepNavigation(tableauResult) {
    currentTableauResult = tableauResult;
    const layout = layoutTableau(tableauResult);
    currentTotalSteps = layout.totalSteps;
    currentStepCaptions = layout.stepCaptions;

    if (currentTotalSteps === 0) {
      // Fórmula trivial (ex.: um único literal) — nenhuma regra foi
      // aplicada, não há o que navegar. Mostra a árvore (de uma linha só)
      // direto, sem os controles.
      stepNavEl.style.display = 'none';
      stepCaptionEl.style.display = 'none';
      treeWrap.innerHTML = renderTableauSVG(tableauResult);
      return;
    }

    stepNavEl.style.display = '';
    stepCaptionEl.style.display = '';
    renderAtStep(0);
  }

  function renderAtStep(n) {
    currentStep = Math.max(0, Math.min(n, currentTotalSteps));
    treeWrap.innerHTML = renderTableauSVG(currentTableauResult, { revealUpToStep: currentStep });
    stepCounterEl.textContent = `PASSO ${currentStep} DE ${currentTotalSteps}`;
    stepCaptionEl.textContent = currentStep === 0
      ? 'Estado inicial — premissas e negação da conclusão, antes de qualquer regra ser aplicada.'
      : currentStepCaptions[currentStep - 1];
    stepStartBtn.disabled = currentStep === 0;
    stepPrevBtn.disabled = currentStep === 0;
    stepNextBtn.disabled = currentStep === currentTotalSteps;
    stepEndBtn.disabled = currentStep === currentTotalSteps;
  }

  stepStartBtn.addEventListener('click', () => renderAtStep(0));
  stepPrevBtn.addEventListener('click', () => renderAtStep(currentStep - 1));
  stepNextBtn.addEventListener('click', () => renderAtStep(currentStep + 1));
  stepEndBtn.addEventListener('click', () => renderAtStep(currentTotalSteps));

  analyzeBtn.addEventListener('click', analyze);
  mainInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') analyze();
  });

  setMode('formula');
})();
