# 2. Getting Started

This document walks a new developer through setting up a local environment
for this project, from an empty machine to running the backend locally
against the real database.

## Tools to install

| Tool | Version | Purpose |
|---|---|---|
| [PyCharm](https://www.jetbrains.com/pycharm/) | Community or Professional | Primary IDE for this project. A JetBrains educational (teacher) license works fine. |
| [Python](https://www.python.org/downloads/) | 3.13.x | Backend runtime. Match the version used in `backend/Dockerfile` so local behaviour matches production. On macOS, install via [Homebrew](https://brew.sh) (`brew install python@3.13`) if you don't already have 3.13. |
| [Git](https://git-scm.com/downloads) | Any recent version | Source control. On macOS, this is usually already present via Xcode Command Line Tools — check with `git --version`. |
| [Google Cloud CLI (`gcloud`)](https://cloud.google.com/sdk/docs/install) | Any recent version | Used to deploy the backend to Cloud Run. On macOS: `brew install --cask google-cloud-sdk`. |
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | Any recent version | Optional but recommended: lets you build and run the exact container that gets deployed, locally, before pushing. |
| A ZIP-capable file tool | — | Windows: the built-in `Expand-Archive` (PowerShell) is sufficient, or 7-Zip if you prefer it. macOS: the built-in `unzip` command works fine. |

Node.js is **not required** for day-to-day work: the frontend is plain
HTML/CSS/JS with no build step. It would only be needed if you wanted to
run the `wrangler` CLI locally instead of relying on Cloudflare's
Git-based auto-deploy (see the [Deployment Guide](./03-deployment-guide.md)).

## Getting the code

**Windows (PowerShell):**
```powershell
git clone https://github.com/ProfessorFilipo/ProfessorFilipo-website.git
cd ProfessorFilipo-website
```

**macOS (Terminal):**
```bash
git clone https://github.com/ProfessorFilipo/ProfessorFilipo-website.git
cd ProfessorFilipo-website
```

(Identical commands — the only difference going forward is the shell syntax for
activating the virtual environment and a couple of file commands, called out
below.)

Alternatively, on either platform, use PyCharm's own **File → New → Project
from Version Control**, pasting the repository URL — this clones the repo
and opens it as a project in one step.

Open the folder in PyCharm as a project.

## Setting up the backend

### Create a virtual environment

From the `backend/` folder:

**Windows (PowerShell):**
```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
```

**macOS (Terminal):**
```bash
cd backend
python3.13 -m venv .venv
source .venv/bin/activate
```

PyCharm can also create and manage this for you: **Settings → Project →
Python Interpreter → Add Interpreter → Virtualenv Environment**, pointing
at the `backend/` folder and Python 3.13. On macOS, if PyCharm defaults to
an unrelated older interpreter (e.g. a system Python 3.9 from another
project), switch it explicitly to the `backend/.venv` you just created:
**Add Interpreter → Add Local Interpreter → Existing**, pointing at
`backend/.venv/bin/python3.13`.

### Install dependencies

With the virtual environment active (same command on both platforms):

```
pip install -r requirements.txt
```

### Configure local environment variables

Copy the example file and fill in real values (ask an existing team
member for the development database connection string and any API keys
you don't already have — see
[Environment Overview](./01-environment-overview.md)):

**Windows (PowerShell):**
```powershell
copy .env.example .env
```

**macOS (Terminal):**
```bash
cp .env.example .env
```

Edit `.env` with a text editor and fill in `DATABASE_URL` at minimum. The
other variables (R2, Turnstile, Resend) have safe empty defaults and are
only needed if you're working on the features that use them. The database
connection string itself doesn't live in this repository (by design — see
[Environment Overview](./01-environment-overview.md)); get it from the
Neon project dashboard directly, on whichever machine you're setting up.

### Run the backend locally

Same command on both platforms:

```
uvicorn app.main:app --reload --port 8080
```

Visit `http://localhost:8080/health` — you should see
`{"status":"ok","database":"reachable"}`. If `database` doesn't say
`reachable`, double-check `DATABASE_URL` in your `.env`.

## Setting up the frontend

No setup is required. The `frontend/` folder is plain static files — open
`frontend/index.html` directly in a browser, or use any simple local
static server, to preview changes. There is no build step and no package
manager involved.

Two things worth knowing:
- The frontend calls the backend's live production URL (see
  `frontend/js/api.js`, `API_BASE_URL`) — so even a locally opened HTML
  file will talk to the real production backend. Be mindful of this when
  testing anything that writes data (like the contact form or the visit
  counter).
- `frontend/wrangler.jsonc` is the only Cloudflare-specific configuration
  file, and it's already correct — you shouldn't need to touch it for
  normal content changes.

## Why we use a virtual environment (`venv`)

If you're new to Python, it's worth understanding *why* this project
insists on a virtual environment rather than installing packages directly
onto your system Python. There are three concrete reasons:

1. **Version isolation.** This project pins specific package versions in
   `requirements.txt` (for example, `fastapi>=0.115,<0.116`). Your
   computer might have other Python projects — including unrelated ones
   for coursework or other work — that need *different, conflicting*
   versions of the same packages. Without a virtual environment, installing
   this project's dependencies system-wide can silently break another
   project (or vice versa), because there is only ever one system-wide
   copy of each package.
2. **Reproducibility.** `requirements.txt` is meant to fully describe what
   the backend needs to run. If everyone develops inside a matching
   virtual environment, "it works on my machine" stops being a mystery —
   the environment is fully defined by one file, not by whatever happens
   to already be installed on a given computer.
3. **Parity with production.** The backend runs inside a Docker container
   in production (see `backend/Dockerfile`), which is itself a form of
   isolated environment containing *only* what `requirements.txt`
   specifies. A local virtual environment mirrors that same principle on
   your own machine: what you test locally is a much closer match to what
   actually runs in Cloud Run, which means fewer "worked locally, broke in
   production" surprises. The `email-validator` incident (a dependency
   that was missing from `requirements.txt` and only surfaced once
   deployed) is a real example of exactly the class of bug a clean,
   isolated environment — checked with a fresh `pip install -r
   requirements.txt` — would have caught before deployment.

In short: the `.venv` folder is not bureaucracy, it's what makes
`requirements.txt` trustworthy. Never install project dependencies with a
system-wide `pip install` outside of an active virtual environment.
