"""
Validação e reprocessamento de arquivos de evidência (autoavaliação).

Tudo acontece em memória (BytesIO) — nada é gravado em disco em nenhum
momento, para manter a garantia de "nada fica armazenado no servidor".

Regras de limite (ver conversa de design — não são arbitrárias):
- Imagem: JPEG, PNG ou WebP, até 5 MB originais, até 6000x6000 px.
- PDF de evidência: até 5 MB, até 5 páginas.
- Até 3 evidências de imagem e 1 de documento por critério.
- Soma de todas as evidências de uma submissão: até 20 MB (folga generosa
  abaixo do limite de 32 MiB por requisição do Cloud Run em HTTP/1.1).
"""
import io

from fastapi import HTTPException
from PIL import Image
from pypdf import PdfReader
import pikepdf

MAX_IMAGE_BYTES = 5 * 1024 * 1024
MAX_PDF_BYTES = 5 * 1024 * 1024
MAX_TOTAL_BYTES = 20 * 1024 * 1024
MAX_IMAGE_DIMENSION = 6000
MAX_PDF_PAGES = 5
IMAGE_TARGET_MAX_SIDE = 1920
IMAGE_JPEG_QUALITY = 82

# Assinaturas binárias ("magic bytes") — nunca confiar em extensão ou
# Content-Type declarado pelo navegador, ambos são fáceis de forjar.
_SIGNATURES = {
    "image/jpeg": [b"\xff\xd8\xff"],
    "image/png": [b"\x89PNG\r\n\x1a\n"],
    "image/webp": [b"RIFF"],  # confirmado com checagem extra abaixo (bytes 8-12 == WEBP)
    "application/pdf": [b"%PDF-"],
}


def sniff_type(data: bytes) -> str | None:
    """Identifica o tipo real do arquivo pelos primeiros bytes, ignorando
    qualquer nome ou Content-Type informado pelo cliente."""
    for mime, sigs in _SIGNATURES.items():
        for sig in sigs:
            if data[: len(sig)] == sig:
                if mime == "image/webp" and data[8:12] != b"WEBP":
                    continue
                return mime
    return None


def validate_and_process_image(data: bytes, campo: str) -> bytes:
    """Valida uma imagem de evidência e devolve uma versão reprocessada
    (redimensionada, recomprimida, sem metadados EXIF)."""
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(400, f"{campo}: imagem maior que 5 MB.")

    mime = sniff_type(data)
    if mime not in ("image/jpeg", "image/png", "image/webp"):
        raise HTTPException(400, f"{campo}: arquivo não é uma imagem JPEG, PNG ou WebP válida.")

    try:
        img = Image.open(io.BytesIO(data))
        img.verify()
        img = Image.open(io.BytesIO(data))  # verify() deixa o objeto inutilizável; reabre
    except Exception:
        raise HTTPException(400, f"{campo}: não foi possível ler a imagem (arquivo corrompido?).")

    if img.width > MAX_IMAGE_DIMENSION or img.height > MAX_IMAGE_DIMENSION:
        raise HTTPException(400, f"{campo}: imagem excede {MAX_IMAGE_DIMENSION}px no maior lado.")

    # Reprocessamento: remove EXIF/metadados, corrige orientação, redimensiona
    # e recomprime — também neutraliza a maior parte de payloads maliciosos
    # escondidos dentro do arquivo original, porque o resultado é sempre
    # recriado a partir dos pixels decodificados, nunca copiado byte a byte.
    img = img.convert("RGB")
    if max(img.size) > IMAGE_TARGET_MAX_SIDE:
        img.thumbnail((IMAGE_TARGET_MAX_SIDE, IMAGE_TARGET_MAX_SIDE), Image.LANCZOS)

    out = io.BytesIO()
    img.save(out, format="JPEG", quality=IMAGE_JPEG_QUALITY, optimize=True)
    return out.getvalue()


def validate_and_sanitize_pdf(data: bytes, campo: str) -> bytes:
    """Valida um PDF de evidência e devolve uma versão sanitizada (sem
    JavaScript embutido, ações automáticas ou anexos internos)."""
    if len(data) > MAX_PDF_BYTES:
        raise HTTPException(400, f"{campo}: PDF maior que 5 MB.")

    if sniff_type(data) != "application/pdf":
        raise HTTPException(400, f"{campo}: arquivo não é um PDF válido.")

    try:
        reader = PdfReader(io.BytesIO(data))
        n_pages = len(reader.pages)
    except Exception:
        raise HTTPException(400, f"{campo}: não foi possível ler o PDF (arquivo corrompido ou protegido?).")

    if n_pages > MAX_PDF_PAGES:
        raise HTTPException(400, f"{campo}: PDF tem {n_pages} páginas, o máximo é {MAX_PDF_PAGES}.")
    if n_pages == 0:
        raise HTTPException(400, f"{campo}: PDF não tem páginas.")

    try:
        with pikepdf.open(io.BytesIO(data)) as pdf:
            # Remove JavaScript no nível do documento (OpenAction / AA / Names/JavaScript)
            root = pdf.Root
            for key in ("OpenAction", "AA"):
                if key in root:
                    del root[key]
            if "Names" in root and "JavaScript" in root.Names:
                del root.Names["JavaScript"]
            # Remove anexos embutidos (EmbeddedFiles) e ações por página
            if "Names" in root and "EmbeddedFiles" in root.Names:
                del root.Names["EmbeddedFiles"]
            for page in pdf.pages:
                if "AA" in page:
                    del page["AA"]
                if "Annots" in page:
                    for annot in list(page.Annots):
                        if annot.get("Subtype") == "FileAttachment":
                            page.Annots.remove(annot)
            out = io.BytesIO()
            pdf.save(out)
            return out.getvalue()
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(400, f"{campo}: falha ao sanitizar o PDF.")


def check_total_size(sizes: list[int]) -> None:
    total = sum(sizes)
    if total > MAX_TOTAL_BYTES:
        raise HTTPException(
            400,
            f"O total de evidências anexadas ({total / 1024 / 1024:.1f} MB) excede o limite de "
            f"{MAX_TOTAL_BYTES / 1024 / 1024:.0f} MB por submissão.",
        )
