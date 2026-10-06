# Permanent redirects for legacy `.html` URLs

The public site uses extensionless canonical URLs such as `/logica`, while Cloudflare Workers Static Assets automatically recognizes the corresponding HTML asset (`logica.html`).

Cloudflare's built-in HTML canonicalization may answer direct requests to legacy `.html` URLs with a temporary redirect. To make the migration signal explicit for search engines, `frontend/_redirects` defines permanent HTTP 301 redirects from every public root-level `.html` URL to its extensionless canonical URL.

Examples:

```text
/logica.html             -> /logica             301
/estruturas-dados.html   -> /estruturas-dados   301
/index.html              -> /                   301
```

The `404.html` error document is intentionally excluded.

## Validation after deployment

```bash
BASE="https://filipomor.com"

curl -sI "$BASE/logica.html" | grep -Ei 'HTTP/|location:'
curl -sI "$BASE/index.html"  | grep -Ei 'HTTP/|location:'
```

Expected:

```text
HTTP/2 301
location: /logica
```

and for the home page:

```text
HTTP/2 301
location: /
```

The canonical extensionless URLs themselves must continue to return HTTP 200.
