# 3. Deployment Guide

This document is the step-by-step process for shipping a change to
production. The frontend and backend deploy differently — read both
sections even if you're only touching one of them, so you understand the
full picture.

## Overview

| | Frontend | Backend |
|---|---|---|
| Hosting | Cloudflare Workers (static assets) | Google Cloud Run |
| Trigger | Automatic, on every push to `main` | Manual, via `gcloud` CLI |
| Typical time to go live | Under a minute | 1–3 minutes |
| Rollback | Redeploy a previous commit | Cloud Run keeps prior revisions; traffic can be re-pointed |

## Frontend deployment

There is no separate "deploy" step. Cloudflare's Git integration watches
the repository, and **any push to `main` that touches files under
`frontend/` is automatically built and deployed**.

1. Make your changes inside `frontend/`.
2. Commit and push:
   ```powershell
   git add -A
   git commit -m "Describe your change"
   git push
   ```
3. Within roughly a minute, the change is live at both
   `https://filipomor.com` and
   `https://professorfilipowebsite.professorfilipo.workers.dev`.
4. You can watch the build progress, or check history, from the Cloudflare
   dashboard: **Workers & Pages → professorfilipowebsite → Deployments**.

### A note on caching

Browsers (and Cloudflare's own edge) cache static assets like CSS and JS
files. If you change `frontend/css/main.css` and the change doesn't seem
to appear after deploying, it is very likely a caching issue, not a
deployment failure. This project's convention is to bump the version
query string on the stylesheet link whenever `main.css` changes:

```html
<link rel="stylesheet" href="css/main.css?v=5">
```

Increment the number every time you change `main.css`, across every HTML
file that references it. This forces browsers to treat it as a new file
rather than serving a stale cached copy.

## Backend deployment

The backend deploys manually, from the `backend/` folder, using the
`gcloud` CLI. This is deliberate: backend changes touch the database and
external services, so a human deliberately triggers each deploy rather
than it happening automatically on every push.

### Step by step

1. Make your changes inside `backend/`.
2. **Test locally first** (see [Getting Started](./02-getting-started.md))
   — run `uvicorn app.main:app --reload --port 8080` and confirm the
   change works, including checking `/health` still reports `reachable`.
3. Commit and push, so the change is in version control before it goes
   live:
   ```powershell
   git add -A
   git commit -m "Describe your change"
   git push
   ```
4. Deploy to Cloud Run:
   ```powershell
   cd backend
   gcloud run deploy filipomor-backend --source . --region southamerica-east1 --allow-unauthenticated --max-instances 3 --env-vars-file env-vars.yaml
   ```
5. Watch the command's output. A successful deploy ends with:
   ```
   Service [filipomor-backend] revision [filipomor-backend-XXXXX-xxx] has been deployed and is serving 100 percent of traffic.
   ```
6. Confirm the live service is healthy:
   ```
   https://filipomor-backend-1081051154518.southamerica-east1.run.app/health
   ```

### If you only changed environment variables (not code)

If the only change is to `env-vars.yaml` (for example, adding a new API
key) and no Python code changed, you can skip rebuilding the container
entirely and just update the running service's configuration — this is
faster:

```powershell
cd backend
gcloud run services update filipomor-backend --region southamerica-east1 --env-vars-file env-vars.yaml
```

Use the full `gcloud run deploy --source .` command whenever *any* code
changed, since that's what triggers a rebuild of the container image.

### Diagnosing a failed deploy

If `gcloud run deploy` reports a failure (commonly: *"The user-provided
container failed to start and listen on the port..."*), the container
built, but crashed on startup. This is almost always a Python-level
problem (an import error, a missing dependency, a bad environment
variable), not a Cloud Run misconfiguration. To find the real cause:

1. Go to [Google Cloud Console → Cloud Run](https://console.cloud.google.com/run)
   → `filipomor-backend`.
2. Click **Observability → Logs** (labelled "Registros" if your console
   is in Portuguese).
3. Look at the entries around the failed deploy's timestamp — the actual
   Python traceback is usually right there.

For runtime errors (the service is up, but a specific request fails),
the same Logs screen is the first place to check. Search for text your
own code prints — this project's convention (see `contact.py` as an
example) is to `print(..., file=sys.stderr, flush=True)` on any caught
exception, specifically so it reliably shows up here regardless of how
Python's `logging` module happens to be configured.

## Applying a bundle of file changes with `apply-update`

When receiving a set of files to update all at once, a helper script is
available to avoid manually copying files into place one by one. Two
equivalent versions exist in `scripts/`: `apply-update.ps1` for Windows
(PowerShell) and `apply-update.sh` for macOS/Linux (bash) — same behaviour,
platform-appropriate syntax.

**Windows (PowerShell):**
```powershell
.\scripts\apply-update.ps1 -ZipPath "path\to\the\update.zip"
```

**macOS/Linux (bash):**
```bash
./scripts/apply-update.sh path/to/the/update.zip
```
(If this is your first time running it on a given clone, make it
executable once: `chmod +x scripts/apply-update.sh`.)

Both scripts expect the ZIP's internal paths to already match the
repository's real folder structure (for example,
`frontend/css/main.css`, `backend/app/main.py`) — they extract directly
into the repository root, overwriting existing files, and then print
`git status` so you can review exactly what changed before committing.
Neither script commits or pushes on your behalf — that remains a
deliberate, separate step:

```
git add -A
git commit -m "Describe your change"
git push
```

Follow with the backend deploy step above if the change touched
`backend/`.
