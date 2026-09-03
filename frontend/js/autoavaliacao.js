/**
 * autoavaliacao.js — assistente em etapas para o relatório de
 * autoavaliação. Todo o estado vive só na memória desta página (nada em
 * localStorage/sessionStorage — se a aba fechar, recomeça do zero, o que é
 * intencional: nada deve sobreviver além da sessão de preenchimento).
 *
 * A validação aqui é só de conforto/velocidade (falha rápido, sem gastar
 * upload) — a validação de verdade acontece no servidor, em
 * app/services/validacao_arquivos.py, e não pode ser contornada só porque
 * esta camada foi editada ou pulada.
 */
(function () {
  const wizard = document.getElementById("aa-wizard");
  if (!wizard) return;

  const CRITERIOS = [
    { id: "c1", num: "01", nome: "Cumprimento de tarefas assumidas" },
    { id: "c2", num: "02", nome: "Comunicação e colaboração" },
    { id: "c3", num: "03", nome: "Qualidade técnica individual" },
    { id: "c4", num: "04", nome: "Proatividade / iniciativa" },
    { id: "c5", num: "05", nome: "Presença nas cerimônias" },
  ];

  const ANCORAS = {
    c1: [
      "Raramente concluiu as tarefas que assumiu; atrasos frequentes sem avisar a equipe.",
      "Concluiu poucas tarefas assumidas; atrasos recorrentes, às vezes sem aviso prévio.",
      "Concluiu a maior parte das tarefas assumidas dentro do prazo combinado.",
      "Concluiu praticamente todas as tarefas assumidas dentro do prazo, com poucos ajustes.",
      "Concluiu integralmente as tarefas assumidas, dentro do prazo, e ajudou a redefinir escopo quando necessário.",
    ],
    c2: [
      "Comunicação escassa ou ausente; dificultava o alinhamento da equipe.",
      "Comunicação irregular; informações relevantes muitas vezes não eram compartilhadas a tempo.",
      "Comunicou-se de forma adequada nas ocasiões necessárias (reuniões, canais da equipe).",
      "Comunicou-se de forma proativa e clara, mantendo a equipe informada mesmo sem ser cobrado.",
      "Facilitou ativamente a comunicação da equipe, ajudando a resolver mal-entendidos e alinhar expectativas.",
    ],
    c3: [
      "Entregas com problemas recorrentes de qualidade, exigindo retrabalho significativo da equipe.",
      "Entregas com qualidade abaixo do esperado na maior parte das vezes.",
      "Entregas com qualidade adequada ao esperado para a etapa do projeto.",
      "Entregas consistentemente com boa qualidade técnica, exigindo poucos ajustes.",
      "Entregas de alta qualidade técnica, com atenção a boas práticas (testes, documentação, revisão de código).",
    ],
    c4: [
      "Executou apenas o estritamente solicitado, sem antecipar problemas ou propor melhorias.",
      "Raramente tomou iniciativa além do que foi diretamente atribuído.",
      "Ocasionalmente identificou problemas ou propôs melhorias por conta própria.",
      "Frequentemente antecipou problemas e propôs soluções antes de ser cobrado.",
      "Assumiu responsabilidades além do esperado e ajudou a destravar a equipe em momentos críticos.",
    ],
    c5: [
      "Ausências frequentes ou participação passiva nas cerimônias da equipe.",
      "Presença irregular; participação limitada quando presente.",
      "Presente na maioria das cerimônias, com participação adequada.",
      "Presente e engajado em praticamente todas as cerimônias, contribuindo ativamente.",
      "Presença integral e papel ativo na condução das cerimônias (ex.: facilitou discussões, manteve o foco).",
    ],
  };

  const MAX_IMG_MB = 5, MAX_PDF_MB = 5;
  // Mesmos limites do backend (backend/app/routers/autoavaliacao.py) —
  // travados aqui via maxlength pra nunca deixar o aluno digitar além do
  // que o servidor aceita. Um aluno relatou um 422 disparado justamente
  // por uma justificativa passar de 500 caracteres; o campo não tinha
  // nem maxlength nem contador, então não havia como ele perceber o
  // limite antes de tentar gerar o relatório.
  const MAX_LEN = { aluno: 200, turma: 120, equipe: 120, professor: 200, reflexao: 2000, justificativa: 500 };

  const qs = new URLSearchParams(window.location.search);
  const state = {
    aluno: "", matricula: "", turma: qs.get("turma") || "", equipe: "",
    professor: qs.get("professor") || "", disciplina: qs.get("disciplina") || "Prática em Engenharia de Software",
    sprintNum: qs.get("sprint") || "", sprintTotal: qs.get("total") || "",
    sprintFinal: qs.get("final") === "1",
    periodoDe: "", periodoAte: "",
    crit: {}, reflexaoBem: "", reflexaoDif: "",
  };
  CRITERIOS.forEach((c) => (state.crit[c.id] = { nota: null, tipo: "imagem", justificativa: "", file: null }));

  function steps() {
    const s = ["id", ...CRITERIOS.map((c) => c.id), "reflexao"];
    s.push("resumo");
    return s;
  }
  let cur = 0;

  const dotsEl = document.getElementById("aa-dots");
  const barEl = document.getElementById("aa-bar");
  const labelEl = document.getElementById("aa-step-label");
  const hostEl = document.getElementById("aa-step-host");
  const backBtn = document.getElementById("aa-btn-back");
  const nextBtn = document.getElementById("aa-btn-next");

  function field(label, innerHtml) {
    return `<div class="form-field"><label>${label}</label>${innerHtml}</div>`;
  }

  function renderId() {
    return `
      <p class="aa-eyebrow">IDENTIFICAÇÃO</p>
      <h2>Vamos começar</h2>
      <p class="aa-help">Turma, professor(a) e disciplina já vêm preenchidos quando o link é aberto a partir do Moodle.</p>
      ${field("Nome completo", `<input type="text" id="in_aluno" value="${state.aluno}" placeholder="Seu nome completo" maxlength="${MAX_LEN.aluno}">`)}
      ${field("Matrícula", `<input type="text" id="in_matricula" value="${state.matricula}" placeholder="00.000.000-0">`)}
      ${field("Equipe", `<input type="text" id="in_equipe" value="${state.equipe}" placeholder="Nome da equipe" maxlength="${MAX_LEN.equipe}">`)}
      ${field("Turma", `<input type="text" id="in_turma" value="${state.turma}" placeholder="Ex.: PES-2026/2 — Turma A" maxlength="${MAX_LEN.turma}">`)}
      ${field("Professor(a)", `<input type="text" id="in_professor" value="${state.professor}" placeholder="Nome do(a) professor(a)" maxlength="${MAX_LEN.professor}">`)}
      ${field("Sprint atual / total", `<div style="display:flex;gap:10px;"><input type="number" min="1" max="20" id="in_sprint_num" value="${state.sprintNum}" placeholder="Ex.: 3" style="width:100px;"><input type="number" min="1" max="20" id="in_sprint_total" value="${state.sprintTotal}" placeholder="de quantos, ex.: 6" style="width:140px;"></div>`)}
      <label style="display:flex;align-items:center;gap:8px;font-family:var(--serif);font-size:14px;color:var(--ink);margin-top:4px;">
        <input type="checkbox" id="in_final" ${state.sprintFinal ? "checked" : ""}> Este é o sprint final do projeto (encerramento)
      </label>
      <p class="aa-error" id="err-id"></p>
    `;
  }

  function renderCriterio(c) {
    const d = state.crit[c.id];
    const notaBtns = [1, 2, 3, 4, 5]
      .map((i) => `<button type="button" class="aa-nota-btn ${d.nota === i ? "sel" : ""}" data-nota="${i}">${i}</button>`)
      .join("");
    const rubric = ANCORAS[c.id]
      .map((txt, i) => {
        const n = i + 1;
        return `<div class="aa-rub-row ${d.nota === n ? "sel" : ""}"><span class="aa-rub-num">${n}</span><p>${txt}</p></div>`;
      })
      .join("");
    const dz = d.file
      ? `<i class="ti"></i>${d.file.name} (${(d.file.size / 1024 / 1024).toFixed(1)} MB) — clique para trocar`
      : `Clique para selecionar ${d.tipo === "imagem" ? "uma imagem (JPG, PNG ou WebP, até " + MAX_IMG_MB + " MB)" : "um PDF (até " + MAX_PDF_MB + " MB, máx. 5 páginas)"}`;

    return `
      <p class="aa-eyebrow">CRITÉRIO ${c.num} DE 05</p>
      <h2>${c.nome}</h2>
      <div class="aa-nota-row" id="notaRow">${notaBtns}</div>
      <div class="aa-rubrica"><p class="aa-rubrica-title">O que cada nota significa</p>${rubric}</div>
      <div class="aa-tipo-row">
        <div class="aa-tipo-btn ${d.tipo === "imagem" ? "sel" : ""}" data-tipo="imagem">Evidência em imagem</div>
        <div class="aa-tipo-btn ${d.tipo === "documento" ? "sel" : ""}" data-tipo="documento">Evidência em PDF</div>
      </div>
      <p class="aa-help">Anexar evidência é opcional — mas ajuda o(a) professor(a) a validar a nota.</p>
      <div class="aa-dropzone ${d.file ? "has-file" : ""}" id="dropzone">${dz}</div>
      <input type="file" id="fileInput" accept="${d.tipo === "imagem" ? "image/jpeg,image/png,image/webp" : "application/pdf"}" style="display:none;">
      ${d.file ? `<button type="button" class="btn ghost" id="btnRemoverArquivo" style="font-size:10px;margin-top:8px;">REMOVER ARQUIVO</button>` : ""}
      ${field("Justificativa (relacione a nota escolhida com a evidência, se houver)", `<textarea id="in_justificativa" rows="3" maxlength="${MAX_LEN.justificativa}" placeholder="Ex.: escolhi a nota 4 porque concluí quase todas as tarefas do sprint dentro do prazo — o print anexado mostra o quadro com as tarefas concluídas.">${d.justificativa}</textarea><p id="justif-count" style="font-family:var(--pixel);font-size:9px;color:var(--stone);text-align:right;margin:4px 0 0;"></p>`)}
      <p class="aa-error" id="err-crit"></p>
    `;
  }

  function renderReflexao() {
    return `
      <p class="aa-eyebrow">REFLEXÃO</p>
      <h2>Reflexão do sprint</h2>
      ${field("O que funcionou bem", `<textarea id="in_bem" rows="3" maxlength="${MAX_LEN.reflexao}">${state.reflexaoBem}</textarea>`)}
      ${field("O que você faria diferente", `<textarea id="in_dif" rows="3" maxlength="${MAX_LEN.reflexao}">${state.reflexaoDif}</textarea>`)}
    `;
  }

  function renderResumo() {
    const list = steps();
    const row = (label, value, idx) => `
      <div class="aa-resumo-row">
        <div><p class="aa-resumo-label">${label}</p><p class="aa-resumo-value">${value}</p></div>
        <button type="button" class="btn ghost" data-goto="${idx}">EDITAR</button>
      </div>`;
    let html = `<p class="aa-eyebrow">RESUMO</p><h2>Confira antes de gerar</h2><p class="aa-help">Você pode editar qualquer campo antes de gerar o relatório final.</p>`;
    html += row("Aluno(a)", state.aluno || "<em>não preenchido</em>", list.indexOf("id"));
    CRITERIOS.forEach((c) => {
      const d = state.crit[c.id];
      const val = d.nota ? `Nota ${d.nota}/5${d.file ? " · evidência em " + d.tipo + " · " + d.file.name : " · sem evidência anexada"}` : "<em>não preenchido</em>";
      html += row(`${c.num} — ${c.nome}`, val, list.indexOf(c.id));
    });
    html += row("Reflexão", state.reflexaoBem || state.reflexaoDif ? "Preenchida" : "<em>não preenchido</em>", list.indexOf("reflexao"));

    const notas = CRITERIOS.map((c) => state.crit[c.id].nota).filter(Boolean);
    const media = notas.length ? notas.reduce((a, b) => a + b, 0) / notas.length : 0;
    const notaCalc = notas.length === 5 ? (Math.round((media - 1) * 2.5 * 10) / 10).toFixed(1) : null;

    html += `<div class="aa-aviso"><p>${
      notaCalc !== null ? `Nota calculada (prévia): <strong>${notaCalc}/10</strong>. ` : "Preencha todos os critérios para ver a prévia da nota. "
    }Condicionada à aceitação das evidências pelo(a) professor(a) — a quantidade de anexos não é proporcional à nota.</p></div>`;
    html += `<button type="button" class="btn primary" id="btnGerar" style="width:100%;margin-top:8px;">GERAR RELATÓRIO EM PDF</button>`;
    html += `<p class="aa-error" id="err-resumo"></p>`;
    return html;
  }

  function saveCurrentInputs() {
    const s = steps()[cur];
    if (s === "id") {
      state.aluno = document.getElementById("in_aluno")?.value ?? state.aluno;
      state.matricula = document.getElementById("in_matricula")?.value ?? state.matricula;
      state.equipe = document.getElementById("in_equipe")?.value ?? state.equipe;
      state.turma = document.getElementById("in_turma")?.value ?? state.turma;
      state.professor = document.getElementById("in_professor")?.value ?? state.professor;
      state.sprintNum = document.getElementById("in_sprint_num")?.value ?? state.sprintNum;
      state.sprintTotal = document.getElementById("in_sprint_total")?.value ?? state.sprintTotal;
      state.sprintFinal = document.getElementById("in_final")?.checked ?? state.sprintFinal;
    } else if (CRITERIOS.some((c) => c.id === s)) {
      const jus = document.getElementById("in_justificativa");
      if (jus) state.crit[s].justificativa = jus.value;
    } else if (s === "reflexao") {
      state.reflexaoBem = document.getElementById("in_bem")?.value ?? state.reflexaoBem;
      state.reflexaoDif = document.getElementById("in_dif")?.value ?? state.reflexaoDif;
    }
  }

  function validateStep(s) {
    if (s === "id") {
      const errEl = document.getElementById("err-id");
      if (!state.aluno.trim() || !state.turma.trim() || !state.professor.trim() || !state.sprintNum || !state.sprintTotal) {
        errEl.textContent = "Preencha nome, turma, professor(a) e o sprint atual/total antes de continuar.";
        return false;
      }
      const num = parseInt(state.sprintNum, 10);
      const total = parseInt(state.sprintTotal, 10);
      if (!Number.isInteger(num) || num < 1 || num > 20 || !Number.isInteger(total) || total < 1 || total > 20) {
        errEl.textContent = "Sprint atual e total devem ser números inteiros entre 1 e 20.";
        return false;
      }
      errEl.textContent = "";
      return true;
    }
    if (CRITERIOS.some((c) => c.id === s)) {
      const d = state.crit[s];
      const errEl = document.getElementById("err-crit");
      if (!d.nota) { errEl.textContent = "Escolha uma nota antes de continuar."; return false; }
      if (!d.justificativa || !d.justificativa.trim()) { errEl.textContent = "Escreva uma justificativa para a nota antes de continuar."; return false; }
      errEl.textContent = "";
      return true;
    }
    return true;
  }

  function render() {
    const list = steps();
    const s = list[cur];

    if (s === "id") hostEl.innerHTML = renderId();
    else if (CRITERIOS.some((c) => c.id === s)) hostEl.innerHTML = renderCriterio(CRITERIOS.find((c) => c.id === s));
    else if (s === "reflexao") hostEl.innerHTML = renderReflexao();
    else if (s === "resumo") hostEl.innerHTML = renderResumo();

    labelEl.textContent = `Etapa ${cur + 1} de ${list.length}`;
    barEl.style.width = `${Math.round(((cur + 1) / list.length) * 100)}%`;
    dotsEl.innerHTML = list.map((_, i) => `<span class="${i < cur ? "done" : i === cur ? "active" : ""}"></span>`).join("");

    backBtn.disabled = cur === 0;
    nextBtn.style.display = s === "resumo" ? "none" : "inline-block";

    wireStepEvents(s);
  }

  function wireStepEvents(s) {
    if (CRITERIOS.some((c) => c.id === s)) {
      const d = state.crit[s];
      document.querySelectorAll(".aa-nota-btn").forEach((el) => {
        el.onclick = () => { d.nota = parseInt(el.dataset.nota); render(); };
      });
      document.querySelectorAll(".aa-tipo-btn").forEach((el) => {
        el.onclick = () => { saveCurrentInputs(); d.tipo = el.dataset.tipo; d.file = null; render(); };
      });
      const justifEl = document.getElementById("in_justificativa");
      const justifCountEl = document.getElementById("justif-count");
      function updateJustifCount() {
        const len = justifEl.value.length;
        justifCountEl.textContent = `${len}/${MAX_LEN.justificativa} caracteres`;
        justifCountEl.style.color = len >= MAX_LEN.justificativa ? "#a33" : "var(--stone)";
      }
      justifEl.oninput = updateJustifCount;
      updateJustifCount();
      const dropzone = document.getElementById("dropzone");
      const fileInput = document.getElementById("fileInput");
      dropzone.onclick = () => fileInput.click();
      fileInput.onchange = () => {
        const f = fileInput.files[0];
        if (!f) return;
        const maxMb = d.tipo === "imagem" ? MAX_IMG_MB : MAX_PDF_MB;
        if (f.size > maxMb * 1024 * 1024) {
          document.getElementById("err-crit").textContent = `Arquivo maior que ${maxMb} MB — escolha outro.`;
          return;
        }
        d.file = f;
        document.getElementById("err-crit").textContent = "";
        render();
      };
      const btnRemover = document.getElementById("btnRemoverArquivo");
      if (btnRemover) {
        btnRemover.onclick = () => {
          d.file = null;
          fileInput.value = "";
          render();
        };
      }
    }
    if (s === "resumo") {
      document.querySelectorAll("[data-goto]").forEach((el) => {
        el.onclick = () => { cur = parseInt(el.dataset.goto); render(); };
      });
      document.getElementById("btnGerar").onclick = gerarRelatorio;
    }
  }

  const FIELD_LABELS = {
    aluno: "Nome", matricula: "Matrícula", turma: "Turma", equipe: "Equipe",
    professor: "Professor(a)", disciplina: "Disciplina",
    sprint_num: "Sprint atual", sprint_total: "Sprint total", sprint_final: "Sprint final",
    periodo_de: "Período (de)", periodo_ate: "Período (até)",
    reflexao_bem: "Reflexão — o que funcionou bem", reflexao_dif: "Reflexão — o que faria diferente",
  };
  CRITERIOS.forEach((c) => {
    FIELD_LABELS[`${c.id}_nota`] = `${c.nome} — nota`;
    FIELD_LABELS[`${c.id}_tipo`] = `${c.nome} — tipo de evidência`;
    FIELD_LABELS[`${c.id}_justificativa`] = `${c.nome} — justificativa`;
    FIELD_LABELS[`${c.id}_arquivo`] = `${c.nome} — arquivo de evidência`;
  });

  // O backend responde erros de dois jeitos bem diferentes: nossos próprios
  // HTTPException (ex.: arquivo grande demais) mandam {"detail": "texto"} —
  // uma string simples. Mas erros de validação automática do FastAPI (ex.:
  // um campo chegando vazio, fora de faixa, ou grande demais) mandam
  // {"detail": [{"loc": [...], "msg": "..."}]} — uma LISTA de objetos. Sem
  // tratar os dois formatos, o segundo caso virava "new Error(umArray)",
  // que o JS converte pra "[object Object]" ao exibir — exatamente o erro
  // ilegível que os alunos reportaram (um deles bateu nisso justamente por
  // uma justificativa passar de 500 caracteres).
  function extractErrorMessage(body) {
    if (typeof body.detail === "string" && body.detail.trim()) return body.detail;
    if (Array.isArray(body.detail) && body.detail.length) {
      const linhas = body.detail.map((e) => {
        const campo = Array.isArray(e.loc) ? e.loc[e.loc.length - 1] : null;
        const label = (campo && FIELD_LABELS[campo]) || campo || "campo desconhecido";
        return `${label}: ${e.msg || "valor inválido"}`;
      });
      return "Erro de validação — " + linhas.join("; ");
    }
    return "Falha ao gerar o relatório.";
  }

  async function gerarRelatorio() {
    const btn = document.getElementById("btnGerar");
    const errEl = document.getElementById("err-resumo");
    errEl.textContent = "";

    // Validação defensiva de novo, mesmo que a navegação sequencial
    // (Anterior/Próximo) e os maxlength dos campos já devessem garantir
    // isso — alunos relataram erros 422 do servidor por um critério
    // chegando sem nota válida, e por uma justificativa passando de 500
    // caracteres. Barrar aqui evita mandar dados inválidos pro servidor
    // de qualquer forma, com uma mensagem que aponta exatamente pra onde
    // voltar.
    for (const c of CRITERIOS) {
      const d = state.crit[c.id];
      if (!Number.isInteger(d.nota) || d.nota < 1 || d.nota > 5) {
        errEl.textContent = `Falta escolher uma nota válida no critério "${c.nome}" — clique em EDITAR nesse critério antes de gerar o relatório.`;
        return;
      }
      if (!d.justificativa || !d.justificativa.trim()) {
        errEl.textContent = `Falta escrever a justificativa no critério "${c.nome}" — clique em EDITAR nesse critério antes de gerar o relatório.`;
        return;
      }
      if (d.justificativa.length > MAX_LEN.justificativa) {
        errEl.textContent = `A justificativa do critério "${c.nome}" tem ${d.justificativa.length} caracteres — o máximo é ${MAX_LEN.justificativa}. Volte lá e resuma um pouco.`;
        return;
      }
    }

    btn.disabled = true;
    btn.textContent = "GERANDO...";

    const fd = new FormData();
    fd.append("aluno", state.aluno);
    fd.append("matricula", state.matricula);
    fd.append("turma", state.turma);
    fd.append("equipe", state.equipe);
    fd.append("professor", state.professor);
    fd.append("disciplina", state.disciplina);
    fd.append("sprint_num", state.sprintNum);
    fd.append("sprint_total", state.sprintTotal);
    fd.append("sprint_final", state.sprintFinal ? "true" : "false");
    fd.append("periodo_de", state.periodoDe);
    fd.append("periodo_ate", state.periodoAte);
    fd.append("reflexao_bem", state.reflexaoBem);
    fd.append("reflexao_dif", state.reflexaoDif);
    CRITERIOS.forEach((c, i) => {
      const d = state.crit[c.id];
      const n = i + 1;
      fd.append(`c${n}_nota`, d.nota);
      fd.append(`c${n}_tipo`, d.tipo);
      fd.append(`c${n}_justificativa`, d.justificativa);
      if (d.file) fd.append(`c${n}_arquivo`, d.file);
    });

    try {
      const res = await fetch(`${API_BASE_URL}/autoavaliacao/gerar-relatorio`, { method: "POST", body: fd });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(extractErrorMessage(body));
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `autoavaliacao-sprint${state.sprintNum}-${(state.aluno.split(" ")[0] || "relatorio").toLowerCase()}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      btn.textContent = "RELATÓRIO GERADO — BAIXAR NOVAMENTE";
    } catch (err) {
      errEl.textContent = err.message || "Não foi possível gerar o relatório agora. Tenta de novo em instantes.";
      btn.textContent = "GERAR RELATÓRIO EM PDF";
    } finally {
      btn.disabled = false;
    }
  }

  backBtn.onclick = () => {
    saveCurrentInputs();
    if (cur > 0) { cur--; render(); }
  };
  nextBtn.onclick = () => {
    saveCurrentInputs();
    if (!validateStep(steps()[cur])) return;
    if (cur < steps().length - 1) { cur++; render(); }
  };

  render();
})();
