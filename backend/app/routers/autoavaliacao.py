"""
Endpoint de geração do relatório de autoavaliação.

Recebe multipart/form-data (texto + até 5 arquivos de evidência, um por
critério) do assistente em etapas (frontend/autoavaliacao.html), valida e
reprocessa cada evidência em memória, monta o PDF final e devolve como
download — nada é persistido em banco, disco ou cache em nenhuma etapa.
"""
import sys
import traceback

from fastapi import APIRouter, Form, HTTPException, Request, UploadFile
from fastapi.responses import Response

from app.core.limiter import limiter
from app.services.relatorio_pdf import CRITERIOS_ORDEM, gerar_relatorio_pdf
from app.services.validacao_arquivos import (
    check_total_size,
    validate_and_process_image,
    validate_and_sanitize_pdf,
)

router = APIRouter(prefix="/autoavaliacao", tags=["autoavaliacao"])


def log_error(label: str, detail: str) -> None:
    print(f"AUTOAVALIACAO ERROR [{label}]: {detail}", file=sys.stderr, flush=True)


@router.post("/gerar-relatorio")
@limiter.limit("6/minute")
async def gerar_relatorio(
    request: Request,
    aluno: str = Form(..., min_length=1, max_length=200),
    matricula: str = Form(""),
    turma: str = Form(..., min_length=1, max_length=120),
    equipe: str = Form(..., min_length=1, max_length=120),
    professor: str = Form(..., min_length=1, max_length=200),
    disciplina: str = Form(..., min_length=1, max_length=200),
    sprint_num: int = Form(..., ge=1, le=20),
    sprint_total: int = Form(..., ge=1, le=20),
    sprint_final: bool = Form(False),
    periodo_de: str = Form(""),
    periodo_ate: str = Form(""),
    reflexao_bem: str = Form("", max_length=2000),
    reflexao_dif: str = Form("", max_length=2000),
    # Um bloco de 4 campos por critério (c1..c5) — nomes fixos porque o
    # formulário sempre tem exatamente 5 critérios, não uma lista dinâmica.
    c1_nota: int = Form(..., ge=1, le=5), c1_tipo: str = Form(...),
    c1_justificativa: str = Form(..., min_length=1, max_length=500), c1_arquivo: UploadFile | None = None,
    c2_nota: int = Form(..., ge=1, le=5), c2_tipo: str = Form(...),
    c2_justificativa: str = Form(..., min_length=1, max_length=500), c2_arquivo: UploadFile | None = None,
    c3_nota: int = Form(..., ge=1, le=5), c3_tipo: str = Form(...),
    c3_justificativa: str = Form(..., min_length=1, max_length=500), c3_arquivo: UploadFile | None = None,
    c4_nota: int = Form(..., ge=1, le=5), c4_tipo: str = Form(...),
    c4_justificativa: str = Form(..., min_length=1, max_length=500), c4_arquivo: UploadFile | None = None,
    c5_nota: int = Form(..., ge=1, le=5), c5_tipo: str = Form(...),
    c5_justificativa: str = Form(..., min_length=1, max_length=500), c5_arquivo: UploadFile | None = None,
    # Distribuição de contribuição — só relevante quando sprint_final=True.
    # Enviada como duas listas paralelas: nomes e percentuais.
    dist_nomes: list[str] = Form(default=[]),
    dist_percentuais: list[int] = Form(default=[]),
):
    entradas = [
        (c1_nota, c1_tipo, c1_justificativa, c1_arquivo),
        (c2_nota, c2_tipo, c2_justificativa, c2_arquivo),
        (c3_nota, c3_tipo, c3_justificativa, c3_arquivo),
        (c4_nota, c4_tipo, c4_justificativa, c4_arquivo),
        (c5_nota, c5_tipo, c5_justificativa, c5_arquivo),
    ]

    criterios = []
    tamanhos = []
    try:
        for (chave, num, nome), (nota, tipo, justificativa, arquivo) in zip(CRITERIOS_ORDEM, entradas):
            if tipo not in ("imagem", "documento"):
                raise HTTPException(400, f"Critério {num}: tipo de evidência inválido.")
            if arquivo is None:
                raise HTTPException(400, f"Critério {num} ({nome}): evidência obrigatória não enviada.")
            if not justificativa.strip():
                raise HTTPException(400, f"Critério {num} ({nome}): justificativa não pode ficar em branco.")

            raw = await arquivo.read()
            if not raw:
                raise HTTPException(400, f"Critério {num} ({nome}): arquivo de evidência vazio.")
            tamanhos.append(len(raw))

            if tipo == "imagem":
                processado = validate_and_process_image(raw, f"Critério {num} ({nome})")
            else:
                processado = validate_and_sanitize_pdf(raw, f"Critério {num} ({nome})")

            criterios.append({
                "chave": chave,
                "nota": nota,
                "tipo": tipo,
                "arquivo_bytes": processado,
                "nome_arquivo": arquivo.filename or f"evidencia-criterio-{num}",
                "justificativa": justificativa,
            })

        check_total_size(tamanhos)

        distribuicao = None
        if sprint_final and dist_nomes:
            if len(dist_nomes) != len(dist_percentuais):
                raise HTTPException(400, "Distribuição de contribuição: nomes e percentuais não conferem.")
            if sum(dist_percentuais) != 100:
                total = sum(dist_percentuais)
                raise HTTPException(
                    400,
                    f"Distribuição de contribuição: os percentuais somam {total}%, mas precisam somar 100%.",
                )
            distribuicao = [
                (nome, pct, i == 0) for i, (nome, pct) in enumerate(zip(dist_nomes, dist_percentuais))
            ]

        dados = {
            "aluno": aluno, "matricula": matricula or "—", "turma": turma, "equipe": equipe,
            "professor": professor, "disciplina": disciplina,
            "sprint_num": sprint_num, "sprint_total": sprint_total, "sprint_final": sprint_final,
            "periodo_de": periodo_de or "—", "periodo_ate": periodo_ate or "—",
            "reflexao_bem": reflexao_bem, "reflexao_dif": reflexao_dif,
            "criterios": criterios, "distribuicao": distribuicao,
        }

        pdf_bytes, _hash = gerar_relatorio_pdf(dados)

    except HTTPException:
        raise
    except Exception:
        log_error("gerar_relatorio", traceback.format_exc())
        raise HTTPException(500, "Falha ao gerar o relatório. Tente novamente em instantes.")

    nome_arquivo = f"autoavaliacao-sprint{sprint_num}-{aluno.split()[0].lower()}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{nome_arquivo}"',
            "Cache-Control": "no-store",
        },
    )
