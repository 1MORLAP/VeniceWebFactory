# Alec Babala — Style Reference
> Midnight Digital Blueprint — a deeply saturated cobalt canvas meticulously laid out with crisp white and subtle gray text.

**Theme:** dark

Alec Babala's design language is a 'Midnight Digital Blueprint', characterized by a singular, intense cobalt blue dominating the canvas. Text and interactive elements are rendered in stark white or subtly muted gray, creating high contrast and immediate focus. The system embraces a minimalist, high-density layout where content takes precedence, organized with subtle visual cues rather than heavy ornamentation. This creates a functional, almost stark, digital workspace feel.

## Tokens — Colors

| Name | Value | Token | Role |
|------|-------|-------|------|
| Midnight Cobalt | `#194ae9` | `--color-midnight-cobalt` | Page background, primary canvas, background for interactive elements |
| Ghost White | `#ffffff` | `--color-ghost-white` | Primary text on dark backgrounds, active states |
| Dark Void | `#000000` | `--color-dark-void` | Dark borders and separators for elevated surfaces and inverted UI. Do not promote it to the primary CTA color |
| Subtle Violet | `#bfccf9` | `--color-subtle-violet` | Outlined interactive element borders, muted text |

## Tokens — Typography

### ui-sans-serif — Primary text across all body and interactive elements due to the limited typographic scale. Its neutrality lets the bold color palette speak louder than extensive font variations. Size 16px is used widely. · `--font-ui-sans-serif`
- **Substitute:** system-ui, sans-serif
- **Weights:** 400
- **Sizes:** 16px
- **Line height:** 1.20
- **Role:** Primary text across all body and interactive elements due to the limited typographic scale. Its neutrality lets the bold color palette speak louder than extensive font variations. Size 16px is used widely.

## Tokens — Spacing & Shapes

**Base unit:** 8px

**Density:** comfortable

### Spacing Scale

| Name | Value | Token |
|------|-------|-------|
| 6 | 6px | `--spacing-6` |
| 8 | 8px | `--spacing-8` |
| 10 | 10px | `--spacing-10` |
| 24 | 24px | `--spacing-24` |
| 55 | 55px | `--spacing-55` |
| 62 | 62px | `--spacing-62` |
| 64 | 64px | `--spacing-64` |
| 82 | 82px | `--spacing-82` |
| 96 | 96px | `--spacing-96` |

### Border Radius

| Element | Value |
|---------|-------|
| none | 0px |

### Layout

- **Page max-width:** 600px
- **Section gap:** 24px
- **Card padding:** 8px
- **Element gap:** 8px

## Components

### Interactive Card
**Role:** Informational cards that link to content, acting as secondary navigation.

A rectangle with a Midnight Cobalt background (#194ae9), a Dark Void border (#000000), and Ghost White text (#ffffff). The body text is styled with Subtle Violet (#bfccf9).

### Outlined Link Block
**Role:** Content previews for articles or projects, featuring an image and text.

A block with a Midnight Cobalt background (#194ae9) and a Subtle Violet border (#bfccf9). Text is Ghost White (#ffffff), and supplementary text is Subtle Violet (#bfccf9). These blocks appear to respond to hover states with background fills.

### Primary Navigation Text Link
**Role:** Top-level textual links for site navigation.

Ghost White text (#ffffff) on the Midnight Cobalt background, using ui-sans-serif, weight 400, 16px size, with 1.2 lh. No underline, relying on color contrast for prominence.

### Image Grid Item
**Role:** Visual content showcase within grid layouts.

Images contained within a Dark Void border (#000000) against the Midnight Cobalt page background.

## Do's and Don'ts

### Do
- Use Midnight Cobalt (#194ae9) as the dominant background color for all primary canvas areas.
- Employ Ghost White (#ffffff) for all main textual content and active link states.
- Define interactive component borders using Dark Void (#000000) or Subtle Violet (#bfccf9) to create subtle divisions.
- Maintain a tight typographic scale using ui-sans-serif at 16px, weight 400 for all textual elements, overriding browser defaults.
- Structure content within a max-width of 600px, centered on the page for a focused reading experience.
- Separate sections with a vertical gap of 24px and use 8px for internal element spacing within components.
- Utilize Ghost White (#ffffff) for hover states on interactive links against the Midnight Cobalt background.

### Don't
- Avoid introducing additional saturated colors; maintain the strictly monochrome + cobalt palette.
- Do not use different font families or weights beyond ui-sans-serif 400.
- Refrain from using drop shadows or complex graphical elements; rely on color and spacing for visual hierarchy.
- Do not vary font sizes significantly; keep the visual density consistent.
- Avoid using outlines or borders on elements that are not interactive or structural.
- Do not use gradients; the system relies on solid color blocks.
- Never justify text alignment; keep all text left-aligned.

## Imagery

This design system is image-heavy, utilizing square or rectangular photographic cells treated with a strong blue monochrome filter. The images are contained within subtle borders, not overlapping, and appear as embedded content rather than decorative backgrounds. They function as visual anchors and content previews, contributing to the high-density information display. The icon style is minimal and text-based, blending seamlessly with the typographic focus rather than standing out as distinct graphical elements.

## Layout

The page adheres to a centered, max-width 600px layout, appearing as a content column on the wide cobalt blue canvas. The hero section is minimal, simply displaying the brand name. Content is arranged in compact, text-dominant blocks, occasionally interspersed with 2-column grids of monochrome images. Vertical spacing is consistent between sections (24px) but tighter within content groups (8px), creating a focused, high-information density. Navigation is implied through textual links rather than a distinct header bar, with a persistent 'Alec Babala' brand identity at the top.

## Agent Prompt Guide

Quick Color Reference:
text: #ffffff
background: #194ae9
border: #000000
accent: #bfccf9
primary action: #bfccf9 (outlined action border)

Example Component Prompts:
Create an 'Interactive Card' with 'The story of my last name' as the title and 'new_wip, February 2026' as the subtitle. It should have a Midnight Cobalt background (#194ae9), a Dark Void border (#000000), Ghost White text for the title, and Subtle Violet text (#bfccf9) for the subtitle. Use ui-sans-serif, 16px, 400 weight.
Create an 'Outlined Link Block' with a square image on the left and text content 'i’m turning 34. do i bike up another hill? new_wip, July 2025' on the right. The block should have a Midnight Cobalt background (#194ae9), a Subtle Violet border (#bfccf9), and use Ghost White text (#ffffff) for the main title and Subtle Violet (#bfccf9) for the descriptive text. The image should be borderless against the background with no radius.
Create an Outlined Primary Action: Transparent background, #bfccf9 border and text, 9999px radius, compact pill padding. Use it for the main CTA instead of a filled button.

## Similar Brands

- **Figma** — Monochromatic focus with a single strong accent color, flat UI elements.
- **Stripe** — Minimalist typography, strong use of white space offset by distinct UI elements, but in a a darker context here.
- **Linear** — High information density, use of outlines and subtle background shifts for interactive elements, dark theme.

## Quick Start

### CSS Custom Properties

```css
:root {
  /* Colors */
  --color-midnight-cobalt: #194ae9;
  --color-ghost-white: #ffffff;
  --color-dark-void: #000000;
  --color-subtle-violet: #bfccf9;

  /* Typography — Font Families */
  --font-ui-sans-serif: 'ui-sans-serif', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

  /* Typography — Scale */
  --text-base: 16px;
  --leading-base: 1.2;

  /* Typography — Weights */
  --font-weight-regular: 400;

  /* Spacing */
  --spacing-unit: 8px;
  --spacing-6: 6px;
  --spacing-8: 8px;
  --spacing-10: 10px;
  --spacing-24: 24px;
  --spacing-55: 55px;
  --spacing-62: 62px;
  --spacing-64: 64px;
  --spacing-82: 82px;
  --spacing-96: 96px;

  /* Layout */
  --page-max-width: 600px;
  --section-gap: 24px;
  --card-padding: 8px;
  --element-gap: 8px;

  /* Named Radii */
  --radius-none: 0px;
}
```

### Tailwind v4

```css
@theme {
  /* Colors */
  --color-midnight-cobalt: #194ae9;
  --color-ghost-white: #ffffff;
  --color-dark-void: #000000;
  --color-subtle-violet: #bfccf9;

  /* Typography */
  --font-ui-sans-serif: 'ui-sans-serif', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

  /* Typography — Scale */
  --text-base: 16px;
  --leading-base: 1.2;

  /* Spacing */
  --spacing-6: 6px;
  --spacing-8: 8px;
  --spacing-10: 10px;
  --spacing-24: 24px;
  --spacing-55: 55px;
  --spacing-62: 62px;
  --spacing-64: 64px;
  --spacing-82: 82px;
  --spacing-96: 96px;
}
```
