# 4. Onboarding Test: Verifying Your Pipeline End-to-End

The best way to confirm your local environment, your GCP access, and your
understanding of the deployment process are all working correctly is to
ship one small, harmless change all the way to production yourself. This
document walks through exactly that, using a tiny example endpoint that
has no effect on the real site or its data.

This is a good exercise for any new developer's first day on the project.

## What we're building

A new endpoint, `GET /ping`, that returns a JSON object with a fixed
message and the current server time. It reads and writes nothing, calls no
external service, and can't break anything else — it exists purely to
prove that a change you make locally really does reach production.

## Step 1 — Create the endpoint

Create a new file `backend/app/routers/ping.py`:

```python
"""
A minimal example endpoint, used to verify the full deploy pipeline
end-to-end. Safe to leave in place permanently as a lightweight smoke test.
"""
from datetime import datetime, timezone

from fastapi import APIRouter

router = APIRouter(tags=["ping"])


@router.get("/ping")
def ping():
    return {
        "message": "pong",
        "server_time_utc": datetime.now(timezone.utc).isoformat(),
    }
```

## Step 2 — Register the router

In `backend/app/main.py`, add the import and registration alongside the
other routers:

```python
from app.routers import health, pages, counter, contact, ping
```

```python
app.include_router(ping.router)
```

## Step 3 — Test locally

With your virtual environment active:

```powershell
uvicorn app.main:app --reload --port 8080
```

Visit `http://localhost:8080/ping` in a browser, or:

```powershell
curl http://localhost:8080/ping
```

You should see something like:

```json
{"message": "pong", "server_time_utc": "2026-07-27T14:32:01.123456+00:00"}
```

## Step 4 — Commit and push

```powershell
git add backend/app/routers/ping.py backend/app/main.py
git commit -m "Add /ping endpoint as an onboarding smoke test"
git push
```

## Step 5 — Deploy to Cloud Run

```powershell
cd backend
gcloud run deploy filipomor-backend --source . --region southamerica-east1 --allow-unauthenticated --max-instances 3 --env-vars-file env-vars.yaml
```

Wait for the command to report the new revision is serving 100% of
traffic.

## Step 6 — Verify in production

Visit:

```
https://filipomor-backend-1081051154518.southamerica-east1.run.app/ping
```

If you see the same `{"message": "pong", ...}` response, with a current
timestamp, you've just confirmed:

- Your local environment is correctly set up (Python, virtual environment,
  dependencies).
- Your Git access and commit workflow work.
- Your `gcloud` authentication and IAM permissions on the GCP project are
  correctly configured.
- You understand the full path from a code change to a live production
  endpoint.

## What to do with it afterwards

This endpoint is harmless and genuinely useful as a permanent, minimal
health check independent of the database (unlike `/health`, which also
checks database connectivity — `/ping` checks only "is the service up and
responding at all"). There's no need to remove it after onboarding; it's
fine to leave it in place.
