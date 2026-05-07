# Kosmik — Style Reference
> Warm orange accent on bright canvas

**Theme:** light

Kosmik's design system uses a bright, inviting canvas with a single vibrant orange as its brand accent. Typography is a key element, with a mix of custom fonts offering both robust headlines and nuanced body text. Components are light, favoring subtle shadows and rounded edges, creating an approachable and focused interface. The overall impression is one of clarity and warmth, with functional elements highlighted rather than aggressively asserted.

## Tokens — Colors

| Name | Value | Token | Role |
|------|-------|-------|------|
| Canvas White | `#ffffff` | `--color-canvas-white` | Page backgrounds, clean element surfaces, default button fills |
| Buttermilk | `#fff8f5` | `--color-buttermilk` | Subtle background for cards and secondary page sections, providing slight visual separation from the main canvas |
| Midnight Graphite | `#000000` | `--color-midnight-graphite` | Primary text color for maximum contrast, strong borders, and most icons |
| Charcoal | `#3c3c3c` | `--color-charcoal` | Secondary text for headings and body content, offering a slightly softer contrast than Midnight Graphite |
| Soft Gray | `#6a6a6a` | `--color-soft-gray` | Muted text, helper text, and subtle borders, for less prominent information |
| Marigold Burst | `#f57127` | `--color-marigold-burst` | Primary action backgrounds, prominent headlines, and brand accents — signals interaction and importance |

## Tokens — Typography

### Americane — Prominent headlines, display text. The tight letter-spacing at smaller sizes keeps it compact, while larger sizes command attention without being overbearing. · `--font-americane`
- **Substitute:** Georgia
- **Weights:** 400, 500, 700
- **Sizes:** 20px, 48px, 90px
- **Line height:** 1.00, 1.20
- **Letter spacing:** -0.02em at 20px, normal at 48px, normal at 90px
- **Role:** Prominent headlines, display text. The tight letter-spacing at smaller sizes keeps it compact, while larger sizes command attention without being overbearing.

### Kosmik SF Compact Display — Body text and secondary titles. The slightly increased letter-spacing aids readability in informational blocks. · `--font-kosmik-sf-compact-display`
- **Substitute:** Inter
- **Weights:** 400
- **Sizes:** 20px
- **Line height:** 1.40
- **Letter spacing:** 0.02em
- **Role:** Body text and secondary titles. The slightly increased letter-spacing aids readability in informational blocks.

### SuperBlue — Versatile for body copy and subtle headings. The light weight (300) offers an airy feel, balanced by regular and bold for emphasis. · `--font-superblue`
- **Substitute:** Open Sans
- **Weights:** 300, 400, 700
- **Sizes:** 20px, 32px
- **Line height:** 1.40, 1.55, 1.88
- **Letter spacing:** 0.02em
- **Role:** Versatile for body copy and subtle headings. The light weight (300) offers an airy feel, balanced by regular and bold for emphasis.

### system-ui, sans-serif — Default UI elements like navigation links, captions, and utility text for efficiency. · `--font-system-ui-sans-serif`
- **Substitute:** system-ui
- **Weights:** 400
- **Sizes:** 12px
- **Line height:** 1.20
- **Letter spacing:** normal
- **Role:** Default UI elements like navigation links, captions, and utility text for efficiency.

## Tokens — Spacing & Shapes

**Density:** compact

### Spacing Scale

| Name | Value | Token |
|------|-------|-------|
| 4 | 4px | `--spacing-4` |
| 6 | 6px | `--spacing-6` |
| 8 | 8px | `--spacing-8` |
| 10 | 10px | `--spacing-10` |
| 12 | 12px | `--spacing-12` |
| 16 | 16px | `--spacing-16` |
| 20 | 20px | `--spacing-20` |
| 21 | 21px | `--spacing-21` |
| 22 | 22px | `--spacing-22` |
| 24 | 24px | `--spacing-24` |
| 32 | 32px | `--spacing-32` |
| 64 | 64px | `--spacing-64` |
| 70 | 70px | `--spacing-70` |

### Border Radius

| Element | Value |
|---------|-------|
| cards | 12px |
| buttons | 6px |
| general | 6px |
| pillButtons | 15px |

### Shadows

| Name | Value | Token |
|------|-------|-------|
| subtle | `rgba(0, 0, 0, 0.1) 0px 2px 0px 0px` | `--shadow-subtle` |
| md | `rgba(0, 0, 0, 0.14) 0px 5px 12px 0px` | `--shadow-md` |

### Layout

- **Section gap:** 64px
- **Card padding:** 32px
- **Element gap:** 10px

## Components

### Primary Filled Button
**Role:** Call to action button

Solid Marigold Burst (#f57127) background, Midnight Graphite (#000000) text (browser default #0000ee but should be #000000), 10px vertical and 24px horizontal padding, with 15px border-radius, and slight box shadow rgba(0, 0, 0, 0.1) 0px 2px 0px 0px.

### Secondary Outlined Button
**Role:** Secondary action button

Transparent background, Midnight Graphite (#000000) text (browser default #0000ee but should be #000000), 10px vertical and 24px horizontal padding, with 15px border-radius, and slight box shadow rgba(0, 0, 0, 0.1) 0px 2px 0px 0px.

### Ghost Navigation Button
**Role:** Navigation and utility button

Transparent background with Midnight Graphite (#000000) text (browser default #0000ee but should be #000000), 8px vertical and 16px horizontal padding, with 6px border-radius. No shadow.

### Information Card
**Role:** Content container for features or articles

Buttermilk (#fff8f5) background, 32px padding on all sides, 12px border-radius, and a soft elevation shadow rgba(0, 0, 0, 0.14) 0px 5px 12px 0px.

## Do's and Don'ts

### Do
- Use Marigold Burst (#f57127) exclusively for primary calls to action, headlines, and key brand highlights.
- Apply 12px radius to content cards and 6px or 15px (for pill-shaped) to buttons for consistent corner treatments.
- Maintain a compact information density with 10px element gaps and 32px card padding.
- Utilize Americane for all prominent headlines, ensuring tight negative letter spacing at smaller sizes and normal spacing at large sizes for impact.
- Prioritize Canvas White (#ffffff) as the main page background, with Buttermilk (#fff8f5) as a subtle distinction for card backgrounds.
- Employ the subtle rgba(0, 0, 0, 0.14) 0px 5px 12px 0px shadow for cards to create a soft, elevated feel without harshness.
- Use Midnight Graphite (#000000) or Charcoal (#3c3c3c) for all primary body and heading text for optimal readability.

### Don't
- Avoid using Marigold Burst (#f57127) for decorative elements or non-interactive text.
- Do not introduce new border radii beyond 6px, 12px, or 15px.
- Refrain from using strong, dark backgrounds that would compete with the primary light palette.
- Do not deviate from the defined typography for headlines or body text; custom fonts are key to brand identity.
- Do not apply elevation shadows to elements other than cards and primary buttons.
- Avoid large hero imagery or full-bleed visuals that dominate the header; maintain a clean, UI-focused top section.
- Do not use highly saturated colors outside the Marigold Burst brand accent.

## Imagery

The site's imagery primarily consists of product screenshots and abstract, colorful digital art. Product screenshots are contained, often showcasing UI elements within a device frame, focusing on functionality. Abstract art, when present, serves as decorative atmosphere, featuring vibrant color gradients and geometric or organic shapes, sometimes with a blurred or masked treatment. Icons are minimal, outlined, and monochromatic, primarily serving functional roles. The overall density of imagery is balanced, providing context and visual interest without overwhelming the text-dominant portions.

## Layout

The page primarily uses a contained layout with a maximum content width centered on the screen. The hero section is distinct, featuring a large, centered headline combining plain text with a Marigold Burst (#f57127) accent. This is followed by a section containing a video product demo, which appears to be full-width within its given space. Subsequent content sections alternate between text-heavy blocks and product showcases, adhering to consistent vertical spacing. The navigation is a fixed top bar on a white background, with a prominent Marigold Burst (#f57127) primary action button.

## Agent Prompt Guide

Quick Color Reference:
text: #000000
background: #ffffff
border: #000000
accent: #f57127
primary action: #f57127 (filled action)

Example Component Prompts:
1. Create a primary call-to-action button: 'Learn more' text, Marigold Burst (#f57127) background, Midnight Graphite (#000000) text, 15px radius, 10px vertical and 24px horizontal padding, with rgba(0, 0, 0, 0.1) 0px 2px 0px 0px shadow.
2. Create a content card: Buttermilk (#fff8f5) background, 32px padding, 12px radius, and rgba(0, 0, 0, 0.14) 0px 5px 12px 0px shadow.
3. Create a secondary ghost button: 'Download' text, Canvas White (#ffffff) background, Midnight Graphite (#000000) text, 15px radius, 10px vertical and 24px horizontal padding, with rgba(0, 0, 0, 0.1) 0px 2px 0px 0px shadow.
4. Create a hero headline: 'Kosmik is [winding down]' with 'winding down' using Marigold Burst (#f57127) color, Americane Bold 90px, lineHeight 1.00, normal letter-spacing for both sections.

## Similar Brands

- **Figma** — Shared focus on clean UI, prominent primary action buttons, and productivity/design tool context.
- **Milanote** — Similar visual mood board/canvas application, uses a light theme with soft cards and distinct accent colors.
- **Notion** — Emphasizes clear typography with a mix of sans-serifs, and relies on subtle neutrals with functional color accents in a light-themed productivity app across different surface levels.

## Quick Start

### CSS Custom Properties

```css
:root {
  /* Colors */
  --color-canvas-white: #ffffff;
  --color-buttermilk: #fff8f5;
  --color-midnight-graphite: #000000;
  --color-charcoal: #3c3c3c;
  --color-soft-gray: #6a6a6a;
  --color-marigold-burst: #f57127;

  /* Typography — Font Families */
  --font-americane: 'Americane', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-kosmik-sf-compact-display: 'Kosmik SF Compact Display', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-superblue: 'SuperBlue', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-system-ui-sans-serif: 'system-ui, sans-serif', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

  /* Typography — Scale */
  --text-xs: 12px;
  --leading-xs: 1.2;
  --text-xl: 20px;
  --leading-xl: 1.4;
  --text-3xl: 32px;
  --leading-3xl: 1.88;
  --text-5xl: 48px;
  --leading-5xl: 1;
  --text-5xl-2: 90px;
  --leading-5xl-2: 1;

  /* Typography — Weights */
  --font-weight-light: 300;
  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --font-weight-bold: 700;

  /* Spacing */
  --spacing-4: 4px;
  --spacing-6: 6px;
  --spacing-8: 8px;
  --spacing-10: 10px;
  --spacing-12: 12px;
  --spacing-16: 16px;
  --spacing-20: 20px;
  --spacing-21: 21px;
  --spacing-22: 22px;
  --spacing-24: 24px;
  --spacing-32: 32px;
  --spacing-64: 64px;
  --spacing-70: 70px;

  /* Layout */
  --section-gap: 64px;
  --card-padding: 32px;
  --element-gap: 10px;

  /* Border Radius */
  --radius-md: 6px;
  --radius-xl: 12px;
  --radius-xl-2: 15px;

  /* Named Radii */
  --radius-cards: 12px;
  --radius-buttons: 6px;
  --radius-general: 6px;
  --radius-pillbuttons: 15px;

  /* Shadows */
  --shadow-subtle: rgba(0, 0, 0, 0.1) 0px 2px 0px 0px;
  --shadow-md: rgba(0, 0, 0, 0.14) 0px 5px 12px 0px;
}
```

### Tailwind v4

```css
@theme {
  /* Colors */
  --color-canvas-white: #ffffff;
  --color-buttermilk: #fff8f5;
  --color-midnight-graphite: #000000;
  --color-charcoal: #3c3c3c;
  --color-soft-gray: #6a6a6a;
  --color-marigold-burst: #f57127;

  /* Typography */
  --font-americane: 'Americane', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-kosmik-sf-compact-display: 'Kosmik SF Compact Display', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-superblue: 'SuperBlue', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-system-ui-sans-serif: 'system-ui, sans-serif', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

  /* Typography — Scale */
  --text-xs: 12px;
  --leading-xs: 1.2;
  --text-xl: 20px;
  --leading-xl: 1.4;
  --text-3xl: 32px;
  --leading-3xl: 1.88;
  --text-5xl: 48px;
  --leading-5xl: 1;
  --text-5xl-2: 90px;
  --leading-5xl-2: 1;

  /* Spacing */
  --spacing-4: 4px;
  --spacing-6: 6px;
  --spacing-8: 8px;
  --spacing-10: 10px;
  --spacing-12: 12px;
  --spacing-16: 16px;
  --spacing-20: 20px;
  --spacing-21: 21px;
  --spacing-22: 22px;
  --spacing-24: 24px;
  --spacing-32: 32px;
  --spacing-64: 64px;
  --spacing-70: 70px;

  /* Border Radius */
  --radius-md: 6px;
  --radius-xl: 12px;
  --radius-xl-2: 15px;

  /* Shadows */
  --shadow-subtle: rgba(0, 0, 0, 0.1) 0px 2px 0px 0px;
  --shadow-md: rgba(0, 0, 0, 0.14) 0px 5px 12px 0px;
}
```
