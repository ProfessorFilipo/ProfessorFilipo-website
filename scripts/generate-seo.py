#!/usr/bin/env python3
"""Generate SEO-ready static frontend pages for filipomor.com.

Source of truth for teaching resources remains frontend/data/materials.json.
This script:
- pre-renders teaching resources into discipline HTML pages;
- adds canonical, Open Graph, Twitter and JSON-LD metadata;
- normalizes internal .html links to clean canonical URLs;
- removes the development API-status footer and unneeded api.js loads;
- writes robots.txt and sitemap.xml.

Run from anywhere inside the repository:
    python3 scripts/generate-seo.py
"""
from __future__ import annotations

import html
import json
import re
from datetime import date
from pathlib import Path
from urllib.parse import urljoin

ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "frontend"
CATALOG_PATH = FRONTEND / "data" / "materials.json"
BASE_URL = "https://filipomor.com"
OG_IMAGE = f"{BASE_URL}/assets/logo-photo.jpg"
SITE_NAME = "Filipo Novo Mór"

SEO_START = "<!-- SEO:START -->"
SEO_END = "<!-- SEO:END -->"

TYPE_LABELS = {
    "slides": "SLIDES",
    "apostila": "APOSTILA",
    "referencia": "REFERÊNCIA",
    "exercicios": "EXERCÍCIOS",
    "avaliacao": "AVALIAÇÃO",
    "gabarito": "GABARITO",
    "ferramenta": "FERRAMENTA",
    "outros": "OUTROS",
}
TYPE_ORDER = ["slides", "apostila", "referencia", "exercicios", "avaliacao", "gabarito", "ferramenta", "outros"]

# High-value pages get intentional titles/descriptions. Other existing pages keep
# their current title/description, while still receiving canonical/social metadata.
META = {
    "index.html": (
        "Filipo Novo Mór — IA Generativa, Digital Twins, Ensino e Pesquisa",
        "Site acadêmico de Filipo Novo Mór: pesquisa em IA Generativa e Digital Twins, ensino de Computação, materiais didáticos e ferramentas interativas.",
    ),
    "ensino.html": (
        "Ensino, Disciplinas e Materiais Didáticos | Filipo Novo Mór",
        "Disciplinas de Computação, materiais didáticos, exercícios, avaliações, orientação de TCC e recursos acadêmicos de Filipo Novo Mór.",
    ),
    "ensino-disciplinas.html": (
        "Disciplinas e Materiais Didáticos de Computação | Filipo Novo Mór",
        "Materiais de disciplinas de Computação na PUCRS e UniLasalle, organizados por disciplina, semestre, aulas, exercícios, avaliações e ferramentas.",
    ),
    "logica.html": (
        "Lógica para Computação: Dedução Natural, Exercícios e Provas | Filipo Novo Mór",
        "Materiais de Lógica para Computação: lógica proposicional, dedução natural, tabelas-verdade, circuitos, exercícios, provas e gabaritos comentados.",
    ),
    "estruturas-dados.html": (
        "Estruturas de Dados: Complexidade, O, Ω e Θ | Filipo Novo Mór",
        "Materiais de Estruturas de Dados sobre análise de algoritmos, contagem de operações, complexidade O, Ω e Θ, exercícios e atividades práticas.",
    ),
    "gestao-projetos.html": (
        "Gestão de Projetos: PMBOK 8, Scrum, Kanban e Materiais | Filipo Novo Mór",
        "Materiais de Gestão de Projetos sobre PMBOK 8, Scrum, Kanban, cronograma, qualidade, estimativas, recursos humanos, exercícios e avaliações.",
    ),
    "introducao-computacao.html": (
        "Introdução à Computação: Codificação, Bits e Exercícios | Filipo Novo Mór",
        "Materiais de Introdução à Computação sobre codificação da informação, sistemas binários, representação de dados e listas de exercícios comentadas.",
    ),
    "sistemas-operacionais.html": (
        "Sistemas Operacionais: Memória, Paginação e Simuladores | Filipo Novo Mór",
        "Materiais de Sistemas Operacionais sobre memória, paginação e algoritmos de substituição, com simulador de FIFO, LRU, OPT e Clock.",
    ),
    "praticas-engenharia-software.html": (
        "Práticas em Engenharia de Software: Projetos e Materiais | Filipo Novo Mór",
        "Materiais de Práticas em Engenharia de Software com metodologias, ferramentas, projetos aplicados e recursos de apoio às turmas.",
    ),
    "fundamentos-computacao.html": (
        "Fundamentos da Computação: Materiais e Exercícios | Filipo Novo Mór",
        "Materiais de Fundamentos da Computação, organizados por semestre, para apoio às aulas, exercícios e atividades acadêmicas.",
    ),
    "projeto-integrador-inovacao.html": (
        "Projeto Integrador — Inovação e Ciência de Dados | Filipo Novo Mór",
        "Materiais do Projeto Integrador em Inovação e Ciência de Dados, com recursos organizados por semestre para as turmas da UniLasalle.",
    ),
    "projeto-integrador-ads.html": (
        "Projeto Integrador — Análise e Desenvolvimento de Sistemas | Filipo Novo Mór",
        "Materiais do Projeto Integrador em Análise e Desenvolvimento de Sistemas, com recursos organizados por semestre para as turmas da UniLasalle.",
    ),
    "ferramentas.html": (
        "Ferramentas Didáticas de Computação | Filipo Novo Mór",
        "Ferramentas interativas para ensino de Computação, incluindo lógica proposicional, tabelas em C e simulação de substituição de páginas.",
    ),
    "logica-mor.html": (
        "Lógica Mór — Ferramenta Interativa de Lógica Proposicional | Filipo Novo Mór",
        "Ferramenta didática interativa para praticar e comparar conceitos de lógica proposicional.",
    ),
    "simulador-paginacao.html": (
        "Simulador de Substituição de Páginas: FIFO, LRU, OPT e Clock | Filipo Novo Mór",
        "Simulador didático de substituição de páginas para comparar FIFO, LRU, OPT e Clock passo a passo, com hits, faltas e anomalia de Belady.",
    ),
    "editor-tabelas-c.html": (
        "Editor de Tabelas em C | Filipo Novo Mór",
        "Editor didático para criar e trabalhar com tabelas e matrizes utilizadas em exercícios e exemplos em linguagem C.",
    ),
    "ensino-materiais-anteriores.html": (
        "Arquivo de Materiais Didáticos | Filipo Novo Mór",
        "Arquivo de materiais de disciplinas e semestres anteriores, preservados para consulta acadêmica e estudo.",
    ),
    "ensino-tcc.html": (
        "Orientação de TCC em Computação | Filipo Novo Mór",
        "Informações sobre orientação de TCC1 e TCC2 em cursos de Computação, incluindo planejamento, desenvolvimento e defesa.",
    ),
}

DISCIPLINE_PAGES = {
    "logica.html": "logica",
    "introducao-computacao.html": "introducao-computacao",
    "sistemas-operacionais.html": "sistemas-operacionais",
    "gestao-projetos.html": "gestao-projetos",
    "estruturas-dados.html": "estruturas-dados",
}

DISPLAY_NAMES = {
    "sobre.html": "Sobre",
    "experiencia.html": "Experiência",
    "pesquisa.html": "Pesquisa",
    "ensino.html": "Ensino",
    "ensino-disciplinas.html": "Disciplinas",
    "ensino-tcc.html": "Orientação de TCC",
    "ensino-materiais-anteriores.html": "Arquivo didático",
    "logica.html": "Lógica para Computação",
    "introducao-computacao.html": "Introdução à Computação",
    "sistemas-operacionais.html": "Sistemas Operacionais",
    "gestao-projetos.html": "Gestão de Projetos",
    "estruturas-dados.html": "Estruturas de Dados",
    "praticas-engenharia-software.html": "Práticas em Engenharia de Software",
    "fundamentos-computacao.html": "Fundamentos da Computação",
    "projeto-integrador-inovacao.html": "Projeto Integrador — Inovação / Ciência de Dados",
    "projeto-integrador-ads.html": "Projeto Integrador — ADS",
    "ferramentas.html": "Ferramentas",
    "logica-mor.html": "Lógica Mór",
    "simulador-paginacao.html": "Simulador de substituição de páginas",
    "editor-tabelas-c.html": "Editor de tabelas C",
    "contato.html": "Contato",
}

TEACHING_CHILDREN = set(DISCIPLINE_PAGES) | {
    "praticas-engenharia-software.html", "fundamentos-computacao.html",
    "projeto-integrador-inovacao.html", "projeto-integrador-ads.html",
}
TOOLS_CHILDREN = {"logica-mor.html", "simulador-paginacao.html", "editor-tabelas-c.html"}

# Pages that should exist in search indexes and in sitemap.xml.
# 404 and the student auto-evaluation workflow are intentionally excluded.
SITEMAP_PAGES = [
    "index.html", "sobre.html", "experiencia.html", "pesquisa.html",
    "ensino.html", "ensino-disciplinas.html", "ensino-tcc.html",
    "ensino-materiais-anteriores.html", "logica.html",
    "praticas-engenharia-software.html", "introducao-computacao.html",
    "sistemas-operacionais.html", "gestao-projetos.html", "estruturas-dados.html",
    "fundamentos-computacao.html", "projeto-integrador-inovacao.html",
    "projeto-integrador-ads.html", "ferramentas.html", "logica-mor.html",
    "simulador-paginacao.html", "editor-tabelas-c.html", "contato.html",
]


def canonical_path(filename: str) -> str:
    return "/" if filename == "index.html" else "/" + filename.removesuffix(".html")


def canonical_url(filename: str) -> str:
    return BASE_URL + canonical_path(filename)


def existing_title(text: str) -> str:
    m = re.search(r"<title>(.*?)</title>", text, flags=re.S | re.I)
    return html.unescape(re.sub(r"\s+", " ", m.group(1)).strip()) if m else SITE_NAME


def existing_description(text: str) -> str:
    m = re.search(r'<meta\s+name=["\']description["\']\s+content=["\'](.*?)["\']\s*/?>', text, flags=re.S | re.I)
    if not m:
        return "Site acadêmico de Filipo Novo Mór sobre pesquisa, ensino e Computação."
    return html.unescape(re.sub(r"\s+", " ", m.group(1)).strip())


def replace_title_description(text: str, title: str, description: str) -> str:
    title_escaped = html.escape(title, quote=False)
    desc_escaped = html.escape(description, quote=True)
    if re.search(r"<title>.*?</title>", text, flags=re.S | re.I):
        text = re.sub(r"<title>.*?</title>", f"<title>{title_escaped}</title>", text, count=1, flags=re.S | re.I)
    else:
        text = text.replace("<head>", f"<head>\n<title>{title_escaped}</title>", 1)
    meta_pattern = r'<meta\s+name=["\']description["\'][^>]*>'
    if re.search(meta_pattern, text, flags=re.I):
        text = re.sub(meta_pattern, f'<meta name="description" content="{desc_escaped}">', text, count=1, flags=re.I)
    else:
        text = text.replace(f"<title>{title_escaped}</title>", f"<title>{title_escaped}</title>\n<meta name=\"description\" content=\"{desc_escaped}\">", 1)
    return text


def breadcrumbs_for(filename: str) -> list[tuple[str, str]]:
    if filename == "index.html":
        return []
    current = DISPLAY_NAMES.get(filename, Path(filename).stem.replace("-", " ").title())
    if filename == "ensino-disciplinas.html":
        return [("Início", "/"), ("Ensino", "/ensino"), (current, canonical_path(filename))]
    if filename in TEACHING_CHILDREN:
        return [("Início", "/"), ("Ensino", "/ensino"), ("Disciplinas", "/ensino-disciplinas"), (current, canonical_path(filename))]
    if filename in {"ensino-tcc.html", "ensino-materiais-anteriores.html"}:
        return [("Início", "/"), ("Ensino", "/ensino"), (current, canonical_path(filename))]
    if filename in TOOLS_CHILDREN:
        return [("Início", "/"), ("Ferramentas", "/ferramentas"), (current, canonical_path(filename))]
    return [("Início", "/"), (current, canonical_path(filename))]


def seo_jsonld(filename: str, title: str, description: str) -> dict:
    page_url = canonical_url(filename)
    person = {
        "@type": "Person",
        "@id": f"{BASE_URL}/#person",
        "name": "Filipo Novo Mór",
        "url": BASE_URL + "/",
        "image": OG_IMAGE,
    }
    website = {
        "@type": "WebSite",
        "@id": f"{BASE_URL}/#website",
        "url": BASE_URL + "/",
        "name": SITE_NAME,
        "inLanguage": "pt-BR",
        "publisher": {"@id": f"{BASE_URL}/#person"},
    }
    # Repeat the compact site/person entities on each page so validators and
    # crawlers do not need to resolve cross-document @id references.
    graph: list[dict] = [website, person]
    graph.append({
        "@type": "WebPage",
        "@id": page_url + "#webpage",
        "url": page_url,
        "name": title,
        "description": description,
        "inLanguage": "pt-BR",
        "isPartOf": {"@id": f"{BASE_URL}/#website"},
        "about": {"@id": f"{BASE_URL}/#person"},
    })
    crumbs = breadcrumbs_for(filename)
    if crumbs:
        graph.append({
            "@type": "BreadcrumbList",
            "@id": page_url + "#breadcrumb",
            "itemListElement": [
                {
                    "@type": "ListItem",
                    "position": i,
                    "name": name,
                    "item": BASE_URL + path,
                }
                for i, (name, path) in enumerate(crumbs, start=1)
            ],
        })
    return {"@context": "https://schema.org", "@graph": graph}


def seo_block(filename: str, title: str, description: str, noindex: bool = False) -> str:
    url = canonical_url(filename)
    title_attr = html.escape(title, quote=True)
    desc_attr = html.escape(description, quote=True)
    robots = '<meta name="robots" content="noindex,follow">\n' if noindex else ""
    jsonld = json.dumps(seo_jsonld(filename, title, description), ensure_ascii=False, separators=(",", ":"))
    return f'''{SEO_START}
<link rel="canonical" href="{url}">
{robots}<meta property="og:site_name" content="{SITE_NAME}">
<meta property="og:locale" content="pt_BR">
<meta property="og:type" content="website">
<meta property="og:title" content="{title_attr}">
<meta property="og:description" content="{desc_attr}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{OG_IMAGE}">
<meta property="og:image:alt" content="Filipo Novo Mór">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="{title_attr}">
<meta name="twitter:description" content="{desc_attr}">
<meta name="twitter:image" content="{OG_IMAGE}">
<script type="application/ld+json">{jsonld}</script>
{SEO_END}'''


def insert_seo(text: str, filename: str, noindex: bool = False) -> str:
    # Idempotent: remove our previous generated block first.
    text = re.sub(r"\s*" + re.escape(SEO_START) + r".*?" + re.escape(SEO_END) + r"\s*", "\n", text, flags=re.S)
    current_title = existing_title(text)
    current_desc = existing_description(text)
    title, description = META.get(filename, (current_title, current_desc))
    text = replace_title_description(text, title, description)
    block = seo_block(filename, title, description, noindex=noindex)
    # Put metadata immediately after description for predictable output.
    meta = re.search(r'<meta\s+name=["\']description["\'][^>]*>', text, flags=re.I)
    if meta:
        pos = meta.end()
        text = text[:pos] + "\n" + block + text[pos:]
    else:
        text = text.replace("</head>", block + "\n</head>", 1)
    return text


def normalize_internal_links(text: str) -> str:
    # Top-level static .html links become clean Cloudflare canonical paths.
    # Query strings/fragments are preserved. Assets and external links are untouched.
    pattern = re.compile(r'href=(["\'])(?:\./)?([A-Za-z0-9_-]+)\.html([?#][^"\']*)?\1')
    def repl(m: re.Match) -> str:
        stem = m.group(2)
        suffix = m.group(3) or ""
        path = "/" if stem == "index" else f"/{stem}"
        return f'href={m.group(1)}{path}{suffix}{m.group(1)}'
    return pattern.sub(repl, text)


def remove_dev_api_status(text: str, filename: str) -> str:
    text = re.sub(r'\s*<footer\s+class=["\']api-status["\']>.*?</footer>\s*', "\n", text, flags=re.S | re.I)
    # api.js is still required by the visit counter, contact form and auto-evaluation.
    if filename not in {"index.html", "contato.html", "autoavaliacao.html"}:
        text = re.sub(r'\s*<script\s+src=["\']js/api\.js["\']></script>\s*', "\n", text, flags=re.I)
    return text


def h(value: object) -> str:
    return html.escape(str(value if value is not None else ""), quote=True)


def published(resources: list[dict] | None) -> list[dict]:
    return [r for r in (resources or []) if r.get("status") == "published"]


def resource_card(resource: dict) -> str:
    typ = resource.get("type", "outros")
    label = TYPE_LABELS.get(typ, typ.upper())
    meta = []
    if resource.get("class_label"):
        meta.append(resource["class_label"])
    if resource.get("pages"):
        n = int(resource["pages"])
        meta.append(f"{n} {'página' if n == 1 else 'páginas'}")
    if resource.get("format"):
        meta.append(str(resource["format"]).upper())
    if resource.get("updated"):
        meta.append(f"Atualizado {resource['updated']}")

    links = []
    url = resource.get("url")
    if url:
        links.append(f'<a class="btn primary" href="{h(url)}" target="_blank" rel="noopener">VISUALIZAR</a>')
        if resource.get("download", True) is not False:
            links.append(f'<a class="btn ghost" href="{h(url)}" download>BAIXAR</a>')
    if resource.get("external_url"):
        links.append(f'<a class="btn ghost" href="{h(resource["external_url"])}" target="_blank" rel="noopener">LINK EXTERNO ↗</a>')

    related_html = ""
    if resource.get("related"):
        rels = []
        for item in resource["related"]:
            attrs = ' target="_blank" rel="noopener"' if item.get("external") else ""
            rels.append(f'<a href="{h(item.get("url", ""))}"{attrs}>{h(item.get("label", ""))}</a>')
        related_html = f'<div class="material-related">Relacionado: {" · ".join(rels)}</div>'

    meta_html = "" if not meta else '<div class="material-meta">' + "".join(f"<span>{h(item)}</span>" for item in meta) + "</div>"
    actions = "" if not links else '<div class="material-actions">' + "".join(links) + "</div>"
    desc = f'<p class="material-card-desc">{h(resource.get("description"))}</p>' if resource.get("description") else ""
    return (
        f'<article class="material-card" data-type="{h(typ)}">\n'
        f'  <div class="material-card-top"><span class="material-type">{h(label)}</span></div>\n'
        f'  <h4 class="material-card-title">{h(resource.get("title", ""))}</h4>\n'
        f'  {desc}\n  {meta_html}\n  {actions}\n  {related_html}\n'
        f'</article>'
    )


def resource_sections(resources: list[dict]) -> str:
    visible = published(resources)
    if not visible:
        return '<div class="material-empty">Nenhum material público foi cadastrado para este período ainda.</div>'
    grouped = {t: [] for t in TYPE_ORDER}
    for resource in visible:
        typ = resource.get("type") if resource.get("type") in grouped else "outros"
        grouped[typ].append(resource)
    sections = []
    for typ in TYPE_ORDER:
        items = grouped[typ]
        if not items:
            continue
        count_label = f"{len(items)} {'item' if len(items) == 1 else 'itens'}"
        cards = "\n".join(resource_card(r) for r in items)
        sections.append(
            f'<section class="material-section" data-material-section>\n'
            f'  <div class="material-section-head"><h3>{TYPE_LABELS[typ]}</h3><span>{count_label}</span></div>\n'
            f'  <div class="material-grid">\n{cards}\n  </div>\n'
            f'</section>'
        )
    return "\n".join(sections)


def render_catalog_root(discipline: dict) -> str:
    semesters = discipline.get("semesters") or []
    permanent = published(discipline.get("permanent_resources"))
    current = next((s for s in semesters if s.get("current")), semesters[0] if semesters else None)
    total = len(permanent) + sum(len(published(s.get("resources"))) for s in semesters)

    perm = ""
    if permanent:
        perm_cards = "\n".join(resource_card(r) for r in permanent)
        perm = f'''<section class="material-section material-permanent" data-permanent-section>
  <div class="material-section-head"><h3>BIBLIOTECA DA DISCIPLINA</h3><span>conteúdo permanente</span></div>
  <div class="material-grid">
{perm_cards}
  </div>
</section>'''

    sem_buttons = []
    panels = []
    for semester in semesters:
        sid = semester.get("id", "")
        active = current is not None and sid == current.get("id")
        dot = '<span class="current-dot" title="Semestre atual"></span>' if semester.get("current") else ""
        sem_buttons.append(
            f'<button type="button" class="material-semester-btn{" active" if active else ""}" '
            f'data-semester="{h(sid)}" role="tab" aria-selected="{"true" if active else "false"}" '
            f'aria-controls="materials-semester-{h(sid)}">{h(semester.get("label", sid))}{dot}</button>'
        )
        hidden = "" if active else " hidden"
        panels.append(
            f'<div class="material-semester-panel" id="materials-semester-{h(sid)}" data-semester-panel="{h(sid)}" role="tabpanel"{hidden}>\n'
            + resource_sections(semester.get("resources") or [])
            + "\n</div>"
        )

    filters = ['<button type="button" class="material-filter active" data-filter="all">TODOS</button>']
    filters.extend(f'<button type="button" class="material-filter" data-filter="{t}">{TYPE_LABELS[t]}</button>' for t in TYPE_ORDER)

    return f'''<div class="teaching-summary-grid" aria-label="Organização dos materiais">
  <div class="teaching-summary-card"><strong>AULAS</strong><span>Slides, apostilas e referências agrupados pela disciplina e pelo semestre.</span></div>
  <div class="teaching-summary-card"><strong>PRÁTICA</strong><span>Listas de exercícios, revisões, atividades e ferramentas relacionadas.</span></div>
  <div class="teaching-summary-card"><strong>AVALIAÇÕES</strong><span>Provas e gabaritos aparecem somente quando marcados como públicos.</span></div>
</div>

{perm}

<div class="material-toolbar">
  <h2>MATERIAIS POR SEMESTRE</h2>
  <span class="material-count">{total} {'recurso público' if total == 1 else 'recursos públicos'}</span>
</div>

<div class="material-semesters" role="tablist" aria-label="Semestres">
  {' '.join(sem_buttons)}
</div>

<div class="material-filters" aria-label="Filtrar por tipo de material">
  {' '.join(filters)}
</div>

<div data-semester-content>
{'\n'.join(panels) if panels else '<div class="material-empty">Nenhum semestre foi cadastrado.</div>'}
</div>
<p class="teaching-note">O ambiente institucional (Moodle/Blackboard) continua sendo a referência oficial para notas, entregas e comunicados. Esta página organiza materiais didáticos e recursos de estudo.</p>'''


def prerender_materials(text: str, discipline: dict) -> str:
    generated = "<!-- MATERIALS:GENERATED:START -->\n" + render_catalog_root(discipline) + "\n<!-- MATERIALS:GENERATED:END -->"

    # Idempotent update path: once a page has been generated, only replace the
    # explicitly delimited block. This avoids trying to parse nested <section>
    # elements with a regular expression.
    marker_pattern = re.compile(
        r'<!-- MATERIALS:GENERATED:START -->.*?<!-- MATERIALS:GENERATED:END -->',
        flags=re.S,
    )
    if marker_pattern.search(text):
        text = marker_pattern.sub(generated, text, count=1)
        text = re.sub(
            r'(<section\s+data-materials-root(?![^>]*data-prerendered)[^>]*)(>)',
            r'\1 data-prerendered="true"\2',
            text,
            count=1,
            flags=re.I,
        )
        return text

    # First-generation path. In the source pages the root initially contains
    # only the loading placeholder, so there are no nested sections yet.
    pattern = re.compile(r'(<section\s+data-materials-root[^>]*>)(.*?)(</section>)', flags=re.S | re.I)
    match = pattern.search(text)
    if not match:
        return text
    open_tag = match.group(1)
    if 'data-prerendered=' not in open_tag:
        open_tag = open_tag[:-1] + ' data-prerendered="true">'
    replacement = open_tag + "\n" + generated + "\n" + match.group(3)
    return text[:match.start()] + replacement + text[match.end():]


def update_materials_json(catalog: dict) -> None:
    # Canonicalize HTML resource URLs inside the catalog (e.g. simulator page).
    for discipline in catalog.get("disciplines", {}).values():
        resources = list(discipline.get("permanent_resources", []))
        for semester in discipline.get("semesters", []):
            resources.extend(semester.get("resources", []))
        for resource in resources:
            url = resource.get("url")
            if isinstance(url, str) and re.fullmatch(r"[A-Za-z0-9_-]+\.html", url):
                resource["url"] = "/" + url.removesuffix(".html")
    CATALOG_PATH.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def write_robots() -> None:
    (FRONTEND / "robots.txt").write_text(
        "User-agent: *\nAllow: /\n\nSitemap: https://filipomor.com/sitemap.xml\n",
        encoding="utf-8",
    )


def write_sitemap() -> None:
    today = date.today().isoformat()
    urls = []
    for filename in SITEMAP_PAGES:
        if (FRONTEND / filename).exists():
            urls.append(f"  <url><loc>{canonical_url(filename)}</loc><lastmod>{today}</lastmod></url>")
    xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + "\n".join(urls) + "\n</urlset>\n"
    (FRONTEND / "sitemap.xml").write_text(xml, encoding="utf-8")


def process_html(catalog: dict) -> None:
    for path in sorted(FRONTEND.glob("*.html")):
        filename = path.name
        text = path.read_text(encoding="utf-8")
        if filename in DISCIPLINE_PAGES:
            discipline = catalog.get("disciplines", {}).get(DISCIPLINE_PAGES[filename])
            if discipline:
                text = prerender_materials(text, discipline)
            text = re.sub(r'js/materials\.js(?:\?v=\d+)?', 'js/materials.js?v=2', text)
        text = normalize_internal_links(text)
        text = remove_dev_api_status(text, filename)
        noindex = filename in {"404.html", "autoavaliacao.html"}
        text = insert_seo(text, filename, noindex=noindex)
        path.write_text(text, encoding="utf-8")


def main() -> None:
    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    update_materials_json(catalog)
    # Re-read canonicalized catalog before rendering pages.
    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    process_html(catalog)
    write_robots()
    write_sitemap()
    print("SEO generation complete.")
    print(f"Processed {len(list(FRONTEND.glob('*.html')))} HTML files.")
    print("Teaching resources were pre-rendered from frontend/data/materials.json.")
    print("Generated frontend/robots.txt and frontend/sitemap.xml.")


if __name__ == "__main__":
    main()
