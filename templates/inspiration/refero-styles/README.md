# Refero Styles — DESIGN.md library

Local mirror of <https://styles.refero.design> — 1,226 curated DESIGN.md files (Tailwind v4 `@theme` variant) covering color tokens, typography, spacing, components, do's & don'ts, surfaces, elevation, imagery, layout, and an agent prompt guide per brand.

Captured: 2026-05-07.

## Layout

- `<slug>.md` — one DESIGN.md per style. Slugs come from `siteName` (e.g. `linear.md`, `stripe.md`); collisions are disambiguated by the URL path/host suffix (e.g. `apple-macbook-neo.md` vs `apple-ipad-air.md`).
- `_index.json` — canonical index. One entry per Refero style with: `id`, `siteName`, `url`, `file`, `colorScheme`, `fonts`, `colors`, `northStar`, `screenshotUrl`, `thumbnailUrl`, `iconUrl`, `previewVideoUrl`, `createdAt`, and `missing: true` for the 3 stale Refero IDs whose pages 404.
- `README.md` — this file.

## Format

Every file follows the Refero Copy.md template:

```
# {SiteName} — Style Reference
> One-line summary…

**Theme:** light | dark

{Description prose — the "northStar"}

## Tokens — Colors
## Tokens — Typography
## Tokens — Spacing & Shapes
## Components
## Do's and Don'ts
## Surfaces
## Elevation
## Imagery
## Layout
## Agent Prompt Guide
## Similar Brands
## Quick Start
```

The token sections embed a Tailwind v4 `@theme` block plus prose rationale.

## How to use in WebFactory

These are **reference materials** for the worker / sub-agent at design time. They sit alongside the existing `templates/inspiration/{saas-default,industrial-trades,industrial-trades-photo-led}/` libraries. Two main use cases:

1. **Brief priors** — Stage 2 brief reads `_index.json`, filters to industries/aesthetics matching the customer, and pulls 3–6 relevant DESIGN.md bodies into the brief sub-agent's context.
2. **Visual-pass diversity / audit** — Stage 4c-bis / 6c / 7g can pick a comparable DESIGN.md as one peer reference (alongside the customer's actual peer-build PNGs).

Most entries skew B2B SaaS / fintech / productivity — apply the same dataset-bias caveat as the Refero MCP screen catalog when sampling for trades / SMB customers.

## Refresh

```sh
node scripts/fetch-refero-styles.mjs           # full mirror (~2 min for ~1,200 styles)
node scripts/fetch-refero-styles.mjs --limit 5 # smoke test
```

Env overrides: `REFERO_CONCURRENCY` (default 10), `REFERO_OUT_DIR` (default `templates/inspiration/refero-styles/`), `REFERO_API_BASE` (default `https://styles.refero.design`).

The script enumerates `/api/styles?page=N` and fetches each `/style/{id}` page, extracts the rendered `<pre><code>` block, decodes HTML entities, writes one Markdown file per style, and rewrites `_index.json`. Self-contained (no temp files); idempotent (re-runs overwrite). Failed fetches (e.g. styles deleted from Refero's catalog) are flagged `"missing": true` in the index.

## Missing entries

3 catalog entries returned a 404 page on the public site (deleted styles still listed by the API):

- `46f01790-e488-4aba-9236-02466b0fb3cd` — Opal Camera
- `cf733c2a-dca1-46af-b41d-5e1d354e4297` — Collins
- `63cd6fbc-c3f1-4fd4-9115-70300bc07adc` — Manus

These appear in `_index.json` with `"missing": true` and have no corresponding `.md` file.
