"""
Contact form endpoint. Verifies a Cloudflare Turnstile token server-side
(client-side verification alone can be bypassed by any script), then sends
an email via Resend.
"""
import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
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


async def verify_turnstile(token: str, remote_ip: str) -> bool:
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
        return result.get("success", False)


async def send_contact_email(payload: ContactMessage) -> None:
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
            raise HTTPException(status_code=502, detail="Falha ao enviar o e-mail.")


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
