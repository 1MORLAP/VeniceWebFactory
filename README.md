# WebFactory

Three-track website rebuilder for small-business sites. Takes one URL, produces three deployed redesigns (A, B, C) on Vercel. Plus a lead-discovery pipeline that feeds candidate URLs in.

```
   ┌──────────────────────────────────────────────────────────────────┐
   │  lead-funnel  →  WebFactory pipeline  →  marketplace listing     │
   │  (discover    │   (rebuild + deploy)  │   (customer comparison   │
   │   candidates) │                       │    of A vs B vs C)       │
   └──────────────────────────────────────────────────────────────────┘
```

This is a Claude Code skill orchestrated via `/webfactory <url>`. It runs unattended through ten stages: scrape → design brief → per-page specs → shared scaffold → contrast lint → 6 parallel Sonnet workers build A → QA + fix-loop → 6 parallel workers rewrite text for B → QA + fix-loop → Frontend Design plugin builds C → QA gate → vercel deploy → final report with 4 URLs (original, A, B, C).

> **Source-of-truth precedence**: `SKILL.md` > `CLAUDE.md` > `ROADMAP.md` > everything else. When in doubt, read `SKILL.md` directly — it's the canonical pipeline definition.

## Quick orientation

| If you want to… | Read |
|---|---|
| **Install on a fresh machine** | [INSTALL.md](INSTALL.md) — 4-command setup, troubleshooting, different-username + different-Vercel-team notes |
| **Understand the pipeline** | [SKILL.md](SKILL.md) — canonical 10-stage definition. ~95 sub-headings. The pipeline runs from the top. |
| **Understand the rules** | [SKILL.md](SKILL.md) top-level architectural rules section (CMS PLACEHOLDER, FACT GROUNDING, IMAGE REUSE, NUMBERED SECTION LABELS, ALPHA-AWARE TEXT CONTRAST, etc.) |
| **See the executive summary** | [CLAUDE.md](CLAUDE.md) — the project memory Claude Code auto-loads. Mirrors SKILL.md at a higher level. |
| **See architecture history** | [ROADMAP.md](ROADMAP.md) — what's current vs retired vs planned. |
| **See user feedback that shaped the skill** | [FEEDBACK.md](FEEDBACK.md) — every shipped fix, with the verbatim user quote that drove it. |
| **Build candidate-discovery for the marketplace** | [lead-funnel/README.md](lead-funnel/README.md) — Google Places → heuristic filter → Playwright screenshots → vision-LLM scoring → SQLite + batch markdown reports. |
| **Add a new structural pattern (component / layout / handler)** | [templates/REQUIRED-PATTERNS.md](templates/REQUIRED-PATTERNS.md) — every WebFactory build must satisfy these. |

## What lives where

```
/Users/tomasz/WebFactory/                         ← canonical install path (see INSTALL.md for alternates)
├── README.md                                      ← THIS FILE
├── SKILL.md                                       ← canonical pipeline definition
├── CLAUDE.md                                      ← project memory (auto-loaded by Claude Code)
├── ROADMAP.md                                     ← architecture history
├── FEEDBACK.md                                    ← every shipped fix + the user quote that drove it
├── INSTALL.md                                     ← fresh-machine setup
├── setup.sh                                       ← idempotent bootstrap script
├── package.json + package-lock.json               ← Playwright + Astro tooling for orchestrator
├── webfactory-logo.svg                            ← brand mark (used in marketplace + outreach)
├── skills-lock.json                               ← lock-file for harness-installed external skills
├── .claude/
│   ├── settings.json                              ← Claude Code permissions (committed)
│   └── commands/
│       └── find-leads.md                          ← slash-command definition for the lead-funnel skill
├── scripts/                                       ← orchestrator helpers
│   ├── scrape.js                                    Stage 1 scraper (Playwright)
│   ├── fix-logo.js                                  post-scrape: hunt for SVG/transparent logo variants
│   ├── detect-placeholders.cjs                      post-scrape: flag CMS placeholder content
│   ├── qa-check.js                                  blocking pre-deploy QA gate (~30 rules)
│   ├── qa.cjs                                       headless screenshot QA (Stage 4 / 6)
│   ├── audit-image-reuse.cjs                        static fleet-wide image-reuse regression detector
│   ├── validate-specs.cjs                           Stage 2.5b pre-dispatch fact-grounding lint
│   ├── init-metrics.cjs / get-port.cjs / log-stage.cjs / finalize-metrics.cjs / manifest-query.cjs
│   └── stitch-* / grab-heroes.js                    orphaned (old Stitch track, retired)
├── templates/
│   ├── REQUIRED-PATTERNS.md                       ← structural contract every build must satisfy
│   ├── scaffold/                                  ← copied per-build (pure Astro + Tailwind, ZERO visual opinions)
│   └── inspiration/
│       ├── README.md                                inspiration library index + A-vs-C compatibility column
│       ├── saas-default/                            SaaS / consumer / tech-forward
│       ├── industrial-trades/                       Workwear / file-tab / bracket-numbered  ← Option C only for trades
│       └── industrial-trades-photo-led/             Editorial-restrained craftsman portfolio  ← Option A for trades
├── lead-funnel/                                   ← lead-discovery skill (discover → filter → score → report)
│   ├── README.md
│   ├── HYPOTHESES.md                                conversion hypotheses + hard-exclusion policy
│   ├── package.json + package-lock.json
│   ├── .env.example                                 GOOGLE_PLACES_API_KEY, VENICE_API_KEY, etc.
│   ├── index.js / discover.js / filter.js / screenshot.js / score.js / report.js / db.js / load-env.js
│   └── scripts/                                     marketplace-adjacent helpers (outreach, slug, queue, etc.)
├── jobs/                                          ← per-build working dirs (gitignored — 9GB+ regeneratable)
│   └── {domain}/
│       ├── manifest.json                            Stage 1 output
│       ├── design-brief.json                        Stage 2 output
│       ├── specs/                                   Stage 2.5 output
│       ├── option-a/                                Stage 3 build
│       ├── option-b/                                Stage 5 build
│       ├── option-c/                                Stage 7 build
│       └── feedback.md                              worker → skill-owner feedback channel
├── docs/
│   └── option-a-process.md                          detailed Option A walkthrough (defer to SKILL.md if conflict)
└── logs/                                          ← per-build logs (gitignored)
```

## The three skills shipped from this repo

### 1. `webfactory` — the rebuild pipeline

```
/webfactory https://example.com               → A + B + C deployed (default)
/webfactory https://example.com --skip-c      → A + B only (skip plugin track)
/webfactory https://example.com --full        → wipe jobs/{domain}/ and rebuild from scratch
/webfactory https://example.com --option-b    → resume from B
/webfactory https://example.com --option-c    → resume from C
```

10-stage pipeline, runs unattended after one invocation. Decomposed by default since 2026-04-29 — Opus orchestrates synthesis-heavy stages (brief, specs, scaffold, fix-loops, plugin invocation, deploy, report); Sonnet sub-agents in parallel handle Stage 3 (Build A pages) and Stage 5 (Build B copy rewrite). Roughly 75% of dollars on Opus, ~25% on Sonnet, ~7-10 min wallclock for a 6-page site.

Full definition: [SKILL.md](SKILL.md). High-level summary in [CLAUDE.md](CLAUDE.md).

### 2. `find-leads` — discover candidate URLs for WebFactory

```
/find-leads "plumbers in tampa fl" 50         → discover, filter, score 50 candidates
/find-leads "tree service ohio" 100 --explore → broader query (still hard-blocks law / complex-tech)
```

Pipeline: Google Places API (deterministic) → heuristic filter (free, drops ~50% via `LAW_NAME_PATTERNS` + `COMPLEX_TECH_TOKENS` in `lead-funnel/filter.js`) → Playwright screenshots (1440×900 desktop + 390×844 mobile) → vision-LLM grader (Venice.ai or similar — 1-10 awfulness score) → SQLite + Markdown batch report.

Output: a SQLite catalog (`lead-funnel/leads.db`) ranked by `conversionLikelihood()` (the live priors live in `lead-funnel/report.js`; hypotheses + their justifications in [lead-funnel/HYPOTHESES.md](lead-funnel/HYPOTHESES.md)).

Hard exclusions (`HX1` law firms, `HX2` complex tech integrations) are policy decisions in `lead-funnel/filter.js` — never bypassed by any flag. New exclusions get added there + documented in HYPOTHESES.md.

Full definition: [lead-funnel/README.md](lead-funnel/README.md) + [`.claude/commands/find-leads.md`](.claude/commands/find-leads.md).

### 3. The marketplace handoff

When a discovered candidate scores well + a WebFactory rebuild lands successfully on Vercel, `lead-funnel/scripts/queue-rebuilds.js` + `mark-rebuilt.js` + `send-outreach.js` (with `webhook-agentmail.js` for replies) close the loop into the marketplace listing flow. AgentMail handles the outreach inbox per-tenant. The marketplace itself isn't in this repo (separate concern), but the handoff scripts are.

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| **Output framework** | Astro 5 + Tailwind v4 | Components, image optimization, zero-JS default, hard-corner aesthetic |
| **Forms / email** | `mailto:` links + AgentMail webhooks | No backend needed |
| **Scraping** | Playwright (headless Chromium) | Handles JS-rendered sites, captures `<img>` AND CSS `background-image` |
| **Lead scoring** | Venice.ai vision-LLM (Gemma / Qwen / Mistral / GPT-4o-mini menu) | OpenAI-compatible API, ~$0.17 per 100-lead batch |
| **Deployment** | Vercel CLI two-step prebuilt flow | `vercel build --yes` (local) → `vercel deploy --prebuilt --yes` (no remote build minutes) |
| **Orchestration** | Claude Code skill (Opus orchestrator + Sonnet sub-agents) | Decomposed mode default since 2026-04-29 |
| **Lead DB** | SQLite (per-machine, in lead-funnel/leads.db) | Simple, local, durable across runs |

## Key rules to know (executive summary)

The full rule set is in `SKILL.md` top-level architectural rules. The most-important-to-know ones:

- **CMS PLACEHOLDER PRINCIPLE** — customer's original site is the input, not the truth. Hibu / Wix / Squarespace / GoDaddy templates ship with placeholders ("your video here", lorem ipsum, default avatars). `scripts/detect-placeholders.cjs` flags them; build rules drop them.
- **FACT GROUNDING PRINCIPLE** — every numeric / dated / credential / identity claim on a built page MUST originate in the manifest OR follow logically from manifest facts. No fabricated "20+ years", no invented BBB rating. `qa-check.js` `fact-grounding` rule enforces this.
- **TESTIMONIAL & REVIEW PRESERVATION** — reviews stay byte-identical between A and B and C. No "tightening" or grammar fixing. `qa-check.js` `testimonial-tampering` rule compares B/C against A's dist as the reference.
- **IMAGE REUSE (Option A)** — at least 90% of must-reuse manifest photos must appear in Option A's build. Editorial / typographic-only Option A is forbidden for trade customers (it's a magazine-layout drift signal). `qa-check.js` `image-reuse-A` rule enforces this.
- **OPTION C IMAGE-QUALITY ESCAPE HATCH** — if customer photos are genuinely too poor to carry C's design, C may substitute thematically-appropriate Unsplash / Pexels / curated AI. A and B always use the customer's actual photos.
- **NUMBERED SECTION LABELS** — `01 — / [ 02 ] / 01 /` style numbered eyebrows are FORBIDDEN on Option A and B non-blog pages. Editorial affectation. `qa-check.js` `numbered-section-labels` rule catches them.
- **ALPHA-AWARE TEXT CONTRAST** — `qa-check.js` composites foreground onto background using `color`-channel alpha × ancestor-`opacity` chain BEFORE measuring WCAG. Parses `rgb`, `rgba`, `oklab`, `oklch`. Catches "white@30% on dark", "Tailwind v4 oklch palette utilities silently skipped", and ancestor-opacity cascade.
- **LOGO RULE** — always preserve the customer's actual logo. `scripts/fix-logo.js` hunts for transparent / SVG variants. Never substitute a wordmark, mark, icon, monogram, or invented graphic.
- **HERO CONTRAST RULE** — every hero with a photo background uses the three-layer pattern (image / overlay / text). `qa-check.js` fails if heading sits on `background-image` without a detectable overlay or computed contrast < 3:1 for large text.
- **MOBILE-FIRST DESIGN** — more than half of trade-customer traffic is mobile. Design at 390×844 first, scale up. Touch targets ≥ 44×44px. `qa-check.js` runs at BOTH viewports (1440×900 + 390×844) and reports `[both]` / `[desktop-only]` / `[mobile-only]` per issue.
- **PLAYWRIGHT FOR PIPELINE; PREVIEW FOR USER DEMOS** — automated testing/QA uses Playwright (`scripts/qa.cjs`, `/tmp/*.mjs` ad-hoc). Visible-browser MCP tools (`preview_*`, `Claude_in_Chrome`, `Control_Chrome`) are banned for pipeline work but ALLOWED when explicitly demonstrating something to the user.

## Vercel deployment target

All deploys go to ONE specific Vercel team:

| Identifier | Value | Use it when… |
|---|---|---|
| Team slug | `tomek-group` | passing `--scope` to `vercel` CLI; reading deploy URLs (suffix `-tomek-group.vercel.app`) |
| Team ID | `team_4Hr5Lqd6pY5D7gmeXDVsDmYx` | passing `teamId` parameter to ANY Vercel MCP tool |

The personal Vercel username `tomekgroup` (no hyphen) is NOT the team — easy to confuse. Never deploy there. See [SKILL.md "Vercel Teams Configuration"](SKILL.md) for the disambiguation + how new project linking works.

## Backup discipline

- Auto-backup contract: every `/webfactory-learn` session ends with `git push origin main`.
- Manual backup if needed:
  ```bash
  cd /Users/tomasz/WebFactory
  git add -A
  git commit -m "Manual edit: {what changed and why}"
  git push origin main
  ```
- The `.gitignore` excludes `jobs/` (9GB+ customer data, regeneratable), `node_modules/`, `dist/`, `.vercel/`, `.claude/skills/` (harness-managed symlinks), `.agents/` (external skills), and stray QA artifacts.

## Restoring on a different machine

```bash
# 1. Clone (private repo — auth required)
git clone https://github.com/1MORLAP/ClaudeWebFactory.git /Users/tomasz/WebFactory

# 2. Bootstrap (Homebrew / Node / Playwright / Frontend Design plugin / Vercel auth)
cd /Users/tomasz/WebFactory
./setup.sh

# 3. Sanity-check
claude
/webfactory https://www.example.com --skip-c
```

For different-username + different-Vercel-team scenarios, see [INSTALL.md](INSTALL.md).

External skills (`agentmail`, `stripe-*`) are restored from `skills-lock.json` automatically by Claude Code on first launch in this directory — they don't need to be installed manually.

## What's NOT in this repo (and intentionally so)

- `jobs/{domain}/**` — per-build working dirs (9GB+ across all customers; all regeneratable from manifest)
- `node_modules/` — npm install restores
- `.vercel/` — created by `vercel link`; per-machine project IDs
- `.claude/launch.json`, `.claude/worktrees/`, `.claude/settings.local.json` — runtime / per-machine
- `.claude/skills/` + `.agents/` — symlinks to harness-managed external skill cache (restored from `skills-lock.json`)
- `lead-funnel/leads.db*` — per-machine SQLite database (regeneratable via re-running discovery)
- `lead-funnel/screenshots/` + `lead-funnel/reports/` — per-batch artifacts
- The marketplace itself — separate concern, separate repo (handoff scripts are here, the marketplace listing flow + customer dashboard are not)

## Reproducibility checklist

For another LLM (Cursor, Codex, etc.) to rebuild WebFactory in their infrastructure:

1. ✅ Repo is public-clonable (currently private — `1MORLAP/ClaudeWebFactory` — request access if you don't have it)
2. ✅ All commits are on `origin/main` (auto-backup contract per session; verify with `git status` showing no orphans)
3. ✅ `INSTALL.md` documents the 4-command setup + troubleshooting + different-username/Vercel-team scenarios
4. ✅ `SKILL.md` is the canonical pipeline definition (~95 sections, every rule cross-referenced)
5. ✅ External dependencies are documented:
   - Claude Code CLI (download from anthropic.com)
   - Frontend Design plugin (`claude plugin install frontend-design@claude-plugins-official --scope project`)
   - Vercel CLI (auth + `tomek-group` team scope, OR replace identifiers in `SKILL.md` + `CLAUDE.md`)
   - Google Places API key (for lead-funnel)
   - Venice.ai API key (for lead-funnel scoring)
   - AgentMail (for outreach + reply ingestion)
6. ✅ External skills locked via `skills-lock.json` (agentmail + 3 Stripe skills)
7. ✅ `setup.sh` is idempotent — safe to re-run if any step fails
8. ✅ All rules are programmatically enforceable where possible — `scripts/qa-check.js` runs ~30 rules at desktop+mobile viewports, blocks deploy on fail
9. ✅ `templates/REQUIRED-PATTERNS.md` documents the structural contract independently of any specific build's design
10. ✅ `FEEDBACK.md` records every shipped fix with the verbatim user quote that drove it (so an external LLM can see WHY each rule exists, not just WHAT it says)

If any of these is broken on a fresh clone, that's a documentation bug — flag it and update `INSTALL.md` + this README.
