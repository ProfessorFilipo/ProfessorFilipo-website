#!/usr/bin/env python3
"""Static SEO validation for filipomor.com frontend.

No third-party packages required. Exit status is non-zero if a required SEO
invariant fails.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "frontend"
BASE_URL = "https://filipomor.com"

DISCIPLINE_PAGES = {
    "logica.html": "logica",
    "introducao-computacao.html": "introducao-computacao",
    "sistemas-operacionais.html": "sistemas-operacionais",
    "gestao-projetos.html": "gestao-projetos",
    "estruturas-dados.html": "estruturas-dados",
}
API_ALLOWED = {"index.html", "contato.html", "autoavaliacao.html"}
NOINDEX = {"404.html", "autoavaliacao.html"}

errors: list[str] = []


def fail(message: str) -> None:
    errors.append(message)


def expected_canonical(filename: str) -> str:
    path = "/" if filename == "index.html" else "/" + filename.removesuffix(".html")
    return BASE_URL + path


html_files = sorted(FRONTEND.glob("*.html"))
for path in html_files:
    text = path.read_text(encoding="utf-8")
    filename = path.name

    checks = {
        "title": len(re.findall(r"<title>.*?</title>", text, re.S | re.I)),
        "description": len(re.findall(r'<meta\s+name=["\']description["\']', text, re.I)),
        "canonical": len(re.findall(r'<link\s+rel=["\']canonical["\']', text, re.I)),
        "og:url": len(re.findall(r'<meta\s+property=["\']og:url["\']', text, re.I)),
        "json-ld": len(re.findall(r'application/ld\+json', text, re.I)),
    }
    for label, count in checks.items():
        if count != 1:
            fail(f"{filename}: expected exactly one {label}, found {count}")

    canonical = re.search(r'<link\s+rel=["\']canonical["\']\s+href=["\']([^"\']+)', text, re.I)
    if canonical and canonical.group(1) != expected_canonical(filename):
        fail(f"{filename}: canonical is {canonical.group(1)!r}, expected {expected_canonical(filename)!r}")

    if re.search(r'href=["\'][^"\']+\.html(?:[?#][^"\']*)?["\']', text):
        fail(f"{filename}: still contains an internal .html href")

    has_noindex = bool(re.search(r'<meta\s+name=["\']robots["\']\s+content=["\'][^"\']*noindex', text, re.I))
    if filename in NOINDEX and not has_noindex:
        fail(f"{filename}: should be noindex")
    if filename not in NOINDEX and has_noindex:
        fail(f"{filename}: unexpectedly marked noindex")

    if 'class="api-status"' in text:
        fail(f"{filename}: development API status footer still present")
    if 'js/api.js' in text and filename not in API_ALLOWED:
        fail(f"{filename}: loads api.js even though the page does not need the API")

    # JSON-LD must parse.
    m = re.search(r'<script\s+type=["\']application/ld\+json["\']>(.*?)</script>', text, re.S | re.I)
    if m:
        try:
            json.loads(m.group(1))
        except json.JSONDecodeError as exc:
            fail(f"{filename}: invalid JSON-LD: {exc}")

catalog = json.loads((FRONTEND / "data" / "materials.json").read_text(encoding="utf-8"))
for filename, discipline_id in DISCIPLINE_PAGES.items():
    path = FRONTEND / filename
    text = path.read_text(encoding="utf-8")
    if 'data-prerendered="true"' not in text:
        fail(f"{filename}: teaching catalog is not marked pre-rendered")
    if 'js/materials.js?v=2' not in text:
        fail(f"{filename}: materials.js cache-busting version is not v=2")
    discipline = catalog["disciplines"][discipline_id]
    expected = sum(1 for r in discipline.get("permanent_resources", []) if r.get("status") == "published")
    for semester in discipline.get("semesters", []):
        expected += sum(1 for r in semester.get("resources", []) if r.get("status") == "published")
    actual = text.count('class="material-card"')
    if actual != expected:
        fail(f"{filename}: expected {expected} pre-rendered material cards, found {actual}")

materials_js = (FRONTEND / "js" / "materials.js").read_text(encoding="utf-8")
if "fetch(" in materials_js:
    fail("frontend/js/materials.js: runtime catalog fetch still present")

robots = (FRONTEND / "robots.txt").read_text(encoding="utf-8") if (FRONTEND / "robots.txt").exists() else ""
if "Sitemap: https://filipomor.com/sitemap.xml" not in robots:
    fail("robots.txt: sitemap declaration missing")

sitemap = (FRONTEND / "sitemap.xml").read_text(encoding="utf-8") if (FRONTEND / "sitemap.xml").exists() else ""
if "/autoavaliacao</loc>" in sitemap or "/404</loc>" in sitemap:
    fail("sitemap.xml: noindex utility/error page included")
for filename in DISCIPLINE_PAGES:
    if expected_canonical(filename) not in sitemap:
        fail(f"sitemap.xml: missing {expected_canonical(filename)}")

if errors:
    print("SEO validation FAILED:\n")
    for err in errors:
        print(f"- {err}")
    sys.exit(1)

print("SEO validation OK")
print(f"- {len(html_files)} HTML files checked")
print("- canonical, Open Graph and JSON-LD metadata valid")
print("- internal .html links normalized")
print("- teaching materials pre-rendered")
print("- runtime materials.json fetch removed")
print("- robots.txt and sitemap.xml present")
