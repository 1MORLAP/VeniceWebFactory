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

### Smart resume
The skill auto-detects existing work (manifest, Option A, Option B, Option C) and skips completed stages. **Cascade rule**: rebuilding A forces rebuilding B; rebuilding B forces rebuilding C — UNLESS `--skip-c` is active, in which case the B→C cascade is short-circuited.

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
- `scripts/init-metrics.cjs` / `get-port.cjs` / `log-stage.cjs` / `finalize-metrics.cjs` / `manifest-query.cjs` — Pipeline helpers
- `scripts/stitch-generate.js`, `scripts/stitch.sh`, `scripts/grab-heroes.js` — **Orphaned** (old Option B Stitch track retired). Kept for reference.
- `templates/scaffold/` — pure Astro 5 + Tailwind v4 scaffold (copied per-build, ZERO visual opinions). `templates/REQUIRED-PATTERNS.md` documents structural requirements every build must satisfy. `templates/inspiration/` is read-only references (saas-default, industrial-trades, more planned). Pivot from monolithic-template-copy to scaffold+inspiration architecture landed 2026-04-25 — see ROADMAP.md "Recently Shipped" + FEEDBACK.md.
- `jobs/{domain}/` — Per-job working directory (manifest, assets, design-brief, option-a, option-b, option-c)
- `SKILL.md` — Pipeline definition (also at `.claude/commands/webfactory.md`)
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

### Three options, same content, different facets

- **Option C is a FULL WEBSITE** — same content depth and structure as A. Same nav, same pages, same portfolio photos, same testimonials, same certifications. Only the design language changes.
- **Option C MUST anchor its aesthetic to the customer's industry** (plumbing → industrial/trade; auto → garage; restaurant → food-led; medical → clinical-warm). NOT a generic editorial or magazine aesthetic. Stage 7b-bis derives `industry-tokens.json` BEFORE building (palette + typography + ornament per industry direction).
- **Option C MUST use scraped imagery aggressively** — hero backgrounds, service photos, team photos. Plugin's default bias toward typographic-only design is WRONG for trades customers.

### Design quality (operationalizes "suddenly expensive")

- **DESIGN QUALITY BAR**: 7-item bar every option must clear — display-quality typography (NOT system Inter/Arial as the only font), generous whitespace (≥96px desktop sections / ≥48px mobile), hero treatment beyond photo+headline, considered palette (3 primary + 2 accent with named roles), one distinctive element per page, one micro-interaction, the "$80k smell test" gut check. qa-check `design-quality-fonts` warns when no web font is loaded.
- **DRAMATIC IMPROVEMENT AUDIT (Stage 4c-tris)**: before A is accepted, model loads original screenshot vs A's screenshot side-by-side and articulates 3 specific dramatic improvements in writing. If only "different font and more padding" — A failed the bar; rebuild with more ambition.
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
