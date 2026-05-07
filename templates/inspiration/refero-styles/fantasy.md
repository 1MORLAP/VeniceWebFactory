# Fantasy — Style Reference
> Black Box Theater — a minimal stage where ideas are spotlighted.

**Theme:** dark

This design system evokes a sense of stark luxury, like a gallery space for digital art. The absolute black background intensifies the impact of the crisp white typography, creating a high-contrast, text-dominant presentation. Information is delivered with quiet confidence, relying on precise typographic control and generous negative space to command attention, rather than flashy visuals or complex layouts. The singular focus on black and white, paired with meticulous letter-spacing, projects an image of refined authority and intellectual rigor.

## Tokens — Colors

| Name | Value | Token | Role |
|------|-------|-------|------|
| Absolute Black | `#000000` | `--color-absolute-black` | Page backgrounds, section dividers, general UI containers — grounds the entire experience in a deep, void-like aesthetic. |
| Polar White | `#ffffff` | `--color-polar-white` | Primary text, interactive elements, menu items, borders — contrasts sharply with the black, ensuring maximum readability and a premium feel. |

## Tokens — Typography

### sans — The sole typeface, maintaining a cohesive, sophisticated voice. Weights 400 and 500 are primarily used, creating a subtle hierarchy through size rather than heavy weight. Distinctly tight letter-spacing on larger sizes sharpens headlines and gives them an architectural precision. · `--font-sans`
- **Substitute:** Inter
- **Weights:** 400, 500
- **Sizes:** 13px, 15px, 17px, 42px, 67px, 117px
- **Line height:** 1.00, 1.10, 1.40
- **Letter spacing:** -0.0300em at 117px, -0.0200em at 67px, -0.0130em at 42px, -0.0110em at 17px, -0.0100em at 15px
- **Role:** The sole typeface, maintaining a cohesive, sophisticated voice. Weights 400 and 500 are primarily used, creating a subtle hierarchy through size rather than heavy weight. Distinctly tight letter-spacing on larger sizes sharpens headlines and gives them an architectural precision.

### Type Scale

| Role | Size | Line Height | Letter Spacing | Token |
|------|------|-------------|----------------|-------|
| caption | 13px | 1.4 | -0.13px | `--text-caption` |
| body-sm | 15px | 1.4 | -0.15px | `--text-body-sm` |
| body | 17px | 1.4 | -0.187px | `--text-body` |
| heading | 42px | 1.1 | -0.546px | `--text-heading` |
| heading-lg | 67px | 1.1 | -1.34px | `--text-heading-lg` |
| display | 117px | 1 | -3.51px | `--text-display` |

## Tokens — Spacing & Shapes

**Density:** spacious

### Spacing Scale

| Name | Value | Token |
|------|-------|-------|
| 5 | 5px | `--spacing-5` |
| 10 | 10px | `--spacing-10` |
| 17 | 17px | `--spacing-17` |
| 20 | 20px | `--spacing-20` |
| 27 | 27px | `--spacing-27` |
| 33 | 33px | `--spacing-33` |
| 40 | 40px | `--spacing-40` |
| 50 | 50px | `--spacing-50` |
| 75 | 75px | `--spacing-75` |
| 80 | 80px | `--spacing-80` |
| 138 | 138px | `--spacing-138` |

### Border Radius

| Element | Value |
|---------|-------|
| buttons | 8.33333px |

### Layout

- **Card padding:** 0px

## Components

### Navigation Button - Menu
**Role:** Primary navigation trigger

A ghost button with Polar White text on Absolute Black background. Features a 8.33333px border-radius, no padding, and a white border. Text set in sans-serif, size 17px, weight 400, letter spacing -0.0110em.

### Navigation Link - Implicit
**Role:** Top-level navigation

Ghost button style with no background, Polar White text and border. Text is sans-serif, size 17px, weight 400, letter spacing -0.0110em. Has no explicit padding, indicating it relies on content for sizing.

### Action Button - Explore
**Role:** Feature call to action with minimal styling

Ghost button with no background and Polar White text. Text is sans-serif, size 17px, weight 400, letter spacing -0.0110em. Padding of 0px top/bottom and 26.6667px left/right with 8.33333px border-radius provides a subtle interactive area.

### Action Button - Contact (Black Text)
**Role:** Alternative action button for light backgrounds if theme were to shift

Ghost button with no background and Absolute Black text. Text is sans-serif, size 17px, weight 400, letter spacing -0.0110em. Padding of 0px top/bottom and 26.6667px left/right with 8.33333px border-radius. Currently not visible in provided context, but indicates a potential for inversion.

### Hero Text Block - Dark
**Role:** Primary headline presentation

Text is Polar White, sans-serif, weight 500, size 42px. Line height 1.10. Letter spacing -0.0130em. Displayed on an Absolute Black background with no explicit padding, leveraging implied structural padding.

### Footer Copyright Text
**Role:** Legal and informational text

Text is Polar White, sans-serif, weight 400, size 15px. Line height 1.40. Letter spacing -0.0100em. Uses a more relaxed line height than headlines for readability in blocks of text.

## Do's and Don'ts

### Do
- Prioritize Polar White (#ffffff) text on Absolute Black (#000000) backgrounds for all content sections.
- Use sans-serif font for all typography, strictly adhering to weights 400 and 500.
- Apply specific letter-spacing: -0.0300em for 117px text, -0.0200em for 67px, -0.0130em for 42px, -0.0110em for 17px, and -0.0100em for 15px and 13px.
- Maintain generous vertical spacing between sections, using values within the 80px-138px range.
- Apply a consistent border-radius of 8.33333px to all interactive elements like buttons.

### Don't
- Avoid introducing any colors other than Polar White (#ffffff) or Absolute Black (#000000) for UI elements.
- Do not use font weights outside of 400 and 500.
- Never add box shadows or strong elevation effects; the design relies on flat contrast.
- Do not vary border-radius from 8.33333px for buttons; consistency is key.
- Avoid using highly saturated images or illustrations; opt for high-contrast, often monochrome, photographic or typographic content.

## Imagery

The site's visual language is characterized by an absence of traditional imagery in the main content areas, creating an impactful, text-dominant experience. When visuals appear, as hinted by the brand's logo and what might be product screenshots or abstract graphics in other sections not shown, they exist as stark, high-contrast elements. There's an implied focus on sharp, precise digital artifacts or symbolic representations that integrate seamlessly with the monochrome UI, emphasizing clean lines and sophisticated simplicity, rather than decorative or distracting visual noise. Icons are simple, outlined forms, such as the X and menu icon, reinforcing the minimal aesthetic.

## Layout

The page adheres to a full-bleed layout with no explicit `pageMaxWidth`, allowing the Absolute Black background to fill the entire viewport. The hero section is full-screen, featuring centered text over the black background, creating an immersive, dramatic introduction. Sections are characterized by consistent, generous vertical spacing (80px-138px `sectionGap`), fostering a spacious, unhurried reading experience. Content arrangement is primarily centered text blocks or simple two-column layouts where text and implicit content elements are balanced. The overall density is low, prioritizing impactful statements and clear typography over information packing. Navigation consists of a minimal top-right 'Menu' button and a logo on the left, maintaining a clean, uncluttered header.

## Agent Prompt Guide

### Quick Color Reference
- Text: #ffffff (Polar White)
- Background: #000000 (Absolute Black)
- CTA Background: #000000 (Absolute Black)
- CTA Text: #ffffff (Polar White)
- Border: #ffffff (Polar White)

### 3-5 Example Component Prompts
1. Create a Hero Section: Absolute Black background. Headline 'We are Fantasy.' in Polar White, sans-serif, size 42px, weight 500, line-height 1.10, letter-spacing -0.0130em. Sub-headline 'The creative partner behind the world's biggest digital products.' in Polar White, sans-serif, size 42px, weight 500, line-height 1.10, letter-spacing -0.0130em. Both headlines centered vertically and horizontally within the viewport.
2. Generate a Navigation Button: Label 'Menu' in Polar White, sans-serif, size 17px, weight 400, letter-spacing -0.0110em. Background transparent, border 1px Polar White, border-radius 8.33333px. Padding 0px top/bottom, 26.6667px left/right. Position this to the top right of a header.
3. Create a Footer Link: Text 'Privacy & Terms' in Polar White, sans-serif, size 15px, weight 400, line-height 1.40, letter-spacing -0.0100em. Display on an Absolute Black background. Underline on hover only.
4. Design a Section Headline: 'Launching the next generation of Intelligent Experiences.' in Polar White, sans-serif, size 67px, weight 500, line-height 1.10, letter-spacing -0.0200em. Position with 80px top padding from the previous section.

## Similar Brands

- **Apple** — High-contrast black and white aesthetic for product reveal pages, with a focus on large, impactful typography and ample negative space.
- **B&O (Bang & Olufsen)** — Luxury brand presentation with minimal color, emphasizing material texture (implied through stark contrast) and geometric precision.
- **Acme Co (fictional – typical gallery site)** — Portfolio or gallery websites with a dark, minimalist theme, allowing work to stand out against a void-like background.
- **Dribbble (dark mode)** — A dark, content-focused UI that uses high-contrast text and minimal ornamentation to highlight creative work.

## Quick Start

### CSS Custom Properties

```css
:root {
  /* Colors */
  --color-absolute-black: #000000;
  --color-polar-white: #ffffff;

  /* Typography — Font Families */
  --font-sans: 'sans', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

  /* Typography — Scale */
  --text-caption: 13px;
  --leading-caption: 1.4;
  --tracking-caption: -0.13px;
  --text-body-sm: 15px;
  --leading-body-sm: 1.4;
  --tracking-body-sm: -0.15px;
  --text-body: 17px;
  --leading-body: 1.4;
  --tracking-body: -0.187px;
  --text-heading: 42px;
  --leading-heading: 1.1;
  --tracking-heading: -0.546px;
  --text-heading-lg: 67px;
  --leading-heading-lg: 1.1;
  --tracking-heading-lg: -1.34px;
  --text-display: 117px;
  --leading-display: 1;
  --tracking-display: -3.51px;

  /* Typography — Weights */
  --font-weight-regular: 400;
  --font-weight-medium: 500;

  /* Spacing */
  --spacing-5: 5px;
  --spacing-10: 10px;
  --spacing-17: 17px;
  --spacing-20: 20px;
  --spacing-27: 27px;
  --spacing-33: 33px;
  --spacing-40: 40px;
  --spacing-50: 50px;
  --spacing-75: 75px;
  --spacing-80: 80px;
  --spacing-138: 138px;

  /* Layout */
  --card-padding: 0px;

  /* Border Radius */
  --radius-lg: 8.33333px;

  /* Named Radii */
  --radius-buttons: 8.33333px;
}
```

### Tailwind v4

```css
@theme {
  /* Colors */
  --color-absolute-black: #000000;
  --color-polar-white: #ffffff;

  /* Typography */
  --font-sans: 'sans', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

  /* Typography — Scale */
  --text-caption: 13px;
  --leading-caption: 1.4;
  --tracking-caption: -0.13px;
  --text-body-sm: 15px;
  --leading-body-sm: 1.4;
  --tracking-body-sm: -0.15px;
  --text-body: 17px;
  --leading-body: 1.4;
  --tracking-body: -0.187px;
  --text-heading: 42px;
  --leading-heading: 1.1;
  --tracking-heading: -0.546px;
  --text-heading-lg: 67px;
  --leading-heading-lg: 1.1;
  --tracking-heading-lg: -1.34px;
  --text-display: 117px;
  --leading-display: 1;
  --tracking-display: -3.51px;

  /* Spacing */
  --spacing-5: 5px;
  --spacing-10: 10px;
  --spacing-17: 17px;
  --spacing-20: 20px;
  --spacing-27: 27px;
  --spacing-33: 33px;
  --spacing-40: 40px;
  --spacing-50: 50px;
  --spacing-75: 75px;
  --spacing-80: 80px;
  --spacing-138: 138px;

  /* Border Radius */
  --radius-lg: 8.33333px;
}
```
