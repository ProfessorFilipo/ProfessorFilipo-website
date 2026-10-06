/**
 * materials.js — renderiza o catálogo didático de uma disciplina.
 *
 * A página informa data-discipline="<id>" no elemento [data-materials-root].
 * O conteúdo vem de data/materials.json. Recursos com status diferente de
 * "published" não são exibidos publicamente.
 */
(function () {
  "use strict";

  const root = document.querySelector("[data-materials-root]");
  if (!root) return;

  const disciplineId = root.dataset.discipline;
  const catalogUrl = root.dataset.catalog || "data/materials.json";

  const TYPE_LABELS = {
    slides: "SLIDES",
    apostila: "APOSTILA",
    referencia: "REFERÊNCIA",
    exercicios: "EXERCÍCIOS",
    avaliacao: "AVALIAÇÃO",
    gabarito: "GABARITO",
    ferramenta: "FERRAMENTA",
    outros: "OUTROS"
  };

  const TYPE_ORDER = ["slides", "apostila", "referencia", "exercicios", "avaliacao", "gabarito", "ferramenta", "outros"];

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function published(resources) {
    return (resources || []).filter((resource) => resource.status === "published");
  }

  function countResources(discipline) {
    const permanent = published(discipline.permanent_resources).length;
    const semester = (discipline.semesters || []).reduce((sum, s) => sum + published(s.resources).length, 0);
    return permanent + semester;
  }

  function card(resource) {
    const type = resource.type || "outros";
    const typeLabel = TYPE_LABELS[type] || type.toUpperCase();
    const meta = [];
    if (resource.class_label) meta.push(resource.class_label);
    if (resource.pages) meta.push(`${resource.pages} ${resource.pages === 1 ? "página" : "páginas"}`);
    if (resource.format) meta.push(resource.format.toUpperCase());
    if (resource.updated) meta.push(`Atualizado ${resource.updated}`);

    const links = [];
    if (resource.url) {
      links.push(`<a class="btn primary" href="${escapeHtml(resource.url)}" target="_blank" rel="noopener">VISUALIZAR</a>`);
      if (resource.download !== false) {
        links.push(`<a class="btn ghost" href="${escapeHtml(resource.url)}" download>BAIXAR</a>`);
      }
    }
    if (resource.external_url) {
      links.push(`<a class="btn ghost" href="${escapeHtml(resource.external_url)}" target="_blank" rel="noopener">LINK EXTERNO ↗</a>`);
    }

    let related = "";
    if (Array.isArray(resource.related) && resource.related.length) {
      related = `<div class="material-related">Relacionado: ${resource.related.map((item) => `<a href="${escapeHtml(item.url)}"${item.external ? ' target="_blank" rel="noopener"' : ""}>${escapeHtml(item.label)}</a>`).join(" · ")}</div>`;
    }

    return `
      <article class="material-card" data-type="${escapeHtml(type)}">
        <div class="material-card-top"><span class="material-type">${escapeHtml(typeLabel)}</span></div>
        <h4 class="material-card-title">${escapeHtml(resource.title)}</h4>
        ${resource.description ? `<p class="material-card-desc">${escapeHtml(resource.description)}</p>` : ""}
        ${meta.length ? `<div class="material-meta">${meta.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>` : ""}
        ${links.length ? `<div class="material-actions">${links.join("")}</div>` : ""}
        ${related}
      </article>`;
  }

  function section(title, resources) {
    if (!resources.length) return "";
    return `
      <section class="material-section" data-material-section>
        <div class="material-section-head"><h3>${escapeHtml(title)}</h3><span>${resources.length} ${resources.length === 1 ? "item" : "itens"}</span></div>
        <div class="material-grid">${resources.map(card).join("")}</div>
      </section>`;
  }

  function groupByType(resources) {
    const result = new Map();
    TYPE_ORDER.forEach((type) => result.set(type, []));
    resources.forEach((resource) => {
      const type = result.has(resource.type) ? resource.type : "outros";
      result.get(type).push(resource);
    });
    return result;
  }

  function renderResources(resources) {
    const visible = published(resources);
    if (!visible.length) {
      return `<div class="material-empty">Nenhum material público foi cadastrado para este período ainda.</div>`;
    }
    const grouped = groupByType(visible);
    return TYPE_ORDER.map((type) => section(TYPE_LABELS[type], grouped.get(type))).join("");
  }

  function render(discipline) {
    const semesters = discipline.semesters || [];
    const permanent = published(discipline.permanent_resources);
    const current = semesters.find((s) => s.current) || semesters[0];
    const total = countResources(discipline);

    root.innerHTML = `
      <div class="teaching-summary-grid" aria-label="Organização dos materiais">
        <div class="teaching-summary-card"><strong>AULAS</strong><span>Slides, apostilas e referências agrupados pela disciplina e pelo semestre.</span></div>
        <div class="teaching-summary-card"><strong>PRÁTICA</strong><span>Listas de exercícios, revisões, atividades e ferramentas relacionadas.</span></div>
        <div class="teaching-summary-card"><strong>AVALIAÇÕES</strong><span>Provas e gabaritos aparecem somente quando marcados como públicos.</span></div>
      </div>

      ${permanent.length ? `
        <section class="material-section" data-permanent-section>
          <div class="material-section-head"><h3>BIBLIOTECA DA DISCIPLINA</h3><span>conteúdo permanente</span></div>
          <div class="material-grid">${permanent.map(card).join("")}</div>
        </section>` : ""}

      <div class="material-toolbar">
        <h2>MATERIAIS POR SEMESTRE</h2>
        <span class="material-count">${total} ${total === 1 ? "recurso público" : "recursos públicos"}</span>
      </div>

      <div class="material-semesters" role="tablist" aria-label="Semestres">
        ${semesters.map((semester) => `<button type="button" class="material-semester-btn${semester.id === current?.id ? " active" : ""}" data-semester="${escapeHtml(semester.id)}" role="tab" aria-selected="${semester.id === current?.id ? "true" : "false"}">${escapeHtml(semester.label)}${semester.current ? '<span class="current-dot" title="Semestre atual"></span>' : ""}</button>`).join("")}
      </div>

      <div class="material-filters" aria-label="Filtrar por tipo de material">
        <button type="button" class="material-filter active" data-filter="all">TODOS</button>
        ${TYPE_ORDER.map((type) => `<button type="button" class="material-filter" data-filter="${type}">${TYPE_LABELS[type]}</button>`).join("")}
      </div>

      <div data-semester-content>${current ? renderResources(current.resources) : '<div class="material-empty">Nenhum semestre foi cadastrado.</div>'}</div>
      <p class="teaching-note">O ambiente institucional (Moodle/Blackboard) continua sendo a referência oficial para notas, entregas e comunicados. Esta página organiza materiais didáticos e recursos de estudo.</p>
    `;

    let activeSemester = current?.id || null;
    let activeFilter = "all";

    function semesterById(id) {
      return semesters.find((semester) => semester.id === id);
    }

    function applyFilter() {
      root.querySelectorAll(".material-card").forEach((el) => {
        el.hidden = activeFilter !== "all" && el.dataset.type !== activeFilter;
      });
      root.querySelectorAll("[data-material-section]").forEach((sectionEl) => {
        const visibleCards = Array.from(sectionEl.querySelectorAll(".material-card")).some((cardEl) => !cardEl.hidden);
        sectionEl.hidden = !visibleCards;
      });
    }

    root.querySelectorAll(".material-semester-btn").forEach((button) => {
      button.addEventListener("click", () => {
        activeSemester = button.dataset.semester;
        const semester = semesterById(activeSemester);
        root.querySelectorAll(".material-semester-btn").forEach((b) => {
          const selected = b === button;
          b.classList.toggle("active", selected);
          b.setAttribute("aria-selected", selected ? "true" : "false");
        });
        root.querySelector("[data-semester-content]").innerHTML = semester ? renderResources(semester.resources) : '<div class="material-empty">Semestre não encontrado.</div>';
        applyFilter();
      });
    });

    root.querySelectorAll(".material-filter").forEach((button) => {
      button.addEventListener("click", () => {
        activeFilter = button.dataset.filter;
        root.querySelectorAll(".material-filter").forEach((b) => b.classList.toggle("active", b === button));
        applyFilter();
      });
    });
  }

  fetch(catalogUrl, { cache: "no-store" })
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then((catalog) => {
      const discipline = catalog.disciplines?.[disciplineId];
      if (!discipline) throw new Error(`Disciplina '${disciplineId}' não encontrada no catálogo.`);
      render(discipline);
    })
    .catch((error) => {
      console.error("Falha ao carregar catálogo de materiais:", error);
      root.innerHTML = `<div class="material-error">Não foi possível carregar o catálogo de materiais. Atualize a página ou tente novamente em instantes.</div>`;
    });
})();
