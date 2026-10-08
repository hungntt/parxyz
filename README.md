# Parxyz website

Static company website for **Parxyz** (parxyz.uk), hosted on GitHub Pages. Plain HTML, CSS and JavaScript with no build step and no third-party requests (fonts are self-hosted).

## Structure

| Path | Purpose |
| --- | --- |
| `index.html` | Home: focus areas, products, approach, selected publications, team, contact |
| `publications.html` | Full publication list with search and topic filters |
| `privacy.html`, `terms.html` | Privacy policy, terms of use and medical disclaimer |
| `404.html` | Not-found page |
| `data/publications.json` | Source of truth for publications |
| `scripts/build_publications.py` | Renders the JSON into `publications.html` and the featured list in `index.html` |
| `assets/` | CSS, JS, fonts and images |

## Updating publications

1. Edit `data/publications.json`. Each entry has `title`, `authors`, `venue`, `year`, `tags`, and optional `arxiv`, `url` and `featured` fields.
   Tags: `mental`, `aging`, `robotics`, `clinical`, `xai`, `edge`, `agents`.
2. Run `python3 scripts/build_publications.py`.
3. Commit and push. GitHub Pages redeploys automatically.

## Preview locally

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

## Connecting the parxyz.uk domain

1. At your DNS provider, add records for the apex domain `parxyz.uk`:
   - `A` records: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - `AAAA` records (optional): `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153`
   - `CNAME` record for `www` pointing to `hungntt.github.io`
2. In the repository, go to **Settings → Pages → Custom domain**, enter `parxyz.uk` and save. GitHub commits a `CNAME` file for you.
3. Once the DNS check passes, tick **Enforce HTTPS**.
4. Recommended: verify the domain under **GitHub Settings → Pages → Verified domains** to prevent takeover.

## Company email

The Claude for Startups program requires a company email on the same domain as the website. The site lists `hello@parxyz.uk` and `hung@parxyz.uk`. Set these up with your email provider (for example Google Workspace, Zoho Mail, or a forwarding service such as Cloudflare Email Routing or ImprovMX) before applying.
