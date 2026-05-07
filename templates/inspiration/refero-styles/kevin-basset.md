# Kevin Basset — Style Reference
> ink-scribbled notebook paper

**Theme:** light

The Kevin Basset site adopts a 'notebook scribble' aesthetic, reminiscent of a student's hand-drawn notes on lined paper. The design is characterized by its light, monochrome palette, with all elements rendered as if sketched in black ink. Interactive elements, such as links, appear as light gray boxes, maintaining the paper-like texture. Handwriting-style typography reinforces this informal, personal, and childlike visual identity.

## Tokens — Colors

| Name | Value | Token | Role |
|------|-------|-------|------|
| Ink Black | `#000000` | `--color-ink-black` | Dark borders and separators for elevated surfaces and inverted UI. |
| Paper White | `#ffffff` | `--color-paper-white` | Light neutral action fill for buttons on dark surfaces. |
| Pencil Sketch | `#ececec` | `--color-pencil-sketch` | Hover state for interactive links, subtle background fill for selected/active elements – evokes the lighter tone of pencil shading on paper |
| Notebook Line Teal | `#1d97b8` | `--color-notebook-line-teal` | Decorative notebook lines – a subtle accent that defines the page's core structure (derived from linear-gradient) |

## Tokens — Typography

### system — All text elements, including headings, body, and interactive links. The humanist sans-serif with varying letter spacing contributes to the bespoke, slightly informal 'hand-drawn' feel of the site. · `--font-system`
- **Substitute:** Avenir Next, sans-serif (for similar humanist sans-serif feel and good rendering)
- **Weights:** 400, 600, 700
- **Sizes:** 16px, 20px, 50px
- **Line height:** 1.20
- **Letter spacing:** 0.0200em at 16px, 0.0500em at 20px, 0.0630em at 50px
- **Role:** All text elements, including headings, body, and interactive links. The humanist sans-serif with varying letter spacing contributes to the bespoke, slightly informal 'hand-drawn' feel of the site.

### Type Scale

| Role | Size | Line Height | Letter Spacing | Token |
|------|------|-------------|----------------|-------|
| body | 16px | 1.2 | 0.32px | `--text-body` |
| subheading | 20px | 1.2 | 1px | `--text-subheading` |
| display | 50px | 1.2 | 3.15px | `--text-display` |

## Tokens — Spacing & Shapes

**Base unit:** 4px

**Density:** comfortable

### Spacing Scale

| Name | Value | Token |
|------|-------|-------|
| 8 | 8px | `--spacing-8` |
| 10 | 10px | `--spacing-10` |
| 20 | 20px | `--spacing-20` |
| 100 | 100px | `--spacing-100` |

### Border Radius

| Element | Value |
|---------|-------|
| links | 0px |

### Layout

- **Section gap:** 25px
- **Card padding:** 20px
- **Element gap:** 20px

## Components

### Sketched Link Button (Default/Inactive)
**Role:** Primary interactive element for all links on the site.

A rectangular button-like element with a Paper White background, an Ink Black hand-drawn border, and Ink Black text. The corners are sharp, reinforcing the 'cut paper' aesthetic. The drawing effect is applied through illustrations.

### Sketched Link Button (Hover)
**Role:** Visual feedback for interactive links.

Similar to the default link button but with a Pencil Sketch background. The Ink Black border and text remain consistent, providing a subtle visual cue without departing from the monochrome scheme.

## Do's and Don'ts

### Do
- Use Ink Black (#000000) for all text, borders, and hand-drawn visual elements.
- Set the primary page background to Paper White (#ffffff) to simulate notebook paper.
- Apply Pencil Sketch (#ececec) as the background color for interactive elements on hover.
- Maintain the system sans-serif font across all text, emphasizing a hand-drawn yet legible feel.
- Ensure all interactive links have a visible Ink Black border and Paper White background by default.
- Integrate Notebook Line Teal (#1d97b8) only as decorative ruled lines, not for primary UI elements.

### Don't
- Avoid using any saturated colors for functional UI elements; the palette is strictly monochrome with a single subtle accent.
- Do not introduce rounded corners; elements should maintain sharp, cut-paper edges.
- Refrain from using shadows or gradients on interactive elements, as this would break the flat, hand-drawn aesthetic.
- Do not use multiple font families; stick to the single system font to maintain typographic consistency.
- Avoid typical button styling like strong background fills or complex hover animations that would distract from the sketched feel.
- Do not vary line heights from the specified 1.2 across different type sizes.

## Imagery

The site predominantly uses hand-drawn, black-ink illustrations and icons that mimic a quirky, child-like scribble aesthetic. There are no photographs or complex graphics. Visuals are contained and appear outlined, often with a slight wobble to convey an imperfect, unpolished feel. They serve both decorative and explanatory roles, like the robot graphic or the avatar sketch. Imagery density is moderate, with illustrations breaking up text blocks and adding character.

## Layout

The page uses a centered, max-width contained layout, though no specific max-width is provided, suggesting adaptability. The hero section features a prominent centered headline/name with a hand-drawn avatar. Content is primarily a vertical stack of uniform 'sketched link buttons,' each occupying its own horizontal band. There are no complex grid layouts or alternating section patterns; the rhythm is consistent and linear, like a list on a piece of paper.

## Agent Prompt Guide

Quick Color Reference: text: #000000, background: #ffffff, border: #000000, accent: #1d97b8, primary action: no distinct CTA color

Example Component Prompts:
Create a standard link button: Paper White background, Ink Black border, Ink Black text. Text size 16px, weight 400, letter-spacing 0.32px.
Create a heading: Ink Black text, size 50px, weight 700, letter-spacing 3.15px, line-height 1.2.
Create an icon next to text: Ink Black icon, 10px right margin from text, text size 16px, weight 400, letter-spacing 0.32px, Ink Black.

## Similar Brands

- **Paper.js (website)** — Exploits a 'paper' aesthetic with hand-drawn lines complementing technical content.
- **Neat.css** — Emphasizes a 'hand-drawn' UI with deliberate imperfections and sketch-like lines.
- **Rough.js library** — Generates graphics that look hand-drawn with a sketch effect.
- **Hand-drawn.io** — A portfolio site using a deliberately informal, sketched visual style.

## Quick Start

### CSS Custom Properties

```css
:root {
  /* Colors */
  --color-ink-black: #000000;
  --color-paper-white: #ffffff;
  --color-pencil-sketch: #ececec;
  --color-notebook-line-teal: #1d97b8;

  /* Typography — Font Families */
  --font-system: 'system', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

  /* Typography — Scale */
  --text-body: 16px;
  --leading-body: 1.2;
  --tracking-body: 0.32px;
  --text-subheading: 20px;
  --leading-subheading: 1.2;
  --tracking-subheading: 1px;
  --text-display: 50px;
  --leading-display: 1.2;
  --tracking-display: 3.15px;

  /* Typography — Weights */
  --font-weight-regular: 400;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;

  /* Spacing */
  --spacing-unit: 4px;
  --spacing-8: 8px;
  --spacing-10: 10px;
  --spacing-20: 20px;
  --spacing-100: 100px;

  /* Layout */
  --section-gap: 25px;
  --card-padding: 20px;
  --element-gap: 20px;

  /* Named Radii */
  --radius-links: 0px;
}
```

### Tailwind v4

```css
@theme {
  /* Colors */
  --color-ink-black: #000000;
  --color-paper-white: #ffffff;
  --color-pencil-sketch: #ececec;
  --color-notebook-line-teal: #1d97b8;

  /* Typography */
  --font-system: 'system', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

  /* Typography — Scale */
  --text-body: 16px;
  --leading-body: 1.2;
  --tracking-body: 0.32px;
  --text-subheading: 20px;
  --leading-subheading: 1.2;
  --tracking-subheading: 1px;
  --text-display: 50px;
  --leading-display: 1.2;
  --tracking-display: 3.15px;

  /* Spacing */
  --spacing-8: 8px;
  --spacing-10: 10px;
  --spacing-20: 20px;
  --spacing-100: 100px;
}
```
