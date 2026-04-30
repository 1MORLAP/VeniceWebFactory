# lead-funnel

Discovers, filters, and scores small-business websites as candidates for the WebFactory rebuild pipeline.

## Pipeline

```
Google Places API ──► heuristic filter ──► Playwright screenshots ──► vision-LLM grader ──► SQLite + Markdown report
                       (free, ~50% drop)    (1440×900 + 390×844)       (1-10 awfulness)
```

## Setup

```bash
# 1. Copy .env template and add keys
cp .env.example .env
$EDITOR .env   # paste GOOGLE_PLACES_API_KEY and ANTHROPIC_API_KEY

# 2. Install (already done if you ran setup.sh)
npm install
```

Required env vars:

- `GOOGLE_PLACES_API_KEY` — Places API (New). Get from https://console.cloud.google.com → Credentials.
- `VENICE_API_KEY` — Venice.ai (OpenAI-compatible vision LLM). Get from https://venice.ai/settings/api.
- `SCORING_MODEL` (optional) — defaults to `google-gemma-3-27b-it` (~$0.17/100-lead batch). See `.env.example` for the full vision-model menu (Gemma, Qwen, Mistral, GPT-4o-mini, Grok, Claude, etc.).

## Usage

### Full pipeline

```bash
node index.js "plumbers in Cleveland Ohio" 50
```

### Slash command (from anywhere in the WebFactory repo)

```
/find-leads "plumbers in Cleveland Ohio" 50
```

### Skip scoring (filter + screenshot only, free)

```bash
node index.js "HVAC contractors Phoenix" 30 --no-score
```

### Tech-age filtering — find genuinely ancient sites

The filter computes a deterministic "tech-age" score from the homepage HTML
(no LLM, no cost). Each old-tech signal adds points:

| Signal                              | Points |
|-------------------------------------|---:|
| FrontPage / iWeb / GoLive generator |  10 |
| HTML 3.2 doctype                    |   8 |
| Yahoo SiteBuilder / Homestead       |   8 |
| Hibu / Yodle / Dreamweaver          |   6 |
| Stale copyright (≥10 years)         |   6 |
| HTML 4.01 / no doctype / no viewport meta | 5 |
| jQuery 1.x                          |   5 |
| `<marquee>` / `<blink>` / frames    |   5 |
| `<font>` / `<center>` / layout tables / Universal Analytics | 3 |

Use `--ancient` (≥8) to drop modern sites before screenshotting:

```bash
node index.js "septic services West Virginia" 50 --ancient        # tech-age ≥ 8
node index.js "funeral homes rural Mississippi" 30 --very-ancient   # tech-age ≥ 12
node index.js "marine repair Maine" 30 --min-tech-age 5             # custom threshold
```

### Industries known to surface high-tech-age sites

| Industry                  | Why                                         |
|---------------------------|---------------------------------------------|
| Septic / well drilling    | Family-owned, low marketing budget, rural   |
| Funeral homes             | Family-run, generations-old, no churn       |
| Tractor / farm equipment repair | Rural, single-operator                |
| Bail bonds                | Sketchy industry, often 1990s sites         |
| Locksmiths (rural)        | Small, no SEO, often template kit           |
| Welding / machine shops   | Single proprietor, B2B, no consumer pressure |
| Marine repair (inland)    | Niche, very local                           |
| Sign shops / monument     | Tiny shops, oldskool                        |
| Auto body / collision     | Small independents, dealer-network sites old |
| Antique / pawn / upholstery | Often built on Yahoo SiteBuilder etc.     |

Smaller markets help too — try West Virginia, Kentucky, Mississippi, Arkansas,
Iowa, rural NY, Appalachia, Mountain West — towns with population < 50k.

### Run individual stages

```bash
node discover.js "plumbers in Cleveland Ohio" 50      # → DB
node filter.js                                         # filter all pending leads
node screenshot.js                                     # screenshot all passed leads
node score.js                                          # score all screenshotted leads
node report.js                                         # → reports/batch-N-DATE.md
node report.js 7                                       # specific batch ID
```

## Database

`lead-funnel/leads.db` is a SQLite file. Inspect with any SQLite client:

```bash
sqlite3 lead-funnel/leads.db
sqlite> .tables
sqlite> SELECT business_name, awfulness_score, industry FROM leads
        WHERE awfulness_score >= 7
        ORDER BY awfulness_score DESC LIMIT 20;
```

### Schema highlights

- `leads.status` — lifecycle: `identified` (default) → `rebuilt` → `published` → `sold` / `dead`. Flip manually as leads move through the funnel.
- `leads.filter_status` — `pending` / `passed` / `rejected`
- `leads.filter_reason` — when rejected: `no_website`, `non_us`, `multi_location`, `ecommerce`, `timeout`, `http_404`, `screenshot_failed`, etc.
- `batches` table — every `discover` run creates a batch; `batch_leads` links them.

## Learning loop (V1)

Today the `status` column is hand-flipped. When you mark a lead `sold`, the original-site features (awfulness score, industry, ability-to-pay tier, etc.) are preserved on the row — that's the training signal. A future script will regress those features against `status='sold'` and feed weights back into ranking.

For now: run batches, flip statuses manually, accumulate ground truth.

## Costs (per 100 leads)

| Stage | Cost |
|---|---|
| Places API | free (covered by $200/mo Google Cloud credit) |
| Screenshots | free (local Playwright) |
| Scoring via Venice — `google-gemma-3-27b-it` (default) | ~$0.17 |
| Scoring via Venice — `qwen3-vl-235b-a22b` (step-up) | ~$0.37 |
| Scoring via Venice — `claude-sonnet-4-6` (premium) | ~$5.22 |
| Scoring via Venice — `claude-opus-4-7` (max) | ~$8.70 |
