# Next.js Conf 2025 — Style Reference
> Pragmatic developer canvas: sharp type on white, pixel grid accents.

**Theme:** light

Next.js Conf 2025 presents a pragmatic, high-contrast digital canvas for technical events. Its design prioritizes clear information hierarchy and functional efficiency, using a predominantly achromatic palette punctuated by a single vibrant blue for key interactions and brand accents. Typography is compact and precise, relying on a modern sans-serif. Visual texture is introduced through subtle grid patterns and pixelated blue blocks, grounding the experience in a developer aesthetic while maintaining a professional, utilitarian feel.

## Tokens — Colors

| Name | Value | Token | Role |
|------|-------|-------|------|
| Canvas White | `#fafafa` | `--color-canvas-white` | Page backgrounds, surface background for cards and hero sections, foundational white |
| Text Primary | `#171717` | `--color-text-primary` | Primary headings, body text, navigation links, high-contrast elements |
| Text Secondary | `#4d4d4d` | `--color-text-secondary` | Secondary body text, descriptive labels, slightly muted information |
| Text Tertiary | `#8f8f8f` | `--color-text-tertiary` | Helper text, metadata, subtle labels, sponsorship tier labels |
| Border Light | `#e6e6e6` | `--color-border-light` | Hairline borders for cards, outlined buttons, subtle dividers |
| Info Background | `#e9f4ff` | `--color-info-background` | Background for informational badges, creating a subtle highlight |
| Function Blue | `#0057ff` | `--color-function-blue` | Primary action buttons, interactive elements, accent for brand and key calls to action |
| Accent Blue | `#005ff2` | `--color-accent-blue` | Blue state accent for badges, validation surfaces, and short status labels. Do not promote it to the primary CTA color |
| Black | `#000000` | `--color-black` | Used for some icon fills, high-contrast borders, and occasional background elements, suggesting absolute contrast |

## Tokens — Typography

### Geist — Primary display font for all headings, body text, nav items, and buttons. Its compact sizing and tight tracking contribute to the system's efficient, technical feel. · `--font-geist`
- **Substitute:** Inter
- **Weights:** 400, 500, 600
- **Sizes:** 12px, 14px, 16px, 32px, 48px, 72px
- **Line height:** 1.00, 1.43, 1.50
- **Letter spacing:** -0.0400em, -0.0400em, -0.0400em, -0.0600em, -0.0600em, -0.0600em
- **OpenType features:** `"calt" 0, "rlig"`
- **Role:** Primary display font for all headings, body text, nav items, and buttons. Its compact sizing and tight tracking contribute to the system's efficient, technical feel.

### Geist Mono — Monospaced font used for code snippets, secondary details, and technical labels, providing a distinct developer aesthetic. · `--font-geist-mono`
- **Substitute:** JetBrains Mono
- **Weights:** 400
- **Sizes:** 13px, 14px, 16px, 18px, 20px
- **Line height:** 1.00, 1.11, 1.50
- **Letter spacing:** 0.0200em, 0.0200em, 0.0200em, 0.0200em, 0.0200em
- **OpenType features:** `"calt" 0, "rlig"`
- **Role:** Monospaced font used for code snippets, secondary details, and technical labels, providing a distinct developer aesthetic.

### Type Scale

| Role | Size | Line Height | Letter Spacing | Token |
|------|------|-------------|----------------|-------|
| caption | 12px | 1.43 | -0.48px | `--text-caption` |
| body | 14px | 1.43 | -0.56px | `--text-body` |
| body-lg | 16px | 1.5 | -0.64px | `--text-body-lg` |
| heading | 32px | 1 | -1.92px | `--text-heading` |
| heading-lg | 48px | 1 | -2.88px | `--text-heading-lg` |
| display | 72px | 1 | -4.32px | `--text-display` |

## Tokens — Spacing & Shapes

**Base unit:** 4px

**Density:** comfortable

### Spacing Scale

| Name | Value | Token |
|------|-------|-------|
| 4 | 4px | `--spacing-4` |
| 8 | 8px | `--spacing-8` |
| 12 | 12px | `--spacing-12` |
| 16 | 16px | `--spacing-16` |
| 20 | 20px | `--spacing-20` |
| 24 | 24px | `--spacing-24` |
| 32 | 32px | `--spacing-32` |
| 40 | 40px | `--spacing-40` |
| 52 | 52px | `--spacing-52` |
| 64 | 64px | `--spacing-64` |
| 80 | 80px | `--spacing-80` |
| 100 | 100px | `--spacing-100` |
| 168 | 168px | `--spacing-168` |
| 192 | 192px | `--spacing-192` |

### Border Radius

| Element | Value |
|---------|-------|
| cards | 8px |
| links | 8px |
| badges | 9999px |
| images | 8px |
| buttons | 100px |

### Shadows

| Name | Value | Token |
|------|-------|-------|
| subtle | `lab(92.692 0 0) 0px 0px 0px 1px` | `--shadow-subtle` |

### Layout

- **Section gap:** 64px
- **Card padding:** 20px
- **Element gap:** 24px

## Components

### Primary Filled Button
**Role:** Main call-to-action button for initiating key actions.

Background: Function Blue (#0057ff), Text: Canvas White (#fafafa), Border Radius: 100px. Padding variable from 0px up to 20px on sides based on content.

### Ghost Button
**Role:** Secondary action or navigation buttons that should not draw primary attention.

Background: transparent (rgba(0, 0, 0, 0)), Text: Text Primary (#171717), Border: 1px solid Border Light (#e6e6e6), Border Radius: variable, often 0px.

### Conference Card
**Role:** Containers for content blocks like session details or speaker information.

Background: Canvas White (#fafafa), Border Radius: 8px, No Box Shadow. Padding inside cards is typically 20px, with elements spaced at 24px.

### New Feature Badge
**Role:** Highlights new or important informational elements, often associated with updates.

Background: Info Background (#e9f4ff), Text: Accent Blue (#005ff2), Border Radius: 9999px. Padding: 0px vertical, 10px horizontal.

### Navigation Link
**Role:** Top-level navigation items, directing users to main sections.

Font: Geist, Weight: 400, Size: 16px (approx), Color: Text Primary (#171717). No explicit background or border, relies on text contrast.

### Hero Section
**Role:** Prominent initial content area, typically full-width and high impact.

Background: Canvas White (#fafafa), contrasting with large bold headings. Can feature abstract grid patterns using Accent Blue.

## Do's and Don'ts

### Do
- Prioritize Canvas White (#fafafa) for all primary page and content backgrounds.
- Use Function Blue (#0057ff) sparingly and intentionally for primary call-to-actions and brand accents only.
- Employ Geist for all primary text content including headlines, body, and UI labels, leveraging its compact nature.
- Use Geist Mono for all technical or code-related text, and any secondary labels requiring a distinct tone.
- Maintain a clear visual hierarchy with Text Primary (#171717) for main information and progressively lighter neutrals for secondary details.
- Apply 8px border-radius to cards, images, and non-button links, and 100px to primary buttons for distinct visual weighting.
- Utilize Border Light (#e6e6e6) for all hairline dividers, card borders, and ghost button outlines to maintain a minimalist aesthetic.

### Don't
- Avoid using highly saturated colors beyond Function Blue (#0057ff) and Accent Blue (#005ff2) for interactive elements.
- Do not introduce heavy drop shadows or complex gradients; the system prefers flat surfaces and subtle borders.
- Do not deviate from the Geist and Geist Mono font families or their specified letter-spacing for UI elements.
- Do not create excessive visual clutter; use minimal styling and rely on spacing and typography for clarity.
- Avoid using inconsistent border radii; adhere strictly to 8px for containers and 100px/9999px for buttons/badges.
- Do not use #000000 as a primary text color where #171717 is more appropriate; reserve #000000 for specific graphic elements or absolute contrast needs.

## Surfaces

| Level | Name | Value | Purpose |
|-------|------|-------|---------|
| 0 | Base Canvas | `#fafafa` | Dominant background for the entire application, providing a clean, bright foundation. |
| 1 | Info Surface | `#e9f4ff` | Used as a subtle background for informational badges, hinting at interactivity or newness. |
| 2 | Card Surface | `#e6e6e6` | Background for certain card-like content areas or partner blocks, providing a very subtle visual separation without shadow. |

## Elevation

The design system explicitly avoids complex shadows for elevation. Instead, visual hierarchy and separation between elements are achieved through high-contrast typography, clear outlines with Border Light (#e6e6e6), and calculated use of white space. Elevation is implied through borders or background color shifts rather than depth simulation.

## Imagery

This site uses a mix of candid, high-contrast portrait photography (monochromatic, sometimes with a subtle gray tint) and abstract, geometric pixelated patterns in Function Blue and neutral tones. The photography serves to humanize the speakers, while the pixel patterns add a technical, digital layer. Imagery is generally contained within sections, not full-bleed, and often integrated directly into the structured layout, acting as a visual accent rather than a dominant element. Iconography is minimalist, outlined or filled, and primarily achromatic, with occasional Accent Blue highlights.

## Layout

The page primarily uses a max-width contained layout, though the hero section can extend full-bleed. Its hero pattern features a centered headline over a background that combines grayscale photography with abstract blue pixel grid patterns. Section rhythm is driven by consistent vertical spacing (64px) between distinct content blocks, with internal element gaps typically 24px. Content is arranged in alternating text-left/image-right or text-over-image compositions, and includes multi-column grids for features and sponsorships. The navigation is a sticky, minimal top bar on a white background, featuring logo, nav links and login/CTA links.

## Agent Prompt Guide

Quick Color Reference:
- text: #171717
- background: #fafafa
- border: #e6e6e6
- accent: #005ff2
- primary action: #0057ff (filled action)

Example Component Prompts:
- Create a Primary Action Button: #0057ff background, #4d4d4d text, 9999px radius, compact pill padding. Use this filled treatment for the main CTA.

## Similar Brands

- **Vercel** — Shares a similar technical product aesthetic, minimalist approach, use of Geist font, and high-contrast achromatic palette with a single dominant accent color.
- **Stripe** — Employs clean, efficient typography, a largely monochrome UI, subtle borders for definition, and highly functional use of color for actions.
- **Linear** — Features a dense, productivity-focused UI with crisp typography, strong use of whitespace, and minimal elevation achieved through borders rather than shadows.
- **Tailwind CSS** — Reflects a developer-tool aesthetic with clear information architecture, high legibility, and a focus on utility over decorative elements.

## Quick Start

### CSS Custom Properties

```css
:root {
  /* Colors */
  --color-canvas-white: #fafafa;
  --color-text-primary: #171717;
  --color-text-secondary: #4d4d4d;
  --color-text-tertiary: #8f8f8f;
  --color-border-light: #e6e6e6;
  --color-info-background: #e9f4ff;
  --color-function-blue: #0057ff;
  --color-accent-blue: #005ff2;
  --color-black: #000000;

  /* Typography — Font Families */
  --font-geist: 'Geist', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-geist-mono: 'Geist Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;

  /* Typography — Scale */
  --text-caption: 12px;
  --leading-caption: 1.43;
  --tracking-caption: -0.48px;
  --text-body: 14px;
  --leading-body: 1.43;
  --tracking-body: -0.56px;
  --text-body-lg: 16px;
  --leading-body-lg: 1.5;
  --tracking-body-lg: -0.64px;
  --text-heading: 32px;
  --leading-heading: 1;
  --tracking-heading: -1.92px;
  --text-heading-lg: 48px;
  --leading-heading-lg: 1;
  --tracking-heading-lg: -2.88px;
  --text-display: 72px;
  --leading-display: 1;
  --tracking-display: -4.32px;

  /* Typography — Weights */
  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;

  /* Spacing */
  --spacing-unit: 4px;
  --spacing-4: 4px;
  --spacing-8: 8px;
  --spacing-12: 12px;
  --spacing-16: 16px;
  --spacing-20: 20px;
  --spacing-24: 24px;
  --spacing-32: 32px;
  --spacing-40: 40px;
  --spacing-52: 52px;
  --spacing-64: 64px;
  --spacing-80: 80px;
  --spacing-100: 100px;
  --spacing-168: 168px;
  --spacing-192: 192px;

  /* Layout */
  --section-gap: 64px;
  --card-padding: 20px;
  --element-gap: 24px;

  /* Border Radius */
  --radius-lg: 8px;
  --radius-full: 100px;
  --radius-full-2: 9999px;

  /* Named Radii */
  --radius-cards: 8px;
  --radius-links: 8px;
  --radius-badges: 9999px;
  --radius-images: 8px;
  --radius-buttons: 100px;

  /* Shadows */
  --shadow-subtle: lab(92.692 0 0) 0px 0px 0px 1px;

  /* Surfaces */
  --surface-base-canvas: #fafafa;
  --surface-info-surface: #e9f4ff;
  --surface-card-surface: #e6e6e6;
}
```

### Tailwind v4

```css
@theme {
  /* Colors */
  --color-canvas-white: #fafafa;
  --color-text-primary: #171717;
  --color-text-secondary: #4d4d4d;
  --color-text-tertiary: #8f8f8f;
  --color-border-light: #e6e6e6;
  --color-info-background: #e9f4ff;
  --color-function-blue: #0057ff;
  --color-accent-blue: #005ff2;
  --color-black: #000000;

  /* Typography */
  --font-geist: 'Geist', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-geist-mono: 'Geist Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;

  /* Typography — Scale */
  --text-caption: 12px;
  --leading-caption: 1.43;
  --tracking-caption: -0.48px;
  --text-body: 14px;
  --leading-body: 1.43;
  --tracking-body: -0.56px;
  --text-body-lg: 16px;
  --leading-body-lg: 1.5;
  --tracking-body-lg: -0.64px;
  --text-heading: 32px;
  --leading-heading: 1;
  --tracking-heading: -1.92px;
  --text-heading-lg: 48px;
  --leading-heading-lg: 1;
  --tracking-heading-lg: -2.88px;
  --text-display: 72px;
  --leading-display: 1;
  --tracking-display: -4.32px;

  /* Spacing */
  --spacing-4: 4px;
  --spacing-8: 8px;
  --spacing-12: 12px;
  --spacing-16: 16px;
  --spacing-20: 20px;
  --spacing-24: 24px;
  --spacing-32: 32px;
  --spacing-40: 40px;
  --spacing-52: 52px;
  --spacing-64: 64px;
  --spacing-80: 80px;
  --spacing-100: 100px;
  --spacing-168: 168px;
  --spacing-192: 192px;

  /* Border Radius */
  --radius-lg: 8px;
  --radius-full: 100px;
  --radius-full-2: 9999px;

  /* Shadows */
  --shadow-subtle: lab(92.692 0 0) 0px 0px 0px 1px;
}
```
