# Stage 6 — Visual QA & Copy Review (Option B)

> **Loaded by**: orchestrator (Opus runs Stage 6 dispatch + content-parity orchestration). Stage 6c Visual Sanity Pass is delegated to an Opus sub-agent — see "6c. Visual Sanity Pass" below for the dispatch template.
>
> **Source of truth**: this is the canonical text for Stage 6. The summary in `SKILL.md` is a stub that points here.

### Stage 6: Visual QA & Copy Review (Option B)

Same QA flow as Stage 4 (start dev server, run `qa-check.js`, run `qa.cjs` for screenshots, then run the Visual Sanity Pass) but against `jobs/{domain}/option-b/`. Use the `optionB` port from metrics.json (allocated as `portA + 3` — see `init-metrics.cjs`).

#### 6a. Start dev server + run qa-check.js + qa.cjs (orchestrator-inline)

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

#### 6b. B-specific content checks (orchestrator-inline)

These are content-parity / fact-grounding checks the deterministic gate already enforces, plus a few visual nuances the orchestrator can do without reading screenshots. They run BEFORE the sub-agent visual pass.

1. **Copy actually rewritten**: pick one or two paragraphs in A's `dist/` HTML vs B's `dist/` HTML (text-grep, not screenshots) and verify the text is genuinely different. If B's text is identical to A's, the rewrite didn't run — fix and rebuild.

2. **No fabricated facts (FACT GROUNDING — see top-level principle)**: the qa-check.js fact-grounding check (run in 6a above) enforces this programmatically. If it flagged a claim, do NOT loosen the check — fix the copy. Cross-reference every numeric, dated, credential, or identity claim in B with the manifest. If B says "200+ five-star reviews" / "20+ years experience" / "BBB A+ rated" / "family-owned" and the manifest doesn't support it, that's a hallucination — must be removed.

3. **CTA changes are allowed in B**: B is the canonical conversion-tuned rewrite — CTA wording can sharpen for conversion. The check here is that any CTA changes are intentional (sharpened, more specific) rather than accidental drift. If a CTA in B reads worse or vaguer than A's, that's a regression.

4. **All images and logos still present**: B's nav has the same logo as A. Every image in B has the same `src` as the matching image in A. If a logo or image went missing during the rewrite pass, restore it. (Text-grep on `<img src="..."` between A's and B's `dist/` HTML is enough to verify.)

If any of these fail, fix and rebuild B before proceeding to Stage 6c.

#### 6c. Visual Sanity Pass on Option B (delegated to Opus sub-agent — Tier 2 of context-optimization, 2026-05-04)

B inherits A's design verbatim but the rewrite can introduce new bugs (text overflow because new copy is longer, broken active states because new pages were added, voice drift in the rewritten copy, etc.). Do not skip the visual pass on the assumption that "B is just A with new words."

Per Tier 2, the Visual Sanity Pass is delegated to an Opus sub-agent so the orchestrator never reads B's 12–24 screenshots itself. **The 18-item checklist + JSON output schema live in `/Users/tomasz/WebFactory/skill-stages/visual-sanity-pass.md`** (single source of truth, shared with Stage 4c-bis and Stage 7g). Stage-6-specific extension: item #18 is reinterpreted as "is B's design indistinguishable from A's design?" — see the "Stage 6c (Option B)" section of `visual-sanity-pass.md` for the full extension prose.

Spawn ONE Opus sub-agent via the `Agent` tool — same dispatch shape as the Stage 3 Sonnet dispatch, but with `model: "opus"` instead of `"sonnet"`:

- `subagent_type: 'general-purpose'`
- `model: 'opus'`
- Prompt template (substitute `{DOMAIN}`):

```
## Charter

You are running the **Stage 6c Visual Sanity Pass** on Option B for {DOMAIN}. Read /Users/tomasz/WebFactory/skill-stages/visual-sanity-pass.md FIRST for the full 18-item checklist + JSON output schema + brevity contract, paying particular attention to the "Stage 6c (Option B)" section under "Stage extensions".

## What to read

- jobs/{DOMAIN}/qa-option-b/desktop-*.png — desktop screenshots for every page
- jobs/{DOMAIN}/qa-option-b/mobile-*.png — mobile screenshots for every page
- jobs/{DOMAIN}/qa-option-a/desktop-home.png — A's homepage screenshot for the layout-match comparison (item #18 reinterpreted: "does B look like A?")

## What to return

A JSON object matching the schema in visual-sanity-pass.md (stage="6c", option="b"). Keep your reasoning concise — the orchestrator only sees your final JSON, not your scratch work. ~400 tokens of output is the target.

For item #18, the verdict is INVERTED relative to A and C: B's design SHOULD match A's verbatim. Flag `severity: "fail"` ONLY if B's design has DIVERGED from A's structure (broken grid, lost alignment, drifted typography, etc.). If B looks like A, item #18 passes silently.

## What you do NOT do

- DO NOT touch source code. The orchestrator handles fix-loops based on your JSON.
- DO NOT read manifest, design-brief, or .astro source files. Only screenshots + the checklist.
- DO NOT write build-design-decisions.md. The orchestrator writes it after Stage 6c returns.
```

Receive the sub-agent's JSON (~400 tokens). Branch on `verdict`:
- `pass` → continue to Stage 7 (or, if `--skip-c`, advance to Stage 8a).
- `fix` → run the Stage 6 fix-loop (analogous to Stage 4e but for B). Pass the JSON's `issues` array forward as the punch list — no need to re-read screenshots.
- `rebuild` → escalate (re-run Stage 5 with tighter rewrite directives; rare).

After fix-loop iterations complete, the orchestrator writes `jobs/{domain}/option-b/build-design-decisions.md` lifting the design notes from the sub-agent's JSON `summary` (same pattern as Stage 4c-bis). Stop the dev server when done:

```bash
kill {dev_server_pid_a_plus}
```
