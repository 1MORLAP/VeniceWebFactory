# Berner Kühl — Style Reference
> monochrome editorial canvas

**Theme:** light

Berner Kühl employs a refined, almost austere visual system, echoing the minimalist aesthetic of high fashion. The design relies on a stark monochrome palette, using deep black typography and thin borders against a pristine white canvas. Absence of color, strong typographic presence with a custom serif font, and precise, measured spacing create an atmosphere of understated luxury and exclusivity, rather than an interactive, feature-rich interface.

## Tokens — Colors

| Name | Value | Token | Role |
|------|-------|-------|------|
| Canvas White | `#ffffff` | `--color-canvas-white` | Page and section backgrounds, pristine card surfaces — a clean, expansive foundation for content |
| Ink Black | `#000000` | `--color-ink-black` | Dark borders and separators for elevated surfaces and inverted UI. Do not promote it to the primary CTA color |
| Ash Gray | `#c8c8c7` | `--color-ash-gray` | Subtle borders for lists and inactive links, providing minimal separation without drawing attention |
| Stone Gray | `#767676` | `--color-stone-gray` | Neutral form states, badge text, and quiet UI feedback where color should stay understated. Do not promote it to the primary CTA color |

## Tokens — Typography

### Gerstner Programm FSL — Primary typeface for all text content, including navigation, body text, and headings. Its distinct serif character and uniform weight lend an air of classic editorial elegance and seriousness. · `--font-gerstner-programm-fsl`
- **Substitute:** Source Serif Pro
- **Weights:** 400
- **Sizes:** 12px, 20px
- **Line height:** 1.15, 1.25
- **Role:** Primary typeface for all text content, including navigation, body text, and headings. Its distinct serif character and uniform weight lend an air of classic editorial elegance and seriousness.

### Type Scale

| Role | Size | Line Height | Letter Spacing | Token |
|------|------|-------------|----------------|-------|
| caption | 12px | 1.15 | — | `--text-caption` |
| body | 20px | 1.25 | — | `--text-body` |

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
| 64 | 64px | `--spacing-64` |
| 128 | 128px | `--spacing-128` |

### Border Radius

| Element | Value |
|---------|-------|
| none | 0px |

### Layout

- **Section gap:** 64px
- **Card padding:** 16px
- **Element gap:** 8px

## Components

### Ghost Button
**Role:** Minimalist interactive element

Transparent background, Ink Black text, no borders or padding, relying on surrounding layout for definition. Used for navigation and secondary actions.

### Primary Sign-Up Button
**Role:** Conversion action

Canvas White background with Ink Black text, a thin 1px Ink Black border, and 8px vertical, 16px horizontal internal padding. Used for newsletter sign-ups and primary calls to action, providing a clear visual target.

### Text Input Field
**Role:** User data entry

Transparent background, Ink Black text. Defined by a 1px Stone Gray bottom border, visible only when active or focused. No internal padding is explicitly defined by the component data itself, relying on the font's natural line height for spacing.

### Product Grid Item
**Role:** Product display

Displays product images without explicit padding, borders, or background, letting the image content fill the space. Uses minimal bottom margin (64px) for vertical separation. The overall grid is a canvas for product photography.

## Do's and Don'ts

### Do
- Prioritize Ink Black (#000000) for all textual content and critical UI borders.
- Maintain a pristine Canvas White (#ffffff) as the dominant background color for all primary surfaces.
- Use Gerstner Programm FSL at 400 weight for all typography, leveraging its consistent character.
- Apply 0px border-radius universally to maintain sharp, unrounded geometric forms.
- Separate major sections with a 64px vertical gap to create a spacious, deliberate rhythm.
- Utilize 1px thin borders in Ash Gray (#c8c8c7) or Ink Black (#000000) for subtle content division, rather than background differentiation.
- All interactive elements should be visually lightweight, either as text links or ghost buttons with minimal visual adornment.

### Don't
- Avoid chromatic colors; maintain an exclusively achromatic palette unless explicitly defined for a specific, rare accent.
- Do not use shadows or elevation effects; surfaces should remain flat against the Canvas White background.
- Do not apply rounded corners to any UI elements; all corners must be sharp and angular (0px radius).
- Refrain from using varied font weights; all text should consistently use the 400 weight for Gerstner Programm FSL.
- Do not introduce complex background patterns or textures; surfaces should remain solid white.
- Avoid dense information blocks; use generous spacing and sparse content to convey exclusivity.
- Do not auto-generate hover/active states that introduce background fills or significant color changes; interaction should be subtle.

## Imagery

The site primarily uses photography, featuring a mix of styled portraiture for brand mood and clean e-commerce product shots. Photography is often full-bleed or large-format, often in black and white or desaturated tones, enhancing the monochrome aesthetic. Product images are typically isolated against a plain background, focusing solely on the garment itself without lifestyle context. Icons are minimal, with a very thin stroke weight, reinforcing the understated feel. Imagery serves both to convey atmosphere and to showcase products directly, dominating visual space.

## Layout

The page employs a full-bleed, unconstrained layout for its primary content, allowing photography to extend edge-to-edge. The hero section establishes this with a large split layout of editorial photography. Content then follows a grid-based pattern, primarily with product images forming a highly structured, dense array, often with a 3-column layout. Vertical rhythm is established through consistent 64px section gaps. Navigation is a minimal top bar, with text links and a discrete utility icon. The overall impression is an expansive, gallery-like experience.

## Agent Prompt Guide

Quick Color Reference:
text: #000000
background: #ffffff
border: #000000
accent: no distinct accent color
primary action: no distinct CTA color

Example Component Prompts:
Create a primary navigation link: Gerstner Programm FSL, 400 weight, 12px, Ink Black (#000000), no underline, 0px transparent border.
Create a newsletter sign-up button: Canvas White (#ffffff) background, Ink Black (#000000) text, 1px Ink Black (#000000) border, 0px border-radius, 8px vertical padding, 16px horizontal padding.
Create a text input field: Transparent background, Ink Black (#000000) text, 1px Stone Gray (#767676) bottom border, no padding, 0px border-radius.
Create a product grid item: A large image contained within a column, no background, no borders, no padding. Product name text (Gerstner Programm FSL, 400 weight, 12px, Ink Black (#000000)) underneath, with 64px margin-bottom for vertical separation.

## Similar Brands

- **Acne Studios** — Monochrome palette, minimalist typography, and large-format editorial photography.
- **COS** — Emphasis on clean lines, achromatic colors, and a focus on product presentation over elaborate UI.
- **The Row** — Understated luxury conveyed through stark design, limited color, and high-quality photography.
- **Theory** — Focus on a clean, professional aesthetic with a strong reliance on a neutral color palette and simple layouts.

## Quick Start

### CSS Custom Properties

```css
:root {
  /* Colors */
  --color-canvas-white: #ffffff;
  --color-ink-black: #000000;
  --color-ash-gray: #c8c8c7;
  --color-stone-gray: #767676;

  /* Typography — Font Families */
  --font-gerstner-programm-fsl: 'Gerstner Programm FSL', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

  /* Typography — Scale */
  --text-caption: 12px;
  --leading-caption: 1.15;
  --text-body: 20px;
  --leading-body: 1.25;

  /* Typography — Weights */
  --font-weight-regular: 400;

  /* Spacing */
  --spacing-unit: 8px;
  --spacing-8: 8px;
  --spacing-16: 16px;
  --spacing-24: 24px;
  --spacing-32: 32px;
  --spacing-64: 64px;
  --spacing-128: 128px;

  /* Layout */
  --section-gap: 64px;
  --card-padding: 16px;
  --element-gap: 8px;

  /* Named Radii */
  --radius-none: 0px;
}
```

### Tailwind v4

```css
@theme {
  /* Colors */
  --color-canvas-white: #ffffff;
  --color-ink-black: #000000;
  --color-ash-gray: #c8c8c7;
  --color-stone-gray: #767676;

  /* Typography */
  --font-gerstner-programm-fsl: 'Gerstner Programm FSL', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

  /* Typography — Scale */
  --text-caption: 12px;
  --leading-caption: 1.15;
  --text-body: 20px;
  --leading-body: 1.25;

  /* Spacing */
  --spacing-8: 8px;
  --spacing-16: 16px;
  --spacing-24: 24px;
  --spacing-32: 32px;
  --spacing-64: 64px;
  --spacing-128: 128px;
}
```
