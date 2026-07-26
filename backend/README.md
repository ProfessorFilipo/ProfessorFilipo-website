# /backend

FastAPI application, hosted on GCP Cloud Run (Docker).

- `app/main.py` — application entry point
- `app/models/` — data models (SQLAlchemy), one per table
- `app/routers/` — API routes, grouped by resource (pages, blog, tools, etc.)
- `app/core/` — configuration, database connection, R2 connection
- `.env.example` — environment variable template (copy to `.env`, never commit `.env`)
- 