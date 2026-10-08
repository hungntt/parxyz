#!/usr/bin/env python3
"""Render data/publications.json into publications.html and the featured list in index.html.

Usage (from the repository root):
    python3 scripts/build_publications.py

Edit data/publications.json to add or change papers, then re-run this script and commit
the updated HTML. Content is written between the <!-- PUBS:START/END --> and
<!-- FEATURED:START/END --> markers; everything else in the pages is left untouched.
"""
import html
import json
import re
from collections import OrderedDict
from pathlib import Path
from urllib.parse import quote_plus

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "publications.json"

# Author-name variants that refer to the founder; these are shown in bold.
FOUNDER_NAMES = {"HTT Nguyen", "TTH Nguyen", "H Nguyen", "NTT Hung"}

HEALTH_TAGS = {"mental", "aging", "robotics", "clinical"}
TAG_LABELS = OrderedDict([
    ("mental", "Mental health"),
    ("aging", "Aging in place"),
    ("robotics", "Health robotics"),
    ("clinical", "Clinical AI"),
    ("xai", "Explainable & contestable AI"),
    ("edge", "Edge & federated AI"),
    ("agents", "Multi-agent & LLMs"),
])


def esc(text):
    return html.escape(text, quote=True)


def scholar_url(title):
    return "https://scholar.google.com/scholar?q=" + quote_plus(f'"{title}"')


def render_authors(authors):
    parts = []
    for name in (a.strip() for a in authors.split(",")):
        parts.append(f"<b>{esc(name)}</b>" if name in FOUNDER_NAMES else esc(name))
    return ", ".join(parts)


def render_pub(pub, indent):
    """Full entry for publications.html."""
    tags = list(pub.get("tags", []))
    filter_tags = tags + (["health"] if HEALTH_TAGS.intersection(tags) else [])
    search = " ".join([pub["title"], pub["authors"], pub["venue"], str(pub["year"])]).lower()

    links = [f'<a href="{esc(scholar_url(pub["title"]))}">Scholar</a>']
    if pub.get("arxiv"):
        links.append(f'<a href="https://arxiv.org/abs/{esc(pub["arxiv"])}">arXiv</a>')
    if pub.get("url"):
        links.append(f'<a href="{esc(pub["url"])}">Paper</a>')
    chips = [f'<span class="tag">{esc(label)}</span>' for tag, label in TAG_LABELS.items() if tag in tags]

    pad = " " * indent
    return "\n".join([
        f'{pad}<li class="pub" data-tags="{esc(" ".join(filter_tags))}" data-search="{esc(search)}">',
        f'{pad}  <div class="pub-title">{esc(pub["title"])}</div>',
        f'{pad}  <div class="pub-authors">{render_authors(pub["authors"])}</div>',
        f'{pad}  <div class="pub-venue">{esc(pub["venue"])}</div>',
        f'{pad}  <div class="pub-foot">{"".join(links)}{"".join(chips)}</div>',
        f"{pad}</li>",
    ])


def render_featured(pub, indent):
    """Compact row for the home page."""
    pad = " " * indent
    href = f'https://arxiv.org/abs/{pub["arxiv"]}' if pub.get("arxiv") else scholar_url(pub["title"])
    return "\n".join([
        f"{pad}<li>",
        f'{pad}  <span class="pub-year">{pub["year"]}</span>',
        f'{pad}  <div><a class="pub-title" href="{esc(href)}">{esc(pub["title"])}</a><div class="pub-venue">{esc(pub["venue"])}</div></div>',
        f"{pad}</li>",
    ])


def replace_between(text, start, end, body):
    pattern = re.compile(re.escape(start) + r".*?" + re.escape(end), re.S)
    if not pattern.search(text):
        raise SystemExit(f"Marker {start} not found")
    return pattern.sub(lambda _: f"{start}\n{body}\n{end}", text, count=1)


def set_count(text, n):
    return re.sub(r"<!-- PUBCOUNT -->.*?<!-- /PUBCOUNT -->", f"<!-- PUBCOUNT -->{n}<!-- /PUBCOUNT -->", text)


def main():
    pubs = json.loads(DATA.read_text(encoding="utf-8"))
    pubs.sort(key=lambda p: -p["year"])  # stable: keeps the JSON order within a year

    by_year = OrderedDict()
    for pub in pubs:
        by_year.setdefault(pub["year"], []).append(pub)

    groups = []
    for year, items in by_year.items():
        body = "\n".join(render_pub(p, indent=12) for p in items)
        groups.append(
            f'        <div class="year-group">\n'
            f'          <h2 class="year">{year}</h2>\n'
            f'          <ul class="pub-list">\n{body}\n          </ul>\n'
            f"        </div>"
        )
    page = ROOT / "publications.html"
    text = replace_between(page.read_text(encoding="utf-8"), "<!-- PUBS:START -->", "<!-- PUBS:END -->", "\n".join(groups))
    page.write_text(set_count(text, len(pubs)), encoding="utf-8")

    featured = [p for p in pubs if p.get("featured")]
    index = ROOT / "index.html"
    text = replace_between(index.read_text(encoding="utf-8"), "<!-- FEATURED:START -->", "<!-- FEATURED:END -->", "\n".join(render_featured(p, indent=10) for p in featured))
    index.write_text(set_count(text, len(pubs)), encoding="utf-8")

    print(f"Rendered {len(pubs)} publications ({len(featured)} featured).")


if __name__ == "__main__":
    main()
