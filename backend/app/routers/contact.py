"""
Contact form endpoint. Verifies a Cloudflare Turnstile token server-side
(client-side verification alone can be bypassed by any script), then sends
an email via Resend.

Every failure path prints full detail to stderr with flush=True — this is
deliberately simple/blunt rather than routed through the `logging` module,
so it is guaranteed to show up in Cloud Run logs regardless of any logger
configuration quirk.
"""
import sys
import traceback

import httpx
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, EmailStr, Field

from app.core.config import settings
from app.core.limiter import limiter

router = APIRouter(prefix="/contact", tags=["contact"])

TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"
RESEND_API_URL = "https://api.resend.com/emails"


class ContactMessage(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    email: EmailStr
    message: str = Field(min_length=1, max_length=5000)
    turnstile_token: str


def log_error(label: str, detail: str) -> None:
    print(f"CONTACT FORM ERROR [{label}]: {detail}", file=sys.stderr, flush=True)


async def verify_turnstile(token: str, remote_ip: str) -> bool:
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(
                TURNSTILE_VERIFY_URL,
                data={
                    "secret": settings.turnstile_secret_key,
                    "response": token,
                    "remoteip": remote_ip,
                },
            )
            result = response.json()
            if not result.get("success", False):
                log_error("turnstile", f"verification failed, response body={result}")
            return result.get("success", False)
    except Exception:
        log_error("turnstile", traceback.format_exc())
        raise HTTPException(status_code=502, detail="Falha ao verificar o captcha (Turnstile).")


async def send_contact_email(payload: ContactMessage) -> None:
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(
                RESEND_API_URL,
                headers={"Authorization": f"Bearer {settings.resend_api_key}"},
                json={
                    "from": settings.contact_email_from,
                    "to": [settings.contact_email_to],
                    "reply_to": payload.email,
                    "subject": f"[filipomor.com] Nova mensagem de {payload.name}",
                    "text": f"De: {payload.name} <{payload.email}>\n\n{payload.message}",
                },
            )
            if response.status_code >= 400:
                log_error("resend", f"status={response.status_code} body={response.text}")
                raise HTTPException(status_code=502, detail="Falha ao enviar o e-mail (Resend).")
    except HTTPException:
        raise
    except Exception:
        log_error("resend", traceback.format_exc())
        raise HTTPException(status_code=502, detail="Falha ao enviar o e-mail (Resend).")


@router.post("/send")
@limiter.limit("3/minute")
async def send_message(request: Request, payload: ContactMessage):
    client_ip = request.headers.get("X-Forwarded-For", "").split(",")[0].strip() or (
        request.client.host if request.client else "unknown"
    )

    is_human = await verify_turnstile(payload.turnstile_token, client_ip)
    if not is_human:
        raise HTTPException(status_code=400, detail="Falha na verificação do captcha.")

    await send_contact_email(payload)
    return {"status": "sent"}
