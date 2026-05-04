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
