# ProfessorFilipo-website — Documentation

This folder documents everything a developer needs to work on this project:
where things live, how to set up a local environment, how to ship a change
to production, and how the third-party services fit together.

## Contents

1. [Environment Overview](./01-environment-overview.md) — every external
   service this project depends on, what it's used for, and what access you
   need to it.
2. [Getting Started](./02-getting-started.md) — setting up your local
   development environment from scratch: tools, versions, and why we use a
   virtual environment.
3. [Deployment Guide](./03-deployment-guide.md) — the exact, step-by-step
   process for shipping a change to production (frontend and backend).
4. [Onboarding Test](./04-onboarding-test.md) — a small, safe exercise that
   exercises the full pipeline end-to-end, meant for a new developer's first
   deployment.
5. [Third-Party Integrations](./05-third-party-integrations.md) — how
   PyCharm, Git, and the local toolchain connect to Cloudflare R2, Resend,
   Cloudflare Turnstile, and Neon.

## Project at a glance

- **Frontend**: static HTML/CSS/JS, deployed to Cloudflare Workers (static
  assets), auto-deployed on every push to `main`.
- **Backend**: Python/FastAPI, containerized, deployed to Google Cloud Run,
  deployed manually via the `gcloud` CLI.
- **Database**: PostgreSQL, hosted on Neon.
- **Media storage**: Cloudflare R2 (S3-compatible object storage).
- **Domain**: `filipomor.com`, DNS managed on Cloudflare.
- **Repository**: [ProfessorFilipo/ProfessorFilipo-website](https://github.com/ProfessorFilipo/ProfessorFilipo-website)
  on GitHub.

If you're new to the project, read the documents in this folder in order —
each one assumes you've read the ones before it.
