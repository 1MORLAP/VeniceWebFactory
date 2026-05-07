# Mickael Larcheveque — Style Reference
> Parchment and Cobalt

**Theme:** light

Mickael Larcheveque's portfolio establishes an atmosphere of understated elegance and intellectual curiosity. It pairs a warm, almost parchment-like background with a single intense primary blue for highlights and active states, creating a high-contrast but refined visual tension. The typography mixes a modern sans-serif with a more expressive, almost calligraphic display serif for headlines, emphasizing creativity. The layout feels spacious, with clear hierarchy and minimal embellishment.

## Tokens — Colors

| Name | Value | Token | Role |
|------|-------|-------|------|
| Parchment | `#fff6ed` | `--color-parchment` | Page background, primary surface |
| Midnight Charcoal | `#292a2c` | `--color-midnight-charcoal` | Primary body text, borders for most UI elements, subtle dividers |
| Deepest Ink | `#000000` | `--color-deepest-ink` | Strongest text contrast, prominent link text, navigation items |
| Luminous Blue | `#283cff` | `--color-luminous-blue` | Primary accent color for interactive elements, links, and outlines. This vivid blue makes actions feel charged and draws immediate attention |
| Canvas White | `#ffffff` | `--color-canvas-white` | Implicit background for some overlaid elements, very subtle borders |

## Tokens — Typography

### Open Sans — Primary body text, descriptive labels, and general UI. Its neutrality provides a stable foundation for the more expressive display font. · `--font-open-sans`
- **Substitute:** system-ui
- **Weights:** 400
- **Sizes:** 16px, 18px, 22px
- **Line height:** 1.00, 1.67
- **Role:** Primary body text, descriptive labels, and general UI. Its neutrality provides a stable foundation for the more expressive display font.

### Calling Code Regular — Secondary text, navigation items, and helper text. The slightly wider tracking and distinct character give it a subtle, technical personality without being overwhelming. · `--font-calling-code-regular`
- **Substitute:** SF Mono, Monaco, Menlo, Consolas
- **Weights:** 400
- **Sizes:** 16px, 18px
- **Line height:** 1.00, 1.67
- **Letter spacing:** 0.0190em
- **Role:** Secondary text, navigation items, and helper text. The slightly wider tracking and distinct character give it a subtle, technical personality without being overwhelming.

### Gza — Display headlines and hero text. This custom decorative serif brings a unique, artistic flourish, contrasting with the more functional body text. · `--font-gza`
- **Substitute:** Playfair Display
- **Weights:** 400
- **Sizes:** 55px
- **Line height:** 1.00
- **Role:** Display headlines and hero text. This custom decorative serif brings a unique, artistic flourish, contrasting with the more functional body text.

### Type Scale

| Role | Size | Line Height | Letter Spacing | Token |
|------|------|-------------|----------------|-------|
| body | 16px | 1.67 | — | `--text-body` |
| body-lg | 18px | 1.67 | — | `--text-body-lg` |
| subheading | 22px | 1 | — | `--text-subheading` |
| display | 55px | 1 | — | `--text-display` |

## Tokens — Spacing & Shapes

**Density:** compact

### Spacing Scale

| Name | Value | Token |
|------|-------|-------|
| 4 | 4px | `--spacing-4` |
| 5 | 5px | `--spacing-5` |
| 9 | 9px | `--spacing-9` |
| 15 | 15px | `--spacing-15` |
| 30 | 30px | `--spacing-30` |
| 98 | 98px | `--spacing-98` |

### Border Radius

| Element | Value |
|---------|-------|
| default | 0px |

### Layout

- **Page max-width:** 1230px
- **Section gap:** 98px
- **Card padding:** 15px
- **Element gap:** 30px

## Components

### Navigation Link
**Role:** Top-level navigation items.

Text in Calling Code Regular, color Deepest Ink (#000000) or Luminous Blue (#283cff) for active/hover states. Underlined by a 1px Midnight Charcoal (#292a2c) border-bottom on hover, or 1px Luminous Blue (#283cff) for active state. Padding-bottom 4px.

### Primary Link
**Role:** Inline textual links and interactive elements within content.

Luminous Blue (#283cff) text. No explicit underline, color shift is the primary indicator. Padding 5px top/bottom, 9px left/right.

### Hero Headline
**Role:** Large, expressive text for main page titles.

Gza font, 55px size, 400 weight, line-height 1.0, color Luminous Blue (#283cff) for prominent words, and Midnight Charcoal (#292a2c) for outlined words. Normal letter spacing.

### Body Paragraph
**Role:** Standard informational text blocks.

Open Sans font, 16px size, 400 weight, line-height 1.67, color Midnight Charcoal (#292a2c). Top and bottom margin of 30px.

### Logo
**Role:** Brand identity mark.

The 'M' monogram uses Luminous Blue (#283cff) for the letter and may include an outlined box. Placed in the top-left corner, with a 98px margin to the right.

## Do's and Don'ts

### Do
- Prioritize 'Gza' font for all large, expressive headlines to maintain the unique artistic tone.
- Use Luminous Blue (#283cff) exclusively for interactive elements like links, buttons (outlined), and active navigation states.
- Maintain a clear visual hierarchy by contrasting Luminous Blue (#283cff) accents against the Parchment (#fff6ed) background and Midnight Charcoal (#292a2c) text.
- Apply 1px solid borders in Midnight Charcoal (#292a2c) or Luminous Blue (#283cff) for subtle definition of interactive elements or content blocks.
- Ensure generous spacing: a 98px section gap for vertical rhythm and 30px element gaps for internal content separation.
- Use Open Sans (400) for all body copy to ensure legibility and a consistent textual voice at 16px or 18px.
- Outline secondary typographic elements in Midnight Charcoal (#292a2c) or Luminous Blue (#283cff) to provide visual variation without adding new colors.

### Don't
- Avoid introducing new primary colors; the system relies on Parchment (#fff6ed) as background and Luminous Blue (#283cff) as the primary accent.
- Do not use box shadows or excessive border-radius; the design maintains a flat, crisp aesthetic.
- Refrain from using heavily saturated images or illustrations; the visual language leans towards minimalist graphics or outlined typography.
- Do not create filled buttons or primary actions; the design consistently uses outlined or text-based interactive elements.
- Avoid dense, text-heavy sections; break content with generous white space and the distinct typographic hierarchy.
- Do not use default browser link styles; always apply Luminous Blue (#283cff) for links and ensure clear hover states.

## Surfaces

| Level | Name | Value | Purpose |
|-------|------|-------|---------|
| 0 | Parchment Canvas | `#fff6ed` | Dominant page background, providing a warm, inviting canvas. |

## Imagery

The site primarily uses expressive, outlined typography as its main 'imagery'. When visuals are present, they are either abstract graphical elements (like the upward-sweeping arrow) or highly stylized, almost iconographic representations. There is an absence of photography or complex illustrations, keeping the focus on typography and interaction. Iconography, when present, adheres to an outlined, minimalist style. Imagery serves a decorative and illustrative purpose through typographic art, rather than showcasing products or lifestyle.

## Layout

The page operates on a contained layout with a maximum width of 1230px, centered on a Parchment (#fff6ed) background. The hero section features large, expressive outlined typography (Gza font) with Luminous Blue (#283cff) highlights, presented simply against the background. Sections maintain a consistent vertical rhythm with generous 98px gaps, creating ample breathing room. Content arrangement is primarily vertical stacking of typographic elements and links, with clear visual separation. Navigation is a minimalist top-right header with two text links that subtly outline on hover/active, complemented by a simple logo in the top-left.

## Agent Prompt Guide

**Quick Color Reference**
text: #292a2c
background: #fff6ed
border: #292a2c
accent: #283cff
primary action: #283cff (outlined action border)

**3-5 Example Component Prompts**
1. Create a hero section: Parchment background (#fff6ed). Main headline 'Creative' in Gza font 55px (weight 400, color #283cff). Sub-headline 'Studio' in Gza font 55px (weight 400, color #292a2c, outlined style). Below, a brief descriptive paragraph in Open Sans 16px (weight 400, color #292a2c), line-height 1.67.
2. Create a navigation bar: Parchment background (#fff6ed). Nav links 'work' and 'about' in Calling Code Regular 16px (weight 400, color #000000, letter-spacing 0.0190em). On hover, add a 1px bottom border in #292a2c, 4px padding-bottom. Logo (placeholder for 'M') in #283cff on the left.
3. Create a listing item: Text link 'Sailor Moon Handheld Console' in Luminous Blue (#283cff), Open Sans 18px (weight 400). Add a slight hover effect that changes border-color to Luminous Blue (#283cff).

## Similar Brands

- **AIGA Journal** — Minimalist layout, strong typographic focus, and limited but impactful color palette.
- **The New York Times (digital)** — Reliance on a clean, light background with monochrome text and minimal accent colors for links and interactive elements.
- **Frank Digital** — Portfolio site with a distinct typographic voice, high contrast against light backgrounds, and limited color usage to direct attention.

## Quick Start

### CSS Custom Properties

```css
:root {
  /* Colors */
  --color-parchment: #fff6ed;
  --color-midnight-charcoal: #292a2c;
  --color-deepest-ink: #000000;
  --color-luminous-blue: #283cff;
  --color-canvas-white: #ffffff;

  /* Typography — Font Families */
  --font-open-sans: 'Open Sans', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-calling-code-regular: 'Calling Code Regular', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  --font-gza: 'Gza', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

  /* Typography — Scale */
  --text-body: 16px;
  --leading-body: 1.67;
  --text-body-lg: 18px;
  --leading-body-lg: 1.67;
  --text-subheading: 22px;
  --leading-subheading: 1;
  --text-display: 55px;
  --leading-display: 1;

  /* Typography — Weights */
  --font-weight-regular: 400;

  /* Spacing */
  --spacing-4: 4px;
  --spacing-5: 5px;
  --spacing-9: 9px;
  --spacing-15: 15px;
  --spacing-30: 30px;
  --spacing-98: 98px;

  /* Layout */
  --page-max-width: 1230px;
  --section-gap: 98px;
  --card-padding: 15px;
  --element-gap: 30px;

  /* Named Radii */
  --radius-default: 0px;

  /* Surfaces */
  --surface-parchment-canvas: #fff6ed;
}
```

### Tailwind v4

```css
@theme {
  /* Colors */
  --color-parchment: #fff6ed;
  --color-midnight-charcoal: #292a2c;
  --color-deepest-ink: #000000;
  --color-luminous-blue: #283cff;
  --color-canvas-white: #ffffff;

  /* Typography */
  --font-open-sans: 'Open Sans', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-calling-code-regular: 'Calling Code Regular', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  --font-gza: 'Gza', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

  /* Typography — Scale */
  --text-body: 16px;
  --leading-body: 1.67;
  --text-body-lg: 18px;
  --leading-body-lg: 1.67;
  --text-subheading: 22px;
  --leading-subheading: 1;
  --text-display: 55px;
  --leading-display: 1;

  /* Spacing */
  --spacing-4: 4px;
  --spacing-5: 5px;
  --spacing-9: 9px;
  --spacing-15: 15px;
  --spacing-30: 30px;
  --spacing-98: 98px;
}
```
