# 1. Environment Overview

This document is a complete inventory of every external service the
project depends on: what each one does, what you need access to, and where
its credentials live. Read this before requesting access to anything.

## Summary table

| Service | Purpose | Access needed | Where credentials live |
|---|---|---|---|
| GitHub | Source control, CI trigger for the frontend | Collaborator access to the repo | Your own GitHub account/SSH key |
| Cloudflare | DNS, frontend hosting (Workers), media storage (R2), captcha (Turnstile) | Member access to the Cloudflare account | Cloudflare dashboard login |
| Google Cloud Platform (GCP) | Backend hosting (Cloud Run), container builds (Cloud Build) | IAM role on the `filipomor-website` project | `gcloud` CLI login (your Google account) |
| Neon | Managed PostgreSQL database | Project member access | Connection string in `backend/.env` (local) or `env-vars.yaml` (production) |
| Resend | Transactional email (contact form) | Team member access | API key in `env-vars.yaml` |

The sections below go through each service in detail.

## GitHub

- **Repository**: `ProfessorFilipo/ProfessorFilipo-website`
- **What it's for**: the single source of truth for all code (frontend,
  backend, database schema, scripts, docs). Pushing to `main` is also what
  triggers the frontend's automatic deployment (see Cloudflare, below).
- **What you need**: to be added as a collaborator on the repository (or an
  organization member, depending on how access is structured), plus your
  own Git identity configured locally (see
  [Getting Started](./02-getting-started.md)).
- **Nothing secret lives in this repository.** `.gitignore` excludes
  `backend/.env` and `backend/env-vars.yaml` specifically so that database
  passwords, API keys, and other secrets are never committed. If you ever
  see a real secret in a diff you're about to commit, stop and remove it
  before pushing — treat any credential that ends up in Git history as
  compromised and rotate it.

## Cloudflare

One Cloudflare account is used for four distinct things. You'll need
access to the account itself (not just the DNS zone) to work with most of
these.

### DNS

- **Zone**: `filipomor.com`
- Nameservers point to Cloudflare; all DNS records (mail, subdomains, the
  site itself) are managed here.
- You generally won't need to touch DNS records for day-to-day development
  — this is mostly a "set once" concern, already configured.

### Workers & Pages (frontend hosting)

- **Project name**: `professorfilipowebsite`
- The `frontend/` folder is deployed here as static assets, using
  Cloudflare's Git integration: **every push to `main` triggers an
  automatic build and deploy** — there is no manual deploy step for the
  frontend.
- Live at `https://filipomor.com` (primary) and
  `https://professorfilipowebsite.professorfilipo.workers.dev` (the
  default Workers subdomain, still active alongside the custom domain).
- Configuration lives in `frontend/wrangler.jsonc` in the repository — this
  is the only frontend config that matters; there is no dashboard-only
  configuration you'd need to reproduce elsewhere.

### R2 (media storage)

- **Bucket name**: `filipomor-site-media`
- S3-compatible object storage, used by the backend for storing uploaded
  media (via the `boto3` S3 client — see `backend/app/core/storage.py`).
- Public access is disabled on the bucket; the backend accesses it using
  an R2 API token (Account ID, Access Key ID, Secret Access Key), stored
  as environment variables (see the table in
  [Getting Started](./02-getting-started.md#environment-files)).

### Turnstile (captcha)

- Used to protect the contact form from automated abuse.
- A **Site Key** (public, safe to embed in frontend HTML) and a **Secret
  Key** (private, backend-only) are generated per widget from the
  Cloudflare dashboard.
- The Site Key is hardcoded directly in `frontend/contato.html`. The
  Secret Key is an environment variable
  (`TURNSTILE_SECRET_KEY`) on the backend — never commit it.

## Google Cloud Platform (GCP)

- **Project**: `filipomor-website`
- **Service**: `filipomor-backend` (Cloud Run), region `southamerica-east1`
  (São Paulo)
- **What it's for**: hosts the FastAPI backend as a container. Deploys are
  triggered manually (not automatically on push — see the
  [Deployment Guide](./03-deployment-guide.md)), using Cloud Build under
  the hood to build the container image from source.
- **Cost safeguard**: the service is capped at `--max-instances 3`, a
  deliberate ceiling so a traffic spike or bug can't spiral into an
  unbounded cloud bill.
- **What you need**: a Google account added to the GCP project with a role
  that permits deploying Cloud Run services (at minimum, the *Cloud Run
  Admin* and *Cloud Build Editor* roles, or equivalent), and the `gcloud`
  CLI installed and authenticated locally.

## Neon (PostgreSQL)

- **Region**: AWS `sa-east-1` (São Paulo)
- **What it's for**: the application's only database. Schema lives in
  `database/schema.sql` in the repository (12 tables: `admin_users`,
  `media`, `pages`, `research_projects`, `experience`, `courses`, `tools`,
  `blog_posts`, `tags`, `blog_post_tags`, `post_attachments`, `settings`).
- **What you need**: to be added as a member of the Neon project, and a
  connection string (given to you by Neon once you have access, or shared
  securely by an existing team member — never via Git, chat logs, or
  anything that gets indexed/logged permanently).

## Resend (transactional email)

- **What it's for**: sends the email generated by the contact form, from
  `contato@filipomor.com` to the site owner's inbox.
- **Domain verification**: `filipomor.com` is a verified sending domain on
  Resend (DKIM/SPF records live in the Cloudflare DNS zone). You should not
  need to re-verify this unless the domain is removed from the Resend
  account.
- **What you need**: team member access to the Resend account (to see
  delivery logs or rotate the API key) — most day-to-day development
  doesn't require touching this at all, since the API key is already
  configured in production.

## A note on secrets in general

None of the credentials above should ever be:
- Committed to Git (check `.gitignore` covers them before adding new
  secret-bearing files),
- Pasted into chat tools, issue trackers, or anywhere with a permanent,
  searchable history,
- Shared over channels without confirming the recipient is who you think
  they are.

If a secret is ever accidentally exposed (committed, pasted somewhere
public, shown in a screenshot), the correct response is to **rotate it**
(generate a new one and update `env-vars.yaml` / `.env`), not just delete
the exposed copy — assume anything that was exposed has been seen.
