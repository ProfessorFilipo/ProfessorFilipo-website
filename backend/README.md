# /backend

FastAPI application, hosted on GCP Cloud Run (Docker).

## Structure

- `app/main.py` — application entry point, CORS setup, router registration
- `app/models/` — SQLAlchemy models, one file per table
- `app/routers/` — API routes, grouped by resource (health, pages, ...)
- `app/core/config.py` — environment-based settings (pydantic-settings)
- `app/core/database.py` — SQLAlchemy engine/session, `get_db` dependency
- `app/core/storage.py` — Cloudflare R2 client (S3-compatible)
- `.env.example` — environment variable template (copy to `.env`, never commit `.env`)
- `Dockerfile` — used both for local testing and for the Cloud Run deployment

## Running locally

```bash
# From the backend/ folder, with the virtual environment activated:
pip install -r requirements.txt
cp .env.example .env   # then fill in real values
uvicorn app.main:app --reload
```

Visit `http://localhost:8000/health` to confirm the API and database connection
are both working, and `http://localhost:8000/docs` for the interactive API
documentation that FastAPI generates automatically.

## Running with Docker (matches production)

```bash
docker build -t filipomor-backend .
docker run -p 8080:8080 --env-file .env filipomor-backend
```
