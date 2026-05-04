# Stage 5 — Build Option B (Canonical Conversion-Tuned Rewrite)

> **Loaded by**: orchestrator (in monolithic mode) AND each Stage 5 Sonnet rewriter sub-agent (in decomposed mode — alongside `_rewrite-shared.md` and the per-page rewrite directives).
>
> **Source of truth**: this is the canonical text for Stage 5. The summary in `SKILL.md` is a stub that points here.

### Stage 5: Build Option B (Canonical Conversion-Tuned Rewrite)

> **The brief in one line:** _"Same site, suddenly persuasive."_
> Same design as A — same logo, same images, same colors, same typography, same components, same layout. The ONLY thing that changes is the text: rewritten to read like agency-grade copy with a sales lens. Grammatical errors fixed. Lorem-ipsum placeholders replaced with real content derived from manifest facts. Verbose paragraphs tightened. Sentence rhythm varied. CTAs sharpened for conversion. Value propositions reordered for impact. Voice preserved (folksy plumber stays folksy — just clearer; corporate firm stays corporate — just sharper). The customer should look at A and B side-by-side and say _"that's the same design, but B actually sells me."_

**B is the canonical text source for the rest of the pipeline.** Options B and C inherit B's text verbatim (then render in their own design). This means the rewrite work is shared across B, B, and C — three deliverables, one carefully-crafted text version. Customer comparison becomes "same words, four designs" (A's original copy + 3 variants of the new copy in different design languages).

B is a **copy rewrite of A's source files**, not a new build from scratch. It runs after Stage 4 finishes (so A is QA-passed and stable). Options B and C cannot start until B is complete (they depend on B's text).

#### 5a. Duplicate A as B

```bash
cp -r jobs/{domain}/option-a/ jobs/{domain}/option-b/
```

Then strip the `node_modules/` and `dist/` from the copy (we'll rebuild them):

```bash
rm -rf jobs/{domain}/option-b/node_modules
rm -rf jobs/{domain}/option-b/dist
cd jobs/{domain}/option-b/
npm install
```

#### 5b. Rewrite the copy in every page

For each `.astro` file in `jobs/{domain}/option-b/src/pages/`, identify the text-content sections (between tags, in `<Hero text=…>`, in `<Section>` body, etc.) and rewrite them.

**RULES for the rewrite:**

**DO:**
- Fix grammar errors, typos, awkward phrasing
- Replace placeholder/lorem-ipsum text with real content derived from manifest facts (e.g., "Business Tagline Lorem Ipsum Dolor" → "Veteran-Owned Plumbing Across Southwest Florida Since 2009" — only if "veteran-owned" and "2009" both appear in the manifest)
- Tighten verbose copy where it doesn't sacrifice meaning (10–30% shorter is typical)
- Vary sentence length for rhythm (mix short punchy + medium descriptive)
- Use active voice where it tightens the sentence
- Use the customer's own specifics (years in business, license numbers, awards, partner brands, service areas, etc.) in place of generic claims — but ONLY specifics that exist in the manifest
- Sharpen CTAs for conversion ("Get a Quote" → "Get Your Free 24-Hour Quote", "Contact Us" → "Talk to a Real Plumber Tonight"). Use specifics drawn from manifest content (warranties, response times, guarantees) — never invent
- Reorder value propositions on a page so the strongest hooks land first (e.g., move "24/7 emergency response" above "we're family-owned" if the customer is in pain when they hit the page)
- Maintain headings hierarchy and section structure within a page (B shares A's layout — only text content changes)

**DO NOT (FACT GROUNDING + TESTIMONIAL & REVIEW PRESERVATION — see top-level principles):**
- Add new claims, awards, metrics, partners, or specs not supported by manifest content
- Reposition the business into a different industry or category
- Invent new value propositions — you may sharpen the wording of existing ones, but don't add ones the customer doesn't already make
- Drop content (testimonials, services, certifications still 100% present)
- Change phone numbers, email addresses, business names, license numbers, addresses, founder names, or any factual fixed string
- Substitute, remove, or rearrange images
- Change page count, page structure, or nav organization
- Make a folksy small-town plumber sound like a Linear marketing page (or vice versa) — voice preservation is non-negotiable
- Restructure section ORDER beyond reordering value props within an existing section (B's layout is A's layout)
- **TOUCH ANY TESTIMONIAL OR REVIEW TEXT** — see TESTIMONIAL & REVIEW PRESERVATION rule. Reviews are real customers' words attributed to them by name. They are NOT copy. Do not "tighten," "fix grammar," "improve," or "compose" a review. Verbatim, full, unedited. This applies to: blockquotes, testimonial cards, named quotes, star-rated cards, named-employee/founder quotes, "Featured in / As seen on" attributions, dedicated `/reviews` or `/testimonials` pages. Layout/styling/ordering/selection of which reviews to feature on which page = OK. Touching the words = forbidden.

**Sharpening vs fabrication — concrete examples (read before rewriting):**

| Manifest contains... | ✓ Allowed (sharpening) | ✗ FORBIDDEN (fabrication or tampering) |
|----------------------|------------------------|---------------------------|
| "Established 2003" | "20+ years in business" (math from 2003 → today) | "30+ years experience" (number not derivable from any date in manifest) |
| "We serve Tampa Bay" | "Trusted across Tampa Bay since 2003" (if 2003 is in manifest) | "Tampa's #1 rated service" (no rating in manifest) |
| "Family-owned" | "Family-owned and operated" | "Family-owned and veteran-owned" (veteran claim absent) |
| "Licensed plumber" | "Fully licensed plumbing pros" | "Licensed, bonded, and insured" (bonded/insured absent) |
| Any 5-star reviews shown | "Customers love our work" (paraphrasing in YOUR copy, not editing the review) | "200+ five-star reviews" (review count absent) |
| "Available days, evenings, weekends" | "We answer the phone day or night, weekend or not" | "24/7 emergency response" (24/7 not stated) |
| Customer photo of award plaque | "Award-winning service" (if specific award is named in manifest) | "Award-winning service" (if no specific award is named) |
| Nothing about year founded | (no year claim allowed) | "20+ YEARS EXPERIENCE" badge (this was the bug we shipped) |
| Mention of one trusted brand | "We service Trane systems" | "Authorized dealer for Trane, Carrier, and Lennox" (not in manifest) |
| Review: "Bryan and his team did an awesome job, super proffesional, would recommend!" | (display verbatim — typo and all — and attribute to the named reviewer) | "Bryan's team did exceptional, professional work — highly recommended." (you just put words in the customer's mouth attributed to them by name) |
| Review: "Quick service. Decent price. They showed up on time." (terse) | (display verbatim — terseness is the customer's voice) | "Quick service, decent prices, and they always show up on time — couldn't ask for more!" (composite/embellished — fabrication of voice) |
| Two short reviews from two named people | (show both verbatim, side by side or stacked) | Combine into one "composite" review with both names attributed (impersonation) |
| Manifest has 12 reviews on /reviews page | (show all 12 verbatim on /reviews; show 3 chosen verbatim on homepage) | Pick 3 to show + edit them to be "tighter" (tampering) |

**The before-you-write-it test (FACT GROUNDING):** For every numeric claim, dated claim, credential, or identity assertion you put on the page, you must be able to point to the line in the manifest that supports it. If you can't, the claim doesn't go on the page. The qa-check.js fact-grounding check (Stage 6 / Stage 8a) will catch you if you slip; better to catch it now in your own head than at the deploy gate.

**The hands-off test (TESTIMONIAL & REVIEW PRESERVATION):** Before you change any character inside a `<blockquote>`, testimonial card, attributed quote, or anything inside a `/reviews` page — STOP. Ask: "Is this text quoted from a named person?" If yes, it stays exactly as-is. The qa-check.js testimonial-tampering check compares B's testimonial text to A's testimonial text and fails the build on any divergence.

**Voice match guidance:** Read 3–5 paragraphs from the original manifest before rewriting. Notice tone, formality level, jargon density, sentence length distribution. The rewrite should match that voice but cleaner. If the original is conversational ("We've been Englewood's go-to plumbers since 2009"), don't make it formal ("Established in 2009, our plumbing services have served the Englewood community").

**Layout flex tolerance**: Components in B may render slightly taller or shorter than A because of copy-length differences. That's fine. Don't fight it with hardcoded heights. The design language is identical; small layout flex is expected and acceptable.

#### 5c. Build check

```bash
cd jobs/{domain}/option-b/
npm run build
```

Fix any build errors before proceeding to QA.

#### 5d. Logo + Image rules (inherited from A)

Same as Option A:
- **Logo**: ALWAYS preserve the original (B is "same site, suddenly literate" — same logo, same images)
- **Images**: Same image-to-page binding as A. B uses A's image references unchanged.

These are non-negotiable for B. The wordmark fallback rule for B/C does NOT apply to B.

#### 5e. Add `lang` prop to BaseLayout (one-time scaffold edit — runs unconditionally)

BaseLayout always accepts a `lang` prop, even on English-only builds. This is a future-proofing edit — keeping the prop wired in costs ~5 lines of code and ensures any later `--add-language` invocation can pass `lang="de"` etc. without rewriting the layout. Edit `option-b/src/layouts/BaseLayout.astro`:

```astro
---
interface Props {
  title: string;
  description?: string;
  active?: string;
  lang?: string;        // ISO 639-1 code; defaults to 'en'. Generalized from the original 'en' | 'es' literal type.
}
const { title, description, active = 'home', lang = 'en' } = Astro.props;
---
<!doctype html>
<html lang={lang}>
  <head>
    {/* … existing head … */}
  </head>
  <body>
    {/* … existing body … */}
  </body>
</html>
```

The default `'en'` keeps English pages working without per-page edits. On English-only builds, the prop is never explicitly passed — `lang="en"` is implied everywhere.

#### 5e-bis. Was `--languages <list>` passed? (CONDITIONAL gate for 5f / 5g / 5h)

Substages 5f, 5g, and 5h run ONLY if the user passed `--languages` to `/webfactory`. Read the flag's parsed value:

```bash
LANGUAGES_FLAG="${LANGUAGES_FLAG:-}"   # comma-separated ISO 639-1 codes; empty if --languages not passed
if [ -z "$LANGUAGES_FLAG" ]; then
  echo "ℹ️  --languages flag not passed; skipping 5f/5g/5h (English-only build)."
  echo "   To add languages later: /webfactory <domain> --add-language <name|iso> --to <b|c|both>"
else
  echo "→ --languages=$LANGUAGES_FLAG; proceeding with 5f/5g/5h for each requested language."
fi
```

If empty: skip directly to **5i (Build check)**. The B build is English-only.

If non-empty: parse the comma-separated list into ISO codes (resolving English names via the language table — `Spanish`/`es` both resolve to `es`), then run 5f/5g/5h once per code.

#### 5f. Per-language translations — produce `/<lang>/<page>.astro` per page (CONDITIONAL on `--languages`)

**This substage runs only if `--languages` was passed (per 5e-bis gate). On English-only builds, skip directly to 5i.**

Per the MULTILINGUAL SUPPORT rule, every requested language gets a parallel page set under `option-b/src/pages/<lang-code>/`. With `--languages es,de,fr`, each Stage 5 Sonnet sub-agent that rewrites an English page ALSO produces 3 translations (Spanish, German, French) of that page. With `--languages es` only, 1 translation per page. With no `--languages` flag, 0 translations — substage skipped.

**Sub-agent contract (extended from Stage 5b)**:

Each sub-agent receives:
- The page being rewritten (`option-b/src/pages/<page>.astro`) — produced by step 5b
- B's design tokens + components from `_shared.md`
- The translation directives below (what to translate, what to keep)
- The list of active languages from `--languages` (e.g., `[es, de, fr]`)

Sub-agent output is N+1 files (atomic):
- `option-b/src/pages/<page>.astro` (English rewrite — already produced in 5b; this step is the rewrite verifying it landed)
- For each lang in the active list: `option-b/src/pages/<lang>/<page>.astro` (translated version — new in this step)

**Translation directives** (apply per language; identical structure for each):

- Translate every customer-facing string (headlines, body, CTAs, image `alt`, `<title>`, `<meta description>`, nav labels, button text, form labels, footer copy)
- KEEP UNCHANGED (single source of truth across languages):
  - Phone numbers, email addresses, license numbers
  - Place names (Tampa, Lancaster, Ohio, etc. — use as-is in target-language prose)
  - Business names, founder names, customer review attribution names, brand names
  - All `<img src="…">` paths (same images in EN and every translation; only the `alt` is translated)
  - All structural markup, components, grid configs, section ordering
- For testimonials: translate the testimonial body, append `<small>{translation-tag}</small>` below the `<cite>` element where `{translation-tag}` is the per-language tag from the language table (e.g., `(traducido del inglés)` for ES, `(aus dem Englischen übersetzt)` for DE, `(traduit de l'anglais)` for FR — see full table above). Keep the attribution name original. Example for Spanish:
  ```astro
  <blockquote>"¡Excelente trabajo!"</blockquote>
  <cite>— Mark S. <small>(traducido del inglés)</small></cite>
  ```
- Pass `lang="<lang-code>"` when rendering BaseLayout in `/<lang>/*.astro` pages
- Voice match: read 2–3 paragraphs of B's English first; each translation should be idiomatic, match B's tone (folksy stays folksy, professional stays professional), and read like a native speaker of that language wrote it — not like a literal translation

**Per-language nav label mappings** (use as canonical defaults unless customer manifest already provides translations):

Spanish (`es`):

| English | Spanish |
|---|---|
| Home | Inicio |
| About | Sobre Nosotros |
| Services | Servicios |
| Projects | Proyectos |
| Portfolio | Portafolio |
| Contact | Contacto |
| Blog | Blog (kept) |
| Reviews | Reseñas |
| Get a Free Estimate | Solicite un Presupuesto Gratis |
| Call Now | Llame Ahora |
| Learn More | Más Información |
| See the Job | Ver el Trabajo |

For other active languages (de, ru, it, fr, pt, pl, zh, ja, ko, nl, sv), the sub-agent translates these labels via standard target-language conventions. Workers may consult the source manifest first for any customer-provided translations before falling back to default labels.

#### 5g. Language switcher — add to Nav component (CONDITIONAL on `--languages`)

**This substage runs only if `--languages` was passed. On English-only builds, no switcher is rendered (single-language nav has nothing to switch to).**

Edit `option-b/src/components/Nav.astro` to add a multi-language switcher that lists ALL active languages including English. The switcher:

1. Detects active languages by inspecting `option-b/src/pages/` subdirectories at build time (each subdirectory named with an ISO 639-1 code = an active language; English is always implicitly active)
2. Renders one entry per active language, each linking to the parallel page in that language. The currently-active language renders as a non-clickable `<span>` (not `<a>`).
3. Computes parallel-language URLs:
   - From an English page (`/services`): switching to `de` → `/de/services`; switching to `es` → `/es/services`
   - From a `/de/` page (`/de/services`): switching to English → `/services`; switching to `fr` → `/fr/services`
4. Each entry has `aria-label` referencing the target language ("Switch to English", "Cambiar a Español", "Auf Deutsch wechseln", "Перейти на русский", "Passa all'italiano", "Passer au français", etc.)
5. Tap target ≥ 44×44px per item
6. Sits in the visible nav, not buried in the footer

**Style variants (worker picks based on active-language count)**:

- **2 languages active** (e.g., EN + ES): simple toggle row (`EN | ES`). Each item is a separate `<a>` (or `<span>` if it's the current page's language). Active language is bold + non-clickable.
- **3 languages active** (e.g., EN + ES + DE): same toggle row pattern (`EN | ES | DE`).
- **≥ 4 active languages** (e.g., EN + ES + DE + FR + IT): dropdown menu. The dropdown trigger shows the current language (e.g., `ES ▾`); the menu lists the others. Use `<details>/<summary>` for no-JS toggle compatibility.

Both variants must work on mobile (44px tap targets, dropdown opens on tap not hover).

Example pattern (2-language toggle, EN + ES):

```astro
---
// Detect active languages from src/pages/<lang>/ subdirs (passed via build-time const or computed via Astro.glob)
const activeLanguages = ['en', 'es'];   // 'en' always first; rest from src/pages/<lang>/ subdir names
const currentLang = Astro.url.pathname.match(/^\/([a-z]{2})\//)?.[1] ?? 'en';

function pathFor(targetLang: string): string {
  const stripped = Astro.url.pathname.replace(/^\/[a-z]{2}\//, '/');
  return targetLang === 'en' ? stripped : `/${targetLang}${stripped === '/' ? '/' : stripped}`;
}

const labels: Record<string, string> = { en: 'EN', es: 'ES', de: 'DE', fr: 'FR', it: 'IT', ru: 'RU', pt: 'PT', pl: 'PL', zh: 'ZH', ja: 'JA', ko: 'KO', nl: 'NL', sv: 'SV' };
const ariaLabels: Record<string, string> = {
  en: 'Switch to English',
  es: 'Cambiar a Español',
  de: 'Auf Deutsch wechseln',
  fr: 'Passer au français',
  it: 'Passa all\'italiano',
  ru: 'Перейти на русский',
  // … extend as more languages are added
};
---
<div class="nav-lang-switcher" role="group" aria-label="Language">
  {activeLanguages.map(lang => lang === currentLang
    ? <span class="nav-lang-current min-h-[44px]" aria-current="true">{labels[lang]}</span>
    : <a href={pathFor(lang)} aria-label={ariaLabels[lang]} class="nav-lang-link min-h-[44px]">{labels[lang]}</a>
  )}
</div>
```

#### 5h. Multilingual completeness check (CONDITIONAL on `--languages`)

**This substage runs only if `--languages` was passed. On English-only builds, skip directly to 5i.**

Before declaring Stage 5 done, verify parity across every active language:

```bash
cd jobs/{domain}/option-b
EN_COUNT=$(find src/pages -maxdepth 2 -name '*.astro' -not -path '*/[a-z][a-z]/*' | wc -l)
echo "English pages: $EN_COUNT"
PARITY_OK=1
for LANG_DIR in src/pages/*/; do
  LANG=$(basename "$LANG_DIR")
  # Skip non-language subdirs (e.g., src/pages/blog/ when blog is not a lang code)
  if [ ! ${#LANG} -eq 2 ]; then continue; fi
  LANG_COUNT=$(find "$LANG_DIR" -name '*.astro' | wc -l)
  echo "$LANG pages: $LANG_COUNT"
  if [ "$EN_COUNT" != "$LANG_COUNT" ]; then
    echo "✗ MISMATCH for $LANG — expected $EN_COUNT pages, got $LANG_COUNT"
    PARITY_OK=0
  fi
done
[ "$PARITY_OK" = "1" ] && echo "✓ parity across all active languages" || echo "✗ FIX BEFORE PROCEEDING"
```

Every English page must have a counterpart in EVERY active language. Catch missing translations BEFORE running build + QA — the `multilingual-page-parity` qa-check rule will block deploy if you miss one, but catching it here is cheaper than fixing at deploy gate.

#### 5i. Build check (runs unconditionally)

```bash
cd jobs/{domain}/option-b/
npm run build
```

Fix any build errors before proceeding to Stage 6 QA. Common errors at this stage:

- (English-only build) Standard Astro/Tailwind compile errors only — no multilingual-specific errors possible.
- (Multilingual build) `BaseLayout` doesn't accept `lang` prop → add it (step 5e — should already be done).
- (Multilingual build) `/<lang>/` pages reference language-specific assets that don't exist → check image paths (should match English unchanged; only `alt` translates).
- (Multilingual build) Hardcoded English strings in components leak into `/<lang>/` rendering → audit Nav, Footer, CtaBanner for hardcoded strings; either accept `lang` prop or use a string-table.
