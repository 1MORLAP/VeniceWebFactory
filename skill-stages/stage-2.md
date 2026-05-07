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

#### Stage 2.5 sub-agent dispatch — two-phase parallel (Phase G.1, 2026-05-06)

Pre-G.1 architecture (2026-05-05 → 2026-05-06): one Opus sub-agent wrote
all specs in a single call (`_shared.md` + `_image-pools.json` + N per-page
`<page>.md` files). Justified at the time as "the spec-author needs
holistic understanding to produce coherent specs across pages."

That assumption broke when we measured the cost: Stage 2.5 was 47% of
total build cost on the lisastephenscpa.com baseline ($0.94 of $2.02), and
it ran sequentially (~7 min wall-clock for 5 specs because the single
Opus call writes them one-after-another internally). Parallelism was
left on the table.

**G.1 architecture (current)**: split into two phases. The cross-page
coherence concern is resolved by writing `_shared.md` FIRST (Phase A) so
every per-page sub-agent in Phase B reads the same shared context and
produces consistent output without needing to know about peer specs.

```
Phase 2.5a (sequential, 1 sub-agent)
  Inputs : design-brief + REQUIRED-PATTERNS + image-classification + manifest
  Output : specs/_shared.md  (cross-page tokens, prohibitions, component sigs)
           specs/_image-pools.json  (per-page content-class image assignments)
  Why    : these are GLOBAL artifacts — palette/typography apply to every
           page; image pools coordinate across pages (no duplicate hero photos
           across adjacent pages, etc.). Must be authored holistically.
  Cost   : ~10K output tokens × $25/M = ~$0.25 + small input

Phase 2.5b (parallel, N sub-agents — one per page)
  Inputs : design-brief + _shared.md + REQUIRED-PATTERNS + manifest + that
           page's _image-pools entry
  Output : specs/<page>.md  (one file)
  Why    : each per-page spec is a self-contained artifact. With _shared.md
           in place, peer-spec coordination isn't needed. Each sub-agent
           dedicates full attention to ONE page, often improving spec
           granularity vs the monolithic call (which had to amortize
           attention across all pages).
  Cost   : ~5K output tokens each × N × $25/M ≈ $0.125 × 5 = $0.625
  Wall-clock: max(N) running in parallel ≈ 2 min (vs 7 min sequential)
```

**Cost note (G.1 standalone)**: Phase B's N parallel calls each re-read
the brief + REQUIRED-PATTERNS + manifest, so total INPUT tokens across
the N calls grow ~N×. This makes G.1 alone ~10-15% more expensive than
the monolithic call BUT cuts wall-clock by ~5 min (7→2). Phase G.2
(per-page manifest excerpts in dispatch prompt) and G.3 (Anthropic prompt
caching for the shared input) close the input-cost gap. Until G.2/G.3
land, G.1's win is operational (single-session wall-clock comfort) more
than monetary.

**Resolve the model per cost-tier first** (Phase D — same model applies
to both phases):

```bash
SPECS_MODEL=$(node scripts/get-model.cjs $DOMAIN specs --field model)
SPECS_AGENT=$(node scripts/get-model.cjs $DOMAIN specs --agent-model)
SPECS_EFFORT=$(node scripts/get-model.cjs $DOMAIN specs --field effort)
```

Default per `cost-tier=baseline`: `opus-1m` (high effort). `cost-tier=balanced`
and `aggressive` drop to `sonnet` (high effort). Validate-specs + validate-image-pool
gates enforce quality regardless.

##### Phase 2.5a — Shared spec + image pool

Spawn ONE sub-agent via `Agent`:

- `subagent_type: 'general-purpose'`
- `model: '$SPECS_AGENT'`
- Prompt template (substitute `{DOMAIN}`):

```
## Charter

You are running **Stage 2.5a: Shared spec + image pool** for WebFactory build {DOMAIN}.
Read /Users/tomasz/WebFactory/skill-stages/stage-2.md FIRST (covers Stage 2.5
too) and /Users/tomasz/WebFactory/SKILL.md "Stage 2.5: Per-page spec generation".

## What to read

- jobs/{DOMAIN}/manifest.json — pages, sections, business facts
- jobs/{DOMAIN}/design-brief.json — the brief from Stage 2
- jobs/{DOMAIN}/image-classification.json — content-class filter for the image pool
- jobs/{DOMAIN}/video-classification.json (if exists) — variant A/B/C/D for video CTAs
- /Users/tomasz/WebFactory/templates/REQUIRED-PATTERNS.md — non-negotiable structural patterns

## What to write

1. jobs/{DOMAIN}/specs/_shared.md — cross-page concerns:
   - Component prop signatures (Hero, Section, ServiceCard, Testimonial, CtaBanner, Footer)
   - Design tokens (palette + named brand roles + typography pairing + spacing scale)
   - Hard rules ("What NOT to add" — list every prohibition from SKILL.md verbatim:
     no numbered eyebrows on non-blog pages, no fabricated claims, no chrome in
     portfolio, no invented brand graphics, no \\uXXXX escapes, etc.)
   - Aesthetic anchor (1 paragraph capturing the brief's design intent)
   - Mandatory references for per-page specs to read first

2. jobs/{DOMAIN}/specs/_image-pools.json — per-page image assignments:
   ```json
   {
     "<page-slug>": {
       "heroImages": ["<basename>", ...],
       "serviceCards": ["<basename>", ...],
       "portfolio": ["<basename>", ...],   // _class === "content" ONLY
       "aboutPhotos": ["<basename>", ...]
     },
     ...
   }
   ```
   PORTFOLIO INTEGRITY RULE: portfolio/gallery/catalog slots MUST contain only
   `_class === 'content'` images per `image-classification.json`. **The image
   pool MUST union BOTH `manifest.pages[*].images[]` AND
   `manifest.pages[*].backgroundImages[]`** filtered by `_class === 'content'`.
   CSS-background photos are how Dreamweaver / GoDaddy / Wix / static-HTML
   legacy sites place hero / team / banner photos (no CMS image widget).
   Phase H (2026-05-06) extended classification to `backgroundImages[]`;
   treating only foreground `<img>` records as the pool misses content imagery
   on those sites. Real bug filed via lisastephenscpa.com: a 974×348 team photo
   on every page as a CSS background was missing from all 3 deploys pre-Phase H.

3. A 3-line summary back to the orchestrator:
   - page count
   - confirmation _image-pools.json filtered to content-class
   - the count of distinct content images assigned across pages

## What you do NOT do

- DO NOT write per-page specs (specs/<page>.md). Phase 2.5b dispatches N parallel
  sub-agents for that — one per page.
- DO NOT design components or layouts. Spec = direction, not implementation.
- DO NOT spawn further sub-agents.
```

After Phase 2.5a returns, do a quick sanity check that the two output files exist:

```bash
test -f jobs/$DOMAIN/specs/_shared.md && test -f jobs/$DOMAIN/specs/_image-pools.json \
  || { echo "✗ Phase 2.5a missing outputs"; exit 1; }
```

##### Phase 2.5b — Per-page specs (parallel)

For each page in `manifest.pages`, spawn ONE sub-agent in parallel via the
`Agent` tool. Single bash chain prepares the shared dispatch metadata,
then the orchestrator emits N parallel `Agent` calls in a single message
(per the standard parallel-dispatch idiom used at Stage 3 / 5 / 7d-build).

```bash
PAGE_SLUGS=$(node -e "
const m = require('./jobs/$DOMAIN/manifest.json');
console.log(m.pages.map(p => (p.url || p.path || 'index').replace(/[^a-z0-9]/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'index').join(' '));
")
echo "Will spawn $(echo $PAGE_SLUGS | wc -w | tr -d ' ') parallel per-page spec sub-agents: $PAGE_SLUGS"
```

For each slug, dispatch:

- `subagent_type: 'general-purpose'`
- `model: '$SPECS_AGENT'`
- Prompt template (substitute `{DOMAIN}`, `{SLUG}`, `{PAGE_INDEX}`):

```
## Charter

You are running **Stage 2.5b: Per-page spec for {SLUG}** for WebFactory build
{DOMAIN}. Read /Users/tomasz/WebFactory/skill-stages/stage-2.md FIRST for the
required spec structure (## Page metadata / ## Hero / ## Section / etc.) and
the DESIGN QUALITY BAR rules.

## What to read

- jobs/{DOMAIN}/specs/_shared.md — cross-page tokens, prohibitions, component sigs (READ THIS FIRST)
- jobs/{DOMAIN}/design-brief.json — the brief from Stage 2
- jobs/{DOMAIN}/manifest.json pages[{PAGE_INDEX}] — your specific page's data (text, images, backgrounds, sections)
- jobs/{DOMAIN}/specs/_image-pools.json[{SLUG}] — your image-pool assignments
- /Users/tomasz/WebFactory/templates/REQUIRED-PATTERNS.md — non-negotiable structural patterns
- /Users/tomasz/WebFactory/templates/inspiration/<directory>/ — chosen inspiration (named in design-brief.json)

## What to write

- jobs/{DOMAIN}/specs/{SLUG}.md — your page's spec, structured per stage-2.md

The spec MUST be self-contained: a Sonnet sub-agent (Stage 3) given just
_shared.md + your spec must produce a clean, structurally-correct page
without needing to read other specs.

## What you do NOT do

- DO NOT write _shared.md or _image-pools.json — those are Phase 2.5a's outputs (already done).
- DO NOT write specs for OTHER pages — exactly one spec, for {SLUG} only.
- DO NOT build any pages. Stage 3 dispatch handles that.
- DO NOT spawn further sub-agents.
- DO NOT skip the prohibitions in _shared.md — every "What NOT to add" entry must
  reach the Stage 3 sub-agent via _shared.md OR your per-page spec.

## One-line return

Reply to the orchestrator with: "Spec written: specs/{SLUG}.md, ~<linecount> lines, used <N> images from pool".
```

After all N sub-agents return, run BOTH hard gates:

```bash
node scripts/validate-specs.cjs \
  --manifest jobs/$DOMAIN/manifest.json \
  --design-brief jobs/$DOMAIN/design-brief.json \
  --specs jobs/$DOMAIN/specs/
node scripts/validate-image-pool.cjs $DOMAIN
SPEC_COUNT=$(ls jobs/$DOMAIN/specs/*.md 2>/dev/null | grep -v '^_' | wc -l | tr -d ' ')
node scripts/log-decision.cjs "$DOMAIN" 2.5 specs-written \
  --detail dispatcher=sub-agent-parallel \
  --detail model=$SPECS_MODEL \
  --detail effort=$SPECS_EFFORT \
  --detail specCount=$SPEC_COUNT \
  --detail phaseA=1 \
  --detail phaseB=$SPEC_COUNT
```

If either gate fails, the orchestrator either re-dispatches the failing per-page
sub-agent(s) with the gate's error message as input OR falls back to inline
curation. The gates are the safety net.

##### Escape hatch: monolithic Stage 2.5 (single sub-agent for all specs)

For very small sites (1-3 pages) or when debugging, the orchestrator may opt
to run Stage 2.5 as a single sub-agent dispatch (the pre-G.1 pattern). Pass
`--monolithic-2-5` to the orchestrator OR set environment variable
`WEBFACTORY_MONOLITHIC_2_5=1`. In that mode, dispatch ONE sub-agent with the
combined Phase 2.5a + 2.5b prompt (write ALL specs files in a single call).
The wall-clock penalty is acceptable for tiny page counts where parallelism
overhead exceeds the win.

The default is two-phase parallel (G.1).
