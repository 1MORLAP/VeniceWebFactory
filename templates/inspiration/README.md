# Inspiration Library

These directories are **read-only references** for the WebFactory build process. Worker sessions read them via the Read tool to study design moves — they do NOT `cp -r` from them. Every customer build is designed fresh from `templates/scaffold/` (the pure-scaffold) plus inspiration drawn from one or more of these directories.

See the parent `templates/REQUIRED-PATTERNS.md` for the structural requirements every build MUST satisfy regardless of which inspiration is drawn from. See `templates/scaffold/README.md` for the per-build copy target.

## Available inspirations

| Directory | Aesthetic | Industry fit |
|---|---|---|
| `saas-default/` | SaaS / consumer / tech-forward. Gradient orbs, blue+amber palette, Plus Jakarta Sans + Inter. Was the original `templates/astro-base/` until 2026-04-25. | Tech, professional services, consultancies. Wrong for trades, food, medical. |
| `industrial-trades/` | Workwear / safety / utility-poster. Navy + crew red + hi-vis yellow + bone. Bricolage Grotesque + Inter + JetBrains Mono. Bracket numbers, file-tab nav, hatched borders. | Plumbing, HVAC, electrical, roofing, landscaping, auto, cleaning, construction. |

## Planned (not yet built)

| Directory | Aesthetic | Industry fit |
|---|---|---|
| `food-led/` | Warm earth tones (clay, terracotta, espresso, cream). Editorial serif display + cozy sans text. Texture overlays, hand-drawn dividers, ingredient lists. | Restaurants, cafes, bakeries, food trucks, catering. |
| `clinical-warm/` | Cool whites + soft sage/dusty blue + warm cream accents. Friendly sans display + readable sans text. Soft rounded shapes, generous whitespace. | Medical, dental, veterinary, mental health, wellness clinics. |
| `architectural/` | Concrete grey + ink black + 1 muted brand accent. Architectural sans + serif text. Thin lines, oversized photography. | Real estate, architecture firms, interior design, high-end builders. |
| `editorial-restrained/` | Restrained monochrome + 1 muted accent (oxblood, forest, navy). Confident serif display + serif text. | Law, accounting, finance, professional services. |
| `garage/` | Asphalt black + steel grey + signal orange. Stencil/mechanical display + sans text. Diagonal stripes, gear/tool dingbats. | Auto repair, body shop, motorcycle, detailing. |

## Design principle

The ideal inspiration library has 6–8 directories spanning the typical small-business industry mix. Each is a fully-buildable Astro project demonstrating a distinct aesthetic at a real level of execution — not a sketch.

The inspiration library is ALSO the cure for the "100 plumbing customers get 100 identical websites" monoculture risk. By giving the worker session multiple credible reference designs to draw from, AND requiring them to document their choices in `build-design-decisions.md`, we make it harder to lazily replicate one inspiration verbatim and easier to compose unique designs from multiple sources.

## Adding a new inspiration

To add a new inspiration directory:

1. Build a fully-buildable Astro project at `templates/inspiration/{aesthetic-name}/` (with `package.json`, `astro.config.mjs`, custom `global.css` defining the palette + typography, custom `BaseLayout.astro`, 4–6 custom components demonstrating the aesthetic, and ONE sample homepage page that ties them all together).
2. Write a thorough `README.md` in the new directory covering: aesthetic moves to draw from (typography, palette, hero composition, section pattern, distinguishing component patterns), what it does well, what NOT to copy, how to use as inspiration, optional local preview command.
3. Add the directory to the table at the top of THIS file.
4. Smoke-test the inspiration build by running `npm install && npm run build` in that directory — must produce zero errors. The sample homepage must render.
