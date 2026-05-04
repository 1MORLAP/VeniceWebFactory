# Stage 6 — Visual QA & Copy Review (Option B)

> **Loaded by**: orchestrator (Opus runs Stage 6 directly — visual review and design judgment require holistic context).
>
> **Source of truth**: this is the canonical text for Stage 6. The summary in `SKILL.md` is a stub that points here.

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
