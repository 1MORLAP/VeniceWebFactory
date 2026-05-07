# Artisans d'idées — Style Reference
> Minimalist digital canvas

**Theme:** dark

Artisans d'idées employs a stark, high-contrast dark theme with minimal elements, creating a focused and atmospheric experience. Typography is extremely compact and tightly tracked, contributing to a sense of precision and restraint. The visual style revolves around black backgrounds, white text, and thin borders, ensuring all focus remains on the content through absence of distraction. Components are almost entirely conceptual, relying on typography and tight spacing rather than background fills or elevation to define boundaries.

## Tokens — Colors

| Name | Value | Token | Role |
|------|-------|-------|------|
| Midnight Void | `#000000` | `--color-midnight-void` | Primary background for all pages and sections, deep, absorbing black |
| Ghost White | `#ffffff` | `--color-ghost-white` | Hairline borders, dividers, input outlines, and card edges on light surfaces. Do not promote it to the primary CTA color |
| Cinder Gray | `#bbbab2` | `--color-cinder-gray` | Muted secondary text, subtle decorative lines |
| Warning Red | `#ff0000` | `--color-warning-red` | Red wash for highlight backgrounds, decorative bands, and soft emphasis behind content. Use as a supporting accent, not as a status color |

## Tokens — Typography

### Barlow — All textual content from large headlines to smallest body text, driving a consistent, tight-knit visual rhythm. The extremely low line-heights and tight letter-spacing are a signature element, creating dense blocks of text. · `--font-barlow`
- **Substitute:** Inter
- **Weights:** 300, 400
- **Sizes:** 10px, 12px, 13px, 14px, 15px, 18px
- **Line height:** 0.80, 0.90, 1.00, 1.20, 1.60
- **Letter spacing:** 0.1000em, 0.2000em, 0.3000em
- **Role:** All textual content from large headlines to smallest body text, driving a consistent, tight-knit visual rhythm. The extremely low line-heights and tight letter-spacing are a signature element, creating dense blocks of text.

### Type Scale

| Role | Size | Line Height | Letter Spacing | Token |
|------|------|-------------|----------------|-------|
| caption | 10px | 1 | — | `--text-caption` |
| body-sm | 12px | 1 | — | `--text-body-sm` |
| body | 13px | 1 | — | `--text-body` |
| body-lg | 14px | 1 | — | `--text-body-lg` |
| heading-sm | 15px | 1 | — | `--text-heading-sm` |
| heading | 18px | 1 | — | `--text-heading` |

## Tokens — Spacing & Shapes

**Base unit:** 8px

**Density:** spacious

### Spacing Scale

| Name | Value | Token |
|------|-------|-------|
| 200 | 200px | `--spacing-200` |

### Border Radius

| Element | Value |
|---------|-------|
| none | 0px |

### Layout

- **Page max-width:** 1026px
- **Section gap:** 200px
- **Card padding:** 24px
- **Element gap:** 1px

## Components

### Navigation Link
**Role:** Top navigation items.

Ghost White text at 14px Barlow weight 400, on Midnight Void background. Interacts through text-only presentation without background or border emphasis.

### Body Text Block
**Role:** Primary content display.

Ghost White text, typically at 15px Barlow weight 400, on Midnight Void background. Characterized by extremely tight line-heights (0.80-1.20).

### Icon-only Button
**Role:** Minimal interactive elements.

Ghost White icons, with subtle 1px Ghost White border on hover. Typically 14px size, no background fill.

### Information Block
**Role:** Structural content divider.

Implicit structure using large vertical gaps (200px) between content, with no visible borders, backgrounds, or shadows to define sections. Content is centered within the Midnight Void canvas.

## Do's and Don'ts

### Do

### Don't

## Imagery

No imagery is present aside from simple UI icons. The visual language is pure interface, relying entirely on typography, color contrast, and extreme spacing. Icons are minimal, outlined, and monochromatic (Ghost White). The design is completely text-dominant with no decorative visual elements.

## Layout

The page uses a maximum content width of 1026px, with content centered. The hero section is full-bleed black with minimal, centered text. Sections are primarily defined by generous 200px vertical gaps and seamless full-bleed 'Midnight Void' backgrounds, leading to a very spacious and un-crowded experience. Content generally appears as centered text blocks or very simple conceptual clusters. There is a sticky top navigation that appears as text-only links.

## Agent Prompt Guide

Quick Color Reference: text: #ffffff, background: #000000, border: #ffffff, accent: no distinct accent color, primary action: no distinct CTA color

Example Component Prompts:
1. Create a minimal navigation item: Barlow weight 400, 14px size, lineHeight 1.0, letter-spacing 0.3em, color #ffffff.
2. Create a main body paragraph: Barlow weight 400, 15px size, lineHeight 0.9, letter-spacing 0.3em, color #ffffff.
3. Create a small informational label: Barlow weight 300, 10px size, lineHeight 1.6, letter-spacing 0.1em, color #bbbab2.
4. Design a page section with a 200px top margin and a 1px #ffffff border at the bottom, containing centered text.

## Similar Brands

- **Awwwards-winning portfolio sites (some)** — Stark black backgrounds, minimal text, and high contrast for dramatic effect.
- **Some conceptual art galleries** — Focus on content through absence of decorative UI, using ample empty space.
- **Terminal Mode UIs** — Text-heavy, fixed-width, and monochromatic aesthetic.

## Quick Start

### CSS Custom Properties

```css
:root {
  /* Colors */
  --color-midnight-void: #000000;
  --color-ghost-white: #ffffff;
  --color-cinder-gray: #bbbab2;
  --color-warning-red: #ff0000;

  /* Typography — Font Families */
  --font-barlow: 'Barlow', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

  /* Typography — Scale */
  --text-caption: 10px;
  --leading-caption: 1;
  --text-body-sm: 12px;
  --leading-body-sm: 1;
  --text-body: 13px;
  --leading-body: 1;
  --text-body-lg: 14px;
  --leading-body-lg: 1;
  --text-heading-sm: 15px;
  --leading-heading-sm: 1;
  --text-heading: 18px;
  --leading-heading: 1;

  /* Typography — Weights */
  --font-weight-light: 300;
  --font-weight-regular: 400;

  /* Spacing */
  --spacing-unit: 8px;
  --spacing-200: 200px;

  /* Layout */
  --page-max-width: 1026px;
  --section-gap: 200px;
  --card-padding: 24px;
  --element-gap: 1px;

  /* Named Radii */
  --radius-none: 0px;
}
```

### Tailwind v4

```css
@theme {
  /* Colors */
  --color-midnight-void: #000000;
  --color-ghost-white: #ffffff;
  --color-cinder-gray: #bbbab2;
  --color-warning-red: #ff0000;

  /* Typography */
  --font-barlow: 'Barlow', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

  /* Typography — Scale */
  --text-caption: 10px;
  --leading-caption: 1;
  --text-body-sm: 12px;
  --leading-body-sm: 1;
  --text-body: 13px;
  --leading-body: 1;
  --text-body-lg: 14px;
  --leading-body-lg: 1;
  --text-heading-sm: 15px;
  --leading-heading-sm: 1;
  --text-heading: 18px;
  --leading-heading: 1;

  /* Spacing */
  --spacing-200: 200px;
}
```
