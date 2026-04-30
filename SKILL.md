---
name: webfactory
description: Takes a website URL and builds three redesigned versions - a faithful rebuild (Option A), a conversion-tuned copy rewrite of A (Option B), and an industry-anchored plugin-driven design using B's text (Option C). Deploys all three to Vercel.
args: url
user_invocable: true
---

# WebFactory - Website Rebuilder

You are WebFactory, a website rebuilding tool. Given a URL, you scrape the site, analyze it, and build two gorgeous, modern websites deployed to Vercel.

## ⚠️ UNATTENDED MODE — READ THIS FIRST

This pipeline runs **UNATTENDED**. The user will NOT be present to approve prompts, answer questions, or click buttons. You MUST follow these rules absolutely:

1. **NEVER create `.claude/` directories or `launch.json`** inside `jobs/` subdirectories — triggers permission prompts. **This is most commonly violated by calling `preview_start` (which auto-creates `.claude/launch.json` as a side effect)**. If you see a popup about writing `.claude/launch.json`, you made a mistake — you are attempting `preview_start`. Stop, deny the popup, and start the dev server via Bash instead: `cd jobs/{domain}/option-a && npx astro dev --port $PORT_A &`
2. **NEVER use `&&` or `||`** in bash commands — triggers safety prompts. Use separate bash calls or `if/then/fi`
3. **NEVER use `preview_*` or `Chrome` MCP tools FOR PIPELINE WORK / AUTOMATED TESTING** (`preview_start`, `preview_screenshot`, `mcp__Claude_in_Chrome__*`, `mcp__Control_Chrome__*`, etc.) — they show visible browser windows AND `preview_start` creates `.claude/launch.json` inside your cwd, which is forbidden. Start dev servers via Bash, NEVER via `preview_start`. **EXCEPTION (added 2026-04-29 per user clarification): when the USER explicitly asks you to DEMONSTRATE / SHOW / PREVIEW something to them (a finished build, a side-by-side comparison, a design moment), `preview_*` / browser MCP tools are allowed and welcome.** The boundary: "I'm verifying my own work as part of the build" → Playwright only; "the user wants to see what I made" → preview tools are the right fit.

   **Playwright, however, is UNRESTRICTED.** Use it whenever you want to iterate — anywhere in the pipeline, not just during the formal QA stages. Two patterns are both fine:
   - **Formal QA stages (4 / 6 / 8a)** use `scripts/qa.cjs` for consistent screenshot output to `jobs/{domain}/qa-option-{a|b|c}/` — keeps the pipeline's QA reporting predictable.
   - **Ad-hoc iteration anywhere else** (Stage 3 build, debugging a single component, testing a hover state, checking how a font renders, etc.): write a one-off Playwright script in `/tmp/` and run it via `node /tmp/probe.mjs`. Spin up an Astro dev server first via Bash. Use `chromium.launch()` (not `chromium.launchPersistentContext`) so no visible window. Save screenshots wherever you want — `/tmp/probe-1.png` is fine; this is a debug aid, not a deliverable. Clean up the temp file when done.

   The prohibition is `preview_*` / `Chrome` MCP tools (visible browser, persistent launch.json). Playwright (any invocation) is fine because it's headless and stateless. Workers should reach for ad-hoc Playwright whenever a quick visual check would unblock them — don't wait for Stage 4 to discover something broke.
4. **NEVER ask the user questions mid-pipeline** — make decisions yourself based on this skill's instructions. The user typing `/webfactory <url>` is the ONLY input the pipeline gets; there is no "want me to continue?" check-in between stages. See "🏁 PIPELINE COMPLETION CONTRACT" below for the full rule + the most common stop-too-early patterns to avoid (especially relevant with smaller / cheaper / local models).
5. **NEVER improvise** — follow these stages EXACTLY. Do not create extra files, use extra tools, or add steps not specified here
6. **If something fails**, fix it and retry up to 3 times. Do not stop and ask.
7. **All bash commands** must be simple, single-purpose, and non-interactive

If you encounter an unexpected situation not covered by this skill, choose the safest path and continue. Never block waiting for user input.

## 🏁 PIPELINE COMPLETION CONTRACT — YOU ARE NOT DONE UNTIL ALL 10 STAGES SHIP

> **Most common failure mode by less capable models** (Qwen, Haiku, smaller open-source models): finish Stage 3 (Build A), see it succeeded, send a message like *"Build complete. Want me to start the dev server and inspect the pages?"* → STOP. The user has to manually say "yes, continue" → model does Stage 4 → stops again → repeat.
>
> **This is wrong. This skill runs UNATTENDED. The user gave you a URL — that single act IS authorization for the entire 10-stage pipeline. There is NO point at which you should ask "want me to continue?" until Stage 10 emits the 4 final URLs.**

### The 10 stages, in order:

```
1. Scrape & Extract        →  manifest.json + assets/screenshots/ + assets/img/
2. Analyze & Design Brief  →  design-brief.json
3. Build Option A          →  jobs/{domain}/option-a/{src,dist}
4. Visual QA Option A      →  qa-check passes + Visual Sanity Pass + Dramatic Improvement Audit
5. Build Option B          →  jobs/{domain}/option-b/{src,dist}
6. Visual QA Option B      →  qa-check passes + testimonial-tampering check
7. Build Option C          →  jobs/{domain}/option-c/{src,dist}  (skipped if --skip-c)
8a. QA Gate (all options)  →  qa-check at desktop+mobile for A, B, C
8b. Deploy                 →  vercel build + deploy → 3 (or 2) preview URLs
9. Verify                  →  WebFetch each URL + sanity check
10. Report                 →  emit 4 (or 3) clickable markdown autolinks + metrics table
```

### After every stage you complete: PROCEED IMMEDIATELY TO THE NEXT STAGE

- **You MUST NOT** end your response mid-pipeline with a question to the user
- **You MUST NOT** ask "want me to continue with Stage X?" — just continue
- **You MUST NOT** ask "should I start the dev server?" — start it, that's part of the next stage
- **You MUST NOT** ask "would you like to review first?" — the user will review the final 4-URL report; mid-pipeline review is not part of the contract
- **You MUST NOT** announce "Stage 3 complete, ready for Stage 4" and then stop. Announce it AND immediately start Stage 4 in the same response
- **You MAY** report progress in long stages (Stage 3 takes ~5min, fine to mention "scaffold copied, now generating pages") but the report is informational, not a hand-off to the user

### Common stop-too-early phrases — if you find yourself typing any of these MID-PIPELINE, you are wrong:

- "Build complete. Want me to start the dev server?" → **WRONG.** Just start it.
- "Option A is ready. Should I proceed to Stage 4?" → **WRONG.** Just proceed.
- "Ready for Stage 4 (Visual QA & polish). Want me to inspect the pages?" → **WRONG.** Inspect them.
- "Successfully built. Let me know if you want to continue with B and C." → **WRONG.** Continue with B and C.
- "Should I deploy now?" → **WRONG.** Deploy is Stage 8 — just deploy.
- ANY message that ends with "?" mid-pipeline → **WRONG.** Erase the question, do the work, continue.

### How to tell if you're done

The completion test (run this self-check before sending any response that includes "complete" or "done" or "ready"):

> **Did my most recent message contain 4 (or 3 with `--skip-c`) deployment URLs in `<https://...>` markdown autolink format, AND a metrics table?**
>
> If NO → you are not done. There is more pipeline to run. Resume from wherever you stopped — figure out which stage you completed last, then start the next stage. Do NOT send the response.
>
> If YES → you are done. Send the response.

### What to do if a stage genuinely fails (not "I want to ask permission")

- **Up to 3 retries**: fix the visible issue, retry the stage. If it works, continue.
- **After 3 retries on the same failure**: surface the error to the user with: which stage failed, what the error is, what you tried, and what you'd recommend the user does. THEN stop. (This is the only legitimate mid-pipeline stop.)
- **Network / auth / quota errors** (Vercel down, API key expired, etc.): retry once, then if still failing, surface the specific error and stop.

### Why this matters

Less capable models default to "ask before acting" because that feels safe. But unattended pipelines are the OPPOSITE — the user is NOT watching, the user is not coming back to type "yes, continue." They expect the URL → 4 deployed URLs round-trip without interaction. Asking "should I continue?" mid-pipeline turns a 30-minute unattended job into a 4-hour job that has to be babysat.

The completion contract above replaces the model's instinct to "check in" with explicit positive guidance: "the URL was the check-in. Now do all 10 stages." Stronger models (Opus, Sonnet 4.7+) follow UNATTENDED MODE bullet #4 ("NEVER ask the user questions") implicitly. Weaker models need this section spelled out.

## 🔒 SKILL LOCKDOWN — DO NOT MODIFY THE SKILL

**You are running the skill. You may NOT modify the skill itself.** This applies to every session invoked via `/webfactory <url>` or any session whose primary task is building a website. If you are reading this paragraph because the user typed `/webfactory`, the answer to "may I edit this file?" is NO.

**Read-only paths** (NEVER edit, write, or delete anything under these — even to "fix a bug" you find):
- `/Users/tomasz/WebFactory/SKILL.md` — this file
- `/Users/tomasz/WebFactory/CLAUDE.md` — project rules
- `/Users/tomasz/WebFactory/FEEDBACK.md` — the running log of structural fixes
- `/Users/tomasz/WebFactory/scripts/**` — every helper script (scrape.js, qa-check.js, fix-logo.js, init-metrics.cjs, etc.)
- `/Users/tomasz/WebFactory/templates/**` — the Astro starter template
- `/Users/tomasz/WebFactory/.claude/**` — skill metadata and commands
- `/Users/tomasz/WebFactory/ROADMAP.md` and any other top-level doc

**Editable paths** (free to write/modify):
- `/Users/tomasz/WebFactory/jobs/{domain}/**` — the per-job working directory and EVERYTHING under it (manifest, assets, design-brief, option-a, option-b, option-c, qa-* outputs, metrics, logs)
- `/Users/tomasz/WebFactory/jobs/{domain}/feedback.md` — the worker's flag file for the skill-owner session

**If you find a real bug in the skill** (a check that's wrong, a stage that fails repeatedly, a script that needs fixing, a rule that needs updating): DO NOT edit the skill in place. Instead:

1. Work around it locally for the current job (apply the fix to files inside `jobs/{domain}/`)
2. Append a structured note to `jobs/{domain}/feedback.md` describing the issue, root cause, and proposed fix
3. Print a copy-paste block at the end of your run (see Self-Learning Protocol below) so the user can hand it to the skill-owner session
4. Continue the build — do not stop

The skill-owner session is a separate session (one the user invokes manually with intent to evolve the skill, NOT a `/webfactory` build). The skill-owner is the only session allowed to edit SKILL.md, CLAUDE.md, FEEDBACK.md, scripts/, templates/, and .claude/.

**Why this matters**: parallel WebFactory builds may be running on different domains. If two worker sessions both try to "fix" SKILL.md based on what they each saw, you get races, conflicting edits, and lost lessons. Lockdown enforces serial evolution: workers FLAG, skill-owner FIXES.

## 🔀 EXECUTION MODE — Decomposed (default since 2026-04-29) vs Monolithic (escape hatch)

WebFactory supports two execution modes. **The default is "decomposed"** — the orchestrator (Opus) handles synthesis-heavy stages (scrape enrichment, design brief, per-page specs, shared scaffold, contrast lint, fix-loops, plugin invocation, deploy, report) and **dispatches per-page Sonnet sub-agents in parallel for the volume work** (Stage 3 Build A pages, Stage 5 Build B copy rewrite). Token cost on per-page work drops 60-80%; wall-clock drops via parallelism. Validated on 5 real customer builds across 5 CMS platforms and 5 industries (see Validation history below).

The escape hatch (`--monolithic` flag) reverts to the old single-orchestrator pipeline where Opus does everything. Use this only if decomposed mode hits an edge case — there's no current known reason to prefer monolithic over decomposed in production.

### When to use which mode

| Scenario | Mode |
|---|---|
| Default — any real customer build | Decomposed (no flag — this is now the default) |
| Skill development / debugging — when you want Opus to stay in every decision | `--monolithic` (escape hatch) |
| Less capable orchestrator (Sonnet, Haiku, local models) running the skill | NOT supported. Decomposed mode REQUIRES Opus (or comparable) orchestrator. Sub-agents can be cheaper, but the orchestrator must write per-page specs and review QA output critically. User confirmed (2026-04-28): "I can run SKILL under Opus, and then have Opus orchestrate sub tasks / agents." That's the supported configuration. |
| Backwards compat — existing `--decomposed` flag in a saved invocation | Still works — it's now a no-op alias (decomposed is default). |

### Decomposed mode pipeline overview

```
Stage 1   Scrape + WebFetch enrichment (deterministic + Opus when scraper misses CMS widgets)
Stage 2   Design brief (Opus only)
Stage 2.5 Per-page spec generation — Opus writes one self-contained .md per page into jobs/{domain}/specs/
Stage 2.6 Shared-component scaffold — Opus builds Nav + Footer + Hero + Section + brand tokens BEFORE per-page workers run
Stage 2.7 Shared-component contrast lint — Opus QA's its own scaffold for color-contrast bugs BEFORE workers consume it (prevents single-cause-bug-on-N-pages)
Stage 3   Build A — N Sonnet sub-agents IN PARALLEL, one per spec (each writes one .astro file)
Stage 4   QA A — npm build + qa-check.js. Fixes split: shared-component bugs → Opus (1 fix benefits all pages); per-page bugs → Sonnet sub-agents in parallel
Stage 5   Build B copy rewrite — N Sonnet sub-agents IN PARALLEL, each receives A's page + rewrite directives + uses the `Edit` tool (NOT Write) for targeted text-only changes
Stage 6   QA B — same pattern as Stage 4
Stage 7   Build C — Opus invokes Frontend Design plugin (synthesis + plugin output, NOT decomposable)
Stage 8a  QA Gate — same as single-orchestrator
Stage 8b  Deploy — same Vercel prebuilt flow
Stage 8c  Disable SSO via API
Stage 9-10 Verify + report — same as single-orchestrator
```

The orchestrator (Opus) does Stages 1, 2, 2.5, 2.6, 2.7, 7, and the Stage 4/6 fix-loops. Sonnet sub-agents do Stages 3 and 5 (the page-volume work).

### Stage 2.5: Per-page spec generation

After Stage 2 (design brief), Opus writes one spec per page into `jobs/{domain}/specs/`. Each spec is **fully self-contained** — a Sonnet sub-agent given just `_shared.md` + `<page>.md` should produce a clean, structurally-correct page without needing to read other files.

Required structure for each `<page>.md`:

```markdown
# Spec — <PageName> (<filename>.astro)

**FIRST: read `_shared.md`** [+ optionally `_<type>-template.md`]

## Output
Write to: <absolute path to .astro file>

## Page metadata
- title: <verbatim title tag>
- description: <verbatim meta description>
- active: <slug for nav highlight>

## Hero or PageHeader (props as a list)
- prop1: <value>
- ...

## Section idx="02" label="..." title="..." bg="..."
- intro: <verbatim text>
- Inside: <description of layout + verbatim content bullets/paragraphs/lists>
[ ... additional sections ... ]

## CtaBanner (or other closing element)
- prop: <value>

## Required-page-level facts (must appear verbatim)
- fact 1
- fact 2

## What NOT to add
- explicit prohibitions to prevent fabricated content
```

**`_shared.md`** in the same directory captures cross-page concerns: component prop signatures, design tokens, hard rules (no `\uXXXX`, no `&#NNN;` in JSX, etc.), and aesthetic anchor (1 paragraph). Every per-page spec references it.

**`_<type>-template.md`** files (e.g., `_service-template.md`) capture repeating structural patterns across multiple pages. Validated 2026-04-28: 8 service pages can share one template, with each page-spec adding only its specific content (~30-50 lines per page-spec instead of 80+).

**Spec quality is the upstream cause of build quality.** A weak spec produces a weak Sonnet output. Treat spec generation as the most important Opus step. Iterate on a spec before dispatching workers, especially for the home page.

**Hard rule learned 2026-04-28 (accelwindows experiment)**: when a spec describes a colored container ("dark variant card with `color: bone-50`"), it MUST also explicitly state that nested `<h*>` headings need their own color override. Workers can drop the cascade when adding `font-semibold` etc. via Tailwind classes. Add this to `_shared.md` for every decomposed-mode build.

#### Stage 2.5b: Auto-spec-validation (MANDATORY — added after plumbers build 2026-04-29)

Before dispatching workers in Stage 3, run `scripts/validate-specs.cjs` to catch fact-grounding bugs that the spec author (Opus) may have introduced into the per-page specs.

**Why it exists**: real bug 2026-04-29 (twoirishplumbers build). I (Opus) seeded "Free estimates" into 4 separate per-page specs as a CTA closer. The customer's manifest does NOT claim free estimates — that was my fabrication. 5 Sonnet workers faithfully copied. Stage 4 QA caught it on every page (4 fact-grounding fails). 4× the fix work it should have been.

The fix: catch unsupported claims at Stage 2.5 (1 author, 1 work session) instead of Stage 4 (N workers × N pages of fail messages). Linear cost reduction with N pages.

**Run**:

```bash
node scripts/validate-specs.cjs \
  --manifest jobs/{domain}/manifest.json \
  --design-brief jobs/{domain}/design-brief.json \
  --specs jobs/{domain}/specs/
```

**What it checks**: every per-page spec is scanned for fact-shaped claims (years experience, since-year, BBB / awards / star ratings / licensed-bonded / X-owned / review counts / 24-7 / free estimates) using the same regex patterns as `scripts/qa-check.js` fact-grounding rule. Each match is verified against the manifest + design-brief corpus. Unsupported claims fail the script (exit 1) with file + line number.

**What it skips correctly**: prohibition sections (e.g. `## What NOT to add` listing negative examples) are NOT validated — those are the spec author teaching the worker what NOT to write. Lines starting with "Do NOT" / "Don't" / "Never" / "Avoid" are also skipped.

**What to do when it fails**:

1. For each unsupported claim, decide:
   - **Drop the claim from the spec** — most common case (the spec author got carried away). Edit the spec, remove the phrase.
   - **Add the claim to the manifest** — the customer DOES say it on their actual site, but my scrape missed it. Add the verbatim phrase to `manifest.business` or wherever appropriate, then re-run validate-specs.
   - **Add the claim to the design-brief** — only if the brief is the right place (e.g. a value-prop callout). Edit `design-brief.json`.
2. Re-run `validate-specs.cjs` until exit 0.
3. THEN dispatch workers.

**Validated regression** (2026-04-29):
- Plumbers (twoirishplumbers): correctly catches all 4 "Free estimates" instances across 4 specs.
- Bwlocksmith: caught a real spec drift (manifest says "35 years", spec said "30+ years") — minor understatement, but the same class of bug.
- Giffins, Construction, Accelwindows-decomp: pass cleanly (no false positives).

This step is NOT optional in decomposed mode. Specs that fail validate-specs.cjs MUST NOT be dispatched to workers.

### Stage 2.6: Shared-component scaffold

Before per-page workers run, Opus builds the shared component layer that all pages will import:

- BaseLayout (document chrome, slots for nav/footer/font-loading/extra head)
- SiteLayout / equivalent wrapper (BaseLayout + Nav + Footer + main slot)
- Nav (with `active` prop, mobile hamburger if needed, sticky-on-scroll if appropriate)
- Footer (social, contact, hours, sub-nav)
- Hero (full hero) and PageHeader (lighter interior hero) — one or both per design brief
- Section (wrapper with bg variants, takes idx/label/title/intro props)
- ServiceCard / Testimonial / CtaBanner / StatStrip — per design brief's distinctive-elements list
- `src/styles/global.css` extended with brand tokens (palette, fonts, animation primitives)
- `src/data/site.ts` with shared data (services, reviews, service areas, business facts) when the build has repeated content

**The component layer is shared infrastructure** — workers consume it, never modify it. Per-page workers import these components and pass props.

### Stage 2.7: Shared-component contrast lint (added after experiment #1)

Real bug bwlocksmith.com 2026-04-28: the `.eyebrow` class used the brass color (#C8A24A) on bone backgrounds, which fails WCAG 4.5:1. **The workers built correctly per their specs — the shared component had the bug.** Result: 20+ failures across 4 pages in Stage 4 QA, all from one shared-component flaw.

Before dispatching workers, Opus must lint its own scaffold:

- For each shared CSS class with a color value, compute WCAG contrast against EACH possible parent-bg variant (bone / cream / steel / white / ink). If any combination fails 4.5:1 for body or 3:1 for large text, fix the class BEFORE workers consume it.
- Build a smoke-test page that exercises every shared component on every bg variant, run qa-check.js against it. If smoke-test passes, dispatch workers; if it fails, fix the scaffold first.

This shifts the QA cost from "Stage 4 cleanup × N pages" to "one upfront lint pass." For an N-page build the savings is N×.

### Stage 3 (decomposed): Spawn N Sonnet sub-agents in parallel

For each spec in `jobs/{domain}/specs/`, spawn a Sonnet sub-agent via the `Agent` tool with `model: "sonnet"`. The prompt template:

```
Per-page builder for WebFactory decomposed pipeline. Build ONE Astro page from a fully-specified spec.

1. Read jobs/{domain}/specs/_shared.md (design tokens, components, hard rules)
2. [Optional] Read jobs/{domain}/specs/_<type>-template.md (shared template if applicable)
3. Read jobs/{domain}/specs/<page>.md (your page-specific spec)
4. Write the resulting .astro file to the path specified in the page spec.

Do NOT explore the file tree. Do NOT read other pages. The spec files are self-contained.
After Write succeeds, report under 30 words: file path + line count + any spec rule you couldn't follow.
Only tools: Read (2-3 spec files) + Write (1 output file).
```

Spawn all N agents in a SINGLE message with multiple Agent tool uses (parallel execution). Wall-clock for the whole batch is dominated by the slowest single page-build (~50-65 sec) regardless of N.

When all N complete, run `npm run build` from the option directory. If any page fails to compile, dispatch a fix-up sub-agent with the specific compilation error.

### Stage 4 fix-loop split (decomposed)

When Stage 4 qa-check finds failures, classify them:

- **Shared-component bugs** (failure pattern repeats identically across multiple pages, OR is in a shared file like `global.css`, Nav, Footer, Hero, etc.) → **Opus fixes**. One edit benefits all pages.
- **Per-page bugs** (one page only, OR pattern is page-specific like image-low-resolution on a particular `<img>` tag) → **Sonnet sub-agents in parallel** (one per affected page). Each sub-agent reads the qa-check output for its page + the page file + makes targeted Edits.

After fixes, rebuild + re-run qa-check. Iterate until 0 failures.

### Stage 5 (decomposed): Spawn N Sonnet rewriters in parallel

For each `option-b/src/pages/<page>.astro` file (already a fresh copy of option-a — copy A→B FIRST), spawn a Sonnet sub-agent. Each receives:

1. The shared rewrite directives at `jobs/{domain}/specs/_rewrite-shared.md` (preservation rules — touch only TEXT, not structure/classes/imports/components/hrefs/phone/address/email/form-action; sharpen CTAs; lead with action; no fabricated claims; preserve testimonials verbatim).
2. The path to its specific page (`option-b/src/pages/<page>.astro`).
3. Page-specific rewrite directives (which sections to sharpen, what NOT to touch).

Worker uses the `Edit` tool (NOT `Write`) to make targeted text-only changes. **Edit-based rewriting tightens control vs. Write-based rebuilding** (which can drift into design changes). Validated 2026-04-28: 4 Sonnet rewriters preserved A's design markup verbatim while sharpening copy in 9-12 Edits per page.

### Architectural constraints — what STAYS Opus-only

- Stage 1 manifest enrichment when scraper misses CMS-widget content (WebFetch reasoning).
- Stage 2 design brief.
- Stage 2.5 spec generation (the spec quality determines all downstream worker quality).
- Stage 2.6 shared scaffold construction.
- Stage 2.7 contrast lint.
- Stage 4/6 shared-component fix-loops.
- Stage 7 (Build C) — plugin orchestration.
- Stage 4c-bis Visual Sanity Pass (vision capability + design taste).
- Stage 4c-tris Dramatic Improvement Audit (vision capability + critical comparison).
- Stage 10 final report.

### Cost projection (rough, 6-page small-business site, **English-only baseline since 2026-04-30**; per-language additions itemized separately)

| Stage | Single-orchestrator | Decomposed |
|---|---|---|
| 1 — Scrape | deterministic | deterministic |
| 2 — Brief | Opus | Opus |
| 2.5 — Specs + scaffold + lint | (was implicit in Stage 3) | Opus (~50K tokens) |
| 3 — Build A (English-only — always) | Opus × 6 ≈ 250K Opus | 6× Sonnet @25-30K ≈ 165K Sonnet |
| 4 — QA fix A | Opus | mostly Opus (shared) + occasional Sonnet (per-page) |
| 5 — Build B (EN rewrite only) | Opus × 6 ≈ 350K Opus | 6× Sonnet @25-30K ≈ 175K Sonnet |
| 6 — QA B (English) | Opus | mostly Opus + occasional Sonnet |
| 7 — Build C (6 EN pages, plugin-driven) | Opus ~80-120K | Opus invocation + 6× Sonnet workers @25-30K ≈ 60K Opus + 175K Sonnet |
| 8-10 — Deploy/verify/report | Opus | Opus |

At Opus:Sonnet ≈ 5:1 rate ratio: per-build cost drops ~50-65% overall via decomposition. The smaller the site, the less the savings from decomposition; the larger the site, the more the savings.

**With `--languages <list>` (per added language code)**: Stage 5 grows ~+25-35K Sonnet per page per language; Stage 7 grows similarly. Per-build cost: roughly +20-30% per language code. So `--languages es` ≈ +25%; `--languages es,de` ≈ +50%; `--languages es,de,fr` ≈ +75%. (Baseline `/webfactory <url>` with no `--languages` is the table above.)

**With `--add-language <code> --to <b|c|both>` (post-build, per invocation)**: ~150-250K Sonnet + ~40K Opus per affected option, regardless of original baseline. Runs the AL1-AL6 mini-pipeline and redeploys.

### Decomposed mode is the DEFAULT (since 2026-04-29)

`/webfactory <url>` runs decomposed mode by default. The `--decomposed` flag is now a no-op alias (kept for backwards compatibility with saved invocations).

```
/webfactory https://example.com               # decomposed (default)
/webfactory https://example.com --decomposed   # same as above (no-op flag)
/webfactory https://example.com --skip-c       # decomposed + skip C
```

Use `--monolithic` only as an escape hatch if decomposed mode hits an edge case:

```
/webfactory https://example.com --monolithic   # old single-orchestrator pipeline (escape hatch)
```

Combine freely with other flags: `--full`, `--option-b`, `--skip-c`, etc.

### Validation history

- **2026-04-28 — Experiment #1: bwlocksmith.com (4 pages)**. Full pipeline end-to-end including deploy. 0 QA failures after Opus fix-loop. ~7 min wall-clock total. ~225K Sonnet tokens vs estimated ~500K Opus all-in. **PASSED.** See FEEDBACK.md for detail.
- **2026-04-28 — Experiment #2: accelwindows.com (5 of 13 pages)**. Stage 3 only (Build A from scratch on a fresh forked option-a-decomp/, components preserved from Opus baseline). 5 Sonnet workers in parallel, 5/5 compiled clean. 2 per-page styling fails (1 amber-on-cream link, 1 unstyled h3 on dark card) — both 1-Edit fixes. Fact preservation identical to Opus baseline. Line count Δ +0 to +13 (Sonnet slightly more verbose). **PASSED.** See FEEDBACK.md for detail.
- **2026-04-29 — Experiment #3: giffins.net (6 pages — tree service + property mgmt + blog + long-form article)**. Full pipeline end-to-end including deploy, with Stage 2.7 contrast lint inserted BEFORE worker dispatch. Stage 2.7 caught 16 scaffold bugs upfront (eyebrow color, btn-rust contrast, sage-on-cream muted text). After 2 lint iterations, **Stage 4 QA on 6 worker-built pages had 0 failures on first run** (vs 29 fails first-run on bwlocksmith without Stage 2.7). Stage 6 QA on B (post-rewrite) also 0 fails + testimonial-tampering check clean. Both deploys 200 after `vercel project protection disable --sso` (the SSO disable section was updated this run — API alone insufficient). **PASSED. Strongest result yet.** Content-variety test passed: blog index + long-form article rendered correctly. See FEEDBACK.md for detail.
- **2026-04-29 — Customer build #4: twoirishplumbers.squarespace.com (5 pages — Squarespace, plumbing trade with brand-pun voice)**. Full pipeline end-to-end. Stage 2.7 caught 16 scaffold contrast bugs (1 iteration). Stage 4 QA on 5 worker-built pages had 35 first-run fails but ALL 35 were 3 single-cause classes: (1) emerald-bright color failed 4.43:1 by 0.07 — single CSS edit; (2) workers added "Free estimates" not in manifest — single sed across 5 pages; (3) workers used non-existent image filenames (hero-about.jpg, hero-contact.jpg) — single sed. Lesson: even with Stage 2.7, ALL workers can introduce identical fact-grounding fabrications if the spec author (Opus) seeded the wrong claim into multiple per-page specs. **PASSED. Both A+B deployed 200, all facts preserved (12-14 phone refs each, brand-pun "Don't Flush Your Luck Away" intact).**
- **2026-04-29 — Customer build #5: apachecostructionllc.wixsite.com (1 page — Wix single-page contractor site)**. Full pipeline end-to-end on a single-page site (rare). Stage 2.7 SKIPPED (reused contrast tokens from giffins.net + plumbers). Stage 4 QA had 4 fails: cedar-on-cedar contrast in contact section (single SectionLabel onDark fix), img_2 used twice (hero + gallery), img_2 too small at 345px wide. **All 4 fails fixed in 2 sed commands** (remove hero bg image since manifest images are too small for 1440px hero; flip contact section bg from cedar to charcoal). PASSED. Both A+B deployed 200, all facts preserved (license # APACHCL820KQ rendered 4-5×, all 4 cities present, both phone numbers present). Smallest scope yet — proves the architecture works at the small-scale extreme.
- **2026-04-29 — DECISION: `--decomposed` PROMOTED TO DEFAULT.** 5 successful real customer builds across 5 different CMS platforms (Duda, Wix, Squarespace) and 5 different industries (locksmith, contractor, tree service, plumber, construction). Architecture validated. Going forward, `/webfactory <url>` runs decomposed mode by default. The `--decomposed` flag is kept as a no-op alias for backwards compatibility but is no longer required. A new `--monolithic` flag can be passed to revert to the old single-orchestrator pipeline (kept as an escape hatch in case decomposed mode hits an edge case I haven't seen).
- **2026-04-29 — Tooling: `scripts/validate-specs.cjs` added (commit cb6cee3).** Pre-dispatch fact-grounding lint. Catches Stage 2.5 bugs where Opus seeded unsupported claims (like "Free estimates") into multiple per-page specs that workers would faithfully copy. Same regex patterns as `scripts/qa-check.js` fact-grounding rule, applied to spec markdown. Now mandatory between Stage 2.5 and Stage 3 in decomposed mode. Regression-validated against all 5 customer builds.
- **2026-04-29 — C-track decomposition validated (libertylandscapefl.com).** Forked `option-c/` → `option-c-decomp/`, wiped pages, preserved plugin-output components + tokens + global.css. Wrote 4 per-page specs referencing those components + B's text. validate-specs.cjs passed clean. Spawned 4 Sonnet sub-agents in parallel — all 4 compiled. Stage 4 QA: **0 first-run failures.** Hero headlines byte-identical to Opus C baseline (4/4 verbatim). Phone-count + license-# count identical to Opus baseline. Line-count Δ +2 to +99 (Sonnet slightly more verbose, especially on contact). **Plugin design coherence preserved BECAUSE workers consume plugin-output components — they don't re-design.** Decomposed-C is now default in `--decomposed` mode (which is itself the default). Stage 7d documentation updated with the new flow. **All 3 tracks (A, B, C) now decompose cleanly.**

## 🧠 Self-Learning Protocol (MANDATORY)

This skill improves itself over time. Every piece of user feedback becomes a permanent rule so future runs don't repeat the same mistakes.

### Worker vs skill-owner roles (see SKILL LOCKDOWN above)

The lockdown rule at the top of this file establishes WHO can edit the skill. Quick recap:
- **Worker session** = any session running `/webfactory <url>`. **May not edit SKILL.md, CLAUDE.md, FEEDBACK.md, scripts/, templates/, or .claude/.** May only write to `jobs/{domain}/**`.
- **Skill-owner session** = a separate session the user invokes for skill maintenance (no `/webfactory` build active). The only session allowed to evolve the skill.

The protocol below describes what each role does when feedback arrives.

### When a WORKER session receives feedback

The moment the user says "this looks off", "fix X", "don't do Y", or any critique — BEFORE doing anything else, you MUST:

1. **Extract the lesson** — What went wrong? What's the root cause? What generic rule prevents this in future runs?

2. **Write to `jobs/{domain}/feedback.md`** — Append an entry so the skill-owner can process it later:

   ```markdown
   ## {ISO timestamp}
   **Feedback**: {exact user quote}
   **Root cause**: {why this happened}
   **Proposed SKILL.md change**: {specific rule text to add}
   **Section**: {Stage 3b | Stage 5d | Stage 5h | Important Notes | etc.}
   ```

3. **Print a copy-paste block** for the user to bring to the skill-owner session:

   ```
   ═══════════════════════════════════════════════════════════
   📋 COPY THIS BLOCK → PASTE INTO SKILL-OWNER SESSION
   ───────────────────────────────────────────────────────────
   /webfactory-learn

   DOMAIN: {domain}
   FEEDBACK: {exact user quote}
   ROOT CAUSE: {why this happened}
   PROPOSED RULE: {specific text to add}
   SECTION: {where in SKILL.md}
   ═══════════════════════════════════════════════════════════
   ```

4. **Fix this run's website only** — Apply the fix to files under `jobs/{domain}/option-a/`, `jobs/{domain}/option-b/`, or `jobs/{domain}/option-c/`. NEVER touch SKILL.md, FEEDBACK.md, scripts/, templates/, or .claude/.

5. **Remind the user** to paste the block into the skill-owner session so the lesson becomes permanent.

#### Feedback quality matters — the libertylandscapefl gold standard

Worker feedback is the engine that improves the skill over time. A vague flag (`"qa-check broke"`) buys nothing. A precise flag (file + line + root cause + proposed fix + workaround) buys an immediate structural improvement. Aim for the second.

**Worked example — gold standard worker feedback (filed 2026-04-25 on libertylandscapefl.com)**:

```
DOMAIN: libertylandscapefl.com
FEEDBACK: qa-check testimonial-tampering reports false positives when blockquote
text contains apostrophes. Reference HTML stores &#39;, live page extracts ',
normalizer strips entities to space → mismatch.
ROOT CAUSE: normalizeQuoteText() in scripts/qa-check.js does
.replace(/&[a-z]+;|&#\d+;/gi, ' ') — strips entities to a space rather than
decoding them.
PROPOSED RULE: In normalizeQuoteText(), decode common entities (&#39; → ',
&quot; → ", &amp; → &, &ldquo;/&rdquo; → ", &lsquo;/&rsquo; → ',
&ndash;/&mdash; → -, &nbsp; → ' ') BEFORE the catch-all entity-strip — and
change the catch-all to strip to nothing instead of space.
SECTION: scripts/qa-check.js, function normalizeQuoteText around line 109

Notes for the skill-owner: Worker workaround: replaced <blockquote> with <p>
in the PullQuote component (semantic argument is also valid — the brand
tagline isn't a quote from a named third party).
```

What makes this feedback gold standard:

1. **Symptom is specific**: not "qa-check broke" — it names the rule (`testimonial-tampering`), the trigger (apostrophes in blockquote text), AND the mechanism (reference encoding ≠ live encoding causing post-normalization mismatch).
2. **Root cause is line-cited**: `scripts/qa-check.js`, function name, around line 109. Skill-owner can jump straight to the code.
3. **Proposed rule is concrete**: doesn't say "fix entity handling" — says EXACTLY which entities, EXACTLY what to decode them to, AND describes the algorithmic change (decode-list before catch-all, change catch-all from space to nothing).
4. **Acknowledges the workaround**: `<blockquote>` → `<p>` is a valid local fix AND a defensible semantic argument. Skill-owner now knows the worker thought through both layers.
5. **Section pointer**: "scripts/qa-check.js, function normalizeQuoteText around line 109" — narrows the search to ~20 lines.

What WEAK feedback looks like (avoid this):

```
DOMAIN: libertylandscapefl.com
FEEDBACK: testimonial check is broken — keeps failing
ROOT CAUSE: probably encoding issue
PROPOSED RULE: fix the entity handling
SECTION: qa-check.js
```

Same problem class, but the skill-owner has to re-derive everything: which check, which entities, which function, which line. Fixing this from a weak flag takes 10× longer than fixing it from a gold-standard flag — and runs the risk of fixing the wrong thing.

**Aim for gold standard.** Read the code you're flagging if you can. Cite the function name and rough line number. Propose a concrete change, not a vague intent. Note workarounds you applied locally. Skill quality compounds with feedback quality.

### When the SKILL-OWNER session receives feedback (or a pasted block)

You are the skill-owner if: you are NOT running `/webfactory` for a specific URL, OR the user pastes a `/webfactory-learn` block, OR the user says "update the skill" / "you are the skill owner".

As skill-owner you can edit SKILL.md directly:

1. Parse the feedback (from paste-block or direct conversation)
2. Update SKILL.md in the relevant section with the new rule
3. Append a dated entry to FEEDBACK.md:

   ```markdown
   ## YYYY-MM-DD — {domain}
   **Feedback**: {quote}
   **Root cause**: {why}
   **SKILL.md change**: {what rule/section was updated}
   **Source**: {worker paste-block | direct feedback | batched from jobs/*/feedback.md}
   ```

4. Confirm to the user what was added and where.

5. **Commit + push to GitHub** (mandatory — see "Auto-backup contract" below). Skill-owner work that doesn't reach `origin/main` doesn't count as shipped — laptop loss / disk failure / accidental rm would erase it. The `/webfactory-learn` flow ENDS with the commit + push step, not with the FEEDBACK.md entry.

### 🔄 Auto-backup contract — every `/webfactory-learn` ends with `git push`

**Rule**: every skill-owner action that ships a structural change (edit to SKILL.md, scripts/, templates/, REQUIRED-PATTERNS.md, FEEDBACK.md, CLAUDE.md, ROADMAP.md, or anything else outside `jobs/`) MUST end with a `git commit && git push origin main`. No exceptions.

Why this is a hard rule (not a soft suggestion):
- Before this rule existed, the skill went 11 days (2026-04-15 → 2026-04-26) with no commits despite ~16 shipped FEEDBACK.md entries. ~94 files of work sat uncommitted. A laptop failure during that window would have erased most of the skill's evolution.
- "I'll commit later" never happens reliably. The discipline lives at the moment of shipping or it doesn't live.
- The cost of one extra commit + push per `/webfactory-learn` is ~5 seconds. The cost of losing 11 days of architectural work is catastrophic.

**The protocol** (run at the END of every `/webfactory-learn` flow, after step 4 above):

```bash
cd /Users/tomasz/WebFactory

# Untrack per-user files if they snuck in (defensive — .claude/settings.local.json
# is per-machine and shouldn't be in git per Claude Code convention)
git rm --cached .claude/settings.local.json 2>/dev/null || true

# Stage everything sensible (.gitignore handles jobs/, node_modules/, dist/,
# .vercel/, orphan dirs, etc.)
git add -A

# Final sanity check — bail out loudly if jobs/ or huge binaries somehow
# slipped past .gitignore (would mean .gitignore is broken)
LARGE_STAGED=$(git diff --cached --name-only | grep -E "^jobs/|node_modules/|\.png$|\.jpg$|\.mp4$" | head -3)
if [ -n "$LARGE_STAGED" ]; then
  echo "✗ ABORT: large/binary files staged that should be gitignored:"
  echo "$LARGE_STAGED"
  echo "Fix .gitignore before retrying."
  exit 1
fi

# Commit with a message naming the structural change just shipped
git commit -m "$(cat <<MSG
{one-line summary of what shipped}

{2-3 lines of context: which feedback drove this, what the structural fix was,
what files changed. Reference the matching FEEDBACK.md entry's date + heading
so the commit and the feedback log cross-reference cleanly.}

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
MSG
)"

# Push to origin so the work is backed up to GitHub
git push origin main
```

**The commit message contract**:
- **Subject line**: imperative-present-tense, ≤ 72 chars, names the structural change (e.g., `Add testimonial-tampering check + entity decoder` not `Update qa-check.js`)
- **Body**: which user feedback drove this (quote or paraphrase), what changed structurally (one-line summary per file), reference to the FEEDBACK.md entry date + heading so the two narratives stay in sync
- **Co-Authored-By footer**: keeps attribution consistent

**Failure modes to avoid**:
- Committing `jobs/` content (huge — 9GB+ of customer screenshots / built sites). The `.gitignore` blocks this; the sanity check above is a second-line defense if .gitignore breaks.
- Committing `.claude/settings.local.json` (per-user permissions, MCP server configs with potentially sensitive args). Untrack with `git rm --cached` if it's already in git history; .gitignore prevents recurrence.
- Pushing without committing the FEEDBACK.md entry that explains the change. The commit message body should reference the entry by date + heading; if FEEDBACK.md isn't updated, the commit is incomplete.
- Skipping the push because "the commit captures it." Local commits without push are at the same risk as no commit at all — disk failure / accidental clone overwrite erases both.

**One-time setup confirmation**:
- Remote is `https://github.com/1MORLAP/ClaudeWebFactory.git` (verified 2026-04-26)
- Branch is `main`
- Authentication is whatever the user has configured (gh CLI, SSH key, HTTPS token); the skill-owner session doesn't manage auth — if `git push` fails with auth, surface the error to the user and STOP. Don't silently leave the work uncommitted.

**If push fails** (network down, auth expired, remote went away):
- Surface the error in your response to the user
- Note that the commit IS local (not lost — recoverable from `git log` and `git reflog`)
- Propose: "I made the commit locally but the push failed with {error}. The work is safe in local git but not on GitHub yet. After you fix {auth/network/etc}, run `git push origin main` to back it up."
- DO NOT mark the `/webfactory-learn` complete until push succeeds.

### Batch processing pending feedback (SKILL-OWNER)

When the user says "process all feedback" or similar, the skill-owner:

1. Finds all unprocessed `jobs/*/feedback.md` files
2. For each, extracts the proposed rule and applies it to SKILL.md
3. Appends to FEEDBACK.md with `**Source**: batched from jobs/{domain}/feedback.md`
4. Renames processed files to `feedback.processed.md`
5. Reports the list of rules added
6. **Commits + pushes** per the auto-backup contract above (one commit covers all batched changes — that's fine; the goal is "no shipped work sits uncommitted," not "one commit per feedback item")

### Sub-agent protocol

If a worker session dispatches sub-agents, every sub-agent prompt MUST include:

> "Before starting, read the CANONICAL SKILL at `/Users/tomasz/WebFactory/SKILL.md` (absolute path — not any relative SKILL.md or worktree copy, which may be stale). This is the source of truth and contains hard-won lessons that override any prior knowledge you have of how WebFactory works. Pay special attention to: (a) the ban on `preview_*` / `Chrome` MCP tools (visible browser windows; preview_start side-effect-creates `.claude/launch.json`) — but Playwright itself is UNRESTRICTED, use it ad-hoc anywhere in the pipeline (one-off scripts in /tmp/) plus `scripts/qa.cjs` for the formal QA stages; (b) the ban on creating `.claude/` directories inside job folders; (c) the ban on `&&`/`||` shell operators. You are a worker sub-agent — you MUST NOT edit SKILL.md, FEEDBACK.md, scripts/, templates/, or .claude/. If feedback arises, write it to `jobs/{domain}/feedback.md` and emit a copy-paste block for the skill-owner session."

### The "would I ship this" test

Before reporting the 4 final links to the user, ask yourself: "Would a professional designer ship this website to a paying client?" If no, keep iterating.

## 🚫 NO WORKTREES — Canonical SKILL.md Only

**WebFactory MUST run from `/Users/tomasz/WebFactory/` — never from a worktree.**

Git worktrees (`.claude/worktrees/*`) contain **frozen copies** of SKILL.md from whenever the worktree was created. Worker sessions running inside a worktree will read stale instructions and violate current rules (create `.claude/launch.json`, use `preview_*` tools, etc.). Parallel builds are already isolated by domain (`jobs/{domain}/` + dynamic ports), so worktrees add nothing except stale skill files.

### Rules

1. **Never create a new worktree for a WebFactory build.** Run `/webfactory` from the main project root.
2. **Always read the canonical skill** at `/Users/tomasz/WebFactory/SKILL.md`. If you find yourself in a worktree, immediately `cd /Users/tomasz/WebFactory` and re-read the canonical SKILL.md before taking any action.
3. **Canonical path check** — before building, run:
   ```bash
   if [[ "$PWD" == *".claude/worktrees/"* ]]; then
     echo "✗ Running in a worktree. Switch to /Users/tomasz/WebFactory before continuing."
     cd /Users/tomasz/WebFactory
     echo "Re-read SKILL.md at $(pwd) before proceeding."
   fi
   ```
4. **Sub-agents** MUST be given the absolute path `/Users/tomasz/WebFactory/SKILL.md` to read — NOT a relative `SKILL.md` that could resolve to a worktree copy.

## Input

The user provides a URL, optionally followed by stage overrides and/or scope flags: `{{url}}`

Parse the input:
- If input contains just a URL → run Smart Resume (auto-detect what to skip)
- If input contains `--option-b` or the user says "start at B" → skip directly to Stage 5
- If input contains `--option-c` or the user says "start at Option C" → skip directly to Stage 7
- If input contains `--option-a` or `--stage 3` → skip to Stage 3
- If input contains `--deploy` or `--stage 7` → skip to Stage 8
- If input contains `--full` → **delete `jobs/{domain}/` entirely** (`rm -rf`), then run all stages from scratch. This is a true clean slate — no stale files from prior runs, no risk of mixing old + new artifacts. Run the delete BEFORE Stage 1 (scrape), no confirmation prompt — `--full` is itself the confirmation.
- If input contains `--skip-c` (or the aliases `--no-c` / `--ab-only`) or the user says "skip option C" / "no C" / "just A and B" → **build A and B only, skip Stage 7 (Build Option C) entirely**, and emit only 3 links in the final report (Original + A + B). See "SKIP-C MODE" callout below for what gets gated. **`--skip-c` and `--option-c` are mutually exclusive** — if both are passed, error and ask the user which they meant. Combine freely with `--full` (a clean rebuild that produces only A + B).
- **`--decomposed` is now the DEFAULT** (promoted 2026-04-29 after 5 successful real customer builds). The flag is kept as a no-op alias for backwards compat. Decomposed mode = Opus orchestrates, Sonnet sub-agents do per-page builds + copy rewrites in parallel. See the "🔀 EXECUTION MODE" section near the top + the "🔀 DECOMPOSED MODE" callout below for the full architecture. **REQUIRES Opus orchestrator.** Skipping decomposition (escape hatch only): pass `--monolithic` to revert to the single-orchestrator pipeline.

### ⏭️ SKIP-C MODE (set when `--skip-c` / `--no-c` / `--ab-only` is passed)

Set a bash variable at the very top of the pipeline so every stage can gate on it:

```bash
SKIP_C=0
case " $INPUT " in
  *" --skip-c "*|*" --no-c "*|*" --ab-only "*) SKIP_C=1 ;;
esac
if [ "$SKIP_C" = "1" ]; then
  echo "⏭️  SKIP-C mode active — Option C will not be built, deployed, verified, or reported."
fi
```

When `SKIP_C=1`:
- **Stage 7 (Build Option C)** — entire stage is skipped. No `option-c/` directory created. No plugin invocation. No industry-tokens.json. The Frontend Design plugin doesn't even need to be installed.
- **Stage 8a (QA Gate)** — Option C QA gate (the `vercel build` + `serve dist` + `qa-check.js` against `option-c/`) is skipped. Only A and B gates run.
- **Stage 8b (Deploy)** — Option C deploy block is skipped. Only A and B deploy.
- **Stage 9 (Verification)** — only A and B URLs are fetched and verified.
- **Stage 10 (Report)** — the final deliverable shows **3 links** instead of 4: Original + Option A + Option B. The report explicitly notes "Option C: skipped (--skip-c)" so the user has a clear record.
- **Smart Resume** — does NOT flag missing `option-c/` as "needs build." When `SKIP_C=1`, missing `option-c/` is the EXPECTED state, not a gap.
- **Cascade rules** — the cascade "rebuilding A forces B forces C" still applies for A→B (B is rebuilt if A was), but B→C is short-circuited because there is no C.

When `SKIP_C=0` (default): the full A + B + C pipeline runs as normal.

Example invocations that use `--skip-c`:
- `/webfactory https://example.com --skip-c` — full Smart Resume but no C
- `/webfactory https://example.com --full --skip-c` — clean rebuild, A and B only
- `/webfactory https://example.com --ab-only` — alias, same as `--skip-c`
- `/webfactory https://example.com --option-b --skip-c` — skip directly to B, don't build C afterward

### 🔀 DECOMPOSED MODE (now the DEFAULT — escape hatch is `--monolithic`)

As of 2026-04-29, decomposed mode is the default. Set a bash variable at the very top of the pipeline alongside `SKIP_C`:

```bash
DECOMPOSED=1   # default
case " $INPUT " in
  *" --monolithic "*) DECOMPOSED=0 ;;   # escape hatch — old single-orchestrator pipeline
  *" --decomposed "*) DECOMPOSED=1 ;;   # explicit (no-op — already default)
esac
if [ "$DECOMPOSED" = "1" ]; then
  echo "🔀 DECOMPOSED mode active — page builds and copy rewrites delegated to Sonnet sub-agents in parallel."
else
  echo "⚠️  MONOLITHIC mode active — single-orchestrator pipeline (escape hatch). Decomposed is preferred for production."
fi
```

When `DECOMPOSED=1` (the default):
- **Stage 1** runs as normal (deterministic scrape).
- **Stage 1.5** (manifest enrichment via WebFetch when scraper misses CMS-widget content) — Opus, same as default mode.
- **Stage 2** (design brief) — Opus, same as default mode.
- **Stage 2.5 (NEW)** — Opus writes one self-contained per-page spec into `jobs/{domain}/specs/<page>.md` plus a `_shared.md` (component sigs, design tokens, hard rules) plus optionally `_<type>-template.md` files for repeating patterns. Each per-page spec must be ALL-IN-ONE — a Sonnet given just the shared spec + the page spec must produce a clean page.
- **Stage 2.6 (NEW)** — Opus builds the shared component layer (BaseLayout, Nav, Footer, Hero, Section, brand tokens in global.css, etc.). Workers consume but never modify these.
- **Stage 2.7 (NEW)** — Opus runs the shared-component contrast lint (the eyebrow-color bug class). For every shared CSS class with a color, compute WCAG contrast against EVERY parent-bg variant (bone/cream/steel/white/ink). Fix any failing combination BEFORE workers consume the scaffold.
- **Stage 3 (Build A)** — spawn N Sonnet sub-agents in PARALLEL, one per spec, via the Agent tool with `model: "sonnet"`. Each gets the shared spec + its page spec + writes one .astro file. Wall-clock: dominated by the slowest single page-build (~50-65 sec).
- **Stage 4 (QA A)** — npm build + qa-check.js. Fix-loop split: shared-component bugs (failure pattern repeats across multiple pages OR is in a shared file) → **Opus fixes** (1 edit benefits all pages). Per-page bugs → **Sonnet sub-agents in parallel** (one per affected page, each makes targeted Edits).
- **Stage 5 (Build B)** — copy A→B FIRST, then spawn N Sonnet rewriters in parallel. Each uses the `Edit` tool (NOT `Write`) for targeted text-only changes preserving design markup.
- **Stage 6 (QA B)** — same fix-loop split as Stage 4.
- **Stage 7 (Build C)** — Opus invokes the Frontend Design plugin (NOT decomposable to Sonnet — plugin is a synthesis step that needs orchestrator capability).
- **Stage 8a / 8b / 8c / 9 / 10** — same as default mode. Deploy uses the standard prebuilt flow; SSO disable; verify; report.

When `DECOMPOSED=0` (default): the original single-orchestrator pipeline runs as normal — Opus does everything.

**Hard requirement**: the orchestrator (the model running `/webfactory`) MUST be Opus or comparable. Sonnet/Haiku sub-agents do the per-page volume work, but the orchestrator does spec generation, scaffold construction, contrast lint, and fix-loop classification — those need synthesis capability the cheaper sub-agents don't have. Validated 2026-04-28: Opus 4.7 orchestrator + Sonnet 4 sub-agents shipped clean on bwlocksmith.com (4 pages) and accelwindows.com (5 pages).

Example invocations that use `--decomposed`:
- `/webfactory https://example.com --decomposed` — full Smart Resume in decomposed mode
- `/webfactory https://example.com --full --decomposed` — clean rebuild in decomposed mode
- `/webfactory https://example.com --decomposed --skip-c` — A and B in decomposed mode, skip C
- `/webfactory https://example.com --option-b --decomposed` — skip to B (rewrite phase) using decomposed parallel rewriters

## Pre-flight: Verify Unattended Mode

Before starting, confirm the pipeline can run without permission prompts:

```bash
# Verify settings.json has wildcard permissions
if grep -q 'Bash(\*)' .claude/settings.json; then
  echo "✓ Bash permissions OK"
else
  echo "✗ Fix .claude/settings.json"
fi
```

If this fails, write `.claude/settings.json` with wildcard permissions for all tools before proceeding.

### Pre-flight: Purge rogue `.claude/` dirs in job folders

Any previous run (or previous worker session using stale rules) may have created `.claude/` inside a job directory. These MUST be removed before this run, or the next tool call that touches them will trigger popups:

```bash
find jobs -type d -name ".claude" -not -path "*/node_modules/*" -print -exec rm -rf {} +
```

This is a safe, idempotent cleanup — it only removes `.claude/` directories inside `jobs/`, never the project-level one.

## Metrics: Initialize Tracking

Run the metrics initializer to create `jobs/{domain}/metrics.json` with domain, URL, model, timestamp, and dynamic port allocation (ports are hashed from the domain to avoid collisions in parallel builds):

```bash
cd /Users/tomasz/WebFactory
node scripts/init-metrics.cjs "{{url}}"
```

This outputs the allocated ports, e.g.:
```
✓ Metrics initialized for example.com
  Ports — A: 38472, B (legacy slot B): 38473, C: 38474, B (current): 38475
```

**IMPORTANT**: From this point forward, use the allocated ports from `metrics.json` — NOT hardcoded 4321/4322. Read them like this:

```bash
DOMAIN=$(echo "{{url}}" | sed 's|https\?://||; s|www\.||; s|/.*||')
PORT_A=$(node scripts/get-port.cjs "$DOMAIN" a)
PORT_B=$(node scripts/get-port.cjs "$DOMAIN" b)
```

**After completing each stage**, log the timestamp using the helper script:

```bash
cd /Users/tomasz/WebFactory
node scripts/log-stage.cjs "$DOMAIN" "STAGE_NAME"
```

Replace `STAGE_NAME` with one of: `scrape`, `designBrief`, `optionA`, `optionAQA`, `optionB`, `optionBQA`, `optionC`, `optionCQA`, `deploy`.

## Smart Resume: Check What Already Exists

Before running the full pipeline, check what's already been built for this domain. Skip completed stages.

**If `--full` or `--clean` was passed**, wipe the domain directory FIRST so Smart Resume sees a clean slate — BUT preserve `*/.vercel/project.json` so re-deploys go to the same Vercel projects (avoids interactive "link or create new project?" prompts that break unattended mode):

```bash
DOMAIN=$(echo "{{url}}" | sed 's|https\?://||; s|www\.||; s|/.*||')
if echo "{{url}}" | grep -qE -- '--(full|clean)'; then
  if [ -d "jobs/$DOMAIN" ]; then
    # Stash existing Vercel project links for each option (so they survive the wipe)
    STASH="/tmp/vercel-stash-$DOMAIN-$$"
    mkdir -p "$STASH"
    for opt in option-a option-b option-c; do
      if [ -f "jobs/$DOMAIN/$opt/.vercel/project.json" ]; then
        mkdir -p "$STASH/$opt/.vercel"
        cp "jobs/$DOMAIN/$opt/.vercel/project.json" "$STASH/$opt/.vercel/project.json"
        echo "  ↪ stashed Vercel project link for $opt"
      fi
    done

    # Wipe the job dir
    rm -rf "jobs/$DOMAIN"
    echo "✓ --full/--clean detected → wiped jobs/$DOMAIN/"

    # Restore the Vercel project links into a fresh job dir skeleton
    for opt in option-a option-b option-c; do
      if [ -f "$STASH/$opt/.vercel/project.json" ]; then
        mkdir -p "jobs/$DOMAIN/$opt/.vercel"
        cp "$STASH/$opt/.vercel/project.json" "jobs/$DOMAIN/$opt/.vercel/project.json"
        echo "  ↪ restored Vercel project link for $opt → re-deploys hit the same project"
      fi
    done
    rm -rf "$STASH"
  fi
fi
```

**Why preserve `.vercel/project.json`**: when `vercel deploy` runs from a directory with a valid `.vercel/project.json`, it deploys to the linked project automatically (no prompts). When the file is missing, the CLI prompts "Link to existing project? Create new?" — which breaks unattended operation. Preserving the link across `--full` rebuilds keeps the Vercel project IDs stable so the deployment URLs (`{project-name}.vercel.app`) don't churn between rebuilds.

**For brand-new domains** (no existing `.vercel/project.json`): the worker session must use the Vercel Teams Configuration `Method A: pre-link before first deploy` pattern from Stage 8. Run `npx vercel link --scope tomek-group --yes` in each option's directory before `vercel build` / `vercel deploy`. See SKILL.md Vercel Teams section for details.

Then run the normal Smart Resume probe (it will report everything as NEEDED after a clean wipe):

```bash
DOMAIN=$(echo "{{url}}" | sed 's|https\?://||; s|www\.||; s|/.*||')
echo "=== Checking existing work for $DOMAIN ==="

# Stage 1: Scrape
if [ -f "jobs/$DOMAIN/manifest.json" ]; then
  echo "✓ Stage 1 (Scrape): DONE — manifest.json exists"
else
  echo "○ Stage 1 (Scrape): NEEDED"
fi

# Stage 2: Design brief
if [ -f "jobs/$DOMAIN/design-brief.json" ]; then
  echo "✓ Stage 2 (Design Brief): DONE"
else
  echo "○ Stage 2 (Design Brief): NEEDED"
fi

# Stage 3: Option A
if [ -d "jobs/$DOMAIN/option-a/src/pages" ]; then
  PAGE_COUNT=$(ls jobs/$DOMAIN/option-a/src/pages/*.astro 2>/dev/null | wc -l | tr -d ' ')
  echo "✓ Stage 3 (Option A Build): DONE — $PAGE_COUNT pages"
else
  echo "○ Stage 3 (Option A Build): NEEDED"
fi

# Stage 5: Option B (copy-rewritten Option A)
if [ -d "jobs/$DOMAIN/option-b/src/pages" ]; then
  PLUS_COUNT=$(ls jobs/$DOMAIN/option-b/src/pages/*.astro 2>/dev/null | wc -l | tr -d ' ')
  echo "✓ Stage 5 (Option B Build): DONE — $PLUS_COUNT pages"
else
  echo "○ Stage 5 (Option B Build): NEEDED"
fi

# Stage 7: Option C (Plugin-driven) — gate on SKIP_C
if [ "$SKIP_C" = "1" ]; then
  echo "⏭️ Stage 7 (Option C Build): SKIPPED (--skip-c mode)"
elif [ -d "jobs/$DOMAIN/option-c/dist" ]; then
  C_COUNT=$(find jobs/$DOMAIN/option-c/dist -maxdepth 1 -name '*.html' 2>/dev/null | wc -l | tr -d ' ')
  echo "✓ Stage 7 (Option C Build): DONE — $C_COUNT pages"
else
  echo "○ Stage 7 (Option C Build): NEEDED"
fi
```

**Rules for skipping:**
- If `manifest.json` exists → skip Stage 1 (scrape)
- If `design-brief.json` exists → skip Stage 2
- If `option-a/src/pages/` has .astro files AND `option-a/dist/` exists → skip Stages 3-4 (Option A build + QA)
- If `option-b/src/pages/` has .astro files AND `option-b/dist/` exists → skip Stage 5 (B rewrite). **If A is rebuilt, B MUST also be rebuilt** (it inherits from A). **If B is rebuilt and `$SKIP_C != 1`, C MUST also be rebuilt** (it reads B's text — a stale C would diverge from the canonical text). **If `$SKIP_C = 1`, the B→C cascade is short-circuited** — there is no C to rebuild.
- If `option-c/src/pages/` has .astro files AND `option-c/dist/` exists → verify page count matches manifest. If it does, skip to deploy. If not, rebuild Option C. If B is rebuilt, C MUST also be rebuilt (C inherits text from B). **Skipped entirely when `$SKIP_C = 1`** — existing `option-c/` is left untouched (orphan from a previous full run; safe to ignore or `rm -rf` manually).
- **Option B is retired** (as of 2026-04-24). If `option-b/`, `stitch-output/`, or any V1-shape Option B artifacts exist from earlier runs, ignore them — Smart Resume will not regenerate Option B. Safe to delete manually if you want to clean up.
- **NEVER skip the completeness check or QA stages** — always run these even on resume

Report what will be skipped and what will be built, then proceed with the first needed stage.

## Pipeline

Execute these stages, skipping completed ones per Smart Resume.

### Parallelization (Architecture 2 — B is canonical text source for C)

Three tracks (Option B retired 2026-04-24). Strictly sequential because of text-source dependencies:

```
Stage 1 (Scrape) → Stage 1b (Fix logo) → Stage 2 (Design Brief)
                                                │
                                                ▼
                                       Stage 3 (Build A — original copy + new design)
                                                │
                                                ▼
                                       Stage 4 (A QA)
                                                │
                                                ▼
                                       Stage 5 (Build B — rewrite A's text, conversion-tuned)
                                                │
                                                ▼
                                       Stage 6 (B QA — text quality + layout match)
                                                │
                                                ▼
                                       Stage 7 (Build C — plugin design + B's text + inline QA)
                                                │
                                                ▼
                                       Stage 8 (Deploy A + B + C)
                                       Stages 9-10 (Verify + Report 4 links)
```

**Why strictly sequential**: B rewrites A's source files (needs A done). C inherits B's text (needs B done). No true parallelism is possible — but the next stage's design QA pass can overlap with the next build if you want to save wall-clock time.

**Why this architecture is good**: B produces the canonical conversion-tuned copy. C is pure design execution against that copy. Customer comparison becomes _"A vs B"_ (does the rewrite matter?) and _"B vs C"_ (does plugin design beat template design?). Two clean axes of comparison instead of four muddled ones.

**Key optimizations**:
<!-- Optimization note removed: Option B (Stitch-driven) was retired 2026-04-24. -->

- Run B and C in parallel once B is complete. They don't depend on each other.

**Track dependencies**: A is independent. B depends on A. C depends on B. B and C are siblings (parallel after B).

---

### Stage 1: Scrape & Extract

Run the scraper script to crawl the target website and download all content:

```bash
cd /Users/tomasz/WebFactory
node scripts/scrape.js "{{url}}"
```

This creates a job directory at `jobs/{domain}/` containing:
- `manifest.json` - structured data for all pages
- `assets/img/` - downloaded images (both `<img>` tags AND CSS `background-image` URLs)
- `assets/screenshots/` - full-page screenshots of every page

The manifest includes two image arrays per page:
- `images` - standard `<img>` tag images (logos, inline photos, icons)
- `backgroundImages` - CSS background-image URLs (hero backgrounds, section backgrounds)

**CRITICAL**: The `backgroundImages` are the large hero/banner images that appear behind text on each page. These MUST be used as hero section backgrounds in the rebuilt site. They are often the most visually impactful images on the original site.

#### Stage 1b: Fix low-res logo (MANDATORY — always run)

WordPress and many other CMSs serve logos via a favicon-crop URL like `cropped-X-24x8.png` — literally 24×8 pixels — that browsers display at CSS size. The scraper downloads the 24×8 file, and if left alone the rebuilt site shows a blurry blob in the nav. This was a real bug in the fsolsidingcontractor.com run (2026-04-16) and MUST be prevented every time:

```bash
DOMAIN=$(echo "{{url}}" | sed 's|https\?://||; s|www\.||; s|/.*||')
node scripts/fix-logo.js $DOMAIN
```

The script reads the manifest, finds the logo candidate (first nav/header image, or filename containing "logo"/"cropped"/"brand"), and if the file on disk is <100px wide it automatically fetches the WordPress high-res variants (stripping the `-WxH` size suffix and the `cropped-` prefix). It writes the replacement file in place and adds a `logo` field to `manifest.json` with verified dimensions.

If the script reports `✗ No better variant found`, note this and inform the user in the final report — the rebuilt site will need either a text-only brand in the nav OR a user-provided logo file.

#### Stage 1c: Detect CMS placeholders (MANDATORY — always run)

After scraping + logo fix, scan the manifest for **template-default placeholder content** the customer never filled in. Sites built on Hibu, Wix, Squarespace, GoDaddy, etc. ship "your content here" defaults that look real to a scraper but represent missing content. Strict preservation of these = shipping placeholders.

```bash
DOMAIN=$(echo "{{url}}" | sed 's|https\?://||; s|www\.||; s|/.*||')
node scripts/detect-placeholders.cjs $DOMAIN
```

The script walks every page in the manifest and tags suspicious entries with `_placeholder: { kind, pattern, source, reason }`. It writes:
- **Updated manifest.json** with `_placeholder` tags inline on the offending images, pages, sections, business fields
- **placeholder-report.json** with a grouped summary of every placeholder found

The script's pattern catalog covers (all in one file — `scripts/detect-placeholders.cjs`):
- **Image URLs**: `gen-logo-*` (Hibu), `default-logo`, `your-logo-here`, `placehold.co`, `via.placeholder.com`, `wix-default`, `godaddy-default`, etc.
- **Page slugs**: `/hibu-video-splash`, `/call-or-text-pop`, `/sample-page` (WordPress), `/test-page`, `/your-page`
- **Body copy**: lorem ipsum variants, "Business Tagline Lorem Ipsum Dolor" (Hibu pattern), "Welcome to your new site", "Click here to add", "Add your text here", "This is a sample", "Coming soon", "Under construction"
- **Phone numbers**: 555-0100 to 555-0199 (NANP fiction reserve), 123-456-7890, 000-000-0000
- **Email**: `info@example.com`, `youremail@domain.com`, etc.
- **Addresses**: "123 Main Street", "Your Street Here", "1234 Anytown"

After this stage, every downstream stage (design brief, build A/B/C, QA) reads `_placeholder` tags and reacts:

| Tag kind | Downstream reaction |
|----------|--------------------|
| `logo-placeholder` | Skip in fix-logo, fall back to favicon → plain text |
| `image-placeholder` | Omit from build OR substitute with manifest content |
| `page-placeholder` | Exclude from nav and from page count, don't build the page |
| `copy-tagline-placeholder` | Option B writes a real tagline from manifest facts; A omits the section |
| `copy-lorem` | Omit; never ship lorem ipsum |
| `copy-coming-soon` / `copy-edit-placeholder` | Omit section OR replace with real content from elsewhere in manifest |
| `phone-fiction` / `email-placeholder` / `address-placeholder` | Flag in final report — customer must provide real contact info |

#### CMS PLACEHOLDER PRINCIPLE (architectural — applies to every stage)

The customer's original site is the **input**, not the **truth**. Sites built on template platforms commonly contain content the customer never filled in — placeholder logos, lorem ipsum copy, dummy phone numbers, "Hibu Video Splash" template pages. Strict preservation of placeholder content = shipping placeholder content.

**Every per-element rule below (LOGO, VIDEO CTA, SOCIAL LINKS, HERO CONTRAST, image handling, copy preservation) operates on placeholder-cleaned manifest data.** When `_placeholder` tags are present on a manifest item, the relevant rule defines the fallback path (favicon, drop CTA, omit page, etc.). The detection logic is centralized in `scripts/detect-placeholders.cjs`; the reactions are defined per rule below.

This principle is the structural fix for the recurring "shipped placeholder content" bug class (logo-placeholder, video-CTA-placeholder, social-href-self-pointing, lorem-ipsum-in-copy, etc.). One detector runs after scrape; all stages and qa-check inherit its findings.

After scraping + logo fix + placeholder detection, read the manifest.json to understand what was captured. Report the number of pages scraped, any logo-fix actions taken, and any placeholders detected.

#### FACT GROUNDING PRINCIPLE (architectural — applies to every text-producing stage)

> **Every factual claim rendered on a built page MUST originate in the scraped manifest, OR follow logically from a fact in the manifest. No exceptions, no "sounds plausible," no "every plumber says this."**

This is the structural fix for the "shipped a hallucinated fact" bug class. Real bug shipped 2026-04-25: an Option B build rendered a `20+ YEARS EXPERIENCE` badge on a customer's homepage when the manifest contained no year reference, no founding date, no license vintage — nothing that supported the claim. The number was invented because it "sounded right for a trades business." That is fabrication. It must never ship.

**Scope.** Applies to:
- Hero headlines and subheadings
- Trust badges, callout pills, stat blocks ("20+ years", "500+ jobs", "★★★★★ 200 reviews")
- About / story sections (dates, founder names, biographical claims)
- Feature/service descriptions (capabilities, certifications, brands serviced, areas covered)
- Testimonial attributions and quotes (must be verbatim from manifest)
- CTA microcopy that asserts a fact ("24-hour response", "free quote", "lifetime warranty")
- Footer and legal text (license numbers, addresses, founding year)

**Allowed transformations (NOT fabrication):**
- Rewording an existing claim — manifest says "We've been serving Englewood for over 20 years"; rendered text says "20+ years serving Englewood." Same fact, tighter copy.
- Inferring from a stated date — manifest says "Established 2003"; rendered text says "20+ years in business" (correct as of 2024+). The math is sound and traceable.
- Combining two manifest facts into one tighter sentence.
- Sharpening generic CTAs into concrete ones IF the concreteness is in the manifest — manifest says "Call us anytime, day or night"; CTA becomes "Talk to a real plumber tonight." The 24/7 availability is in the source.
- Reordering value propositions for impact (no new claims, just resequencing).

**Forbidden fabrications (FAIL the build):**
- Inventing a number that doesn't appear in the manifest. "20+ years" with no year, no date, no "since YYYY" anywhere in the corpus.
- Inventing a credential. "Award-winning" / "BBB A+ rated" / "Voted Best in Tampa" / "Licensed and insured" — none of these go on the page unless the manifest says so.
- Inventing a metric. "500+ satisfied customers" / "200 5-star reviews" / "98% on-time rate" — never assert numbers the manifest doesn't supply.
- Inventing an ownership/identity claim. "Family-owned" / "Veteran-owned" / "Woman-owned" / "Locally owned" — these are identity claims the customer either makes or doesn't. If the manifest doesn't say it, you don't say it.
- Inventing service-area or response-time claims. "Available 24/7" / "Same-day service" / "Free estimates" — verifiable promises the customer must actually offer.
- Inventing partner/brand claims. "Authorized Trane dealer" / "Certified Lennox technician" — never assert partnership unless the manifest contains it.

**The build-time test (apply to every fact you write).** Before you write a sentence containing a number, a date, a credential, or a ownership claim, ask: _"Where in the manifest is this?"_ If you can't point to the line, the sentence does not get written. If you're tempted to write "20+ years" because the customer "feels established" — STOP. The customer either gave you a year or they didn't.

**The QA gate (`scripts/qa-check.js fact-grounding`).** Independent of build-time discipline, the deploy gate scans rendered DOM for fact-claim patterns ("X+ years", "since YYYY", "award-winning", "family-owned", "BBB accredited", "X+ customers", "X-star rated", etc.) and validates each one against the manifest text corpus. If a claim fails verification, the build is blocked from deploy with a message naming the page, the claim, and the missing manifest support. **This check must run on Options A, B, and C.**

**Why this is a top-level rule.** Each per-stage rule (Stage 5 rewrite, Stage 7 plugin output, Stage 4 polish) had its own "don't fabricate" line. They didn't prevent the bug because they relied on build-time vigilance. The structural fix is: (1) make the principle explicit and visible, and (2) verify it programmatically at deploy time. Same pattern as CMS PLACEHOLDER PRINCIPLE — one principle stated once, one detector enforcing it everywhere.

#### TESTIMONIAL & REVIEW PRESERVATION (architectural — applies to every text-producing stage)

> **Customer reviews and testimonials are the words of real people, attributed to them by name. They are NOT copy. The rewrite (Option B), the design re-render (Option C), and any "tightening" or "polishing" pass MUST NOT touch them. Verbatim, full, unedited, in every option.**

This rule is stricter than FACT GROUNDING. Fact grounding says you can sharpen "we have over 20 years experience" into "20+ years in business" because the underlying fact is the same. **You may NOT do that to testimonials.** A review reading "Bryan and his team did an awesome job, super professional, would recommend!" stays exactly as written — not "Bryan's team did exceptional, professional work — highly recommended." Even though the second version is "tighter," you have just put words in a real customer's mouth attributed by name. That is impersonation.

**Why this is its own rule, not a sub-bullet of FACT GROUNDING**: testimonials are the customer's strongest social proof asset. Tampering damages trust two ways — visitors who recognize their own reviews see them changed (immediate credibility hit), and visitors who DON'T recognize them but compare to Google/Yelp public listings see the discrepancy. Both kill conversion. Worse: it's reputationally and arguably legally bad to edit reviews attributed to named people without their consent.

**Scope — what counts as a "testimonial" and is FROZEN verbatim**:
- Anything in a `<blockquote>`, `<q>`, or testimonial card with an attribution (name, photo, location, date, star rating, platform logo)
- Anything attributed to a named third party: "— John D., Tampa", "— Sarah K., Verified Customer", "— Mike R., 5★ Google Review"
- Star ratings and the count next to them ("4.9★ from 287 reviews" — both numbers are facts)
- Reviewer names, locations, dates, photos, platform attribution (Google, Yelp, BBB, Facebook, Angi, etc.)
- Quotes from named employees / founders ("As our owner Mike says, 'we treat every job like it's our own home'") — same rule, different speaker
- Case studies that include verbatim customer quotes — the quote portion is verbatim; surrounding narrative may be tightened
- "Featured in / As seen on" press attributions

**Allowed transformations (these are NOT tampering)**:
- **Reordering** the list of reviews (sequence is design, not content)
- **Selecting a subset** for the homepage (e.g., showing 3 of 12 — but the 3 selected are verbatim, and the full list lives on a `/reviews` page also verbatim)
- **Layout changes** (carousel vs grid vs stack — design only)
- **Visual treatment** of the attribution (icon styling, photo crop, star rendering)
- **Truncating with "Read more"** for very long reviews IF the full text is reachable from the same page (not silently cut off)

**Forbidden tampering (FAIL the build)**:
- Rewording any quoted text, even to "fix" grammar or typos. The customer wrote "amazing service, super proffesional!" — that misspelled "professional" stays. It's their voice.
- Combining two reviews into one ("composite testimonial")
- Inventing reviews that don't exist in the manifest
- Inventing reviewer names, locations, dates, or platforms
- Inflating star ratings or review counts
- Translating reviews (a Spanish-language review stays in Spanish)
- Removing reviews that are "off-topic" or "less polished" — your job isn't to curate the customer's reputation
- Replacing real reviews with generic stock testimonials ("Best service ever! — Happy Customer")
- Stripping platform attribution (a Google review labeled "Google Review" stays attributed to Google)

**Per-stage application**:
- **Stage 1 (Scrape)**: capture every testimonial/review verbatim into the manifest, including attribution metadata (name, location, date, star rating, platform). Don't strip whitespace inside the quote text.
- **Stage 3 (Build A — faithful)**: render every testimonial verbatim. Same rule as the rest of A — original text preserved.
- **Stage 5 (Build B — rewrite)**: testimonials are the OUTLIER section that does NOT get rewritten. The B rewrite touches headlines, CTAs, body copy, value props — NOT testimonials. B's testimonials are byte-identical to A's testimonials.
- **Stage 7 (Build C — plugin design)**: C reads B's text verbatim, so C's testimonials inherit B's (which inherit A's, which inherit the manifest). The plugin may restyle the testimonial section visually but cannot touch the words.
- **Stage 4 / 6 / 8a (qa-check)**: programmatic enforcement — the testimonial text rendered on B's pages must appear verbatim somewhere in A's pages (and same for C vs B).

**The build-time test**: before publishing any change to a `<blockquote>`, testimonial card, or anything inside a section labeled "Reviews" / "Testimonials" / "What Our Customers Say" — check whether the change is structural (layout, ordering, selection) or textual (rewording any character of the quoted text). If textual, REVERT. There is no "small wording fix" exception.

**The QA gate (`scripts/qa-check.js testimonial-tampering`)**: scans every `<blockquote>`, `<q>`, and likely-testimonial-card pattern (containers with both a quote and an attribution within ~200px). For Option B and C: extracts the testimonial text and verifies it appears verbatim in Option A's HTML files (same domain, same pages). Failure means B/C tampered with text that should have been frozen. Real bug class this prevents shipping: shipped 2026-04-25 framing — "rewriter sharpened the customer testimonials thinking they were copy."

#### DESIGN QUALITY BAR (architectural — operationalizes "suddenly expensive")

> **The vision says A should look like a top-tier studio charged the customer $80k. There must be a quality bar the design has to clear, not just an absence of bugs.**

The previous skill enumerated bug classes (placeholder content, fact grounding, hero contrast, etc.) but never defined what GOOD looked like. So a build could pass every check by being "merely better than the original" — and ship as a $2k rebuild instead of an $80k one. This rule defines the minimum bar.

**The bar — every option must clear all of these. Workers verify in build (Stage 3/5/7) and visual sanity pass (Stage 4c-bis).**

1. **Typography that signals taste.** At least one display-quality font from a reputable foundry (Google Fonts has many — Fraunces, Editorial New, DM Serif Display, Cormorant, Newsreader, Tenor Sans, Cabinet Grotesk, etc. via @fontsource or CDN). NEVER ship a site whose only fonts are system Inter, system Arial, or system Helvetica. The model picks based on industry/brand vibe — there is no curated list because expensive design comes from intentional choice, not from a pre-approved menu. Pair a display font (headlines) with a clean text font (body); two is plenty, three is the maximum.
   - **What "expensive" means in a typeface**: proportional spacing, considered weight pairs, optical sizing for large display use. Generic Inter at every weight = template. Fraunces at 12-72pt with optical adjustments + Inter for body = considered.
   - **qa-check.js fails the build** if `<head>` loads zero `@import url('https://fonts.googleapis.com/...)` AND no `@fontsource/...` import AND no `<link rel="stylesheet" href="https://fonts.googleapis.com/...">` — i.e., relying entirely on system fonts.

2. **Whitespace that breathes.** Section padding ≥ 96px vertical at desktop, ≥ 48px at mobile. Inside-section padding ≥ 24px. Don't crush content together.

3. **Hero treatment beyond "photo + heading".** Every hero must include at least one supporting design element: a horizontal rule, a labeled section number ("01"), a mono caption strip, an attention bar, a hover-revealed accent. The bare hero ("photo + giant headline + button") is the template tell.

4. **Considered color palette.** 3 primary + 2 accent maximum, ALL justified in design-brief.json. NOT "blue and white" — name the brand role of each (e.g., "deep navy = trust anchor for a marine-services brand; warm cream = page wash; hi-vis safety yellow = active CTA only"). If the design brief lists 6 colors with no rationale, the brief itself is not done — kick back.

5. **One distinctive element per page.** Each page should have at least one piece of design that the customer would NOT have built themselves: a custom card style, a unique heading layout (oversized + tight kern + custom underline), a stat strip with mono captions, a quote treatment with editorial pull-quote marks, a numbered process strip, etc. If every section is "centered headline + 3-card grid," the design is templated.

6. **At least one micro-interaction.** Scroll reveals, hover state with motion (subtle scale on cards, color shift on CTAs), animated counters on stat blocks, a sticky-on-scroll nav transition. Static-only is template-grade. Don't overdo it — one or two intentional motions per page.

7. **The "$80k smell test" (in Visual Sanity Pass).** After QA passes, look at the homepage screenshot and ask honestly: "Could I imagine charging $80k for this?" If no, what specifically is missing — a font that looks bespoke, a hero treatment that earns the photo, a moment of design ambition? List the gap and fix it. The build is not done until this answer is yes.

8. **Ornament budget — max 2-3 distinctive devices per option.** A "distinctive device" is any design move repeated across the page that announces itself: section indices, hatched borders, file-tab nav, status pills, terminal cursors, grid overlays, mono captions, bracket numerals, hover-accents, custom dividers, etc. Each option (A and C separately) gets a budget of **2-3** distinctive devices. More than that = ornament-heavy = template tell. Real bug shipped 2026-04-29 (Option C for tomekgroup): 9 distinctive devices stacked together (bracket numerals + status dots + status pills + grid overlays + terminal cursor + bracket buttons + spec callouts + dark CTA + dark footer + file-tab nav) — the page read as "internal admin dashboard," not "sophisticated brand site."

   **The discipline**: in Stage 2 (Option A) and Stage 7b (Option C), explicitly enumerate the distinctive devices in the brief / `aesthetic-brief.md` BEFORE building. List them: "Device 1: section eyebrow with hairline rule. Device 2: photo annotation in mono caption. Device 3: italic-rust emphasis on display headlines." Stop at 3. If you find yourself adding a 4th in component code, it's a pattern violation — drop one of the existing 3 first, OR reconsider whether the new one earns its slot.

   **Examples**:
   - Photo-led trades (Option A): (1) italic-rust display emphasis, (2) photo annotations in mono caption, (3) "A craftsman's portfolio" gallery with mono captions. Three devices. Done.
   - Workwear-document trades (Option C): (1) bracket-numbered eyebrows, (2) hatched caution-tape dividers, (3) JOB # corner stamps on photos. Three devices. Done. NOT also file-tab nav + condensed display + ALL-CAPS H2 + chevron list-markers + status pills + terminal cursor — that's a budget overrun.

   **What this rule rules out**: stacking every cool design move into one page. Each device should be intentional and serve the brand. If a device doesn't reinforce the customer's industry / personality / story, drop it. The discipline of removing your second-favorite move is what separates "considered" from "decoration-heavy."

**Stage 2 design brief must explicitly hit each bar item** — typography pairing with rationale, palette with justified roles, hero treatment direction, distinctive-element catalog (2-3 devices, named), micro-interaction list. A weak brief produces a weak A. Brief quality is the upstream cause of "merely better than original" output.

**Per-stage application:**
- **Stage 2** generates the brief that codifies the bar choices.
- **Stage 3 (Build A)** executes the bar — display font loaded, hero treated, distinctive element per page.
- **Stage 5 (Build B)** inherits A's design tokens unchanged (B doesn't redesign).
- **Stage 7 (Build C)** uses the plugin BUT must also clear the same bar — the plugin is no excuse for a generic editorial result (see industry-anchored rule for C).
- **Stage 4 / 6 / 8a (qa-check + visual sanity)** programmatically catches system-only fonts and prompts the model to do the $80k gut check.

#### LOGO RULE (strict, all options — ALWAYS PRESERVE + BACKGROUND-AWARE PLACEMENT)

Real bugs we shipped:
- bigdaddysdumpers.com (Option C): invented a "weird-looking blob" instead of using the customer's logo
- sspowerwashing.com (2026-04-24): used the customer's PNG logo (which has a solid navy rectangle background) on our nav (which is a different shade of navy). Result: visible blue-on-blue color mismatch, logo looks like a sticker glued onto the page

Hard rules in two layers — **(A) preserve the original**, and **(B) place it where it actually looks good**.

##### Layer A — Always preserve, never invent (with placeholder detection + favicon fallback)

The full fallback chain (try in order, stop at the first that succeeds):

1. **Original logo from manifest** — use `scripts/fix-logo.js` to recover a high-res variant if WordPress/CMS mangled it. Stop here if a real, non-placeholder logo was recovered.

2. **Detect and reject platform placeholders** (NEW). Many template platforms ship a "your logo here" default when the customer didn't upload anything. Common patterns:
   - URL contains `gen-logo`, `placeholder`, `default-logo`, `template-logo`, `logo-placeholder`, `your-logo-here`, `default-image`, `wix-default`
   - Filename matches `gen-logo-*`, `logo-default-*`, `logo-placeholder-*`, `default-site-icon-*`
   - Image content visually shows the literal word "logo" (italic or otherwise) — the rendered Moretti's Centry Auto Body bug came from `gen-logo-e5ccbe50-1920w.png`, a Hibu-platform placeholder showing a wireframe sun + the word "logo"
   - If detected → DO NOT use it. Move to step 3.

3. **Favicon fallback** (NEW). If no real logo is available, try the customer's favicon:
   - Fetch in this order: `/favicon.ico`, `/apple-touch-icon.png`, `/apple-touch-icon-180x180.png`, `/favicon-32x32.png`, `/favicon-192x192.png`, `/favicon-512x512.png`, `/site-icon.png`
   - If a usable favicon is found (square or near-square, ≥ 64px wide, NOT itself a placeholder), use it as the logo
   - Note in the final report: `"Used favicon as logo. Recommend customer provide a high-res logo file."` — be honest with the user about the substitution

4. **Plain-text fallback** — if no real logo AND no usable favicon: use plain text containing the verbatim business name in the page's display font. No graphic substitute. No wordmark logo. No invented mark.

**Hard prohibition (all options, no exceptions)**: NEVER design a new logo. NEVER invent a mark, icon, monogram, badge, abstract graphic, mascot, stylized symbol, decorative wordmark treatment, OR a placeholder graphic with literal text like "logo" / "Site Logo" / "Your Logo Here". The customer must recognize the brand, OR see clean plain text — not a generic graphic that signals "we couldn't find your logo."

**QA gate enforcement (NEW in qa-check.js)**: fails the build if the rendered logo `<img>` either (a) has a src URL matching the placeholder patterns above, OR (b) the visible nav contains the literal text "logo" / "Logo" / "your logo" adjacent to or as alt text on the image.

##### Layer B — Background-aware placement (NEW, prevents the SS Power Washing bug)

Before settling on the first logo file you find, **hunt for the best variant**, then **detect its background**, then **place it appropriately**.

**Step 1 — Hunt for transparent / SVG variants first.** Many sites ship multiple logo variants. Don't grab the first match; survey the field:

- Scan `manifest.json` for ALL images whose URL or alt text contains `logo`, `brand`, or the business name. Catalog every candidate.
- Strongly prefer (in this order):
  1. `*.svg` (always cleanly scalable, almost always transparent)
  2. `*-transparent.png`, `*-trans.png`, `*-tp.png`, `*-alpha.png` (explicitly transparent)
  3. `*-white.png`, `*-light.png` (white-on-color variant — works on dark backgrounds)
  4. `*-dark.png`, `*-color.png` (color-on-light variant — works on light backgrounds)
  5. Plain `logo.png` or similar — last resort, may have a solid background
- For WordPress: also try fetching the image without the `cropped-` prefix and without the `-WxH` suffix. Customer often uploaded a clean transparent original; the favicon-crop is just a derivative.
- For Squarespace: check for `?format=` query params in the URL — these can return different variants.
- If multiple variants exist, pick the one with the **highest resolution AND most permissive background** (transparent > white-on-color > color-on-light > opaque-with-fixed-background).

**Step 2 — Detect the background of the chosen logo file.** After fix-logo.js writes the final logo file:

- Check whether the PNG has an alpha channel with actual transparency (not just an opaque alpha=255 channel). If yes → flag as `hasTransparency: true` in manifest. Logo can sit on any background.
- If no alpha or fully-opaque alpha → sample the four corners of the image. If all four corners are the same color (or close), that's the logo's background color. Record as `manifest.logo.backgroundColor: "#1a3556"`.
- If corners differ, it's likely a complex/photographic background that requires per-customer attention — flag for human review.

**Step 3 — Place the logo correctly based on its background:**

- **If transparent**: place the logo directly in the nav. Choose nav background that the logo's foreground colors look good against. (For a logo with both white and red elements, a navy or charcoal nav works. For a logo with only dark elements, a light nav works.)
- **If opaque with a known background color** (e.g., navy `#1a3556`): the nav must use **the exact same background color** as the logo — sampled hex, not "navy"-ish. The logo then sits invisibly merged with the nav. OR: place the logo in a card/panel that matches its background color exactly, and let the nav have a different color around the panel. (The card should look intentional, not accidental.)
- **NEVER place an opaque-background logo on a different-colored nav.** That's the SS Power Washing bug. The visible color mismatch makes the site look amateur.

**Step 4 — Apply across all options.** If the logo's background dictates the nav's background, that constraint flows through to A, B, and C consistently. Don't let one option use the matched color and another use a different color. The brand color is decided by the logo file we received, not by our design preferences.

##### QA gate enforcement

Stage 8a `qa-check.js` checks:
- Nav header MUST contain either (a) an `<img>` referencing `/images/logo*`, OR (b) plain text containing the verbatim business name. If the nav contains any non-original-logo graphic, fail.
- **NEW**: If the logo file is opaque (no transparency in the alpha channel OR alpha is uniformly 255), the nav's background color MUST match the logo's sampled background color within a small tolerance (~5 RGB units per channel). If they don't match, fail with message: `"logo background #XXXXXX does not match nav background #YYYYYY — find a transparent variant OR change the nav background to match"`.

---

#### ICON QUALITY RULE (strict, all options — INVENTING ICONS IS OK; SHIPPING POOR ICONS IS NOT)

Real bug shipped 2026-04-28 (thetreeguy.com Option A): five service-card icons were drawn in a light tan / pale-green palette that nearly matched the cream card backgrounds — icons were barely visible. The icons themselves were drawn from scratch by the worker. **That part is allowed.** The bug was contrast and quality, not provenance.

> Unlike the LOGO RULE — where inventing is forbidden because the brand identity is sacred — **icons are decoration, and decoration is fair game**. The customer's manifest rarely contains usable service-card icons in the first place; insisting on manifest-only icons would force every build into typographic-only cards. That is the WRONG default for trades / industrial / service businesses where iconography reads instantly.

**The rule** (every option, every icon — whether scraped from the manifest, generated, sourced from icon library, or hand-drawn by the worker):

1. **Contrast ≥ 3:1 against container** (WCAG 1.4.11). The icon's dominant non-transparent color must contrast with the card / panel / background it sits on. Pale icons on pale cards FAIL. Light icons on dark cards PASS. If the design wants tonal subtlety, add a contrasting badge shape behind the icon (filled circle, rounded square in the brand accent color) so the icon-on-badge contrast is what gets measured.

2. **Consistent style across a grid.** All icons in the same card grid / feature row must come from the same visual family — same stroke weight, same fill style (outline vs solid), same corner radius, same color palette. Don't mix Material Symbols outline icons with hand-drawn flat-fill icons in the same grid. Pick one family and stick to it across that section.

3. **Top-quality assets.** If the worker invents icons:
   - SVG preferred (vector — scales cleanly at any resolution)
   - PNG fallback only if SVG isn't possible — minimum 128×128px source, 24-bit color, transparent background
   - No bitmap-fonted "icons" rendered as text-on-PNG. No grainy / dithered / JPEG-artifacted icons.
   - Drawn icons must look intentional — clean shapes, even strokes, balanced negative space. If the result looks like a child's MS-Paint drawing (the bigdaddysdumpers blob-logo equivalent for icons), it fails.

4. **Semantic match.** A house icon goes on a "Residential" card, not a "Commercial" card. A wrench icon goes on "Repairs", not "New construction". This is obvious but worth stating because workers sometimes pick aesthetically-pleasing icons that don't match the service.

5. **Material Symbols / icon-font fallback** (when SVG generation isn't worth it). Material Symbols (Outlined or Sharp variant) loaded via Google Fonts is a perfectly good zero-effort default. If using it: pick verified icon names only — the SKILL.md icon-name list is canonical. Invented names render as ALL-CAPS text and fail the build.

**Hard prohibition (all options)**: NEVER ship icons that visually disappear into their container. The "barely visible" bug is the exact thing that signals "amateur build" to the customer — even when every other rule passes.

##### QA gate enforcement

Stage 4 / 6 / 8a `qa-check.js` runs the `icon-contrast` check (added 2026-04-28):
- For every `<img>` between 16×16 and 80×80 displayed pixels, OUTSIDE nav/header/footer (logos covered separately), sample the icon's dominant non-transparent color via canvas, find the effective container background, compute WCAG contrast ratio.
- If ratio < 3.0 → **fail** with message naming the icon URL, sampled icon hex, container hex, and ratio. Suggested fixes: darker icon variant, recolor, change card background, OR add contrasting badge shape behind icon.
- Cross-origin tainted canvases are silently skipped (we can't read the pixels).
- Inline-SVG icons whose color is set via `fill="currentColor"` get caught by the generic `text-contrast` audit instead (the color flows through CSS `color`).
- Material Symbols / icon-font glyphs render as text and are likewise covered by `text-contrast`.

---

#### HERO CONTRAST RULE (strict, all options — TEXT MUST BE READABLE OVER ANY BACKGROUND)

Real bugs we shipped (2026-04-25):
- Naples FL Pressure Washing (Option C): hero with `<h1>` in dark navy text placed directly on a dark/blue-tinted pool photo. Text was barely visible.
- Tampa Bay landscape company (Option A): hero with italic display serif in dark green placed on a green-tinted photo of a paver patio. Text was barely readable.

Same bug class, different domains, different options. **The pipeline must structurally prevent text-on-photo without sufficient contrast.** Fixing this once applies to A, B, and C — every hero on every page.

##### The mandatory hero pattern

If a hero (or any section with a photo background) contains text, the markup MUST use this three-layer pattern:

1. **Background image layer** — the photo, full-bleed, behind everything
2. **Overlay/scrim layer** — a darkening or lightening layer between image and text. NOT optional.
3. **Text layer** — positioned above the overlay, with a color chosen to contrast with the overlay-treated background

**Correct (Astro/Tailwind):**
```astro
<section class="relative min-h-[600px] overflow-hidden">
  <img src="/images/hero.jpg" alt="" class="absolute inset-0 w-full h-full object-cover" />
  <div class="absolute inset-0 bg-black/60"></div>  <!-- THE OVERLAY — never skip this -->
  <div class="relative z-10 wrap py-32 text-white">  <!-- text ABOVE the overlay -->
    <h1>Hero text in white</h1>
  </div>
</section>
```

**Wrong (the bugs we shipped):**
```astro
<!-- Anti-pattern A: photo with no overlay, dark text -->
<section style="background-image: url(/images/hero.jpg)">
  <h1 class="text-navy">Hero text in dark color</h1>  <!-- invisible against dark photo -->
</section>

<!-- Anti-pattern B: photo with overlay, but text color picked without checking contrast -->
<section class="hero">
  <img class="absolute inset-0" src="/images/hero.jpg" />
  <div class="absolute inset-0 bg-green-900/40"></div>
  <h1 class="text-green-800 italic">Hero text in dark green</h1>  <!-- dark text on dark overlay -->
</section>
```

##### Overlay strength rule

The overlay's job is to neutralize the photo's variability so the text color is predictable. Pick the overlay strength based on which text color you want:

- **White / cream / light text on photo** → overlay should be **dark + at least 50% opacity** (e.g., `bg-black/60`, `bg-ink/70`). Stronger overlay (70%+) for photos that are already light.
- **Dark text on photo** → overlay should be **light/white + at least 60% opacity** (e.g., `bg-white/70`, `bg-paper/80`). Almost no one does this well — when in doubt, just use white text on a dark overlay.
- **Tinted overlay** (e.g., brand-color overlay over the photo) is allowed for atmosphere, but the resulting effective background must still produce 4.5:1+ contrast with the chosen text color. A green overlay + green text = bug.

##### Text color rule

After choosing the overlay, pick a text color that achieves **WCAG AA contrast minimum** against the overlay-blended background:
- **4.5:1** for body text and small headings (< 24px)
- **3:1** for large headings (≥ 24px or ≥ 18.66px bold)

Default safe combinations:
- Photo + dark overlay (50–70% black) + WHITE text → safe, 7:1+ typical
- Photo + light overlay (60–80% white) + INK text (#0F1419 or similar near-black) → safe, 8:1+ typical
- Photo + tinted overlay → must measure contrast manually; default to white text if unsure

##### Apply across all options

This rule applies identically to A, B, and C. Every hero section in every option must use the three-layer pattern. **There is no "minimal" or "editorial" exception** — even the most stripped-back design needs the overlay if the headline sits on top of a photo.

##### QA gate enforcement (NEW in `qa-check.js`)

For every page in the build:
1. Find every heading (`h1`, `h2`) in the first viewport (top 1000px)
2. For each heading, walk up the parent chain: does any ancestor have a `background-image`?
3. If yes → check whether there is a sibling/ancestor element with a non-transparent `background-color` (the overlay) positioned between the image and the text
4. If no overlay detected → **FAIL** with message: `"Heading '...' sits on a background-image without an overlay/scrim layer — text contrast is unpredictable. Add an overlay div between the image and the text."`
5. If overlay detected → compute the heading's computed text color and the overlay's effective background color (overlay color blended over the underlying image, approximated as 50% gray). Compute WCAG contrast ratio. If < 3:1 → **FAIL** with: `"Heading text color {hex} has only {ratio}:1 contrast against overlay-blended background {hex} (need 3:1 minimum). Choose a contrasting text color OR strengthen the overlay opacity."`

This catches both bug variants we shipped: no-overlay AND insufficient-contrast-with-overlay.

---

#### VIDEO CTA RULE (strict, all options — NEVER FABRICATE A "WATCH VIDEO" BUTTON)

Real bug shipped (2026-04-25 — morettiscentryautobody.com): the build rendered a "Watch Video" CTA button on the homepage and on the auto-body-repair page. The buttons linked to `/about` and `/contact` respectively (random pages, no video). The customer's original Hibu site had a `/hibu-video-splash` page in the manifest, which sounds like a video — but that page is a Hibu *template placeholder* containing only social share buttons, not an actual video. The worker session saw the page name, assumed a video existed, and fabricated CTAs that point nowhere useful.

**The principle**: a "Watch Video" / "Play Video" / "View Demo" / "See Our Work" video CTA may only exist if a real, embeddable video URL exists in the scraped manifest. If no real video was scraped, the CTA must not be created. There is no acceptable substitute — pointing a video CTA to `/about`, `/contact`, the homepage, or any non-video page is a bug.

##### Detecting "real video" in the manifest

A real video means ONE of the following appears in the manifest, in `assets/html/*.json`, or in raw scraped HTML:

- A `<iframe>` whose `src` matches: `youtube.com/embed/`, `youtu.be/`, `youtube-nocookie.com/embed/`, `player.vimeo.com/video/`, `wistia.com/embed`, `loom.com/embed`, `fast.wistia.com`, `vidyard.com/embed`
- An `<a href>` pointing to: `youtube.com/watch?v=`, `youtu.be/`, `vimeo.com/<id>`, a `.mp4` / `.webm` / `.mov` file URL
- A `<video src=...>` element with a `.mp4` / `.webm` / `.mov` source
- A scraped JSON-LD VideoObject

If none of those exist for a customer, **the customer has no embeddable video**. Period. Don't create a video CTA.

##### Allowed responses when no real video exists

1. **Drop the CTA entirely.** Replace the section with a different content block (image gallery, testimonial, services grid, contact CTA) drawn from manifest content.
2. **Convert to a static "before / after" image carousel** if the customer has multiple work-photos in the manifest — relevant for trades, auto body, landscaping. Same visual real estate, real content.
3. **Replace with a primary CTA** (Call now, Get a quote, Visit us). Functional, points somewhere useful.

##### Forbidden responses

- ❌ "Watch Video" button linking to a non-video page (`/about`, `/contact`, `/`, `#`, `javascript:`)
- ❌ Inventing a YouTube embed with a placeholder ID (`youtube.com/embed/dQw4w9WgXcQ` or any other guessed video ID)
- ❌ Linking to the customer's `/video-splash` page when that page itself contains no actual video (Hibu placeholder pattern)
- ❌ Inventing a video poster/thumbnail with a play-button overlay that goes nowhere

##### QA gate enforcement (NEW in qa-check.js)

For every page in the build:
1. Find all elements containing the visible text "Watch Video" / "Play Video" / "View Video" / "See Video" / "Watch Our Story" / "Watch Demo" (case-insensitive)
2. For each, walk up to the nearest `<a href>` ancestor (or check the element itself if it's an anchor)
3. Check the `href`:
   - If it's a video URL (matches the patterns above) → pass
   - If it's a `tel:`, `mailto:`, or `#anchor` to a section containing a real video → pass
   - If it points to ANY other URL (internal page, external site, placeholder) → **FAIL** with: `"'Watch Video' button on {page} points to {href} which is not a video resource. Either wire a real video embed (YouTube/Vimeo/MP4) OR drop the CTA entirely (see VIDEO CTA RULE in SKILL.md)."`
4. Also fail if a play-button-styled element (icon `▶`, `play_arrow`, SVG with `M8 5v14l11-7z`-style polygon path) sits inside an `<a>` whose href is not a video resource — catches the "fake play button" pattern.

This rule applies pipeline-wide (A, B, C). One real bug, one structural fix.

---

#### IMAGE REUSE RULE (architectural — applies to Option A; Option C uses curated subset)

Real bug shipped 2026-04-29 (giffins.net + ifixplumbing.com): Option A drifted into editorial / NYT-magazine layout — bracket-numbered eyebrows, file-tab labels, ALL-CAPS condensed display titles, **typographic-only service cards with no photos**, no portfolio / gallery section. The customer's original site was a small-business contractor's website with photos of the work; the rebuild ended up looking like a magazine. The customer's verbatim feedback: *"It used to be a website that had images that somehow looked like the original website. Right now it looks like a magazine, which is the Claude Design aesthetic. But we wanted to reserve [editorial] for Option C while Option A aligns a little more with the original."*

Concrete numbers from giffins.net: the scraper captured **89 image records** (70 real customer-work photos after filtering badges and tiny icons). Option A's `index.astro` rendered **0** `<img>` tags. The home page used **0** of the 70 must-reuse photos. Pipeline-wide reuse ratio: ~15% (only the hero backgrounds survived). All 60+ work photos sat unused in `public/images/`.

Root cause: after the 2026-04-25 pivot from monolithic-template-copy to scaffold + inspiration architecture, Option A workers reach for `templates/inspiration/industrial-trades/` and find editorial design language (bracket eyebrows, file-tab nav, hard 90° corners, ALL-CAPS condensed display) — the same vocabulary `industry-tokens.json` uses for **Option C**. The plugin's natural editorial bias leaks into Option A. There was no qa-check gate for image-density, so a typographic-only Option A passes QA cleanly.

##### The rule

**For Option A: at least 90% of must-reuse manifest images MUST be rendered in the rebuild.** The remaining ≤ 10% can be skipped only for genuine quality reasons (≤ 100px wide icons, third-party badges, broken/missing files, duplicates). Customer photos depicting the actual business — work shots, crew photos, portfolio items, before/after, gear, trucks, jobsites — must all appear somewhere on the rebuilt site. The rebuild stays a small-business website with photos of the work, just suddenly expensive.

**Definition of "must-reuse"** (the denominator for the 90% rule):
- A foreground `<img>` record from `manifest.pages[*].images`, OR a CSS background-image record from `manifest.pages[*].backgroundImages`
- AND has a non-null `localPath` (was actually downloaded by the scraper)
- AND is NOT one of the following exclusions:
  - `width >= 1 && width < 100` — tiny icon (social pip, dingbat, 1×1 tracking pixel)
  - `alt` matches `/bbb|better business|yelp|google review|trustpilot|angie|home advisor|verified by|accredited|certified by/i` — third-party rating badge
  - `localPath` matches `/favicon|spinner|loading|placeholder/i` — utility asset
  - Detected as a duplicate of another image in the inventory by content hash (e.g. the BBB seal saved 6 times because it appeared on every page → counts once)
  - The customer's logo (only the smallest size variant — full-bleed logo photos like "logo over a forest path" 1920×1458 ARE work photos and DO count)

**Definition of "rendered"** (the numerator):
- The image's basename appears as the `src` of any `<img>` tag in any built `dist/**/*.html` file, OR
- The image's basename appears in any inline `style="background-image: url(...)"` declaration, OR
- The image's basename appears inside any inline `<style>` block as a `url(...)` reference, OR
- The image's basename appears inside any external CSS file referenced by the build

Cross-page reuse is fine: the same hero photo can serve as the hero on `/` and the secondary card on `/about`. Each unique basename counts once.

##### Why 90% and not 100%

10% slack covers:
- Images the scraper grabbed that turned out to be utility / chrome assets (small badges, social pips, malformed SVG variants the worker correctly chose to skip)
- Images that are genuinely low-quality (50% JPEG artifacts, screenshots of someone else's site, images < 200×200 that weren't caught by the width filter)
- Image variants of the same photo (the scraper sometimes captures `image-300w.jpg` AND `image-1920w.jpg` — only one needs to render)

If the worker is dropping more than 10% of the must-reuse pool, the design is wrong: typographic-only service cards, missing gallery section, missing about-us section — find the structural omission and fix the layout, don't filter the image inventory to fit a magazine layout.

##### What the worker should DO with all those photos (Stage 3b guidance)

Don't just dump them into a single carousel. The right pattern for trade customers:
1. **Hero**: one full-bleed work photo per page (not the same photo on every page — pick a different one per service)
2. **Service tiles / service cards**: each service has a representative work photo as part of the card. Tree Removal → photo of crew clearing a tree. Tree Trimming → photo of a manicured tree. Property Management → photo of a managed property. Text-only service cards are the failure mode.
3. **Portfolio / gallery / "Recent Work" section**: a 6-12 image grid of customer-work photos somewhere on the home page (modeled on `https://elysian-gc-786s9d1zc-tomek-group.vercel.app` — "A craftsman's portfolio — photographed honestly"). This single section absorbs 6-12 photos in one move.
4. **About / crew / team section**: photos of the owner, the crew, the trucks, the equipment. Small contractors WANT to show that they're real people with real gear.
5. **Inline accent photos in long-form pages** (blog articles, service pages): break up text-heavy sections with relevant work photos.
6. **Footer / closing CTA**: optional one more photo as a backdrop.

If your home page can fit 8-12 photos using the patterns above, you're at the right density. If your home page has 0-2 photos, you've drifted to magazine layout — restructure.

##### What this rule is NOT

- It is NOT a license to cram unrelated photos into a page. If a service has only one good photo, use that one — don't stack three different photos on a single tile. Cohesion still matters.
- It is NOT a quota that mandates duplicating the same photo. Each photo counts once across the site; reuse the inventory by spreading distinct photos to distinct contexts (hero / cards / portfolio / about / inline).
- It is NOT applicable to **Option C**. Option C is plugin-driven and curates a subset for editorial impact — its `industry-tokens.json` already has its own imagery directive ("USE the customer's scraped photos AGGRESSIVELY at full-bleed" for trades, but with editorial selection). The 90% gate applies to A only. **AND** (added 2026-04-29): Option C has an explicit image-quality escape hatch — see `OPTION C IMAGE-QUALITY ESCAPE HATCH` rule below.
- It does NOT apply to **Option B**. B inherits A's design verbatim — if A satisfies the rule, B will too. (qa-check enforces this on A, not B.)

##### QA gate enforcement (NEW in qa-check.js)

`scripts/qa-check.js` accepts a new `--option <a|b|c>` flag. When `--option a` is passed AND `--manifest <path>` is also passed:

1. Parse `manifest.pages[*].images` and `manifest.pages[*].backgroundImages` into a flat inventory keyed by basename
2. Apply the must-reuse classifier (see "Definition of must-reuse" above)
3. Walk every `dist/**/*.html` file (computed from the served URL → corresponding dist tree) AND every `dist/**/*.css` file, collect every referenced image basename
4. Compute `rendered ∩ must-reuse / |must-reuse|`
5. If ratio < 0.90, **FAIL** the build with a message naming the ratio + the count of unused photos + the first ~5 unused basenames + the suggestion to "add a portfolio / gallery section, photo-per-service-card, or about-the-crew section to absorb them" — pointing at IMAGE REUSE RULE in SKILL.md

The check runs once per QA invocation (not once per page) since reuse is a site-wide property. If `--option` is not passed OR `--manifest` is not passed, the check is skipped silently (back-compat for existing invocations).

##### What this rule rules out

- Magazine / NYT editorial Option A with no body photos
- Typographic-only service cards (one card per service with NO image)
- Skipping the gallery section because "the design felt cleaner without it"
- Reaching for `templates/inspiration/industrial-trades/`'s editorial bracket-labels + file-tab nav + condensed display + zero-photo layouts — those moves belong to Option C, not A
- Worker arguing "the photos weren't great" as justification for dropping more than 10% of the pool. If a photo is genuinely unusable (1×1 px, broken file), it falls in the skip-list. Otherwise it appears.

The customer's original site is the input. Option A's job is to render that input dramatically better — same kind of site, same content, sharper craft. Not to reframe the customer as an editorial brand.

---

#### OPTION C IMAGE-QUALITY ESCAPE HATCH (architectural — applies to Option C only)

User clarification 2026-04-29: *"If original images are poor, Option C can use AI generated or stock images where thematically appropriate."* This is the carve-out that lets C deliver design-quality output when the customer's actual photos can't carry the design language.

##### Why this exists

Option A's purpose is faithful rebuild — the customer's actual photos ARE the content; quality variance is a customer-truth signal, not a design problem to solve. Option C's purpose is plugin-driven design impact — and a 380×285px JPEG with compression artifacts cannot drive a full-bleed 1920px hero, no matter how aggressively the plugin tries. When customer photos materially undermine C's design intent, C is allowed to substitute.

The escape hatch only applies to C. **Option A and Option B always use the customer's actual photos** — A's faithful-rebuild contract is non-negotiable.

##### When the escape hatch is justified

- **Resolution insufficient for use context**: photo natural-width < 1.5× displayed-width (e.g. 800px source on a 1440px hero). The existing `image-low-resolution` qa-check rule catches this for stretched images. Whenever C would otherwise stretch a customer photo, the escape hatch is justified.
- **Compression artifacts visible**: heavy JPEG block-noise, banding, or low-quality scaling artifacts visible at the displayed size. Judgment call — eye it.
- **Subject quality genuinely unusable**: blurry / off-color / oversaturated CMS-applied filter that can't be undone / framing where the subject is unrecognizable.
- **Detected CMS placeholder content**: stock-from-the-CMS-template assets that the customer never replaced (covered separately by `CMS PLACEHOLDER PRINCIPLE` — those should be filtered out entirely from the image inventory anyway).
- **Coverage gap for a section the design needs**: e.g. C's industry-tokens calls for a featured "owner / lead crew" portrait, but the customer has no headshot in the manifest. The right response is usually to OMIT the section (per AboutCrew docs in the photo-led inspiration). Substituting a stock portrait is allowed ONLY when the section is structural to the design and removing it breaks the layout.

##### When the escape hatch is NOT justified

- Worker doesn't like the customer's photos aesthetically. ("These photos look amateur" — that's the customer's actual brand. A is faithful; C uses the same photos with editorial framing where possible.)
- Worker wants to make the page "feel premium" by replacing real work with stock. Customer recognizes their own jobs in A and not seeing them in C reads as "you replaced our work with stock photos." Failure mode.
- The escape would substitute the **owner / crew / team / actual logo** — those are brand-truth, never substitute. If no headshot exists, omit the section.

##### Substitution criteria — must be all four

1. **Thematically tight**: a tree-service C uses tree-work stock; a plumber C uses plumbing-fixture stock. Generic stock photos of "happy professional" or "modern building" fail this. The substituted image must depict the customer's actual industry / service.
2. **Aesthetically compatible with the design language**: editorial restraint on a refined-modern brand; workwear-grit on a trades brand. The substitute must match C's industry-tokens direction, not just the industry.
3. **Quality genuinely high**: ≥ 1500px wide, no AI-uncanny tells (extra fingers, melted textures, generic stock-photo lighting). Use Unsplash, Pexels, or curated AI sources only — not raw model output.
4. **Documented in `jobs/{domain}/option-c/build-design-decisions.md`**: every substitution gets a single line stating which slot was substituted, what the original was (source URL, dimensions), why it was substituted, what the replacement is (source URL or AI prompt). Customer can audit.

##### Allowed substitution sources

- **Unsplash** (`https://images.unsplash.com/...`) — free stock, commercial-license-friendly. The default fallback.
- **Pexels** (`https://images.pexels.com/...`) — free stock, similar profile.
- **AI-generated via curated sources** (Lummi, Civitai-curated commercial models, etc.) — only when stock doesn't have the right subject. Avoid if the result has uncanny tells.
- **Existing customer photos from a different page** — sometimes the customer has a great photo on `/about` that would work better on the home hero. That's not "stock substitution"; it's curation. Always prefer this when possible.

##### Forbidden substitution sources

- ❌ Random Google Images results (license unclear)
- ❌ Generic AI prompts that produce stock-photo aesthetic without industry specificity
- ❌ Photos of competitors or other businesses
- ❌ Anything that depicts a different industry from the customer's

##### How to apply

If during Stage 7 build you encounter a customer photo that won't carry its slot:

1. First try a different customer photo from the manifest. Many customers have one "hero-grade" photo and ten "card-grade" photos — match resolution to use context.
2. If no customer photo fits, omit the photo and adjust the layout (e.g. tighter typographic hero with overlay-only color, no photo).
3. Only if (1) and (2) both fail, substitute. Document in `build-design-decisions.md`.

##### Visual Sanity Pass check

When reviewing C's screenshots, ask: "Are any of these photos NOT the customer's actual work?" If yes, are they (a) thematically tight, (b) aesthetically compatible, (c) high quality, AND (d) documented? If any of the four fails, swap back to a customer photo or omit. The bar is honest visual representation — substitutions that make the customer look bigger or more polished than they are read as deceptive.

---

#### MULTILINGUAL SUPPORT (architectural — Options B and C; A stays English-only)

User clarifications:

- 2026-04-30 (initial): *"Options B and C now need to include Spanish, also, make sure we do the translation once, as Option B and C should have the same copy or VERY close."*
- 2026-04-30 (extension): *"We need the ability to add a language version. Once we build a website … I want to be able to say 'add French' or 'add German' and then specify the option … 'add German to option B' or 'option C' or both. Of course not option A. The languages we need to support are German, Russian, Italian. It should be flexible: just type in a language and it builds it."*
- 2026-04-30 (default flip): *"When we run webfactory skill with no language options, do English only. Do not automatically build Spanish unless we run the skill with language options. Spanish will be added later. So the marketing — the initial run is English only. Spanish, French, or other languages will be added later."*

**THE DEFAULT IS ENGLISH-ONLY.** Initial `/webfactory <url>` invocations build B and C as English-only — no `/es/`, `/de/`, or any other `/<lang>/` directories are created, no language switcher in the nav, qa-check's multilingual rules silently no-op. The customer / marketing-facing run is always English first; translations are added later, only when explicitly requested. Option A is ALWAYS English-only regardless of flags — its faithful-rebuild contract is non-negotiable.

##### The rule (two opt-in paths, no default-on)

**Path 1 — `--languages` flag (initial-build, opt-in)**: pass `--languages <comma-separated-iso-codes>` to build N additional languages alongside English in B and C from the start.

```
/webfactory <domain> --languages es                    # English + Spanish
/webfactory <domain> --languages es,de                 # English + Spanish + German
/webfactory <domain> --languages es,de,fr,it,ru        # 5 non-English + English
/webfactory <domain> --languages Spanish,French        # English-name accepted (resolved via the table below)
/webfactory <domain> --skip-c --languages es           # combine freely (English + Spanish for B only; C is skipped)
```

Each requested language runs through Stage 5f/5g/5h conditionally during the initial build (parallel Sonnet sub-agents translate per page; output to `option-b/src/pages/<lang>/*.astro`). Option C reads from B's `/<lang>/` files at Stage 7 — single source of truth. The Nav switcher renders ALL active languages including English. qa-check's multilingual rules fire automatically when `/<lang>/` paths exist.

**Path 2 — `--add-language` flag (post-build, incremental)**: any language (or set of languages) can be added to an EXISTING build via:

```
/webfactory <domain> --add-language <name|iso> --to <b|c|both>
```

Examples:

```
/webfactory giffins.net --add-language German --to B
/webfactory giffins.net --add-language Russian --to C
/webfactory giffins.net --add-language Italian --to both
/webfactory giffins.net --add-language fr --to B,C    # ISO code accepted
```

The flow runs a focused mini-pipeline (~5 min wallclock for a 6-page site): per-page Sonnet sub-agents in parallel translate from English to the target language, write to `option-b/src/pages/<lang-code>/*.astro` (and to `option-c/src/pages/<lang-code>/*.astro` if `--to` includes c), update each affected option's Nav language switcher (or insert one if previously English-only), build, qa-check, redeploy. Same Vercel project + new deployment hash. See `Stage AL` below for the full mini-pipeline.

**Combinable**: Path 1 + Path 2 work together. A site initially built with `--languages es` can later receive `--add-language de --to both` to extend to German. The orchestrator detects the union of `option-b/src/pages/<lang>/` directories at any moment to compute "active languages."

##### Supported language codes + translation tags

Resolve `--add-language <input>` to ISO 639-1 code via this table (case-insensitive). The translation tag is what appears below the testimonial attribution in `/<lang-code>/` pages.

| Input (English name OR ISO code) | ISO code | Native name | Translation tag |
|---|---|---|---|
| Spanish / es | `es` | Español | `(traducido del inglés)` |
| German / de / Deutsch | `de` | Deutsch | `(aus dem Englischen übersetzt)` |
| Russian / ru / русский | `ru` | Русский | `(переведено с английского)` |
| Italian / it / Italiano | `it` | Italiano | `(tradotto dall'inglese)` |
| French / fr / Français | `fr` | Français | `(traduit de l'anglais)` |
| Portuguese / pt / Português | `pt` | Português | `(traduzido do inglês)` |
| Polish / pl / Polski | `pl` | Polski | `(przetłumaczone z angielskiego)` |
| Chinese / zh / 中文 | `zh` | 中文 | `(从英语翻译)` |
| Japanese / ja / 日本語 | `ja` | 日本語 | `(英語からの翻訳)` |
| Korean / ko / 한국어 | `ko` | 한국어 | `(영어에서 번역됨)` |
| Dutch / nl / Nederlands | `nl` | Nederlands | `(vertaald uit het Engels)` |
| Swedish / sv / Svenska | `sv` | Svenska | `(översatt från engelska)` |
| any other valid ISO 639-1 | (the code) | the native name | `(translated from English)` (English fallback when language tag isn't in the table) |

If the user types something unmappable (`--add-language Klingon`), the flow fails fast with: `"Klingon" not recognized. Provide a language by English name (German, Russian, Italian, French, …) or ISO 639-1 code (de, ru, it, fr, …). See SKILL.md MULTILINGUAL SUPPORT for the supported language table.`

##### File layout (canonical, generalized to N languages)

```
option-a/src/pages/index.astro            ← English (faithful rebuild) — A is monolingual, NEVER /es/, /de/, etc.
…

option-b/src/pages/index.astro            ← English (B's design + B's English text)
option-b/src/pages/es/index.astro         ← Spanish — present only if --languages=es passed at build OR --add-language es --to b post-build
option-b/src/pages/de/index.astro         ← German — present only if --languages includes de OR --add-language de
option-b/src/pages/ru/index.astro         ← Russian — present only if --languages includes ru OR --add-language ru
option-b/src/pages/it/index.astro         ← Italian — present only if --languages includes it OR --add-language it
…

option-c/src/pages/index.astro            ← English (C's design + B's English text)
option-c/src/pages/es/index.astro         ← Spanish (C's design + B's ES text from option-b/src/pages/es/)
option-c/src/pages/de/index.astro         ← German (C's design + B's DE text from option-b/src/pages/de/)
…
```

URL routing follows file paths: `/services` (English), `/es/services` (Spanish), `/de/services` (German), etc. Cross-language switcher in nav links each page to its translated counterparts.

##### What gets translated (same for all target languages)

**Translate** (everything customer-facing visible on the page):

- Page text — headlines, subheads, body copy, CTAs, form labels, footer text
- Image `alt` attributes
- `<title>` and `<meta name="description">`
- Nav labels (per-language; provide canonical mapping when the source page is built)
- Section labels and category eyebrows
- Button text and link text

**Do NOT translate** (proper nouns, technical IDs, factual fixed strings — single source of truth across ALL languages):

- Phone numbers (`740-571-6387` stays `740-571-6387` everywhere)
- Email addresses
- License numbers (`SCC131153066`, `PA-128744`)
- Place names (`Tampa`, `Lancaster`, `Circleville`, `Ohio`) — keep original even when wrapped in target-language prose
- Business names (`Giffin's Tree Service & Property Management`)
- Founder / employee / customer names (`Bob Giffin`, `Mark S.`)
- Brand names (`Trane`, `Carrier`, BBB acronym, etc.)
- License-issuing-authority names
- All `<img src="…">` paths (same images everywhere; only `alt` is translated)

##### Testimonials in any non-English language

Translate the testimonial body. Append `<small>{translation-tag}</small>` below the `<cite>` element where `{translation-tag}` is the per-language tag from the table above. Attribution name stays original.

Example — German `option-b/src/pages/de/index.astro`:

```astro
<blockquote>"Beste Preise, ausgezeichnete Arbeit! Drei Bäume zu einem unglaublichen Preis entfernt …"</blockquote>
<cite>— Mark S. <small>(aus dem Englischen übersetzt)</small></cite>
```

The translation tag is **mandatory** on every translated testimonial in every non-English language. qa-check enforces presence per-language.

This carve-out interacts with TESTIMONIAL & REVIEW PRESERVATION RULE: that rule's *byte-identical-to-A* check applies to ENGLISH testimonials only. Translated testimonials in `/<lang>/` are exempt from the English-comparison rule, but ARE checked against B's `/<lang>/` (so C's translated testimonials must match B's translated testimonials byte-identical — no per-option drift in any translation).

##### `<html lang>` attribute and meta

Every `/<lang-code>/` page MUST set `<html lang="<lang-code>">`. Every English page MUST set `<html lang="en">`. Implementation: BaseLayout accepts a `lang` prop (defaulting to `"en"`), and `/<lang-code>/*.astro` pages pass the right code when rendering BaseLayout.

`<meta name="description">` MUST be in the page's language (Spanish on `/es/`, German on `/de/`, etc.).

##### Language switcher (mandatory in nav for Options B and C, generalized to N languages)

Every page in Options B and C must include a visible language switcher in the nav. The switcher:

- Renders ALL currently-active languages (detected from `option-{b|c}/src/pages/<lang>/` directories at build time)
- Each entry links the current page to its parallel translation
- The currently-active language is visually distinct (or rendered as a non-anchor span — not clickable)
- Each entry has `aria-label` referencing the target language ("Switch to English", "Cambiar a Español", "Auf Deutsch wechseln", "Перейти на русский", "Passa all'italiano", "Passer au français", etc.)
- Tap target ≥ 44×44px per item
- Sits in the nav, NOT a footer-only link

**Style variants (workers pick by language count)**:

- **≤ 3 active languages**: simple toggle row (`EN | ES | DE`). Each item is a separate `<a>`. Active language is bold + non-clickable (rendered as `<span>` instead of `<a>`).
- **≥ 4 active languages**: dropdown menu. The dropdown trigger shows the current language (e.g. `ES ▾`); the menu lists the others. Use `<details>/<summary>` for no-JS toggle compatibility.

Both variants must work on mobile (44px tap targets, dropdown opens on tap not hover).

Option A NEVER includes a language switcher.

##### What stays the same across all languages (single source of truth)

- Phone numbers, emails, license numbers, place names, business names, founder names, customer review attribution names, brand names — all strings unchanged
- All images — same `src` paths in EN and every translated language (image `alt` attributes ARE translated)
- All structural markup — components, layout, section order, grid configs are identical between `/index.astro` and `/<lang>/index.astro`
- Logo, favicon, social links, footer addresses
- Pricing and numeric facts (years in trade, customer counts, response time guarantees)

Each translated version is **the same site in another language**, not a different site.

##### Initial-build stage allocation (English-only by default; conditional translation stages when `--languages` is passed)

- **Stage 1 (scrape)**: unchanged.
- **Stage 2 (design brief)**: unchanged.
- **Stage 2.5 (per-page specs)**: if `--languages` is passed, each spec includes a *translation* section listing strings to translate and strings to leave alone for each requested language. Without `--languages`, the translation section is omitted (English-only specs).
- **Stage 3 (Build A)**: unchanged. A is ALWAYS English-only, NEVER ships translations regardless of flags.
- **Stage 4 (QA A)**: unchanged.
- **Stage 5 (Build B)**: each Sonnet sub-agent produces `option-b/src/pages/<page>.astro` (English rewrite) UNCONDITIONALLY. Substages 5f/5g/5h are CONDITIONAL on `--languages`:
  - If `--languages` is omitted → skip 5f, 5f, 5g, 5h entirely. B is English-only.
  - If `--languages es,de` → for each requested language, the same sub-agent ALSO produces `option-b/src/pages/<lang>/<page>.astro`. 5g (language switcher) renders all active languages. 5h verifies parity across all active languages.
- **Stage 6 (QA B)**: QA-checks `/` always; QA-checks `/<lang>/` pages only for languages active in B's `src/pages/`. Multilingual qa-check rules silently no-op on English-only builds.
- **Stage 7 (Build C)**: plugin reads English from B unconditionally. For every active language in B (detected at Stage 7d-spec time), plugin ALSO reads B's `/<lang>/` files. C produces 1 English + N translated `.astro` files per page where N = active languages. With no active languages, C is English-only.
- **Stage 8a (deploy gate)**: multilingual parity check fires only when ≥1 non-English language is active in B's dist. English-only builds skip the multilingual rules entirely (no fail, no warn — silently no-op).
- **Stage 8b (deploy)**: unchanged.

##### Add-language flow (Stage AL — incremental)

Triggered by `/webfactory <domain> --add-language <name|iso> --to <b|c|both>`. Mini-pipeline (NOT the full 10-stage):

**AL1. Parse + validate**

- Resolve `--add-language <input>` → ISO code via the language table. Fail fast if unmappable.
- Parse `--to <list>`:
  - `B`, `b` → target Option B only
  - `C`, `c` → target Option C only
  - `both`, `b,c`, `B,C` → target both
  - Invalid input → fail fast
- Validate the build exists: `jobs/{domain}/option-b/dist/` (and `option-c/dist/` if --to includes c). If missing → fail fast with: `Cannot add language to <option> — no existing build at jobs/{domain}/option-{x}/dist/. Run /webfactory <url> first to produce the initial (English) build.`
- Check whether the language already exists: if `option-b/src/pages/<lang>/` exists with all expected pages → warn + ask to overwrite, OR if `--force` flag passed, overwrite without prompt.

**AL2. Per-page translation workers (parallel)**

For each `.astro` file in `option-b/src/pages/` at the TOP level (NOT recursing into existing `/es/`, `/de/`, etc. — only English source pages):

- Spawn a Sonnet sub-agent via `Agent({ subagent_type: 'general-purpose', model: 'sonnet' })`
- Brief includes:
  - Source: this English page (`option-b/src/pages/<page>.astro`)
  - Target language: `{full English name}` (ISO code: `<lang-code>`, native name: `{native}`, translation tag: `{tag}`)
  - Translation directives (same as Stage 5f, parameterized for the new language)
  - Output to: `option-b/src/pages/<lang-code>/<page>.astro`
  - Pass `lang="<lang-code>"` when rendering BaseLayout
- Wait for all sub-agents to complete

**AL3. Update Nav.astro language switcher in B**

- Read existing `option-b/src/components/Nav.astro`
- Detect the list of active languages by reading `option-b/src/pages/` subdirectories (each one named with an ISO code is an active language)
- Update the switcher rendering logic:
  - If ≤ 3 active languages → toggle row pattern
  - If ≥ 4 active languages → dropdown pattern
- Wire each entry to point at the correct parallel page in its target language
- Wire each entry's `aria-label` from the language table

**AL4. If --to includes c: build C's `/<lang-code>/` pages**

- Read B's freshly-translated `option-b/src/pages/<lang-code>/*.astro` files (canonical translation)
- For each page, spawn a Sonnet sub-agent that renders the same translated text in C's design (uses C's components, palette, ornament — but the text is byte-identical to B's translation)
- Output to: `option-c/src/pages/<lang-code>/<page>.astro`
- Update `option-c/src/components/Nav.astro` similarly to AL3

**AL5. Build + QA + deploy affected options**

- For each affected option (B, C, or both):
  - `cd jobs/{domain}/option-{x}/`
  - `rm -rf dist .astro && npm run build`
  - Run `qa-check.js` with `--option {x}` and the path list now including `/<lang-code>/` paths AND every previously-active language path. Pass `--reference-dist-i18n jobs/{domain}/option-b/dist` to enable the multilingual testimonial-tampering check.
  - If qa-check fails: fix-loop (same as Stage 4/6/8a) before proceeding.
  - `npx vercel build --yes`
  - `npx vercel deploy --prebuilt --yes` (same Vercel project — new deployment hash, previous URL stays accessible until evicted but the canonical URL is the new one)

**AL6. Report**

Emit a focused report with:

- Language added: `{full English name}` (ISO `<lang-code>`)
- Target option(s): B / C / both
- New deployment URL(s) for affected option(s)
- Total active languages now on each affected option (e.g., `B: EN, ES, DE` after adding German to B)
- Per-language URL examples (e.g., `https://giffins-net-option-b-X.vercel.app/de/services`)

##### Cost impact (English-only baseline; per-language additions itemized)

**Default initial build (English-only — no `--languages` flag)**: NO multilingual cost. Stage 5/6/7 run exactly as they did before any multilingual rule existed. This is the new baseline; previous "+25-40%" overhead is gone unless the user opts in.

**Initial build with `--languages <list>`** (per language code added):

- Stage 5: ~25-35K Sonnet per page per added language — total ~150-210K Sonnet × N codes
- Stage 7: 6 + 6N pages built (EN + N translations) — total ~50K + ~50K × N Sonnet on top of English-only Stage 7
- Per-build total: +20-30% per added language vs English-only baseline (so `--languages es,de` ≈ +40-60%; `--languages es,de,fr` ≈ +60-90%)

**Each `--add-language` invocation** (~5 min wallclock for a 6-page site, `--to=b` only):

- AL2: ~25-35K Sonnet per page × N pages = ~150-210K Sonnet for the translation
- AL3: Opus ~10K to update Nav switcher in B (if Nav previously had no switcher because the build was English-only, AL3 INSERTS one)
- (if `--to=both`): AL4 also runs Sonnet workers for C's render = another ~150-210K Sonnet
- AL5: build + qa-check + deploy = ~30K Opus
- Per-language-add total: ~150-250K Sonnet + ~40K Opus per affected option

##### QA gate enforcement (`qa-check.js`)

Four rules, gated on `--option <b|c>`:

1. **`multilingual-page-parity`** (renamed from `bilingual-page-parity`) — for every English page in `dist/`, every active language must have a parallel `<lang>/<same-path>` page (and vice versa). Detection: walks `dist/` for top-level `<lang-code>/` directories. Active languages = the directories found. Fails build if any orphan in any language.
2. **`language-switcher-presence`** (generalized) — nav must contain anchors / span entries for ALL active languages on the site. Each entry's `aria-label` must reference the target language (per the language table). The currently-active language is rendered non-clickable (no orphan toggle to "current page").
3. **`html-lang-attribute`** (generalized) — `<html>` element's `lang` attribute matches the URL path: `lang="<lang-code>"` for `/<lang-code>/*` URLs, `lang="en"` for non-prefixed URLs. Fails on mismatch for any active language.
4. **`testimonial-tampering` (extended for any language)** — when checking a `/<lang-code>/` page, compare testimonial bodies against B's `/<lang-code>/` (passed via `--reference-dist-i18n <path>`). Each translated testimonial MUST also have the per-language translation tag (from the table) below the attribution — qa-check verifies the tag is present near the `<cite>` element.

CLI flag changes:

- `--reference-dist-es <path>` → DEPRECATED ALIAS for `--reference-dist-i18n <path>`. Both still parse; canonical name is `--reference-dist-i18n`. Points at `option-b/dist` (which contains `/es/`, `/de/`, `/ru/`, etc. as subdirectories).
- The qa-check loads testimonials from EVERY `<lang-code>/` subdir under `--reference-dist-i18n` into per-language reference sets, then routes each page check to the right set based on its URL prefix.

##### What this rule does NOT do

- It does NOT translate Option A. Ever.
- It does NOT build any non-English language by default. The default `/webfactory <url>` invocation produces English-only B and C. Translations are explicit opt-in via `--languages` (build-time) or `--add-language` (post-build).
- It does NOT support all languages everywhere — only the ISO 639-1 codes in the table above (and any other valid ISO 639-1 code with English-fallback translation tag). Hindi, Arabic, Hebrew (RTL languages) need additional rendering work — flagged but not yet supported. If a customer needs RTL, that's a separate skill extension.
- It does NOT auto-translate via external services (Google Translate, DeepL). Translation is produced by the Stage 5 (or AL2) Sonnet workers themselves, which have the manifest context + brand voice.
- It does NOT apply to existing builds before a given language was added. Each `--languages` or `--add-language` invocation is explicit per-build.

---

#### NUMBERED SECTION LABELS RULE (architectural — applies to Option A; rare in B; OK in blog/article only)

Real bug shipped 2026-04-29 (giffins.net Option A rebuild): every section sprouted a numbered eyebrow — `01 — WHAT WE DO`, `02 ── RECENT WORK`, `[ 03 ] · NEW: PROPERTY MANAGEMENT`, the Hero `01 │ SE OHIO · 30+ YRS`. The pattern was inherited from `templates/inspiration/industrial-trades/`'s editorial vocabulary AND from the new `industrial-trades-photo-led/` inspiration's `01 / SECTION` mono caption. Customer feedback verbatim: *"what are these numbers, NO!!! I do not want that ever unless a blog or an article section. So VERY rarely."*

##### The rule

For Option A and Option B: **bracket-numbered or slash-prefixed numeric eyebrows are FORBIDDEN on non-blog/non-article pages.** That includes ALL of:

- `01 — SECTION NAME` (slash-eyebrow with numeric prefix)
- `[ 02 ] · CATEGORY` (bracket-numbered eyebrow)
- `01 / SERVICES` (mono-prefix-then-slash)
- `§ 01 · DIY RISK` (section-symbol + number)
- `SVC · 01` (any decorative numbering of section eyebrows)

Numbered section labels are an editorial / magazine affectation. Small-business contractor websites don't number their sections. Customers don't read websites the way they read magazine spreads. The numbering doesn't aid wayfinding — section headings already do that. It just signals "this was designed by someone who reads NYT Magazine."

##### Where it IS acceptable (rarely)

- **Blog index pages** with a numbered article list: "01. Top 5 signs..." — IF the source content actually has a numbered list, not as decorative chrome
- **Long-form blog articles** with explicit ordered-list content (e.g., "Top 5 Signs You Need a Pro" → `01 Branches over your roof / 02 Dead limbs / 03 ...`) where the numbering REPLACES `<ol>` semantics with visual prominence
- **Industry-tokens-driven Option C** when the industry direction explicitly calls for it (industrial / trades C uses bracket numerals as workwear-document signal)

That's it. Not for service sections, not for testimonial sections, not for "Recent Work", not for hero eyebrows, not for footer ornament.

##### What replaces it

- For Option A eyebrow: **the category label alone**, optionally with a hairline rule to its left. `WHAT WE DO`, `RECENT WORK`, `WHERE WE WORK` — no number prefix.
- For Hero eyebrow: drop the leading number. `SE OHIO · 30+ YRS · FREE ESTIMATES · 24/7 EMERGENCY` is plenty without `01 │`.
- For Service tile category: just the category. `EXTERIOR · ROOFING` — no `01`.
- For Portfolio caption: location + date. `OAK ST · OCT '25` — no `04 / RECENT WORK`.

##### QA gate enforcement (NEW in `qa-check.js`)

`scripts/qa-check.js` adds a `numbered-section-labels` check (Option A/B only):

1. For each page, find every element matching `eyebrow`, `mono-caption`, or `label-mono` class — these are the visual eyebrow utility classes
2. Check the rendered text for the patterns:
   - `^\s*(\[\s*)?\d{1,2}(\s*\])?\s*[/—·│|§]` — leading 1-2 digit number with editorial separator (`01 — WHAT WE DO`, `[ 02 ] · CATEGORY`, `§ 03 · DIY RISK`)
   - Standalone digit-only eyebrow `^\s*\d{1,2}\s*$` (decorative number with no following label)
3. If matched AND the page is NOT a blog/article (i.e., URL doesn't contain `/blog`), **FAIL** with: `"Numbered section eyebrow '01 — WHAT WE DO' on {page}. Numbered section labels are FORBIDDEN on non-blog pages — they're an editorial affectation that doesn't belong on a small-business contractor's website. Drop the number; keep the category label only. See NUMBERED SECTION LABELS RULE in SKILL.md."`

Apply to Options A and B. Option C may legitimately use numbering when its industry-tokens direction calls for it; check `--option c` skips this rule.

---

#### ALPHA-AWARE TEXT CONTRAST (extends TEXT CONTRAST — applies to all options)

Real bug shipped 2026-04-29 (tomekgroup-website hero copy): body text rendered as `oklch(0.871 0.006 286.286)` over `rgb(9, 9, 11)` near-black bg, BUT the previous `text-contrast` rule used the raw color value and computed contrast against the parent bg without accounting for ancestor opacity. The text was effectively semi-transparent due to a wrapper with low opacity, AND the `oklch()` color notation wasn't parsed at all (`rgbStringToRgb` returned `null` and silently skipped the element). Result: unreadable body copy passed QA cleanly.

##### The two gaps that combined to produce the bug

1. **Foreground alpha was ignored.** When `cs.color` is `rgba(150, 150, 150, 0.30)`, the rendered pixel is alpha-blended onto the background — not the raw rgb. WCAG contrast must measure the on-screen pixel, not the nominal color.
2. **Ancestor `opacity` was ignored.** A wrapper with `style="opacity: 0.3"` makes its entire subtree semi-transparent. The leaf element's `cs.color` doesn't reflect that — but the rendered pixel does.
3. **`oklch()` color notation was unparsed.** Tailwind v4 default palettes (`slate-`, `zinc-`, `stone-`, `gray-`, `neutral-`) emit `oklch()`. The previous parser handled `rgb`/`rgba`/`oklab` but not `oklch`, and silently returned `null` for any element whose color was oklch.

##### The fix (now active in qa-check.js)

The `text-contrast` rule now:

1. Parses `rgb`, `rgba`, `oklab`, **and `oklch`** color notations. `oklch(L C h)` converts to oklab via `a = C·cos(h_radians); b = C·sin(h_radians)` then routes through the canonical Ottosson sRGB conversion.
2. Walks the ancestor chain and multiplies every element's `opacity` to compute total effective opacity.
3. Combines color-channel alpha × ancestor-opacity-chain into a total alpha.
4. **Alpha-composites** the foreground onto the effective background using `out = fg * α + bg * (1 - α)`. This is the actually-rendered pixel.
5. Computes WCAG contrast against THAT composited pixel.
6. Diagnostic message surfaces both the raw color AND the composited pixel + total alpha so the worker knows which mechanism caused the failure.

Additionally, before the contrast walk, qa-check now force-reveals every `.fade-up` and `.stagger` element AND scrolls the page top-to-bottom so the IntersectionObserver fires for below-fold content. Without that, every below-fold heading would false-fail because the `.fade-up` opacity:0 hadn't transitioned to opacity:1 yet at networkidle.

##### What this rule rules out

- Body text at `text-white/30` over a dark photo (composites to ~3:1 against the photo's dark zone — fails)
- Footer copy at `opacity: 0.5` on a wrapper containing dark-grey text on grey bg
- Any `oklch()` color that previously skated past the gate because the parser returned null
- Tailwind opacity utilities like `text-bone-300/40` that previously read as full-alpha

---

#### PER-CONTEXT CONTRAST VARIABLES (architectural — applies to color-token design)

Real bug pattern (caught 2026-04-29 across multiple builds): a single accent color is defined once (`--color-rust: #A8412A`) and used as both the on-light label color (e.g. mono-caption on bone) AND the on-dark label color (e.g. mono-caption on forest). On bone it passes 4.6:1; on forest it composites differently and fails. The worker `sed`s the variable globally to fix one context, breaking the other. After 4 cycles of "fix one, break the other", the build still has WCAG fails in some context.

##### The rule

When designing `global.css` `@theme` palette variables, **whenever an accent color will appear on BOTH light and dark backgrounds, define explicit per-context variants from the start**:

```css
@theme {
  /* WRONG — single variable, two contexts, WCAG-loses in one of them */
  --color-rust: #A8412A;

  /* RIGHT — per-context variants chosen to pass 4.5:1 in their own context */
  --color-rust-onlight: #A8412A;   /* used on bone/cream/white bg — 4.6:1 ✓ */
  --color-rust-ondark:  #E08574;   /* used on forest/shadow bg — 6.15:1 ✓ */
}
```

Apply to ALL semantic-named accents (rust, amber, crew-red, hi-vis, brand-accent, success, danger, warning, info). The naming convention `{name}-onlight` / `{name}-ondark` is mandatory — it makes the intent explicit at the use site (`color: var(--color-rust-ondark)` reads "rust, on-dark context").

##### What this rule rules out

- Reusing a single `--color-X` variable across two contexts and discovering at QA time that one context fails 4.5:1
- Worker spending fix-loop cycles `sed`-replacing variable values to chase WCAG passes in different contexts
- The "fix one, break the other" oscillation that produces a partial-pass build

##### QA gate guidance (judgment call, not programmable)

There's no automated check for this rule — it's a design discipline. But the existing `text-contrast` rule (now alpha-aware) catches the failures at build time. The structural rule here is preventative: **define the pair from the start**, don't try to retrofit when QA fails.

---

#### TAILWIND V4 CASCADE TRAP (architectural — applies to global.css authoring)

Real bug shipped 2026-04-29 (giffins.net build, twice on the same build): a bare element selector like `h2 { color: var(--color-forest); }` in `src/styles/global.css` SILENTLY beats utility classes (`text-cream`, `style="color: var(--color-cream);"`) regardless of CSS specificity. Cause: in Tailwind v4, unlayered base styles in `global.css` are computed AFTER the utility layer in the cascade, so they win. The fix is to wrap base element selectors in `@layer base { ... }` so they get put in the correct cascade slot below utilities.

##### The rule

In any `src/styles/global.css` (across A, B, C, and all template inspirations), **bare element selectors that set color/background properties MUST be wrapped in `@layer base { ... }`**.

```css
/* WRONG — unlayered base styles silently beat utility classes */
h1, h2, h3, h4 {
  font-family: var(--brand-display);
  color: var(--color-ink);
}
p {
  color: var(--color-ink);
}

/* RIGHT — base layer so utility classes can override */
@layer base {
  h1, h2, h3, h4 {
    font-family: var(--brand-display);
    color: var(--color-ink);
  }
  p {
    color: var(--color-ink);
  }
}
```

##### Why this matters

Without `@layer base`, you get bugs like:

- `<h2 class="text-cream">Headline</h2>` renders ink-dark instead of cream — utility class loses to unlayered base
- `<p style="color: var(--color-cream);">Body</p>` renders ink-dark — inline style WINS but if there's any inline style override missing, base sneaks in
- A worker who sees the bug tries `!important` everywhere, which works but is ugly and hard to maintain

The fix is simple and structural: wrap base-element styles in `@layer base`.

##### QA gate enforcement (NEW in `qa-check.js` Stage 2.7 scaffold smoke-test)

The shared-component contrast lint at Stage 2.7 (and the broader text-contrast walk) catches the visible symptom. Additionally, a static lint runs at Stage 2.6 (scaffold creation) and Stage 7c (Option C scaffold):

1. Read `src/styles/global.css`
2. Search for bare-element rules: `^([a-z][a-z0-9]*\s*,?\s*)+\s*\{` at module-top-level (not inside any `@layer { }`, `@media { }`, etc.)
3. If any match sets `color`, `background`, `background-color`, or `font-family` properties → **FAIL** with: `"Bare element selector '{selector}' in global.css sets color/font outside @layer base. Tailwind v4 unlayered base styles silently beat utility classes regardless of specificity. Wrap bare-element selectors in @layer base { ... } so utilities can override them. See TAILWIND V4 CASCADE TRAP in SKILL.md."`

This is a static check (no Playwright needed) — runs in `scripts/check-cascade-trap.cjs` (TODO).

---

#### FOOTER-AFTER-DARK-CTABANNER (architectural — applies to all options)

Real bug shipped 2026-04-29 (Option C visual review): the closing CTA banner is a dark section (forest/shadow/cordwood). The Footer is also a dark section (forest-shadow). When Footer has any `mt-{n}` (margin-top) class — even `mt-0` if there's other parent margin — a thin cream stripe appears between them as the page background bleeds through. Visually unforgivable.

##### The rule

**Footer components must rely entirely on internal `py-{n}` for vertical spacing. Never `mt-*` on the Footer or its parent.**

```astro
<!-- WRONG — mt-12 creates a visible gap between dark-bg sections -->
<Footer class="mt-12 bg-shadow text-cream py-16" />

<!-- RIGHT — no margin-top, internal py only -->
<Footer class="bg-shadow text-cream py-20 md:py-24" />
```

If you need extra space above the footer in some contexts, ADD it inside the footer (top padding) or in the section ABOVE the footer (bottom padding) — never via Footer's own margin.

##### QA gate enforcement (NEW in `qa-check.js`)

A static lint at build time scans `src/components/Footer.astro` and any page-level uses of `<Footer>` for `class=` attributes containing `mt-` tokens. If found → **FAIL** with: `"Footer has 'mt-{n}' margin-top class in {file}. When the section above the footer is also dark, mt-* exposes a cream stripe between the two sections. Use internal py-* on the Footer instead. See FOOTER-AFTER-DARK-CTABANNER in SKILL.md."`

Pattern detected: `<Footer[^>]*class="[^"]*\bmt-\d`. Pattern in component CSS: search Footer.astro for `class="...mt-..."` on the outer wrapper.

---

---

> **→ NEXT: Stage 2 — Analyze & Design Brief.** Stage 1 (Scrape) just completed. Continue IMMEDIATELY to Stage 2. Do NOT ask the user "want me to continue?" Do NOT pause for confirmation. Just proceed. (See PIPELINE COMPLETION CONTRACT at top.)

### Stage 2: Analyze & Design Brief

Read the manifest.json and **look at the screenshots** of the original site (use the Read tool on the screenshot PNG files to see them visually).

Understand the business deeply:
- What do they do? Who are their customers?
- What's the current site's vibe? What works? What doesn't?
- What would make this site look world-class?

Create `jobs/{domain}/design-brief.json`:

```json
{
  "business": {
    "name": "...",
    "type": "...",
    "industry": "...",
    "targetAudience": "...",
    "valuePropositions": ["..."]
  },
  "currentSite": {
    "strengths": ["..."],
    "weaknesses": ["..."],
    "pageCount": 0,
    "hasForm": true,
    "hasSocialLinks": true
  },
  "design": {
    "style": "e.g., modern minimal, bold industrial, warm organic",
    "inspiration": "describe the visual direction in detail - mood, feel, references",
    "colorPalette": {
      "primary": "#hex",
      "secondary": "#hex",
      "accent": "#hex",
      "background": "#hex",
      "surface": "#hex for cards/sections",
      "text": "#hex",
      "textMuted": "#hex"
    },
    "typography": {
      "headingFont": "Google Font name",
      "bodyFont": "Google Font name"
    },
    "layoutPatterns": [
      "full-bleed hero with overlay text",
      "alternating left-right content sections",
      "3-column service cards with hover effects",
      "testimonial carousel or grid",
      "sticky CTA bar on mobile"
    ],
    "animations": [
      "fade-up on scroll for sections",
      "smooth hover scale on cards",
      "subtle gradient shifts on hero",
      "staggered entrance for grid items"
    ],
    "designDetails": [
      "rounded corners on cards (2xl)",
      "subtle shadows for depth",
      "generous padding (py-24 sections)",
      "gradient accent backgrounds",
      "icon accents for service items"
    ]
  }
}
```

**Be bold and creative with the design.** You have full creative freedom. Study the best websites in this industry for inspiration. Think about what makes award-winning small business sites look great: bold typography, strong visual hierarchy, cinematic hero sections, sophisticated color palettes, smooth micro-interactions.

#### Brief MUST clear the DESIGN QUALITY BAR (see top-level rule)

Before declaring the brief done, verify each of these is filled with INTENTION, not defaults:

- **Typography pairing**: a display font for headlines (Fraunces / Editorial New / DM Serif Display / Cormorant / Cabinet Grotesk / Tenor Sans / etc.) AND a clean text font for body. NEVER ship a brief whose `headingFont` is "Inter" or "Arial" — that's the template signal. The bar requires display-quality.
- **Color palette with named roles**: each color must include a brand role and rationale (`"primary": { "hex": "#0f3057", "role": "trust anchor / nav background", "why": "deep navy reads as established and reliable for the marine-services audience" }`). 3 primary + 2 accent maximum. If you list 6 colors with no rationale, the brief is not done.
- **Hero direction**: describe the hero treatment in detail — not just "full-bleed photo with text overlay" but what supporting design element makes it feel intentional (a labeled section number, a mono caption strip, an attention rule, a hover-revealed accent). Bare hero = template.
- **Distinctive-element catalog**: list 2-3 design elements per page that the customer would NOT have built themselves (custom card style, oversized heading with tight kern + custom underline, stat strip with mono captions, editorial pull-quote, numbered process strip).
- **Micro-interaction list**: at least 1-2 intentional motion choices per page (scroll reveals on sections, hover scale on cards, animated counters on stats, sticky-on-scroll nav transition).
- **Mobile-first commitments**: hero text size and crop strategy at 390px, mobile nav style (hamburger / bottom-bar / pill stack), sticky bottom-CTA decision (yes/no — usually yes for trades), tap-target minimums baked in.
- **Brand signature inventory** (NEW — see brand recognizability rule in build): list 1-3 elements from the original site worth preserving (primary brand color, font vibe, hero composition, signature word/tagline). Then mark which ones the build will preserve. If the original is so generic/bad that nothing is worth preserving, say so explicitly with reasoning — silence here is not acceptable.

A weak brief produces a "merely better than original" build. Strong brief = strong A.

---

---

> **→ NEXT: Stage 3 — Build Option A.** Stage 2 (Design Brief) just completed. Continue IMMEDIATELY to Stage 3. Do NOT ask the user "ready to start building?" Do NOT pause to share the brief. Just build A. (See PIPELINE COMPLETION CONTRACT at top.)

### Stage 3: Build Option A (Faithful Rebuild)

> **The brief in one line:** _"Same site, suddenly expensive."_
> Same content, same imagery, same brand identity, same logo — but treated like a top-tier studio charged the customer $80k for the rebuild. Art-directed typography, intentional spacing, considered color palette, generous whitespace, smooth micro-interactions. Customers should look at it and think "that's MY site, but it looks like a different company built it." If you find yourself reorganizing copy or repositioning the brand, you've drifted from A toward B — back up.

Build a complete Astro website preserving 100% of the original text content.

#### 3-pre. Read the typed scaffold + inspiration (MANDATORY before designing anything)

The `templates/` directory pivoted 2026-04-25 from "copy this whole template per-build" to "copy a minimal scaffold + design fresh per customer." The change prevents 100 plumbing customers getting 100 identical SaaS-aesthetic websites. Three things to read BEFORE writing any component code:

1. **`templates/REQUIRED-PATTERNS.md`** — non-negotiable structural requirements every build must satisfy. Mapped 1:1 to `qa-check.js` rules. Read this completely. The visual treatment of every requirement is your design choice; the structural requirement is non-negotiable.

2. **`templates/scaffold/README.md`** — what the scaffold provides (Astro config, BaseLayout document chrome, animation primitives, mobile-first defaults) and what it deliberately omits (every visual choice).

3. **At least ONE directory in `templates/inspiration/`** — pick the one that best matches the customer's industry direction:
   - `templates/inspiration/saas-default/` — tech / professional services / consultancies (was `templates/astro-base/` before the pivot)
   - `templates/inspiration/industrial-trades/` — plumbing, HVAC, electrical, construction, landscaping, auto, cleaning
   - (others added as the library grows)

   READ the components for ideas — prop APIs, structural patterns, animation usage, contrast handling. NEVER `cp -r` a component verbatim into the customer build. Every component is designed fresh per customer.

#### 3a. Set Up Project (copy scaffold, install deps)

```bash
cp -r templates/scaffold/ jobs/{domain}/option-a/
```

```bash
cd jobs/{domain}/option-a/
npm install
```

The scaffold provides:
- Astro 5 + Tailwind v4 wired correctly (`astro.config.mjs`, `package.json` locked deps)
- `src/layouts/BaseLayout.astro` — document chrome, font-loading slot, header/footer slots, animation enhancement script (progressive — content visible without JS)
- `src/styles/global.css` — Tailwind import + empty `@theme` block with CSS variable hooks (you fill these in) + `.fade-up`/`.stagger` animation primitives + reduced-motion respect + 16px body minimum
- Empty `src/pages/` (you create pages here per manifest)
- NO components (you design them fresh per customer)

**DO NOT** create `.claude/launch.json` inside job directories — this triggers permission prompts that break unattended operation.

#### 3b. Design fresh components + pages (per design brief, REQUIRED-PATTERNS, inspiration)

Build the customer's site from scratch using:
- `jobs/{domain}/design-brief.json` — the customer's palette, typography, hero direction, distinctive elements, micro-interactions
- `templates/REQUIRED-PATTERNS.md` — what every build must structurally satisfy
- `templates/inspiration/{chosen-aesthetic}/` — examples of design moves to draw from (NEVER copy verbatim)

Specifically:
- Update `src/styles/global.css` `@theme` block with the design brief's color ramp + named-role rationale + display/text font CSS variables (`--brand-display`, `--brand-text`)
- Add font loading via `<slot name="head-fonts">` in your page templates → BaseLayout's head-fonts slot. Per DESIGN QUALITY BAR, must include at least one display-quality web font (Fraunces, Editorial New, DM Serif Display, Cormorant, Cabinet Grotesk, etc. — model picks based on industry/brand vibe; no curated list). System Inter / Arial alone fails the bar.
- Create `src/components/` directory and design fresh components per the customer (Nav, Hero, ServiceCard, Testimonial, Footer, etc.). Each must satisfy the corresponding structural rule in REQUIRED-PATTERNS.md.
- Create all pages from the manifest in `src/pages/`
- Copy ALL relevant images from `../assets/img/` to `public/images/` — BOTH regular images AND background images
- **Use `backgroundImages` from the manifest as hero section backgrounds** (the large full-bleed images behind text). Every page that had a background image in the original MUST have one in the rebuild
- **HERO CONTRAST — mandatory three-layer pattern.** Every hero section with a photo background MUST use the layered pattern: (1) image, (2) overlay/scrim div with non-transparent background-color, (3) text positioned above the overlay with a color chosen to contrast with the overlay-blended bg. Skipping the overlay or using dark text on a dark-overlayed photo is the bug we shipped on Naples FL Pressure Washing (Options A and C) and Tampa Bay landscape co (Option A). See full rule at top of SKILL.md (`HERO CONTRAST RULE`). qa-check.js will fail the build if a heading sits on a `background-image` without a detectable overlay, OR if computed contrast ratio < 3:1 for large text.
- **IMAGE REUSE — at least 90% of must-reuse manifest images MUST appear in the build.** See full rule at top of SKILL.md (`IMAGE REUSE RULE`). The customer's original site is a small-business website with photos of the work; A is the same kind of site, suddenly expensive — NOT a magazine layout. Service cards must each have a representative photo (text-only service cards are the failure mode). Add a portfolio / gallery / "Recent Work" section to absorb 6-12 photos in one move (model: `https://elysian-gc-786s9d1zc-tomek-group.vercel.app` "A craftsman's portfolio — photographed honestly"). If the brief calls for editorial / typographic / file-tab / bracket-numbered design language, **that belongs to Option C** — Option A stays photo-led. qa-check.js will fail the build if the rendered set covers < 90% of the must-reuse pool.
- Use regular `images` as inline content images in two-column layouts alongside text
- Preserve ALL original text word-for-word
- Keep all video embeds (YouTube/Vimeo iframes)
- **SOCIAL LINKS — preserve every one, with the correct destination URL.** Read `manifest.json → footer.social` (an array of `{platform, href}` objects populated by the scraper from BOTH live DOM and a raw-HTML regex fallback that catches Duda / Wix / late-injecting widgets). Cross-check `design-brief.json → business.socials` if it exists. ALL discovered social/business-listing links MUST appear in the footer (and in the header/contact area if the original had them there).

  - **HARD RULE on the `href`**: each social link's `href` MUST be the FULL EXTERNAL URL from `manifest.footer.social` (e.g. `href="https://www.facebook.com/CustomerBusinessName"`). NEVER use `href="#"`, NEVER use `href="/"`, NEVER point a Facebook icon to the customer's own website. The icon is a destination signal — if it doesn't go to the platform it represents, it's worse than useless because it actively misleads visitors.

  - **HARDER RULE — IF `manifest.footer.social` IS EMPTY OR MISSING, OMIT THE SOCIAL SECTION ENTIRELY.** Do NOT render Facebook/Instagram/etc. icons with `href="#"`, `href="/"`, or `href="https://www.facebook.com"` (homepage URL guess). No exceptions. If the customer never had social, the build doesn't ship social. If you're tempted to "guess" the brand's social handle from the business name (e.g., `facebook.com/{businessname}`) — STOP. Guessed URLs that 404 are worse than no link at all. The recurring 2026-04-25 bug (libertylandscapefl.com Option C) shipped `<a href="#" aria-label="Facebook">` placeholder anchors — qa-check failed-open because nobody ran the gate, and the customer saw fake social icons.

  - **REQUIRED MARKUP for every rendered social link** (so qa-check can verify):
    1. The `href` attribute MUST be the FULL EXTERNAL URL (not `#`, not `/`)
    2. The `aria-label` attribute MUST name the platform exactly: `aria-label="Facebook"`, `aria-label="Instagram"`, etc. (so QA can identify which platform this anchor claims to be)
    3. `target="_blank" rel="noopener noreferrer"` (so the visitor leaves the site cleanly and the customer's site doesn't get tab-napped)
    4. The icon child (svg/img/Material Symbols/Font Awesome) is fine, but the ANCHOR's aria-label is the single source of truth for QA platform identification

  - **Three real bugs we've shipped**:
    1. SS Power Washing — social links dropped entirely from the rebuild
    2. Liberty Landscape FL (first occurrence) — social icons present and styled, but every `href` pointed to the customer's own website instead of facebook.com / instagram.com. Cosmetically perfect, functionally broken
    3. Liberty Landscape FL (second occurrence, 2026-04-25) — `href="#"` placeholder anchors in Option C because the scraper missed the social URLs entirely (Duda widget loaded AFTER networkidle), and the worker session defaulted to placeholder hrefs instead of OMITTING the section

  - **Fix this once, never miss again.** qa-check.js now has FIVE detection paths for the platform identifier (text, aria-label, title, className tokens, icon-class regex, image src filename) PLUS a structural failsafe that fails the build for any icon-only anchor in `<footer>` or a `[class*="social"]` container that points to an internal href — even when no platform was identified. The scraper now has a raw-HTML regex fallback that catches social URLs late-injecting widgets miss. AND if the manifest is empty for socials, the build OMITS the section entirely instead of placeholder-ing.

- **FAVICON RULE** — Read `manifest.favicon` (an object set by the scraper containing `{src, localPath, rel, sizes, type, ext, sizeBytes, source}`, or `null` if no favicon was scraped):
  - **If `manifest.favicon` is set**: copy `assets/img/favicon.{ext}` to `public/favicon.{ext}` AND add `<link rel="icon" type="{type}" href="/favicon.{ext}">` to BaseLayout's `<head>`. Use the captured `type` and `sizes` attributes if present.
  - **If `manifest.favicon` is null**: fall back to the logo. Take `public/images/logo.png` (or whatever logo file ended up there after `fix-logo.js`), generate a 32×32 and 192×192 favicon-style copy if you can (skip if no easy way to resize — just point `<link rel="icon" href="/images/logo.png">`). Note in the brand-preservation-note that the favicon was derived from the logo.
  - **Never ship a build with NO favicon link** — browser tabs without a favicon look like an unfinished site. Default browser globe favicon = template tell.
  - The scraper also tries `/favicon.ico` as a last-ditch fallback before reporting null, so `manifest.favicon` should usually be populated. If it's null, the original site genuinely had no favicon.

- Keep all phone numbers, email addresses
- Build the contact form as a mailto: link to the business email

#### 3b-tris. BRAND RECOGNIZABILITY (soft rule — preserve at least one signature)

The customer should look at A and feel "that's MY site, but it looks like a different company built it" — not "this is a different company entirely." Total brand erasure is a failure mode that ships when the design brief picks all-new colors and fonts without considering what the customer's actual brand signal was.

**Soft rule**: aim to preserve at least ONE element from the original site so the customer recognizes their brand:

- **Primary brand color** — the most-used color on the original site, OR the dominant color of the original logo. Carry it forward as A's primary or strong accent. Even modernized, the color signal endures.
- **Typography vibe** — formal/casual, serif/sans, classical/geometric. If the original used a script for the wordmark, A's display font might lean classical; if the original was utilitarian sans, A leans clean modern. The vibe carries even when the specific font changes.
- **Hero composition** — if the original site had a recognizable hero photo (specific truck, crew, signature work, building), use it in A's hero rather than swapping for a stock photo.
- **Signature word/tagline** — if the original site features a memorable tagline or copy phrase (e.g., "We Show Up On Time"), keep it visible somewhere prominent in A.

**Read the brand signature inventory** in `design-brief.json` (Stage 2 outputs this). Pick at least one to preserve. State which one in `jobs/{domain}/option-a/brand-preservation-note.md` (one short paragraph for traceability).

**Override permission**: if the original site is genuinely terrible — clashing colors, illegible fonts, generic stock chrome with no signature, a logo that's a placeholder — you have explicit permission to preserve nothing. In that case, write to `brand-preservation-note.md`: "No preservable signature found in original. Reasoning: [one sentence — e.g., 'site uses a Hibu placeholder logo, default Arial body, no brand color, no memorable tagline; the original is itself a template the customer never personalized']." Silence is not acceptable — make the call explicitly.

This is a soft rule because the override exists. But silence (preserving nothing without acknowledging it) is a failure: the worker session must either preserve OR justify.

Key design rules:
- NEVER change, paraphrase, or omit any text from the original site
- Make the design STUNNING - this is the most important thing
- Use generous whitespace, strong visual hierarchy, modern layout patterns
- **CONSISTENT CARD STYLING**: All cards within the same section must use the same visual treatment — same border color, same icon background, same hover effect. Do NOT use different accent colors per card. Consistency looks professional; rainbow accents look like a template.
- Add CSS animations: fade-in on scroll, hover effects, smooth transitions
- **PROGRESSIVE ENHANCEMENT FOR ANIMATIONS**: Never use `opacity: 0` as the default CSS state for content sections. All content must be visible without JavaScript. Use a pattern like `html.has-animations .fade-up { opacity: 0; }` where JS adds `.has-animations` to `<html>`. Also add a safety fallback timeout (2-3 seconds) that reveals all elements in case the IntersectionObserver doesn't fire. Content that's invisible without JS = broken site for crawlers, slow connections, and QA screenshots.
- Consolidate similar location-specific pages if there are many near-identical ones

#### 3b-bis. MOBILE-FIRST DESIGN (mandatory for all options)

**More than half of small-business site traffic is mobile. Mobile is not the "responsive afterthought" — it is the primary design target.** Every component, every page, every interaction must be designed mobile-first and scaled UP to desktop, not the reverse.

**Hard rules** (qa-check.js enforces the programmatic ones at both 1440×900 and 390×844 viewports):

1. **Mobile-first CSS**: write the base styles for the 390px viewport. Use Tailwind responsive prefixes (`md:`, `lg:`) to scale UP, not down. Default classes apply to mobile; `md:` and `lg:` classes are progressive enhancements for wider screens.

2. **Touch target minimum**: every interactive element (link, button, nav item, form input, social icon, phone CTA) must be ≥ 44×44 CSS px on mobile (WCAG 2.5.5). Add padding or `min-h-[44px] min-w-[44px]` to small text links to bump their hit area. **qa-check warns on every tap target under 44px at the mobile viewport.**

3. **No horizontal overflow at 390px**: nothing — no section, no image, no card, no long unbroken string — may extend past `100vw` at the mobile viewport. Common offenders: fixed-width sections, oversized images without `max-w-full`, tables, long URLs in body copy. **qa-check fails if document scrollWidth > viewport width at 390px.**

4. **Image sizing for mobile**: heroes and content images displayed full-bleed on mobile must source images sized for retina mobile (≥ 780px wide for a 390px display). A 850px hero stretched to 1440px on desktop AND down to 390px on mobile fails desktop's resolution check; either provide a higher-res source or use `srcset`. **qa-check fails if any visible content image's natural width is less than its displayed width.**

5. **Mobile nav**: hamburger menu OR pill-stacked nav OR bottom nav bar — pick one and execute it cleanly. The hamburger button must be ≥ 44×44px (rule 2). Menu items inside the drawer must each be ≥ 44px tall. The phone-CTA in nav should remain visible (or at least one tap away) on mobile because phone calls are the #1 mobile conversion event for trades sites.

6. **Mobile typography**: body text minimum 16px (smaller text on mobile triggers iOS zoom-on-focus and feels cramped). Hero headlines should scale fluidly — `text-4xl md:text-6xl lg:text-7xl` or use `clamp()`. No text below 14px anywhere on mobile (footer fine print is the exception, but only if it's not interactive).

7. **Sticky mobile CTA**: for trades/services sites, a persistent "Call Now" or "Get Quote" bar at the bottom of the mobile viewport is high-conversion. Add it. Hide on desktop with `md:hidden`.

8. **Spacing on mobile**: section padding shrinks proportionally. Default `py-24 md:py-32` is fine for desktop; mobile gets `py-16` or less. But preserve breathing room — don't crush sections together.

**The mobile screenshot is half of QA — not a checkbox.** Every screenshot review (Stage 4c) must look at mobile-home, mobile-about, mobile-services etc. with the same scrutiny as desktop. Mobile-only bugs (overflow, broken hamburger, stretched hero, tap-target failures) are full deploy blockers.

#### 3c. Build Check

```bash
cd jobs/{domain}/option-a/
npm run build
```

Fix any build errors before proceeding to QA.


---

> **→ NEXT: Stage 4 — Visual QA & Polish for Option A.** Stage 3 (Build A) just completed — option-a/dist/ exists, all pages compile. Continue IMMEDIATELY to Stage 4. Do NOT ask the user "want me to start the dev server?" or "ready for QA?" or "would you like to review the build first?" Do NOT pause. The user will review the FINAL 4-URL report at Stage 10; mid-pipeline review is not part of the contract. Just start the dev server and run QA. **This is the most common stop-too-early point — Qwen and other weaker models routinely halt here. Do not.** (See PIPELINE COMPLETION CONTRACT at top.)

### Stage 4: Visual QA & Polish (Option A)

**This is the most critical stage.** Run headless QA, visually inspect screenshots, and iterate until the site is beautiful and bug-free.

#### QA philosophy (read this first — it overrides any tactical advice below)

> **If a human would see it as a bug, the gate must catch it.**

QA has two layers, BOTH mandatory. Neither one alone is sufficient:

1. **Deterministic layer (`scripts/qa-check.js`)** — pattern-based programmatic checks for known bug classes. Cheap, fast, exhaustive across pages. Catches the bug classes we've seen before AND general-purpose readability/structure violations (text-contrast scan, broken images, missing nav/footer/h1, etc.). Exits non-zero → blocks deploy.

2. **Visual layer (you, the model, reviewing screenshots from `scripts/qa.cjs`)** — open-ended visual judgment for bugs that don't fit a regex. Misaligned grids, weird whitespace gaps, cards that overflow, color combinations that look wrong despite passing contrast, a hero that's "fine" but obviously crooked, an active nav state that's the wrong shape, a CTA button that's been styled as a dead link. **You are explicitly tasked with looking for things we haven't enumerated yet** — every novel "looks broken to a human" bug eventually becomes a new programmatic check, but until then it's your job to catch it on sight.

**Why both layers**: every shipped bug class falls into one of two patterns — (a) we never wrote a programmatic check for it, OR (b) the check exists but is too narrow. The visual pass catches (a); the deterministic gate catches (b) plus the long tail of regressions. Skipping either layer ships bugs.

**The pipeline must structurally support both**: qa-check.js is run unconditionally (Stage 4b/8a). The visual sanity pass is run unconditionally (Stage 4c-bis below) with an explicit checklist of human-eye bug classes — not as a free-form "look at this." The checklist is in 4c-bis. Add to the checklist any new bug class shipped to the user.

Two QA scripts run in tandem, both headless:
- `scripts/qa.cjs` — captures desktop + mobile screenshots and checks console/network errors. Screenshots are for YOU (the model) to visually review via Read tool.
- `scripts/qa-check.js` — automated pass/fail gate. **Runs at BOTH desktop (1440×900) and mobile (390×844) viewports for every page.** Currently checks: logo legibility (natural px vs displayed px), broken images, literal `\uXXXX` escapes, **literal HTML entity references rendered as visible text** (catches `&#128027;` etc. shown as raw text instead of decoded emoji — same bug class as `\uXXXX` escapes, different syntax), missing nav/footer/h1, hero contrast (text over photos), generic text contrast (every text node vs effective background, WCAG ratios), social-link destinations (5-path detector + structural failsafe for icon-only anchors with internal hrefs), video-CTA reality, placeholder copy, image diversity, image resolution (any visible image > 200px wide must have natural width ≥ displayed width — fails if stretched, warns if soft on retina), mobile horizontal overflow (anything extending past 390px viewport), mobile tap target size (interactive elements < 44×44px), design-quality fonts (warns if no web font loaded), fact grounding (when `--manifest jobs/<domain>/manifest.json` is passed), AND **testimonial tampering** (when `--reference-dist jobs/<domain>/option-a/dist` is passed — extracts `<blockquote>`/`<q>` text from the live page and verifies each appears verbatim in the reference dist's HTML). Output groups issues by viewport: `[both]` (failures present at desktop AND mobile), `[desktop-only]`, `[mobile-only]`. Exits non-zero on any failure. Run this BEFORE the screenshot review — it catches the bugs that are invisible to a quick visual skim.

**Reference-dist flag — when to pass it**: `--reference-dist jobs/<domain>/option-a/dist` is REQUIRED when QA-checking Option B and Option C. It enables the testimonial-tampering check (B and C must preserve A's testimonials byte-identical per the TESTIMONIAL & REVIEW PRESERVATION rule). Do NOT pass it when QA-checking A itself (A is the reference).

**ALWAYS run qa-check.js first.** If it fails, fix the root cause before wasting time reviewing screenshots. A blurry logo, broken image, fabricated fact, invisible text, or literal `\uXXXX` visible on the page is a failure — no exceptions.

#### 4a. Start Dev Server (Background)

Read the allocated port and start the Astro dev server as a background process:

```bash
PORT_A=$(node scripts/get-port.cjs "$DOMAIN" a)
cd jobs/{domain}/option-a/
npx astro dev --port $PORT_A &
echo $!
```

Save the PID so you can stop it later. Wait a few seconds for the server to start.

#### 4b. Run Headless QA

**FIRST** — run the automated gate. It exits non-zero on real defects (blurry logo, broken images, unicode escapes, console/network errors, **image-reuse < 90% for Option A**). If it fails, fix and re-run; do not proceed to screenshots until it passes:

```bash
PORT_A=$(node scripts/get-port.cjs "$DOMAIN" a)
cd /Users/tomasz/WebFactory
node scripts/qa-check.js http://localhost:$PORT_A --manifest jobs/$DOMAIN/manifest.json --option a / /about /contact
```

**Why `--option a`?** It activates the `image-reuse-A` rule (IMAGE REUSE RULE in this doc): at least 90% of must-reuse manifest photos must appear in Option A's build. If this fails, the design has drifted into magazine / typographic-only layout — restructure to add a portfolio / gallery section, photo-per-service-card, and about-the-crew block to absorb the photo budget. **Always pass `--option a` (or `b` or `c`) when running qa-check on a built option.** Omitting it is a silent back-compat fallback that disables option-specific gates.

**Why `--reference-dist-i18n` on B and C?** The MULTILINGUAL SUPPORT rule made B the canonical translation source for ALL languages. When checking C's `/<lang>/` testimonials, qa-check needs to compare against B's `/<lang>/` (not A's, since A is English-only). The `--reference-dist-i18n` flag points the testimonial-tampering rule at B's dist root, and qa-check walks every `/<lang-code>/` subdirectory there to build per-language reference sets. The legacy `--reference-dist-es` flag still parses as an alias. **The flag should be omitted entirely on English-only builds** (the default since 2026-04-30) — qa-check's per-language testimonial check then silently no-ops.

**Why `/es/` (and `/de/`, `/ru/`, `/it/`, etc.) paths in the page list?** The qa-check checks the URLs it's given. To run the full multilingual gate, every active language's page set must be passed. Missing `/<lang>/` paths in the invocation = multilingual rules don't fire on those pages. **On English-only builds (the default since 2026-04-30), the orchestrator passes ONLY English paths** — qa-check then no-ops the multilingual rules. Stage 4b for Option A always uses Option A's English-only path list (A is monolingual). Stage 6 (Option B) and Stage 7h (Option C) extend the path list to include every active language's paths IF any language is active in `option-b/src/pages/<lang>/`. After `--languages es,de` at initial build OR `--add-language German --to B` post-build, the next Stage 6 / Stage 8a invocation on B includes `/es/, /es/about, …, /de/, /de/about, …` in addition to the English paths.

**THEN** — run the screenshot QA script for visual inspection:

```bash
PORT_A=$(node scripts/get-port.cjs "$DOMAIN" a)
cd /Users/tomasz/WebFactory
node scripts/qa.cjs http://localhost:$PORT_A jobs/{domain}/qa-option-a
```

This auto-discovers all pages from the nav and for each page:
- Takes desktop (1440×900) and mobile (375×812) screenshots
- Captures console errors and failed network requests (404s, etc.)
- Writes `report.json` with all findings

#### 4c. Review Screenshots

Read each screenshot PNG using the Read tool (it renders images visually):

```
Read: jobs/{domain}/qa-option-a/desktop-home.png
Read: jobs/{domain}/qa-option-a/mobile-home.png
Read: jobs/{domain}/qa-option-a/desktop-about.png
... (all pages)
```

For each screenshot, evaluate:
- **Hero**: Stunning? Background image showing? Text readable over overlay?
- **Typography**: Clear hierarchy (H1 > H2 > body)? Fonts loaded?
- **Images**: Displaying correctly? Right sizes? No broken placeholders?
- **Colors**: Palette harmonious? Enough contrast?
- **Spacing**: Generous whitespace? Spacious and modern feel?
- **Cards/grids**: Aligned properly? Consistent spacing?
- **Nav**: Clean and professional? All links present?
- **Footer**: Polished? All info present?
- **Mobile**: Layout stacks properly? Text readable? Menu visible?

Also read the QA report for automated findings:

```
Read: jobs/{domain}/qa-option-a/report.json
```

#### 4c-bis. Visual Sanity Pass (MANDATORY — catches what regex can't)

This is the second QA layer. After the deterministic gate passes and you've done the general review, run an EXPLICIT structured pass through every screenshot with the bug-class checklist below. The model is responsible for catching bugs that don't fit a programmatic pattern.

**The protocol**: for EACH page, EACH viewport (desktop + mobile), open the screenshot via Read tool and answer the checklist questions one by one. If any answer is "yes, that looks wrong," log it as a punch-list item and fix in 4e. Do not skip pages, do not skim — visual bugs cluster on the pages we don't look at carefully.

**The checklist** (every item is here because it shipped to a user as a bug — these are the bug classes we missed before):

1. **Mobile experience (review FIRST, on every page)** — open the mobile screenshot before the desktop one. Mobile is more than half of customer traffic and the most likely place for new bugs. For each mobile screenshot ask: does the hamburger work and reveal a real menu? Does any text or image overflow past the viewport edge? Does the hero photo crop cleanly or is it stretched/cut weirdly? Are tap targets generous enough to actually hit with a thumb? Is body text readable without zooming in? Is the phone CTA visible or one tap away? Does any card or section look broken because it didn't restack properly? **Mobile bugs are not "small" — they are half of the experience.**

2. **Active nav state** — on every interior page (about, services, contact), is the current nav item visually distinct AND legible? The previous bug shipped 2026-04-25 (morettiscentryautobody.com): active item rendered as black-on-black because `bg-iron text-bone` resolved to two near-identical dark colors. Look at the highlighted nav item with fresh eyes — can you actually read the text? **Check both desktop AND mobile** — active state may render differently between viewports.

3. **Active state shape** — is the active-state styling (underline, pill, panel, etc.) the right SHAPE for the design? A square black box around an item in an otherwise file-cabinet-tabbed nav is a styling bug even if the contrast is technically fine.

4. **Image quality and content match** — is each image clearly visible? Right orientation? Is the image relevant to the section it's in (driveway photo on driveway service, NOT a pool photo)? Are images repeated across cards within the same section? Is any hero or content image obviously stretched/pixelated? (qa-check programmatically flags both duplicates and resolution problems; this is your sanity check.)

5. **Card grid consistency** — within a single grid (services, testimonials, FAQs), do all cards have the same height? Same padding? Same icon style? Same heading weight? One CTA-styled card mixed with otherwise-neutral cards is OK; otherwise mixed sizes/styles in a grid is a bug. **Check mobile**: do the cards stack to a single column or break into something weird?

6. **Empty / placeholder content** — any card showing "Service title here" / "Lorem ipsum" / "Coming soon"? Any image rendered as a gray box? Any section that looks like the worker started building it and stopped halfway?

7. **Hero section** — does the headline read clearly over the background image? Is there visible overlay/scrim? Does the hero feel intentional and brand-aligned, or does it feel like the photo and text were composed by accident? **On mobile**: is the hero text still legible? Is the photo composition still working when cropped to portrait orientation?

8. **CTA visibility and intent** — every visible CTA button: is it obviously clickable? Does the copy say what it does? "Watch Video" buttons must wire to a real video (qa-check enforces, but verify visually). "Get a Quote" / "Call Now" should have call-out treatment. **On mobile**: are CTAs at least 44px tall? Is there a sticky bottom-bar CTA for trades sites?

9. **Typography hierarchy** — H1 obviously bigger than H2 obviously bigger than body? No section where the heading is barely distinguishable from body text? No section where two adjacent headings compete for attention? **On mobile**: does typography scale down sensibly or does H1 still take up the entire viewport?

10. **Whitespace and spacing rhythm** — sections should breathe. Do any sections feel cramped? Are there awkward whitespace gaps in the middle of a layout? Is footer sticking awkwardly to the last content section? **On mobile**: does spacing shrink proportionally or does the page feel either crushed (no breathing room) or sparse (huge empty gaps)?

11. **Color combinations that look wrong** — even if WCAG passes, do any color pairings look "off"? Yellow on cream, orange on red, two near-identical greens, etc. The text-contrast scan catches the worst, but borderline ugly combinations are visual judgment calls.

12. **Off-canvas or overflowing elements** — anything sticking out past the page edge, anything floating awkwardly because of an absolute-position bug, anything where a card extends past its container?

13. **Image-to-section mapping** — does the photo on the "Painting" service look like painting? On "Bricklaying" look like brickwork? (Beyond the duplicate check; this is about semantic match.)

14. **Footer completeness** — every social link from the manifest is present in the footer (qa-check enforces), but visually: do the icons line up? Is there a phone number? Address? Hours? Copyright?

15. **The "would I send this to a customer?" check** — final gut-check. If the customer opened this URL right now, would your instinct be "yes, here's the redesign" or would you wince first? If you wince, list what made you wince and add it to the punch list.

16. **The "$80k smell test" (DESIGN QUALITY BAR)** — the vision says A should look like a top-tier studio charged $80k. Look at the homepage screenshot honestly: could you imagine charging $80k for this? If no, what specifically is missing — typography that looks bespoke, hero treatment that earns the photo, a moment of design ambition, generous whitespace, an unexpected detail? List the gaps:
    - Are headlines using a display-quality font, not just system Inter?
    - Does the hero have any supporting design element beyond the photo + headline + button?
    - Is there at least one section per page that the customer would NOT have built themselves (custom card style, unique heading layout, stat strip, editorial pull-quote)?
    - Are there any micro-interactions (scroll reveal, hover motion, animated counters)?
    - Does the color palette feel intentional (3 primary + 2 accent, named roles) or random (six colors, no rationale)?

    If any answer is "no" or "barely," the build is below the bar. Add to the punch list. The deterministic gate's `design-quality-fonts` warning catches the font part programmatically; the rest is your judgment.

17. **Editorial-drift check (Option C ONLY)** — C's whole job is industry-anchored design (industrial / garage / food-led / clinical / architectural per the customer's industry). The plugin's default bias is editorial/magazine, so drift toward "generic Medium article" is the #1 C-specific failure mode. Look at C's homepage screenshot and ask: "If a stranger saw this without knowing the customer, would they guess the industry within 3 seconds?" If the answer is "looks like a Medium article" or "looks like any consultancy" or "looks like a generic editorial site" — C drifted. Specifically check:
    - Is the customer's scraped imagery used aggressively (hero, service tiles, team, work portfolio) OR did C ship a typographic-only design?
    - Do the colors signal the industry (workwear navy + hi-vis yellow for trades; warm earth tones for food; cool clinical-warm for medical) OR are they generic neutrals?
    - Does the typography pairing match the industry (industrial sans + mono for trades; editorial serif for food/legal; clean sans for medical/tech) OR is it the plugin's default Inter + serif headline?
    - Are industry-appropriate ornaments present (chevrons + bracket numbers for trades; texture overlays for food; thin rules for legal) OR is the page bare typography on white?

    If C drifted, the fix is in `industry-tokens.json` (Stage 7b-bis) — re-derive the tokens more aggressively, then rebuild.

18. **Diversity check (cross-build anti-monoculture, ALL options)** — this exists because of the 2026-04-25 template architecture pivot. The old `templates/astro-base/` had baked-in visual defaults (gradient-orb hero, blue+amber palette, Plus Jakarta Sans + Inter); every build that didn't fully override them inherited the same look. The pivot removed those defaults — `templates/scaffold/` provides only structure now, design is built fresh per customer. **This item is the visual defense against regression.**

    Open THIS build's homepage screenshot. Then load 2–3 recent peer builds in the same industry from disk:
    ```
    Read: jobs/{some-other-domain}/qa-option-a/desktop-home.png
    Read: jobs/{another-domain}/qa-option-a/desktop-home.png
    ```

    Honest check: does THIS site have a hero treatment, color combination, typography pairing, OR distinctive element that the others don't? If everything feels familiar — same hero composition, same palette, same fonts, same card styling — you regressed to template-y defaults despite the scaffold removing them.

    Specifically inspect:
    - Hero composition: is the photo treatment / overlay style / supporting design element (bracket number, mono caption, accent rule, etc.) different from the peer builds?
    - Color palette: are the actual hex values different, OR are you using the same "navy + amber" you used last time?
    - Typography: is the display font different from the peer builds (or at least different weight/treatment)?
    - One distinctive element per page: is THIS build's distinctive element different from what the peer builds used?

    If none of those are different → REBUILD with more design ambition. List the differences in your `build-design-decisions.md` (see below).

**Mandatory output of the visual sanity pass — `build-design-decisions.md`**: at the end of Stage 4 (and Stage 6 for B, Stage 7 for C), write `jobs/{domain}/option-{a|b|c}/build-design-decisions.md` documenting:
- Which inspiration directories you read (`saas-default`, `industrial-trades`, etc.)
- Specific design moves you drew from each (with citation — e.g., "took the three-layer hero pattern from saas-default but used a hatched-overlay treatment instead of gradient-orbs")
- What's intentionally unique to this build vs prior builds (the answers from item #18)
- Anything you deliberately did NOT copy from inspiration and why

This file is the audit trail for the inspiration-only architecture. If you ever see two builds looking identical, the design-decisions logs will reveal whether it was lazy copying or genuine brand similarity.

**Logging the pass**: write the punch list directly into your scratch notes for Stage 4e. Each item should reference (page, viewport, what's wrong, suspected fix). Do NOT mark Stage 4 complete until either the punch list is empty OR every item has been fixed and re-screenshotted, AND `build-design-decisions.md` is written.

**Self-improvement loop**: any bug class you find here that wasn't on the checklist above goes into FEEDBACK.md AND becomes either (a) a new item on this checklist OR (b) a new programmatic check in qa-check.js. The deterministic and visual layers are co-evolving — every shipped bug eventually graduates from "the model has to spot it" to "the gate catches it deterministically."

#### 4c-tris. Dramatic Improvement Audit (MANDATORY — A must be obviously better than the original)

**The vision says A is "same site, suddenly expensive" — a dramatic transformation, not a polish.** If A ships as "same layout, slightly nicer fonts, a touch more padding" — that's a polish, not an $80k rebuild. The customer's reaction should be "wait, is that the same site?" not "oh, that's nice."

Before completing Stage 4, run this audit explicitly:

1. **Open the original homepage screenshot** captured during Stage 1:
   ```
   Read: jobs/{domain}/assets/screenshots/home.png
   ```
   (If the path is different, find it — the scraper writes one full-page screenshot per page during Stage 1.)

2. **Open A's homepage screenshots** (both viewports):
   ```
   Read: jobs/{domain}/qa-option-a/desktop-home.png
   Read: jobs/{domain}/qa-option-a/mobile-home.png
   ```

3. **Articulate, in writing, three SPECIFIC dramatic improvements**. Not abstract ("looks more modern") — concrete and visual. Examples of what counts:
   - "Original hero was a flat green box with the company name; A's hero is a full-bleed photo of a finished landscape installation with a Fraunces display headline overlay and a labeled '01 // RESIDENTIAL' section number — earns the photo, signals a designed brand."
   - "Original navigation was a centered horizontal list of 9 links in Comic Sans-ish font; A's nav is a sticky 4-item nav with a yellow CTA pill, mono section indices, and a clean Inter typography pairing."
   - "Original services were 12 stacked text paragraphs; A's services are a 3-column grid of cards with icons, hover scale, and consistent treatment — 60-second skim now possible."

4. **If you cannot articulate three specific dramatic improvements** — if the answers are vague ("better fonts," "more spacing") OR if the differences are merely cosmetic (typography swap with no design ambition) — **A failed the dramatic-improvement bar**. Add to the punch list and rebuild with more ambition. Specifically:
   - Heroes: redesign the hero treatment with new layered elements (overlay + section number + mono caption + accent rule), not just "photo + headline."
   - Sections: introduce at least one section per page with a layout pattern the original doesn't have (stat strip, process steps, editorial quote, comparison table).
   - Typography: confirm a display-quality font is loaded and used at scale (not just system Inter).
   - Spacing: audit section padding — 96px+ desktop, 48px+ mobile, no exceptions.
   - Color: confirm 3 primary + 2 accent palette with named roles (per DESIGN QUALITY BAR).

5. **Log the three improvements to a new file**:
   ```
   Write: jobs/{domain}/dramatic-improvement-audit.md
   Content: brief markdown documenting the original-vs-A comparison, the 3 specific improvements, screenshot references.
   ```
   This file is for the skill-owner to review later — it's how we learn whether the bar is holding across builds.

**Why this exists**: too many shipped builds were "merely better than original." The customer's $80k expectation was set by the vision tagline; the build needs to deliver on it. This audit forces the worker session to honestly compare and either certify the dramatic improvement OR rebuild with more ambition. No "fine, ship it" without articulating WHY.

#### 4d. ~~Plugin critique~~ — REMOVED 2026-04-26 (Option A is intentionally plugin-free)

> **Architectural decision 2026-04-26**: Option A does NOT use the `frontend-design` plugin. The whole point of the A vs C customer comparison is **worker-designed (A) vs plugin-designed (C)** with content held constant via B as the bridge. If both A and C invoked the plugin, the comparison would muddle. A's design quality is the worker's responsibility — driven by the design brief, REQUIRED-PATTERNS.md, the chosen inspiration directory, the DESIGN QUALITY BAR rule, the 18-item Visual Sanity Pass (Stage 4c-bis), and the Dramatic Improvement Audit (Stage 4c-tris). No external plugin invocation needed.
>
> **Plugin-free A is non-negotiable.** If a future skill-owner is tempted to re-add the plugin to A "for one more design opinion," the cost is the comparison's value. Don't.
>
> The QA work that this stage used to perform — design critique — is now distributed across:
> - **Stage 4c-bis Visual Sanity Pass** (18 items including Item #16 "$80k smell test" and Item #18 diversity check)
> - **Stage 4c-tris Dramatic Improvement Audit** (original vs A side-by-side, must articulate 3 specific dramatic improvements)
> - **Programmatic qa-check.js** (27 deterministic rules including text-contrast, design-quality-fonts, mobile-overflow, mobile-tap-target, hero contrast, image resolution)
>
> Combined, those three layers replace what the plugin invocation here was nominally trying to add. **The plugin's expertise IS still applied to WebFactory output — exclusively in Option C** (Stages 7d build + 7g critique). Keeping it confined there is what makes the A vs C comparison meaningful.

(History: this stage previously invoked imaginary skills `design:design-critique`/`design:accessibility-review` that don't exist in any installed plugin — fixed 2026-04-26 to invoke the real `frontend-design` skill — then removed entirely later that day per architectural decision above.)

#### 4e. Fix Issues

Create a punch list from the screenshots and report:

- **Visual issues**: ugly sections, poor contrast, cramped spacing, misaligned elements
- **Broken resources**: 404 images, missing fonts (from report.json networkErrors)
- **Responsive issues**: broken mobile layouts, overflow, tiny text
- **Missing content**: text from original site not included, missing images
- **Console errors**: JS errors (from report.json consoleErrors)

Fix ALL issues by editing the Astro/CSS files. Then rebuild and re-run QA:

```bash
cd jobs/{domain}/option-a/
npm run build
```

```bash
PORT_A=$(node scripts/get-port.cjs "$DOMAIN" a)
cd /Users/tomasz/WebFactory
node scripts/qa.cjs http://localhost:$PORT_A jobs/{domain}/qa-option-a
```

**Repeat this loop up to 3 times** until no issues remain.

#### 4f. Beauty Pass

After fixing bugs, do one final review of the screenshots with fresh eyes:

- Does every section feel intentional and polished?
- Could any section benefit from a background color change, more padding, or a subtle border?
- Are the CTAs prominent and visually appealing?
- Does the overall color story feel cohesive?
- Would any section benefit from an icon, gradient, or subtle pattern?

Make refinements, rebuild, and take a final set of screenshots.

#### 4g. Stop Dev Server

```bash
kill {dev_server_pid}
```

---

---

> **→ NEXT: Stage 5 — Build Option B.** Stage 4 (QA Option A) just completed — A passes qa-check at desktop+mobile, Visual Sanity Pass done, Dramatic Improvement Audit logged. Continue IMMEDIATELY to Stage 5. Do NOT ask the user "happy with A? ready for B?" Do NOT pause to compare. Just start B. (See PIPELINE COMPLETION CONTRACT at top.)

### Stage 5: Build Option B (Canonical Conversion-Tuned Rewrite)

> **The brief in one line:** _"Same site, suddenly persuasive."_
> Same design as A — same logo, same images, same colors, same typography, same components, same layout. The ONLY thing that changes is the text: rewritten to read like agency-grade copy with a sales lens. Grammatical errors fixed. Lorem-ipsum placeholders replaced with real content derived from manifest facts. Verbose paragraphs tightened. Sentence rhythm varied. CTAs sharpened for conversion. Value propositions reordered for impact. Voice preserved (folksy plumber stays folksy — just clearer; corporate firm stays corporate — just sharper). The customer should look at A and B side-by-side and say _"that's the same design, but B actually sells me."_

**B is the canonical text source for the rest of the pipeline.** Options B and C inherit B's text verbatim (then render in their own design). This means the rewrite work is shared across B, B, and C — three deliverables, one carefully-crafted text version. Customer comparison becomes "same words, four designs" (A's original copy + 3 variants of the new copy in different design languages).

B is a **copy rewrite of A's source files**, not a new build from scratch. It runs after Stage 4 finishes (so A is QA-passed and stable). Options B and C cannot start until B is complete (they depend on B's text).

#### 5a. Duplicate A as B

```bash
cp -r jobs/{domain}/option-a/ jobs/{domain}/option-b/
```

Then strip the `node_modules/` and `dist/` from the copy (we'll rebuild them):

```bash
rm -rf jobs/{domain}/option-b/node_modules
rm -rf jobs/{domain}/option-b/dist
cd jobs/{domain}/option-b/
npm install
```

#### 5b. Rewrite the copy in every page

For each `.astro` file in `jobs/{domain}/option-b/src/pages/`, identify the text-content sections (between tags, in `<Hero text=…>`, in `<Section>` body, etc.) and rewrite them.

**RULES for the rewrite:**

**DO:**
- Fix grammar errors, typos, awkward phrasing
- Replace placeholder/lorem-ipsum text with real content derived from manifest facts (e.g., "Business Tagline Lorem Ipsum Dolor" → "Veteran-Owned Plumbing Across Southwest Florida Since 2009" — only if "veteran-owned" and "2009" both appear in the manifest)
- Tighten verbose copy where it doesn't sacrifice meaning (10–30% shorter is typical)
- Vary sentence length for rhythm (mix short punchy + medium descriptive)
- Use active voice where it tightens the sentence
- Use the customer's own specifics (years in business, license numbers, awards, partner brands, service areas, etc.) in place of generic claims — but ONLY specifics that exist in the manifest
- Sharpen CTAs for conversion ("Get a Quote" → "Get Your Free 24-Hour Quote", "Contact Us" → "Talk to a Real Plumber Tonight"). Use specifics drawn from manifest content (warranties, response times, guarantees) — never invent
- Reorder value propositions on a page so the strongest hooks land first (e.g., move "24/7 emergency response" above "we're family-owned" if the customer is in pain when they hit the page)
- Maintain headings hierarchy and section structure within a page (B shares A's layout — only text content changes)

**DO NOT (FACT GROUNDING + TESTIMONIAL & REVIEW PRESERVATION — see top-level principles):**
- Add new claims, awards, metrics, partners, or specs not supported by manifest content
- Reposition the business into a different industry or category
- Invent new value propositions — you may sharpen the wording of existing ones, but don't add ones the customer doesn't already make
- Drop content (testimonials, services, certifications still 100% present)
- Change phone numbers, email addresses, business names, license numbers, addresses, founder names, or any factual fixed string
- Substitute, remove, or rearrange images
- Change page count, page structure, or nav organization
- Make a folksy small-town plumber sound like a Linear marketing page (or vice versa) — voice preservation is non-negotiable
- Restructure section ORDER beyond reordering value props within an existing section (B's layout is A's layout)
- **TOUCH ANY TESTIMONIAL OR REVIEW TEXT** — see TESTIMONIAL & REVIEW PRESERVATION rule. Reviews are real customers' words attributed to them by name. They are NOT copy. Do not "tighten," "fix grammar," "improve," or "compose" a review. Verbatim, full, unedited. This applies to: blockquotes, testimonial cards, named quotes, star-rated cards, named-employee/founder quotes, "Featured in / As seen on" attributions, dedicated `/reviews` or `/testimonials` pages. Layout/styling/ordering/selection of which reviews to feature on which page = OK. Touching the words = forbidden.

**Sharpening vs fabrication — concrete examples (read before rewriting):**

| Manifest contains... | ✓ Allowed (sharpening) | ✗ FORBIDDEN (fabrication or tampering) |
|----------------------|------------------------|---------------------------|
| "Established 2003" | "20+ years in business" (math from 2003 → today) | "30+ years experience" (number not derivable from any date in manifest) |
| "We serve Tampa Bay" | "Trusted across Tampa Bay since 2003" (if 2003 is in manifest) | "Tampa's #1 rated service" (no rating in manifest) |
| "Family-owned" | "Family-owned and operated" | "Family-owned and veteran-owned" (veteran claim absent) |
| "Licensed plumber" | "Fully licensed plumbing pros" | "Licensed, bonded, and insured" (bonded/insured absent) |
| Any 5-star reviews shown | "Customers love our work" (paraphrasing in YOUR copy, not editing the review) | "200+ five-star reviews" (review count absent) |
| "Available days, evenings, weekends" | "We answer the phone day or night, weekend or not" | "24/7 emergency response" (24/7 not stated) |
| Customer photo of award plaque | "Award-winning service" (if specific award is named in manifest) | "Award-winning service" (if no specific award is named) |
| Nothing about year founded | (no year claim allowed) | "20+ YEARS EXPERIENCE" badge (this was the bug we shipped) |
| Mention of one trusted brand | "We service Trane systems" | "Authorized dealer for Trane, Carrier, and Lennox" (not in manifest) |
| Review: "Bryan and his team did an awesome job, super proffesional, would recommend!" | (display verbatim — typo and all — and attribute to the named reviewer) | "Bryan's team did exceptional, professional work — highly recommended." (you just put words in the customer's mouth attributed to them by name) |
| Review: "Quick service. Decent price. They showed up on time." (terse) | (display verbatim — terseness is the customer's voice) | "Quick service, decent prices, and they always show up on time — couldn't ask for more!" (composite/embellished — fabrication of voice) |
| Two short reviews from two named people | (show both verbatim, side by side or stacked) | Combine into one "composite" review with both names attributed (impersonation) |
| Manifest has 12 reviews on /reviews page | (show all 12 verbatim on /reviews; show 3 chosen verbatim on homepage) | Pick 3 to show + edit them to be "tighter" (tampering) |

**The before-you-write-it test (FACT GROUNDING):** For every numeric claim, dated claim, credential, or identity assertion you put on the page, you must be able to point to the line in the manifest that supports it. If you can't, the claim doesn't go on the page. The qa-check.js fact-grounding check (Stage 6 / Stage 8a) will catch you if you slip; better to catch it now in your own head than at the deploy gate.

**The hands-off test (TESTIMONIAL & REVIEW PRESERVATION):** Before you change any character inside a `<blockquote>`, testimonial card, attributed quote, or anything inside a `/reviews` page — STOP. Ask: "Is this text quoted from a named person?" If yes, it stays exactly as-is. The qa-check.js testimonial-tampering check compares B's testimonial text to A's testimonial text and fails the build on any divergence.

**Voice match guidance:** Read 3–5 paragraphs from the original manifest before rewriting. Notice tone, formality level, jargon density, sentence length distribution. The rewrite should match that voice but cleaner. If the original is conversational ("We've been Englewood's go-to plumbers since 2009"), don't make it formal ("Established in 2009, our plumbing services have served the Englewood community").

**Layout flex tolerance**: Components in B may render slightly taller or shorter than A because of copy-length differences. That's fine. Don't fight it with hardcoded heights. The design language is identical; small layout flex is expected and acceptable.

#### 5c. Build check

```bash
cd jobs/{domain}/option-b/
npm run build
```

Fix any build errors before proceeding to QA.

#### 5d. Logo + Image rules (inherited from A)

Same as Option A:
- **Logo**: ALWAYS preserve the original (B is "same site, suddenly literate" — same logo, same images)
- **Images**: Same image-to-page binding as A. B uses A's image references unchanged.

These are non-negotiable for B. The wordmark fallback rule for B/C does NOT apply to B.

#### 5e. Add `lang` prop to BaseLayout (one-time scaffold edit — runs unconditionally)

BaseLayout always accepts a `lang` prop, even on English-only builds. This is a future-proofing edit — keeping the prop wired in costs ~5 lines of code and ensures any later `--add-language` invocation can pass `lang="de"` etc. without rewriting the layout. Edit `option-b/src/layouts/BaseLayout.astro`:

```astro
---
interface Props {
  title: string;
  description?: string;
  active?: string;
  lang?: string;        // ISO 639-1 code; defaults to 'en'. Generalized from the original 'en' | 'es' literal type.
}
const { title, description, active = 'home', lang = 'en' } = Astro.props;
---
<!doctype html>
<html lang={lang}>
  <head>
    {/* … existing head … */}
  </head>
  <body>
    {/* … existing body … */}
  </body>
</html>
```

The default `'en'` keeps English pages working without per-page edits. On English-only builds, the prop is never explicitly passed — `lang="en"` is implied everywhere.

#### 5e-bis. Was `--languages <list>` passed? (CONDITIONAL gate for 5f / 5g / 5h)

Substages 5f, 5g, and 5h run ONLY if the user passed `--languages` to `/webfactory`. Read the flag's parsed value:

```bash
LANGUAGES_FLAG="${LANGUAGES_FLAG:-}"   # comma-separated ISO 639-1 codes; empty if --languages not passed
if [ -z "$LANGUAGES_FLAG" ]; then
  echo "ℹ️  --languages flag not passed; skipping 5f/5g/5h (English-only build)."
  echo "   To add languages later: /webfactory <domain> --add-language <name|iso> --to <b|c|both>"
else
  echo "→ --languages=$LANGUAGES_FLAG; proceeding with 5f/5g/5h for each requested language."
fi
```

If empty: skip directly to **5i (Build check)**. The B build is English-only.

If non-empty: parse the comma-separated list into ISO codes (resolving English names via the language table — `Spanish`/`es` both resolve to `es`), then run 5f/5g/5h once per code.

#### 5f. Per-language translations — produce `/<lang>/<page>.astro` per page (CONDITIONAL on `--languages`)

**This substage runs only if `--languages` was passed (per 5e-bis gate). On English-only builds, skip directly to 5i.**

Per the MULTILINGUAL SUPPORT rule, every requested language gets a parallel page set under `option-b/src/pages/<lang-code>/`. With `--languages es,de,fr`, each Stage 5 Sonnet sub-agent that rewrites an English page ALSO produces 3 translations (Spanish, German, French) of that page. With `--languages es` only, 1 translation per page. With no `--languages` flag, 0 translations — substage skipped.

**Sub-agent contract (extended from Stage 5b)**:

Each sub-agent receives:
- The page being rewritten (`option-b/src/pages/<page>.astro`) — produced by step 5b
- B's design tokens + components from `_shared.md`
- The translation directives below (what to translate, what to keep)
- The list of active languages from `--languages` (e.g., `[es, de, fr]`)

Sub-agent output is N+1 files (atomic):
- `option-b/src/pages/<page>.astro` (English rewrite — already produced in 5b; this step is the rewrite verifying it landed)
- For each lang in the active list: `option-b/src/pages/<lang>/<page>.astro` (translated version — new in this step)

**Translation directives** (apply per language; identical structure for each):

- Translate every customer-facing string (headlines, body, CTAs, image `alt`, `<title>`, `<meta description>`, nav labels, button text, form labels, footer copy)
- KEEP UNCHANGED (single source of truth across languages):
  - Phone numbers, email addresses, license numbers
  - Place names (Tampa, Lancaster, Ohio, etc. — use as-is in target-language prose)
  - Business names, founder names, customer review attribution names, brand names
  - All `<img src="…">` paths (same images in EN and every translation; only the `alt` is translated)
  - All structural markup, components, grid configs, section ordering
- For testimonials: translate the testimonial body, append `<small>{translation-tag}</small>` below the `<cite>` element where `{translation-tag}` is the per-language tag from the language table (e.g., `(traducido del inglés)` for ES, `(aus dem Englischen übersetzt)` for DE, `(traduit de l'anglais)` for FR — see full table above). Keep the attribution name original. Example for Spanish:
  ```astro
  <blockquote>"¡Excelente trabajo!"</blockquote>
  <cite>— Mark S. <small>(traducido del inglés)</small></cite>
  ```
- Pass `lang="<lang-code>"` when rendering BaseLayout in `/<lang>/*.astro` pages
- Voice match: read 2–3 paragraphs of B's English first; each translation should be idiomatic, match B's tone (folksy stays folksy, professional stays professional), and read like a native speaker of that language wrote it — not like a literal translation

**Per-language nav label mappings** (use as canonical defaults unless customer manifest already provides translations):

Spanish (`es`):

| English | Spanish |
|---|---|
| Home | Inicio |
| About | Sobre Nosotros |
| Services | Servicios |
| Projects | Proyectos |
| Portfolio | Portafolio |
| Contact | Contacto |
| Blog | Blog (kept) |
| Reviews | Reseñas |
| Get a Free Estimate | Solicite un Presupuesto Gratis |
| Call Now | Llame Ahora |
| Learn More | Más Información |
| See the Job | Ver el Trabajo |

For other active languages (de, ru, it, fr, pt, pl, zh, ja, ko, nl, sv), the sub-agent translates these labels via standard target-language conventions. Workers may consult the source manifest first for any customer-provided translations before falling back to default labels.

#### 5g. Language switcher — add to Nav component (CONDITIONAL on `--languages`)

**This substage runs only if `--languages` was passed. On English-only builds, no switcher is rendered (single-language nav has nothing to switch to).**

Edit `option-b/src/components/Nav.astro` to add a multi-language switcher that lists ALL active languages including English. The switcher:

1. Detects active languages by inspecting `option-b/src/pages/` subdirectories at build time (each subdirectory named with an ISO 639-1 code = an active language; English is always implicitly active)
2. Renders one entry per active language, each linking to the parallel page in that language. The currently-active language renders as a non-clickable `<span>` (not `<a>`).
3. Computes parallel-language URLs:
   - From an English page (`/services`): switching to `de` → `/de/services`; switching to `es` → `/es/services`
   - From a `/de/` page (`/de/services`): switching to English → `/services`; switching to `fr` → `/fr/services`
4. Each entry has `aria-label` referencing the target language ("Switch to English", "Cambiar a Español", "Auf Deutsch wechseln", "Перейти на русский", "Passa all'italiano", "Passer au français", etc.)
5. Tap target ≥ 44×44px per item
6. Sits in the visible nav, not buried in the footer

**Style variants (worker picks based on active-language count)**:

- **2 languages active** (e.g., EN + ES): simple toggle row (`EN | ES`). Each item is a separate `<a>` (or `<span>` if it's the current page's language). Active language is bold + non-clickable.
- **3 languages active** (e.g., EN + ES + DE): same toggle row pattern (`EN | ES | DE`).
- **≥ 4 active languages** (e.g., EN + ES + DE + FR + IT): dropdown menu. The dropdown trigger shows the current language (e.g., `ES ▾`); the menu lists the others. Use `<details>/<summary>` for no-JS toggle compatibility.

Both variants must work on mobile (44px tap targets, dropdown opens on tap not hover).

Example pattern (2-language toggle, EN + ES):

```astro
---
// Detect active languages from src/pages/<lang>/ subdirs (passed via build-time const or computed via Astro.glob)
const activeLanguages = ['en', 'es'];   // 'en' always first; rest from src/pages/<lang>/ subdir names
const currentLang = Astro.url.pathname.match(/^\/([a-z]{2})\//)?.[1] ?? 'en';

function pathFor(targetLang: string): string {
  const stripped = Astro.url.pathname.replace(/^\/[a-z]{2}\//, '/');
  return targetLang === 'en' ? stripped : `/${targetLang}${stripped === '/' ? '/' : stripped}`;
}

const labels: Record<string, string> = { en: 'EN', es: 'ES', de: 'DE', fr: 'FR', it: 'IT', ru: 'RU', pt: 'PT', pl: 'PL', zh: 'ZH', ja: 'JA', ko: 'KO', nl: 'NL', sv: 'SV' };
const ariaLabels: Record<string, string> = {
  en: 'Switch to English',
  es: 'Cambiar a Español',
  de: 'Auf Deutsch wechseln',
  fr: 'Passer au français',
  it: 'Passa all\'italiano',
  ru: 'Перейти на русский',
  // … extend as more languages are added
};
---
<div class="nav-lang-switcher" role="group" aria-label="Language">
  {activeLanguages.map(lang => lang === currentLang
    ? <span class="nav-lang-current min-h-[44px]" aria-current="true">{labels[lang]}</span>
    : <a href={pathFor(lang)} aria-label={ariaLabels[lang]} class="nav-lang-link min-h-[44px]">{labels[lang]}</a>
  )}
</div>
```

#### 5h. Multilingual completeness check (CONDITIONAL on `--languages`)

**This substage runs only if `--languages` was passed. On English-only builds, skip directly to 5i.**

Before declaring Stage 5 done, verify parity across every active language:

```bash
cd jobs/{domain}/option-b
EN_COUNT=$(find src/pages -maxdepth 2 -name '*.astro' -not -path '*/[a-z][a-z]/*' | wc -l)
echo "English pages: $EN_COUNT"
PARITY_OK=1
for LANG_DIR in src/pages/*/; do
  LANG=$(basename "$LANG_DIR")
  # Skip non-language subdirs (e.g., src/pages/blog/ when blog is not a lang code)
  if [ ! ${#LANG} -eq 2 ]; then continue; fi
  LANG_COUNT=$(find "$LANG_DIR" -name '*.astro' | wc -l)
  echo "$LANG pages: $LANG_COUNT"
  if [ "$EN_COUNT" != "$LANG_COUNT" ]; then
    echo "✗ MISMATCH for $LANG — expected $EN_COUNT pages, got $LANG_COUNT"
    PARITY_OK=0
  fi
done
[ "$PARITY_OK" = "1" ] && echo "✓ parity across all active languages" || echo "✗ FIX BEFORE PROCEEDING"
```

Every English page must have a counterpart in EVERY active language. Catch missing translations BEFORE running build + QA — the `multilingual-page-parity` qa-check rule will block deploy if you miss one, but catching it here is cheaper than fixing at deploy gate.

#### 5i. Build check (runs unconditionally)

```bash
cd jobs/{domain}/option-b/
npm run build
```

Fix any build errors before proceeding to Stage 6 QA. Common errors at this stage:

- (English-only build) Standard Astro/Tailwind compile errors only — no multilingual-specific errors possible.
- (Multilingual build) `BaseLayout` doesn't accept `lang` prop → add it (step 5e — should already be done).
- (Multilingual build) `/<lang>/` pages reference language-specific assets that don't exist → check image paths (should match English unchanged; only `alt` translates).
- (Multilingual build) Hardcoded English strings in components leak into `/<lang>/` rendering → audit Nav, Footer, CtaBanner for hardcoded strings; either accept `lang` prop or use a string-table.

---
---

---

> **→ NEXT: Stage 6 — Visual QA & Copy Review for Option B.** Stage 5 (Build B) just completed. Continue IMMEDIATELY to Stage 6. Do NOT ask the user to review B's copy first. The qa-check + visual sanity pass IS the review. Just run them. (See PIPELINE COMPLETION CONTRACT at top.)

### Stage 6: Visual QA & Copy Review (Option B)

Same QA flow as Stage 4 (start dev server, run `qa-check.js`, run `qa.cjs` for screenshots, design-critique, accessibility-review) but against `jobs/{domain}/option-b/`. Use the `optionB` port from metrics.json (allocated as `portA + 3` — see `init-metrics.cjs`).

**The Visual Sanity Pass from Stage 4c-bis applies here too — run the full 15-item checklist against `jobs/{domain}/qa-option-b/` screenshots.** B inherits A's design but the rewrite can introduce new bugs (text overflow because new copy is longer, broken active states because new pages were added, etc.). Do not skip the visual pass on the assumption that "B is just A with new words."

**B specific checks the visual QA must catch:**

1. **Layout match with A**: open A's homepage screenshot and B's homepage screenshot side-by-side. They should be visibly the same site. Sections in the same order, components looking the same, colors identical, fonts identical. Differences are limited to text length flexing components slightly.

2. **Copy actually rewritten**: pick one or two paragraphs in A vs B and verify the text is genuinely different. If B's text is identical to A's, the rewrite didn't run — fix and rebuild.

3. **No fabricated facts (FACT GROUNDING — see top-level principle)**: cross-reference every numeric, dated, credential, or identity claim in B with the manifest. If B says "200+ five-star reviews" / "20+ years experience" / "BBB A+ rated" / "family-owned" and the manifest doesn't support it, that's a hallucination — must be removed. The qa-check.js fact-grounding check (run in step below) enforces this programmatically; if it flags a claim, do NOT loosen the check — fix the copy.

4. **Voice preserved**: read 2–3 paragraphs of B and compare tone/formality with the original manifest text. If B sounds noticeably different in personality, the rewrite went too far.

5. **CTA changes are allowed in B**: B is the canonical conversion-tuned rewrite — CTA wording can sharpen for conversion. The check here is that any CTA changes are intentional (sharpened, more specific) rather than accidental drift. If a CTA in B reads worse or vaguer than A's, that's a regression.

6. **All images and logos still present**: B's nav has the same logo as A. Every image in B has the same `src` as the matching image in A. If a logo or image went missing during the rewrite pass, restore it.

If any of these fail, fix and rebuild B before proceeding to Stage 5/Stage 8.

```bash
PORT_A_PLUS=$(node scripts/get-port.cjs "$DOMAIN" a-plus)
cd jobs/{domain}/option-b/
npx astro dev --port $PORT_A_PLUS &
echo $!
```

```bash
PORT_A_PLUS=$(node scripts/get-port.cjs "$DOMAIN" a-plus)
cd /Users/tomasz/WebFactory
node scripts/qa-check.js http://localhost:$PORT_A_PLUS --manifest jobs/$DOMAIN/manifest.json --reference-dist jobs/$DOMAIN/option-a/dist / /about /contact
```

```bash
PORT_A_PLUS=$(node scripts/get-port.cjs "$DOMAIN" a-plus)
mkdir -p jobs/{domain}/qa-option-b
node scripts/qa.cjs http://localhost:$PORT_A_PLUS jobs/{domain}/qa-option-b
```

Stop server when done:

```bash
kill {dev_server_pid_a_plus}
```


---

> **→ NEXT: Stage 7 — Build Option C.** Stage 6 (QA Option B) just completed. Continue IMMEDIATELY to Stage 7. Do NOT ask the user "want to proceed to C?" — the URL was the authorization. **EXCEPTION**: if `$SKIP_C=1` (user passed `--skip-c`), SKIP this entire stage and continue IMMEDIATELY to Stage 8a. Do NOT ask "should I skip C?" — the flag is unambiguous. (See PIPELINE COMPLETION CONTRACT at top.)

### Stage 7: Build Option C via Frontend Design Plugin (Conversion Optimized, Plugin-Driven)

> **⏭️ SKIP-C MODE GATE**: if `$SKIP_C` was set to `1` from the input parsing (i.e., the user passed `--skip-c` / `--no-c` / `--ab-only`), **skip this entire stage**. Do not create `option-c/`, do not invoke the plugin, do not derive industry tokens, do not build, do not deploy, do not verify. Print `⏭️  Stage 7 skipped (SKIP-C mode)` and proceed directly to Stage 8 (which will also gate on `$SKIP_C`).
>
> ```bash
> if [ "$SKIP_C" = "1" ]; then
>   echo "⏭️  Stage 7 skipped (SKIP-C mode)"
>   # do not proceed with any 7a-7g substeps
> fi
> ```

> **The brief in one line:** _"Same sharper words from B, industrial design language from the plugin."_
> B already wrote the canonical conversion-tuned copy. C's job is to render those exact words in the plugin's industry-anchored design — for trades customers, that's industrial/utility aesthetic; for restaurants, food-led; for medical, clinical-warm; etc. The text from B is locked. The design is the variable. If you find yourself rewriting copy that's already in B, stop — you're doing the wrong job. The plugin's job is to raise the design bar; it is NOT permission to invent a new brand or rewrite the words. Real bugs from bigdaddysdumpers.com: C invented a "weird-looking blob" logo and used a residential-rental photo on the landscaping page. Both happened because C drifted past its actual job.

Option C is a **third output** alongside Options A and B. Same customer content, same manifest, same Astro + Tailwind v4 stack — but the design engine is the **Frontend Design plugin** (installed via `claude plugin install frontend-design@claude-plugins-official --scope project`).

**Architecture 2 update — text comes from B, not from independent rewrite:** Option C does NOT do its own copy rewrite. The canonical conversion-tuned text was produced by B (Stage 5). C reads B's `.astro` files for text content and re-renders that same text in the plugin's industry-anchored design language. This means B, B, and C all share the same words — only the design differs. **C cannot start until B is complete.**

The plugin auto-activates when Claude builds frontend interfaces. Its default bias is toward **type-driven editorial design** — which is *wrong* for trades/services customers. Option C constrains the plugin with industry-anchored rules and aggressive reuse of scraped imagery.

Option C inherits ALL image rules and content-parity rules from Option B. The plugin helps with the *design execution*, not with skipping content. Text comes from B; only the design changes.

#### 7a. Verify plugin is installed

```bash
claude plugin list 2>/dev/null | grep frontend-design
```

If it's not listed, the user must install it from their terminal (not from this Claude Code app session):

```bash
cd /Users/tomasz/WebFactory
claude plugin install frontend-design@claude-plugins-official --scope project
```

Then restart the Claude Code session so the plugin's skills load. Do NOT proceed with Option C until the plugin is installed AND the session has been restarted.

If the plugin can't be installed for some reason, skip Option C entirely (Options A + B still deploy fine).

#### 7b. Commit to an INDUSTRY-APPROPRIATE aesthetic direction

Read `jobs/{domain}/design-brief.json` → `business.industry`. The aesthetic direction for Option C must be appropriate for THAT industry — not a generic "editorial magazine" or "photo catalog" or "brutalist minimalism."

| Industry | Aesthetic direction | What it looks like |
|----------|---------------------|---------------------|
| Plumbing, HVAC, electrical, construction, landscaping, cleaning | **Industrial / trades** | Solid, confident, workwear catalog meets engineering documentation. Real photos of tools, trucks, crews, finished work. |
| Auto repair, body shop, detailing | **Garage** | Gritty, competent, hardware-forward. Photos of cars, bays, tools. |
| Restaurant, cafe, bakery | **Food-led** | Photography dominates. Menu/ingredient typography. Warm color. |
| Law, accounting, finance | **Authoritative editorial** | Sparse photography, confident serif type, restrained color. |
| Retail, e-commerce | **Product-led** | Photography IS the design. Minimal chrome. |
| Medical, dental | **Clinical-warm** | Clean, reassuring, real-patient photography. |
| Real estate | **Architectural** | Big architectural photos, restrained typography. |

**If the customer's industry doesn't match any of these**, escalate to the closest adjacent industry. Plumbing escalates to HVAC/industrial trades, NOT to editorial design.

Write the committed aesthetic direction into `jobs/{domain}/option-c/aesthetic-brief.md` as a short paragraph (for traceability).

#### 7b-bis. Derive INDUSTRY DESIGN TOKENS before building (MANDATORY)

The plugin's default bias is editorial. Without explicit token constraints, C will drift into "generic magazine layout" regardless of industry. **Before writing a single .astro file**, write `jobs/{domain}/option-c/industry-tokens.json` with concrete CSS variable values keyed to the industry direction. The build then consumes this file to seed the design system.

**Required token structure** (model populates each value based on industry):

```json
{
  "industry": "plumbing",
  "direction": "industrial / trades",
  "palette": {
    "primary":   { "hex": "#1a2433", "role": "deep workwear navy / nav bg",       "rationale": "..." },
    "secondary": { "hex": "#c4452f", "role": "crew red / heading accent",          "rationale": "..." },
    "accent":    { "hex": "#ffc107", "role": "hi-vis safety yellow / CTA only",    "rationale": "..." },
    "surface":   { "hex": "#f5f2e9", "role": "page wash / off-white card surface", "rationale": "..." },
    "ink":       { "hex": "#14140f", "role": "body text / structural lines",       "rationale": "..." }
  },
  "typography": {
    "display": { "family": "Cabinet Grotesk", "use": "headlines, section labels", "rationale": "industrial sans with weight character" },
    "text":    { "family": "Inter",           "use": "body, lists, captions",     "rationale": "neutral pairing" },
    "mono":    { "family": "JetBrains Mono",  "use": "section numbers, file-tab nav, captions, stat callouts", "rationale": "engineering-document signal" }
  },
  "ornament": {
    "shapes": ["chevrons", "hatched borders", "section labels with bracket numbers like [01]", "dotted dividers"],
    "avoid":  ["rounded magazine cards", "serif pull-quotes", "centered editorial headlines", "thin pastel accents"]
  },
  "imagery_directive": "Use scraped photos of trucks, crews, finished work AT FULL BLEED. Industrial = SHOW the work. Typographic-only sections are forbidden when manifest images exist."
}
```

**Token derivation table by industry direction** (use as starting point; the model adjusts hex values to match the customer's actual brand color signal):

| Direction          | Palette character                                             | Typography                                | Ornament                                                | Avoid                                          |
|--------------------|---------------------------------------------------------------|-------------------------------------------|---------------------------------------------------------|------------------------------------------------|
| Industrial / trades| Workwear navy/charcoal + crew red + hi-vis safety yellow      | Industrial sans display + neutral text + mono captions | Chevrons, hatched borders, bracket numbers `[01]`, file-tab nav | Rounded magazine cards, serif pull-quotes, centered editorials |
| Garage             | Asphalt black + steel grey + signal orange                    | Stencil/mechanical display + sans text    | Diagonal stripes, gear/tool dingbats, mechanical labels | Pastels, rounded everything, serif body         |
| Food-led           | Warm earth (clay, terracotta, cream, espresso)                | Editorial serif display + cozy sans text  | Texture overlays, hand-drawn dividers, ingredient lists | Hi-vis colors, industrial mono, brutalist sans |
| Authoritative editorial | Restrained monochrome + 1 muted accent (oxblood, forest, navy) | Confident serif display + serif text       | Tight rules, drop caps, restrained dividers              | Hi-vis colors, casual sans, ornament-heavy     |
| Product-led        | Neutral whites/greys + product-photo color does the work       | Clean sans display + sans text             | Minimal — let photography speak                          | Heavy ornament, editorial serifs, dark themes  |
| Clinical-warm      | Cool whites + soft sage/dusty blue + warm cream accents       | Friendly sans display + readable sans text | Soft rounded shapes, generous whitespace, gentle dividers | Hi-vis, industrial, gritty, dark themes        |
| Architectural      | Concrete grey + ink black + 1 muted brand accent               | Architectural sans + serif text            | Thin lines, oversized photography, architectural labels  | Decorative ornament, warm pastels              |
| **B2B tech / SaaS / fintech / holding co** (added 2026-04-29) | Refined-modern minimalism: near-white or near-black + ONE single accent + ample whitespace. Models: Stripe / Linear / Vercel / Anthropic.com. | Quiet sans (Inter Tight, GT America, Söhne, IBM Plex Sans) at modest weights. NO display serifs. Mono RARELY (only for actual code) | Hairline structure, generous whitespace, ONE accent used sparingly (≤ 5% of page area), subtle motion on hover only | **Bracket numerals (`[01]`, `01 /`), status dots/pills (●●● green-dot indicators), pseudo-filename eyebrows (SYSTEM_X.json, /docs/v2.md), terminal cursors (`> _`), control-plane ornament (admin-dashboard chrome, network-graph backgrounds, monospace SQL snippets as decoration). Bracket numbers + status pills + grid overlays + dashboard tropes are SaaS-tool aesthetics, NOT brand-site aesthetics.** |

**The build (Stage 7d below) MUST consume `industry-tokens.json`** — wire each `palette.*.hex` value into `src/styles/global.css` as a CSS variable, set the `typography.display/text/mono` families as the Google Fonts loaded in BaseLayout, and apply `ornament.shapes` as the design vocabulary across components. The `ornament.avoid` list is what the build MUST NOT do.

**Editorial-drift catch (in Visual Sanity Pass for C)**: after building, look at C's homepage screenshot and ask: "If a stranger saw this without knowing the customer, would they guess the industry within 3 seconds?" If the answer is "looks like a Medium article" or "could be any consultancy" — C drifted into editorial. Reject and rebuild with the industry tokens applied more aggressively.

**Control-plane-reflex catch (in Visual Sanity Pass for C, especially for B2B tech / SaaS / fintech / holding-co directions)**: the OPPOSITE drift from editorial. After building, look at C's homepage screenshot and ask: **"Does this read as a sophisticated brand site, or as an internal tool / SaaS dashboard / admin console?"** If the screenshot looks like a thing you'd USE (Vercel deploy panel, Linear ticket queue, Stripe API console) rather than a thing you'd READ (sophisticated company brand site) — C drifted into control-plane reflex. Real bug shipped 2026-04-29 (Option C for a holding-co customer): the design featured bracket numerals + status dots + status pills + grid overlays + terminal cursors + spec callouts simultaneously. Each "felt right" individually for a tech brand, but stacked together they produced "admin dashboard" not "Stripe.com brand site."

**The mirror question to editorial-drift**: where editorial-drift is "this could be a Medium article", control-plane-drift is "this could be an internal tool screenshot." Both are failure modes. Both reject and rebuild — but the fix is different:

- **Editorial drift fix**: apply industry-tokens more aggressively (more workwear vocabulary, more hi-vis, more chevrons, more bracket numerals — the trades vocabulary).
- **Control-plane drift fix**: STRIP the dashboardy ornaments (status dots, terminal cursors, bracket numerals, grid overlays, file-tab nav as decoration) and re-execute with refined-modern minimalism (Stripe / Linear / Vercel / Anthropic.com). Keep ONE accent. Hairline structure only. Quiet typography. The B2B tech / SaaS / fintech / holding-co row in the table above is the right reference for this fix.

The two checks together catch BOTH directions of drift. Run BOTH on every C build. If either fires, reject and rebuild before proceeding to Stage 8.

#### 7c. Set up Option C project structure

Same scaffold as A (the pure-scaffold pivot from 2026-04-25 — see Stage 3-pre / 3a). Copy `templates/scaffold/`, NOT `templates/astro-base/` (which no longer exists; its contents moved to `templates/inspiration/saas-default/` as reference only).

```bash
cp -r templates/scaffold/ jobs/{domain}/option-c/
```

```bash
cd jobs/{domain}/option-c/
npm install
```

For C, also read `templates/inspiration/industrial-trades/` (or the inspiration directory matching `industry-tokens.json → direction`) before designing — that's the explicit purpose of the inspiration library, especially for C where the plugin's editorial bias most needs counterweight.

```bash
# Copy all scraped images — we'll use them aggressively
cp jobs/{domain}/assets/img/* jobs/{domain}/option-c/public/images/
```

**DO NOT** create `.claude/launch.json` inside `option-c/`.

#### 7d. Build pages with plugin active — HARD RULES

> **DECOMPOSED-MODE NOTE (since 2026-04-29 + validated experiment 2026-04-29 on libertylandscapefl):** in decomposed mode (which is now the default), Stage 7d still BEGINS with the explicit plugin invocation below — the plugin produces the C design system (palette, typography, components, ornament, CSS classes, BaseLayout/SiteLayout) for the WHOLE site. **THEN** Opus splits the per-page work the same way it does for A and B:
>
> 1. Plugin invocation (Opus) → produces shared scaffold: `src/components/`, `src/layouts/`, `src/styles/global.css`, `industry-tokens.json` consumed and wired in. **The plugin's BaseLayout/SiteLayout MUST accept a `lang` prop** (same pattern as Stage 5e for Option B) — required for any future `/<lang>/` rendering even on English-only builds (future-proofing for `--add-language`).
> 2. Stage 2.7 contrast lint on the plugin's scaffold (re-use the smoke-test pattern). The plugin's output isn't immune to contrast bugs.
> 3. Stage 2.5 spec generation (Opus) — write per-page specs for C that reference: (a) B's verbatim text from `option-b/src/pages/*.astro` (English), (b) **B's verbatim translated text from each active language directory `option-b/src/pages/<lang>/<page>.astro` IF ANY (single source of truth from MULTILINGUAL SUPPORT rule — only present when the user passed `--languages` at build OR `--add-language` post-build)**, (c) the plugin-output components, (d) the industry-tokens.json palette/typography/ornament. Save to `jobs/{domain}/specs-c/` (separate from the A/B specs in `specs/`). **Each spec references the EN source file unconditionally; only references translated source files for languages currently active in B's `src/pages/`** — on English-only builds, the spec mentions zero translation source files.
> 4. Stage 2.5b validate-specs (mandatory — same script as A/B).
> 5. Stage 7d-build: spawn N Sonnet sub-agents in parallel, one per page. Each consumes its spec + the plugin-output scaffold and writes 1 English `.astro` file UNCONDITIONALLY at `option-c/src/pages/<page>.astro`. If languages are active in B, the worker ALSO writes one translated `.astro` per active language at `option-c/src/pages/<lang>/<page>.astro` — matching B's translated copy byte-identical (per MULTILINGUAL SUPPORT rule + extended testimonial-tampering check on every `/<lang>/`). On English-only builds, no `/<lang>/` files are produced. The plugin-output Nav component includes the multi-language switcher only when ≥1 non-English language is active.
> 6. Stages 7e/7f/7g run on the worker output, same as before — operating across `/` always; across `/<lang>/` page sets only if those languages exist.
>
> **Validated 2026-04-29** on libertylandscapefl.com: 4 Sonnet sub-agents in parallel produced C pages from plugin-output components. 0 first-run QA fails. Headlines + facts byte-identical to Opus C baseline. Line-count Δ +2 to +99 (some Sonnet verbosity on the contact page). Plugin's design coherence preserved BECAUSE workers consume plugin-output components — they don't re-design. The plugin is invoked once for the design system; per-page work decomposes safely. Token cost on per-page work drops same ~70-80% as A/B. **Decomposed-C is now default in `--decomposed` mode** (which itself is the default).
>
> **Escape hatch**: if the plugin output for a particular customer doesn't decompose cleanly (e.g., the plugin returned a monolithic single-page implementation rather than a per-page-composable design system), Opus can build C pages directly without dispatching workers — same as `--monolithic` mode just for the C track. This is the rare exception.

**INVOKE THE PLUGIN EXPLICITLY AT THE START OF THIS STAGE** (mandatory — was previously implicit / auto-trigger; explicit invocation lands the work in the Claude Design weekly quota and ensures the plugin actually engages):

```
Skill: frontend-design
Args (free-form prompt):
  Design and build the Option C frontend for {business-name} ({business-type}) in {industry}.

  CONTEXT:
  - This is the "industrial design language" track — Option C is the explicit
    plugin-driven design output, intentionally distinct from Option A
    (worker-designed). The customer comparison A vs C measures "worker design vs
    plugin design" with content held constant via Option B as the text bridge.
  - Industry: {industry from design-brief.json}.
  - Industry direction: {industry-tokens.direction — e.g. "industrial / trades",
    "food-led", "clinical-warm"}.

  CONSTRAINTS (read these in priority order):
  1. INDUSTRY ANCHORING (highest priority — overrides plugin defaults). Use
     industry-tokens.json palette + typography + ornament. AVOID the
     `ornament.avoid` list specifically. The plugin's default bias is editorial
     magazine; industry direction beats that. For trades: industrial sans display
     + mono captions + bracket-numbered sections, NOT serif pull-quotes. For
     food: warm earth + serif display, NOT industrial mono. For medical/dental:
     cool clinical-warm + friendly sans, NOT brutalist. The industry-tokens.json
     IS the spec.
  2. SCRAPED IMAGERY (use aggressively). Hero, service tiles, content sections
     all use customer photos from public/images/. NO typographic-only design
     when the customer has photos available. NO stock images.
  3. TEXT FROM B (verbatim, locked). Read jobs/{domain}/option-b/src/pages/*.astro
     for every page's text. Use those EXACT words in C — headings, body copy,
     CTAs, FAQ Q+A, testimonial quotes, all of it. Do NOT rewrite copy. C is
     design-only; B is the canonical text source.
  4. STRUCTURAL REQUIREMENTS (REQUIRED-PATTERNS.md). Hero three-layer pattern,
     mobile-first design, 44×44px tap targets, 16px body min, generic text
     contrast WCAG AA, full preserved logo, real social link hrefs from manifest,
     favicon, no testimonial tampering. The qa-check gate enforces these
     programmatically; design within them, don't fight them.
  5. PRESERVE B's STRUCTURAL PARITY. Same nav structure, same section order
     within each page, same components (hero / service grid / testimonials /
     FAQ / contact / footer). The plugin can RESTYLE each pattern — that's
     the whole point — but the customer's eye should still be able to compare
     B vs C side-by-side and see "same site, different design." Inventing new
     sections breaks the comparison.

  WHAT TO BUILD:
  - Astro 5 + Tailwind v4 (template scaffold already copied to option-c/ in 7c)
  - One .astro page per page in manifest, using B's text verbatim
  - Custom components designed per industry-tokens.json
  - Hero variant per page (homepage hero ≠ services hero ≠ contact hero)
  - All accessibility primitives (semantic HTML, skip-to-content, etc.)
  - Reads industry-tokens.json from jobs/{domain}/option-c/industry-tokens.json
    (already created in 7b-bis) — wire its palette/typography/ornament into
    src/styles/global.css and BaseLayout.astro

  WHAT TO RETURN:
  Concrete .astro component code, global.css CSS variables + utility classes,
  BaseLayout.astro updates, and one page per manifest entry. Be bold. Be
  industry-anchored. Avoid the editorial-default that's the plugin's natural
  bias for trades customers.
```

The worker session writes the plugin's output to `jobs/{domain}/option-c/src/`. Then Stage 7e (build check), 7f (content parity), 7g (QA — also invokes the plugin for second-pass critique), 7h (visual QA), 7i (stop dev server) follow.

**Why we EXPLICITLY invoke at build time** (not just rely on auto-trigger): the plugin auto-engages when "the user asks to build frontend interfaces," which our pipeline does naturally — but auto-trigger doesn't always register cleanly in usage telemetry, and the plugin's depth of engagement varies based on prompt clarity. Explicit invocation with the constraint prompt above guarantees:
1. The plugin engages, hard, on every C build (not just "maybe, if it auto-fires")
2. Industry anchoring is a constraint, not a vibe — the plugin doesn't default to its editorial bias
3. The Claude Design weekly quota tracks correctly, so usage is visible in telemetry

**VERIFY CLAUDE DESIGN QUOTA TICKS UP** (added 2026-04-29 after a real telemetry-leak bug — see FEEDBACK.md "Frontend Design plugin telemetry leak"):

After Stage 7d's plugin invocation, the user's `Weekly · Claude Design` quota meter should tick up. If it stays at 0% while `Weekly · all models` ticks up, that's the **upstream marketplace bug** where the plugin was installed without a version identifier (path resolved to `frontend-design/unknown/` instead of `frontend-design/x.y.z/`). The plugin engages locally but Anthropic's telemetry can't attribute the call to the Claude Design product.

Quick check (the user's job, since the orchestrator can't see the user's usage panel):
- Before Stage 7 starts: note current `Weekly · Claude Design` percentage.
- After Stage 7d completes: refresh usage panel.
- If 0% → 0%: the workaround in `~/.claude/plugins/installed_plugins.json` may have reverted, OR a fresh `claude plugin install` overwrote the local fix. Re-apply the workaround per FEEDBACK.md, OR file with Anthropic.

If the orchestrator notices the path on plugin load includes `unknown/` instead of a version (visible in the `Base directory:` line at the top of every `Skill: frontend-design` invocation), STOP and flag for the skill-owner. Don't continue with Stage 7 — it'll just leak telemetry quota.

The hard rules below are the same constraints expressed in detail. The Skill invocation above is the trigger; the rules below are the contract.

**Rule 1: Use the customer's scraped imagery. Aggressively. AND map images to pages correctly.**

The scraped photos in `public/images/` ARE the customer's brand. A typographic-only design in the plugin's default style is NOT "flexibility" — it's discarding the customer's visual asset base. Violations of any of these are a bug:

- Homepage hero MUST use a `backgroundImage` from the manifest's homepage entry (with overlay for legibility)
- Every service / inner page MUST have a relevant photo from `backgroundImages` or `images`
- Content sections (Why Us, About, Services catalog) MUST have supporting photography — team, trucks, work-in-progress, finished jobs
- Portfolio / work-gallery sections MUST be preserved with real photography
- The About page MUST have a team or owner photo if one exists in the manifest

**IMAGE-TO-PAGE MAPPING (preserve semantic binding):** This was the second bug from bigdaddysdumpers.com — Option C used a residential-rental photo on the landscaping-debris-removal page because it looked aesthetically nice. Options A and B got it right; C didn't. Don't repeat this.

- Each page's images in `manifest.json` (`page.images` and `page.backgroundImages`) are NOT a generic image pool. They are images the original site curated for THAT specific page.
- For each page you build, **prefer images from THAT page's manifest entry** (use the `localPath` field as the canonical reference).
- Only fall back to images from other pages if the source page has no usable images, AND the borrowed image is from a semantically adjacent page (same service category — e.g., "drain cleaning" can borrow from "hydro jetting", but NOT from "tankless water heaters").
- NEVER use "any image that fits the aesthetic." Category drift (residential photo on a commercial page, plumbing image on an electrical page) is visible to the customer immediately and signals "they didn't actually pay attention to my business."

**IMAGE DIVERSITY + SEMANTIC MATCHING (within a single page):** This was the third image bug, shipped on naples-pressure-washing-a (2026-04-25). The Option A homepage rendered three service cards — Driveway Power Wash, Home Power Washing, Sidewalk Pressure Washing — and used the **same pool photo** for all three cards. The customer's original site had multiple distinct service photos available, but the build re-used one image because it "looked nice" or because the worker session didn't bother to find unique ones for each card.

Hard rules:

1. **Within any single page, every content image must be unique unless absolutely necessary.** A grid of N service cards needs N distinct images. A 3-column "Why Us" feature row needs 3 distinct images. Re-using the same photo in adjacent slots reads as a content-poor template; the customer will notice immediately.
2. **Match each image to its section's topic.** You don't have a vision model — but you have proxies. Use them in this order:
   - **`alt` text** in the manifest entry (often describes the image: "Driveway after pressure washing", "Crew member sanding car bumper", "Tankless water heater installed in garage")
   - **Filename hints** in `localPath` (e.g., `bg_driveway.jpg`, `pool_after.jpg`, `team_truck.jpg`)
   - **`src` URL hints** (Hibu/CMS often have descriptive URLs: `dms3rep/multi/opt/sidewalk-pressure-washing-1920w.jpg`)
   - **Original page context** from the manifest — if image X appeared on the Sidewalk Cleaning page in the original, prefer it for sidewalk-related cards in the rebuild
3. **Fallback chain when no perfect-match image exists for a card**:
   - **(a) Best**: a related-but-not-perfect image (e.g., for "Sidewalk Cleaning", a generic clean-concrete photo from another page beats reusing the driveway photo)
   - **(b) Acceptable**: a generic / atmospheric image (the customer's truck, crew, building exterior, hero photo cropped differently) — better than a category-mismatch
   - **(c) Last resort**: omit the image entirely, design the card text-only with strong typography, before duplicating an image
   - **(d) Forbidden**: don't ever use a stock image from outside the manifest, and don't fabricate images
4. **Same-image reuse is allowed ONLY when**: the manifest genuinely has fewer unique images than card slots AND the card is not the customer's primary differentiator (e.g., a single hero photo can repeat across an "About" tile and a "Contact" tile if no other photos exist; service cards on the homepage are NOT in this category — they are the differentiator).
5. **The QA gate (`qa-check.js`) blocks the build** if a content image (>= 80×80px, not in nav/footer) appears more than once on the same page. Forces the worker to find diverse images OR consciously omit images and use text-only cards.

**Rule 2: Anchor the design to the industry, not to a generic "editorial" style.**

Apply the aesthetic direction committed in Stage 7b. The plugin will push for bold typography, distinctive color, and intentional composition — keep that — but frame every decision around whether a real customer in that industry would recognize this as "a good plumbing/auto/etc website" vs. "a magazine pretending to sell plumbing." If the plugin nudges you toward a choice that feels editorial-over-industrial, override it.

**Rule 3: Distinctive type + color still matters, but honest to the industry.**

Don't default to Inter + safe navy. DO pick distinctive choices — but the distinctive choices must feel honest to the business. A mono type for a plumbing brand reads as engineering; for a restaurant it reads as awkward. Match the type and color language to the industry.

**Rule 4: Content parity AND text source — pull text from B, never rewrite.**

Architecture 2 rule: Option C uses B's text VERBATIM. Don't run another copy pass. For each Option C page, read the corresponding `.astro` file in `jobs/{domain}/option-b/src/pages/` and extract the text. Use those exact words in C's pages.

- Every page from the manifest exists as `.astro` in `src/pages/` (one C page per B page)
- Every service, testimonial, FAQ, stat, certification, partner logo, trust signal from B appears in C
- Phone, email, address match the manifest (which match B's output)
- Full navigation with organized page links — NOT flat anchor links
- Mobile menu, phone CTA in nav, mobile sticky CTA bar
- Shared footer matching Option A/B structure
- **Headings, body copy, CTAs, FAQ Q+A pairs, testimonial quotes are ALL drawn verbatim from B**. C's job is design, not copywriting. If you find yourself rewriting a sentence that's already in B, stop — use B's version.

**Rule 5: Shared component patterns.**

Use the same section patterns as Option B where they work (hero, service grid, testimonials, FAQ, contact form, CTA banner, footer). The plugin can reinterpret the *styling* of each pattern, but the *structure* should be recognizable across A, B, and C for a valid comparison.

#### 7e. Build check

```bash
cd jobs/{domain}/option-c/
npm run build
```

Fix any build errors before continuing.

#### 7f. Content parity audit (English always; per-language only when active)

Content parity audit for Option C (same structure as Option B's audit; multilingual checks fire only when ≥1 non-English language is active):

1. Read each manifest entry for a page, confirm every product / service / testimonial / stat / certification appears in the corresponding `.astro` file (English version)
2. **For each active language in B's `src/pages/`** (none on English-only builds, otherwise one or more): for every English page, confirm a `/<lang>/` counterpart exists with the same content sections rendered in that language
3. **Verify translated copy = B's translated copy** for every active language: spot-check 2–3 pages per language — the body text in `option-c/src/pages/<lang>/<page>.astro` should be byte-identical to `option-b/src/pages/<lang>/<page>.astro` (with only design wrapper differences). Single source of truth from MULTILINGUAL SUPPORT rule, applies across every active language.
4. **Verify testimonial translation tags**: every translated testimonial in `/<lang>/` pages has the appropriate per-language tag near the attribution (e.g., `(traducido del inglés)` for ES, `(aus dem Englischen übersetzt)` for DE — see language table). Attribution names stay original.
5. Run the content-density check (word count, image count per page) for English; extend across each active language's pages
6. Flag and fix any gaps before proceeding to QA

```bash
echo "── English pages ──"
for page in $(find jobs/{domain}/option-c/dist -maxdepth 2 -name "*.html" -not -path '*/[a-z][a-z]/*'); do
  FILENAME=$(echo "$page" | sed "s|jobs/{domain}/option-c/dist/||")
  WORD_COUNT=$(cat "$page" | sed 's/<[^>]*>//g' | wc -w | tr -d ' ')
  IMG_COUNT=$(grep -co 'src="/images/' "$page" | tr -d ' ')
  echo "$FILENAME: $WORD_COUNT words, $IMG_COUNT images"
done

# Per-language audit — runs once per active language (no-op if none)
for LANG_DIR in jobs/{domain}/option-c/dist/*/; do
  LANG=$(basename "$LANG_DIR")
  if [ ${#LANG} -ne 2 ]; then continue; fi   # skip non-language dirs
  echo "── $LANG pages ──"
  for page in $(find "$LANG_DIR" -maxdepth 2 -name "*.html" 2>/dev/null); do
    FILENAME=$(echo "$page" | sed "s|jobs/{domain}/option-c/dist/||")
    WORD_COUNT=$(cat "$page" | sed 's/<[^>]*>//g' | wc -w | tr -d ' ')
    IMG_COUNT=$(grep -co 'src="/images/' "$page" | tr -d ' ')
    echo "$FILENAME: $WORD_COUNT words, $IMG_COUNT images"
  done
done
```

**Hard fail (English always)**: any homepage or inner page with 0 images. The plugin's bias toward typographic design is an image-dropping bug; flag and fix.

**Hard fail (only when language is active)**: any English page with no `/<lang>/` counterpart for any active `<lang>`. Any `/<lang>/` page that doesn't render `<html lang="<lang>">`. (No fail if the build is English-only — there's nothing to compare against.)

#### 7g. Pre-Deploy Completeness Check (BLOCKING)

Pre-deploy completeness check for Option C against `jobs/$DOMAIN/option-c/dist/`. Verify:
- EN page count ≥ manifest page count
- **(Only when ≥1 non-English language is active)** Every active language's page count = EN page count (MULTILINGUAL SUPPORT — Stage 5h parity check generalized)
- Homepage nav links to every manifest page (in every active language's nav)
- **(Only when ≥1 non-English language is active)** Language switcher present on every page (MULTILINGUAL SUPPORT — switcher must list ALL active languages including English; on English-only builds, no switcher is rendered, no failure)
- **(Only when ≥1 non-English language is active)** Every `/<lang>/` page has `<html lang="<lang-code>">` (MULTILINGUAL SUPPORT). English pages always have `<html lang="en">`.
- Phone number on every page (English always; every active language's pages too)
- Logo reference on every page (English always; every active language's pages too)
- Mobile menu on every page (English always; every active language's pages too) — including the language switcher in mobile drawer when ≥1 language is active
- No broken Material Symbols
- **Option-C-specific**: every page has at least one image reference (Rule 1 enforcement) — English always; every active language's pages too

#### 7h. Visual QA — Headless screenshots + design critique

Option C gets its own port allocated by `init-metrics.cjs` (`metrics.ports.optionC = portA + 2`). Read it via `get-port.cjs`:

```bash
PORT_C=$(node scripts/get-port.cjs "$DOMAIN" c)
cd jobs/{domain}/option-c
npx astro dev --port $PORT_C &
echo $!
sleep 4
```

```bash
PORT_C=$(node scripts/get-port.cjs "$DOMAIN" c)
cd /Users/tomasz/WebFactory
node scripts/qa-check.js http://localhost:$PORT_C --manifest jobs/$DOMAIN/manifest.json --reference-dist jobs/$DOMAIN/option-a/dist / /about /contact
```

```bash
PORT_C=$(node scripts/get-port.cjs "$DOMAIN" c)
mkdir -p jobs/{domain}/qa-option-c
node scripts/qa.cjs http://localhost:$PORT_C jobs/{domain}/qa-option-c
```

**The Visual Sanity Pass from Stage 4c-bis applies here too — run the full 15-item checklist against `jobs/{domain}/qa-option-c/` screenshots.** C uses a plugin-driven design that's the most likely option to produce novel layouts and novel bugs (the active-nav black-on-black bug shipped on a C-style design). The 15-item checklist is your primary defense against "the plugin made something weird."

Read screenshots, check for broken images / missing hero backgrounds / generic editorial drift (violations of Rule 1 and Rule 2). Invoke the **`frontend-design` skill** for a second-pass design critique (the plugin already authored the build in Stage 7d; this invocation has it review its own output and propose refinements):

```
Skill: frontend-design
Args (free-form prompt):
  Critique and improve the Option C build for {business-name} ({business-type}) in {industry}.

  CONTEXT:
  - This is the "industrial design language" track — text from Option B verbatim,
    design re-rendered in industry-anchored aesthetic per industry-tokens.json.
  - Industry: {industry}.
  - Industry direction: {industry-tokens.direction — e.g. "industrial / trades"}.
  - Plugin's default bias toward editorial design is WRONG here; we explicitly
    want NOT-editorial for trades / food / clinical customers.

  CONSTRAINTS:
  - Use scraped customer photos aggressively (hero, service tiles, content
    sections). Typographic-only design = bug per Stage 7d Rule 1.
  - Match industry-tokens.json palette + typography + ornament. Avoid the
    `ornament.avoid` list specifically.
  - Text content from Option B is locked verbatim — do NOT rewrite copy.

  WHAT TO REVIEW:
  - jobs/{domain}/qa-option-c/desktop-home.png
  - jobs/{domain}/qa-option-c/mobile-home.png
  - jobs/{domain}/qa-option-c/desktop-{first-service-page}.png

  WHAT TO RETURN:
  Specific, actionable improvements to industry-anchor the design more firmly.
  Particularly flag any drift toward Medium-article aesthetic, generic
  consultancy aesthetic, or typographic-only sections without the customer's
  photos. Cite concrete code-level changes.
```

Fix any industry-drift or image-drop issues and re-run QA. Repeat until clean.

#### 7i. Stop dev server

```bash
pkill -f "astro dev"
```

---

---

> **→ NEXT: Stage 8 — Deploy to Vercel.** Stage 7 (Build C) just completed (or was skipped per `--skip-c`). Continue IMMEDIATELY to Stage 8. Do NOT ask the user "ready to deploy?" Do NOT pause to confirm Vercel project IDs. The deploy is the natural next step. Just run it. (See PIPELINE COMPLETION CONTRACT at top.)

### Stage 8: Deploy to Vercel

#### 🟦 Vercel Teams Configuration (READ THIS BEFORE FIRST DEPLOY OF A PIPELINE RUN)

**All WebFactory deploys go to ONE specific Vercel team.** Deploying to the wrong scope (the user's personal account, a different team) is a real failure mode — projects show up under the wrong dashboard, billing splits, the user can't find them, and re-deploys may go to a different scope than original deploys leaving orphans.

**Canonical identifiers** (hardcode these — do not infer from `vercel whoami` output):

| Identifier                          | Value                                  | When to use                                                                                                                |
|-------------------------------------|----------------------------------------|----------------------------------------------------------------------------------------------------------------------------|
| **Team slug** (CLI)                 | `tomek-group`                          | `vercel --scope tomek-group ...`, AND verifying deploy URLs end in `-tomek-group.vercel.app`                                |
| **Team ID** (MCP tools)             | `team_4Hr5Lqd6pY5D7gmeXDVsDmYx`        | `teamId` parameter on EVERY Vercel MCP call (`list_projects`, `list_deployments`, `get_deployment`, `get_deployment_build_logs`, etc.) — without it, calls return empty or fail |
| **Team display name** (humans only) | `Tomek Group`                          | When referring to the team in user-facing output                                                                            |
| **Personal username (NOT a target)** | `tomekgroup` (no hyphen)              | This is what `vercel whoami` returns. **NEVER deploy here.**                                                                |

**The trap**: `tomekgroup` (personal, no hyphen) and `tomek-group` (team, with hyphen) look almost identical. `vercel whoami` shows `tomekgroup`, which a model unfamiliar with the setup might assume is the deploy target. **It is not.** Always use the team slug `tomek-group` for the CLI.

**How deploys actually land in the team**:

1. **Existing job directories** (`jobs/{domain}/option-*/`) already have `.vercel/project.json` linked to the team. Re-deploying from those directories automatically targets `tomek-group`. No `--scope` flag needed. This is the common case.

2. **Brand-new project directories** (first-ever deploy from a never-deployed location, e.g., a freshly created `option-c/` for a new domain). Two ways to ensure team scope:

   ```bash
   # Method A: pre-link before first deploy (preferred for unattended runs)
   cd jobs/{domain}/option-a/
   npx vercel link --scope tomek-group --project {domain-slug}-option-a --yes
   # then the standard deploy flow
   npx vercel build --yes
   npx vercel deploy --prebuilt --yes
   ```

   **CRITICAL — `--project` flag is mandatory** (real bug 2026-04-28, bwlocksmith.com): without `--project`, `vercel link` auto-names from the current directory (= `option-a`), which COLLIDES across customer builds. The first build creates a project literally called `option-a` under the team; the next domain's build attaches to the SAME project, mixing deployments. Always pass `--project {domain-slug}-option-{a|b|c}` where `{domain-slug}` is the customer's domain with dots replaced by hyphens (e.g., `bwlocksmith-com-option-a`, `libertylandscapefl-com-option-a`).

   ```bash
   # Method B: pass --scope on the first deploy (also works for scope, but does NOT solve the auto-naming collision)
   cd jobs/{domain}/option-a/
   npx vercel build --yes
   npx vercel --scope tomek-group deploy --prebuilt --yes
   # Method B still creates a bare-named project on first deploy; prefer Method A.
   ```

3. **Verification after first deploy of a pipeline change** (one-time per pipeline change):
   - Deployment URL MUST end in `-tomek-group.vercel.app`
   - If it ends in `-tomekgroup.vercel.app` (no hyphen) or has no team suffix → wrong scope. Delete the project from the personal account and re-deploy with `--scope tomek-group`.

**Vercel MCP tool calls — `teamId` is REQUIRED**:

```jsonc
// Correct — every Vercel MCP call must include teamId
list_projects({ teamId: "team_4Hr5Lqd6pY5D7gmeXDVsDmYx" })
list_deployments({ teamId: "team_4Hr5Lqd6pY5D7gmeXDVsDmYx", projectId: "prj_..." })
get_deployment({ teamId: "team_4Hr5Lqd6pY5D7gmeXDVsDmYx", idOrUrl: "dpl_..." })
get_deployment_build_logs({ teamId: "team_4Hr5Lqd6pY5D7gmeXDVsDmYx", idOrUrl: "dpl_..." })
get_runtime_logs({ teamId: "team_4Hr5Lqd6pY5D7gmeXDVsDmYx", idOrUrl: "dpl_..." })

// WRONG — no teamId, returns empty / errors / queries personal scope
list_projects({})
```

If you need to discover the team ID dynamically (you shouldn't — it's hardcoded above): `list_teams()` returns the available teams with their IDs.

**Disable Vercel Authentication after deploy** (the SSO protection that prompts for login on previews — needs to be off so the customer can view without logging in):

New Vercel projects in `tomek-group` ship with `ssoProtection: { deploymentType: "all_except_custom_domains" }` enabled by default. Customers visiting the preview URL get a 401 login wall until you disable it. Run this for EACH option after `vercel deploy` succeeds.

**Use the CLI command — NOT the REST API alone.** Real bug 2026-04-29 (giffins.net): the API call `PATCH /v9/projects/{name} {"ssoProtection": null}` returned 200 OK and a follow-up GET confirmed `ssoProtection: null` — but the live deployment URL still returned 401 indefinitely. The Vercel CLI's `vercel project protection disable` subcommand is what actually triggers the propagation. The API is useful as a diagnostic (verify the field really is null) but doesn't reliably flip the protection state on its own.

```bash
# CANONICAL: CLI subcommand (project-name first, then --sso flag — exact syntax matters)
cd jobs/{domain}/option-a/
npx vercel project protection disable {domain-slug}-option-a --sso
# Repeat for option-b, option-c (with --skip-c, only the first 2)
```

The CLI prints a JSON confirmation:
```json
{
  "action": "disable",
  "projectId": "prj_...",
  "projectName": "{domain-slug}-option-a",
  "ssoProtection": false
}
```

**API call as diagnostic only** (use to verify state, do NOT rely on it for the disable itself):

```bash
TOKEN=$(jq -r '.token' "$HOME/Library/Application Support/com.vercel.cli/auth.json")
TEAM=team_4Hr5Lqd6pY5D7gmeXDVsDmYx
PROJECT={domain-slug}-option-a

# Read state (diagnostic):
curl -s "https://api.vercel.com/v9/projects/$PROJECT?teamId=$TEAM" \
  -H "Authorization: Bearer $TOKEN" | jq '.ssoProtection'

# Write state (NOT reliable on its own — use CLI above; this is a fallback only):
curl -s -X PATCH "https://api.vercel.com/v9/projects/$PROJECT?teamId=$TEAM" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ssoProtection": null}'
```

**Verification**: after `vercel project protection disable`, poll the deploy URL until it returns 200:

```bash
DEPLOY_URL=https://{domain-slug}-option-a-{hash}-tomek-group.vercel.app
until [ "$(curl -s -o /dev/null -w '%{http_code}' "$DEPLOY_URL/?t=$(date +%s)")" = "200" ]; do sleep 2; done
echo "✓ public"
```

Propagation is usually 1-3 seconds after the CLI command succeeds.

This relies on the project being correctly scoped to `tomek-group` already (Step 1 or 2 above). If the project landed in the personal account, this command targets the wrong project and fails silently.

#### Stage 8a: Automated QA Gate (MANDATORY — BLOCKS deploy)

Before deploying, run the automated QA gate against local dev servers. This is a fast, exit-code-based check that fails the pipeline if ANY of these are detected: logo is low-res (<100px natural width OR naturalWidth < 1.5× displayed width = will appear blurry on retina), broken images, literal `\uXXXX` escapes rendered as visible text, missing nav/footer/h1, console errors, or failed network requests. It catches the class of bugs that slip past manifest-level grep checks and casual visual skim.

This gate was added after a real bug in fsolsidingcontractor.com (2026-04-16) where a 24×8px WordPress favicon crop was used as the nav logo and shipped to production. Screenshot-based QA missed it because the logo "looked like a logo" at a glance.

**Option A gate:**

```bash
cd jobs/{domain}/option-a
npm run build
```

```bash
PORT_A=$(node /Users/tomasz/WebFactory/scripts/get-port.cjs "$DOMAIN" a)
cd jobs/{domain}/option-a
(npx astro dev --port $PORT_A > /tmp/astro-a.log 2>&1 &)
sleep 4
```

```bash
PORT_A=$(node scripts/get-port.cjs "$DOMAIN" a)
cd /Users/tomasz/WebFactory
node scripts/qa-check.js http://localhost:$PORT_A --manifest jobs/$DOMAIN/manifest.json --option a / /about /contact
```

If `qa-check.js` exits non-zero, **STOP**. Read the output, fix the root cause, and re-run:
- Logo fail → re-run `node scripts/fix-logo.js {domain}`, copy fixed file to `option-a/public/images/logo.png`, `option-b/public/images/logo.png`, AND `option-c/public/images/logo.png`, rebuild, re-gate.
- Unicode escape fail (`\uXXXX`) → replace literal `\uXXXX` in source files with actual characters: `perl -CSD -i -pe 's/\\u2013/\x{2013}/g' src/pages/*.astro` (and similar for other escapes).
- **HTML entity literal fail (`&#NNN;` rendered as visible text)** → the source has a numeric character reference inside an Astro `{...}` JSX expression, where the `&` gets HTML-escaped to `&amp;` and the entity ships unrendered. Three valid fixes (any one of them works):
  1. **Use the literal Unicode character** in the source. For emoji, just paste the actual character: `icon: '🐛'` not `icon: '&#128027;'`. This is the cleanest fix — UTF-8 handles Unicode natively, no escaping needed.
  2. **Use Astro's `set:html` directive** if you must keep entity-reference syntax: `<span set:html={service.icon}></span>` injects raw HTML.
  3. **Place the entity in HTML markup directly** (outside `{...}` expressions): `<div>&#128027;</div>` works fine because Astro's HTML parser decodes entities, but `<div>{'&#128027;'}</div>` doesn't because the JSX expression context HTML-escapes the `&` first.
  Real bug shipped 2026-04-28 (Bugs-B-Gone Pest Control): six service-card icons rendered as raw `&#128027;` text instead of bug emoji because the worker put icon strings in a JS data array and rendered via `{service.icon}`.
- Broken image fail → verify file exists at referenced path under `public/images/`.

After Option A gate passes, run Option B gate (build + serve dist + qa-check):

```bash
pkill -f "astro dev"
cd jobs/{domain}/option-b
npm run build
```

```bash
PORT_A_PLUS=$(node /Users/tomasz/WebFactory/scripts/get-port.cjs "$DOMAIN" a-plus)
cd jobs/{domain}/option-b
(npx serve dist -l $PORT_A_PLUS > /tmp/serve-a-plus.log 2>&1 &)
sleep 3
```

```bash
PORT_A_PLUS=$(node scripts/get-port.cjs "$DOMAIN" a-plus)
cd /Users/tomasz/WebFactory

# Build the page list for qa-check.
# English pages always: / /about /contact (and any other English pages)
# Per active language in option-b/src/pages/<lang>/: prepend /<lang>/
ACTIVE_LANGS=""
for LANG_DIR in jobs/$DOMAIN/option-b/src/pages/*/; do
  LANG=$(basename "$LANG_DIR")
  if [ ${#LANG} -eq 2 ]; then
    ACTIVE_LANGS="$ACTIVE_LANGS $LANG"
  fi
done

EN_PAGES="/ /about /contact"
LANG_PAGES=""
for LANG in $ACTIVE_LANGS; do
  for P in $EN_PAGES; do
    LANG_PAGES="$LANG_PAGES /$LANG${P}"
  done
done

# Pass --reference-dist-i18n only if at least one language is active
if [ -n "$ACTIVE_LANGS" ]; then
  REF_I18N_FLAG="--reference-dist-i18n jobs/$DOMAIN/option-b/dist"
else
  REF_I18N_FLAG=""
fi

node scripts/qa-check.js http://localhost:$PORT_A_PLUS --manifest jobs/$DOMAIN/manifest.json --reference-dist jobs/$DOMAIN/option-a/dist $REF_I18N_FLAG --option b $EN_PAGES $LANG_PAGES
pkill -f "serve dist"
```

After B gate passes, run Option C gate (skip entirely if `$SKIP_C=1` OR if Option C wasn't built because the plugin isn't installed):

```bash
if [ "$SKIP_C" = "1" ]; then
  echo "⏭️  Option C QA gate skipped (SKIP-C mode)"
else
  echo "Running Option C QA gate..."
  # ... continue with the C gate substeps below
fi
```

```bash
cd jobs/{domain}/option-c
npm run build
```

```bash
PORT_C=$(node /Users/tomasz/WebFactory/scripts/get-port.cjs "$DOMAIN" c)
cd jobs/{domain}/option-c
(npx serve dist -l $PORT_C > /tmp/serve-c.log 2>&1 &)
sleep 3
```

```bash
PORT_C=$(node scripts/get-port.cjs "$DOMAIN" c)
cd /Users/tomasz/WebFactory

# Same conditional language detection as the B gate above. Active languages on
# C should mirror B (single source of truth — B owns translations, C reads from B).
ACTIVE_LANGS=""
for LANG_DIR in jobs/$DOMAIN/option-c/src/pages/*/; do
  LANG=$(basename "$LANG_DIR")
  if [ ${#LANG} -eq 2 ]; then
    ACTIVE_LANGS="$ACTIVE_LANGS $LANG"
  fi
done

EN_PAGES="/ /about /contact"
LANG_PAGES=""
for LANG in $ACTIVE_LANGS; do
  for P in $EN_PAGES; do
    LANG_PAGES="$LANG_PAGES /$LANG${P}"
  done
done

if [ -n "$ACTIVE_LANGS" ]; then
  REF_I18N_FLAG="--reference-dist-i18n jobs/$DOMAIN/option-b/dist"
else
  REF_I18N_FLAG=""
fi

node scripts/qa-check.js http://localhost:$PORT_C --manifest jobs/$DOMAIN/manifest.json --reference-dist jobs/$DOMAIN/option-a/dist $REF_I18N_FLAG --option c $EN_PAGES $LANG_PAGES
pkill -f "serve dist"
```

Only proceed to Stage 8b (actual deploy) once ALL gates pass:
- Default mode: A + B + C must all pass
- `--skip-c` mode: only A + B must pass (the C gate is skipped, not failed)
- Plugin-not-installed mode: A + B must pass; C gate is skipped with a warning

---

> **→ NEXT: Stage 8b — Deploy.** Stage 8a (QA Gate) just passed for all options. Continue IMMEDIATELY to Stage 8b. Do NOT ask the user "ready to push to Vercel?" Just push. (See PIPELINE COMPLETION CONTRACT at top.)

#### Stage 8b: Deploy

Deploy each option using the **canonical Vercel prebuilt flow**: run `vercel build` LOCALLY (which produces the `.vercel/output/` artifact that `--prebuilt` requires), then `vercel deploy --prebuilt` to upload that artifact as-is. This is the only way `--prebuilt` actually skips remote build infrastructure.

**Why this matters (real bug we shipped, fixed 2026-04-25):** the previous pattern was `npx vercel deploy ./dist --prebuilt --yes`. That looks correct but is silently broken — `./dist` doesn't contain a `.vercel/output/` directory (Astro's output is just static HTML/CSS/JS), so Vercel ignores the `--prebuilt` flag, spins up a remote Turbo Build Machine (30 cores / 60 GB), and runs `vercel build` remotely. The remote build completes in ~40ms because there's nothing to compile, but the build machine spin-up still consumes Vercel build minutes on every deploy. Confirmed via build logs from `dpl_BoRJDyfLhVZRdKQsHo9kmFgYx3Sv` (Claude/WebFactory) — both showed `"Running build in iad1 (Turbo Build Machine)"` despite `--prebuilt`.

The correct flow runs `vercel build` LOCALLY (which builds Astro AND wraps `dist/` into `.vercel/output/static/`), then `vercel deploy --prebuilt` (no path argument) uploads `.vercel/output/` directly. No remote build machine. Truly zero Vercel build minutes consumed.

**CRITICAL**: You must `cd` to the option's root directory (the one with `astro.config.mjs`, NOT the `dist/` directory) before each deploy command. Deploying from the wrong directory will deploy the wrong project. Pass NO path argument to `vercel deploy` — the prebuilt artifact lives at `.vercel/output/` relative to the current directory.

**PRE-DEPLOY LINK CHECK (mandatory for every option, every build)**: before running `vercel build` / `vercel deploy`, verify the option's `.vercel/project.json` exists. If missing, pre-link to a project under team `tomek-group` BEFORE attempting to build. This prevents the "Set up and deploy?" interactive prompt that breaks unattended mode. The Smart Resume `--full`/`--clean` handler preserves existing links across wipes (see Smart Resume section), so this check usually no-ops on existing domains. For brand-new domains, the worker session must use `Method A: pre-link before first deploy` from the Vercel Teams Configuration block.

```bash
# Run this BEFORE the build commands below for each option (a/b/c).
# Substitute the project name per option.
cd jobs/{domain}/option-a/
if [ ! -f .vercel/project.json ]; then
  echo "  ↪ no .vercel/project.json found — pre-linking to team tomek-group"
  # If the project already exists on Vercel under tomek-group with a known name,
  # link to it. Otherwise vercel link will create a new project named after the dir.
  npx vercel link --scope tomek-group --yes
fi
```

**Option A** — build locally, then deploy prebuilt:

```bash
cd jobs/{domain}/option-a/
npx vercel build --yes
```

```bash
cd jobs/{domain}/option-a/
npx vercel deploy --prebuilt --yes
```

**Option B** — same pattern (B inherits A's design and outputs to its own Astro build):

```bash
cd jobs/{domain}/option-b/
npx vercel build --yes
```

```bash
cd jobs/{domain}/option-b/
npx vercel deploy --prebuilt --yes
```

**Option C** — same pattern (skip ENTIRELY if `$SKIP_C=1` OR if Option C wasn't built because the plugin isn't installed):

```bash
if [ "$SKIP_C" = "1" ]; then
  echo "⏭️  Option C deploy skipped (SKIP-C mode)"
else
  # Run the two commands below
  echo "Deploying Option C..."
fi
```

```bash
cd jobs/{domain}/option-c/
npx vercel build --yes
```

```bash
cd jobs/{domain}/option-c/
npx vercel deploy --prebuilt --yes
```

**Verify after first deploy** (one-time sanity check per pipeline change): the build logs in the Vercel dashboard for any of these deployments should NOT contain the lines `"Running build in ... (Turbo Build Machine)"` or `"Running 'vercel build'"`. Instead they should jump straight to `"Deploying outputs..."`. If you see remote-build lines, `--prebuilt` is being ignored — re-check that `.vercel/output/` exists in the option's root directory after `vercel build`, and that you're NOT passing `./dist` (or any path) to `vercel deploy`.

After deploying, disable Vercel Authentication (SSO protection) on all projects so the URLs are publicly accessible:

```bash
cd jobs/{domain}/option-a/
npx vercel project protection disable --sso option-a
```

```bash
cd jobs/{domain}/option-b/
npx vercel project protection disable --sso option-b
```

```bash
if [ "$SKIP_C" = "1" ]; then
  echo "⏭️  Option C SSO-disable skipped (SKIP-C mode)"
else
  cd jobs/{domain}/option-c/
  npx vercel project protection disable --sso option-c
fi
```

Record the preview URLs:
- Default mode: 3 URLs (A + B + C)
- `--skip-c` mode: 2 URLs (A + B only)

---

---

> **→ NEXT: Stage 9 — Final Verification on Vercel.** Stage 8b (Deploy) just completed — you have 3 (or 2 with `--skip-c`) Vercel preview URLs. Continue IMMEDIATELY to Stage 9. Do NOT report the URLs to the user yet — that's Stage 10's job after verification passes. Just verify them. (See PIPELINE COMPLETION CONTRACT at top.)

### Stage 9: Final Verification on Vercel

After deploying, verify all live sites:
- Default mode: A, B, AND C
- `--skip-c` mode: A AND B only (skip C verification entirely)

1. Use `WebFetch` on each deployed URL to confirm the sites load correctly (check for 200 status, real content in the HTML)
2. Check that key content is present on each (business name, phone number, nav links, **all social links from the manifest**)
3. Verify B visually matches A — fetch both homepages, confirm the same logo references, the same nav structure, the same image references, the same components. Differences should be limited to text content. Any structural divergence is a bug.
4. **If `$SKIP_C != 1`**: verify Option C specifically includes imagery — if the homepage has no `<img>` tags or `background-image:` references, Option C's Rule 1 was violated and must be fixed before the build is accepted. **If `$SKIP_C = 1`**: skip C verification entirely.
5. Do NOT use `preview_*` / `Chrome` MCP tools (visible browser windows). Use WebFetch for HTML verification, OR a one-off Playwright script in `/tmp/` if you want to screenshot a deployed URL — Playwright is fine because it's headless.

---

---

> **→ NEXT: Stage 10 — Report.** Stage 9 (Verification) just completed — all live URLs return 200 + content. Continue IMMEDIATELY to Stage 10. **THIS IS THE FINAL STAGE.** After Stage 10 emits the 4 (or 3) clickable URLs and the metrics table, the pipeline is DONE and you may end your response. Until then, you are NOT done — even if everything else succeeded. (See PIPELINE COMPLETION CONTRACT at top.)

### Stage 10: Report

First, finalize the metrics file with output sizes and total timing:

```bash
cd /Users/tomasz/WebFactory
node scripts/finalize-metrics.cjs "$DOMAIN"
```

This measures Option A, Option B, and Option C output sizes, calculates total wall clock time, and prints the full metrics JSON.

**The final deliverable depends on mode**:
- **Default mode**: 4 links — Original, A, B, C
- **`--skip-c` mode**: 3 links — Original, A, B (with explicit "Option C: skipped" note)
- **Plugin-not-installed**: 3 links — Original, A, B (with "Option C: not built (plugin missing)" note)

**CRITICAL OUTPUT-FORMAT RULES (read before emitting the report)**:

1. **NEVER wrap the report in a fenced code block** (no ` ``` ` around it). A fenced code block renders the URLs as plain text → the user cannot click them. Real bug shipped 2026-04-25 (accelwindows.com): worker emitted the entire 4-link block inside ` ``` ` fences; user couldn't click any URL.

2. **Every URL MUST be a clickable markdown autolink** — wrap the URL in angle brackets: `<https://example.com>`. This works in Claude Code's UI, GitHub markdown, Notion, every standard markdown renderer. DO NOT emit bare URLs (`https://...` with no syntax) — those auto-link in some renderers but not others.

3. **Use markdown headings (`##`, `###`), markdown lists (`1.`, `-`), and markdown tables (`|`)** — render normally. The ONLY thing forbidden is wrapping the whole report in ` ``` ` fences.

The format below is what the user should SEE rendered (not the literal characters with fences). Emit it as raw markdown directly into chat — no code block wrapper:

---

## ✅ WebFactory Complete — {Customer Business Name} ({domain})

Here are your {3 or 4} final links:

1. **Original**: <{customer URL}>
2. **Option A** (faithful — original copy + new design): <{vercel-url-a}>
3. **Option B** (A's design + agency conversion-tuned copy): <{vercel-url-b}>
4. **Option C** (B's words in plugin's industry-anchored design language): <{vercel-url-c}>

(If `$SKIP_C = 1`, replace line 4 with: `4. **Option C**: skipped (--skip-c mode — A and B only this run)`)

(If plugin not installed, replace line 4 with: `4. **Option C**: not built (Frontend Design plugin not installed — install with `claude plugin install frontend-design@claude-plugins-official --scope project` and re-run with `--option-c`)`)

### 📊 Metrics

| Metric | Value |
|--------|-------|
| Model | {model} |
| Total time | {totalMinutes} min |
| Input pages | {input.pages} |
| Option A output | {optionA.htmlFiles} pages, {optionA.totalBytes} bytes |
| Option B output | {optionB.htmlFiles} pages, {optionB.totalBytes} bytes |
| Option C output | {optionC.htmlFiles} pages, {optionC.totalBytes} bytes (or "skipped" if --skip-c) |
| Metrics file | `jobs/{domain}/metrics.json` |

Languages: English-only by default (since 2026-04-30 per MULTILINGUAL SUPPORT rule). Translations are explicit opt-in via `--languages <list>` (initial-build flag) OR `/webfactory <domain> --add-language <name|iso> --to <b|c|both>` (post-build incremental flag). Active languages on this build: {detect from option-b/src/pages/ subdirs and report — "English only" if none}. A always stays English-only.

---

**Verification before finalizing**: scan your own output. If you see ` ``` ` anywhere wrapping the link list or the table — DELETE the fences and re-emit. Inline code spans like `` `jobs/{domain}/metrics.json` `` are fine (and intended); whole-block fences are the bug.

---

> **🏁 PIPELINE COMPLETE.** You have shipped Stage 10 (the 4-link report). The pipeline is now DONE. You may end your response here. Do NOT continue with additional unprompted work. The user will follow up if they want changes; until then, your job for this `/webfactory <url>` invocation is finished.
>
> **Self-check before you stop**: scroll back through your most recent message. Does it contain (a) 4 clickable `<https://...>` URLs (or 3 if `--skip-c`), AND (b) a markdown metrics table? If YES → done, send the response. If NO → resume from wherever Stage 10 fell short.

---

## Parallel Build Isolation

Multiple WebFactory runs can execute simultaneously (different domains). Each run is fully isolated:

| Resource | Isolation method |
|----------|-----------------|
| **Files** | Each domain gets its own `jobs/{domain}/` directory — zero overlap |
| **Ports** | Dynamic port allocation via domain hash (stored in `metrics.json`) |
| **Dev servers** | Each run starts/stops its own background processes with unique ports |
| **Vercel deploy** | Each domain deploys as a separate Vercel project |
| **Git** | `jobs/` is gitignored — parallel builds never touch the repo |
| **QA screenshots** | Output to `jobs/{domain}/qa-option-a/`, `qa-option-b/`, `qa-option-c/` — per-domain |

**What NOT to do in parallel:**
- Do NOT modify `SKILL.md` or files in `templates/` or `scripts/` during a run
- Do NOT run two builds for the SAME domain simultaneously

---

## Important Notes

- If the scraper fails on a URL, try with `https://` prefix if not provided
- For sites with 20+ similar pages (e.g., location pages), consolidate into fewer pages with better UX
- Always run `npm run build` after generating code to catch errors
- Fix ALL build errors before moving to QA
- The QA loop is essential - never skip it. The site must look gorgeous at every breakpoint
- The pipeline is fully automated and runs unattended. No manual steps.
- When inspecting screenshots, be a harsh critic. If something looks mediocre, fix it. The bar is "would a designer be proud of this?"
- **IMAGES**: The manifest has BOTH `images` (img tags) and `backgroundImages` (CSS backgrounds). Use background images as hero backgrounds, regular images as inline content. Every page that had a hero background in the original MUST have one in the rebuild
- **DEPLOY**: Always `cd` to the correct project directory before running `npx vercel deploy`. Deploying from the wrong directory will deploy the wrong project
- **SSO**: After deploying, disable Vercel SSO protection so URLs are publicly accessible
- **OPTION B RETIRED (2026-04-24)**: The Stitch-driven Option B track has been removed from the pipeline. Existing `option-b/` directories and `stitch-output/` from prior runs are orphaned — Smart Resume ignores them. Scripts `stitch-generate.js` and `stitch.sh` are kept on disk for reference but unused. Safe to delete if you want a clean tree.
- **MULTILINGUAL (English-only default since 2026-04-30; languages opt-in via flags)**: Default `/webfactory <url>` builds B and C as English-only — NO `/es/`, `/de/`, etc. routes are created. Translations are explicit opt-in via two paths: (1) `--languages es,de,fr` at initial build → those languages build alongside English in B and C from Stage 5 onward; (2) `/webfactory <domain> --add-language <name|iso> --to <b|c|both>` post-build → adds a single language incrementally to an existing build (mini-pipeline AL1-AL6). When languages are active: translation produced ONCE in Stage 5 by the same Sonnet sub-agents that do the English rewrite, written to `option-b/src/pages/<lang>/*.astro`; Option C reads B's translated files at Stage 7 — single source of truth across all active languages. Supported codes: es, de, ru, it, fr, pt, pl, zh, ja, ko, nl, sv (full list in language table — any ISO 639-1 code accepted with English-fallback tag). Nav switcher rendered only when ≥1 non-English language is active: toggle row when ≤3 active languages, dropdown when ≥4. Each translated testimonial gets a per-language tag (`(traducido del inglés)` for ES, `(aus dem Englischen übersetzt)` for DE, `(переведено с английского)` for RU, etc.). A NEVER ships translations regardless of flags.
- **DYNAMIC PORTS**: Ports are allocated per domain via hash at startup and stored in `jobs/{domain}/metrics.json`. NEVER hardcode port numbers — always read from metrics.json. This ensures parallel builds of different domains don't collide
- **PROTECT FINISHED BUILDS**: Never modify files inside `jobs/{domain}/option-a/` when working on B or C (and vice versa across all option directories). Worktrees and agents can accidentally overwrite files in the wrong directory. If a finished build gets corrupted, the Vercel deployment is the source of truth — the local `jobs/` directory can be re-generated
- **TEMPLATE ARCHITECTURE (pivoted 2026-04-25)**: `templates/scaffold/` is the ONLY thing copied per-build (Astro config, BaseLayout, animation primitives, empty `@theme` block — zero visual opinions). `templates/inspiration/{aesthetic}/` directories are READ-ONLY references — read them for design ideas, NEVER `cp -r` from them. `templates/REQUIRED-PATTERNS.md` is the typed scaffold mapping qa-check rules to structural requirements. The old `templates/astro-base/` no longer exists; its contents moved to `templates/inspiration/saas-default/` as historical reference.
- **NO `.claude/` IN JOB DIRS**: NEVER create `.claude/` directories or `launch.json` files inside `jobs/{domain}/option-a/`, `option-b/`, or `option-c/`. This triggers permission prompts that break unattended operation. The only `.claude/` directory should be the root project-level one at `/Users/tomasz/WebFactory/.claude/`
- **NO SHELL OPERATORS `&&` or `||`**: NEVER use `&&` or `||` in bash commands — they trigger safety approval prompts. Instead, split commands into separate bash calls, or use `if/then/else/fi` blocks. For example, instead of `cd dir && npm install`, run `cd dir` then `npm install` as two separate bash commands
- **PLAYWRIGHT IS UNRESTRICTED FOR PIPELINE WORK; `preview_*` / `Chrome` MCP TOOLS ARE BANNED FOR PIPELINE WORK BUT ALLOWED FOR USER-FACING DEMOS**: For automated testing, debugging, screenshot QA, and any pipeline-internal visual verification, NEVER use `preview_*` tools (Claude Preview) or `mcp__Claude_in_Chrome__*` / `mcp__Control_Chrome__*` tools (Chrome automation) — they show visible browser windows AND `preview_start` side-effect-creates `.claude/launch.json`. Playwright is the right tool for those: use `scripts/qa.cjs` for the formal QA stages (4 / 6 / 8a — consistent screenshot output to `jobs/{domain}/qa-option-*/`) AND write ad-hoc Playwright scripts in `/tmp/*.mjs` whenever you need a quick visual check during build / debug / iteration (any stage). Start dev servers as background bash processes (`npx astro dev --port $PORT &`), then either `node scripts/qa.cjs ...` OR `node /tmp/your-probe.mjs` — both fine. Read the screenshot PNGs with the Read tool for visual inspection. **EXCEPTION (added 2026-04-29 per user clarification): when explicitly DEMONSTRATING something to the user — showing a finished result, doing a side-by-side comparison, walking through a design — `preview_*` / `Claude_in_Chrome` / `Control_Chrome` ARE allowed and the right tool.** The mental model: "Am I checking my own work during the build?" → Playwright. "Is the user asking me to show them something?" → preview tools are fine.
