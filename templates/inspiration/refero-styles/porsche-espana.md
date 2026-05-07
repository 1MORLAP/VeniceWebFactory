# Porsche España — Style Reference
> Gallery of engineered desire: high-contrast photography framed by crisp, dark architectural UI.

**Theme:** dark

Porsche's digital presence embodies a high-end, gallery-like experience, contrasting rich photographic imagery against stark achromatic surfaces. The interface balances bold, oversized typography for headlines with subtle system controls, letting product visuals dominate. Interactions are minimal and precise, focusing on clarity over flamboyant UI elements, with a single vivid violet accent color reserved for focused interactive states.

## Tokens — Colors

| Name | Value | Token | Role |
|------|-------|-------|------|
| Obsidian Black | `#000000` | `--color-obsidian-black` | Dark surface backgrounds, primary text on light backgrounds, hairline borders |
| Deep Space | `#010205` | `--color-deep-space` | Slightly tinted background for large hero sections, subtle text color, elevated card surfaces |
| Canvas White | `#fafbff` | `--color-canvas-white` | Page backgrounds, text on dark backgrounds, subtle foreground elements |
| Electric Violet | `#9e9eff` | `--color-electric-violet` | Outlined interactive elements, link highlights, and subtle accent lines for active states |

## Tokens — Typography

### Porsche Next — Primary brand typeface for all text – from navigation and body copy to monumental headlines. Its consistent weight across various sizes maintains a confident and understated tone, ensuring a unified voice. · `--font-porsche-next`
- **Substitute:** Inter
- **Weights:** 400
- **Sizes:** 14px, 16px, 73px, 95px
- **Line height:** 1.19, 1.21, 1.50, 1.55
- **Letter spacing:** normal
- **Role:** Primary brand typeface for all text – from navigation and body copy to monumental headlines. Its consistent weight across various sizes maintains a confident and understated tone, ensuring a unified voice.

### Type Scale

| Role | Size | Line Height | Letter Spacing | Token |
|------|------|-------------|----------------|-------|
| caption | 14px | 1.55 | — | `--text-caption` |
| body | 16px | 1.5 | — | `--text-body` |
| heading-lg | 73px | 1.21 | — | `--text-heading-lg` |
| display | 95px | 1.19 | — | `--text-display` |

## Tokens — Spacing & Shapes

**Base unit:** 6px

**Density:** spacious

### Spacing Scale

| Name | Value | Token |
|------|-------|-------|
| 4 | 4px | `--spacing-4` |
| 7 | 7px | `--spacing-7` |
| 12 | 12px | `--spacing-12` |
| 13 | 13px | `--spacing-13` |
| 30 | 30px | `--spacing-30` |
| 50 | 50px | `--spacing-50` |
| 63 | 63px | `--spacing-63` |
| 81 | 81px | `--spacing-81` |
| 179 | 179px | `--spacing-179` |
| 186 | 186px | `--spacing-186` |
| 211 | 211px | `--spacing-211` |
| 225 | 225px | `--spacing-225` |

### Border Radius

| Element | Value |
|---------|-------|
| cards | 32px |
| badges | 12px |
| buttons | 32px |
| default | 32px |

### Layout

- **Section gap:** 81px
- **Card padding:** 0px
- **Element gap:** 13px

## Components

### Ghost Action Button
**Role:** Interactive element

Ghost button with 32px border-radius, transparent background, #000000 border and text. Padding is 0px, indicating the text itself defines the interactable area. Used for 'Descubre más'.

### Image Card with Text Overlay
**Role:** Content container

Card with 32px border-radius, #000000 background, zero padding, containing an image with overlaid text. Used for product showcases like 'Nuevo Cayenne Turbo Coupé Electric'.

### Interactive Image Card
**Role:** Navigational element

Card with 0px border-radius, no background, zero padding. Functions as a clickable area covering an image, often with embedded text.

### Rounded Detail Badge
**Role:** Informational label

Small badge with 12px border-radius, transparent background, and #000000 text. Used for subtle category or status indicators.

### Navigation Link Highlight
**Role:** Active link indicator

Subtle interactive element, where the active state or hover shows a border or text in Electric Violet (#9e9eff).

## Do's and Don'ts

### Do
- Prioritize full-bleed, high-resolution automotive imagery as the primary content, especially in hero sections.
- Use Obsidian Black (#000000) or Deep Space (#010205) for dark container backgrounds, contrasting with Canvas White (#fafbff) for main page backgrounds.
- Reserve Electric Violet (#9e9eff) exclusively for subtle interactive states, borders, and functional link accents; avoid using it as a filled background color.
- Apply a 32px border-radius consistently to all interactive buttons and image cards for a soft, premium feel.
- Employ Porsche Next font at 95px or 73px for impactful headlines, but maintain normal letter-spacing to preserve legibility.
- Maintain a clear division between dark, immersive content sections and light, informational ones, often alternating with a 81px section gap.

### Don't
- Avoid using chromatic colors for large areas or filled button backgrounds; retain a largely achromatic interface.
- Do not introduce heavy shadows or superfluous decorative elements; the design emphasizes minimal UI and strong visuals.
- Refrain from using varied font families or weights beyond Porsche Next 400; maintain typographic consistency.
- Do not break the spacious layout with dense information blocks; allow generous whitespace around components.
- Avoid generic button styles; prefer ghost buttons or outlined components for primary actions.

## Imagery

The site is imagery-heavy, primarily showcasing high-quality, aspirational photography of Porsche vehicles and lifestyle contexts. Images are often full-bleed or large contained elements, sometimes masked with soft 32px rounded corners. Photography is typically moody and dramatic with high-contrast lighting, focusing on the product itself or atmospheric lifestyle shots that evoke desire. Small, functional mono-color icons with thin strokes are used for UI controls. Imagery serves mainly as decorative atmosphere and product showcase, dominating visual space and conveying aspirational brand messaging.

## Layout

The page primarily uses a full-bleed layout, particularly for hero sections and immersive content blocks, creating a cinematic experience. Content is frequently centered, especially headlines over large background images. Sections alternate between dark, imagery-heavy presentations (like the hero) and lighter, more neutral backgrounds for informational content or grids of image cards. There's a consistent vertical rhythm created by an 81px section gap, which provides ample breathing room. Content is arranged in flexible patterns, with multi-column card grids for features and text often overlaid directly onto images. A minimal sticky top navigation bar provides core site controls.

## Agent Prompt Guide

### Quick Color Reference
text: Obsidian Black (#000000)
background: Canvas White (#fafbff)
border: Obsidian Black (#000000)
accent: Electric Violet (#9e9eff)
primary action: #9e9eff (outlined action border)

### 3-5 Example Component Prompts
1. Create a hero section: Dark background (Deep Space #010205) with a full-bleed car image. Headline 'Panamera Turbo E-Hybrid.' in Canvas White (#fafbff) at 95px Porsche Next weight 400. Include a Ghost Action Button 'Descubre más' (transparent background, Obsidian Black text, Obsidian Black 1px border, 32px radius, 0px padding).
2. Build a product showcase section: Canvas White (#fafbff) background. Heading 'Su viaje con Porsche comienza ahora.' in Obsidian Black (#000000) at 73px Porsche Next weight 400. Below, a 3-column grid of image cards: each card has 32px border-radius, Obsidian Black (#000000) background, 0px padding, containing an image with overlaid Canvas White text at 14px Porsche Next weight 400.
3. Design a top navigation bar: Obsidian Black (#000000) background. 'PORSCHE' logo in Canvas White (#fafbff). Navigation links (e.g., 'Menú') in Canvas White (#fafbff), with active states highlighted by an Electric Violet (#9e9eff) border or text.

## Motion Philosophy

Transitions are designed for a smooth, expressive experience with dominant durations of 0.6s and 1.2s, utilizing `ease` and `cubic-bezier(0, 0, 0.2, 1)` functions. Animations focus on width changes for element transitions, along with subtle opacity shifts, aiming for a cinematic rather than abrupt feel. This suggests a desire for luxurious, deliberate visual storytelling through movement.

## Similar Brands

- **Mercedes-Benz AMG** — High-contrast product photography against dark backdrops, minimalist UI, and similar sophisticated typography.
- **BMW M** — Focus on large, immersive vehicle imagery, clean typographic hierarchy, and limited accent colors for luxury appeal.
- **Tesla** — Showcases product design through full-bleed stunning visuals with a very clean, text-minimal overlay.
- **Lamborghini** — Dark-themed pages, dramatic car photography, and sparse, impactful typography to convey luxury and performance.

## Quick Start

### CSS Custom Properties

```css
:root {
  /* Colors */
  --color-obsidian-black: #000000;
  --color-deep-space: #010205;
  --color-canvas-white: #fafbff;
  --color-electric-violet: #9e9eff;

  /* Typography — Font Families */
  --font-porsche-next: 'Porsche Next', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

  /* Typography — Scale */
  --text-caption: 14px;
  --leading-caption: 1.55;
  --text-body: 16px;
  --leading-body: 1.5;
  --text-heading-lg: 73px;
  --leading-heading-lg: 1.21;
  --text-display: 95px;
  --leading-display: 1.19;

  /* Typography — Weights */
  --font-weight-regular: 400;

  /* Spacing */
  --spacing-unit: 6px;
  --spacing-4: 4px;
  --spacing-7: 7px;
  --spacing-12: 12px;
  --spacing-13: 13px;
  --spacing-30: 30px;
  --spacing-50: 50px;
  --spacing-63: 63px;
  --spacing-81: 81px;
  --spacing-179: 179px;
  --spacing-186: 186px;
  --spacing-211: 211px;
  --spacing-225: 225px;

  /* Layout */
  --section-gap: 81px;
  --card-padding: 0px;
  --element-gap: 13px;

  /* Border Radius */
  --radius-xl: 12px;
  --radius-3xl: 32px;

  /* Named Radii */
  --radius-cards: 32px;
  --radius-badges: 12px;
  --radius-buttons: 32px;
  --radius-default: 32px;
}
```

### Tailwind v4

```css
@theme {
  /* Colors */
  --color-obsidian-black: #000000;
  --color-deep-space: #010205;
  --color-canvas-white: #fafbff;
  --color-electric-violet: #9e9eff;

  /* Typography */
  --font-porsche-next: 'Porsche Next', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

  /* Typography — Scale */
  --text-caption: 14px;
  --leading-caption: 1.55;
  --text-body: 16px;
  --leading-body: 1.5;
  --text-heading-lg: 73px;
  --leading-heading-lg: 1.21;
  --text-display: 95px;
  --leading-display: 1.19;

  /* Spacing */
  --spacing-4: 4px;
  --spacing-7: 7px;
  --spacing-12: 12px;
  --spacing-13: 13px;
  --spacing-30: 30px;
  --spacing-50: 50px;
  --spacing-63: 63px;
  --spacing-81: 81px;
  --spacing-179: 179px;
  --spacing-186: 186px;
  --spacing-211: 211px;
  --spacing-225: 225px;

  /* Border Radius */
  --radius-xl: 12px;
  --radius-3xl: 32px;
}
```
