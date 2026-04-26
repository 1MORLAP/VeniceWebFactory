# Scaffold — copy-this-per-build

This is the pure Astro 5 + Tailwind v4 scaffold every WebFactory option (A, B, C) starts from. **It contains zero design opinions** — no hero, no nav, no footer, no color palette, no font choice. The build designs all of those fresh per customer.

## What's in here (and why)

| File / dir | What | Why it's frozen |
|---|---|---|
| `package.json` + `package-lock.json` | Pinned Astro 5.7+, Tailwind v4.1+, `@tailwindcss/vite` | Version drift would break builds. Locked. |
| `astro.config.mjs` | Static output + Tailwind plugin wired | The integration is correct; redoing it per-build wastes time and risks misconfig. |
| `tsconfig.json` | Astro strict TypeScript | Standard. |
| `.gitignore` | node_modules, dist, .astro, .vercel, env, OS junk | Standard. |
| `src/styles/global.css` | Tailwind import + `@theme` block with **CSS variable hooks but NO color/font defaults** + `.fade-up`/`.stagger` animation primitives + reduced-motion respect + body-size minimum (16px) | Animation patterns are STRUCTURAL (every site benefits from sane scroll reveals). Color/font defaults would create monoculture. |
| `src/layouts/BaseLayout.astro` | Document chrome only — `<head>` with viewport/meta/title/description/OG/favicon, `<body>` with skip-to-content link, `<slot name="header">`, `<main>`, `<slot name="footer">`, animation enhancement script (progressive — no JS = content visible) | Document semantics, font loading slot, animation script — these are structural primitives every build needs. NO visual choices. |
| `src/pages/.gitkeep` | Empty pages dir | Build creates `src/pages/index.astro`, `about.astro`, etc. fresh per customer. No page templates pre-populated. |

## What's NOT in here (and where it lives)

- **No Hero, Nav, Footer, ServiceCard, Testimonial, etc.** — these are designed fresh per customer. For inspiration on how OTHER builds composed them, read directories under `templates/inspiration/`.
- **No color palette defaults** — the customer's design brief defines this. The build sets `--color-primary-*` and `--color-accent-*` CSS variables in the page's `<style>` block or via `@theme` extension at build time.
- **No font choice** — the customer's design brief picks display + text fonts (per DESIGN QUALITY BAR rule). The build inserts `<link>` tags into `BaseLayout`'s `head-fonts` slot AND sets `--brand-display` / `--brand-text` CSS variables.
- **No `node_modules/`** — `npm install` runs after `cp -r` per-build. Keeps the scaffold lightweight (~10 KB instead of 200 MB).

## How to use

```bash
# In Stage 3a / 5a / 7c of SKILL.md:
cp -r templates/scaffold/ jobs/{domain}/option-a/
cd jobs/{domain}/option-a/
npm install
# Then design + build per the design brief, REQUIRED-PATTERNS.md, and inspiration sources.
```

## What you MUST do after copying

1. **Read `templates/REQUIRED-PATTERNS.md`** — non-negotiable structural requirements every build must satisfy (mapped to qa-check rules that fail the build if violated).
2. **Read 1+ directory in `templates/inspiration/`** — see how prior builds handled hero / nav / cards / etc. Choose what to draw from based on customer's industry.
3. **Design fresh components in `src/components/`** — Hero, Nav, Footer, ServiceCard, etc., per the customer's design brief. NEVER copy a component verbatim from inspiration.
4. **Set the design tokens** in `global.css` `@theme` block (palette ramp, fonts) per the design brief.
5. **Insert font loading** in `BaseLayout`'s `head-fonts` slot from your page templates.
6. **Write `jobs/{domain}/option-a/build-design-decisions.md`** documenting which inspirations informed which decisions and what's unique to this build.

## Why the scaffold is intentionally minimal

The previous template (now at `templates/inspiration/saas-default/`) shipped opinionated visual defaults (gradient orbs, blue+amber palette, Plus Jakarta Sans + Inter, specific Hero composition). Result: every build inherited those defaults until the worker explicitly rewrote them, which they often didn't fully. 100 plumbing customers got 100 SaaS-aesthetic websites. Monoculture.

The pivot (2026-04-25): **scaffolding is the only thing reused across builds. Visual identity is built fresh per customer.** Safety patterns (mobile-first, hero contrast, mobile tap targets, etc.) are enforced by `qa-check.js` at deploy time and documented in `REQUIRED-PATTERNS.md` — they don't need template defaults to be safe.
