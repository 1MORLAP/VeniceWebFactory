# Linearity — Style Reference
> Midnight canvas, vivid brushstrokes.

**Theme:** dark

Linearity employs a 'creative darkroom' aesthetic, juxtaposing crisp white and vibrant orange accents against predominantly dark, atmospheric surfaces. Typography is sharp and compact, driving home key messages with clear hierarchy. Components are lightweight with generous corner rounding, giving an approachable, almost playful feel, while maintaining functional clarity in an otherwise dramatic visual landscape. Color is used sparingly but impactfully to highlight interactive elements and guide user attention.

## Tokens — Colors

| Name | Value | Token | Role |
|------|-------|-------|------|
| Midnight Ink | `#000000` | `--color-midnight-ink` | Dark borders and separators for elevated surfaces and inverted UI. Do not promote it to the primary CTA color |
| Canvas White | `#ffffff` | `--color-canvas-white` | Secondary surface background, default text on dark backgrounds, ghost button borders |
| Deep Graphite | `#111717` | `--color-deep-graphite` | Elevated surface color, dark button backgrounds, secondary dark text |
| Silver Mist | `#c3c5c5` | `--color-silver-mist` | Muted text, subtle borders, navigation links |
| Ash Gray | `#585858` | `--color-ash-gray` | Secondary body text for less emphasis |
| Charcoal Text | `#202020` | `--color-charcoal-text` | Primary body text contrasting against light backgrounds |
| Vivid Orange | `#fd7c0f` | `--color-vivid-orange` | Orange action color for filled buttons, selected navigation states, and focused conversion moments. |

## Tokens — Typography

### AcidGroteskSubset — All text elements including headings, body, links, and buttons. Its varied weights and compact line heights create a dense, yet clear, textual hierarchy. The variable letter-spacing on larger sizes contributes to a crisp, professional feel. · `--font-acidgrotesksubset`
- **Substitute:** Inter
- **Weights:** 400, 500, 700
- **Sizes:** 12px, 14px, 16px, 18px, 20px, 24px, 28px, 40px, 72px, 88px
- **Line height:** 1.00, 1.20, 1.29, 1.30, 1.39, 1.40, 1.43, 1.50, 1.58, 1.60, 1.61, 1.63, 1.79, 1.80
- **Letter spacing:** -0.0170em (at 88px), -0.0140em (at 72px), -0.0110em (at 40px)
- **Role:** All text elements including headings, body, links, and buttons. Its varied weights and compact line heights create a dense, yet clear, textual hierarchy. The variable letter-spacing on larger sizes contributes to a crisp, professional feel.

### Type Scale

| Role | Size | Line Height | Letter Spacing | Token |
|------|------|-------------|----------------|-------|
| caption | 12px | 1.4 | — | `--text-caption` |
| body-sm | 14px | 1.43 | — | `--text-body-sm` |
| body | 16px | 1.5 | — | `--text-body` |
| subheading | 18px | 1.5 | — | `--text-subheading` |
| heading-sm | 20px | 1.58 | — | `--text-heading-sm` |
| heading | 24px | 1.39 | — | `--text-heading` |
| heading-lg | 40px | 1.2 | -0.011px | `--text-heading-lg` |
| display | 88px | 1 | -0.017px | `--text-display` |

## Tokens — Spacing & Shapes

**Base unit:** 4px

**Density:** spacious

### Spacing Scale

| Name | Value | Token |
|------|-------|-------|
| 4 | 4px | `--spacing-4` |
| 8 | 8px | `--spacing-8` |
| 12 | 12px | `--spacing-12` |
| 16 | 16px | `--spacing-16` |
| 20 | 20px | `--spacing-20` |
| 24 | 24px | `--spacing-24` |
| 28 | 28px | `--spacing-28` |
| 32 | 32px | `--spacing-32` |
| 36 | 36px | `--spacing-36` |
| 40 | 40px | `--spacing-40` |
| 48 | 48px | `--spacing-48` |
| 56 | 56px | `--spacing-56` |
| 60 | 60px | `--spacing-60` |
| 80 | 80px | `--spacing-80` |
| 84 | 84px | `--spacing-84` |
| 96 | 96px | `--spacing-96` |

### Border Radius

| Element | Value |
|---------|-------|
| cards | 20px |
| other | 16px |
| images | 12-24px |
| buttons | 9999px |

### Layout

- **Section gap:** 24px
- **Card padding:** 40px
- **Element gap:** 16px

## Components

### Primary Action Button
**Role:** Filled button indicating the primary call to action.

Background: Vivid Orange (#fd7c0f). Text color: Canvas White (#ffffff). Border radius: 9999px. Padding: 21px vertical, 42px horizontal.

### Ghost Header Button
**Role:** Outlined button used in the header for secondary actions.

Background: transparent. Text color: Canvas White (#ffffff). Border: 1px solid Canvas White (#ffffff). Border radius: 9999px. Padding: 9px vertical, 20-28px horizontal.

### Dark Filled Button
**Role:** Standard button for general actions, typically against lighter backgrounds or as a secondary option on dark backgrounds.

Background: Deep Graphite (#111717). Text color: Canvas White (#ffffff). Border radius: 9999px. Padding: 9px vertical, 20-28px horizontal.

### Default Card
**Role:** Standard container for content blocks.

No background color (transparent). No border radius, no box shadow, no padding.

### Elevated Content Card
**Role:** Card with subtle elevation or distinct background, often for showcasing features.

Background: rgba(204, 204, 204, 0.1). Border radius: 20px. No box shadow. Padding: 40px all sides.

### Dialog Box Card
**Role:** Card with a rounded, slightly elevated appearance, primarily for modal content or pop-ups.

Background: rgba(10, 15, 25, 0.08). Border radius: 24px. No box shadow. Padding: 32px all sides.

### Feature Highlight Card
**Role:** Prominent card for showcasing key features or testimonials.

Background: Canvas White (#fafafa). Border radius: 20px. No box shadow. Padding: 84px vertical, 40px horizontal.

## Do's and Don'ts

### Do
- Use Vivid Orange (#fd7c0f) exclusively for primary calls to action or key interactive highlights.
- Apply 9999px border-radius to all interactive buttons and navigation pills for a consistent soft, approachable shape.
- Maintain high contrast text: Midnight Ink (#000000) on Canvas White (#ffffff) and Canvas White (#ffffff) on Midnight Ink (#000000) or Deep Graphite (#111717).
- Employ the AcidGroteskSubset font at 88px with a letter-spacing of -0.017em for commanding display headlines.
- Utilize rgba(204, 204, 204, 0.1) for subtle background differentiation on cards, providing visual separation without strong color saturation.
- Ensure generous vertical spacing for sections, typically starting at 24px, to create a spacious and inviting layout.
- Position smaller UI elements with an element gap of 16px to maintain clear segmentation and readability.

### Don't
- Do not use Vivid Orange (#fd7c0f) for decorative elements or non-interactive text.
- Avoid using any border-radius less than 12px for significant UI elements; strict adherence to rounded corners is key.
- Do not introduce new saturated colors into the palette; the system relies on a restrained palette with a single dominant accent.
- Never compromise on contrast levels, especially when placing text on dark or light backgrounds.
- Do not embed imagery or illustrations without incorporating brand colors or a consistent visual style where appropriate.
- Avoid generic line heights; closely follow the specified line heights for each `AcidGroteskSubset` size to preserve text density.
- Do not use box shadows for elevation; rely on background color shifts and borders for layering and depth.

## Surfaces

| Level | Name | Value | Purpose |
|-------|------|-------|---------|
| 0 | Midnight Canvas | `#000000` | Primary page background for main content areas, providing a dramatic, immersive base. |
| 1 | Deep Graphite Surface | `#111717` | Subtly elevated surfaces or primary containers that require a slightly lighter dark tone than the canvas. |
| 2 | Translucent Card | `#0a0f1914` | Interactive cards or modals, offering a soft, translucent dark appearance against darker backgrounds. |
| 3 | Content Card Light | `#cccccc1a` | Highlight cards or content blocks, providing a very light dark tone, almost gray, to distinguish key information. |
| 4 | Pristine Feature Card | `#fafafa` | Prominent feature cards, using a near-white background to powerfully contrast with the dark theme and draw attention. |

## Imagery

Imagery on this site consists primarily of product screenshots and abstract, organic graphic elements. Photography is absent. Product screenshots are typically tightly cropped against clean, often dark, backgrounds to showcase features directly. Illustrations are abstract, organic shapes that use brand accent colors (orange, purple, green as seen in the hero) to suggest creativity and fluidity, often used as background elements or as interactive highlights. Icons are minimal, outlined, single-color with a medium stroke weight. Imagery serves both decorative atmosphere, particularly for the organic shapes, and explanatory content for product showcases. The overall density is balanced, with imagery often integrated within text sections or as large, central visual anchors.

## Layout

The page primarily uses a full-bleed layout, where sections extend to the edges of the viewport, particularly noticeable in the hero. Content is generally max-width contained, but the background colors stretch. The hero section is full-bleed dark with a large, centered headline accented with abstract color washes, accompanied by smaller, justified text blocks and prominent call-to-action buttons. Section rhythm is often established by changing background colors or subtle card treatments rather than strong dividers. Content arrangement shifts between centered stacks for hero and modal, to more structured text-left/text-right or text-over-image compositions on other pages, ensuring adaptability. Card grids are employed for features, although column counts are not consistently rigid. Overall density feels spacious, with ample breathing room created by generous padding and element gaps, allowing the content to stand out. Navigation is a sticky top bar, minimal and icon-driven where appropriate, with a prominent 'Get started for free' button.

## Agent Prompt Guide

Quick Color Reference: 
- text: #ffffff 
- background: #000000 
- border: #c3c5c5 
- accent: #fd7c0f 
- primary action: #fd7c0f (filled action)

Example Component Prompts:
1. Create a Primary Action Button: #fd7c0f background, #000000 text, 9999px radius, compact pill padding. Use this filled treatment for the main CTA.
2. Create an Elevated Content Card: Background rgba(204, 204, 204, 0.1), border-radius 20px, 40px padding. Inside, use Charcoal Text (#202020) for headlines and Ash Gray (#585858) for body text.
3. Design a header navigation link: Text 'Products' in Silver Mist (#c3c5c5), AcidGroteskSubset 400, size 16px. No background, no border, no padding around text, with a 4px right margin to the next element.
4. Create a Ghost Header Button labeled 'Get started for free': Background transparent, text Canvas White (#ffffff), border 1px solid Canvas White (#ffffff), border-radius 9999px, padding 9px vertical and 28px horizontal. 
5. Construct a Dialog Box Card: Background rgba(10, 15, 25, 0.08), border-radius 24px, 32px padding, centered on the screen. Use Midnight Ink (#000000) for internal text.

## Similar Brands

- **Figma** — Shares a sophisticated, dark-mode focused UI with clear information hierarchy and usage of vibrant accent colors for interaction.
- **Sketch** — Similar in its application of dark interfaces, large, legible typography, and a strong focus on professional design tools.
- **Raycast** — Uses a dark, command-center aesthetic, with rounded components and strategic color accents for functionality.
- **Framermotion** — Exhibits a playful yet professional approach, combining bold typography with rounded interactive elements and a primarily dark canvas.

## Quick Start

### CSS Custom Properties

```css
:root {
  /* Colors */
  --color-midnight-ink: #000000;
  --color-canvas-white: #ffffff;
  --color-deep-graphite: #111717;
  --color-silver-mist: #c3c5c5;
  --color-ash-gray: #585858;
  --color-charcoal-text: #202020;
  --color-vivid-orange: #fd7c0f;

  /* Typography — Font Families */
  --font-acidgrotesksubset: 'AcidGroteskSubset', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

  /* Typography — Scale */
  --text-caption: 12px;
  --leading-caption: 1.4;
  --text-body-sm: 14px;
  --leading-body-sm: 1.43;
  --text-body: 16px;
  --leading-body: 1.5;
  --text-subheading: 18px;
  --leading-subheading: 1.5;
  --text-heading-sm: 20px;
  --leading-heading-sm: 1.58;
  --text-heading: 24px;
  --leading-heading: 1.39;
  --text-heading-lg: 40px;
  --leading-heading-lg: 1.2;
  --tracking-heading-lg: -0.011px;
  --text-display: 88px;
  --leading-display: 1;
  --tracking-display: -0.017px;

  /* Typography — Weights */
  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --font-weight-bold: 700;

  /* Spacing */
  --spacing-unit: 4px;
  --spacing-4: 4px;
  --spacing-8: 8px;
  --spacing-12: 12px;
  --spacing-16: 16px;
  --spacing-20: 20px;
  --spacing-24: 24px;
  --spacing-28: 28px;
  --spacing-32: 32px;
  --spacing-36: 36px;
  --spacing-40: 40px;
  --spacing-48: 48px;
  --spacing-56: 56px;
  --spacing-60: 60px;
  --spacing-80: 80px;
  --spacing-84: 84px;
  --spacing-96: 96px;

  /* Layout */
  --section-gap: 24px;
  --card-padding: 40px;
  --element-gap: 16px;

  /* Border Radius */
  --radius-xl: 12px;
  --radius-2xl: 16px;
  --radius-2xl-2: 20px;
  --radius-3xl: 24px;
  --radius-full: 9999px;

  /* Named Radii */
  --radius-cards: 20px;
  --radius-other: 16px;
  --radius-images: 12-24px;
  --radius-buttons: 9999px;

  /* Surfaces */
  --surface-midnight-canvas: #000000;
  --surface-deep-graphite-surface: #111717;
  --surface-translucent-card: #0a0f1914;
  --surface-content-card-light: #cccccc1a;
  --surface-pristine-feature-card: #fafafa;
}
```

### Tailwind v4

```css
@theme {
  /* Colors */
  --color-midnight-ink: #000000;
  --color-canvas-white: #ffffff;
  --color-deep-graphite: #111717;
  --color-silver-mist: #c3c5c5;
  --color-ash-gray: #585858;
  --color-charcoal-text: #202020;
  --color-vivid-orange: #fd7c0f;

  /* Typography */
  --font-acidgrotesksubset: 'AcidGroteskSubset', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

  /* Typography — Scale */
  --text-caption: 12px;
  --leading-caption: 1.4;
  --text-body-sm: 14px;
  --leading-body-sm: 1.43;
  --text-body: 16px;
  --leading-body: 1.5;
  --text-subheading: 18px;
  --leading-subheading: 1.5;
  --text-heading-sm: 20px;
  --leading-heading-sm: 1.58;
  --text-heading: 24px;
  --leading-heading: 1.39;
  --text-heading-lg: 40px;
  --leading-heading-lg: 1.2;
  --tracking-heading-lg: -0.011px;
  --text-display: 88px;
  --leading-display: 1;
  --tracking-display: -0.017px;

  /* Spacing */
  --spacing-4: 4px;
  --spacing-8: 8px;
  --spacing-12: 12px;
  --spacing-16: 16px;
  --spacing-20: 20px;
  --spacing-24: 24px;
  --spacing-28: 28px;
  --spacing-32: 32px;
  --spacing-36: 36px;
  --spacing-40: 40px;
  --spacing-48: 48px;
  --spacing-56: 56px;
  --spacing-60: 60px;
  --spacing-80: 80px;
  --spacing-84: 84px;
  --spacing-96: 96px;

  /* Border Radius */
  --radius-xl: 12px;
  --radius-2xl: 16px;
  --radius-2xl-2: 20px;
  --radius-3xl: 24px;
  --radius-full: 9999px;
}
```
