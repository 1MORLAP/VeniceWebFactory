# Bryn Taylor — Style Reference
> Architectural blueprint on white marble.

**Theme:** light

Bryn Taylor's design system is a monochrome, content-first experience, akin to a meticulous architect's portfolio. Its character emerges from sharp typographic forms against subtle, almost imperceptible greys. Interactivity is defined by a deep ink-black paired with crisp white, creating a high-contrast focal point for user actions. The visual system prioritizes clarity and directness, using minimal adornment and robust typography to convey expertise.

## Tokens — Colors

| Name | Value | Token | Role |
|------|-------|-------|------|
| Midnight Ink | `#000000` | `--color-midnight-ink` | Primary text, headings, button backgrounds, outline borders for ghost components, active state indicators. It signifies action and primary information |
| Canvas White | `#eff0fc` | `--color-canvas-white` | Main page background, providing a clean, almost off-white canvas for content |
| Surface Frost | `#ffffff` | `--color-surface-frost` | Card backgrounds, input fills, and text on Midnight Ink backgrounds. It serves as a secondary background and prominent foreground text color |
| Muted Ash | `#575757` | `--color-muted-ash` | Secondary text, weaker borders, and subtle descriptive elements |
| Ghost Tint | `#0000000a` | `--color-ghost-tint` | Subtle background for ghost button hovers and soft dividers |
| Faint Grey | `#00000014` | `--color-faint-grey` | Lighter borders, very subtle surface tint for background elements |
| Line Grey | `#0000001f` | `--color-line-grey` | Hairline borders and separators, slightly stronger than Faint Grey |

## Tokens — Typography

### Neue Montreal — The sole typeface, Neue Montreal, carries the entire visual voice. Its clean, geometric forms provide a confident, no-nonsense readability for all content, from large commanding headlines to detailed body text. The tight line heights, especially for larger sizes, reinforce a compact and efficient presentation. · `--font-neue-montreal`
- **Substitute:** Inter
- **Weights:** 400, 500
- **Sizes:** 12px, 14px, 15px, 16px, 17px, 18px, 20px, 24px, 28px, 30px, 56px, 80px
- **Line height:** 1.05, 1.10, 1.20, 1.35, 1.40, 1.50, 1.60, 1.63
- **Letter spacing:** 0.0010em (for small text), 0.0060em, 0.0080em, 0.0100em, 0.0140em, 0.0150em, 0.0200em, 0.0250em, 0.0300em (for large displays)
- **Role:** The sole typeface, Neue Montreal, carries the entire visual voice. Its clean, geometric forms provide a confident, no-nonsense readability for all content, from large commanding headlines to detailed body text. The tight line heights, especially for larger sizes, reinforce a compact and efficient presentation.

### Type Scale

| Role | Size | Line Height | Letter Spacing | Token |
|------|------|-------------|----------------|-------|
| caption | 12px | 1.5 | 0.001px | `--text-caption` |
| body-sm | 14px | 1.6 | 0.001px | `--text-body-sm` |
| body | 16px | 1.6 | 0.006px | `--text-body` |
| subheading | 24px | 1.35 | 0.015px | `--text-subheading` |
| heading | 30px | 1.2 | 0.015px | `--text-heading` |
| heading-lg | 56px | 1.1 | 0.025px | `--text-heading-lg` |
| display | 80px | 1.05 | 0.03px | `--text-display` |

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
| 48 | 48px | `--spacing-48` |
| 56 | 56px | `--spacing-56` |
| 64 | 64px | `--spacing-64` |
| 80 | 80px | `--spacing-80` |
| 96 | 96px | `--spacing-96` |
| 112 | 112px | `--spacing-112` |
| 160 | 160px | `--spacing-160` |

### Border Radius

| Element | Value |
|---------|-------|
| none | 0px |
| badge | 12px |
| cards | 12px |
| small | 8px |
| buttons | 1.67772e+07px |

### Shadows

| Name | Value | Token |
|------|-------|-------|
| subtle | `rgba(0, 0, 0, 0.08) 0px -2px 0px 0px inset` | `--shadow-subtle` |
| subtle-2 | `rgba(0, 0, 0, 0.08) 0px -3px 0px 0px inset` | `--shadow-subtle-2` |
| subtle-3 | `rgba(0, 0, 0, 0.08) 0px -3.5px 0px 0px inset` | `--shadow-subtle-3` |

### Layout

- **Section gap:** 32px
- **Card padding:** 24px
- **Element gap:** 16px

## Components

### Filled Primary Button
**Role:** Call to action button for primary actions.

Background: Midnight Ink (#000000). Text: Surface Frost (#ffffff). Border radius: 1.67772e+07px (pill shape). Padding: 0px vertical, 18px horizontal. Uses Neue Montreal.

### Ghost Secondary Button
**Role:** Secondary action button, providing a subtle interactive element.

Background: Ghost Tint (#0000000a), Text: Midnight Ink (#000000). Border radius: 1.67772e+07px (pill shape). Padding: 0px vertical, 18px horizontal. Uses Neue Montreal.

### Card, Accent Background
**Role:** Background for feature blocks or highlighted content sections.

Background: Faint Grey (#00000014). Border radius: 12px. No shadow. No intrinsic padding.

### Card, White Background
**Role:** Standard content card, used within sections.

Background: Surface Frost (#ffffff). Border radius: 12px. No shadow. No intrinsic padding.

### Input Field
**Role:** Text input areas for forms.

Background: Surface Frost (#ffffff). Text: Midnight Ink (#000000). Border: 1px solid Faint Grey (#00000014). Border radius: 12px. Padding: 0px vertical, 23px horizontal. Uses Neue Montreal.

### Badge
**Role:** Small informational tags or labels.

Background: Surface Frost (#ffffff). Text: Midnight Ink (#000000). Border radius: 12px. Padding: 5.6px vertical, 12px horizontal. Uses Neue Montreal.

### Menu Item Highlight
**Role:** Indicator for active navigation items.

Inset shadow: rgba(0, 0, 0, 0.08) 0px -2px 0px 0px. This creates a subtle bottom border for active navigation links.

## Do's and Don'ts

### Do
- Prioritize Neue Montreal for all text content; do not introduce other typefaces.
- Utilize Midnight Ink (#000000) for all primary text, headings, and active elements to maintain strong contrast.
- Apply Canvas White (#eff0fc) as the default background for most content sections.
- Use pill-shaped radii (1.67772e+07px) for all primary and secondary buttons, and 12px for cards and badges.
- Maintain a comfortable density with element gaps of 16px and section gaps of 32px between major content blocks.
- Employ the subtle inset shadow `rgba(0, 0, 0, 0.08) 0px -2px 0px 0px` for active navigation items.
- Introduce Surface Frost (#ffffff) as background for interactive components like inputs and cards, providing a hierarchical distinction from Canvas White.

### Don't
- Avoid using highly saturated colors; the palette is almost entirely achromatic with subtle tints.
- Do not deviate from the specified 'Neue Montreal' typeface, weights, and letter-spacing values.
- Do not use heavy box shadows; elevation is primarily achieved through subtle background color changes or faint inset shadows.
- Avoid large hero imagery; the layout prioritizes text and clean UI elements.
- Do not introduce complex gradient fills; the system relies on solid colors and subtle color differences for depth.
- Do not use generic border radii; adhere to 1.67772e+07px for buttons and 12px for cards/badges.
- Do not use different fonts for headings and body text; the same family with varying sizes and weights is the established pattern.

## Agent Prompt Guide

Quick Color Reference:
text: #000000
background: #eff0fc
border: #0000001f
accent: no distinct accent color
primary action: #000000 (filled action)

Example Component Prompts:
1. Create a primary navigation button: Background Midnight Ink (#000000), text Surface Frost (#ffffff), pill radius (1.67772e+07px), 18px horizontal padding. Font Neue Montreal 16px, weight 500.
2. Design a feature card: Background Faint Grey (#00000014), 12px border radius, no shadow. Headline Neue Montreal 24px, weight 500, Midnight Ink (#000000). Body text Neue Montreal 16px, weight 400, Muted Ash (#575757). Padding 24px.
3. Create a testimonial section: Background Canvas White (#eff0fc). Testimonial block has background Surface Frost (#ffffff), 12px border radius. Quote text Neue Montreal 18px, weight 400, Midnight Ink (#000000). Author text Neue Montreal 14px, weight 500, Midnight Ink (#000000). Element gap 16px.
4. Design a ghost button: Background Ghost Tint (#0000000a), text Midnight Ink (#000000), pill radius (1.67772e+07px), 18px horizontal padding. Font Neue Montreal 16px, weight 500.

## Similar Brands

- **Linear** — Monochromatic interface with a strong focus on minimalist typography and high-contrast interactive elements.
- **Stripe** — Clean, spacious layouts, strong typographic hierarchy, and limited color palette to highlight product features.
- **Superhuman** — Emphasis on efficiency, clean UI, and using dark grays and blacks for primary actions against a light background.
- **Figma** — Interface design with a neutral background, clear component separation, and high-contrast text and action elements.

## Quick Start

### CSS Custom Properties

```css
:root {
  /* Colors */
  --color-midnight-ink: #000000;
  --color-canvas-white: #eff0fc;
  --color-surface-frost: #ffffff;
  --color-muted-ash: #575757;
  --color-ghost-tint: #0000000a;
  --color-faint-grey: #00000014;
  --color-line-grey: #0000001f;

  /* Typography — Font Families */
  --font-neue-montreal: 'Neue Montreal', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

  /* Typography — Scale */
  --text-caption: 12px;
  --leading-caption: 1.5;
  --tracking-caption: 0.001px;
  --text-body-sm: 14px;
  --leading-body-sm: 1.6;
  --tracking-body-sm: 0.001px;
  --text-body: 16px;
  --leading-body: 1.6;
  --tracking-body: 0.006px;
  --text-subheading: 24px;
  --leading-subheading: 1.35;
  --tracking-subheading: 0.015px;
  --text-heading: 30px;
  --leading-heading: 1.2;
  --tracking-heading: 0.015px;
  --text-heading-lg: 56px;
  --leading-heading-lg: 1.1;
  --tracking-heading-lg: 0.025px;
  --text-display: 80px;
  --leading-display: 1.05;
  --tracking-display: 0.03px;

  /* Typography — Weights */
  --font-weight-regular: 400;
  --font-weight-medium: 500;

  /* Spacing */
  --spacing-unit: 8px;
  --spacing-8: 8px;
  --spacing-16: 16px;
  --spacing-24: 24px;
  --spacing-32: 32px;
  --spacing-48: 48px;
  --spacing-56: 56px;
  --spacing-64: 64px;
  --spacing-80: 80px;
  --spacing-96: 96px;
  --spacing-112: 112px;
  --spacing-160: 160px;

  /* Layout */
  --section-gap: 32px;
  --card-padding: 24px;
  --element-gap: 16px;

  /* Border Radius */
  --radius-lg: 8px;
  --radius-xl: 12px;
  --radius-2xl: 16px;
  --radius-full: 1440px;
  --radius-full-2: 1600px;

  /* Named Radii */
  --radius-none: 0px;
  --radius-badge: 12px;
  --radius-cards: 12px;
  --radius-small: 8px;
  --radius-buttons: 1.67772e+07px;

  /* Shadows */
  --shadow-subtle: rgba(0, 0, 0, 0.08) 0px -2px 0px 0px inset;
  --shadow-subtle-2: rgba(0, 0, 0, 0.08) 0px -3px 0px 0px inset;
  --shadow-subtle-3: rgba(0, 0, 0, 0.08) 0px -3.5px 0px 0px inset;
}
```

### Tailwind v4

```css
@theme {
  /* Colors */
  --color-midnight-ink: #000000;
  --color-canvas-white: #eff0fc;
  --color-surface-frost: #ffffff;
  --color-muted-ash: #575757;
  --color-ghost-tint: #0000000a;
  --color-faint-grey: #00000014;
  --color-line-grey: #0000001f;

  /* Typography */
  --font-neue-montreal: 'Neue Montreal', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

  /* Typography — Scale */
  --text-caption: 12px;
  --leading-caption: 1.5;
  --tracking-caption: 0.001px;
  --text-body-sm: 14px;
  --leading-body-sm: 1.6;
  --tracking-body-sm: 0.001px;
  --text-body: 16px;
  --leading-body: 1.6;
  --tracking-body: 0.006px;
  --text-subheading: 24px;
  --leading-subheading: 1.35;
  --tracking-subheading: 0.015px;
  --text-heading: 30px;
  --leading-heading: 1.2;
  --tracking-heading: 0.015px;
  --text-heading-lg: 56px;
  --leading-heading-lg: 1.1;
  --tracking-heading-lg: 0.025px;
  --text-display: 80px;
  --leading-display: 1.05;
  --tracking-display: 0.03px;

  /* Spacing */
  --spacing-8: 8px;
  --spacing-16: 16px;
  --spacing-24: 24px;
  --spacing-32: 32px;
  --spacing-48: 48px;
  --spacing-56: 56px;
  --spacing-64: 64px;
  --spacing-80: 80px;
  --spacing-96: 96px;
  --spacing-112: 112px;
  --spacing-160: 160px;

  /* Border Radius */
  --radius-lg: 8px;
  --radius-xl: 12px;
  --radius-2xl: 16px;
  --radius-full: 1440px;
  --radius-full-2: 1600px;

  /* Shadows */
  --shadow-subtle: rgba(0, 0, 0, 0.08) 0px -2px 0px 0px inset;
  --shadow-subtle-2: rgba(0, 0, 0, 0.08) 0px -3px 0px 0px inset;
  --shadow-subtle-3: rgba(0, 0, 0, 0.08) 0px -3.5px 0px 0px inset;
}
```
