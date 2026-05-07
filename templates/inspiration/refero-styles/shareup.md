# Shareup — Style Reference
> White canvas, charcoal directness

**Theme:** light

Shareup uses a pristine, light-themed aesthetic with a focus on clear hierarchy and functional elements. Surfaces are predominantly white and soft off-white, contrasted by a dominant dark charcoal for text and interactive elements. Subtle rounding on cards and buttons creates a friendly, approachable feel, while dark, high-contrast typography ensures direct communication. The visual system prioritizes uncluttered layouts and direct interaction over decorative flourish.

## Tokens — Colors

| Name | Value | Token | Role |
|------|-------|-------|------|
| Canvas White | `#ffffff` | `--color-canvas-white` | Button text, accent icons, decorative fills |
| Charcoal | `#1d212b` | `--color-charcoal` | Primary text, headings, prominent icons, button backgrounds |
| Fog Gray | `#f0effb` | `--color-fog-gray` | Card backgrounds, secondary surface |
| Platinum Border | `#e5e7eb` | `--color-platinum-border` | Hairline borders, dividers, subtle outlines around elements like cards or in outlines for ghost buttons |
| Muted Stone | `#6a7181` | `--color-muted-stone` | Secondary body text, supporting icons, navigation links |

## Tokens — Typography

### Inter — The primary typeface for all text content. Its clean, modern lines support the system's direct clarity. Varying weights establish clear hierarchy for headings, body, and functional text. · `--font-inter`
- **Substitute:** system-ui, sans-serif
- **Weights:** 400, 500, 600, 700
- **Sizes:** 14px, 16px, 18px, 20px, 30px, 36px, 60px
- **Line height:** 1.00, 1.11, 1.20, 1.40, 1.43, 1.50, 1.56, 1.63
- **Letter spacing:** -0.025em for large headlines (60px), 0.050em for small text (14px). Normal tracking for other sizes.
- **Role:** The primary typeface for all text content. Its clean, modern lines support the system's direct clarity. Varying weights establish clear hierarchy for headings, body, and functional text.

### Type Scale

| Role | Size | Line Height | Letter Spacing | Token |
|------|------|-------------|----------------|-------|
| caption | 14px | 1.56 | 0.05px | `--text-caption` |
| body | 16px | 1.5 | — | `--text-body` |
| subheading | 18px | 1.43 | — | `--text-subheading` |
| heading-sm | 20px | 1.4 | — | `--text-heading-sm` |
| heading | 30px | 1.2 | — | `--text-heading` |
| heading-lg | 36px | 1.11 | — | `--text-heading-lg` |
| display | 60px | 1 | -0.6px | `--text-display` |

## Tokens — Spacing & Shapes

**Base unit:** 8px

**Density:** comfortable

### Spacing Scale

| Name | Value | Token |
|------|-------|-------|
| 8 | 8px | `--spacing-8` |
| 16 | 16px | `--spacing-16` |
| 24 | 24px | `--spacing-24` |
| 32 | 32px | `--spacing-32` |
| 40 | 40px | `--spacing-40` |
| 48 | 48px | `--spacing-48` |
| 64 | 64px | `--spacing-64` |

### Border Radius

| Element | Value |
|---------|-------|
| cards | 16px |
| links | 12px |
| buttons | 12px |

### Layout

- **Page max-width:** 1400px
- **Section gap:** 64px
- **Card padding:** 48px
- **Element gap:** 24px

## Components

### Primary Action Button
**Role:** Call to action button for primary actions.

Solid Charcoal background with Canvas White text (Inter, weight 400). Padding is 12px vertical, 24px horizontal. Rounded corners at 12px. The text includes a slight arrow ('→').

### Feature Card
**Role:** Container for product features or highlights.

Uses a Fog Gray background with a large 16px border-radius. Internal padding is 48px on all sides. No visible shadow. Content inside typically includes a heading, body text, and potentially an action.

## Do's and Don'ts

### Do
- Use Charcoal (#1d212b) for all primary text and headings to ensure high contrast.
- Apply Platinum Border (#e5e7eb) for subtle dividers, borders, and outlines, maintaining a clean aesthetic.
- Utilize a 12px border-radius for all interactive elements like buttons and links.
- Maintain a clear vertical rhythm with a 64px section gap between major content blocks.
- Use Inter font at 60px with a -0.025em letter-spacing for prominent display headlines to create a sophisticated, slightly compressed look.
- Employ Fog Gray (#f0effb) as the background for cards and secondary content blocks.
- Prioritize text content, making elements like buttons and cards functional containers rather than decorative focal points.

### Don't
- Avoid decorative shadows; elevation is primarily achieved through background color shifts.
- Do not introduce highly saturated or vibrant colors outside of specific icon or brand imagery. Stick to the established neutral palette.
- Do not use generic padding or spacing values; adhere to the 8px base unit with increments like 24px, 48px, and 64px.
- Avoid complex gradients or patterned backgrounds; keep surfaces clean and monochromatic.
- Do not use letter-spacing on body text unless specifically for small font sizes (14px at 0.050em) or larger display text.
- Do not place borders on cards or primary interface elements unless using the Platinum Border for separation.
- Do not use multiple font families; Inter is the sole typeface.

## Surfaces

| Level | Name | Value | Purpose |
|-------|------|-------|---------|
| 1 | Canvas White | `#ffffff` | Primary page background and default canvas. |
| 2 | Fog Gray | `#f0effb` | Elevated surfaces such as feature cards or distinct content blocks. |

## Imagery

This design system uses minimal, functional imagery. Icons are outlined or filled, primarily in Charcoal, with occasional accents in a vivid but contained brand color (evidenced by one-off icon color but not a core UI accent). Photography or illustrations are absent from core product UI, focusing instead on stark typography and clean surfaces to convey information. When present, images are contained, not full-bleed, and serve an explanatory or decorative role rather than a central content role.

## Layout

The page adheres to a max-width of 1400px and is centered. The hero section features a centered headline and body text, with significant top and bottom padding (112px/64px respectively). Content sections employ consistent vertical spacing (64px section gap). The general pattern is a vertical stack of content blocks, featuring elements like 100% width prompt-style cards. Navigation, when present, appears as minimal text links often in the footer, indicating a less complex, content-focused site structure.

## Agent Prompt Guide

Quick Color Reference:
text: #1d212b
background: #ffffff
border: #e5e7eb
accent: no distinct accent color
primary action: no distinct CTA color

Example Component Prompts:
Create a hero section: Canvas White background. Heading 'People and technology, together' at 60px Inter weight 700 letterSpacing -0.6px, Charcoal color. Primary body text 'We started Shareup...' at 18px Inter weight 400, Muted Stone color. Section padded 112px top, 64px bottom.
No distinct primary action color was observed; use the extracted neutral button treatments instead of inventing a filled CTA color.
Create a navigation link: 'Terms' at 16px Inter weight 400, Muted Stone color. An 8px element gap separates individual links.

## Similar Brands

- **Linear** — Clean, high-contrast dark text on light backgrounds, strong typography for clear communication, and functional component design.
- **Supabase** — Monochrome UI with strong emphasis on typography, high-contrast text, and subtle card-based layouts.
- **Vercel** — Focus on developer tools, using a primarily neutral palette with sharp text and clear hierarchy.
- **Raycast** — Minimalist design with strong emphasis on type, high contrast elements, and a clean, command-line utility aesthetic.

## Quick Start

### CSS Custom Properties

```css
:root {
  /* Colors */
  --color-canvas-white: #ffffff;
  --color-charcoal: #1d212b;
  --color-fog-gray: #f0effb;
  --color-platinum-border: #e5e7eb;
  --color-muted-stone: #6a7181;

  /* Typography — Font Families */
  --font-inter: 'Inter', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

  /* Typography — Scale */
  --text-caption: 14px;
  --leading-caption: 1.56;
  --tracking-caption: 0.05px;
  --text-body: 16px;
  --leading-body: 1.5;
  --text-subheading: 18px;
  --leading-subheading: 1.43;
  --text-heading-sm: 20px;
  --leading-heading-sm: 1.4;
  --text-heading: 30px;
  --leading-heading: 1.2;
  --text-heading-lg: 36px;
  --leading-heading-lg: 1.11;
  --text-display: 60px;
  --leading-display: 1;
  --tracking-display: -0.6px;

  /* Typography — Weights */
  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;

  /* Spacing */
  --spacing-unit: 8px;
  --spacing-8: 8px;
  --spacing-16: 16px;
  --spacing-24: 24px;
  --spacing-32: 32px;
  --spacing-40: 40px;
  --spacing-48: 48px;
  --spacing-64: 64px;

  /* Layout */
  --page-max-width: 1400px;
  --section-gap: 64px;
  --card-padding: 48px;
  --element-gap: 24px;

  /* Border Radius */
  --radius-xl: 12px;
  --radius-2xl: 16px;

  /* Named Radii */
  --radius-cards: 16px;
  --radius-links: 12px;
  --radius-buttons: 12px;

  /* Surfaces */
  --surface-canvas-white: #ffffff;
  --surface-fog-gray: #f0effb;
}
```

### Tailwind v4

```css
@theme {
  /* Colors */
  --color-canvas-white: #ffffff;
  --color-charcoal: #1d212b;
  --color-fog-gray: #f0effb;
  --color-platinum-border: #e5e7eb;
  --color-muted-stone: #6a7181;

  /* Typography */
  --font-inter: 'Inter', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

  /* Typography — Scale */
  --text-caption: 14px;
  --leading-caption: 1.56;
  --tracking-caption: 0.05px;
  --text-body: 16px;
  --leading-body: 1.5;
  --text-subheading: 18px;
  --leading-subheading: 1.43;
  --text-heading-sm: 20px;
  --leading-heading-sm: 1.4;
  --text-heading: 30px;
  --leading-heading: 1.2;
  --text-heading-lg: 36px;
  --leading-heading-lg: 1.11;
  --text-display: 60px;
  --leading-display: 1;
  --tracking-display: -0.6px;

  /* Spacing */
  --spacing-8: 8px;
  --spacing-16: 16px;
  --spacing-24: 24px;
  --spacing-32: 32px;
  --spacing-40: 40px;
  --spacing-48: 48px;
  --spacing-64: 64px;

  /* Border Radius */
  --radius-xl: 12px;
  --radius-2xl: 16px;
}
```
