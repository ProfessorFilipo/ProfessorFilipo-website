# Cloudflare Worker name alignment

The Cloudflare Worker is named `professorfilipowebsite` in the dashboard. The Wrangler configuration must use the same name so Git-based Workers Builds can deploy to the connected Worker consistently.

This update changes only `frontend/wrangler.jsonc`:

- before: `professorfilipo-website`
- after: `professorfilipowebsite`

No backend, database, DNS, or application code is changed.
