# SEO architecture — static frontend

This update makes the static frontend easier for search engines and social crawlers to understand without changing the site's visual identity or backend architecture.

## What changed

1. **Teaching materials are pre-rendered.** `frontend/data/materials.json` remains the source of truth, but `scripts/generate-seo.py` writes every published material card directly into the discipline HTML. Search engines therefore receive titles, descriptions and PDF links in the initial HTML response instead of depending on client-side rendering.
2. **`robots.txt` and `sitemap.xml` are generated.** The sitemap uses the extensionless canonical URLs served by Cloudflare.
3. **Internal links use canonical URLs.** Links such as `logica.html` become `/logica`; `index.html` becomes `/`.
4. **Every HTML page has an absolute canonical URL.** This consolidates `.html` and extensionless variants.
5. **High-value pages have richer titles and meta descriptions.** Teaching pages and interactive tools include the subjects a student or researcher is likely to search for.
6. **Structured data is embedded as JSON-LD.** Pages expose `WebSite`, `Person`, `WebPage` and, when applicable, `BreadcrumbList` entities.
7. **Open Graph and Twitter metadata are present.** Shared links have explicit title, description, URL and image metadata.
8. **The development API-status footer was removed.** `js/api.js` is retained only on pages whose real functionality requires the API (`index`, `contato`, `autoavaliacao`).
9. **The teaching catalog no longer needs a browser-time JSON fetch.** `materials.js` now performs progressive enhancement only (semester tabs and filters). This removes a network dependency from initial teaching-page rendering.

## Updating teaching material in the future

Edit `frontend/data/materials.json` and add the corresponding files, then run:

```bash
python3 scripts/generate-seo.py
python3 scripts/validate-seo.py
```

The generator is idempotent and updates only explicitly generated SEO/material blocks plus canonical internal links. The JSON catalog remains the single source of truth.

## Validation before a commit

```bash
python3 scripts/validate-seo.py
git diff --check
git status --short
```

For a local HTTP smoke test:

```bash
python3 -m http.server 8000 --directory frontend
```

Then verify at least `/`, `/ensino`, `/logica`, `/estruturas-dados`, `/sitemap.xml` and `/robots.txt`.

## Search engine operations after deployment

After production validation, submit `https://filipomor.com/sitemap.xml` in Google Search Console. New or substantially changed high-value pages can also be requested for indexing there. Search reprocessing is asynchronous and can take time even when deployment is correct.

## Scope

This is a frontend-only change. It does not require changes or deployment to FastAPI, Cloud Run, Neon or the database.
