# Inspiration Library

These directories are **read-only references** for the WebFactory build process. Worker sessions read them via the Read tool to study design moves — they do NOT `cp -r` from them. Every customer build is designed fresh from `templates/scaffold/` (the pure-scaffold) plus inspiration drawn from one or more of these directories.

See the parent `templates/REQUIRED-PATTERNS.md` for the structural requirements every build MUST satisfy regardless of which inspiration is drawn from. See `templates/scaffold/README.md` for the per-build copy target.

## Available inspirations

| Directory | Aesthetic | Industry fit | A or C? |
|---|---|---|---|
| `saas-default/` | SaaS / consumer / tech-forward. Gradient orbs, blue+amber palette, Plus Jakarta Sans + Inter. Was the original `templates/astro-base/` until 2026-04-25. | Tech, professional services, consultancies. Wrong for trades, food, medical. | A or C |
| `industrial-trades/` | Workwear / safety / utility-poster. Navy + crew red + hi-vis yellow + bone. Bricolage Grotesque + Inter + JetBrains Mono. Bracket numbers, file-tab nav, hatched borders. **Editorial / typographic — see warning in directory README.** | **Option C only** for plumbing, HVAC, electrical, roofing, landscaping, auto, cleaning, construction. **DO NOT use for Option A on trade customers** — drift bug 2026-04-29 (giffins.net + ifixplumbing). | **C only** |
| **`industrial-trades-photo-led/`** | Editorial-restrained craftsman / contractor portfolio. Warm-black ink + warm cream bone + terracotta rust + amber-on-dark. Fraunces serif display + Inter + JetBrains Mono. Italic emphasis pattern on display headlines, photos lead every section, "A craftsman's portfolio — photographed honestly" gallery grid, lead-contractor headshot block. Modeled on `https://elysian-gc-786s9d1zc-tomek-group.vercel.app/`. | **Option A only** for plumbing, HVAC, electrical, roofing, landscaping, auto, cleaning, construction. The **photo-led counterpart to `industrial-trades/`** — built 2026-04-29 to close the "rule with no positive reference" gap on trade Option A builds. Sample homepage renders 12 work photos. | **A only** |

## Planned (not yet built)

| Directory | Aesthetic | Industry fit | A or C? |
|---|---|---|---|
| `food-led/` | Warm earth tones (clay, terracotta, espresso, cream). Editorial serif display + cozy sans text. Texture overlays, hand-drawn dividers, ingredient lists. | Restaurants, cafes, bakeries, food trucks, catering. | A or C |
| `clinical-warm/` | Cool whites + soft sage/dusty blue + warm cream accents. Friendly sans display + readable sans text. Soft rounded shapes, generous whitespace. | Medical, dental, veterinary, mental health, wellness clinics. | A or C |
| `architectural/` | Concrete grey + ink black + 1 muted brand accent. Architectural sans + serif text. Thin lines, oversized photography. | Real estate, architecture firms, interior design, high-end builders. | A or C |
| `editorial-restrained/` | Restrained monochrome + 1 muted accent (oxblood, forest, navy). Confident serif display + serif text. | Law, accounting, finance, professional services. | C-leaning |
| `garage/` | Asphalt black + steel grey + signal orange. Stencil/mechanical display + sans text. Diagonal stripes, gear/tool dingbats. | Auto repair, body shop, motorcycle, detailing. | A or C |

## A vs C aesthetic split (added 2026-04-29)

WebFactory ships THREE versions per customer (A, B, C). The aesthetic vocabulary an inspiration brings is NOT neutral between them:

- **Option A** = "faithful rebuild — same site, suddenly expensive." The customer's original site is the input; A renders the SAME KIND of site (small-business contractor, restaurant, clinic, etc.) with dramatically improved craft. **Photo-led**: at least 90% of must-reuse manifest photos must appear (qa-check `image-reuse-A` rule). Editorial / magazine / typographic-only layout = wrong for A. See `IMAGE REUSE RULE` in SKILL.md.
- **Option B** = inherits A's design verbatim, swaps copy for conversion-tuned rewrite. No new design moves.
- **Option C** = plugin-driven, industry-anchored design language (workwear-document for trades, food-led for restaurants, etc.). C is allowed to lean editorial / typographic / industrial-document because that's its differentiation against A. The plugin's `industry-tokens.json` selects the C vocabulary.

When picking an inspiration directory:
1. Check the "A or C?" column above
2. For Option A on a trade customer, photo density is mandatory (`industrial-trades-photo-led/` once it exists; until then, lean on the elysian-gc reference URL described in SKILL.md `IMAGE REUSE RULE`)
3. For Option C on a trade customer, `industrial-trades/` is the right reference

## Design principle

The ideal inspiration library has 6–8 directories spanning the typical small-business industry mix. Each is a fully-buildable Astro project demonstrating a distinct aesthetic at a real level of execution — not a sketch.

The inspiration library is ALSO the cure for the "100 plumbing customers get 100 identical websites" monoculture risk. By giving the worker session multiple credible reference designs to draw from, AND requiring them to document their choices in `build-design-decisions.md`, we make it harder to lazily replicate one inspiration verbatim and easier to compose unique designs from multiple sources.

## Adding a new inspiration

To add a new inspiration directory:

1. Build a fully-buildable Astro project at `templates/inspiration/{aesthetic-name}/` (with `package.json`, `astro.config.mjs`, custom `global.css` defining the palette + typography, custom `BaseLayout.astro`, 4–6 custom components demonstrating the aesthetic, and ONE sample homepage page that ties them all together).
2. Write a thorough `README.md` in the new directory covering: aesthetic moves to draw from (typography, palette, hero composition, section pattern, distinguishing component patterns), what it does well, what NOT to copy, how to use as inspiration, optional local preview command.
3. Add the directory to the table at the top of THIS file.
4. Smoke-test the inspiration build by running `npm install && npm run build` in that directory — must produce zero errors. The sample homepage must render.
