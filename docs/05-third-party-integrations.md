# 5. Third-Party Integrations

This document covers how your local tools (PyCharm, Git) connect to the
external services the project depends on.

## PyCharm ↔ Git

PyCharm has built-in Git support; no separate integration is needed beyond
having Git itself installed. Confirm PyCharm can see it: **Settings → 
Version Control → Git → Path to Git executable** should auto-detect your
Git installation. If you'd like PyCharm's GitHub-specific features
(creating pull requests from the IDE, viewing issues), add your GitHub
account under **Settings → Version Control → GitHub**.

## PyCharm ↔ Neon (PostgreSQL)

PyCharm Professional includes a built-in database client (the **Database**
tool window) that can connect directly to the Neon database — useful for
browsing tables or running ad-hoc queries without leaving the IDE.

1. Open the **Database** tool window (**View → Tool Windows → Database**).
2. Click **+ → Data Source → PostgreSQL**.
3. Enter the connection details from your Neon connection string (host,
   port, database name, user, password) — **or** paste the full connection
   string directly if PyCharm's dialog offers a URL field.
4. Make sure **SSL mode** is set to `require` (Neon requires SSL
   connections).
5. Test the connection before saving.

### Important: keep connection details out of Git

PyCharm stores data source configuration (including, depending on your
settings, saved passwords) in a file called `dataSources.xml` inside the
project's `.idea/` folder. **This must never be committed.** This isn't
a hypothetical risk — an earlier version of this project's repository
accidentally committed a `dataSources.xml` that exposed a database host
and username in its very first commit. Confirm `.idea/` is listed in
`.gitignore` (it already is in this repository) before connecting PyCharm
to any real database, and double-check with `git status` that nothing
under `.idea/` shows up as a new or modified file before you commit.

## R2 (Cloudflare object storage)

The backend talks to R2 programmatically through `boto3` (the same client
library used for AWS S3, since R2 is S3-compatible) — see
`backend/app/core/storage.py`. There's no PyCharm-specific integration for
this; it's configured entirely through environment variables
(`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
`R2_BUCKET_NAME`, `R2_ENDPOINT_URL`).

If you need to browse or manage files in the bucket **outside of code**
(for example, to manually check what's been uploaded), any S3-compatible
GUI client works, since R2 speaks the S3 API. Two common options:
- [Cyberduck](https://cyberduck.io/) (free, GUI, supports S3-compatible
  endpoints directly)
- The [AWS CLI](https://aws.amazon.com/cli/), configured to point at R2's
  endpoint URL instead of AWS's — useful if you're already comfortable
  with `aws s3 ls`, `aws s3 cp`, etc.

Either way, you'll need the same R2 credentials referenced above (ask an
existing team member, or generate your own R2 API token from the
Cloudflare dashboard if you have account access).

## Cloudflare Turnstile (captcha)

No local tooling integration — this is configured through two things:
- The **Site Key**, hardcoded in `frontend/contato.html` (safe to be
  public).
- The **Secret Key**, an environment variable on the backend
  (`TURNSTILE_SECRET_KEY`), used server-side to verify each submission.

If you need to inspect widget behaviour or generate a new
key pair, that happens in the Cloudflare dashboard directly
(**Turnstile** in the sidebar), not through any local tool.

## Resend (email)

No local tooling integration either. Two things worth knowing as a
developer:
- The **API key** is an environment variable on the backend
  (`RESEND_API_KEY`).
- If you need to debug why an email didn't arrive, the Resend dashboard's
  **Logs** section shows every send attempt, its status, and any error
  Resend itself returned — this is often faster than digging through
  Cloud Run logs, since Cloud Run only tells you *that* Resend rejected a
  request (via this project's own error logging in `contact.py`), not
  necessarily every detail Resend's own dashboard shows about the attempt.

## General principle

None of these integrations involve storing a real secret inside the Git
repository, PyCharm's project files, or anywhere else that gets committed.
Every credential is either an environment variable (`.env` locally,
`env-vars.yaml` in production) or entered directly into a tool's own
credential store (like PyCharm's data source dialog) with Git explicitly
configured to ignore the file that would otherwise expose it.
