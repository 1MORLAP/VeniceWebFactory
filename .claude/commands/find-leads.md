---
description: Find small-business websites that, once rebuilt by WebFactory and listed on the marketplace, are most likely to convert into purchases.
argument-hint: "<query>" [count]
---

You are running `find-leads` — the lead-generation skill for **WebFactory**.

The user passed: `$ARGUMENTS`

## 🚫 Hard exclusions (never email, never list)

Two filters are PERMANENT — no `--explore` flag bypasses them:

1. **Law firms / attorneys / legal services** — owner demographic is litigious
   by training. Cold outreach + hosting a derivative site = real C&D / bar /
   trademark exposure. Detected by name patterns AND post-score industry='law'.
2. **Complex tech integrations** — V1 scope is "marketing site with mailto-style
   contact form." We drop sites with booking widgets (Calendly, Acuity, ZocDoc,
   Vagaro, Mindbody, Weave, Phreesia, etc.), online form processors with backends
   (Typeform, JotForm, Wufoo, Formstack, Gravity Forms, WPForms), and
   reservation systems (OpenTable, Resy, Tock). Plain `<form>` posting to email
   and PDF downloads ARE fine.

Both lists are in `lead-funnel/filter.js` (`LAW_NAME_PATTERNS`, `COMPLEX_TECH_TOKENS`)
and applied at filter time. Add new exclusions there + update HYPOTHESES.md.

## 🎯 Mission (read this every time)

WebFactory is a business that:

1. **Finds** small-business websites worth rebuilding (this skill)
2. **Rebuilds** them automatically via `/webfactory <url>` → produces 3 redesigned versions (A, B, C) deployed to Vercel
3. **Lists** the rebuilt versions on **the WebFactory marketplace** (still in development)
4. **Reaches out** to the original business owner offering them the chance to buy their rebuilt site
5. **Sells** to owners who say yes

**Your job is to surface candidates that maximize the probability of step 5 happening.**

You are NOT just "find ugly websites." You are "find websites whose owners are likely to BUY a rebuild." Those overlap heavily but aren't identical:

- An ugly site owned by a corporate franchisee → won't buy (no decision authority)
- A pretty site owned by an embarrassed owner with budget → might buy (but doesn't need us)
- An ugly site owned by an engaged single-operator with cash flow → **bullseye**

## 🔄 The conversion funnel (what we're optimizing for)

```
identified → rebuilt → published → outreach_sent → email_opened → marketplace_visited → offered → SOLD
   (you)     (/webfactory)  (marketplace)    (outreach)        (mailgun/SES)    (marketplace)   (owner)   ($$)
```

Every lead row in `lead-funnel/leads.db` carries a `status` column tracking position in this funnel. The skill currently flips `status='identified'` on insertion. As the marketplace + outreach systems come online, the marketplace will write back `marketplace_visited_at`, `purchased_at`, `purchase_amount_usd`. The pipeline will write back email-open events.

**No sales have happened yet.** The marketplace is being built. We are in the cold-start period.

## 🧠 Reinforcement learning loop (currently scaffolded, will go live as data arrives)

Today's selection criteria (tech-age, awfulness, single-location, ability-to-pay tier) are **HYPOTHESES**, not facts. They feel right, but we have zero conversion data. Once the marketplace ships and we accumulate sale outcomes, the skill will:

1. Pull all leads with `status='sold'`
2. Regress original-site features (tech_age, industry, geography, review velocity, owner-engagement signals, etc.) against the sold flag
3. Re-weight the conversion-likelihood scoring function
4. Surface what predicts sales, drop what doesn't

For now we operate on prior beliefs. **Document every belief as a hypothesis** in `lead-funnel/HYPOTHESES.md` so we can test it later.

## 📊 Default behavior (no flags required)

Type `/find-leads "<query>" [count]` — that's it. No `--ancient` or other modifiers. Defaults:

- **Tech-age threshold = 5** (filter drops very modern sites BEFORE screenshotting — they're not pain points)
- **Conversion-likelihood ranking** is the default sort order
- **Scoring is on by default** (Gemma 3 27B via Venice — ~$0.03/100-lead batch)
- **Ranks by composite score** (awfulness × tech-age × pay-tier × single-location × form-only × engagement)

Non-default flags exist for hypothesis testing:

- `--explore` — turn off all conversion filters; show raw discovery (for evaluating new criteria)
- `--strict` — only highest-conviction candidates (tech-age ≥ 12 AND awfulness ≥ 7 AND pay-tier ≥ mid)
- `--no-score` — skip vision-LLM scoring (saves $0.03 per batch; useful for tech-age-only exploration)
- `--min-tech-age N` — manual override

## 📈 Composite conversion-likelihood signals

When ranking leads, we combine:

| Signal | Source | Weight | Why we believe it predicts conversion |
|---|---|---|---|
| `tech_age_score` | HTML probe (deterministic, free) | high | Genuinely old site = real pain → owner notices when shown a rebuild |
| `awfulness_score` | Gemma vision (1-10) | high | Visually bad site = owner is/should be embarrassed |
| `ability_to_pay_tier` | Gemma industry classification | high | Premium trades / professional services have budget |
| `single_location_confidence` | Gemma | high | Single owner = decision-maker, no committee |
| `form_only_confidence` | Gemma | mid | No e-commerce = our V1 scope fits perfectly |
| `google_review_count` | Places API | mid | ≥10 reviews = real, active business with customers |
| `google_rating` | Places API | low | High rating = engaged owner; low rating = struggling but maybe receptive |
| Industry trust-dependence | derived | high | Funeral / law / dental / medical → website matters more, owners notice |

Hypotheses we should ALSO test as we get data:
- **Domain age** (older domain = established business, more likely to have budget)
- **Photo count on Google Business profile** (engaged owner = more likely to engage with us)
- **Site has email or contact form** (reachability — can we even contact the owner?)
- **Recent review timestamp** (active in last 90 days)
- **Geography — small market vs metro** (less competition = more receptive vs more sophisticated)
- **Language** — non-native English copy in the site → maybe non-native owner who needs help, or maybe language is a quality signal

## 🚦 What to do when invoked

1. **If `$ARGUMENTS` is empty**: print a usage block with several "high-conversion-prone" preset queries and stop:

```
/find-leads "<query>" [count] [flags]

By default, surfaces high-conversion-likelihood candidates only (tech-age ≥ 5,
ranked by composite score). No flags needed for the common case.

High-conversion-prone presets to try:
  /find-leads "funeral homes Mississippi" 50
  /find-leads "well drilling Kentucky" 50
  /find-leads "septic services rural Iowa" 50
  /find-leads "independent jewelers Alabama" 30
  /find-leads "auto body shops rural Pennsylvania" 30
  /find-leads "monument & headstone shops Mississippi" 30
  /find-leads "tire shops rural Iowa" 30
  /find-leads "upholstery shops Tennessee" 30

DO NOT suggest law firms, attorneys, or any legal-services queries —
permanently blocklisted (legal risk, see HYPOTHESES.md).

Flags (only when defaults aren't right):
  --explore           no filters — see all discovery
  --strict            highest-conviction only (tech-age ≥ 12 + awful ≥ 7 + pay ≥ mid)
  --no-score          skip vision-LLM scoring
  --min-tech-age N    manual tech-age override
```

2. **If args provided**: execute via Bash with smart defaults:

```
node /Users/tomasz/WebFactory/lead-funnel/index.js $ARGUMENTS
```

Stream the output so the user sees stage-by-stage progress.

3. **After completion**:
   - Print the report path as a markdown link
   - Print the **top 5 candidates ranked by conversion-likelihood** (not just awfulness):
     - Business name, score, top reason, website
   - If the batch produced fewer than 5 surviving candidates, propose 2-3 alternative queries that target similar industries in different geographies
   - If most leads were dropped for the same reason (`no_website`, `multi_location`, `too_modern_*`), surface that pattern so the user knows what's typical for that industry/geography

## 🔐 Required env vars

- `GOOGLE_PLACES_API_KEY` in `lead-funnel/.env` (Places API New)
- `VENICE_API_KEY` in `lead-funnel/.env` (vision scoring; only required unless `--no-score`)

## 🔁 Processing leads (queue → rebuild → mark)

Once you've built up a catalog, the safe processing path is:

```bash
# 1. Pick the top N leads to rebuild — ATOMICALLY marks them queued_for_rebuild.
#    Pre-flight checks jobs/{domain}/ and self-heals if a build already exists.
node lead-funnel/scripts/queue-rebuilds.js --top 5 [--dry] [--reset-stuck]

# 2. The script outputs `/webfactory <url>` commands. Launch each (see launch
#    methods below).

# 3. After each /webfactory finishes, mark the lead:
node lead-funnel/scripts/mark-rebuilt.js \
  --domain example.com \
  --marketplace-url https://webfactory.market/example
```

### Three ways to launch a `/webfactory` build

`/webfactory` runs unattended for ~2-3 hours per site, so we want each build
to live in its own context. You'll mix and match these depending on what's at
hand. None is "better" — they trade off observability, parallelism, and how
much human input each needs.

#### A. Paste into a fresh Claude Code session (manual, classic)

The simplest path. Open a new terminal session (or new Claude Code tab in
Cursor / iTerm / IDE), paste the slash command, watch it run. Use this when:

- You want to **see live progress** in a UI (stages logged, screenshots, etc.)
- You're running **2-3 builds and have monitors free** to host them
- The site is **important enough to babysit** (hero rebuild, customer demo)

```
/webfactory http://www.example.com/
```

Pros: full visibility, easy to intervene if something looks off, can use
Medium tier and get the best design quality. Cons: you're running the
sessions; they don't survive closing the tab.

#### B. Spawnable task chip (one-click handoff)

Fire `mcp__ccd_session__spawn_task` with the `/webfactory <url>` prompt — a
chip appears in the user's UI, one click spins it into its own session +
worktree. Use this when:

- You're **already in a Claude Code session** (e.g. lead-funnel triage) and
  want to hand a build off without leaving
- The user is **driving the UI** and prefers per-build isolation (separate
  worktree per chip = no cross-contamination)
- You want **the user to decide** when to actually start the build (chips
  can sit idle, get dismissed, get reordered)

The skill lives at the lead-funnel session's tool surface; just call it:

```
mcp__ccd_session__spawn_task({
  title: "Build example.com",
  tldr:  "Runs /webfactory on example.com — returns 4 Vercel preview URLs.",
  prompt: "/webfactory http://www.example.com/"
})
```

Pros: zero friction for the user, isolated worktree per build, full UI
feedback when started, parallel-by-default. Cons: requires an active CCD
session (this MCP server). Build still won't run until the user clicks.

#### C. Background subprocess via `claude -p` (unattended, fire-and-forget)

Spawn `claude -p` as a `nohup` background process from any Bash tool call.
The build runs headlessly to completion and survives this session ending.
Use this when:

- You want to **launch a build right now without user interaction**
- You're **batch-running 20+ builds overnight** — chip approach would flood
  the UI with chips
- The current Claude session is **already busy with something else** (e.g.
  monitoring keep-going-til-1000) and you don't want to block it

```bash
mkdir -p /Users/tomasz/WebFactory/lead-funnel/reports/webfactory-runs
LOG=/Users/tomasz/WebFactory/lead-funnel/reports/webfactory-runs/example-$(date +%Y%m%d-%H%M).log

nohup claude -p "/webfactory http://www.example.com/" \
  --model opus \
  --permission-mode bypassPermissions \
  --add-dir /Users/tomasz/WebFactory \
  > "$LOG" 2>&1 &
disown
```

Pros: completely hands-off, scales to many parallel builds, log file per run,
survives terminal close. Cons: **no streaming progress** — default `-p` mode
buffers stdout until completion, so the log stays empty for hours. To peek at
mid-flight progress, watch the filesystem instead:

```bash
# Stage milestones — files appear as the pipeline advances:
ls /Users/tomasz/WebFactory/jobs/{domain}/
#   manifest.json     → Stage 1 (scrape) done
#   design-brief.json → Stage 2 done
#   option-a/dist/    → Stage 3 (Build A) done
#   qa-option-a/      → Stage 4 done
#   option-b/dist/    → Stage 5 done
#   option-c/dist/    → Stage 7 done
#   metrics.json      → Stage 10 (Report) done — pipeline complete
```

#### Quick decision matrix

| Situation                                 | Pick |
|-------------------------------------------|------|
| Hero rebuild, want to watch + intervene   | **A** |
| 2-5 builds, want each in its own UI tab   | **B** |
| Lead-funnel session driving the workflow  | **B** |
| 20+ builds overnight, fully unattended    | **C** |
| Current session is busy, can't paste      | **C** |
| User said "spin one up now"               | **C** (default) or **B** (if "in the UI") |

**Idempotency guarantees** (the lead is never picked twice):

- `place_id UNIQUE` in `leads` — re-running discover with the same query upserts, never duplicates.
- `marketplace_slug UNIQUE` — collision-safe (city/state/place-id suffixes when needed).
- Cross-batch domain dedup at filter time — multiple Place listings on the same site collapse to one.
- `queue-rebuilds.js` only picks leads with `status IN ('identified', 'queued_for_rebuild')` — never re-picks `rebuilt` / `published` / `outreach_sent` / `sold` / `dead`.
- Pre-flight check: if `jobs/{domain}/option-{a,b,c}/dist/index.html` exists, the script auto-flips status to `rebuilt` (self-heal).
- `--reset-stuck` flips `queued_for_rebuild` rows older than 1 hour back to `identified` (recovery path for abandoned mid-flight queues).
- `mark-rebuilt.js` is idempotent — safe to call multiple times on the same lead.

## 💾 Database & artifacts

- All leads persist in `lead-funnel/leads.db` (SQLite). One row per `place_id` — re-running the same query is idempotent, leads are deduped.
- Screenshots: `lead-funnel/screenshots/{place_id}/{desktop,mobile}.png`
- Reports: `lead-funnel/reports/batch-{id}-{date}.md`
- The `status` column tracks the funnel — flip manually as leads progress until the marketplace integration lands.

## 💰 Costs (per 100 leads)

- Places API: free under the $200/mo Google Cloud credit
- Screenshots: free (local Playwright, only on filter survivors)
- Scoring: ~$0.03 with `google-gemma-3-27b-it` (default Venice model). Upgrade to `claude-sonnet-4-6` (~$5) only if Gemma's calibration starts hurting conversion data — which we'll know once sales come in.

## 🧪 Hypothesis tracking

When you discover a new signal that seems to correlate with awful sites OR likely conversion, add it to `lead-funnel/HYPOTHESES.md` with:
- The hypothesis (e.g. "businesses with ≥3 photos on Google Business profile convert 2× better")
- Why we believe it
- How to test it (what we need to track)
- Status: `untested | testing | confirmed | refuted`

The skill-owner session updates this file. Worker sessions running `/find-leads` may add entries but do not change scoring weights — that comes from real outcome data.
