"""
Geração do relatório de autoavaliação em PDF.

Tudo roda em memória — o corpo do relatório é renderizado com WeasyPrint,
as evidências em PDF já sanitizadas (ver validacao_arquivos.py) são
concatenadas com pypdf, e o resultado é devolvido como bytes, sem nunca
tocar o disco. Nenhuma função aqui grava arquivo nenhum.

IMPORTANTE — duplicação deliberada: o texto da rubrica (ANCORAS) também
existe em frontend/js/autoavaliacao.js, porque um roda no navegador (para
o aluno consultar ao escolher a nota) e o outro aqui (para compor o PDF
final). Não há como compartilhar isso entre Python e JavaScript sem uma
build step adicional — se o texto da rubrica mudar, atualize os dois
lugares.
"""
import hashlib
import io
import string
from datetime import datetime, timezone
from pathlib import Path

from weasyprint import HTML
from pypdf import PdfReader, PdfWriter

ASSETS = Path(__file__).parent.parent / "assets"

ANCORAS: dict[str, list[str]] = {
    "cumprimento_tarefas": [
        "Raramente concluiu as tarefas que assumiu; atrasos frequentes sem avisar a equipe.",
        "Concluiu poucas tarefas assumidas; atrasos recorrentes, às vezes sem aviso prévio.",
        "Concluiu a maior parte das tarefas assumidas dentro do prazo combinado.",
        "Concluiu praticamente todas as tarefas assumidas dentro do prazo, com poucos ajustes.",
        "Concluiu integralmente as tarefas assumidas, dentro do prazo, e ajudou a redefinir "
        "escopo quando necessário.",
    ],
    "comunicacao": [
        "Comunicação escassa ou ausente; dificultava o alinhamento da equipe.",
        "Comunicação irregular; informações relevantes muitas vezes não eram compartilhadas a tempo.",
        "Comunicou-se de forma adequada nas ocasiões necessárias (reuniões, canais da equipe).",
        "Comunicou-se de forma proativa e clara, mantendo a equipe informada mesmo sem ser cobrado.",
        "Facilitou ativamente a comunicação da equipe, ajudando a resolver mal-entendidos e "
        "alinhar expectativas.",
    ],
    "qualidade_tecnica": [
        "Entregas com problemas recorrentes de qualidade, exigindo retrabalho significativo da equipe.",
        "Entregas com qualidade abaixo do esperado na maior parte das vezes.",
        "Entregas com qualidade adequada ao esperado para a etapa do projeto.",
        "Entregas consistentemente com boa qualidade técnica, exigindo poucos ajustes.",
        "Entregas de alta qualidade técnica, com atenção a boas práticas (testes, documentação, "
        "revisão de código).",
    ],
    "proatividade": [
        "Executou apenas o estritamente solicitado, sem antecipar problemas ou propor melhorias.",
        "Raramente tomou iniciativa além do que foi diretamente atribuído.",
        "Ocasionalmente identificou problemas ou propôs melhorias por conta própria.",
        "Frequentemente antecipou problemas e propôs soluções antes de ser cobrado.",
        "Assumiu responsabilidades além do esperado e ajudou a destravar a equipe em momentos críticos.",
    ],
    "presenca_cerimonias": [
        "Ausências frequentes ou participação passiva nas cerimônias da equipe.",
        "Presença irregular; participação limitada quando presente.",
        "Presente na maioria das cerimônias, com participação adequada.",
        "Presente e engajado em praticamente todas as cerimônias, contribuindo ativamente.",
        "Presença integral e papel ativo na condução das cerimônias (ex.: facilitou discussões, "
        "manteve o foco).",
    ],
}

# (chave_ancora, número, nome de exibição) — ordem fixa, usada para numeração
# automática dos anexos e para o cálculo da nota.
CRITERIOS_ORDEM = [
    ("cumprimento_tarefas", "01", "Cumprimento de tarefas assumidas"),
    ("comunicacao", "02", "Comunicação e colaboração"),
    ("qualidade_tecnica", "03", "Qualidade técnica individual"),
    ("proatividade", "04", "Proatividade / iniciativa"),
    ("presenca_cerimonias", "05", "Presença nas cerimônias"),
]


def _svg(name: str) -> str:
    return (ASSETS / "icons" / name).read_text()


def _sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


BASE_CSS = f'''
@font-face {{ font-family: 'Silkscreen'; src: url('{ASSETS}/fonts/Silkscreen-Regular.ttf'); font-weight: 400; }}
@font-face {{ font-family: 'Silkscreen'; src: url('{ASSETS}/fonts/Silkscreen-Bold.ttf'); font-weight: 700; }}
@font-face {{ font-family: 'Source Serif 4'; src: url('{ASSETS}/fonts/SourceSerif4-Variable.ttf'); font-weight: 200 900; }}
@font-face {{ font-family: 'Source Serif 4'; src: url('{ASSETS}/fonts/SourceSerif4Italic-Variable.ttf'); font-weight: 200 900; font-style: italic; }}

:root {{
  --paper: #F1F4EF; --paper-2: #E7ECE3; --ink: #10181C;
  --teal: #2E8B79; --teal-deep: #1C5C4F; --amber: #E8871E;
  --royal: #3B4FE0; --stone: #8A8677;
}}
* {{ box-sizing: border-box; }}
body {{ font-family: 'Source Serif 4'; color: var(--ink); background: var(--paper); font-size: 10.3pt; line-height: 1.45; }}

.masthead {{ display: flex; align-items: center; gap: 3mm; border-bottom: 1.4pt solid var(--ink);
  padding-bottom: 3mm; margin-bottom: 5mm; }}
.masthead-avatar {{ width: 9mm; height: 9mm; border-radius: 50%; border: 0.8pt solid var(--ink);
  object-fit: cover; flex-shrink: 0; }}
.masthead-mark {{ font-family: 'Silkscreen'; font-weight: 700; font-size: 9pt; color: var(--teal-deep); }}
.masthead-sep {{ color: var(--stone); font-size: 9pt; }}
.masthead-sub {{ font-family: 'Silkscreen'; font-size: 7.4pt; color: var(--stone); letter-spacing: 0.02em; }}

h1.titulo {{ font-family: 'Silkscreen'; font-weight: 700; font-size: 17pt; text-transform: uppercase; margin: 0 0 1.5mm 0; }}
p.subtitulo {{ font-family: 'Source Serif 4'; font-style: italic; color: var(--stone); font-size: 10pt; margin: 0 0 6mm 0; }}

table.meta {{ width: 100%; border-collapse: collapse; margin-bottom: 5mm; background: var(--paper-2); border: 0.8pt solid var(--paper-2); }}
table.meta td {{ padding: 2.6mm 3.5mm; vertical-align: top; width: 25%; border: 0.6pt solid var(--paper); }}
table.meta .label {{ display: block; font-family: 'Silkscreen'; font-size: 6.2pt; color: var(--stone); text-transform: uppercase; letter-spacing: 0.03em; margin-bottom: 0.8mm; }}
table.meta .value {{ font-family: 'Source Serif 4'; font-size: 9.4pt; }}

.aviso-box {{ border: 1pt solid var(--amber); background: #FCF1E2; padding: 3.4mm 4mm; margin-bottom: 7mm; display: flex; gap: 3mm; align-items: flex-start; }}
.aviso-box .tag {{ font-family: 'Silkscreen'; font-size: 7.6pt; color: var(--amber); background: var(--ink); padding: 1mm 2mm; flex-shrink: 0; }}
.aviso-box p {{ font-size: 8.9pt; margin: 0; color: var(--ink); }}

section.criterio {{ margin-bottom: 7mm; padding-bottom: 6mm; border-bottom: 0.6pt solid var(--paper-2); }}
.criterio-head {{ display: flex; align-items: baseline; gap: 3mm; border-bottom: 1pt solid var(--ink); padding-bottom: 1.6mm; margin-bottom: 2.6mm; }}
.criterio-num {{ font-family: 'Silkscreen'; font-size: 9pt; color: var(--teal-deep); }}
h3.criterio-titulo {{ font-family: 'Silkscreen'; font-size: 10.5pt; text-transform: uppercase; margin: 0; flex-grow: 1; }}
.nota-badge {{ font-family: 'Silkscreen'; background: var(--teal); color: var(--paper); padding: 1.4mm 2.6mm; }}
.nota-badge .nota-valor {{ font-size: 10pt; }}
.nota-badge .nota-max {{ font-size: 7pt; opacity: 0.85; }}

.dots-row {{ margin-bottom: 2.6mm; }}
.dot {{ display: inline-block; width: 3.4mm; height: 3.4mm; margin-right: 1.4mm; background: var(--paper-2); border: 0.6pt solid var(--stone); }}
.dot.on {{ background: var(--teal); border-color: var(--teal-deep); }}

p.ancora {{ font-size: 9.3pt; background: var(--paper-2); padding: 2.6mm 3.2mm; margin: 0 0 3.2mm 0; border-left: 2pt solid var(--teal); }}

.evidencia {{ margin-top: 2.6mm; }}
.evidencia-img {{ display: block; max-width: 100%; max-height: 62mm; border: 0.8pt solid var(--stone); }}
p.evidencia-legenda {{ font-size: 8.7pt; color: var(--stone); margin: 1.8mm 0 0 0; }}

.evidencia-doc {{ display: flex; align-items: center; gap: 3mm; border: 1pt solid var(--royal); background: var(--paper-2); padding: 3mm; }}
.doc-icon svg {{ width: 8mm; height: 8mm; }}
.doc-info {{ display: flex; flex-direction: column; }}
.doc-ref {{ font-family: 'Silkscreen'; font-size: 8pt; color: var(--royal); text-transform: uppercase; }}
.doc-file {{ font-size: 8.7pt; color: var(--stone); font-style: italic; }}

.section-label {{ font-family: 'Silkscreen'; font-size: 11pt; text-transform: uppercase; border-bottom: 1.4pt solid var(--ink); padding-bottom: 1.8mm; margin: 0 0 4mm 0; display: flex; align-items: center; gap: 2.4mm; }}
.section-label svg {{ width: 5.5mm; height: 5.5mm; }}

.reflexao-box {{ background: var(--paper-2); border-left: 2pt solid var(--teal-deep); padding: 3.2mm 3.6mm; margin-bottom: 4mm; }}
.reflexao-box .rot {{ font-family: 'Silkscreen'; font-size: 7pt; color: var(--teal-deep); text-transform: uppercase; display: block; margin-bottom: 1.4mm; }}

.resultado-box {{ border: 1.2pt solid var(--teal-deep); background: var(--paper-2); padding: 5mm 6mm; margin: 3mm 0 8mm 0; display: flex; align-items: center; gap: 6mm; }}
.resultado-nota {{ font-family: 'Silkscreen'; background: var(--teal); color: var(--paper); padding: 3mm 5mm; font-size: 15pt; white-space: nowrap; }}
.resultado-nota span {{ font-size: 9pt; opacity: 0.85; }}
.resultado-texto p {{ font-size: 8.9pt; color: var(--ink); margin: 0; }}

.anexo-divider {{ background: var(--ink); color: var(--paper); font-family: 'Silkscreen'; font-size: 13pt; text-transform: uppercase; padding: 6mm; margin-bottom: 6mm; text-align: center; }}
'''

PAGE_RULE = '''
@page {
  size: A4; margin: 20mm 18mm 24mm 18mm;
  @bottom-left {
    content: "Gerado em filipomor.com — nenhum dado ou arquivo desta sessão foi armazenado no servidor.\\A HASH_PLACEHOLDER";
    font-family: 'Silkscreen'; font-size: 5.6pt; color: var(--stone); width: 140mm; white-space: pre-line;
  }
  @bottom-right {
    content: "PÁGINA " counter(page) " DE " counter(pages);
    font-family: 'Silkscreen'; font-size: 6pt; color: var(--stone);
  }
}
'''

PAGE_RULE_DIVIDER = '''
@page { size: A4; margin: 20mm 18mm 24mm 18mm; }
'''


def _nota_dots(n: int) -> str:
    return "".join(f'<span class="dot {"on" if i <= n else ""}"></span>' for i in range(1, 6))


def gerar_relatorio_pdf(dados: dict) -> tuple[bytes, str]:
    """
    dados esperado:
      aluno, matricula, turma, equipe, professor, disciplina,
      sprint_num, sprint_total, sprint_final (bool),
      periodo_de, periodo_ate,
      criterios: lista de 5 dicts na ordem de CRITERIOS_ORDEM, cada um com
        {chave, nota (1-5), tipo ('imagem'|'documento'),
         arquivo_bytes (já validado/sanitizado, ou None se nenhuma evidência
         foi anexada — evidência é opcional), nome_arquivo (idem), justificativa}
      reflexao_bem, reflexao_dif

    Retorna (pdf_bytes, hash_hex_completo).
    """
    gerado_em = datetime.now(timezone.utc)

    criterios = dados["criterios"]
    if len(criterios) != 5:
        raise ValueError("Esperado exatamente 5 critérios.")

    # Só entram na numeração de anexos os critérios do tipo "documento" que
    # de fato têm um PDF de evidência anexado (evidência é opcional).
    documentos = [c for c in criterios if c["tipo"] == "documento" and c.get("arquivo_bytes")]
    for i, c in enumerate(documentos):
        c["anexo_letra"] = string.ascii_uppercase[i]

    media_1_5 = sum(c["nota"] for c in criterios) / len(criterios)
    nota_calculada = round((media_1_5 - 1) * 2.5, 1)

    partes_hash = [dados["aluno"], gerado_em.isoformat()]
    for c in criterios:
        partes_hash.append(f'{c["chave"]}:{c["nota"]}')
        # Sem evidência anexada, usa um marcador estável (em vez do hash de
        # um arquivo que não existe) — o hash final ainda muda se a presença
        # de evidência mudar entre gerações.
        partes_hash.append(_sha256_bytes(c["arquivo_bytes"]) if c.get("arquivo_bytes") else "sem-evidencia")
    hash_final = hashlib.sha256("|".join(partes_hash).encode("utf-8")).hexdigest()
    hash_curto = f'{hash_final[:12]}…{hash_final[-12:]}'

    def evidencia_html(c):
        if not c.get("arquivo_bytes"):
            return f'''
            <div class="evidencia">
              <p class="evidencia-legenda">Nenhuma evidência anexada — <em>{c["justificativa"]}</em></p>
            </div>'''
        if c["tipo"] == "imagem":
            b64 = c["arquivo_bytes"]
            import base64
            data_uri = "data:image/jpeg;base64," + base64.b64encode(b64).decode("ascii")
            return f'''
            <div class="evidencia">
              <img class="evidencia-img" src="{data_uri}">
              <p class="evidencia-legenda"><em>{c["justificativa"]}</em></p>
            </div>'''
        return f'''
        <div class="evidencia">
          <div class="evidencia-doc">
            <div class="doc-icon">{_svg("icon-doc.svg")}</div>
            <div class="doc-info">
              <span class="doc-ref">Ver Anexo {c["anexo_letra"]}</span>
              <span class="doc-file">{c["nome_arquivo"]}</span>
            </div>
          </div>
          <p class="evidencia-legenda"><em>{c["justificativa"]}</em></p>
        </div>'''

    criterios_html = ""
    for (chave, num, nome), c in zip(CRITERIOS_ORDEM, criterios):
        ancora = ANCORAS[chave][c["nota"] - 1]
        criterios_html += f'''
        <section class="criterio">
          <div class="criterio-head">
            <span class="criterio-num">{num}</span>
            <h3 class="criterio-titulo">{nome}</h3>
            <div class="nota-badge"><span class="nota-valor">{c["nota"]}</span><span class="nota-max">/5</span></div>
          </div>
          <div class="dots-row">{_nota_dots(c["nota"])}</div>
          <p class="ancora">{ancora}</p>
          {evidencia_html(c)}
        </section>'''

    body_html = f'''<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8">
    <style>{BASE_CSS}{PAGE_RULE.replace("HASH_PLACEHOLDER", f"Hash de integridade (SHA-256, abreviado): {hash_curto}")}</style>
    </head><body>

    <div class="masthead">
      <img class="masthead-avatar" src="{ASSETS}/logo-photo.jpg">
      <span class="masthead-mark">FILIPOMOR.COM</span>
      <span class="masthead-sep">/</span>
      <span class="masthead-sub">RELATÓRIO DE AUTOAVALIAÇÃO — {dados["disciplina"].upper()}</span>
    </div>

    <h1 class="titulo">Relatório de Autoavaliação</h1>
    <p class="subtitulo">Sprint {dados["sprint_num"]} de {dados["sprint_total"]}{" — Encerramento do projeto" if dados.get("sprint_final") else ""}</p>

    <table class="meta">
      <tr>
        <td><span class="label">Aluno(a)</span><span class="value">{dados["aluno"]}</span></td>
        <td><span class="label">Matrícula</span><span class="value">{dados["matricula"]}</span></td>
        <td><span class="label">Turma</span><span class="value">{dados["turma"]}</span></td>
        <td><span class="label">Equipe</span><span class="value">{dados["equipe"]}</span></td>
      </tr>
      <tr>
        <td><span class="label">Disciplina</span><span class="value">{dados["disciplina"]}</span></td>
        <td><span class="label">Professor(a)</span><span class="value">{dados["professor"]}</span></td>
        <td><span class="label">Período do sprint</span><span class="value">{dados["periodo_de"]} a {dados["periodo_ate"]}</span></td>
        <td><span class="label">Gerado em</span><span class="value">{gerado_em.strftime("%d/%m/%Y, %H:%M")} (UTC)</span></td>
      </tr>
    </table>

    <div class="aviso-box">
      <span class="tag">ATENÇÃO</span>
      <p>A nota indicada ao final deste relatório é calculada automaticamente a partir das notas que o(a)
      próprio(a) aluno(a) atribuiu a cada critério — ela <strong>não avalia a qualidade das evidências
      anexadas</strong>, apenas soma o que foi autodeclarado. A quantidade de evidências não é proporcional à
      nota: uma única evidência pode justificar uma nota alta em um critério, e vários anexos podem não
      justificar uma nota alta em outro. A validação da coerência entre nota e evidência é feita manualmente
      pelo(a) professor(a).</p>
    </div>

    <h2 class="section-label">{_svg("icon-gear.svg")} Autoavaliação por critério</h2>
    {criterios_html}

    <h2 class="section-label">{_svg("icon-cap.svg")} Reflexão do sprint</h2>
    <div class="reflexao-box"><span class="rot">O que funcionou bem</span>{dados.get("reflexao_bem", "")}</div>
    <div class="reflexao-box"><span class="rot">O que você faria diferente</span>{dados.get("reflexao_dif", "")}</div>

    <h2 class="section-label">{_svg("icon-seal.svg")} Resultado deste sprint</h2>
    <div class="resultado-box">
      <div class="resultado-nota">{nota_calculada:.1f}<span>/10</span></div>
      <div class="resultado-texto">
        <p>Calculada automaticamente a partir das 5 autoavaliações informadas acima — <strong>condicionada à
        aceitação das evidências pelo(a) professor(a)</strong>, conforme aviso no início deste relatório.</p>
        <p style="margin-top:1.6mm;">Hash de integridade (SHA-256, abreviado): {hash_curto}</p>
      </div>
    </div>

    </body></html>'''

    body_pdf = HTML(string=body_html, base_url=str(ASSETS)).write_pdf()

    writer = PdfWriter()
    for page in PdfReader(io.BytesIO(body_pdf)).pages:
        writer.add_page(page)

    for (chave, num, nome), c in zip(CRITERIOS_ORDEM, criterios):
        if c["tipo"] != "documento":
            continue
        div_html = f'''<!DOCTYPE html><html><head><meta charset="utf-8">
        <style>{BASE_CSS}{PAGE_RULE_DIVIDER}</style></head><body>
        <div class="anexo-divider">Anexo {c["anexo_letra"]}</div>
        <p style="font-family:'Silkscreen';font-size:7.5pt;color:var(--stone);text-align:center;">
          EVIDÊNCIA EM PDF — SPRINT {dados["sprint_num"]}, CRITÉRIO {num} ({nome.upper()})<br>
          ARQUIVO: {c["nome_arquivo"]} — SANITIZADO NA GERAÇÃO DESTE RELATÓRIO
        </p>
        </body></html>'''
        div_pdf = HTML(string=div_html, base_url=str(ASSETS)).write_pdf()
        for page in PdfReader(io.BytesIO(div_pdf)).pages:
            writer.add_page(page)
        for page in PdfReader(io.BytesIO(c["arquivo_bytes"])).pages:
            writer.add_page(page)

    out = io.BytesIO()
    writer.write(out)
    return out.getvalue(), hash_final
