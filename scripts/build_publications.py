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
    ("mental", ("Mental health", "violet")),
    ("aging", ("Aging in place", "coral")),
    ("robotics", ("Health robotics", "teal")),
    ("clinical", ("Clinical AI", "teal")),
    ("xai", ("Explainable & contestable AI", "")),
    ("edge", ("Edge & federated AI", "")),
    ("agents", ("Multi-agent & LLMs", "")),
])


def esc(text):
    return html.escape(text, quote=True)


def render_authors(authors):
    parts = []
    for name in (a.strip() for a in authors.split(",")):
        parts.append(f"<b>{esc(name)}</b>" if name in FOUNDER_NAMES else esc(name))
    return ", ".join(parts)


def render_pub(pub, show_year, indent):
    tags = list(pub.get("tags", []))
    filter_tags = tags + (["health"] if HEALTH_TAGS.intersection(tags) else [])
    search = " ".join([pub["title"], pub["authors"], pub["venue"], str(pub["year"])]).lower()
    scholar = "https://scholar.google.com/scholar?q=" + quote_plus(f'"{pub["title"]}"')

    links = [f'<a href="{esc(scholar)}">Google Scholar</a>']
    if pub.get("arxiv"):
        links.append(f'<a href="https://arxiv.org/abs/{esc(pub["arxiv"])}">arXiv</a>')
    if pub.get("url"):
        links.append(f'<a href="{esc(pub["url"])}">Paper</a>')
    chips = []
    for tag, (label, colour) in TAG_LABELS.items():
        if tag in tags:
            cls = f"chip {colour}".strip()
            chips.append(f'<span class="{cls}">{esc(label)}</span>')

    pad = " " * indent
    lines = [f'{pad}<li class="pub{"" if show_year else " no-year"}" data-tags="{esc(" ".join(filter_tags))}" data-search="{esc(search)}">']
    if show_year:
        lines.append(f'{pad}  <div class="pub-year">{pub["year"]}</div>')
    lines += [
        f"{pad}  <div>",
        f'{pad}    <div class="pub-title">{esc(pub["title"])}</div>',
        f'{pad}    <div class="pub-authors">{render_authors(pub["authors"])}</div>',
        f'{pad}    <div class="pub-venue">{esc(pub["venue"])}</div>',
        f'{pad}    <div class="pub-foot">{"".join(links)}{"".join(chips)}</div>',
        f"{pad}  </div>",
        f"{pad}</li>",
    ]
    return "\n".join(lines)


def replace_between(text, start, end, body):
    pattern = re.compile(re.escape(start) + r".*?" + re.escape(end), re.S)
    if not pattern.search(text):
        raise SystemExit(f"Marker {start} not found")
    return pattern.sub(lambda _: f"{start}\n{body}\n{end}", text, count=1)


def main():
    pubs = json.loads(DATA.read_text(encoding="utf-8"))
    pubs.sort(key=lambda p: -p["year"])  # stable: keeps the JSON order within a year

    by_year = OrderedDict()
    for pub in pubs:
        by_year.setdefault(pub["year"], []).append(pub)

    groups = []
    for year, items in by_year.items():
        body = "\n".join(render_pub(p, show_year=False, indent=12) for p in items)
        groups.append(
            f'        <div class="year-group" data-year="{year}">\n'
            f"          <h2>{year}</h2>\n"
            f'          <ul class="pub-list">\n{body}\n          </ul>\n'
            f"        </div>"
        )
    page = ROOT / "publications.html"
    page.write_text(replace_between(page.read_text(encoding="utf-8"), "<!-- PUBS:START -->", "<!-- PUBS:END -->", "\n".join(groups)), encoding="utf-8")

    featured = [p for p in pubs if p.get("featured")]
    index = ROOT / "index.html"
    text = index.read_text(encoding="utf-8")
    text = replace_between(text, "<!-- FEATURED:START -->", "<!-- FEATURED:END -->", "\n".join(render_pub(p, show_year=True, indent=10) for p in featured))
    text = re.sub(r"<!-- PUBCOUNT -->.*?<!-- /PUBCOUNT -->", f"<!-- PUBCOUNT -->{len(pubs)}<!-- /PUBCOUNT -->", text)
    index.write_text(text, encoding="utf-8")

    print(f"Rendered {len(pubs)} publications ({len(featured)} featured).")


if __name__ == "__main__":
    main()
