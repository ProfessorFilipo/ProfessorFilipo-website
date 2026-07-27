"""
FastAPI application entry point.

Run locally with:
    uvicorn app.main:app --reload

The Dockerfile runs this same app in production, on Cloud Run.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler

from app.core.config import settings
from app.core.limiter import limiter
from app.routers import health, pages, counter, contact

app = FastAPI(
    title="filipomor.com API",
    description="Backend API for the personal academic website.",
    version="0.1.0",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS: allows the Cloudflare Pages frontend (a different origin) to call this API.
# Allowed origins are configured via CORS_ALLOWED_ORIGINS in the environment.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(pages.router)
app.include_router(counter.router)
app.include_router(contact.router)


@app.get("/")
def root():
    return {"message": "filipomor.com API is running"}
