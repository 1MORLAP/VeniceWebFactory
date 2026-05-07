# Orderandmovement — Style Reference
> Monochromatic gallery exhibit.

**Theme:** light

Orderandmovement adopts a stark, high-contrast, minimalist aesthetic, evoking a gallery or exhibition space. The design relies heavily on monochromatic tones, primarily black text and lines on a white canvas, creating a clear and direct presentation. Typography is a focal point, using a unique serif font for subtle sophistication and a custom sans-serif for functional elements. Spacing is generous, creating breathing room around elements, emphasizing content through isolation.

## Tokens — Colors

| Name | Value | Token | Role |
|------|-------|-------|------|
| Canvas White | `#ffffff` | `--color-canvas-white` | Page backgrounds, heading backgrounds, primary canvases. Creates a blank, expansive backdrop for content |
| Gallery Black | `#000000` | `--color-gallery-black` | Neutral form states, badge text, and quiet UI feedback where color should stay understated. Do not promote it to the primary CTA color |

## Tokens — Typography

### Suisse Intl — Primary UI text for navigation, body content, and descriptive elements. Its subtle character provides a modern, functional voice. · `--font-suisse-intl`
- **Substitute:** Arial
- **Weights:** 400
- **Sizes:** 14px, 16px, 24px
- **Line height:** 1.00, 1.20
- **Letter spacing:** 0.5000em
- **Role:** Primary UI text for navigation, body content, and descriptive elements. Its subtle character provides a modern, functional voice.

### Times New Roman — Headlines and prominent text, providing a classic counterpoint to the sans-serif for emphasis and a sense of permanence. · `--font-times-new-roman`
- **Substitute:** serif
- **Weights:** 400
- **Sizes:** 12px, 14px, 24px
- **Line height:** 1.00, 1.20
- **Letter spacing:** normal
- **Role:** Headlines and prominent text, providing a classic counterpoint to the sans-serif for emphasis and a sense of permanence.

### Type Scale

| Role | Size | Line Height | Letter Spacing | Token |
|------|------|-------------|----------------|-------|
| caption | 14px | 1.2 | — | `--text-caption` |
| body-sm | 16px | 1.2 | — | `--text-body-sm` |
| body | 24px | 1.2 | — | `--text-body` |

## Tokens — Spacing & Shapes

**Base unit:** 8px

**Density:** spacious

### Spacing Scale

| Name | Value | Token |
|------|-------|-------|
| 4 | 4px | `--spacing-4` |
| 5 | 5px | `--spacing-5` |
| 12 | 12px | `--spacing-12` |
| 20 | 20px | `--spacing-20` |
| 21 | 21px | `--spacing-21` |
| 28 | 28px | `--spacing-28` |
| 36 | 36px | `--spacing-36` |
| 60 | 60px | `--spacing-60` |
| 72 | 72px | `--spacing-72` |
| 144 | 144px | `--spacing-144` |

### Border Radius

| Element | Value |
|---------|-------|
| none | 0px |

### Layout

- **Page max-width:** 900px
- **Section gap:** 72px
- **Element gap:** 5px

## Components

### Ghost Button
**Role:** Interactive elements, often for navigation or secondary actions, maintaining the minimalist aesthetic.

Transparent background, black text (#000000), 0px border-radius, 0px padding. Uses Suisse Intl 400 for text.

### Text Input
**Role:** Form fields for user input.

Transparent background, black text (#000000), 0px border-radius, 5px padding on all sides. Uses Times New Roman 400 for text.

## Do's and Don'ts

### Do
- Prioritize Canvas White (#ffffff) as the dominant background color for all main sections and content areas.
- Use Gallery Black (#000000) for all primary text, borders, and interactive element outlines.
- Apply 'Suisse Intl' 400 with a 0.5000em letter-spacing for all navigation items, body text, and links.
- Employ generously wide padding for sections, with 72px for vertical separation and 144px for horizontal content margins in 'other' contexts.
- Maintain a strict 0px border-radius across all components to reinforce the sharp, angular aesthetic.
- Limit interactive feedback animations to color, opacity, or transform, using an 'ease' timing function for a moderate feel.

### Don't
- Avoid using any colored backgrounds or accent colors; restrict the palette to #000000 and #ffffff.
- Do not introduce shadows or elevation effects; surfaces should remain flat against the canvas.
- Never use rounded corners on any element; all borders and containers must be sharp 0px radius.
- Do not deviate from the specified Suisse Intl letter-spacing of 0.5000em for main UI text; tighter tracking conflicts with brand identity.
- Avoid dense information blocks; use generous spacing (72px section gaps, 144px side padding) to create visual calm.
- Do not use generic system fonts for primary text; 'Suisse Intl' and 'Times New Roman' are integral to the brand's typographic hierarchy and feel.

## Surfaces

| Level | Name | Value | Purpose |
|-------|------|-------|---------|
| 0 | Canvas White | `#ffffff` | Dominant page background and general content area. Forms the base layer of the interface. |
| 1 | Gallery Black | `#000000` | Used sparingly as background for UI elements, contrasting sharply with the white canvas to draw attention. |

## Imagery

No imagery is used as content; the design system is purely UI-focused. The aesthetic conveys information through stark typography and negative space, similar to a museum label or a minimalist art catalog.

## Layout

The page primarily uses a max-width contained layout of 900px, centered on the screen. The hero section is characterized by large, centered headlines using 'Times New Roman' against a white background. Sections are delineated by generous vertical spacing (72px) rather than explicit dividers, creating a seamless flow. Content frequently appears in two-column structures or as centered text blocks. Navigation is typically thin and minimal, appearing at the top or side, often as flat lists of links.

## Agent Prompt Guide

Quick Color Reference:
text: #000000
background: #ffffff
border: #000000
accent: no distinct accent color
primary action: no distinct CTA color

Example Component Prompts:
1. Create a top navigation bar: Canvas White background, Gallery Black text at 16px Suisse Intl 400, letter-spacing 0.5em, with 60px vertical padding. Highlight active links with a 1px solid Gallery Black bottom border.
2. Design a primary content section: Canvas White background, centered within a 900px max-width container, using 144px horizontal padding. Display a heading 'Paintings' using Times New Roman 400 at 24px, followed by a paragraph of body text 'MEMORIE DI UN FUMATORE' in Suisse Intl 400 at 14px, letter-spacing 0.5em, with 21px `marginTop` between the headline and body.
3. Implement a Ghost Button: 'Contact' text in Gallery Black (#000000), Suisse Intl 400 at 14px, letter-spacing 0.5em, with a transparent background and 0px padding. Ensure a 1px Gallery Black (#000000) border on hover state.

## Similar Brands

- **A.P.C.** — Both brands utilize a stark, monochromatic palette and minimalist typography, emphasizing content through negative space and a clean, gallery-like presentation.
- **The Row** — Shares a precise, almost austere aesthetic with a focus on high-quality typography and a limited color palette to convey luxury and sophistication without overt decoration.
- **COS** — Employs an uncluttered layout, generous white space, and a restrained color scheme, featuring prominent sans-serif typography for a crisp, modern feel.
- **Figma (old website, pre-2023 rebrand)** — Similar reliance on strong black-on-white contrast, dense, functional sans-serif typography, and clear visual hierarchy without heavy graphics or textures.
- **Galeries Lafayette (certain campaign imagery)** — Captures a similar high-fashion, art-direction sensibility with a clean white backdrop, sharp lines, and a focus on statement-making typography.

## Quick Start

### CSS Custom Properties

```css
:root {
  /* Colors */
  --color-canvas-white: #ffffff;
  --color-gallery-black: #000000;

  /* Typography — Font Families */
  --font-suisse-intl: 'Suisse Intl', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-times-new-roman: 'Times New Roman', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

  /* Typography — Scale */
  --text-caption: 14px;
  --leading-caption: 1.2;
  --text-body-sm: 16px;
  --leading-body-sm: 1.2;
  --text-body: 24px;
  --leading-body: 1.2;

  /* Typography — Weights */
  --font-weight-regular: 400;

  /* Spacing */
  --spacing-unit: 8px;
  --spacing-4: 4px;
  --spacing-5: 5px;
  --spacing-12: 12px;
  --spacing-20: 20px;
  --spacing-21: 21px;
  --spacing-28: 28px;
  --spacing-36: 36px;
  --spacing-60: 60px;
  --spacing-72: 72px;
  --spacing-144: 144px;

  /* Layout */
  --page-max-width: 900px;
  --section-gap: 72px;
  --element-gap: 5px;

  /* Named Radii */
  --radius-none: 0px;

  /* Surfaces */
  --surface-canvas-white: #ffffff;
  --surface-gallery-black: #000000;
}
```

### Tailwind v4

```css
@theme {
  /* Colors */
  --color-canvas-white: #ffffff;
  --color-gallery-black: #000000;

  /* Typography */
  --font-suisse-intl: 'Suisse Intl', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-times-new-roman: 'Times New Roman', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

  /* Typography — Scale */
  --text-caption: 14px;
  --leading-caption: 1.2;
  --text-body-sm: 16px;
  --leading-body-sm: 1.2;
  --text-body: 24px;
  --leading-body: 1.2;

  /* Spacing */
  --spacing-4: 4px;
  --spacing-5: 5px;
  --spacing-12: 12px;
  --spacing-20: 20px;
  --spacing-21: 21px;
  --spacing-28: 28px;
  --spacing-36: 36px;
  --spacing-60: 60px;
  --spacing-72: 72px;
  --spacing-144: 144px;
}
```
