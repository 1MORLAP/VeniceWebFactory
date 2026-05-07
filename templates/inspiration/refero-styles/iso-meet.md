# ISO Meet — Style Reference
> White canvas, crisp black ink

**Theme:** light

ISO Meet establishes a focused, minimalist aesthetic with a canvas of crisp whites and soft grays, punctuated by precise black typography. The layout emphasizes breathing room and clear functional separation, using soft card shadows for subtle hierarchy. Components lean towards understated, adaptive forms with generous padding, making the interface feel spacious and inviting. The visual system supports a 'work-focused yet approachable' atmosphere, with hints of gentle gradient accents as stylistic touches rather than dominant features.

## Tokens — Colors

| Name | Value | Token | Role |
|------|-------|-------|------|
| Canvas White | `#ffffff` | `--color-canvas-white` | Primary page background, elevated card surfaces, clean default background for many components |
| Ink Black | `#000000` | `--color-ink-black` | Primary text, headers, and essential structural borders. This color anchors the monochrome palette |
| Ghost Gray | `#f2f2f2` | `--color-ghost-gray` | Secondary background for cards, input fields, and badge backgrounds. Provides subtle surface distinction from the main canvas |
| Muted Stone | `#999999` | `--color-muted-stone` | Secondary text (e.g., helper text), muted links, and subtle borders. Offers softer contrast for less prominent information |
| Outline Gray | `#cccccc` | `--color-outline-gray` | Hairline borders and separators, creating division without visual weight |
| Subtle Black | `#222222` | `--color-subtle-black` | Button text and borders with slightly softer contrast than Ink Black |
| Placeholder Dusky | `#808080` | `--color-placeholder-dusky` | Placeholder text in input fields |
| Lavender Mist Gradient | `linear-gradient(rgb(247, 243, 255), rgb(229, 215, 255))` | `--color-lavender-mist-gradient` | Decorative background for featured sections or special content cards, adding a soft, ethereal touch |
| Mint Whisper Gradient | `linear-gradient(170deg, rgb(236, 247, 241), rgb(179, 226, 207))` | `--color-mint-whisper-gradient` | Decorative background for callouts or illustrative sections, providing a gentle organic feel |

## Tokens — Typography

### Instrument Sans — The primary typeface for all UI elements, body text, and some headings. Its clean, geometric forms maintain a professional yet approachable tone. Sizes 12-28px are used for body content and smaller headings, while larger sizes are for impactful headlines. · `--font-instrument-sans`
- **Substitute:** Inter
- **Weights:** 400, 500, 700
- **Sizes:** 12px, 16px, 18px, 20px, 28px, 48px, 60px
- **Line height:** 1.00, 1.12, 1.20, 1.50, 1.67
- **Letter spacing:** -0.010em at 12px, -0.013em at 16px, -0.016em at 18px
- **Role:** The primary typeface for all UI elements, body text, and some headings. Its clean, geometric forms maintain a professional yet approachable tone. Sizes 12-28px are used for body content and smaller headings, while larger sizes are for impactful headlines.

### Instrument Serif — Used for distinctive, large headlines to add a touch of classic sophistication against the modern sans-serif body. The serif provides visual contrast and a hint of gravitas without being heavy. · `--font-instrument-serif`
- **Substitute:** Playfair Display
- **Weights:** 400
- **Sizes:** 48px, 60px
- **Line height:** 1.12, 1.20
- **Letter spacing:** -0.020em at 48px, -0.010em at 60px
- **Role:** Used for distinctive, large headlines to add a touch of classic sophistication against the modern sans-serif body. The serif provides visual contrast and a hint of gravitas without being heavy.

### Type Scale

| Role | Size | Line Height | Letter Spacing | Token |
|------|------|-------------|----------------|-------|
| caption | 12px | 1.5 | -0.12px | `--text-caption` |
| body-sm | 16px | 1.5 | -0.21px | `--text-body-sm` |
| body | 18px | 1.67 | -0.29px | `--text-body` |
| subheading | 20px | 1.2 | -0.26px | `--text-subheading` |
| heading | 28px | 1.2 | -0.36px | `--text-heading` |
| heading-lg | 48px | 1.12 | -0.96px | `--text-heading-lg` |
| display | 60px | 1.12 | -1.2px | `--text-display` |

## Tokens — Spacing & Shapes

**Base unit:** 4px

**Density:** comfortable

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
| 44 | 44px | `--spacing-44` |
| 48 | 48px | `--spacing-48` |
| 56 | 56px | `--spacing-56` |
| 64 | 64px | `--spacing-64` |
| 72 | 72px | `--spacing-72` |
| 80 | 80px | `--spacing-80` |

### Border Radius

| Element | Value |
|---------|-------|
| cards | 24px |
| small | 8px |
| badges | 50px |
| inputs | 80px |
| buttons | 160px |

### Shadows

| Name | Value | Token |
|------|-------|-------|
| md | `rgba(13, 32, 47, 0.04) 0px 0px 14px 0px` | `--shadow-md` |
| md-2 | `rgba(0, 0, 0, 0.09) 4px 12px 12px 0px, rgba(0, 0, 0, 0.1)...` | `--shadow-md-2` |
| md-3 | `rgba(0, 0, 0, 0.1) 2px 7px 15px 0px, rgba(0, 0, 0, 0.09) ...` | `--shadow-md-3` |
| subtle | `rgba(0, 0, 0, 0.08) 0px 1px 1px 0px, rgba(0, 0, 0, 0.12) ...` | `--shadow-subtle` |

### Layout

- **Page max-width:** 1328px
- **Section gap:** 48px
- **Card padding:** 40px
- **Element gap:** 18px

## Components

### Ghost Navigation Button
**Role:** Primary navigation links and secondary actions

Text-only button with Ink Black text, Instrument Sans 400, 16px. No background or borders by default, but reveals a subtle underline or different text color on hover/active states.

### Pill Button
**Role:** Call-to-action button for primary actions

A very rounded button with Subtle Black text (#222222), on a transparent background, with a 1px solid border of Subtle Black. Padding is 10px vertically and 16px horizontally. Uses Instrument Sans 400, 16px.

### Monochrome Filled Button
**Role:** Important secondary actions or form submissions

Solid black background (#000000) with white text (#ffffff), extremely rounded corners at 160px. Uses Instrument Sans 400, 16px. Padding is 10px vertically and 16px horizontally.

### Feature Card
**Role:** Grouping related information or showcasing features

Ghost Gray background, 24px border radius. Padding of 40px on all sides. No visible border or shadow by default, relying on background contrast for definition.

### Input Field
**Role:** Standard input for text or data entry

Ghost Gray background, 80px border-radius, giving it a pill-like shape. Black text and placeholder text using Placeholder Dusky. Padding of 8px vertical, 18px horizontal. Inherits Instrument Sans.

### Information Badge
**Role:** Categorization or short status labels

Ghost Gray background with Ink Black text. Very rounded, 50px border-radius. Padding 10px vertical, 16px horizontal.

### Elevated Content Card
**Role:** Highlighting key information or interactive elements, like a tooltip or special offer.

Canvas White background (#ffffff) with a soft shadow for subtle elevation: rgba(13, 32, 47, 0.04) 0px 0px 14px 0px. Rounded corners (12px radius, but specific cards use 24px and 32px based on context).

## Do's and Don'ts

### Do
- Prioritize Canvas White (#ffffff) for all main backgrounds to maintain a clean, open feel.
- Use Ink Black (#000000) for primary text, headings, and interactive elements to ensure strong contrast and visual hierarchy.
- Apply Ghost Gray (#f2f2f2) consistently for secondary backgrounds such as input fields, badges, and background cards.
- Employ the Instrument Sans family for all general UI text and body content, reserving Instrument Serif for larger, impactful headlines (48px and 60px) only.
- Round all interactive elements and content containers generously. Use 80px for inputs, 160px for full-bleed buttons, 50px for badges, and 24px for cards.
- Maintain comfortable visual breathing room with 'elementGap' at 18px and 'cardPadding' at 40px to ensure a spacious layout.
- Use soft, subtle shadows like `rgba(13, 32, 47, 0.04) 0px 0px 14px 0px` for elevation, avoiding harsh or opaque shadow effects.
- Ensure letter-spacing is applied per the typography specification, particularly for headlines, to achieve the intended precision and feel.

### Don't
- Avoid using highly saturated colors. The palette is intentionally monochrome with accent gradients reserved for decorative or atmospheric purposes.
- Do not use heavy, dark shadows. Elevation should be subtle, created with low-opacity, diffused shadows.
- Do not mix Instrument Sans and Instrument Serif at similar font sizes or within the same paragraph; maintain clear roles for each typeface.
- Avoid tight spacing. Respect the generous 'elementGap' and 'cardPadding' to prevent a cramped or dense appearance.
- Do not introduce strong, visible borders or dividers. Borders should be hairline, transparent, or rely on background contrast.
- Refrain from using color to indicate states unless explicitly defined (e.g., success/error shades are not part of this system). Rely on opacity or border changes instead.
- Never override the letter-spacing values specified in the typography section, as they are crucial for the distinct feel of the headlines.

## Elevation

- **Elevated Content Card:** `rgba(13, 32, 47, 0.04) 0px 0px 14px 0px`
- **Hover/Active States:** `rgba(0, 0, 0, 0.09) 4px 12px 12px 0px, rgba(0, 0, 0, 0.1) 1px 3px 7px 0px`
- **Highlight/Focus State:** `rgba(0, 0, 0, 0.1) 2px 7px 15px 0px, rgba(0, 0, 0, 0.09) 8px 27px 28px 0px`
- **Button Focus:** `rgba(0, 0, 0, 0.08) 0px 1px 1px 0px, rgba(0, 0, 0, 0.12) 0px 2px 4px 0px, rgba(0, 0, 0, 0.04) 0px 0px 0px 0.5px`

## Imagery

The site predominantly uses photography, with a focus on abstract or artfully composed shots featuring creative professionals in motion or thoughtful poses. Imagery often has a desaturated, slightly moody quality with soft lighting, avoiding overly vibrant colors. Images are typically contained within rounded containers or serve as atmospheric backgrounds rather than raw, full-bleed elements. Icons are minimal, outlined, and monochromatic, with a thin stroke weight that aligns with the overall refined aesthetic. The imagery serves to create an atmosphere of modern creativity and quiet professionalism.

## Layout

The page adheres to a max-width 1328px centered container, providing a structured and spacious canvas. Hero sections often feature a split-screen or centered headline over an evocative background image. Content typically arranges in alternating text and visual sections, creating a dynamic yet balanced rhythm. Feature displays regularly use card grids (e.g., 3-column) with consistent vertical spacing between sections (sectionGap: 48px). The navigation is a minimalist top bar with ghost links, maintaining a light header footprint. The overall density feels comfortable and open, prioritizing clear information delivery over cramped layouts.

## Agent Prompt Guide

Quick Color Reference:
text: #000000
background: #ffffff
border: #cccccc
accent: #e5d7ff (Lavender Mist Gradient)
primary action: no distinct CTA color

Example Component Prompts:
Create a hero headline: 'Meet. Collaborate. Hire.' using Instrument Serif 60px, weight 400, Ink Black, with letter-spacing -1.2px.
Create an input field: Ghost Gray background, 80px radius, 8px vertical and 18px horizontal padding, with Placeholder Dusky text. Use Instrument Sans 400, 16px.
Create a Feature Card: Ghost Gray background, 24px radius, 40px padding on all sides. Use Instrument Sans 400, 18px for body text and Ink Black, Instrument Sans 500, 28px for titles.
Create a Pill Button: Transparent background, 1px Subtle Black border, 160px radius. Text is Subtle Black, Instrument Sans 400, 16px. Padding 10px vertical, 16px horizontal.
Create an Elevated Content Card for a special offer: Canvas White background, 12px radius, with a shadow of `rgba(13, 32, 47, 0.04) 0px 0px 14px 0px`.

## Similar Brands

- **Superhuman** — Monochromatic interface with crisp typography and subtle use of elevation.
- **Linear.app** — Clean whitespace, tight typographic details, and functional, understated UI elements.
- **Figma** — Emphasis on clear UI, generous spacing, and a focus on content through minimalist design.
- **Notion** — White background, black text, with a strong focus on information hierarchy and readability through typography.

## Quick Start

### CSS Custom Properties

```css
:root {
  /* Colors */
  --color-canvas-white: #ffffff;
  --color-ink-black: #000000;
  --color-ghost-gray: #f2f2f2;
  --color-muted-stone: #999999;
  --color-outline-gray: #cccccc;
  --color-subtle-black: #222222;
  --color-placeholder-dusky: #808080;
  --color-lavender-mist-gradient: #e5d7ff;
  --gradient-lavender-mist-gradient: linear-gradient(rgb(247, 243, 255), rgb(229, 215, 255));
  --color-mint-whisper-gradient: #b3e2cf;
  --gradient-mint-whisper-gradient: linear-gradient(170deg, rgb(236, 247, 241), rgb(179, 226, 207));

  /* Typography — Font Families */
  --font-instrument-sans: 'Instrument Sans', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-instrument-serif: 'Instrument Serif', ui-serif, Georgia, Cambria, "Times New Roman", Times, serif;

  /* Typography — Scale */
  --text-caption: 12px;
  --leading-caption: 1.5;
  --tracking-caption: -0.12px;
  --text-body-sm: 16px;
  --leading-body-sm: 1.5;
  --tracking-body-sm: -0.21px;
  --text-body: 18px;
  --leading-body: 1.67;
  --tracking-body: -0.29px;
  --text-subheading: 20px;
  --leading-subheading: 1.2;
  --tracking-subheading: -0.26px;
  --text-heading: 28px;
  --leading-heading: 1.2;
  --tracking-heading: -0.36px;
  --text-heading-lg: 48px;
  --leading-heading-lg: 1.12;
  --tracking-heading-lg: -0.96px;
  --text-display: 60px;
  --leading-display: 1.12;
  --tracking-display: -1.2px;

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
  --spacing-44: 44px;
  --spacing-48: 48px;
  --spacing-56: 56px;
  --spacing-64: 64px;
  --spacing-72: 72px;
  --spacing-80: 80px;

  /* Layout */
  --page-max-width: 1328px;
  --section-gap: 48px;
  --card-padding: 40px;
  --element-gap: 18px;

  /* Border Radius */
  --radius-sm: 3px;
  --radius-lg: 8px;
  --radius-xl: 12px;
  --radius-2xl: 16px;
  --radius-3xl: 24px;
  --radius-3xl-2: 32px;
  --radius-full: 50px;
  --radius-full-2: 80px;
  --radius-full-3: 160px;

  /* Named Radii */
  --radius-cards: 24px;
  --radius-small: 8px;
  --radius-badges: 50px;
  --radius-inputs: 80px;
  --radius-buttons: 160px;

  /* Shadows */
  --shadow-md: rgba(13, 32, 47, 0.04) 0px 0px 14px 0px;
  --shadow-md-2: rgba(0, 0, 0, 0.09) 4px 12px 12px 0px, rgba(0, 0, 0, 0.1) 1px 3px 7px 0px;
  --shadow-md-3: rgba(0, 0, 0, 0.1) 2px 7px 15px 0px, rgba(0, 0, 0, 0.09) 8px 27px 28px 0px;
  --shadow-subtle: rgba(0, 0, 0, 0.08) 0px 1px 1px 0px, rgba(0, 0, 0, 0.12) 0px 2px 4px 0px, rgba(0, 0, 0, 0.04) 0px 0px 0px 0.5px;
}
```

### Tailwind v4

```css
@theme {
  /* Colors */
  --color-canvas-white: #ffffff;
  --color-ink-black: #000000;
  --color-ghost-gray: #f2f2f2;
  --color-muted-stone: #999999;
  --color-outline-gray: #cccccc;
  --color-subtle-black: #222222;
  --color-placeholder-dusky: #808080;
  --color-lavender-mist-gradient: #e5d7ff;
  --color-mint-whisper-gradient: #b3e2cf;

  /* Typography */
  --font-instrument-sans: 'Instrument Sans', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-instrument-serif: 'Instrument Serif', ui-serif, Georgia, Cambria, "Times New Roman", Times, serif;

  /* Typography — Scale */
  --text-caption: 12px;
  --leading-caption: 1.5;
  --tracking-caption: -0.12px;
  --text-body-sm: 16px;
  --leading-body-sm: 1.5;
  --tracking-body-sm: -0.21px;
  --text-body: 18px;
  --leading-body: 1.67;
  --tracking-body: -0.29px;
  --text-subheading: 20px;
  --leading-subheading: 1.2;
  --tracking-subheading: -0.26px;
  --text-heading: 28px;
  --leading-heading: 1.2;
  --tracking-heading: -0.36px;
  --text-heading-lg: 48px;
  --leading-heading-lg: 1.12;
  --tracking-heading-lg: -0.96px;
  --text-display: 60px;
  --leading-display: 1.12;
  --tracking-display: -1.2px;

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
  --spacing-44: 44px;
  --spacing-48: 48px;
  --spacing-56: 56px;
  --spacing-64: 64px;
  --spacing-72: 72px;
  --spacing-80: 80px;

  /* Border Radius */
  --radius-sm: 3px;
  --radius-lg: 8px;
  --radius-xl: 12px;
  --radius-2xl: 16px;
  --radius-3xl: 24px;
  --radius-3xl-2: 32px;
  --radius-full: 50px;
  --radius-full-2: 80px;
  --radius-full-3: 160px;

  /* Shadows */
  --shadow-md: rgba(13, 32, 47, 0.04) 0px 0px 14px 0px;
  --shadow-md-2: rgba(0, 0, 0, 0.09) 4px 12px 12px 0px, rgba(0, 0, 0, 0.1) 1px 3px 7px 0px;
  --shadow-md-3: rgba(0, 0, 0, 0.1) 2px 7px 15px 0px, rgba(0, 0, 0, 0.09) 8px 27px 28px 0px;
  --shadow-subtle: rgba(0, 0, 0, 0.08) 0px 1px 1px 0px, rgba(0, 0, 0, 0.12) 0px 2px 4px 0px, rgba(0, 0, 0, 0.04) 0px 0px 0px 0.5px;
}
```
