# ProfessorFilipo-website

[![Python](https://img.shields.io/badge/Python-3.13-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-4169E1?logo=postgresql&logoColor=white)](https://neon.tech/)
[![Cloudflare](https://img.shields.io/badge/Cloudflare-Pages%20%2B%20R2-F38020?logo=cloudflare&logoColor=white)](https://www.cloudflare.com/)

A dynamic, bilingual personal academic website — research in Generative AI
and Digital Twins, teaching at PUCRS and Unilasalle.

## Stack

- **Frontend**: static site on Cloudflare Pages
- **Backend**: FastAPI (Python), Dockerized, hosted on GCP Cloud Run
- **Database**: managed Postgres (Neon, free tier, scale-to-zero)
- **File storage**: Cloudflare R2
- **DNS/security**: Cloudflare (proxy, Turnstile, rate limiting)

## Structure

frontend/ site estático (Cloudflare Pages)<br>
backend/ API FastAPI (GCP Cloud Run)<br>
database/ schema.sql (Postgres/Neon)<br>
scripts/ developer tooling (e.g. applying a batch of file updates)<br>
docs/ full project documentation (see below)

## Documentation

Full setup, deployment, and integration documentation lives in
[`docs/`](./docs/README.md), including:

- An inventory of every external service this project depends on
- Local environment setup, from scratch
- The exact step-by-step deployment process
- A safe onboarding exercise for a new developer's first deployment
- How local tooling connects to Cloudflare R2, Resend, and Neon

## Local setup

1. Copy `backend/.env.example` to `backend/.env` and fill in the real
   credentials (Neon, R2).
2. Run `database/schema.sql` against your Neon project (via the Neon
   console's SQL Editor, or any Postgres client).
3. Install the backend dependencies and run it locally before deploying.

See [`docs/02-getting-started.md`](./docs/02-getting-started.md) for the
full, detailed version of this process.

## Deployment

- **Frontend**: push to the repository -> Cloudflare Pages builds and
  publishes automatically (Git integration).
- **Backend**: deployed to Cloud Run via `gcloud run deploy` or the PyCharm
  Cloud Code plugin — with `--max-instances` set as a safeguard against
  unexpected cost.

See [`docs/03-deployment-guide.md`](./docs/03-deployment-guide.md) for the
full, detailed version of this process.

## Security

- `.env` is never committed (already protected by `.gitignore`).
- Cloud Run is configured with a maximum instance limit.
- Cloudflare Turnstile + rate limiting sit in front of the backend.

## License

Code is licensed under [MIT](./LICENSE). Personal content and media (bio,
photos, course materials) are licensed under
[CC BY-NC-ND 4.0](./LICENSE-CONTENT.md).
