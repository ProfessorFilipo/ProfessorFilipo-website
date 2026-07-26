"""
Server-side rate limiting (protects against scripted abuse, independent of
anything the browser does — this cannot be bypassed by skipping the frontend
and calling the API directly).
"""
from fastapi import Request
from slowapi import Limiter


def get_client_ip(request: Request) -> str:
    """
    Cloud Run sits behind Google's own load balancer, so the real client IP
    arrives via the X-Forwarded-For header, not request.client.host directly.
    Falls back to request.client.host for local development.
    """
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


limiter = Limiter(key_func=get_client_ip)
