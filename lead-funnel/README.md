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
- `ANTHROPIC_API_KEY` — Anthropic SDK. Get from https://console.anthropic.com/settings/keys.
- `SCORING_MODEL` (optional) — defaults to `claude-haiku-4-5`. Upgrade options in `.env.example`.

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
| Scoring (Haiku 4.5, default) | ~$1-2 |
| Scoring (Sonnet 4.6) | ~$5 |
| Scoring (Opus 4.7) | ~$15-20 |
