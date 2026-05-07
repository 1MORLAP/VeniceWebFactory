# Maxima Therapy — Style Reference
> Vibrant, rounded play-world. All surfaces are soft, every color is a smile.

**Theme:** light

This design system feels like a playful, vibrant activity center for the mind. A maximalist use of saturated primary and secondary colors, especially the 'Sunshine Yellow' background, instantly communicates an optimistic and engaging environment. Rounded shapes on cards and buttons, paired with a custom rounded display font, create an approachable, friendly aesthetic. The visual energy is high, reflecting a dynamic and supportive approach to therapy.

## Tokens — Colors

| Name | Value | Token | Role |
|------|-------|-------|------|
| Midnight Ink | `#000000` | `--color-midnight-ink` | Primary text, critical UI elements, high-contrast outlines. |
| Paper White | `#ffffff` | `--color-paper-white` | UI backgrounds, button text on primary accents, badge backgrounds. |
| Light Linen | `#fff6ed` | `--color-light-linen` | Subtle background shading, neutral illustration fills. |
| Sunshine Yellow | `#fdcb40` | `--color-sunshine-yellow` | Dominant page background, hero accents, main headings — establishes the core playful and optimistic tone. |
| Ocean Blue | `#006cff` | `--color-ocean-blue` | Navigation active states, interactive card elements, secondary brand accent in illustrations. |
| Action Orange | `#fd4401` | `--color-action-orange` | Call-to-action buttons, key interactive elements, highlighted card backgrounds — provides high-energy contrast against primary yellow and blue. |
| Grass Green | `#00b351` | `--color-grass-green` | Decorative elements, illustration accents, and occasional secondary brand highlights. |
| Bubblegum Pink | `#f780d4` | `--color-bubblegum-pink` | Decorative illustration accents, adding to the playful and diverse color palette. |
| Teal Splash | `#04c6c5` | `--color-teal-splash` | Illustration details, secondary decorative accents. |
| Pale Lemon | `#fff2b7` | `--color-pale-lemon` | Subtle background for UI elements, supportive color for 'Sunshine Yellow'. |
| Grape Punch | `#a864fd` | `--color-grape-punch` | Vivid accent color in illustrations. |

## Tokens — Typography

### ABC Diatype Rounded Plus — Primary UI font for navigation, buttons, badges, and card titles. Its rounded geometric forms reinforce the approachable and friendly aesthetic. · `--font-abc-diatype-rounded-plus`
- **Substitute:** Outfit
- **Weights:** 500, 700
- **Sizes:** 14px, 15px, 19px, 24px, 33px
- **Line height:** 1.05, 1.20, 2.90
- **Letter spacing:** -0.02
- **Role:** Primary UI font for navigation, buttons, badges, and card titles. Its rounded geometric forms reinforce the approachable and friendly aesthetic.

### Robuck Rounded — Display font for large, impactful headlines, particularly in hero sections — its extreme roundness and tight line height create a distinct, jovial character. · `--font-robuck-rounded`
- **Substitute:** Fredoka One
- **Weights:** 400
- **Sizes:** 62px, 214px
- **Line height:** 0.80
- **Letter spacing:** 0
- **Role:** Display font for large, impactful headlines, particularly in hero sections — its extreme roundness and tight line height create a distinct, jovial character.

### ABC Diatype Rounded — Ultra-heavy display text for artistic, oversized visual elements, often as background text or part of a graphical composition. Its monumental scale becomes a design feature. · `--font-abc-diatype-rounded`
- **Substitute:** Outfit
- **Weights:** 900
- **Sizes:** 575px
- **Line height:** 1.20
- **Letter spacing:** -0.02
- **Role:** Ultra-heavy display text for artistic, oversized visual elements, often as background text or part of a graphical composition. Its monumental scale becomes a design feature.

### ui-sans-serif — System fallback for body text and general content, ensuring legibility and accessibility across various platforms. · `--font-ui-sans-serif`
- **Substitute:** system-ui
- **Weights:** 400
- **Sizes:** 15px
- **Line height:** 1.50
- **Letter spacing:** 0
- **Role:** System fallback for body text and general content, ensuring legibility and accessibility across various platforms.

### Type Scale

| Role | Size | Line Height | Letter Spacing | Token |
|------|------|-------------|----------------|-------|
| caption | 14px | 1.5 | -0.02px | `--text-caption` |
| subheading | 19px | 1.2 | -0.02px | `--text-subheading` |
| heading | 24px | 1.2 | -0.02px | `--text-heading` |
| heading-lg | 33px | 1.05 | -0.02px | `--text-heading-lg` |
| display | 62px | 0.8 | — | `--text-display` |

## Tokens — Spacing & Shapes

**Base unit:** 4px

**Density:** spacious

### Spacing Scale

| Name | Value | Token |
|------|-------|-------|
| 4 | 4px | `--spacing-4` |
| 7 | 7px | `--spacing-7` |
| 8 | 8px | `--spacing-8` |
| 13 | 13px | `--spacing-13` |
| 15 | 15px | `--spacing-15` |
| 19 | 19px | `--spacing-19` |
| 27 | 27px | `--spacing-27` |
| 36 | 36px | `--spacing-36` |
| 38 | 38px | `--spacing-38` |
| 43 | 43px | `--spacing-43` |
| 48 | 48px | `--spacing-48` |
| 57 | 57px | `--spacing-57` |
| 77 | 77px | `--spacing-77` |
| 119 | 119px | `--spacing-119` |

### Border Radius

| Element | Value |
|---------|-------|
| cards | 23.81px |
| badges | 4.76px |
| buttons | 47.62px |
| general | 9.52px |

### Layout

- **Section gap:** 38px
- **Card padding:** 48px
- **Element gap:** 4-19px

## Components

### Navigation Link
**Role:** Primary navigation item

Text only, uses `ABC Diatype Rounded Plus` weight 500 at 15px, color `Midnight Ink` (#000000). Active state or hover might introduce `Ocean Blue`.

### Primary Donate Button
**Role:** Call-to-action button

Filled with `Action Orange` (#fd4401), text `Paper White` (`#ffffff`), `ABC Diatype Rounded Plus` font, 47.62px border radius. Padding is generous `26.67px` horizontal.

### Ghost Arrow Button
**Role:** Navigation button for content sliders

Circular button with `Paper White` background, `Midnight Ink` content, 50% border radius. No explicit padding mentioned, relies on icon sizing.

### Hero Section Card
**Role:** Prominent information card in hero section

Filled with `Action Orange` (#fd4401), 23.81px border radius, substantial `47.62px` horizontal padding and `57.14px` vertical padding. Contains bold headlines and body text in `Paper White`.

### Informational Card - Sunshine Yellow
**Role:** General content card

Filled with `Sunshine Yellow` (#fdcb40), 23.81px border radius. Used for feature highlights.

### Program Age Badge
**Role:** Small descriptive tag

Filled with `Paper White` (#ffffff), text `Midnight Ink` (#000000), 4.76px border radius. Text uses `ABC Diatype Rounded Plus` weight 500 at 14px. Padding is `6.67px` horizontal, `4.19px` vertical.

### Default Button
**Role:** Standard interactive element (e.g. cookie preference)

Outline-style with `Paper White` text, transparent background, 47.62px border radius.

### Input Field
**Role:** User input area

Implicitly present (e.g., in footer for email). Appears to have a `Paper White` background, `Midnight Ink` text, and subtle borders in a neutral tone like `#f0f4f7` (from CSS tokens, though not explicitly shown in components data as border color of input).

## Do's and Don'ts

### Do
- Always use 'Sunshine Yellow' (#fdcb40) as the primary background color for pages and major sections to maintain a high-energy, positive mood.
- Apply `Action Orange` (#fd4401) exclusively for primary calls-to-action to maximize impact and user engagement.
- Ensure all interactive elements like buttons and key cards have a `23.81px` or `47.62px` border radius, creating a consistent soft and approachable feel.
- Use `ABC Diatype Rounded Plus` for all UI text, such as navigation, buttons, and card titles, keeping its -0.02em letter spacing for a compact, friendly look.
- Employ `Robuck Rounded` at 62px and above for major display headlines, leveraging its low line height (0.8) to create distinctive, stacked typographic compositions.
- Utilize a generous `48px` padding within cards to ensure sufficient white space and legibility in information-dense areas.
- Integrate the vibrant accent colors like 'Ocean Blue' (#006cff), 'Bubblegum Pink' (#f780d4), and 'Teal Splash' (#04c6c5) primarily in illustrations and decorative elements, carefully balancing their intensity.

### Don't
- Do not use sharp corners; ensure all UI elements such as cards, buttons, and badges adhere to the specified radii, typically `23.81px` or `47.62px`.
- Avoid generic system fonts for prominent headlines; always prioritize `Robuck Rounded` for its unique, playful character at display sizes.
- Do not desaturate the primary brand colors; the system thrives on vivid hues like 'Sunshine Yellow' and 'Action Orange'.
- Avoid excessive text density; break up content into manageable blocks with ample spacing, referencing the `48px` card padding and `38px` section gaps.
- Do not introduce new primary or accent colors outside the defined palette; the current set is carefully chosen for its energetic harmony.
- Refrain from using shadows for elevation; rely on color contrast and distinct background colors to differentiate surfaces and sections.
- Do not use letter-spacing: normal for text set in `ABC Diatype Rounded Plus`; always apply `-0.02em` to maintain its characteristic compact appearance.

## Imagery

The visual language is dominantly illustration-based, featuring abstract, organic shapes alongside hard-edged geometric forms, creating a playful and imaginative environment. Illustrations are highly stylized, using a vibrant, multi-color palette (Ocean Blue, Bubblegum Pink, Teal Splash, Grass Green, Grape Punch) that often overlaps or is nested. Figures are simplified and often smiling, conveying warmth and approachability. The purpose of the imagery is primarily decorative atmosphere and to convey a sense of fun and support, rather than explicit content explanation. Density is moderate, with illustrations frequently filling large sections of the canvas, but leaving space for key text elements.

## Layout

The page model is primarily full-bleed with a strong emphasis on vivid background colors that extend to the viewport edges. The hero section is a full-viewport illustration with a prominent, vertically centered headline. Section rhythm often alternates between large, visually rich illustrated backgrounds and sections with simpler, solid 'Sunshine Yellow' backgrounds. Content arrangement is flexible, often featuring centered text blocks over the main yellow background, or text overlaid on abstract shapes within illustrations. There's an underlying grid for content cards (not explicitly defined but observable in component structures) and significant vertical spacing between logical sections. Navigation is a consistent top bar, with prominent 'Donate' button.

## Agent Prompt Guide

### Quick Color Reference
- **Text:** `#000000` (Midnight Ink)
- **Background:** `#fdcb40` (Sunshine Yellow, overall page); `#ffffff` (Paper White, general UI elements)
- **CTA:** `#fd4401` (Action Orange)
- **Border:** `#fd4401` (Action Orange, for outlined elements)
- **Accent:** `#006cff` (Ocean Blue)

### 3-5 Example Component Prompts
1. **Create a Primary Donate Button:** Fill with `#fd4401`, text `#ffffff` using `ABC Diatype Rounded Plus` weight 500 at 15px, `47.62px` border radius, padding `26.67px` horizontal for the content. 
2. **Generate a Hero Section Card for a program:** Card background `#fd4401`, `23.81px` border radius. Headline 'EARLY INTERVENTION' in `Robuck Rounded` weight 400 at 62px, color `#ffffff`. Sub-badge 'Ages 0-3' with background `#ffffff`, text `#000000`, `ABC Diatype Rounded Plus` weight 500 at 14px, `4.76px` border radius, `6.67px` horizontal padding. Body text 'Nurturing growth through play, therapy...' in `ABC Diatype Rounded Plus` weight 500 at 15px, color `#ffffff`. Use `48px` card padding.
3. **Design a Navigation Link:** Text 'Programs' in `ABC Diatype Rounded Plus` weight 500 at 15px, color `#000000`, letter-spacing `-0.02em`. Ensure an interactive state indicates with a touch of `Ocean Blue`.

## Similar Brands

- **Headspace** — Shares a vibrant, illustration-heavy aesthetic with organic shapes and bright, calming color palettes, often focused on well-being.
- **Duolingo** — Utilizes a highly stylized, character-driven illustration style with bold colors and rounded forms to create an engaging, educational experience.
- **Calm** — Employs serene, often abstract illustrations with a focus on color and atmosphere to convey emotional states, similar to how Maxima uses visuals for mood.
- **KiwiCo** — A playful, educational brand that uses bright, saturated colors and friendly illustrations to appeal to children and families, much like Maxima Therapy.

## Quick Start

### CSS Custom Properties

```css
:root {
  /* Colors */
  --color-midnight-ink: #000000;
  --color-paper-white: #ffffff;
  --color-light-linen: #fff6ed;
  --color-sunshine-yellow: #fdcb40;
  --color-ocean-blue: #006cff;
  --color-action-orange: #fd4401;
  --color-grass-green: #00b351;
  --color-bubblegum-pink: #f780d4;
  --color-teal-splash: #04c6c5;
  --color-pale-lemon: #fff2b7;
  --color-grape-punch: #a864fd;

  /* Typography — Font Families */
  --font-abc-diatype-rounded-plus: 'ABC Diatype Rounded Plus', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-robuck-rounded: 'Robuck Rounded', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-abc-diatype-rounded: 'ABC Diatype Rounded', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-ui-sans-serif: 'ui-sans-serif', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

  /* Typography — Scale */
  --text-caption: 14px;
  --leading-caption: 1.5;
  --tracking-caption: -0.02px;
  --text-subheading: 19px;
  --leading-subheading: 1.2;
  --tracking-subheading: -0.02px;
  --text-heading: 24px;
  --leading-heading: 1.2;
  --tracking-heading: -0.02px;
  --text-heading-lg: 33px;
  --leading-heading-lg: 1.05;
  --tracking-heading-lg: -0.02px;
  --text-display: 62px;
  --leading-display: 0.8;

  /* Typography — Weights */
  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --font-weight-bold: 700;
  --font-weight-black: 900;

  /* Spacing */
  --spacing-unit: 4px;
  --spacing-4: 4px;
  --spacing-7: 7px;
  --spacing-8: 8px;
  --spacing-13: 13px;
  --spacing-15: 15px;
  --spacing-19: 19px;
  --spacing-27: 27px;
  --spacing-36: 36px;
  --spacing-38: 38px;
  --spacing-43: 43px;
  --spacing-48: 48px;
  --spacing-57: 57px;
  --spacing-77: 77px;
  --spacing-119: 119px;

  /* Layout */
  --section-gap: 38px;
  --card-padding: 48px;
  --element-gap: 4-19px;

  /* Border Radius */
  --radius-md: 4.7619px;
  --radius-lg: 9.5238px;
  --radius-3xl: 23.8095px;
  --radius-3xl-2: 33.3333px;
  --radius-full: 47.619px;

  /* Named Radii */
  --radius-cards: 23.81px;
  --radius-badges: 4.76px;
  --radius-buttons: 47.62px;
  --radius-general: 9.52px;
}
```

### Tailwind v4

```css
@theme {
  /* Colors */
  --color-midnight-ink: #000000;
  --color-paper-white: #ffffff;
  --color-light-linen: #fff6ed;
  --color-sunshine-yellow: #fdcb40;
  --color-ocean-blue: #006cff;
  --color-action-orange: #fd4401;
  --color-grass-green: #00b351;
  --color-bubblegum-pink: #f780d4;
  --color-teal-splash: #04c6c5;
  --color-pale-lemon: #fff2b7;
  --color-grape-punch: #a864fd;

  /* Typography */
  --font-abc-diatype-rounded-plus: 'ABC Diatype Rounded Plus', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-robuck-rounded: 'Robuck Rounded', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-abc-diatype-rounded: 'ABC Diatype Rounded', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-ui-sans-serif: 'ui-sans-serif', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

  /* Typography — Scale */
  --text-caption: 14px;
  --leading-caption: 1.5;
  --tracking-caption: -0.02px;
  --text-subheading: 19px;
  --leading-subheading: 1.2;
  --tracking-subheading: -0.02px;
  --text-heading: 24px;
  --leading-heading: 1.2;
  --tracking-heading: -0.02px;
  --text-heading-lg: 33px;
  --leading-heading-lg: 1.05;
  --tracking-heading-lg: -0.02px;
  --text-display: 62px;
  --leading-display: 0.8;

  /* Spacing */
  --spacing-4: 4px;
  --spacing-7: 7px;
  --spacing-8: 8px;
  --spacing-13: 13px;
  --spacing-15: 15px;
  --spacing-19: 19px;
  --spacing-27: 27px;
  --spacing-36: 36px;
  --spacing-38: 38px;
  --spacing-43: 43px;
  --spacing-48: 48px;
  --spacing-57: 57px;
  --spacing-77: 77px;
  --spacing-119: 119px;

  /* Border Radius */
  --radius-md: 4.7619px;
  --radius-lg: 9.5238px;
  --radius-3xl: 23.8095px;
  --radius-3xl-2: 33.3333px;
  --radius-full: 47.619px;
}
```
