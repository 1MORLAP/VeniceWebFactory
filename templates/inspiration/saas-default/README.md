# Inspiration: SaaS Default (formerly `templates/astro-base/`)

> **Status**: reference only. Read for ideas; do NOT `cp -r` this into a customer build. Use `templates/scaffold/` for that.
>
> **Aesthetic**: SaaS / consumer / tech-forward. Gradient orbs, noise textures, blue+amber palette, Plus Jakarta Sans + Inter typography. Designed for general-purpose modern landing pages.
>
> **Industry fit**: tech, professional services, consultancies. **Wrong for**: trades (use `industrial-trades/`), food (use `food-led/`), medical/dental (use `clinical-warm/`), restaurants, retail.

## What this directory used to be

Until 2026-04-25, this was `templates/astro-base/` — the single Astro starter every WebFactory build copied from. It encoded a real risk: every Option A inherited the same blue-amber-gradient-orb-Plus-Jakarta-Sans defaults. 100 plumbing customers got 100 SaaS-aesthetic websites. Monoculture.

The architecture pivoted: scaffolding (Astro config + minimal BaseLayout + animation primitives) moved to `templates/scaffold/` and gets copied per-build. Visual style is now built fresh per customer, informed by — but never copied wholesale from — directories like this one.

## What this directory is good at

Reference for these design moves:
- **Three-layer hero pattern**: image / overlay / text, satisfies HERO CONTRAST RULE. The composition is sound; the noise-texture / gradient-orb decoration is one valid treatment among many.
- **Scroll-triggered fade-up animations** with stagger delays via `.fade-up` and `.stagger` classes (these primitives moved into `templates/scaffold/global.css` and are still part of every build — only the visual styling on top is opinionated here).
- **Component prop API patterns**: how `Hero.astro`, `ServiceCard.astro`, `Testimonial.astro` accept structured props with sensible defaults. Worth modeling new components after this API ergonomics, even when the visual style is different.
- **CTA button styling with hover lift + arrow animation**: a well-tuned interaction worth copying the structure of (translate-y on hover, arrow icon shifts).
- **Responsive type scale ramp**: `text-4xl sm:text-5xl md:text-6xl lg:text-7xl` for hero headings is a workable starting point for SaaS-aesthetic builds.

## What this directory does WRONG (don't copy these moves)

- **Default fonts (`Plus Jakarta Sans` + `Inter`)** fail the DESIGN QUALITY BAR — Inter is system-grade, not display-quality. For real "suddenly expensive" feel, pick a true display font (Fraunces, Editorial New, DM Serif Display, Cabinet Grotesk, Cormorant) per customer.
- **Default blue+amber palette** is generic SaaS — no brand justification, just a vibe. Real builds need a 3-primary + 2-accent palette with NAMED ROLES per the customer's brand signal.
- **Gradient orbs in the corners + noise texture overlay**: SaaS landing-page tropes. Off-aesthetic for trades/food/medical/restaurant/retail. Use sparingly and only when the customer's brand actually wants tech-modern signal.
- **Single hero variant per page**: real designs vary the hero treatment per page (homepage hero ≠ services-page hero ≠ contact-page hero). Don't reuse the same component shape page-to-page.

## How to use this as inspiration

1. Open the components and read them. Notice the prop APIs, animation classes, contrast patterns.
2. Identify which moves are STRUCTURAL (worth keeping) vs VISUAL (must be reinvented for your customer).
3. In your build's `build-design-decisions.md`, cite specifically what you drew from here and what you intentionally diverged from.
4. NEVER `cp -r` any component file from here into a customer build. Read it, understand it, write a fresh component for the customer in their voice.

See `templates/REQUIRED-PATTERNS.md` for the structural requirements every build must satisfy regardless of which inspiration you draw from.
