# WebFactory

Website rebuilding tool. Takes a URL, scrapes the site, and builds **THREE** redesigned versions: **A, B, C**.

- **Option A** — Faithful rebuild. Original text verbatim + dramatically improved design. _"Same site, suddenly expensive."_
- **Option B** — Same design as A + agency-rewritten conversion-tuned copy (CTAs sharpened, value props reordered for impact). B is the **canonical text source for C**. _"Same site, suddenly persuasive."_
- **Option C** — B's exact text + Frontend Design plugin's industry-anchored design language. _"Same sharper words, industrial design language."_

> **Pipeline retirements**:
> - **Old "Option B" (Stitch-driven, retired 2026-04-24)** — replaced by simpler architecture
> - **Old "Option A+" (renamed 2026-04-25)** — what was previously called Option A+ is now simply Option B

All built on Astro 5 + Tailwind v4. Customer comparison structure: **A vs B** measures value of copy improvement; **B vs C** measures design preference with copy held constant.

## 🏁 Pipeline = 10 stages, run all of them, do NOT stop mid-pipeline

WebFactory runs UNATTENDED. The user types `/webfactory <url>` ONCE — that single act is authorization for the entire 10-stage pipeline. There is no point at which the model should ask "want me to continue?" until Stage 10 emits the final 4 (or 3) deployment URLs.

```
1. Scrape  →  2. Brief  →  3. Build A  →  4. QA A  →  5. Build B  →  6. QA B  →
7. Build C  →  8a. QA Gate  →  8b. Deploy  →  9. Verify  →  10. Report (4 URLs)
                                                                    ↘ 10c. Register with WebFactory Store (non-fatal)
                                                                    ↘ 10d. Sync lead-funnel DB (mark-rebuilt, non-fatal)
```

**Common stop-too-early failure mode (especially with smaller / cheaper models like Qwen, Haiku, local LLMs)**: the model finishes Build A (Stage 3), sees it succeeded, says *"Build complete. Want me to start the dev server and inspect the pages?"* → stops → user has to manually say "yes, continue" → repeat at every stage boundary. **This is wrong.** The full PIPELINE COMPLETION CONTRACT is in SKILL.md — workers MUST read it and follow it. If you find yourself typing a question to the user mid-pipeline ("ready for X?", "want me to Y?"), erase the question and just do the work.

The completion test: did your most recent message contain 4 (or 3 with `--skip-c`) clickable `<https://...>` URLs in a markdown autolink format AND a metrics table? If NO → you are not done. Resume.

## 📦 Setting up on a fresh machine

If WebFactory needs to be installed on a new MacMini / MacBook (or recovered after disk failure):

```bash
# 1. Install Claude Code first: https://claude.com/claude-code
# 2. Clone the repo from GitHub:
git clone https://github.com/1MORLAP/ClaudeWebFactory.git /Users/tomasz/WebFactory
# 3. Run the bootstrap script (Homebrew, Node, ffmpeg, Playwright, Frontend Design plugin, Vercel login, path-portability handling):
cd /Users/tomasz/WebFactory && ./setup.sh
```

**Full guide**: see `INSTALL.md` in the repo root — covers the 10-step setup, troubleshooting, what to do if the username on the MacMini is different from `tomasz`, and what to change if you need to point at a different Vercel team. The bootstrap script (`setup.sh`) is idempotent — safe to re-run if a step fails.

## 🟦 Vercel Teams Configuration — READ BEFORE DEPLOYING

All WebFactory deploys go to ONE specific Vercel team. Deploying to the wrong scope (personal account, different team) is a real failure mode — projects show up in the wrong dashboard, billing splits, and the user can't find them. **This is the only Vercel target. Never deploy elsewhere.**

| Identifier | Value | Use it when… |
|---|---|---|
| **Team slug** | `tomek-group` | passing `--scope tomek-group` to `vercel` CLI, OR reading deploy URLs (suffix `-tomek-group.vercel.app`) |
| **Team ID** | `team_4Hr5Lqd6pY5D7gmeXDVsDmYx` | passing `teamId` parameter to ANY Vercel MCP tool (`list_projects`, `list_deployments`, `get_deployment`, `get_deployment_build_logs`, etc.) |
| **Team display name** | `Tomek Group` | Vercel dashboard navigation only |

**Confusion warning**: the user's personal Vercel username is **`tomekgroup`** (no hyphen). The team slug is **`tomek-group`** (with hyphen). They are NOT the same scope. `vercel whoami` returns the personal username — it does NOT tell you which scope you'll deploy to. **Never deploy to the personal account.**

**How deploys actually land in the team** (no manual `--scope` needed for re-deploys):
- Existing job directories under `jobs/{domain}/option-*/` already have a linked `.vercel/project.json` with `"orgId": "team_4Hr5Lqd6pY5D7gmeXDVsDmYx"`. Re-deploying from those directories automatically targets the team.
- For a BRAND-NEW project (first deploy from a never-deployed directory), the CLI will prompt to link. To avoid the interactive prompt in unattended mode, either pass `--scope tomek-group --yes` on the first deploy, OR create `.vercel/project.json` manually with `{"projectId": "prj_NEW", "orgId": "team_4Hr5Lqd6pY5D7gmeXDVsDmYx", "projectName": "..."}` BEFORE running `vercel deploy`. Easiest: first deploy is `npx vercel link --scope tomek-group --yes` then `npx vercel deploy --prebuilt --yes`.

**Verification after first deploy** (one-time per pipeline change): the deployment URL must end in `-tomek-group.vercel.app`. If it ends in just `-tomekgroup.vercel.app` (no hyphen) or no suffix, you deployed to the wrong scope — destroy that project and re-deploy with `--scope tomek-group`.

**Vercel MCP calls REQUIRE the team ID explicitly.** Every MCP tool that lists deployments / projects / build logs needs `teamId: "team_4Hr5Lqd6pY5D7gmeXDVsDmYx"`. Without it the call fails or returns empty results from the personal scope. Hard-code this value when calling those tools.

## 🔒 Skill Lockdown — Read This Before Editing Anything

**If you are running `/webfactory <url>` (a worker session), you MAY NOT edit the skill itself.** This applies regardless of how good a fix would be or how clearly broken something looks. The skill is read-only to worker sessions.

- **Read-only paths** (workers may NOT edit): `SKILL.md`, `CLAUDE.md` (this file), `FEEDBACK.md`, `ROADMAP.md`, `scripts/**`, `templates/**`, `.claude/**`
- **Editable paths** (workers MAY edit freely): `jobs/{domain}/**` — the per-job working directory, including `jobs/{domain}/feedback.md` for flagging issues to the skill-owner

**Bug in the skill?** Don't fix it in place. Work around it locally for the current job, then write the issue + proposed fix to `jobs/{domain}/feedback.md` and print a copy-paste block at the end of your run for the user to hand to the skill-owner session. The skill-owner is a separate session (one without an active `/webfactory` build) and is the only role allowed to evolve the skill files.

**Why**: parallel WebFactory builds may run on different domains. If two workers both "fix" SKILL.md based on what they each saw, you get races and lost lessons. Lockdown enforces serial evolution: workers FLAG, skill-owner FIXES. See SKILL.md "🔒 SKILL LOCKDOWN" for the full rule.

## Usage

### Manual (single site)
```
/webfactory https://example.com
```

### Stage override
```
/webfactory https://example.com --option-b      # skip to Option B (copy rewrite of A)
/webfactory https://example.com --option-c      # skip to Option C (plugin-driven design)
/webfactory https://example.com --full          # rebuild everything (rm -rf jobs/{domain}/ first)
```

### Scope override (skip Option C entirely)
```
/webfactory https://example.com --skip-c        # build A and B only, skip Stage 7 entirely
/webfactory https://example.com --no-c          # alias for --skip-c
/webfactory https://example.com --ab-only       # alias for --skip-c
/webfactory https://example.com --full --skip-c # clean rebuild, A and B only
```
When `--skip-c` is active: Stage 7 is skipped (no plugin needed, no `option-c/` created), Stage 8a/8b skip the C deploy gate and the C deploy, Stage 9 skips C verification, Stage 10 reports 3 links instead of 4. The Frontend Design plugin doesn't need to be installed.

**Mutually exclusive**: `--skip-c` + `--option-c` is an error (the user asked to both skip and start at C — ambiguous). Other combinations work freely.

### Languages (English-only by default; opt-in to translations)
```
/webfactory https://example.com                              # English only — NO translations built
/webfactory https://example.com --languages es               # English + Spanish for Options B and C
/webfactory https://example.com --languages es,de,fr         # English + Spanish + German + French for B and C
/webfactory https://example.com --add-language Spanish --to both   # add Spanish to an EXISTING build (post-build)
/webfactory https://example.com --add-language ru --to b           # add Russian to Option B only (post-build)
```
**Default: English only.** Initial `/webfactory <url>` invocations build B and C as English-only — no `/es/`, `/de/`, etc. directories are created, no language switcher in the nav, qa-check's multilingual rules silently no-op. Translations are explicitly opt-in via either `--languages <list>` (initial-build flag) OR `--add-language <name|iso> --to <b|c|both>` (post-build incremental flag). Option A is ALWAYS English-only regardless of flags. See `MULTILINGUAL SUPPORT` rule in SKILL.md for the full list of supported ISO 639-1 codes and per-language translation tags.

### Smart resume
The skill auto-detects existing work (manifest, Option A, Option B, Option C) and skips completed stages. **Cascade rule**: rebuilding A forces rebuilding B; rebuilding B forces rebuilding C — UNLESS `--skip-c` is active, in which case the B→C cascade is short-circuited.

### Unattended builds (Phase F.5, 2026-05-07)

For background `claude -p` builds (overnight batches, parallel domains), use the `scripts/run-webfactory.sh` wrapper instead of raw `nohup claude -p ... &`:

```bash
scripts/run-webfactory.sh http://www.example.com/ --full
scripts/run-webfactory.sh http://www.example.com/ --full --skip-c
```

The wrapper:
1. **Captures stdout AND stderr** to `/tmp/webfactory-{domain}-{timestamp}.log` so any prompt that bypassPermissions doesn't suppress is visible (rather than blocking on closed stdin invisibly).
2. **Spawns an idle watchdog** that polls log freshness every 60s. If the log hasn't grown for `IDLE_LIMIT` seconds (default 1800 = 30 min), kills the build and writes the last 50 lines to `${LOG}.last-50-before-kill` so the operator can see what was waiting.
3. **Prints a clear `tail -f` instruction** at launch so the operator can watch from another terminal.

Why this matters: 2026-05-07 lisastephens G.2+G.5 build sat 8 hours waiting on a permission prompt that `--permission-mode bypassPermissions` didn't suppress. The default `nohup ... > log 2>&1 &` pattern captured the prompt but the operator had no way to discover it without explicit guidance. The wrapper standardizes the discovery path + adds a kill switch for hung builds. Critical for parallel-batch-of-100 unattended operation.

**Prompt-bypass leak DIAGNOSED 2026-05-07**: the 8-hour blocks weren't on the build subprocess (which runs cleanly under `claude -p`). They were on the parent session's Monitor commands. Claude Code has a secondary "Contains while_statement" permission guard that `bypassPermissions` does NOT override — any tool command containing a `while` loop blocks until approved. Solution: don't start parallel Monitor commands with `tail -F | while read ...` patterns. Either tail the orchestration.log directly when checking status, or use a Node helper that uses `fs.watch` instead of bash loops. The build subprocess is independently unaffected. See FEEDBACK.md "Phase F.5 prompt-bypass leak DIAGNOSED" for the full investigation.

Environment overrides: `IDLE_LIMIT=3600` (1 hr — safe for 14+-page sites), `LOG_DIR=/path` (default `/tmp`), `NO_WATCHDOG=1` (disable for interactive debugging).

## Final deliverable

**Default mode (4 links)**:
```
1. Original:   <customer URL>
2. Option A:   <vercel URL>
3. Option B:   <vercel URL>
4. Option C:   <vercel URL>
```

**`--skip-c` mode (3 links)**:
```
1. Original:   <customer URL>
2. Option A:   <vercel URL>
3. Option B:   <vercel URL>
4. Option C:   skipped (--skip-c mode)
```

## Project Structure

- `scripts/scrape.js` — Playwright scraper (captures `<img>` AND CSS `background-image`)
- `scripts/fix-logo.js` — Post-scrape: hunts for SVG/transparent logo variants, samples background colour, writes `manifest.logo` metadata
- `scripts/qa.cjs` — Headless Playwright QA: desktop + mobile screenshots, console/network error logging
- `scripts/qa-check.js` — Blocking pre-deploy QA gate: logo legibility, logo/nav background match, hero overlay + WCAG contrast, broken images, missing nav/footer/h1
- `scripts/classify-images.cjs` — **Stage 1d**: classifies every scraped image as `content | nav-button | banner | line | spacer | tracking | tiny | icon`. Writes `_class` tags inline on `manifest.pages[*].images[*]` AND `manifest.pages[*].backgroundImages[*]` and emits `image-classification.json` summary. **Required for the `portfolio-integrity` qa-check rule** — without classification, that rule no-ops and chrome can leak into portfolio sections. Added 2026-05-04 after the watkinsmonuments.com fabrication-grade error (nav buttons rendered as "actual monuments we have made"). **Phase H (2026-05-06)** extended the classifier to walk `backgroundImages[]` too with chrome-keyword + bytes-per-pixel heuristics — fix filed via lisastephenscpa.com (the customer's team photo was on every page as a CSS background and was missing from all 3 deploys because the classifier ignored backgrounds). See PORTFOLIO INTEGRITY RULE in SKILL.md.
- `scripts/inspect-splash.cjs` — **Stage 1e**: Playwright probe that classifies every video CTA URL into 4 preservation variants (A=direct MP4, B=HLS, C=third-party iframe, D=Hibu/Wix placeholder). Writes `_variant` tags on `manifest.pages[*].videoCta` + `manifest.pages[*].videos[*]` and emits `video-classification.json`. Silently no-ops on customers without videos. Added 2026-05-05 to replace the lossy "drop if not real" VIDEO CTA RULE with a richer policy that preserves the customer's actual videos. See VIDEO PRESERVATION RULE in SKILL.md. Modes: `--domain <domain>` (scan whole manifest) or `<url>` (ad-hoc single-URL classification).
- `scripts/transcode-video.cjs` — **Stage 1e companion**: ffmpeg wrapper that transcodes variant A/B sources to mobile-optimized H.264 MP4 (libx264 CRF 23, max 1280×720, AAC 128k mono, faststart). ffmpeg is a SOFT dependency — absent → script warns and exits 0, build degrades gracefully (falls back to `<a href>` link instead of inline `<video>`).
- `scripts/init-metrics.cjs` / `get-port.cjs` / `log-stage.cjs` / `finalize-metrics.cjs` / `manifest-query.cjs` / `record-deploy-url.cjs` / `smart-resume.cjs` — Pipeline helpers. `record-deploy-url.cjs` (added 2026-05-03) captures the URL printed by `vercel deploy --prebuilt --yes` into `metrics.optionX.url` so Stage 10c can read all three URLs from one place. `smart-resume.cjs` (added 2026-05-04 as Tier 1b of the context-optimization plan) inspects `jobs/{domain}/` for completed artifacts and prints a small JSON object naming the recommended resume point — replaces the previous inline shell probe so the orchestrator never reads manifests/dists/screenshots for resume detection. Run as `node scripts/smart-resume.cjs <domain>`. Possible `resumeFrom` values: `stage-1-scrape`, `stage-2-design-brief`, `stage-2.5-specs`, `stage-3-build-a`, `stage-5-build-b`, `stage-7-build-c`, `stage-8a-qa-gate`, `stage-9-verify`, `stage-10-report-and-register`, `pipeline-complete`.
- `scripts/register-with-store.mjs` — **Stage 10c**: posts deploy URLs + manifest metadata + 1280×800 fresh screenshots to `https://tomekgroup.com/wf/api/jobs/intake` so the new job appears in the WebFactory storefront DB. **Sends canonical project URLs (`https://{projectName}.vercel.app`)** derived from each option's `.vercel/project.json`, NOT deployment-specific URLs with hash + `-tomek-group` suffix — canonical URLs always serve the current production deployment, so storefront preview buttons / admin links survive any future re-deploy without a backfill (added 2026-05-04). Idempotent via `jobs/{domain}/store-registration.json` checkpoint. Soft-fails on missing API key / network error / API error — appends a curl-equivalent to `jobs/{domain}/feedback.md` and exits 0 so the pipeline still reports success. **Reads `WEBFACTORY_STORE_API_KEY` from 4 sources** (first non-empty wins): shell env > `~/WebFactory/.env.local` > `~/WebFactory/.env` > **`~/webfactory-store/.env.local`** (the sibling storefront repo's env). Tier 4 is the canonical setup — the same secret is needed on both sides, so storing it once in the storefront's env file means rotating it in production picks up here automatically (no copy/paste between repos).
- `lead-funnel/scripts/mark-rebuilt.js` — **Stage 10d**: marks the just-built domain as `rebuilt` in `lead-funnel/leads.db` so `queue-rebuilds.js` won't re-queue it. Soft-fails by design — if the domain isn't in the funnel (ad-hoc rebuild not sourced from `find-leads`), it logs and exits 0 without erroring. Wired into Stage 10's tail (added 2026-05-04) so funnel sync is automatic on every pipeline completion; previously this was a manual post-build step easy to forget at parallel-batch scale.
- `scripts/stitch-generate.js`, `scripts/stitch.sh`, `scripts/grab-heroes.js` — **Orphaned** (old Option B Stitch track retired). Kept for reference.
- `templates/scaffold/` — pure Astro 5 + Tailwind v4 scaffold (copied per-build, ZERO visual opinions). `templates/REQUIRED-PATTERNS.md` documents structural requirements every build must satisfy. `templates/inspiration/` is read-only references (saas-default, industrial-trades, more planned). Pivot from monolithic-template-copy to scaffold+inspiration architecture landed 2026-04-25 — see ROADMAP.md "Recently Shipped" + FEEDBACK.md.
- `skill-stages/` — per-stage canonical detail (`stage-1.md` through `stage-10.md`, ~1900 lines total). Extracted from SKILL.md 2026-05-04 as Tier 1a of the context-optimization plan so the orchestrator-facing SKILL.md (~2100 lines) can stay loaded as system context while sub-agents at Stage 3/4/5/7 dispatch only the stage file they need. Each stage file has a header pointing back to SKILL.md; sub-agent prompts include `Read /Users/tomasz/WebFactory/skill-stages/stage-N.md FIRST` so workers consume the stage detail directly. **`skill-stages/visual-sanity-pass.md`** (added 2026-05-04 as Tier 2 of the context-optimization plan) is the shared sub-agent spec for the visual passes at Stages 4c-bis, 6c, and 7h — Opus sub-agents loaded by those three dispatch sites read it for the 18-item checklist + JSON output schema (single source of truth, not duplicated per stage). Visual passes are sub-agent-delegated since 2026-05-04; the orchestrator no longer reads the 12–24 screenshots per pass directly. Stage 4c-tris (World-Class Audit, renamed from Dramatic Improvement Audit 2026-05-07) is dispatched as a SEPARATE Opus sub-agent (Phase D delegation 2026-05-05) with its own prompt template in `skill-stages/stage-4.md` — different references (Refero Design taxonomy at `~/.claude/skills/refero-design/` + inspiration library + Refero MCP industry top) and different verdict schema than the 18-item visual sanity pass. Architecturally separate so the two passes don't drift into each other.
- `jobs/{domain}/` — Per-job working directory (manifest, assets, design-brief, option-a, option-b, option-c)
- `SKILL.md` — Pipeline definition (also at `.claude/commands/webfactory.md`). Contains orchestrator-facing scaffolding (PIPELINE COMPLETION CONTRACT, decomposed-mode dispatch templates, ~17 architectural rules, Smart Resume) + 10 stage stubs that point at `skill-stages/stage-N.md`.
- `docs/option-a-process.md` — Detailed Option A build documentation
- **Plugin dependency (Option C only)**: `frontend-design@claude-plugins-official` installed via `claude plugin install` from terminal

## Tech Stack

- **Scraping**: Playwright (headless Chromium)
- **Option A**: Astro 5 + Tailwind v4. Worker-designed from scratch using `templates/scaffold/` + `templates/REQUIRED-PATTERNS.md` + `templates/inspiration/` library. **Does NOT use the Frontend Design plugin** — A is the worker-designed half of the A vs C comparison; preserving the comparison's value requires A to stay plugin-free.
- **Option B**: Astro 5 + Tailwind v4. Inherits A's design verbatim, only rewrites copy per the Stage 5 conversion-tuned rewrite rules. **Does NOT use the Frontend Design plugin** (no design changes happen in B).
- **Option C**: Astro 5 + Tailwind v4. **Plugin-driven design** via the `frontend-design@claude-plugins-official` plugin — invoked at BUILD time (Stage 7d) AND QA-critique time (Stage 7g). Uses B's text verbatim. Industry-anchored per `industry-tokens.json` (Stage 7b-bis). C is the plugin-designed half of the A vs C comparison.
- **Forms**: mailto: links (no backend)
- **Deploy**: Vercel CLI two-step — `vercel build --yes` (locally, produces `.vercel/output/`) then `vercel deploy --prebuilt --yes` (uploads the prebuilt artifact, zero build minutes consumed). Passing `./dist` to `vercel deploy --prebuilt` silently breaks `--prebuilt` and triggers a remote build machine — see SKILL.md Stage 8b.

## Key Rules

This is the executive summary. **The full rule definitions live in SKILL.md** — when there's a conflict between this list and SKILL.md, SKILL.md wins. Top-level architectural rules in SKILL.md are listed under their own headings (e.g., `#### FACT GROUNDING PRINCIPLE`, `#### TESTIMONIAL & REVIEW PRESERVATION`).

### Content integrity (preserve customer truth)

- **Option A** must preserve 100% of original text and 100% of original images. Faithful rebuild.
- **Option B** is the canonical text source for C. B has A's design + agency-rewritten + conversion-tuned copy (CTAs sharpened, value props reordered for impact). No new claims, no fabricated facts, no repositioning into a different industry. C reads B's `.astro` source files for text and renders that text verbatim in the plugin's design language — C NEVER rewrites copy independently.
- **CMS PLACEHOLDER PRINCIPLE**: the customer's original site is the input, not the truth. Sites built on Hibu/Wix/Squarespace/GoDaddy commonly contain template placeholder content (logos, lorem ipsum, "your video here" splashes). `scripts/detect-placeholders.cjs` runs after scrape; rules per element define the fallback (favicon for logo, drop CTA for video, omit page, etc.).
- **FACT GROUNDING PRINCIPLE**: every numeric/dated/credential/identity claim rendered on a built page MUST originate in the manifest OR follow logically from a manifest fact. No "20+ years" without a year in the source. qa-check fact-grounding rule enforces 8 claim families at deploy time.
- **TESTIMONIAL & REVIEW PRESERVATION**: reviews and testimonials are real people's words attributed to them by name. They MUST stay verbatim in B and C — no "tightening", no grammar fixes, no composite reviews. Reordering / selecting subset / layout changes = OK. Touching the words = forbidden. qa-check `testimonial-tampering` rule compares B's and C's testimonial text against A's `dist/` (passed via `--reference-dist`).
- **PORTFOLIO INTEGRITY RULE**: portfolio / catalog / "from our shop" / "actual work" sections may ONLY render images classified as `content` by `scripts/classify-images.cjs` (run at Stage 1d). Nav buttons, banner gradients, separator strips, spacer tiles, and other chrome are forbidden — rendering them as portfolio is fabrication. qa-check `portfolio-integrity` rule scans every dist/*.html for portfolio-vocab sections and fails on any non-content image. Real bug 2026-05-04 (watkinsmonuments.com — nav buttons captioned "actual monument we have made"). **Phase H (2026-05-06)** extended classification to `backgroundImages[]` too — Dreamweaver / GoDaddy / Wix / static-HTML legacy sites place hero / team photos as CSS backgrounds (no CMS image widget). Pre-Phase-H, every CSS-background photo was silently dropped because the classifier didn't tag them. Real bug filed via lisastephenscpa.com — the team photo was on every page but missing from all 3 deploys.
- **INVENTED BRAND GRAPHICS BAN**: the only valid brand mark is the customer's scraped logo OR the LOGO-RULE plain-text wordmark fallback. The builder MAY NOT inline-draw figurative SVG decoration that reads as a brand element (animal silhouettes, mascots, blobs, hand-drawn logo treatments). Abstract UI icons (arrows, plus, menu, chevrons, social glyphs) remain allowed per the ICON QUALITY RULE. qa-check `invented-brand-graphic` rule scans dist/*.html for inline `<svg><path>` complexity (>=300 chars in d= OR >=20 smooth-curve commands) inside `<header>` or near `.logo|.brand|.wordmark|.hero` and fails on hits. Real bug 2026-05-04 (richstaxidermy.com — hand-drawn deer-head silhouette next to wordmark).
- **REFERO REFERENCES (Phase E, 2026-05-05)**: Refero MCP server is installed and exposes `mcp__refero__refero_search_screens` / `_get_similar_screens` / `_get_screen_content` / `_search_flows` / `_get_flow` for semantic search of UI screens from real shipped products. Wired into THREE places ONLY: Stage 7d (Option C plugin invocation) for industry-anchored references, Stage 4c-tris (World-Class Audit) as Axis 3 of the audit's three world-class reference axes (post 2026-05-07 reshape — Axis 1 = design.md taxonomy, Axis 2 = inspiration library, Axis 3 = Refero industry top), and Stage 4c-bis / 6c / 7g visual-pass diversity check (item #18) replacing hardcoded peer-build PNGs. **NEVER used for Stage 2 brief on Option A or per-page renders** — Refero's dataset skews B2B SaaS / fintech / productivity, which would amplify the editorial-drift failure mode for small-business contractor customers. Refero-using stages MUST gracefully degrade if the MCP is absent (fall back to `templates/inspiration/` + peer-build PNGs). See REFERO REFERENCES rule in SKILL.md for the dataset-bias caveat + filtering guidance.
- **SELF-INSTRUMENTING SCRIPTS + PRE-DEPLOY GATE (Phase F, 2026-05-06)**: every helper script (`init-metrics.cjs`, `configure-model.cjs`, `smart-resume.cjs`, `classify-images.cjs`, `inspect-splash.cjs`, `validate-specs.cjs`, `validate-image-pool.cjs`, `validate-design-brief.cjs`, `validate-stage7-plugin.cjs`, `validate-visual-pass.cjs`, `record-deploy-url.cjs`, `finalize-metrics.cjs`, `register-with-store.mjs`) imports `scripts/_log-helper.cjs` and self-emits its log-decision event on success. The orchestrator can't skip what the script does itself. **`scripts/validate-pre-deploy.cjs`** runs at Stage 8a as MANDATORY chokepoint — reads `orchestration.log`, requires 9 specific pass-events (Stage 0/1d/2/2.5b/2.5c/4c-bis-A/6c-B/7d-plugin/7g-C), HARD-FAILS the deploy if any are missing. `--allow-missing-events` is the documented escape hatch. This was added 2026-05-06 after the idahoequinehospital end-to-end test exposed that the orchestrator silently skips QA stages and gates we ship don't actually run; structural enforcement at the deploy chokepoint is the fix.

### Three options, same content, different facets

- **Option C is a FULL WEBSITE** — same content depth and structure as A. Same nav, same pages, same portfolio photos, same testimonials, same certifications. Only the design language changes.
- **Option C MUST anchor its aesthetic to the customer's industry** (plumbing → industrial/trade; auto → garage; restaurant → food-led; medical → clinical-warm). NOT a generic editorial or magazine aesthetic. Stage 7b-bis derives `industry-tokens.json` BEFORE building (palette + typography + ornament per industry direction).
- **Option C MUST use scraped imagery aggressively** — hero backgrounds, service photos, team photos. Plugin's default bias toward typographic-only design is WRONG for trades customers.

### Design quality (operationalizes "suddenly expensive")

- **DESIGN QUALITY BAR**: 7-item bar every option must clear — display-quality typography (NOT system Inter/Arial as the only font), generous whitespace (≥96px desktop sections / ≥48px mobile), hero treatment beyond photo+headline, considered palette (3 primary + 2 accent with named roles), one distinctive element per page, one micro-interaction, the "$80k smell test" gut check. qa-check `design-quality-fonts` warns when no web font is loaded.
- **VISUAL SANITY PASSES (sub-agent-delegated since 2026-05-04)**: the 18-item Visual Sanity Pass on each option is run by an Opus sub-agent at Stages 4c-bis (A), 6c (B), and 7h-via-7g (C) — not inline in the orchestrator. Sub-agents return a ~400-token JSON verdict (`pass` / `fix` / `rebuild`) and the orchestrator branches on that without ever reading the screenshots itself. Tier 2 of the context-optimization plan; cuts main-session context per build from ~600–800K to ~200–300K. Model stays Opus (work moved off main, model unchanged). Shared spec lives in `skill-stages/visual-sanity-pass.md`.
- **WORLD-CLASS AUDIT (Stage 4c-tris, renamed 2026-05-07 from "Dramatic Improvement Audit")**: before A is accepted, an Opus sub-agent (Phase D delegation 2026-05-05) evaluates A against THREE world-class reference axes: (Axis 1) the **Refero Design taxonomy** at `~/.claude/skills/refero-design/SKILL.md` (4036 lines across SKILL.md + 9 references — `references/{anti-ai-slop, craft-details, typography, color, motion, copywriting, icons, mcp-tools, example-workflow}.md`) — this is **the design.md the user pays for via the Refero subscription**, the canonical world-class rubric. The `anti-ai-slop.md` reference alone catches the highest-frequency AI-design tells: indigo/violet defaults, cards-as-default-container, dark-mode-by-default, emoji-as-icons, decorative left-accent stripe, generic 3-column, perfect symmetry, hero-with-left-text-right-image. The four litmus tests (Card / Image / Brand / Identity) from the same reference are pass criteria. (Axis 2) the curated `templates/inspiration/` library of hand-built reference designs (industrial-trades-photo-led, saas-default, etc.) — A must look at home alongside. (Axis 3, optional) Refero industry-top via `mcp__refero__refero_search_screens` when industry-relevant. The audit articulates three world-class qualities A demonstrates (concrete + citable from the screenshots) plus ONE memorable signature move ("the one thing someone will remember"). Original-vs-A is preserved as CONTEXT only — the original is a 2009-era CMS-template floor, not the bar. If the audit can't find world-class qualities, A failed; rebuild. **Reshaped 2026-05-07** because the prior framing ("dramatically better than the original") measured the right axis but used the wrong bar — beating a 2009-era template is trivial. Google Labs' separate **DESIGN.md format spec** (https://github.com/google-labs-code/design.md) is mentioned in the audit as a forward-reference for project-level design system files; WebFactory does not emit a DESIGN.md per build today.
- **BRAND RECOGNIZABILITY (soft)**: aim to preserve ≥1 brand signature (primary brand color / typography vibe / hero composition / signature word). Override permitted when original is genuinely terrible — but worker MUST justify in `brand-preservation-note.md` rather than silently erase.

### Visual integrity (preserve readability)

- **MOBILE-FIRST DESIGN (all options)**: more than half of customer traffic is mobile. Design for 390×844 first, scale up. Touch targets ≥ 44×44px (WCAG 2.5.5). No horizontal overflow at mobile viewport. Body text ≥ 16px. Sticky bottom-CTA recommended for trades. qa-check runs at BOTH viewports (1440×900 desktop + 390×844 mobile) and reports `[both]` / `[desktop-only]` / `[mobile-only]` per issue.
- **LOGO RULE (all options)**: ALWAYS preserve original. `scripts/fix-logo.js` hunts for transparent/SVG variants, then detects whether the chosen logo is opaque + samples its background color. If opaque, the nav background MUST match the logo's sampled hex. NEVER substitute a wordmark, mark, icon, monogram, or invented graphic. Plain-text fallback to verbatim business name in page font if no usable logo.
- **FAVICON RULE (all options)**: scraper extracts favicon candidates from `<head>` and downloads the best to `assets/img/favicon.{ext}`. Build copies to `public/favicon.{ext}` and adds `<link rel="icon">`. If `manifest.favicon` is null, fall back to the logo. Never ship without a favicon link.
- **HERO CONTRAST RULE (all options)**: every hero with a photo background MUST use the three-layer pattern (image / overlay / text). qa-check fails if a heading sits on a `background-image` without a detectable overlay, OR if computed WCAG contrast ratio < 3:1 for large text.
- **TEXT CONTRAST (alpha-aware, all options)**: qa-check walks every visible text element and computes WCAG contrast vs effective background. **Now alpha-aware as of 2026-04-29**: composites foreground onto background using `color`-channel alpha × ancestor-`opacity` chain BEFORE measuring contrast. Parses `rgb`, `rgba`, `oklab`, AND `oklch` notations. Fails at < 4.5:1 body / < 3:1 large. Catches: white@30% on near-black (composites to ~rgb(45,45,45) — fails), Tailwind v4 oklch palette utilities (previously silently skipped), low-alpha wrappers like `style="opacity:0.4"` cascading to subtree. Real bug fixed: tomekgroup-website hero copy at 1.5:1 effective contrast that previously passed QA.
- **PER-CONTEXT CONTRAST VARIABLES (architectural)**: when an accent color renders on BOTH light and dark backgrounds, define explicit `--color-{name}-onlight` / `--color-{name}-ondark` pairs from the start. Single `--color-X` reused across two contexts always loses WCAG in one of them. See `PER-CONTEXT CONTRAST VARIABLES` rule in SKILL.md.
- **IMAGE RESOLUTION (all options)**: every visible content image > 200px wide must have natural width ≥ displayed width. qa-check fails if stretched, warns if soft on retina (< 1.5×).

### Social links + footer

- **SOCIAL LINKS RULE (all options)**: every social/business-listing link from `manifest.footer.social` (populated by scraper raw-HTML fallback for Duda/Wix/late-injecting widgets) MUST appear in the footer. **HARD RULE on href**: each link's href = full external URL from the manifest. NEVER `href="#"`, NEVER `href="/"`, NEVER point at customer's own site. **HARDER RULE**: if `manifest.footer.social` is empty, OMIT the social section entirely — do NOT render placeholder Facebook/Instagram with `href="#"`. Build markup MUST set `aria-label="{Platform}"` so QA can identify it. qa-check has a 5-path detector + structural failsafe (any icon-only anchor in `<footer>` with internal href fails the gate).
- **VIDEO CTA (all options)**: never fabricate a "Watch Video" button. Current rule: drop the CTA if the linked URL doesn't point to a real video. Splash inspection plan (4 variants) is staged — see SKILL.md if implementing.

### Image semantics

- **IMAGE REUSE (Option A)**: at least **90%** of must-reuse manifest images MUST appear in Option A's build. The customer's original site is a small-business website with photos of the work; A is the same kind of site, suddenly expensive — NOT a magazine layout. Service cards must each have a representative photo (text-only service cards are the failure mode). Add a portfolio / gallery / "Recent Work" section to absorb 6-12 photos at once. Editorial / typographic / file-tab / bracket-numbered design language belongs to **Option C**, not A. qa-check.js `image-reuse-A` rule fails the build if rendered images cover < 90% of the must-reuse pool. Real bug fixed 2026-04-29 (giffins.net + ifixplumbing — see `IMAGE REUSE RULE` in SKILL.md).
- **OPTION C IMAGE-QUALITY ESCAPE HATCH (C only)**: if customer photos are genuinely too poor to carry C's design language (resolution insufficient, heavy compression artifacts, blurry subject, missing-but-structurally-required slot), Option C may substitute thematically-appropriate **Unsplash / Pexels / curated-AI** stock — and ONLY C. A and B always use the customer's actual photos (faithful-rebuild contract). Substitutions must be (1) thematically tight to the customer's industry, (2) aesthetically compatible with C's industry-tokens direction, (3) genuinely high quality (no AI uncanny tells), and (4) documented in `jobs/{domain}/option-c/build-design-decisions.md`. Owner / crew / actual-logo are NEVER substituted — omit the section instead. See `OPTION C IMAGE-QUALITY ESCAPE HATCH` in SKILL.md.
- **MULTILINGUAL SUPPORT (Options B and C — added 2026-04-30, generalized 2026-04-30, default flipped to English-only 2026-04-30)**: Options B and C are **English-only by default**. Initial `/webfactory <url>` builds DO NOT generate `/es/`, `/de/`, etc. unless the user explicitly opts in. Two opt-in paths: (1) **at build time** via `--languages es,de,fr` (comma-separated list of ISO 639-1 codes — those languages build alongside English in B and C from the start); (2) **post-build** via `/webfactory <domain> --add-language <name|iso> --to <b|c|both>` (incremental — runs the AL1–AL6 mini-pipeline against an existing build). When languages are active, translation is done ONCE by the same Sonnet sub-agents that do the English rewrite (written to `option-b/src/pages/<lang>/*.astro`); Option C reads B's `/<lang>/` files — single source of truth. Supported codes: es, de, ru, it, fr, pt, pl, zh, ja, ko, nl, sv, plus any other ISO 639-1 with English-fallback tag. Option A is ALWAYS English-only (faithful rebuild contract — never translated, regardless of flags). Translate page text + image alt + meta + nav labels; KEEP UNCHANGED phone/email/license/place-names/business-names/customer-attribution-names. Per-language translation tag below testimonial attribution (es: `(traducido del inglés)`, de: `(aus dem Englischen übersetzt)`, ru: `(переведено с английского)`, it: `(tradotto dall'inglese)`, fr: `(traduit de l'anglais)`, full table in SKILL.md). Every `/<lang>/` page has `<html lang="<lang-code>">`. Nav switcher (only present when ≥1 non-English language active): toggle row when ≤3 active languages, dropdown when ≥4. qa-check rules `multilingual-page-parity`, `language-switcher-presence`, `html-lang-attribute`, extended `testimonial-tampering` are detection-driven — they silently no-op on English-only builds and fire automatically when `/<lang>/` paths are passed in the input list. CLI flag: `--reference-dist-i18n` (canonical) with `--reference-dist-es` as back-compat alias — only passed when a language is active. Cost: English-only baseline (no overhead). Per `--languages` code at build time: +20-30% per added language. Each `--add-language` invocation: ~150-250K Sonnet per affected option. See `MULTILINGUAL SUPPORT` in SKILL.md.
- **IMAGE-TO-PAGE MAPPING**: each page uses images from THAT page's manifest entry, not a generic image pool. Don't put residential photos on landscaping pages.
- **IMAGE DIVERSITY (within page)**: never use the same image multiple times in adjacent service cards. qa-check `duplicate-content-image` fails the build for any content image > 80×80px appearing 2+ times in the same page.
- **Visual consistency**: All cards within the same grid must use the same styling. One CTA-accent card per grid is OK; otherwise no mixed card sizes/styles within a section.
- **Download ALL images**: both `<img>` tags AND CSS background-image URLs.
- **Background images MUST be used as hero section backgrounds** (with overlay per HERO CONTRAST RULE).

### Pipeline / infrastructure

- **Primary domain only** (no subdomains).
- **Auto-deploy to Vercel** preview URLs, disable SSO protection after deploy. See "Vercel Teams Configuration" above.
- **Vercel deploy** uses two-step prebuilt flow (`vercel build --yes` then `vercel deploy --prebuilt --yes`, no path arg) per Tech Stack > Deploy. Passing `./dist` silently breaks `--prebuilt`.
- **`--skip-c` flag**: skip Option C entirely (Stage 7 + C deploy gate + C deploy + C verification + report becomes 3 links). Aliases: `--no-c`, `--ab-only`. See Usage section above.
- **Self-learning**: every piece of user feedback must update SKILL.md AND become a programmatic check in qa-check.js where possible. The two QA layers (deterministic + visual) co-evolve.

### Bans (must never do)

- **NUMBERED SECTION LABELS (Option A/B, all non-blog pages)**: bracket-numbered or slash-prefixed numeric eyebrows (`01 — WHAT WE DO`, `[ 02 ] · CATEGORY`, `01 / SERVICES`, `§ 01 · DIY RISK`, `SVC · 01`) are FORBIDDEN. Editorial / magazine affectation. Drop the number; keep the category label only. Allowed only in blog/article contexts where source content is genuinely an ordered list. qa-check `numbered-section-labels` rule fails non-blog pages with these patterns. Real bug fixed 2026-04-29 (giffins.net rebuild). See `NUMBERED SECTION LABELS RULE` in SKILL.md.
- **ORNAMENT BUDGET (per option)**: max 2-3 distinctive design devices per option. More than that = template tell. List them in the brief BEFORE building. See `DESIGN QUALITY BAR` #8 in SKILL.md.
- **TAILWIND V4 CASCADE TRAP**: bare element selectors in `global.css` (`h1, h2 { color: ... }`, `p { color: ... }`) MUST be wrapped in `@layer base { ... }`. Unlayered base styles silently beat utility classes regardless of specificity. qa-check `tailwind-cascade-trap` rule scans source. See `TAILWIND V4 CASCADE TRAP` in SKILL.md.
- **FOOTER `mt-*`**: never use `mt-{n}` margin-top class on a Footer wrapper — exposes a cream stripe between dark CtaBanner and dark Footer. Use internal `py-*` only. qa-check `footer-margin-top` rule scans Footer.astro. See `FOOTER-AFTER-DARK-CTABANNER` in SKILL.md.
- **CONTROL-PLANE DRIFT (Option C, B2B tech / SaaS / fintech)**: avoid stacking dashboardy ornaments — bracket numerals + status dots/pills + grid overlays + terminal cursors + spec callouts simultaneously read as "internal admin tool" not "sophisticated brand site." See `CONTROL-PLANE REFLEX` check in Stage 7 Visual Sanity Pass.
- **Material Symbols icons**: not all names exist. Invalid names render as ALL-CAPS text. Stick to verified names from the SKILL.md list. Completeness check catches broken icons.
- **NEVER** create `.claude/` directories inside `jobs/` subdirectories — triggers permission prompts.
- **NEVER** use `&&` or `||` shell operators in bash — triggers safety prompts. Use separate calls or `if/then/else/fi`.
- **NEVER use `preview_*` / `Chrome` MCP tools for AUTOMATED TESTING / QA** (`preview_start`, `preview_screenshot`, `mcp__Claude_in_Chrome__*`, `mcp__Control_Chrome__*`) — they show visible browser windows AND `preview_start` side-effect-creates `.claude/launch.json`. **Playwright itself is UNRESTRICTED** — use `scripts/qa.cjs` for the formal QA stages (consistent reporting) AND write ad-hoc Playwright scripts in `/tmp/*.mjs` for any iteration / debugging / single-component check at any pipeline stage. The ban is on visible-browser MCP tools FOR PIPELINE WORK, not on Playwright. **EXCEPTION (added 2026-04-29 per user clarification): when explicitly DEMONSTRATING something to the user (showing a result, side-by-side comparison, design preview), `preview_*` / `Claude_in_Chrome` / `Control_Chrome` ARE allowed and welcome.** The two contexts are: (a) "I'm testing my own work during the build" → Playwright only; (b) "the user asked me to show them something" → preview tools fine.
- **NEVER** use git worktrees inside `.claude/worktrees/` — they freeze stale SKILL.md copies. Parallel builds are isolated by domain (`jobs/{domain}/` + dynamic ports).
- **NEVER** edit skill files from a worker session (see Skill Lockdown above).
