# SIRUP 5th Anniversary Special Site — Style Reference
> Midnight command center, high-contrast; functionality through dark surfaces and illuminated accents.

**Theme:** dark

The SIRUP 5th Anniversary site presents a 'midnight command center' aesthetic, characterized by a deep black canvas punctuated by a single vibrant orange accent. Typography is a key identifier, mixing a system sans-serif for body text with several custom display fonts that feature wide letter-spacing. UI elements are dense and dark, with ghost buttons that blend into the background, hinting at interactive states through subtle borders and text color changes. The overall impression is one of intense focus and a strong, almost understated graphic sensibility.

## Tokens — Colors

| Name | Value | Token | Role |
|------|-------|-------|------|
| Midnight Canvas | `#000000` | `--color-midnight-canvas` | Primary page background, component backgrounds, ghost button borders (neutral) |
| Ghost Fill Grey | `#404040` | `--color-ghost-fill-grey` | Subtle ghost button background |
| Muted Ash | `#666666` | `--color-muted-ash` | Secondary surface background, subtle dividers |
| White Frost | `#ffffff` | `--color-white-frost` | Primary text, prominent borders, icon fills, ghost button text |
| Smoke Gray | `#e8e9ed` | `--color-smoke-gray` | Subtle text, less prominent borders, tertiary surface backgrounds |
| Ignition Orange | `#5a1501` | `--color-ignition-orange` | Distinctive background accent for special sections like navigation, content blocks — signifies emphasis or a change in atmosphere |
| Digital Violet | `#4554ac` | `--color-digital-violet` | Violet outline accent for tags, dividers, and focused UI edges. Do not promote it to the primary CTA color |
| Action Violet | `#5262be` | `--color-action-violet` | Violet outline accent for tags, dividers, and focused UI edges. Do not promote it to the primary CTA color |

## Tokens — Typography

### Helvetica Neue — General body text and subheadings. Its clean, utilitarian nature provides a stable base against the more decorative display fonts, ensuring readability in information-dense sections. · `--font-helvetica-neue`
- **Substitute:** Arial
- **Weights:** 400, 700
- **Sizes:** 16px, 32px
- **Line height:** 1.20
- **Letter spacing:** normal
- **OpenType features:** `"palt"`
- **Role:** General body text and subheadings. Its clean, utilitarian nature provides a stable base against the more decorative display fonts, ensuring readability in information-dense sections.

### Termina — Secondary display font for headings and calls to action. Its wide letter-spacing creates a deliberate, almost typographic poster-like feel, establishing a distinct visual voice. · `--font-termina`
- **Substitute:** Montserrat
- **Weights:** 200, 500, 600
- **Sizes:** 11px, 12px, 14px, 15px
- **Line height:** 1.00, 1.13, 2.00
- **Letter spacing:** 0.1em
- **OpenType features:** `"palt"`
- **Role:** Secondary display font for headings and calls to action. Its wide letter-spacing creates a deliberate, almost typographic poster-like feel, establishing a distinct visual voice.

### source-han-sans-japanese — Japanese body text and navigation. A critical component for conveying brand identity in bilingual contexts, ensuring consistent high-quality rendering of Japanese characters with a slightly expanded tracking. · `--font-source-han-sans-japanese`
- **Substitute:** Noto Sans JP
- **Weights:** 400, 500, 700
- **Sizes:** 11px, 14px, 15px
- **Line height:** 1.00, 2.15
- **Letter spacing:** 0.05em
- **OpenType features:** `"palt"`
- **Role:** Japanese body text and navigation. A critical component for conveying brand identity in bilingual contexts, ensuring consistent high-quality rendering of Japanese characters with a slightly expanded tracking.

### Glodok — Decorative accent text, potentially for labels or minor headings. Its extremely wide letter-spacing acts as a pure design element rather than a primary content vehicle, demanding attention through its sparse appearance. · `--font-glodok`
- **Substitute:** Oswald
- **Weights:** 400
- **Sizes:** 16px
- **Line height:** 1.00
- **Letter spacing:** 0.2em
- **OpenType features:** `"palt"`
- **Role:** Decorative accent text, potentially for labels or minor headings. Its extremely wide letter-spacing acts as a pure design element rather than a primary content vehicle, demanding attention through its sparse appearance.

### Type Scale

| Role | Size | Line Height | Letter Spacing | Token |
|------|------|-------------|----------------|-------|
| caption | 11px | 1.13 | — | `--text-caption` |
| body-sm | 12px | 1.13 | — | `--text-body-sm` |
| body | 14px | 1.13 | — | `--text-body` |
| body-lg | 15px | 1.13 | — | `--text-body-lg` |

## Tokens — Spacing & Shapes

**Density:** compact

### Spacing Scale

| Name | Value | Token |
|------|-------|-------|
| 4 | 4px | `--spacing-4` |
| 5 | 5px | `--spacing-5` |
| 6 | 6px | `--spacing-6` |
| 10 | 10px | `--spacing-10` |
| 18 | 18px | `--spacing-18` |
| 30 | 30px | `--spacing-30` |
| 32 | 32px | `--spacing-32` |
| 33 | 33px | `--spacing-33` |
| 60 | 60px | `--spacing-60` |
| 75 | 75px | `--spacing-75` |
| 150 | 150px | `--spacing-150` |
| 180 | 180px | `--spacing-180` |

### Border Radius

| Element | Value |
|---------|-------|
| buttons | 27.5px |
| default | 2.5px |
| circular | 1440px |

### Layout

- **Section gap:** 75px
- **Card padding:** 18px
- **Element gap:** 4px

## Components

### Ghost Button (Text)
**Role:** Primary Call to Action, Navigation

Transparent background, 'White Frost' text (#ffffff), no visible border. Minimalist and blends into the dark canvas, relying on active states for discoverability. Uses Helvetica Neue, 16px.

### Ghost Button (Outlined)
**Role:** Secondary Call to Action, Interactive elements

Transparent background, 'White Frost' text (#ffffff), but featuring a 'Midnight Canvas' (black) border. This variant offers a slightly more defined presence while maintaining a 'ghost' aesthetic. Uses 27.5px border radius if observed.

### Circular Ghost Button
**Role:** Iconic Navigation, Close buttons

Transparent background, 'White Frost' text (#ffffff), 'Midnight Canvas' (black) border, with a fully circular shape (100% border-radius). Used for visually distinct, often icon-only interactions. The current example has no padding.

### Subtle Ghost Button (Filled)
**Role:** Tertiary Call to Action, Toggle states

Semi-transparent 'White Frost' (25% opacity) background, 'White Frost' text (#ffffff), rounded corners at 27.5px. Provides a low-contrast interactive element that is slightly more prominent than a pure ghost button.

### Navigation Bar
**Role:** Global Navigation, Announcements

Background can be 'Midnight Canvas' (#000000) or 'Ignition Orange' (#5a1501). Text primarily 'White Frost' (#ffffff) using Helvetica Neue at normal letter spacing. Contains links and announcements, often full-width.

### Text Content Block (Orange Accent)
**Role:** Highlight sections, Thematic dividers

Background set to 'Ignition Orange' (#5a1501) with 'White Frost' (#ffffff) text. Used to break up the dominant dark background and highlight specific content or periods, often seen in navigation or special feature blocks.

## Do's and Don'ts

### Do
- Always default to 'Midnight Canvas' (#000000) as the background for new sections.
- Use 'White Frost' (#ffffff) for all primary text and critical UI elements against dark backgrounds.
- Apply 'Ignition Orange' (#5a1501) sparingly for high-impact background sections or thematic content blocks, never for small interactive elements.
- Utilize a 27.5px border-radius for interactive buttons and forms to unify their appearance, except for fully circular elements, which use 1440px.
- Employ the 'Termina' font with 0.1em letter-spacing for major headings and display text to establish a distinct brand voice.
- Ensure interactive elements primarily use ghost or outlined styles, with solid fills reserved for subtle, secondary actions.
- Maintain a clear visual hierarchy by limiting prominent chromatic accents to 'Digital Violet' (#4554ac) for decorative purposes or 'Action Violet' (#5262be) for active text states.

### Don't
- Avoid using multiple saturated colors; color should be highly controlled and primarily achromatic with a single brand accent.
- Do not use '#e8e9ed' for primary text; it is reserved for subtle secondary text or background elements.
- Do not introduce new typefaces; only 'Helvetica Neue', 'Termina', 'source-han-sans-japanese', and 'Glodok' are permitted.
- Avoid heavy shadows or gradients; interfaces should feel flat and direct.
- Do not create filled buttons unless specifically using the 'Subtle Ghost Button (Filled)' variant with 25% white opacity.
- Refrain from using tight letter-spacing for 'Termina' or 'Glodok'; their identity is defined by open tracking.
- Do not use 'Ignition Orange' (#5a1501) for small text or icons directly interacting with content, as it functions best as a background accent.

## Imagery

This site features a 'no imagery, pure UI' approach. Visuals are entirely driven by typography, color blocks, and UI elements. The only visual content comes from small icons which appear to be monochrome or use the accent colors. There is a strong emphasis on stark, graphic presentation rather than photographic or illustrative content conveying mood or information.

## Layout

The page primarily follows a full-bleed layout, where sections extend to the edge of the viewport. Content within these sections is often centered, forming distinct vertical blocks. The hero section is full-bleed dark with centered text. Section rhythm is established through alternating background colors, particularly the prominent 'Ignition Orange' (#5a1501) blocks interspersed with the primary 'Midnight Canvas' (#000000) background. Content arrangement leans towards centered stacks for main information and vertically-oriented lists or grids, allowing abundant whitespace for emphasis. Navigation is primarily a sticky header with a compact, ghost-button style that integrates seamlessly into the dark background.

## Agent Prompt Guide

Quick Color Reference:
- text: #ffffff
- background: #000000
- border: #000000 (neutral for ghost buttons)
- accent: #5a1501
- primary action: no distinct CTA color

Example Component Prompts:
- Create a section divider: 'Ignition Orange' (#5a1501) background, with 'White Frost' (#ffffff) text 'SIRUP 2017-2022' using Termina font at 15px, letterSpacing 0.1em.
- Design a ghost interaction button: 'White Frost' (#ffffff) text 'ROOTS PLAYLIST' on a transparent background, with a #000000 border-top, Helvetica Neue 16px, border-radius 27.5px.
- Build a navigation item: 'White Frost' (#ffffff) text 'SIRUP OFFICIAL SITE' using source-han-sans-japanese 14px, letterSpacing 0.05em, within a 'Midnight Canvas' (#000000) background strip.
- Create a subtle ghost button for a menu close: 'Action Violet' (#5262be) text 'CLOSE' with a transparent background, no border, Helvetica Neue 16px.
- Render a prominent brand text: 'Digital Violet' (#4554ac) text 'LOADING' using Glodok font at 16px, letterSpacing 0.2em, on a 'Midnight Canvas' (#000000) background.

## Similar Brands

- **A-Trak** — Visual identity centered on a dark canvas, highly stylized typography, and sparse but impactful accent colors.
- **The Weeknd (Album Sites)** — Dark, moody aesthetic with specific color accents (often red/orange) and custom serif/display typography for a strong artistic brand.
- **Rostam** — Musician portfolio/info sites that prioritize high-contrast, minimalist design with a focus on powerful typography and carefully selected accent colors over heavy imagery.
- **HYPERBEAST** — Utilizes a dark theme with strong typographic treatments and curated splashes of color to highlight content, often with a compact information density.

## Quick Start

### CSS Custom Properties

```css
:root {
  /* Colors */
  --color-midnight-canvas: #000000;
  --color-ghost-fill-grey: #404040;
  --color-muted-ash: #666666;
  --color-white-frost: #ffffff;
  --color-smoke-gray: #e8e9ed;
  --color-ignition-orange: #5a1501;
  --color-digital-violet: #4554ac;
  --color-action-violet: #5262be;

  /* Typography — Font Families */
  --font-helvetica-neue: 'Helvetica Neue', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-termina: 'Termina', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-source-han-sans-japanese: 'source-han-sans-japanese', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-glodok: 'Glodok', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

  /* Typography — Scale */
  --text-caption: 11px;
  --leading-caption: 1.13;
  --text-body-sm: 12px;
  --leading-body-sm: 1.13;
  --text-body: 14px;
  --leading-body: 1.13;
  --text-body-lg: 15px;
  --leading-body-lg: 1.13;

  /* Typography — Weights */
  --font-weight-extralight: 200;
  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;

  /* Spacing */
  --spacing-4: 4px;
  --spacing-5: 5px;
  --spacing-6: 6px;
  --spacing-10: 10px;
  --spacing-18: 18px;
  --spacing-30: 30px;
  --spacing-32: 32px;
  --spacing-33: 33px;
  --spacing-60: 60px;
  --spacing-75: 75px;
  --spacing-150: 150px;
  --spacing-180: 180px;

  /* Layout */
  --section-gap: 75px;
  --card-padding: 18px;
  --element-gap: 4px;

  /* Border Radius */
  --radius-sm: 2.5px;
  --radius-3xl: 27.5px;
  --radius-full: 1440px;

  /* Named Radii */
  --radius-buttons: 27.5px;
  --radius-default: 2.5px;
  --radius-circular: 1440px;
}
```

### Tailwind v4

```css
@theme {
  /* Colors */
  --color-midnight-canvas: #000000;
  --color-ghost-fill-grey: #404040;
  --color-muted-ash: #666666;
  --color-white-frost: #ffffff;
  --color-smoke-gray: #e8e9ed;
  --color-ignition-orange: #5a1501;
  --color-digital-violet: #4554ac;
  --color-action-violet: #5262be;

  /* Typography */
  --font-helvetica-neue: 'Helvetica Neue', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-termina: 'Termina', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-source-han-sans-japanese: 'source-han-sans-japanese', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-glodok: 'Glodok', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

  /* Typography — Scale */
  --text-caption: 11px;
  --leading-caption: 1.13;
  --text-body-sm: 12px;
  --leading-body-sm: 1.13;
  --text-body: 14px;
  --leading-body: 1.13;
  --text-body-lg: 15px;
  --leading-body-lg: 1.13;

  /* Spacing */
  --spacing-4: 4px;
  --spacing-5: 5px;
  --spacing-6: 6px;
  --spacing-10: 10px;
  --spacing-18: 18px;
  --spacing-30: 30px;
  --spacing-32: 32px;
  --spacing-33: 33px;
  --spacing-60: 60px;
  --spacing-75: 75px;
  --spacing-150: 150px;
  --spacing-180: 180px;

  /* Border Radius */
  --radius-sm: 2.5px;
  --radius-3xl: 27.5px;
  --radius-full: 1440px;
}
```
