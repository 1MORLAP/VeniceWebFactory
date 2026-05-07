# Buzz Usborne — Style Reference
> Clean slate, playful voice

**Theme:** light

Buzz Usborne's design system presents as a clean, spacious canvas with a playful, yet strong typographic voice. The visual identity relies on a dominant dark gray for text and primary interactive elements, accented by a single vivid violet for subtle button detailing, creating a sense of understated vibrancy. Component surfaces and backgrounds are kept pristine white, emphasizing content and a lightweight feel. Overall, the system projects an approachable, content-focused atmosphere, leaning on personality in typography rather than complex color schemes or heavy ornamentation.

## Tokens — Colors

| Name | Value | Token | Role |
|------|-------|-------|------|
| Canvas White | `#ffffff` | `--color-canvas-white` | Page backgrounds, card surfaces, ghost button backgrounds |
| Graphite Ink | `#2a394e` | `--color-graphite-ink` | Primary text across headings and body, accent for selected interactive elements, primary button fills |
| Muted Midnight | `#14243c` | `--color-muted-midnight` | Secondary text for body content, text on filled primary buttons |
| Vivid Violet | `#4700d8` | `--color-vivid-violet` | Outlined button borders, subtle interactive accents |

## Tokens — Typography

### Poetsen One — Display headlines and primary section titles — gives a distinctive, friendly, and bold presence to key statements, ensuring immediate personality. · `--font-poetsen-one`
- **Substitute:** Bebas Neue
- **Weights:** 400
- **Sizes:** 52px
- **Line height:** 1.15
- **Role:** Display headlines and primary section titles — gives a distinctive, friendly, and bold presence to key statements, ensuring immediate personality.

### Roboto — Body copy, navigation, buttons, and supplemental text — a highly legible sans-serif for all functional and supportive text, providing a reliable baseline. · `--font-roboto`
- **Substitute:** Open Sans
- **Weights:** 400, 500
- **Sizes:** 13px, 14px, 15px, 16px, 22px
- **Line height:** 1.00, 1.71, 1.87, 2.09
- **Role:** Body copy, navigation, buttons, and supplemental text — a highly legible sans-serif for all functional and supportive text, providing a reliable baseline.

### Type Scale

| Role | Size | Line Height | Letter Spacing | Token |
|------|------|-------------|----------------|-------|
| body-lg | 16px | 1.87 | — | `--text-body-lg` |
| subheading | 22px | 1 | — | `--text-subheading` |
| display | 52px | 1.15 | — | `--text-display` |

## Tokens — Spacing & Shapes

**Density:** spacious

### Spacing Scale

| Name | Value | Token |
|------|-------|-------|
| 10 | 10px | `--spacing-10` |
| 15 | 15px | `--spacing-15` |
| 20 | 20px | `--spacing-20` |
| 25 | 25px | `--spacing-25` |
| 30 | 30px | `--spacing-30` |
| 50 | 50px | `--spacing-50` |
| 100 | 100px | `--spacing-100` |
| 150 | 150px | `--spacing-150` |

### Border Radius

| Element | Value |
|---------|-------|
| other | 20px |
| images | 20px |
| buttons | 30px |

### Layout

- **Section gap:** 50px
- **Card padding:** 25px
- **Element gap:** 10px

## Components

### Primary Filled Button
**Role:** Call to action button

Filled with Graphite Ink background (#2a394e), Muted Midnight text (#14243c), and a generous 30px border radius. Padding of 15px vertical and 25px horizontal creates ample touch targets and a soft, approachable pill shape.

### Ghost Header Button
**Role:** Navigation menu button

Appears as a simple 'Menu' icon with a transparent background, implicitly using Canvas White (#ffffff) as its background. No visible border, text color defaults to browser standard for links before hovering/interaction.

## Do's and Don'ts

### Do
- Prioritize Canvas White (#ffffff) for all large background areas and card surfaces, creating a clean base.
- Use Graphite Ink (#2a394e) for all primary headline and body text, establishing a strong, readable dark neutral.
- Apply Poetsen One at 52px, weight 400, for section headlines or hero text to introduce branding personality.
- For interactive elements, use the 30px border-radius, creating a consistent pill shape for buttons.
- Maintain a spacious environment, utilizing 50px as the primary vertical separation between major sections.
- For primary call-to-action buttons, use a Graphite Ink (#2a394e) fill with Muted Midnight (#14243c) text, with 15px vertical and 25px horizontal padding, and 30px radius.

### Don't
- Avoid using multiple vibrant chromatic colors; restrict accent colors primarily to Vivid Violet (#4700d8) for subtle highlights.
- Do not deviate from Roboto for body text and functional UI elements where immediate readability is key.
- Avoid tight element groupings; ensure a minimum of 10px spacing between elements to preserve visual breathability.
- Do not introduce complex shadows or excessive borders; surfaces should feel lightweight and minimally elevated.
- Refrain from using strong background patterns or textures; surfaces are intended to be clean and understated.

## Imagery

This system primarily uses product screenshots and illustrative emojis rather than traditional photography. Product screenshots are contained within soft-rectangular cards with 20px radius. Emojis are used directly within heading text, adding a playful, approachable, and personalized tone to the communication. Icons are minimal, likely linear or mono-color, serving purely functional roles like the 'Menu' button.

## Layout

The page maintains a centered max-width layout, approximately 950-1000px wide, creating clear content boundaries on a Canvas White background. The hero section is a centered stack of a playful headline over a contained product image. Vertical rhythm is established through consistent 50px section gaps and ample side padding of 150px or more on text blocks. Content often appears in single-column stacks, emphasizing direct communication rather than complex multi-column grids or visual fragmentation. Navigation is minimal, consisting of a sticky top header with a brand logo and a simple 'Menu' button.

## Agent Prompt Guide

### Quick Color Reference
- text: #2a394e
- background: #ffffff
- border: no distinct border color
- accent: #4700d8
- primary action: #2a394e (outlined action border)

### 3-5 Example Component Prompts
- Create a hero section with a centered headline: 'I’m Buzz 🫶 a Principal Designer' using Poetsen One at 52px, weight 400, color #2a394e. Below it, add a section description in Roboto at 16px, weight 400, color #2a394e. Ensure generous vertical spacing (50px).
- Create an Outlined Primary Action: Transparent background, #2a394e border and text, 9999px radius, compact pill padding. Use it for the main CTA instead of a filled button.
- Construct a header navigation bar: Use Canvas White (#ffffff) background. On the left, place a brand logo (text 'Buzz Usborne' in a custom font, color #2a394e). On the right, include a 'Menu' ghost button (no background fill or border, text in #14243c; apply 20px padding).
- Lay out a product feature card: Use Canvas White (#ffffff) background, 20px border-radius, 25px padding. Include a product screenshot with 20px corner radius.

## Similar Brands

- **Figma** — Clean, predominantly white canvas with a focus on clear typography and functional, rather than decorative, color accents.
- **Linear** — Emphasis on well-defined typography and generous white space to present complex information clearly, with minimal chromatic distraction.
- **Miro** — Utilizes a crisp, light background and distinct typefaces to convey information, with a constrained color palette for interactivity.
- **Notion** — Content-first approach, with typography and white space forming the primary visual hierarchy, supported by a minimal color palette.

## Quick Start

### CSS Custom Properties

```css
:root {
  /* Colors */
  --color-canvas-white: #ffffff;
  --color-graphite-ink: #2a394e;
  --color-muted-midnight: #14243c;
  --color-vivid-violet: #4700d8;

  /* Typography — Font Families */
  --font-poetsen-one: 'Poetsen One', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-roboto: 'Roboto', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

  /* Typography — Scale */
  --text-body-lg: 16px;
  --leading-body-lg: 1.87;
  --text-subheading: 22px;
  --leading-subheading: 1;
  --text-display: 52px;
  --leading-display: 1.15;

  /* Typography — Weights */
  --font-weight-regular: 400;
  --font-weight-medium: 500;

  /* Spacing */
  --spacing-10: 10px;
  --spacing-15: 15px;
  --spacing-20: 20px;
  --spacing-25: 25px;
  --spacing-30: 30px;
  --spacing-50: 50px;
  --spacing-100: 100px;
  --spacing-150: 150px;

  /* Layout */
  --section-gap: 50px;
  --card-padding: 25px;
  --element-gap: 10px;

  /* Border Radius */
  --radius-2xl: 20px;
  --radius-3xl: 30px;

  /* Named Radii */
  --radius-other: 20px;
  --radius-images: 20px;
  --radius-buttons: 30px;
}
```

### Tailwind v4

```css
@theme {
  /* Colors */
  --color-canvas-white: #ffffff;
  --color-graphite-ink: #2a394e;
  --color-muted-midnight: #14243c;
  --color-vivid-violet: #4700d8;

  /* Typography */
  --font-poetsen-one: 'Poetsen One', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-roboto: 'Roboto', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

  /* Typography — Scale */
  --text-body-lg: 16px;
  --leading-body-lg: 1.87;
  --text-subheading: 22px;
  --leading-subheading: 1;
  --text-display: 52px;
  --leading-display: 1.15;

  /* Spacing */
  --spacing-10: 10px;
  --spacing-15: 15px;
  --spacing-20: 20px;
  --spacing-25: 25px;
  --spacing-30: 30px;
  --spacing-50: 50px;
  --spacing-100: 100px;
  --spacing-150: 150px;

  /* Border Radius */
  --radius-2xl: 20px;
  --radius-3xl: 30px;
}
```
