---
description: Discover, filter, and score small-business website rebuild candidates using the WebFactory lead-funnel pipeline.
argument-hint: "<query>" [count]
---

You are running the WebFactory lead-funnel pipeline. The user passed: `$ARGUMENTS`

## What this command does

End-to-end pipeline that finds small-business websites worth rebuilding:

1. **Discover** — Google Places API text search returns up to N candidates (name, website, address, rating, reviews, category)
2. **Filter** — heuristic drops: no website, multi-location chains, ecommerce signals, unreachable sites, non-US
3. **Screenshot** — Playwright captures desktop (1440×900) + mobile (390×844) for every passed lead
4. **Score** — vision-LLM grades each site: awfulness 1-10, single-location confidence, form-only confidence, ability-to-pay tier, normalized industry
5. **Report** — Markdown ranked by combined awfulness × pay × single-location × form-only score, grouped by industry

## How to invoke

The user already typed the args. Parse them:

- First positional arg: the search query (e.g. `"plumbers in Cleveland Ohio"`)
- Second positional arg (optional): count (default 30)
- Flag `--no-score` (or `--skip-score`): skip the LLM scoring stage

If `$ARGUMENTS` is empty, show usage and stop:

```
/find-leads "<query>" [count] [--no-score]
Examples:
  /find-leads "plumbers in Cleveland Ohio" 50
  /find-leads "HVAC contractors Phoenix" 30
  /find-leads "dentists Austin Texas" 20 --no-score
```

## Run the pipeline

Execute via Bash:

```
node /Users/tomasz/WebFactory/lead-funnel/index.js $ARGUMENTS
```

Stream the output so the user sees stage-by-stage progress.

## Required env vars

- `GOOGLE_PLACES_API_KEY` — set in `lead-funnel/.env` (Places API New)
- `ANTHROPIC_API_KEY` — set in `lead-funnel/.env` (only needed if scoring is enabled)

If either is missing, the pipeline fails with a clear error pointing at `lead-funnel/.env`.

## After completion

Print the final report path to the user as a clickable Markdown link, e.g.:

```
✓ Report: [batch-7-2026-04-26.md](lead-funnel/reports/batch-7-2026-04-26.md)
```

If scoring ran, also print the top 5 candidates from the report (just the names, awfulness scores, and websites) so the user can see immediate output without opening the file.

## Database & artifacts

- All leads persist in `lead-funnel/leads.db` (SQLite)
- Screenshots in `lead-funnel/screenshots/{place_id}/{desktop,mobile}.png`
- Reports in `lead-funnel/reports/batch-{id}-{date}.md`
- The `status` column on `leads` is `identified` by default; flip to `rebuilt` / `published` / `sold` / `dead` manually as the lead progresses through the funnel — that's the learning signal a future regression script will use.

## Costs (approximate, per 100 leads)

- Places API: free (covered by $200/mo Google Cloud credit)
- Screenshots: free (local Playwright)
- Scoring: ~$1-2 with claude-haiku-4-5 (default) / ~$5 with claude-sonnet-4-6 / ~$15-20 with claude-opus-4-7
