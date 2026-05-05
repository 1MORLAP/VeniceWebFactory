# Stage 2 — Analyze & Design Brief

> **Loaded by**: orchestrator (Opus runs this stage directly — brief generation requires holistic understanding of the manifest + screenshots).
>
> **Source of truth**: this is the canonical text for Stage 2. The summary in `SKILL.md` is a stub that points here.

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

#### Stage 2 sub-agent dispatch (Tier 3 of context-optimization, 2026-05-05)

Per Tier 3 of the context-optimization plan, the orchestrator MAY (and by default SHOULD) delegate Stage 2 to an Opus sub-agent so the brief generation's screenshot reads + manifest walk happen off the main session. Tier 1a (skill-stages split) + Tier 1b (smart-resume) + Tier 2 (visual-pass dispatch) shipped 2026-05-04 brought main-session context for a 6-page build from ~600-800K to ~250-350K. Tier 3 takes another ~80-120K off main when the customer has more than 4-5 pages.

Spawn ONE sub-agent via the `Agent` tool. **Resolve the model per cost-tier first** (Phase D):

```bash
BRIEF_MODEL=$(node scripts/get-model.cjs $DOMAIN brief --field model)
BRIEF_AGENT=$(node scripts/get-model.cjs $DOMAIN brief --agent-model)
BRIEF_EFFORT=$(node scripts/get-model.cjs $DOMAIN brief --field effort)
```

Default per `cost-tier=baseline`: `opus-1m` (high effort). `cost-tier=balanced` and `aggressive` drop this to `sonnet` (high effort) — validate-design-brief.cjs gate enforces brief richness regardless of model.

- `subagent_type: 'general-purpose'`
- `model: '$BRIEF_AGENT'`
- Prompt template (substitute `{DOMAIN}`):

```
## Charter

You are running **Stage 2: Design Brief** for WebFactory build {DOMAIN}. Read /Users/tomasz/WebFactory/skill-stages/stage-2.md FIRST for the full brief structure + DESIGN QUALITY BAR criteria.

## What to read

- jobs/{DOMAIN}/manifest.json — every page, every section, business facts, social/footer
- jobs/{DOMAIN}/assets/screenshots/*.png — visual reference for the original site
- jobs/{DOMAIN}/image-classification.json — content-vs-chrome inventory (helps you scope "thin manifest" vs "rich photo coverage" sites)
- /Users/tomasz/WebFactory/SKILL.md sections referenced from stage-2.md (DESIGN QUALITY BAR, FACT GROUNDING PRINCIPLE, BRAND RECOGNIZABILITY)

## What to write

- jobs/{DOMAIN}/design-brief.json — the full brief, schema per stage-2.md
- A 1-line acknowledgment back to the orchestrator (~200 tokens summary): industry classification + 3-color palette names + display+text typography pairing + 1 distinctive design move you're committing to. The orchestrator reads ONLY this summary; it does not re-open the brief.

## What you do NOT do

- DO NOT write specs/ — that's Stage 2.5, a separate sub-agent dispatch.
- DO NOT design any components or layouts. Brief = direction, not implementation.
- DO NOT spawn further sub-agents. One pass, one design-brief.json file.
- DO NOT modify manifest.json.
```

After the sub-agent returns, run the hard gate:

```bash
node scripts/validate-design-brief.cjs $DOMAIN
node scripts/log-decision.cjs "$DOMAIN" 2 design-brief-written --detail dispatcher=sub-agent --detail model=$BRIEF_MODEL --detail effort=$BRIEF_EFFORT
```

The gate verifies the brief has the required fields (typography, palette, hero, distinctive-elements, micro-interactions, mobile-first, brand-signature) per the DESIGN QUALITY BAR. Soft no-op if the file is missing — that's a separate failure mode handled by Stage 2.5b's dependency check.

If the orchestrator deliberately runs Stage 2 inline (smaller sites, debugging), pass `--allow-inline` to the gate. Use sparingly.

#### Stage 2.5 sub-agent dispatch (Tier 3 — paired with Stage 2 above)

Same pattern for per-page spec generation. Spawn ONE sub-agent (NOT N parallel — the spec-author needs holistic understanding to produce coherent specs across pages). **Resolve the model per cost-tier**:

```bash
SPECS_MODEL=$(node scripts/get-model.cjs $DOMAIN specs --field model)
SPECS_AGENT=$(node scripts/get-model.cjs $DOMAIN specs --agent-model)
SPECS_EFFORT=$(node scripts/get-model.cjs $DOMAIN specs --field effort)
```

Default per `cost-tier=baseline`: `opus-1m` (high effort). `cost-tier=balanced` and `aggressive` drop this to `sonnet`. Validate-specs + validate-image-pool gates enforce quality regardless.

- `subagent_type: 'general-purpose'`
- `model: '$SPECS_AGENT'`
- Prompt template (substitute `{DOMAIN}`):

```
## Charter

You are running **Stage 2.5: Per-page spec generation** for WebFactory build {DOMAIN}. Read /Users/tomasz/WebFactory/skill-stages/stage-2.md FIRST (covers Stage 2.5 too) and /Users/tomasz/WebFactory/SKILL.md "Stage 2.5: Per-page spec generation" section.

## What to read

- jobs/{DOMAIN}/manifest.json — pages, sections, business facts
- jobs/{DOMAIN}/design-brief.json — the brief from Stage 2
- jobs/{DOMAIN}/image-classification.json — to filter portfolio slot images to _class === "content"
- jobs/{DOMAIN}/video-classification.json (if exists) — to wire variant A/B/C/D into specs
- /Users/tomasz/WebFactory/templates/REQUIRED-PATTERNS.md — non-negotiable structural patterns
- /Users/tomasz/WebFactory/templates/inspiration/<directory>/ — chosen inspiration source (the brief named which one)

## What to write

- jobs/{DOMAIN}/specs/_shared.md
- jobs/{DOMAIN}/specs/_image-pools.json — content-class images ONLY in portfolio/catalog/gallery slots (per PORTFOLIO INTEGRITY RULE)
- jobs/{DOMAIN}/specs/<page>.md — one per page in the manifest
- A 3-line summary back to the orchestrator: page count + 1-line confirmation that _image-pools is content-class-filtered + any "What NOT to add" prohibitions added to _shared.md.

## What you do NOT do

- DO NOT build any pages. Stage 3 dispatch handles that.
- DO NOT spawn further sub-agents. One pass, one specs/ tree.
- DO NOT skip prohibitions in _shared.md — every spec MUST list the no-fabrication rules from SKILL.md (no numbered eyebrows on non-blog pages, no fabricated claims, no chrome in portfolio, no invented brand graphics, no \\uXXXX escapes, etc.).
```

After the sub-agent returns, run BOTH hard gates:

```bash
node scripts/validate-specs.cjs --manifest jobs/$DOMAIN/manifest.json --design-brief jobs/$DOMAIN/design-brief.json --specs jobs/$DOMAIN/specs/
node scripts/validate-image-pool.cjs $DOMAIN
node scripts/log-decision.cjs "$DOMAIN" 2.5 specs-written --detail dispatcher=sub-agent --detail model=$SPECS_MODEL --detail effort=$SPECS_EFFORT --detail specCount=$(ls jobs/$DOMAIN/specs/*.md 2>/dev/null | grep -v '^_' | wc -l | tr -d ' ')
```

If either gate fails, the orchestrator either re-dispatches the Stage 2.5 sub-agent with the gate's error message as input OR falls back to inline curation. The gates are the safety net.
