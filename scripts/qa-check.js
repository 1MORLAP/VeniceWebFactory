#!/usr/bin/env node
/**
 * qa-check.js — Automated visual-quality gate that must pass before deploy.
 *
 * Runs a Playwright browser against a local dev server and checks for bugs
 * that slip past the HTML/manifest-level "completeness" grep checks:
 *   1. Logo legibility — naturalWidth must be >= 1.5x displayed width AND
 *      >= 100px absolute. Catches WordPress favicon crops being used as logos.
 *   2. No literal \uXXXX unicode escape sequences rendered as visible text.
 *   3. No broken images (naturalWidth === 0).
 *   4. No console errors.
 *   5. No failed network requests (4xx/5xx).
 *
 * Usage: node scripts/qa-check.js <baseUrl> [--manifest <path>] [--reference-dist <path>] [path1 path2 ...]
 *   e.g.  node scripts/qa-check.js http://localhost:4321 / /about /contact
 *         node scripts/qa-check.js http://localhost:4321 --manifest jobs/example.com/manifest.json /
 *         node scripts/qa-check.js http://localhost:4321 --reference-dist jobs/example.com/option-a/dist /
 *
 * --manifest <path>          Optional. Loads manifest.json into a text corpus and runs
 *                            the FACT GROUNDING check (validates rendered claims like
 *                            "20+ years", "since 2003", "award-winning", "family-owned",
 *                            etc. against the corpus). Without --manifest, the check is
 *                            skipped with a warning.
 *
 * --reference-dist <path>    Optional. Points at Option A's built dist/ directory
 *                            (e.g., jobs/{domain}/option-a/dist). Enables the
 *                            TESTIMONIAL & REVIEW PRESERVATION check: extracts
 *                            <blockquote>/<q> text from every reference HTML and
 *                            verifies the live page's testimonials match VERBATIM.
 *                            Pass this when QA-checking Option B or Option C.
 *                            Without --reference-dist, the check is skipped.
 *
 * Exits 0 on pass, 1 on any failure. Prints a structured report.
 */

import { chromium } from 'playwright';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// ---- argv parsing (supports --manifest <path> + --reference-dist <path> + --reference-dist-es <path> + --option <a|b|c> mixed with positional paths) ----
const rawArgs = process.argv.slice(2);
let baseUrl = 'http://localhost:4321';
let manifestPath = null;
let referenceDistPath = null;
let referenceDistEsPath = null;   // BILINGUAL SUPPORT: option-b/dist when checking C, so the testimonial-tampering check can compare C's /es/ against B's /es/
let optionName = null;   // 'a' | 'b' | 'c' — gates per-option checks (e.g. image-reuse-A only fires for 'a')
const paths = [];
for (let i = 0; i < rawArgs.length; i++) {
  const a = rawArgs[i];
  if (a === '--manifest') { manifestPath = rawArgs[++i]; continue; }
  if (a.startsWith('--manifest=')) { manifestPath = a.split('=')[1]; continue; }
  if (a === '--reference-dist') { referenceDistPath = rawArgs[++i]; continue; }
  if (a.startsWith('--reference-dist=')) { referenceDistPath = a.split('=')[1]; continue; }
  if (a === '--reference-dist-es') { referenceDistEsPath = rawArgs[++i]; continue; }
  if (a.startsWith('--reference-dist-es=')) { referenceDistEsPath = a.split('=')[1]; continue; }
  if (a === '--option') { optionName = (rawArgs[++i] || '').toLowerCase(); continue; }
  if (a.startsWith('--option=')) { optionName = a.split('=')[1].toLowerCase(); continue; }
  if (i === 0 && /^https?:\/\//.test(a)) { baseUrl = a; continue; }
  paths.push(a);
}
if (paths.length === 0) paths.push('/');
if (optionName && !['a', 'b', 'c'].includes(optionName)) {
  console.warn(`⚠ --option must be one of a|b|c (got "${optionName}") — option-specific checks will be skipped.`);
  optionName = null;
}

// ---- Build manifest text corpus for FACT GROUNDING check ----
// The corpus is one big lowercased blob of every text field on every page,
// plus meta description, footer text, image alt text. Used as the "ground
// truth" against which rendered fact-claims are validated.
let manifestCorpus = null;
let manifestPagesCount = 0;
// ---- Build structured manifest image inventory for IMAGE REUSE RULE check ----
// Map of basename → { localPath, src, width, height, alt, kind } for every image
// the scraper downloaded across pages.images and pages.backgroundImages.
// Deduplicated by basename. Used by the image-reuse-A check only when --option a.
const manifestImageInventory = new Map();
if (manifestPath) {
  if (!existsSync(manifestPath)) {
    console.warn(`⚠ --manifest ${manifestPath} not found — fact-grounding check will be skipped.`);
  } else {
    try {
      const m = JSON.parse(readFileSync(manifestPath, 'utf8'));
      const buf = [];
      function walk(v) {
        if (!v) return;
        if (typeof v === 'string') { buf.push(v); return; }
        if (Array.isArray(v)) { v.forEach(walk); return; }
        if (typeof v === 'object') {
          for (const k of Object.keys(v)) {
            if (k === '_placeholder') continue; // skip placeholder metadata
            if (k.startsWith('_')) continue;
            walk(v[k]);
          }
        }
      }
      walk(m);
      // Normalize: lowercase, collapse whitespace, strip most punctuation but
      // KEEP digits, letters, hyphens, apostrophes, slashes, and the @ sign so
      // numbers like "20+", "5-star", "24/7" survive.
      manifestCorpus = buf.join(' ')
        .toLowerCase()
        .replace(/[^a-z0-9@'\-\/\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      manifestPagesCount = Array.isArray(m.pages) ? m.pages.length : 0;
      console.log(`✓ Loaded manifest corpus from ${manifestPath} (${manifestCorpus.length} chars, ${manifestPagesCount} pages)`);

      // Walk pages[*].images + pages[*].backgroundImages.
      //
      // De-duplication strategy: the scraper assigns a NEW localPath every
      // time it encounters an image, even if the same src appears on multiple
      // pages (BBB seal, Duda "Transparent BG" placeholder, repeated logo, etc.).
      // For the IMAGE REUSE RULE we want one entry per unique IMAGE — not one
      // per occurrence — so we dedupe by source URL.
      //
      // Step 1: collect every src→[localPaths,record] mapping
      // Step 2: pick a canonical basename per src (the first localPath)
      //   → so when the build references ANY of the duplicate basenames,
      //     we count the image as rendered. We track ALL aliases so the
      //     "rendered" lookup hits regardless of which dup the worker used.
      const srcToCanonical = new Map();   // src → canonical record (first occurrence)
      const srcToAliases   = new Map();   // src → Set<basename> (all dup basenames)
      for (const p of m.pages || []) {
        for (const imgs of [p.images || [], p.backgroundImages || []]) {
          for (const i of imgs) {
            if (!i || !i.localPath) continue;
            const basename = i.localPath.split('/').pop();
            if (!basename) continue;
            // Use src as the dedup key when present; fall back to basename
            // (so records lacking src still have a unique key).
            const key = i.src || `__no_src__:${basename}`;
            if (!srcToCanonical.has(key)) {
              srcToCanonical.set(key, {
                basename,                         // canonical basename for this image
                localPath: i.localPath,
                src: i.src || '',
                width: i.width || 0,
                height: i.height || 0,
                alt: i.alt || '',
                kind: i.type || (imgs === p.backgroundImages ? 'background' : 'img'),
                aliases: new Set([basename]),     // populated below
              });
              srcToAliases.set(key, new Set([basename]));
            } else {
              srcToAliases.get(key).add(basename);
            }
          }
        }
      }
      // Attach aliases set to each canonical record + register every alias
      // basename in the inventory pointing to the SAME canonical record.
      for (const [key, rec] of srcToCanonical) {
        rec.aliases = srcToAliases.get(key);
        for (const alias of rec.aliases) {
          // Multiple aliases all map to the same canonical record. The
          // "rendered" check looks up by basename and finds the same record
          // regardless of which alias the build used.
          manifestImageInventory.set(alias, rec);
        }
      }
      if (srcToCanonical.size > 0) {
        const totalRecords = [...srcToCanonical.values()].reduce((n, r) => n + r.aliases.size, 0);
        console.log(`✓ Built image inventory: ${srcToCanonical.size} unique images (${totalRecords} basename aliases) from manifest`);
      }
    } catch (e) {
      console.warn(`⚠ Failed to parse --manifest ${manifestPath}: ${e.message} — fact-grounding check will be skipped.`);
    }
  }
} else {
  console.warn('⚠ No --manifest <path> passed — fact-grounding check will be skipped. Pass --manifest jobs/<domain>/manifest.json to enable.');
}

// ---- IMAGE REUSE RULE classifier ----
// Given an inventory record, decide whether the photo MUST be reused in
// Option A's build (the denominator for the 90% rule).
// Skip if:
//   - tiny icon (1 <= width < 100): social pip, dingbat, tracking pixel
//   - third-party rating badge by alt text (BBB / Yelp / Google review / etc.)
//   - utility asset by localPath (favicon, spinner, loading, placeholder, transparent-bg)
//   - small logo variant: width >= 1 AND width < 400 AND (alt contains "logo" OR
//     localPath contains "logo"). Full-bleed logo PHOTOS (e.g. 1920×1458 logo
//     over a forest path) ARE work photos and DO count.
//   - blank / transparent / solid-background filler by alt or src — Duda / Wix
//     templates ship per-section "Transparent BG" or "White background" assets
//     that are content padding, not photos.
//   - third-party CDN utility tiles (mapbox tiles, google static maps, etc.)
function isMustReusePhoto(rec) {
  const w = rec.width || 0;
  const alt = (rec.alt || '').toLowerCase();
  const lp  = (rec.localPath || '').toLowerCase();
  const src = (rec.src || '').toLowerCase();
  if (w >= 1 && w < 100) return false;
  if (/bbb|better business|yelp|google review|trustpilot|angie|home advisor|verified by|accredited|certified by/.test(alt)) return false;
  if (/favicon|spinner|loading|placeholder|transparent.?bg|background.?pattern/.test(lp)) return false;
  if (w >= 1 && w < 400 && (/logo/.test(alt) || /logo/.test(lp))) return false;
  if (/blank|empty.*background|white\s+background|solid\s+background|transparent\s+bg/.test(alt)) return false;
  // CDN utility-tile sources (mapbox tiles, google static maps, etc.)
  if (/tiles\.mapbox\.com|\.tiles\.|maps\.google|gstatic\.com\/maps/.test(src)) return false;
  return true;
}

// ---- Build reference testimonial corpus for TESTIMONIAL & REVIEW PRESERVATION check ----
// When QA-checking Option B or Option C, the worker passes --reference-dist pointing
// at Option A's built dist/. We extract every <blockquote>/<q> text block from those
// HTML files and build a normalized Set. Live page testimonials must each appear in
// this set (verbatim, modulo whitespace) — otherwise B/C tampered with text that
// should have been frozen. See TESTIMONIAL & REVIEW PRESERVATION rule in SKILL.md.
const referenceTestimonialSet = new Set();   // normalized strings
let referenceFileCount = 0;
function normalizeQuoteText(s) {
  if (!s) return '';
  return s
    .replace(/<[^>]+>/g, ' ')                            // strip nested HTML

    // Decode common HTML entities BEFORE the catch-all entity-strip below.
    // The previous version replaced every entity with a space, which caused
    // false-positive testimonial-tampering failures whenever the reference
    // HTML stored an apostrophe as &#39; (e.g., "don&#39;t") while the live
    // page extracted it as a literal apostrophe (e.g., "don't"). After
    // normalization the reference became "don t" but the live became "don't"
    // — text mismatch, false fail. Real bug filed via libertylandscapefl.com
    // worker feedback 2026-04-25.
    // Decode order: numeric character references first (most specific), then
    // named entities. The numeric form is what HTML serializers most commonly
    // emit (escapeHTML for &, <, >, ", ' uses numeric refs).
    .replace(/&#39;|&#x27;|&apos;/gi, "'")    // apostrophe (most common: numeric, hex, XHTML named)
    .replace(/&#34;|&#x22;|&quot;/gi, '"')    // double quote
    .replace(/&amp;|&#38;|&#x26;/gi, '&')     // ampersand
    .replace(/&lt;|&#60;|&#x3c;/gi, '<')      // less-than
    .replace(/&gt;|&#62;|&#x3e;/gi, '>')      // greater-than
    .replace(/&nbsp;|&#160;|&#xa0;/gi, ' ')   // non-breaking space → regular space (gets collapsed below)
    .replace(/&ldquo;|&rdquo;|&#8220;|&#8221;/gi, '"')  // curly double quotes
    .replace(/&lsquo;|&rsquo;|&#8216;|&#8217;/gi, "'")  // curly single quotes / apostrophes
    .replace(/&ndash;|&#8211;/gi, '-')        // en-dash
    .replace(/&mdash;|&#8212;/gi, '-')        // em-dash
    .replace(/&hellip;|&#8230;/gi, '...')     // ellipsis
    .replace(/&copy;|&#169;/gi, '(c)')        // copyright
    .replace(/&reg;|&#174;/gi, '(r)')         // registered trademark
    .replace(/&trade;|&#8482;/gi, '(tm)')     // trademark

    // Catch-all for any entity not handled above. Strip to NOTHING (empty
    // string), not space — most remaining entities are decorative symbols
    // (arrows, dingbats) that wouldn't insert a word boundary anyway. This
    // also avoids the "don t" false-positive that the old space-strip caused.
    .replace(/&[a-z]+;|&#\d+;|&#x[0-9a-f]+;/gi, '')

    // Normalize Unicode curly quotes / apostrophes / dashes to canonical
    // ASCII forms so "don't" and "don't" match.
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')

    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}
function walkHtmlFiles(dir, files = []) {
  let entries;
  try { entries = readdirSync(dir); } catch { return files; }
  for (const name of entries) {
    const full = join(dir, name);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) {
      // Skip node_modules, _astro asset dir, .vercel
      if (name === 'node_modules' || name === '_astro' || name === '.vercel') continue;
      walkHtmlFiles(full, files);
    } else if (name.endsWith('.html')) {
      files.push(full);
    }
  }
  return files;
}
if (referenceDistPath) {
  if (!existsSync(referenceDistPath)) {
    console.warn(`⚠ --reference-dist ${referenceDistPath} not found — testimonial-tampering check will be skipped.`);
  } else {
    try {
      const files = walkHtmlFiles(referenceDistPath);
      referenceFileCount = files.length;
      // Extract <blockquote>...</blockquote> and <q>...</q> contents from each file.
      // Greedy match, allow nested HTML inside; we strip tags during normalization.
      // Skip /es/ files — the EN reference set should ONLY contain English
      // testimonials. ES testimonials live in --reference-dist-es (loaded below).
      const QUOTE_RX = /<(blockquote|q)[^>]*>([\s\S]*?)<\/\1>/gi;
      for (const filePath of files) {
        // Skip /es/ files when populating the EN set
        if (filePath.includes('/es/') || filePath.includes('\\es\\')) continue;
        const html = readFileSync(filePath, 'utf8');
        let m;
        while ((m = QUOTE_RX.exec(html)) !== null) {
          const norm = normalizeQuoteText(m[2]);
          if (norm.length >= 8) referenceTestimonialSet.add(norm);   // skip near-empty <q> wrappers
        }
      }
      console.log(`✓ Loaded ${referenceTestimonialSet.size} EN testimonial(s) from ${referenceFileCount} reference file(s) at ${referenceDistPath}`);
    } catch (e) {
      console.warn(`⚠ Failed to load --reference-dist ${referenceDistPath}: ${e.message} — testimonial-tampering check will be skipped.`);
    }
  }
} else {
  console.warn('⚠ No --reference-dist <path> passed — testimonial-tampering check will be skipped. Pass --reference-dist jobs/<domain>/option-a/dist when QA-checking Option B or C.');
}

// ---- Build SPANISH reference testimonial corpus (BILINGUAL SUPPORT) ----
// When QA-checking Option C, the worker passes --reference-dist-es pointing at
// option-b/dist (B is the canonical Spanish source).  Walk that dist's /es/
// directory and build a separate Set.  C's Spanish testimonials must appear
// here verbatim — same byte-identical contract as EN, just for the translated
// text.  Strip the literal "(traducido del inglés)" tag during normalization
// since it's added on top of the testimonial body and shouldn't cause a
// false-mismatch (B has it, C must too — checked separately by the
// testimonial-translation-tag rule).
const referenceTestimonialSetEs = new Set();
let referenceFileCountEs = 0;
function normalizeQuoteTextEs(s) {
  if (!s) return '';
  // Strip the translation tag wrapper before normalizing — it's metadata, not
  // part of the testimonial body.
  const stripped = s
    .replace(/<small[^>]*>[^<]*traducido[^<]*<\/small>/gi, ' ')
    .replace(/\(traducido del ingl[eé]s\)/gi, ' ');
  return normalizeQuoteText(stripped);
}
if (referenceDistEsPath) {
  if (!existsSync(referenceDistEsPath)) {
    console.warn(`⚠ --reference-dist-es ${referenceDistEsPath} not found — ES testimonial-tampering check will be skipped.`);
  } else {
    try {
      const allFiles = walkHtmlFiles(referenceDistEsPath);
      const esFiles = allFiles.filter(f => f.includes('/es/') || f.includes('\\es\\'));
      referenceFileCountEs = esFiles.length;
      const QUOTE_RX = /<(blockquote|q)[^>]*>([\s\S]*?)<\/\1>/gi;
      for (const filePath of esFiles) {
        const html = readFileSync(filePath, 'utf8');
        let m;
        while ((m = QUOTE_RX.exec(html)) !== null) {
          const norm = normalizeQuoteTextEs(m[2]);
          if (norm.length >= 8) referenceTestimonialSetEs.add(norm);
        }
      }
      console.log(`✓ Loaded ${referenceTestimonialSetEs.size} ES testimonial(s) from ${referenceFileCountEs} /es/ file(s) at ${referenceDistEsPath}`);
    } catch (e) {
      console.warn(`⚠ Failed to load --reference-dist-es ${referenceDistEsPath}: ${e.message} — ES testimonial-tampering check will be skipped.`);
    }
  }
}

function runTestimonialTamperingCheck(liveTestimonials, viewportName, pagePath) {
  // Pick the right reference set based on whether the page is EN or ES.
  // BILINGUAL SUPPORT 2026-04-30: /es/* pages compare against B's ES
  // (referenceTestimonialSetEs); everything else compares against A's EN
  // (referenceTestimonialSet).
  const isEsPage = (pagePath || '').startsWith('/es/') || pagePath === '/es';
  const refSet = isEsPage ? referenceTestimonialSetEs : referenceTestimonialSet;
  const refLabel = isEsPage ? 'ES reference dist' : 'reference dist';
  const refPath = isEsPage ? (referenceDistEsPath || '(none)') : (referenceDistPath || '(none)');
  const normalizer = isEsPage ? normalizeQuoteTextEs : normalizeQuoteText;
  if (refSet.size === 0) return [];
  const issues = [];
  const reportedAlready = new Set();
  for (const live of liveTestimonials) {
    const norm = normalizer(live);
    if (norm.length < 8) continue;
    if (refSet.has(norm)) continue;
    // Liberal fallback: maybe the live testimonial is a SUBSTRING of a reference one
    // (or vice versa) due to "Read more" truncation. Allow if substring match >= 80% of shorter length.
    let matched = false;
    for (const ref of refSet) {
      const shorter = norm.length < ref.length ? norm : ref;
      const longer = norm.length < ref.length ? ref : norm;
      if (longer.includes(shorter) && shorter.length >= longer.length * 0.8) {
        matched = true;
        break;
      }
    }
    if (matched) continue;
    if (reportedAlready.has(norm)) continue;
    reportedAlready.add(norm);
    issues.push({
      severity: 'fail',
      check: 'testimonial-tampering',
      msg: `Testimonial text "${live.slice(0, 120)}${live.length > 120 ? '…' : ''}" rendered on ${pagePath} does NOT appear verbatim in the ${refLabel} (${refPath}). Reviews/testimonials are real people's words attributed by name — they MUST be byte-identical between A and B (and C) in EN, AND between B and C in ES (BILINGUAL SUPPORT extends the rule to translations). Either revert the rewrite of this testimonial, OR confirm it was a new-from-manifest review the worker added (still must match the manifest verbatim). See TESTIMONIAL & REVIEW PRESERVATION + BILINGUAL SUPPORT rules in SKILL.md.`,
    });
  }
  return issues;
}

// ---- Fact-grounding rules ----
// Each rule has:
//   pattern: regex matched against rendered DOM text
//   verify(match, corpus): returns null if claim is grounded, OR a string
//     explaining what's missing in the corpus (used in the failure message)
//   label: short human description
const CURRENT_YEAR = new Date().getFullYear();

const FACT_RULES = [
  {
    label: 'years-experience',
    // "20+ years", "20+ year", "over 20 years", "more than 20 years"
    pattern: /\b(?:over\s+|more\s+than\s+|nearly\s+|about\s+)?(\d{1,2})\+?\s*-?\s*years?(?:\s+(?:of\s+)?(?:experience|in\s+business|serving|established|of\s+service))?/gi,
    verify(match, corpus) {
      const claimedYears = parseInt(match[1], 10);
      if (!Number.isFinite(claimedYears) || claimedYears < 5) return null; // ignore tiny / non-claims
      // 1) Direct mention: "X years" appears in corpus (any context)
      const directRx = new RegExp(`\\b${claimedYears}\\+?\\s*-?\\s*years?\\b`);
      if (directRx.test(corpus)) return null;
      // 2) Derived from a year: "since YYYY" / "established YYYY" / "founded YYYY" / "in YYYY"
      const yearRx = /\b(?:since|established|founded|est\.?|estd|in|circa)\s+(\d{4})\b|\b(\d{4})\s*-\s*present\b|©\s*(\d{4})/g;
      let y;
      while ((y = yearRx.exec(corpus)) !== null) {
        const yyyy = parseInt(y[1] || y[2] || y[3], 10);
        if (yyyy >= 1900 && yyyy <= CURRENT_YEAR) {
          const derived = CURRENT_YEAR - yyyy;
          if (derived >= claimedYears - 1) return null; // tolerance of 1
        }
      }
      return `manifest contains no "${claimedYears} years" mention and no founding year that would derive ≥${claimedYears} years`;
    },
  },
  {
    label: 'since-year',
    // "since 1998", "established 2003", "founded in 2010"
    pattern: /\b(?:since|established|founded(?:\s+in)?|est\.?|estd|in\s+business\s+since)\s+(\d{4})\b/gi,
    verify(match, corpus) {
      const yyyy = match[1];
      if (!new RegExp(`\\b${yyyy}\\b`).test(corpus)) {
        return `manifest contains no mention of the year ${yyyy}`;
      }
      return null;
    },
  },
  {
    label: 'award-winning',
    pattern: /\b(award[- ]winning|award[- ]winners?|voted\s+(?:best|number\s*one|#?1)|best\s+of\s+\w+|#?1\s+(?:rated|in)|top[- ]rated|five[- ]star\s+rated)\b/gi,
    verify(match, corpus) {
      const evidence = /\b(award|awarded|winner|won|voted|recognition|recognized|honored|honor|best\s+of|top[- ]rated|five[- ]star|5[- ]star|accolade|named\s+(?:best|top))\b/;
      if (evidence.test(corpus)) return null;
      return `manifest contains no award/recognition/voted/best-of evidence to support "${match[0]}"`;
    },
  },
  {
    label: 'bbb-rating',
    pattern: /\b(BBB(?:\s+(?:accredited|a\+?\s+rated|member))?|better\s+business\s+bureau|a\+?\s+rated|a\+?\s+bbb)\b/gi,
    verify(match, corpus) {
      if (/\b(bbb|better\s+business\s+bureau|a\+?\s+rated|a\+?\s+rating)\b/.test(corpus)) return null;
      return `manifest contains no BBB / Better Business Bureau / A+ rating mention`;
    },
  },
  {
    label: 'licensed-bonded-insured',
    // Catches the common trio. Each piece of the trio must be supported individually.
    pattern: /\b(licensed(?:[, ]+(?:bonded|insured|certified))+|bonded(?:[, ]+insured)?|fully\s+(?:licensed|bonded|insured)|certified\s+and\s+(?:licensed|insured))\b/gi,
    verify(match, corpus) {
      const text = match[0].toLowerCase();
      const claims = [];
      if (/licensed/.test(text)) claims.push('licensed');
      if (/bonded/.test(text))   claims.push('bonded');
      if (/insured/.test(text))  claims.push('insured');
      if (/certified/.test(text)) claims.push('certified');
      const missing = claims.filter(c => !new RegExp(`\\b${c}\\b`).test(corpus));
      if (missing.length === 0) return null;
      return `manifest does not mention: ${missing.join(', ')} (claim "${match[0]}" requires each piece in the source)`;
    },
  },
  {
    label: 'ownership-claim',
    // family-owned, veteran-owned, woman-owned, minority-owned, locally-owned
    pattern: /\b((?:family|veteran|woman|women|minority|locally|black|hispanic|asian|lgbtq?\+?)[- ]owned(?:\s+and\s+operated)?)\b/gi,
    verify(match, corpus) {
      // The literal phrase (with hyphen normalized) must exist in corpus
      const phrase = match[1].toLowerCase().replace(/\s+/g, '[- ]');
      // Build a flexible regex: "family-owned" or "family owned"
      const adj = match[1].split(/[- ]/)[0].toLowerCase();
      const flexRx = new RegExp(`\\b${adj}[- ]owned\\b`);
      if (flexRx.test(corpus)) return null;
      return `manifest does not contain "${match[1]}" or any "${adj}-owned" mention`;
    },
  },
  {
    label: 'review-count',
    // "200+ five-star reviews", "500+ happy customers", "1000+ satisfied clients"
    pattern: /\b(\d{2,5})\+?\s*(five[- ]star|5[- ]star|happy|satisfied|delighted|verified|google|yelp)\s+(reviews?|customers?|clients?|ratings?)\b/gi,
    verify(match, corpus) {
      const n = match[1];
      // Direct number mention OR mention of customer/review count more loosely
      if (new RegExp(`\\b${n}\\+?\\s*\\b`).test(corpus)) return null;
      return `manifest does not mention "${n}" alongside reviews/customers/clients (claim: "${match[0]}")`;
    },
  },
  {
    label: 'star-rating',
    // "4.9 stars", "5-star rated", "★★★★★ 4.9"
    pattern: /\b([45](?:\.\d)?)\s*[- ]?\s*star(?:\s+rated|\s+rating|s)?\b/gi,
    verify(match, corpus) {
      const n = match[1];
      if (new RegExp(`\\b${n}\\b`).test(corpus)) return null;
      // Generic "5-star" might be supported by mention of stars or reviews
      if (n === '5' && /\b(5[- ]star|five[- ]star|★{4,})\b/.test(corpus)) return null;
      return `manifest does not contain a ${n}-star rating reference`;
    },
  },
  {
    label: 'availability-promise',
    pattern: /\b(24[\/.]7|24[- ]hour\s+(?:service|response|availability|emergency)|round[- ]the[- ]clock|same[- ]day\s+service|next[- ]day\s+service|free\s+(?:estimates?|quotes?|consultations?)|free\s+(?:in[- ]home|on[- ]site)\s+(?:estimates?|quotes?))\b/gi,
    verify(match, corpus) {
      const text = match[0].toLowerCase();
      // Try a series of evidence patterns
      if (/24\s*[\/\.\-]?\s*7|24[- ]hour|round[- ]the[- ]clock|day\s+or\s+night|anytime|always\s+available/.test(corpus)) {
        if (/24|round/.test(text)) return null;
      }
      if (/same[- ]day|next[- ]day|fast\s+response|quick\s+response/.test(corpus)) {
        if (/same[- ]day|next[- ]day/.test(text)) return null;
      }
      if (/free\s+(?:estimates?|quotes?|consultations?|in[- ]home|on[- ]site)/.test(corpus)) {
        if (/free/.test(text)) return null;
      }
      return `manifest does not support availability/free promise "${match[0]}"`;
    },
  },
];

function runFactGroundingCheck(visibleText) {
  if (!manifestCorpus) return []; // skipped (warning already emitted at startup)
  const issues = [];
  const seenClaims = new Set(); // de-dupe identical claims rendered multiple times
  for (const rule of FACT_RULES) {
    rule.pattern.lastIndex = 0;
    let m;
    while ((m = rule.pattern.exec(visibleText)) !== null) {
      const claim = m[0].trim();
      const dedupeKey = `${rule.label}::${claim.toLowerCase()}`;
      if (seenClaims.has(dedupeKey)) continue;
      seenClaims.add(dedupeKey);
      const reason = rule.verify(m, manifestCorpus);
      if (reason) {
        issues.push({
          severity: 'fail',
          check: 'fact-grounding',
          msg: `Unsupported fact claim "${claim}" (${rule.label}): ${reason}. Either remove the claim OR back it with a real fact from the manifest. See FACT GROUNDING PRINCIPLE in SKILL.md.`,
        });
      }
    }
  }
  return issues;
}

// ---- Viewports (mobile is first-class — half the audience) ----
// Every check runs at BOTH viewports. Some bugs only manifest at mobile
// (text overflow, broken hamburger nav, image stretching, hero text
// disappearing into a tall photo). Some bugs only manifest at desktop
// (wide layouts, multi-column grids breaking). Running both catches both.
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile',  width: 390,  height: 844 },  // iPhone 14
];

async function main() {
  const browser = await chromium.launch();
  const consoleErrors = [];
  const failedRequests = [];
  const results = [];

  for (const viewport of VIEWPORTS) {
    const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
    page.on('console', m => { if (m.type() === 'error') consoleErrors.push(`[${viewport.name}] ${m.text()}`); });
    page.on('response', r => { if (r.status() >= 400) failedRequests.push(`[${viewport.name}] ${r.status()} ${r.url()}`); });

  for (const p of paths) {
    const url = baseUrl + p;
    console.log(`\n→ Checking ${url} @ ${viewport.name} (${viewport.width}×${viewport.height})`);
    await page.goto(url, { waitUntil: 'networkidle' });

    // Force-reveal every progressive-enhancement reveal target so contrast
    // checks see the FINAL visible state, not the pre-IntersectionObserver
    // opacity-0 state.  Without this, the alpha-aware text-contrast rule
    // (added 2026-04-29) flags every below-fold heading inside a `.fade-up`
    // wrapper because the ancestor opacity is still 0 at networkidle time —
    // the IntersectionObserver hasn't fired for off-viewport elements yet.
    // Real users scroll and see fully-revealed content; the QA check should
    // measure that same end-state.
    //
    // Belt-and-suspenders approach: (1) explicitly add `.has-animations` +
    // `.visible` classes so any CSS that gates on them resolves to the
    // revealed state; (2) scroll the entire page top-to-bottom so the real
    // IntersectionObserver fires for below-fold elements; (3) scroll back to
    // top and wait one frame for any final layout to settle.
    await page.evaluate(async () => {
      document.documentElement.classList.add('has-animations');
      for (const el of document.querySelectorAll('.fade-up, .stagger')) {
        el.classList.add('visible');
      }
      const distance = 240;
      const total = document.body.scrollHeight;
      for (let y = 0; y <= total; y += distance) {
        window.scrollTo(0, y);
        await new Promise(r => setTimeout(r, 30));
      }
      window.scrollTo(0, 0);
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    });

    const out = await page.evaluate(() => {
      const report = { issues: [] };

      // ---- Helpers ----
      function rgbToHex(rgbStr) {
        const m = rgbStr.match(/rgba?\((\d+)\D+(\d+)\D+(\d+)/);
        if (!m) return null;
        return '#' + [m[1], m[2], m[3]]
          .map(n => parseInt(n, 10).toString(16).padStart(2, '0'))
          .join('');
      }
      function colorDistance(hex1, hex2) {
        const a = hex1.match(/[\da-f]{2}/gi).map(h => parseInt(h, 16));
        const b = hex2.match(/[\da-f]{2}/gi).map(h => parseInt(h, 16));
        return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
      }
      function effectiveBackground(el) {
        // Walk up the parent chain until we find a non-transparent background
        let cur = el;
        while (cur && cur !== document.documentElement) {
          const bg = getComputedStyle(cur).backgroundColor;
          if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg;
          cur = cur.parentElement;
        }
        return 'rgb(255, 255, 255)';
      }

      // Logo check — the first <img> in a <nav> or <header>
      const logo = document.querySelector('nav img, header img');
      if (!logo) {
        report.issues.push({ severity: 'warn', check: 'logo', msg: 'No <img> found in nav/header' });
      } else {
        const rect = logo.getBoundingClientRect();
        const displayedW = rect.width;
        const naturalW = logo.naturalWidth;
        const navBgRgb = effectiveBackground(logo);
        const navBgHex = rgbToHex(navBgRgb);
        report.logo = {
          src: logo.src,
          naturalW,
          naturalH: logo.naturalHeight,
          displayedW: Math.round(displayedW),
          displayedH: Math.round(rect.height),
          navBackground: navBgHex,
        };
        if (naturalW === 0) {
          report.issues.push({ severity: 'fail', check: 'logo', msg: `Logo image failed to load: ${logo.src}` });
        } else if (naturalW < 100) {
          report.issues.push({ severity: 'fail', check: 'logo', msg: `Logo is only ${naturalW}px wide (likely a favicon crop). Source: ${logo.src}` });
        } else if (naturalW < displayedW * 1.5) {
          report.issues.push({ severity: 'warn', check: 'logo', msg: `Logo will appear blurry on retina: natural ${naturalW}px, displayed ${Math.round(displayedW)}px (ratio ${(naturalW/displayedW).toFixed(2)}x, want >=1.5x)` });
        }

        // Placeholder detection — catches CMS-platform "your logo here" defaults
        // (Real bug from morettiscentryautobody.com 2026-04-25: shipped Hibu's
        //  gen-logo-*.png placeholder showing wireframe sun + the word "logo")
        const PLACEHOLDER_URL_PATTERNS = [
          /\bgen-logo\b/i, /\bgenerated-logo\b/i,
          /\bplaceholder\b/i, /\bdefault-logo\b/i, /\btemplate-logo\b/i,
          /\blogo-placeholder\b/i, /\blogo-default\b/i,
          /\byour-logo-here\b/i, /\bdefault-image\b/i,
          /\bdefault-site-icon\b/i, /\bwix-default\b/i,
        ];
        if (logo.src && PLACEHOLDER_URL_PATTERNS.some(p => p.test(logo.src))) {
          report.issues.push({
            severity: 'fail',
            check: 'logo-is-placeholder',
            msg: `Logo URL matches CMS-placeholder pattern (${logo.src}). The customer never uploaded a real logo to their original site — we shipped the platform's default. Re-run fix-logo.js to use the favicon fallback OR set the logo to plain text business name.`,
          });
        }
        // Alt-text or adjacent-text "logo" check — generic placeholders often have
        // alt="Logo" or the literal word "logo" rendered next to a generic SVG icon
        const altText = (logo.alt || '').trim().toLowerCase();
        const PLACEHOLDER_ALT_TEXTS = ['logo', 'site logo', 'company logo', 'your logo', 'your logo here', 'placeholder', 'default'];
        if (PLACEHOLDER_ALT_TEXTS.includes(altText)) {
          report.issues.push({
            severity: 'warn',
            check: 'logo-generic-alt',
            msg: `Logo alt text is generic ("${logo.alt}") — should be the verbatim business name. Often a sign the logo itself is a template default.`,
          });
        }
        // Visible text "logo" inside the same nav link (the Moretti's bug rendered "logo" as italic text next to a wireframe SVG)
        const navLinkParent = logo.closest('a');
        if (navLinkParent) {
          const linkText = (navLinkParent.textContent || '').trim().toLowerCase();
          if (linkText === 'logo' || linkText.split(/\s+/).every(w => /^(logo|your|here|placeholder)$/.test(w))) {
            report.issues.push({
              severity: 'fail',
              check: 'logo-literal-text',
              msg: `Nav link wrapping the logo image contains literal placeholder text "${linkText}" — this is the worker session inventing a logo. Remove the inline placeholder graphic and use either the original logo, favicon, or plain business name text.`,
            });
          }
        }

        // Background match check — sample the corners of the rendered logo via canvas.
        // If the logo is opaque (corner pixels all alpha=255 AND all the same colour)
        // and that colour does not match the nav background, flag a fail.
        try {
          const c = document.createElement('canvas');
          c.width = logo.naturalWidth;
          c.height = logo.naturalHeight;
          const ctx = c.getContext('2d');
          ctx.drawImage(logo, 0, 0);
          const w = c.width, h = c.height;
          const corners = [
            ctx.getImageData(0, 0, 1, 1).data,
            ctx.getImageData(w - 1, 0, 1, 1).data,
            ctx.getImageData(0, h - 1, 1, 1).data,
            ctx.getImageData(w - 1, h - 1, 1, 1).data,
          ];
          const allOpaque = corners.every(d => d[3] >= 250);
          const allAgree = corners.every(d =>
            Math.abs(d[0] - corners[0][0]) < 5 &&
            Math.abs(d[1] - corners[0][1]) < 5 &&
            Math.abs(d[2] - corners[0][2]) < 5
          );
          if (allOpaque && allAgree) {
            const c0 = corners[0];
            const logoBgHex = '#' + [c0[0], c0[1], c0[2]]
              .map(n => n.toString(16).padStart(2, '0')).join('');
            report.logo.logoBackground = logoBgHex;
            if (navBgHex && logoBgHex && colorDistance(logoBgHex, navBgHex) > 12) {
              report.issues.push({
                severity: 'fail',
                check: 'logo-bg-mismatch',
                msg: `Logo has solid ${logoBgHex} background but nav is ${navBgHex} — visible colour mismatch. Either find a transparent logo variant OR change nav background to ${logoBgHex}.`,
              });
            }
          }
        } catch (e) {
          // Cross-origin or canvas tainted — silently skip background check
          report.logo.bgCheckError = String(e).slice(0, 100);
        }
      }

      // Broken images
      const brokenImgs = Array.from(document.querySelectorAll('img')).filter(i => i.complete && i.naturalWidth === 0).map(i => i.src);
      if (brokenImgs.length) {
        for (const src of brokenImgs) {
          report.issues.push({ severity: 'fail', check: 'broken-image', msg: src });
        }
      }

      // ---- Hero contrast check (added after Naples + Tampa Bay bugs) ----
      // For each major heading in the first viewport, check that:
      //   1. If an ancestor has a background-image, there must be an overlay between image and text
      //   2. The text colour has WCAG-acceptable contrast against the effective background
// Canonical OKLab → sRGB conversion (Björn Ottosson's formulas).
// https://bottosson.github.io/posts/oklab/
// The previous implementation here was a made-up approximation that returned
// purplish values for pure white and similar nonsense — every Tailwind v4
// page using oklab() colors got garbage contrast calculations. Real bug
// caught 2026-04-26 via usplumbing.net worker feedback (which initially
// flagged a const-b naming collision; the rename was already partially
// applied locally, but the deeper math bug remained — fixed here).
function oklabToSrgb(L, a, b, alpha) {
  // OKLab → LMS (cube root space)
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  // Cube to get linear LMS
  const lL = l_ * l_ * l_;
  const lM = m_ * m_ * m_;
  const lS = s_ * s_ * s_;
  // Linear LMS → linear sRGB (matrix from Ottosson)
  const rLin =  4.0767416621 * lL - 3.3077115913 * lM + 0.2309699292 * lS;
  const gLin = -1.2684380046 * lL + 2.6097574011 * lM - 0.3413193965 * lS;
  const bLin = -0.0041960863 * lL - 0.7034186147 * lM + 1.7076147010 * lS;
  // Linear sRGB → gamma-encoded sRGB
  const toSrgb = (c) => {
    c = Math.max(0, Math.min(1, c));
    return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  };
  return {
    r: Math.round(toSrgb(rLin) * 255),
    g: Math.round(toSrgb(gLin) * 255),
    b: Math.round(toSrgb(bLin) * 255),
    a: alpha === undefined ? 1 : alpha,
  };
}

function rgbToHexFromComputed(rgb) {
  const m = rgb && rgb.match(/rgba?\((\d+)\D+(\d+)\D+(\d+)(?:\D+([\d.]+))?/);
  if (m) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] !== undefined ? parseFloat(m[4]) : 1 };
  // Tailwind v4 oklab() support — uses canonical Ottosson conversion above
  const okm = rgb && rgb.match(/^oklab\(([\d.]+)\s+([\d.-]+)\s+([\d.-]+)(?:\s*\/\s*([\d.]+))?\)$/);
  if (okm) {
    return oklabToSrgb(+okm[1], +okm[2], +okm[3], okm[4] !== undefined ? +okm[4] : 1);
  }
  // oklch() support — Tailwind v4 emits oklch for many palette utilities
  // (slate-, zinc-, stone-, gray-, neutral-).  Convert chroma+hue to oklab a/b
  // then route through oklabToSrgb.
  const okch = rgb && rgb.match(/^oklch\(([\d.]+)\s+([\d.-]+)\s+([\d.-]+)(?:\s*\/\s*([\d.]+))?\)$/);
  if (okch) {
    const L = +okch[1];
    const C = +okch[2];
    const hRad = +okch[3] * Math.PI / 180;
    const a_alpha = okch[4] !== undefined ? +okch[4] : 1;
    return oklabToSrgb(L, C * Math.cos(hRad), C * Math.sin(hRad), a_alpha);
  }
  return null;
}
      function hexStr(c) {
        return '#' + [c.r, c.g, c.b].map(n => n.toString(16).padStart(2, '0')).join('');
      }
      function relLum(c) {
        const ch = (v) => {
          v = v / 255;
          return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        };
        return 0.2126 * ch(c.r) + 0.7152 * ch(c.g) + 0.0722 * ch(c.b);
      }
      function contrastRatio(a, b) {
        const la = relLum(a);
        const lb = relLum(b);
        const [hi, lo] = la > lb ? [la, lb] : [lb, la];
        return (hi + 0.05) / (lo + 0.05);
      }
      function blendOverGray(overlay) {
        // Approximate effective background = overlay color blended over a 50%-gray baseline (the "average photo")
        const a = overlay.a;
        const baseline = { r: 128, g: 128, b: 128 };
        return {
          r: Math.round(overlay.r * a + baseline.r * (1 - a)),
          g: Math.round(overlay.g * a + baseline.g * (1 - a)),
          b: Math.round(overlay.b * a + baseline.b * (1 - a)),
        };
      }
      function findOverlayInChain(el, root) {
        // Look for a sibling/ancestor with a non-transparent background-color
        // positioned absolute/fixed (the overlay pattern). Walk up to root.
        let cur = el;
        while (cur && cur !== root) {
          const parent = cur.parentElement;
          if (!parent) break;
          for (const sibling of parent.children) {
            if (sibling === cur) continue;
            const sStyle = getComputedStyle(sibling);
            const pos = sStyle.position;
            if (pos === 'absolute' || pos === 'fixed') {
              const bg = rgbToHexFromComputed(sStyle.backgroundColor);
              if (bg && bg.a > 0.05) {
                return { overlay: bg, source: 'sibling' };
              }
            }
          }
          // Also check if cur itself has a non-transparent background that isn't an image
          const cStyle = getComputedStyle(cur);
          const cBg = rgbToHexFromComputed(cStyle.backgroundColor);
          if (cBg && cBg.a > 0.5) return { overlay: cBg, source: 'self-or-ancestor' };
          cur = parent;
        }
        return null;
      }
      function findBackgroundImageAncestor(el, root) {
        let cur = el;
        while (cur && cur !== root) {
          const s = getComputedStyle(cur);
          if (s.backgroundImage && s.backgroundImage !== 'none' && s.backgroundImage.includes('url(')) {
            return cur;
          }
          // Also check for <img> inside the same positioned ancestor (the layered hero pattern)
          if (s.position === 'relative' || s.position === 'absolute') {
            const img = cur.querySelector(':scope > img');
            if (img && img.getBoundingClientRect().width > 200) {
              return cur;
            }
          }
          cur = cur.parentElement;
        }
        return null;
      }

      const headings = Array.from(document.querySelectorAll('h1, h2'));
      for (const h of headings) {
        const rect = h.getBoundingClientRect();
        // Only check headings in the first viewport
        if (rect.top > 1000 || rect.bottom < 0) continue;
        if (rect.width === 0 || rect.height === 0) continue;

        const hStyle = getComputedStyle(h);
        const textColor = rgbToHexFromComputed(hStyle.color);
        if (!textColor) continue;

        const bgImgAncestor = findBackgroundImageAncestor(h, document.body);
        if (!bgImgAncestor) continue; // No photo background; skip contrast check

        const overlay = findOverlayInChain(h, bgImgAncestor.parentElement || document.body);
        if (!overlay) {
          report.issues.push({
            severity: 'fail',
            check: 'hero-no-overlay',
            msg: `Heading "${h.textContent.trim().slice(0, 60)}" sits on a background-image without an overlay/scrim layer. Text contrast is unpredictable. Add an overlay div between the image and the text (see HERO CONTRAST RULE in SKILL.md).`,
          });
          continue;
        }

        const effectiveBg = blendOverGray(overlay.overlay);
        const ratio = contrastRatio(textColor, effectiveBg);
        const fontSize = parseFloat(hStyle.fontSize);
        const fontWeight = parseInt(hStyle.fontWeight, 10) || 400;
        const isLarge = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700);
        const minRatio = isLarge ? 3.0 : 4.5;

        if (ratio < minRatio) {
          report.issues.push({
            severity: 'fail',
            check: 'hero-low-contrast',
            msg: `Heading "${h.textContent.trim().slice(0, 60)}" has only ${ratio.toFixed(2)}:1 contrast. Text ${hexStr(textColor)} on overlay-blended bg ${hexStr(effectiveBg)} (overlay was ${hexStr(overlay.overlay)} @ alpha ${overlay.overlay.a.toFixed(2)}). Need ${minRatio}:1 minimum. Strengthen the overlay opacity OR change text color.`,
          });
        }
      }
      // ---- end hero contrast check ----

      // Literal unicode escape sequences rendered as visible text
      const bodyText = document.body.innerText;
      const escapes = bodyText.match(/\\u[0-9a-fA-F]{4}/g);
      if (escapes) {
        report.issues.push({ severity: 'fail', check: 'unicode-escapes', msg: `Found ${escapes.length} literal \\uXXXX escapes in visible text: ${[...new Set(escapes)].slice(0, 5).join(', ')}` });
      }

      // ---- HTML numeric character reference literals rendered as visible text ----
      // Real bug shipped 2026-04-28 (Bugs-B-Gone Pest Control): worker put
      // `{ icon: '&#128027;' }` in an Astro component data array and rendered
      // as `{service.icon}` — Astro JSX expressions auto-HTML-escape the `&`,
      // so the rendered HTML became `&amp;#128027;` which the browser shows as
      // the LITERAL TEXT "&#128027;" instead of the intended bug emoji 🐛.
      // Six service cards on the homepage shipped with raw entity-reference
      // text instead of emoji icons.
      //
      // Same bug class as \uXXXX above — escape sequences in a context where
      // they don't get decoded. Catches both decimal (&#NNNN;) and hex (&#xHHHH;)
      // numeric character references AND named entities (&someword;) when they
      // appear as visible text.
      //
      // The right fix in source: use literal emoji characters (🐛 not '&#128027;')
      // OR use Astro's `set:html` directive to inject raw HTML, OR put the
      // entity in HTML markup directly (outside `{...}` expressions).
      const htmlEntityLiterals = bodyText.match(/&#\d+;|&#x[0-9a-fA-F]+;|&[a-z]{2,15};/gi);
      if (htmlEntityLiterals) {
        // Filter out anything that's likely intentional in body copy (extremely rare;
        // really anything matching this pattern in innerText is a bug since the
        // browser SHOULD have decoded the entity at parse time).
        const literals = [...new Set(htmlEntityLiterals)];
        if (literals.length > 0) {
          report.issues.push({
            severity: 'fail',
            check: 'html-entity-literal',
            msg: `Found ${htmlEntityLiterals.length} literal HTML entity reference(s) rendered as visible text: ${literals.slice(0, 6).join(', ')}. The browser should have decoded these at parse time — their visibility means the source was DOUBLE-ESCAPED somewhere (e.g., '&#128027;' put inside an Astro {expression} which HTML-escaped the '&' to '&amp;'). Fix in source: use literal emoji characters (🐛 not '&#128027;'), OR use Astro's set:html directive, OR place the entity in raw HTML markup outside {...} expressions. Same bug class as the \\uXXXX-escape rule above.`,
          });
        }
      }
      // ---- end HTML entity literal check ----

      // Key presence checks
      if (!document.querySelector('nav')) report.issues.push({ severity: 'fail', check: 'structure', msg: 'No <nav> element' });
      if (!document.querySelector('footer')) report.issues.push({ severity: 'fail', check: 'structure', msg: 'No <footer> element' });
      if (!document.querySelector('h1')) report.issues.push({ severity: 'fail', check: 'structure', msg: 'No <h1> element' });

      // ---- Link audit (added after libertylandscapefl.com social-href bug, 2026-04-25) ----
      // Bugs caught:
      //   1. Social icons (Facebook, Instagram, etc.) with href pointing to the customer's own site instead of the platform
      //   2. Placeholder hrefs (#, /, javascript:void(0), empty)
      //   3. Wrong-platform links (a Facebook icon linking to Instagram, etc.)
      // SOCIAL_PLATFORMS — each entry has the canonical name, accepted aliases
      // (short forms like 'fb', 'ig' that often appear in custom icon class names
      // and SVG file names), and the destination domains the href must match.
      // Aliases were added 2026-04-25 after a recurrence of the libertylandscapefl
      // bug pattern showed the detector missing icons identified only by alias
      // names like `icon-fb` or `<img src="/icons/fb.svg">`.
      const SOCIAL_PLATFORMS = [
        { name: 'facebook',  aliases: ['fb'],            domains: ['facebook.com', 'fb.com', 'fb.me'] },
        { name: 'instagram', aliases: ['ig', 'insta'],   domains: ['instagram.com', 'instagr.am'] },
        { name: 'linkedin',  aliases: ['li'],            domains: ['linkedin.com', 'lnkd.in'] },
        { name: 'youtube',   aliases: ['yt'],            domains: ['youtube.com', 'youtu.be'] },
        { name: 'tiktok',    aliases: ['tt'],            domains: ['tiktok.com'] },
        { name: 'twitter',   aliases: ['tw', 'twitter-x', 'x-twitter'], domains: ['twitter.com', 'x.com', 't.co'] },
        { name: 'yelp',      aliases: [],                domains: ['yelp.com', 'yelp.to'] },
        { name: 'pinterest', aliases: ['pin'],           domains: ['pinterest.com', 'pin.it'] },
        // 'google' deliberately omitted — phrases like "Find us on Google" / "Google Maps"
        // are common copy and would false-positive. Google Maps destinations are still
        // checked structurally by hostname below.
      ];

      const allLinks = Array.from(document.querySelectorAll('a[href]'));
      const currentHostname = window.location.hostname;

      // Word-boundary regex factory — matches the platform name as a discrete
      // token, not embedded in another word. Used uniformly across detection paths.
      function wordBoundaryRx(name) {
        return new RegExp(`(^|[^a-z0-9])${name}([^a-z0-9]|$)`, 'i');
      }

      // Detect whether an anchor visually appears to be an icon-only "social"
      // link (no text — just a graphic). This is the second-line failsafe: even
      // when we can't identify which platform, an icon-only link in the footer
      // pointing to an internal page is almost certainly a misconfigured social
      // link and the gate should fail.
      function isIconOnlyLink(a) {
        // Compute "real" visible text by stripping out content inside icon-glyph
        // elements (Material Symbols renders the icon NAME as text content —
        // "thumb_up", "favorite" — which gets visually replaced by the icon
        // font but is still in innerText). Same for FontAwesome/Bootstrap Icons
        // when they use ligature-style glyphs.
        const clone = a.cloneNode(true);
        // Remove all icon-glyph elements from the clone before measuring text
        for (const iconEl of clone.querySelectorAll('[class*="material-symbols"], [class*="material-icons"], [class*="fa-"], i.fas, i.fab, i.far, i.fal, i.bi, [class*="icon-"]')) {
          iconEl.remove();
        }
        const visibleText = (clone.textContent || '').replace(/\s+/g, '').trim();
        if (visibleText.length > 0) return false;  // has real text, not icon-only
        const hasSvg = !!a.querySelector('svg');
        const hasImg = !!a.querySelector('img');
        const hasMatSym = !!a.querySelector('[class*="material-symbols"], [class*="material-icons"]');
        const hasFa = !!a.querySelector('[class*="fa-"], i.fas, i.fab, i.far, i.fal, i.bi');
        const hasGenericIcon = !!a.querySelector('[class*="icon-"]');
        return hasSvg || hasImg || hasMatSym || hasFa || hasGenericIcon;
      }

      // Detect whether an href points to the customer's own site (any internal
      // route OR the same hostname). Used for the icon-link-in-footer failsafe.
      function isInternalHref(rawHref, fullHref) {
        if (!rawHref) return true;  // empty href → internal-ish (broken)
        if (rawHref.startsWith('#') || rawHref === '/' || rawHref.startsWith('?')) return true;
        if (/^(tel:|mailto:|sms:|callto:|javascript:)/i.test(rawHref)) return false;  // not internal but not social either
        try {
          const u = new URL(fullHref, window.location.origin);
          const linkHost = u.hostname.replace(/^www\./, '');
          const myHost = currentHostname.replace(/^www\./, '');
          return linkHost === myHost;
        } catch {
          return true;  // malformed → treat as internal/suspicious
        }
      }

      for (const a of allLinks) {
        const rawHref = a.getAttribute('href') || '';
        const fullHref = a.href || '';
        const text = (a.textContent || '').toLowerCase().trim();
        const ariaLabel = (a.getAttribute('aria-label') || '').toLowerCase();
        const title = (a.getAttribute('title') || '').toLowerCase();
        const className = (a.className || '').toString().toLowerCase();
        const innerHtml = (a.innerHTML || '').toLowerCase();
        // Collect every <img src> and <use href> filename inside the anchor —
        // catches `<img src="/images/facebook-icon.svg">` and `<use href="#icon-fb">`.
        const innerImgSrcs = Array.from(a.querySelectorAll('img[src]')).map(i => i.getAttribute('src') || '').join(' ').toLowerCase();
        const innerUseHrefs = Array.from(a.querySelectorAll('use')).map(u => u.getAttribute('href') || u.getAttribute('xlink:href') || '').join(' ').toLowerCase();

        // Early exit: tel:, mailto:, sms: links can never be social platforms.
        if (/^(tel:|mailto:|sms:|callto:)/i.test(rawHref)) continue;

        // Detect what platform this link claims to be.
        // ALL detection paths use word-boundary or whitespace-token matching.
        // No raw `String.includes(name)` — that's the false-positive trap.
        let claimedPlatform = null;
        for (const p of SOCIAL_PLATFORMS) {
          const allNames = [p.name, ...p.aliases];

          let matched = false;
          for (const name of allNames) {
            const wordRe = wordBoundaryRx(name);

            // Path 1 — visible text mentions the platform as a discrete word
            // (full names only — aliases like 'fb' too short for body-text match)
            const textHit = name === p.name ? wordRe.test(text) : false;

            // Path 2 — aria-label or title mentions the platform/alias
            const ariaHit  = wordRe.test(ariaLabel);
            const titleHit = wordRe.test(title);

            // Path 3 — className contains an exact whitespace-separated token
            // matching the name/alias OR conventional `icon-{name}` / `social-{name}` patterns.
            const classTokens = className.split(/\s+/);
            const classHit =
              classTokens.includes(name) ||
              classTokens.includes(`icon-${name}`) ||
              classTokens.includes(`social-${name}`) ||
              classTokens.includes(`${name}-icon`);

            // Path 4 — innerHTML contains a structured icon-library class
            // (word-boundary anchored so partial collisions can't trigger).
            const iconRx = new RegExp(`\\b(fa|bi|fab|fas|far|fal)-${name}\\b`, 'i');
            const iconHit = iconRx.test(innerHtml) ||
              (innerHtml.includes('material-symbols') && wordRe.test(innerHtml));

            // Path 5 (NEW) — inner <img src> filename or <use href> contains the
            // platform name/alias. Catches `<img src="/icons/facebook.svg">` and
            // `<use href="#icon-fb">` patterns where the only platform signal is
            // in a child element's attribute.
            const imgSrcHit = wordRe.test(innerImgSrcs) || wordRe.test(innerUseHrefs);

            if (textHit || ariaHit || titleHit || classHit || iconHit || imgSrcHit) {
              matched = true;
              break;
            }
          }
          if (matched) { claimedPlatform = p; break; }
        }

        // Check 1: placeholder href (always bad if claimed platform).
        // NOTE: do NOT `continue` here even when claimedPlatform is null — the
        // failsafe (Check 3) below needs a chance to catch icon-only anchors
        // with internal hrefs, including "/" (home). Previous bug: an SVG-only
        // anchor with href="/" had no claimedPlatform so this branch silently
        // skipped, AND `continue` prevented Check 3 from seeing it.
        let placeholderHandled = false;
        if (rawHref === '' || rawHref === '#' || rawHref === '/' || rawHref.startsWith('javascript:')) {
          if (claimedPlatform) {
            report.issues.push({
              severity: 'fail',
              check: 'social-link-placeholder',
              msg: `${claimedPlatform.name} link has placeholder href "${rawHref}" — must point to ${claimedPlatform.domains[0]}. Visitors clicking the icon will go nowhere.`,
            });
            placeholderHandled = true;
          }
          // Don't fail every "/" link — that's the home link. Only flag empty/# anywhere.
          else if (rawHref === '' || rawHref === '#') {
            report.issues.push({
              severity: 'warn',
              check: 'dead-link',
              msg: `Link with text "${text.slice(0, 40)}" has placeholder href "${rawHref}" — points nowhere.`,
            });
            placeholderHandled = true;
          }
          // Note: rawHref === '/' with no claimedPlatform deliberately falls
          // through to Check 3 (failsafe) — it's the home link MOST of the time
          // but could be a misconfigured social icon, and Check 3 disambiguates.
        }
        if (placeholderHandled) continue;

        // Check 2: claimed-platform link points to wrong domain (or back to customer's own site)
        if (claimedPlatform) {
          let url;
          try { url = new URL(fullHref, window.location.origin); }
          catch {
            report.issues.push({
              severity: 'fail',
              check: 'social-link-malformed',
              msg: `${claimedPlatform.name} link has malformed href: ${rawHref}`,
            });
            continue;
          }

          const linkHost = url.hostname.replace(/^www\./, '');
          const linkPath = url.hostname + url.pathname;
          const matchesPlatform = claimedPlatform.domains.some(d => linkHost.includes(d.split('/')[0]) || linkPath.includes(d));
          const pointsToCustomerSite = linkHost === currentHostname || linkHost === currentHostname.replace(/^www\./, '');

          if (pointsToCustomerSite || !matchesPlatform) {
            report.issues.push({
              severity: 'fail',
              check: 'social-link-wrong-destination',
              msg: `${claimedPlatform.name} icon/text labels this link, but href points to "${url.hostname}${url.pathname}" instead of ${claimedPlatform.domains[0]}. ${pointsToCustomerSite ? 'It is pointing at the customer\'s OWN website — pull the real URL from manifest.json business.socials.' : 'Wrong platform domain.'}`,
            });
          }
        }

        // Check 3 (NEW — structural failsafe): icon-only anchor in <footer> or
        // dedicated "social" container with INTERNAL href, AND no platform
        // identifier matched. This catches the loophole where a worker session
        // forgets to add aria-label / a recognizable class / a known icon name —
        // the visual icon (Material Symbols proxy, inline SVG, custom <img>)
        // looks like Facebook/Instagram to the visitor, but our detector had no
        // signal to identify the platform. Even WITHOUT identifying the platform,
        // we can say: "this is an icon-only link in the footer pointing internally,
        // which is almost always a misconfigured social link."
        // Real recurrence 2026-04-25: user reported Facebook/Instagram icons
        // pointing to the customer's own page despite the previous fix.
        if (!claimedPlatform && a.closest('footer, [class*="social"], [class*="Social"]')) {
          if (isIconOnlyLink(a) && isInternalHref(rawHref, fullHref)) {
            const iconHints = [];
            if (a.querySelector('svg')) iconHints.push('inline <svg>');
            if (a.querySelector('img')) iconHints.push(`<img src="${(a.querySelector('img').getAttribute('src') || '').slice(0, 60)}">`);
            const matSym = a.querySelector('[class*="material-symbols"], [class*="material-icons"]');
            if (matSym) iconHints.push(`material-symbols (icon name: "${(matSym.textContent || '').trim().slice(0, 30)}")`);
            const fa = a.querySelector('[class*="fa-"], i.fas, i.fab');
            if (fa) iconHints.push(`Font Awesome (class: "${(fa.className || '').toString().slice(0, 60)}")`);
            const generic = a.querySelector('[class*="icon-"]');
            if (generic && !fa) iconHints.push(`generic icon (class: "${(generic.className || '').toString().slice(0, 60)}")`);

            report.issues.push({
              severity: 'fail',
              check: 'social-link-icon-internal-href',
              msg: `Icon-only anchor in footer/social container with INTERNAL href="${rawHref}" — this is the social-link-points-to-customer-site bug pattern. Detector could not identify the platform from the markup (no aria-label naming a platform, no recognizable icon class, no platform-named img/svg src). Icon hints: ${iconHints.join(', ') || '(unrecognized)'}. If this is a social link, set the href to the FULL EXTERNAL URL from the manifest (e.g. https://www.facebook.com/...) AND add aria-label="{platform}" so future QA can identify it. If it's NOT a social link, replace the icon with text so the destination is obvious. See SOCIAL LINKS RULE in SKILL.md.`,
            });
          }
        }
      }
      // ---- end link audit ----

      // ---- Video CTA audit (added after morettiscentryautobody.com bug, 2026-04-25) ----
      // Catches "Watch Video" / "Play Video" buttons whose href doesn't point to an
      // actual video resource (real bug: CTA linked to /about and /contact pages).
      const VIDEO_CTA_TEXTS = [
        /^watch\s+(our\s+)?(video|story|demo|work)$/i,
        /^play\s+video$/i,
        /^view\s+(our\s+)?(video|demo)$/i,
        /^see\s+(our\s+)?(video|work)$/i,
        /^watch\s+now$/i,
      ];
      const VIDEO_HREF_PATTERNS = [
        /youtube\.com\/(embed|watch)/i,
        /youtu\.be\//i,
        /youtube-nocookie\.com\/embed/i,
        /player\.vimeo\.com\/video/i,
        /vimeo\.com\/\d+/i,
        /wistia\.(com|net)\/embed/i,
        /loom\.com\/(embed|share)/i,
        /vidyard\.com\/embed/i,
        /\.(mp4|webm|mov|m4v)(\?|$)/i,
      ];
      function isVideoHref(href) {
        if (!href) return false;
        return VIDEO_HREF_PATTERNS.some(p => p.test(href));
      }

      // Find every element whose direct text content matches a video-CTA label
      const allTextEls = Array.from(document.querySelectorAll('a, button, span, div'));
      for (const el of allTextEls) {
        const text = (el.textContent || '').trim();
        if (text.length === 0 || text.length > 40) continue; // CTAs are short
        if (!VIDEO_CTA_TEXTS.some(rx => rx.test(text))) continue;

        // Only count elements where this text is the entire visible label, not a fragment
        // (skip if this element has many child elements with their own text)
        const childTextLengths = Array.from(el.children).map(c => (c.textContent || '').trim().length);
        const childTotal = childTextLengths.reduce((a, b) => a + b, 0);
        if (childTotal > text.length * 0.5) continue; // text comes from descendants — likely a parent container

        // Find the anchor wrapping this CTA
        const anchor = el.tagName === 'A' ? el : el.closest('a');
        if (!anchor) {
          // Not in an anchor — could be a button with JS handler. Flag for review.
          report.issues.push({
            severity: 'warn',
            check: 'video-cta-no-link',
            msg: `"${text}" element is not wrapped in an <a href>. Either wire a real video URL OR remove the CTA (see VIDEO CTA RULE).`,
          });
          continue;
        }

        const href = anchor.getAttribute('href') || '';
        if (isVideoHref(href)) continue; // PASS — real video

        // Also pass if href is `#some-anchor` and that anchor target contains a video iframe/element
        if (href.startsWith('#') && href.length > 1) {
          const target = document.getElementById(href.slice(1));
          if (target && (target.querySelector('iframe[src*="youtube"], iframe[src*="vimeo"], iframe[src*="wistia"], iframe[src*="loom"], video, video source'))) {
            continue; // PASS — anchor points to a section with a real video
          }
        }

        report.issues.push({
          severity: 'fail',
          check: 'video-cta-fake',
          msg: `"${text}" CTA points to "${href}" which is NOT a video resource. Either wire a real video embed (YouTube/Vimeo/MP4) OR drop the CTA entirely (see VIDEO CTA RULE in SKILL.md).`,
        });
      }

      // Also catch the "fake play button" pattern: triangle play icon inside an <a>
      // whose href isn't a video. Common SVG: <path d="M8 5v14l11-7z"/>
      const playButtonAnchors = Array.from(document.querySelectorAll('a svg path[d*="M8 5v14"], a svg path[d*="M8,5V19"], a [class*="play_arrow"], a [class*="fa-play"]'));
      for (const playEl of playButtonAnchors) {
        const anchor = playEl.closest('a');
        if (!anchor) continue;
        const href = anchor.getAttribute('href') || '';
        if (isVideoHref(href)) continue;
        if (href.startsWith('#')) {
          const target = document.getElementById(href.slice(1));
          if (target && target.querySelector('iframe[src*="youtube"], iframe[src*="vimeo"], video')) continue;
        }
        report.issues.push({
          severity: 'fail',
          check: 'fake-play-button',
          msg: `Play-button icon inside <a href="${href}"> but href is not a video. This is the "fake play button" pattern — either wire a real video OR remove the play-button graphic and the CTA (see VIDEO CTA RULE).`,
        });
      }
      // ---- end video CTA audit ----

      // ---- Placeholder copy audit (added 2026-04-25 alongside detect-placeholders.cjs) ----
      // Catches CMS-template placeholder strings that should never appear in built pages.
      // Centralized list mirrors scripts/detect-placeholders.cjs PATTERNS.copyText —
      // QA enforcement at the rendered-DOM level (catches anything that slipped through).
      const PLACEHOLDER_COPY_PATTERNS = [
        { rx: /\blorem\s+ipsum\s+dolor\b/i,  label: 'lorem ipsum' },
        { rx: /\bsit\s+amet,?\s+consectetu/i, label: 'lorem ipsum continuation' },
        { rx: /\bbusiness\s+tagline\s+(lorem|ipsum|here|goes)\b/i, label: 'tagline placeholder' },
        { rx: /\byour\s+(business\s+)?tagline\s+(here|goes\s+here)\b/i, label: 'tagline placeholder' },
        { rx: /\bwelcome\s+to\s+your\s+new\s+(site|website|page|blog)\b/i, label: 'CMS welcome message' },
        { rx: /\bclick\s+here\s+to\s+(add|edit|change)\b/i, label: 'editable template prompt' },
        { rx: /\badd\s+your\s+(text|content|description|story)\s+here\b/i, label: 'editable template prompt' },
        { rx: /\bthis\s+is\s+a\s+(sample|placeholder|test)\b/i, label: 'sample text marker' },
        { rx: /\bcoming\s+soon\.{0,3}$/i, label: '"Coming soon" stub' },
        { rx: /\bunder\s+construction\b/i, label: '"Under construction" stub' },
        { rx: /\b123\s+main\s+(street|st\.?)\b/i, label: '"123 Main St" placeholder address' },
        { rx: /\b\(?555\)?[\s.-]?01\d{2}\b/, label: 'fiction-reserved 555-01XX phone' },
        { rx: /\b(info|contact|hello|support|admin)@example\.(com|org|net)\b/i, label: 'example.com placeholder email' },
      ];

      const visibleText = document.body.innerText || '';
      for (const p of PLACEHOLDER_COPY_PATTERNS) {
        const m = visibleText.match(p.rx);
        if (m) {
          report.issues.push({
            severity: 'fail',
            check: 'placeholder-copy',
            msg: `Placeholder copy detected on rendered page: "${m[0]}" (${p.label}). Run scripts/detect-placeholders.cjs to see all instances and remove them OR replace with real manifest content.`,
          });
        }
      }
      // ---- end placeholder copy audit ----

      // ---- Generic text-contrast audit (added 2026-04-25 after morettis active-nav black-on-black) ----
      // Real bug: SiteNav active item rendered with `bg-iron text-bone` where the theme palette
      // resolved both to dark colors → text invisible on its own background. The previous QA only
      // checked HERO contrast and LOGO/nav-bg match. Regular nav items, buttons, badges, cards,
      // table cells, etc. were never contrast-checked. This audit walks every visible text-bearing
      // element and computes WCAG contrast against its effective background. Catches any text/bg
      // collision regardless of which classes/colors caused it.
      const TEXT_TAGS = 'h1, h2, h3, h4, h5, h6, p, a, button, li, span, td, th, label, summary, blockquote, dt, dd, figcaption, strong, em, small, b, i, u';

      function rgbStringToRgb(str) {
        const m = str.match(/rgba?\((\d+)\D+(\d+)\D+(\d+)(?:\D+([\d.]+))?\)/);
        if (m) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] !== undefined ? +m[4] : 1 };
        // Tailwind v4 uses oklab() for opacity-modified colors — use the
        // canonical Ottosson conversion (defined earlier in this evaluate scope
        // as oklabToSrgb). Previously this had the same broken made-up math
        // duplicated here; fixed 2026-04-26.
        const okm = str.match(/^oklab\(([\d.]+)\s+([\d.-]+)\s+([\d.-]+)(?:\s*\/\s*([\d.]+))?\)$/);
        if (okm) {
          return oklabToSrgb(+okm[1], +okm[2], +okm[3], okm[4] !== undefined ? +okm[4] : 1);
        }
        // oklch() — increasingly common in Tailwind v4 default palettes
        // (slate-900, zinc-100, etc. are emitted as oklch).  Convert by
        // unrolling chroma+hue into the oklab a/b channels:
        //   a = C * cos(h_radians); b = C * sin(h_radians)
        // Then route through the same oklabToSrgb that the oklab branch uses.
        // Real bug shipped 2026-04-29 (tomekgroup-website): qa-check silently
        // skipped every text element because cs.color came back as oklch and
        // the parser returned null.
        const okch = str.match(/^oklch\(([\d.]+)\s+([\d.-]+)\s+([\d.-]+)(?:\s*\/\s*([\d.]+))?\)$/);
        if (okch) {
          const L = +okch[1];
          const C = +okch[2];
          const hDeg = +okch[3];
          const a_alpha = okch[4] !== undefined ? +okch[4] : 1;
          const hRad = hDeg * Math.PI / 180;
          const a = C * Math.cos(hRad);
          const b = C * Math.sin(hRad);
          return oklabToSrgb(L, a, b, a_alpha);
        }
        return null;
      }
      function relativeLuminance(rgb) {
        const c = ['r', 'g', 'b'].map(k => {
          let v = rgb[k] / 255;
          return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
      }
      function contrastRatio(a, b) {
        const l1 = relativeLuminance(a);
        const l2 = relativeLuminance(b);
        const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
        return (hi + 0.05) / (lo + 0.05);
      }
      // Walk up parents to find the first opaque background. Returns null if a
      // background-image is encountered (we can't reliably compute contrast over
      // an arbitrary photo — that's what HERO CONTRAST RULE handles separately).
      function effectiveBgRgb(el) {
        let cur = el;
        while (cur && cur !== document.documentElement) {
          const cs = getComputedStyle(cur);
          if (cs.backgroundImage && cs.backgroundImage !== 'none') return null;
          const bg = cs.backgroundColor;
          const rgb = rgbStringToRgb(bg);
          if (rgb && rgb.a >= 0.5 && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return rgb;
          cur = cur.parentElement;
        }
        return { r: 255, g: 255, b: 255, a: 1 };
      }
      function hasOwnVisibleText(el) {
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false;
        const rect = el.getBoundingClientRect();
        if (rect.width < 4 || rect.height < 4) return false;
        // Must contain at least one direct text node with visible content.
        // Skip elements that are pure containers — their children will be checked.
        let direct = '';
        for (const node of el.childNodes) {
          if (node.nodeType === 3) direct += node.nodeValue;
        }
        return direct.trim().length > 0;
      }

      // Alpha-composite a translucent foreground onto an opaque background.
      // Returns the on-screen rgb that the rendering pipeline actually paints —
      // which is what WCAG contrast must be measured against.  If we skip this
      // step, `color: rgba(150, 150, 150, 0.30)` over near-black reads as a
      // nominal grey-150 → fake "decent contrast" — when the rendered pixel is
      // really ~rgb(45, 45, 45), and the text is functionally unreadable.
      // Real bug shipped 2026-04-29 (tomekgroup-website hero body copy).
      function compositeFgOntoBg(fgRgba, bgRgb) {
        const a = Math.max(0, Math.min(1, fgRgba.a == null ? 1 : fgRgba.a));
        return {
          r: Math.round(fgRgba.r * a + bgRgb.r * (1 - a)),
          g: Math.round(fgRgba.g * a + bgRgb.g * (1 - a)),
          b: Math.round(fgRgba.b * a + bgRgb.b * (1 - a)),
        };
      }

      // Walk the ancestor chain and multiply opacity values.  CSS `opacity` on
      // any ancestor cascades to descendants in the rendering pipeline (it
      // creates a stacking context and applies to the whole subtree).  Combining
      // ancestor opacities with the element's own foreground alpha is what
      // determines the actually-rendered color.  Real bug class: a parent
      // wrapper with `opacity: 0.4` that fades the whole subtree without
      // changing any individual element's `cs.color`.
      function effectiveOpacityChain(el) {
        let opacity = 1;
        let cur = el;
        while (cur && cur !== document.documentElement) {
          const o = parseFloat(getComputedStyle(cur).opacity);
          if (!Number.isNaN(o)) opacity *= o;
          cur = cur.parentElement;
        }
        return opacity;
      }

      const contrastSeen = new Set();
      const textEls = Array.from(document.querySelectorAll(TEXT_TAGS));
      for (const el of textEls) {
        if (!hasOwnVisibleText(el)) continue;
        // Skip nodes inside nav/header/footer photos with overlay (HERO CONTRAST handles those).
        // Actually keep them — false-positives here are rare and an overlay is a real solid bg.
        const cs = getComputedStyle(el);
        const fgRaw = rgbStringToRgb(cs.color);
        if (!fgRaw) continue;
        const bg = effectiveBgRgb(el);
        if (!bg) continue; // hit a background-image — HERO CONTRAST handles it

        // Compute the actually-rendered foreground color by combining the
        // color-channel alpha with the cascaded opacity of every ancestor,
        // then alpha-blending the result onto the effective background.
        // This is what the user sees on screen — and what WCAG must measure.
        const elOpacity = effectiveOpacityChain(el);
        const totalAlpha = (fgRaw.a == null ? 1 : fgRaw.a) * elOpacity;
        const fg = compositeFgOntoBg({ r: fgRaw.r, g: fgRaw.g, b: fgRaw.b, a: totalAlpha }, bg);

        const ratio = contrastRatio(fg, bg);
        const fontSizePx = parseFloat(cs.fontSize) || 16;
        const fontWeight = parseInt(cs.fontWeight, 10) || 400;
        // WCAG large text = >= 24px OR >= 18.66px bold
        const isLarge = fontSizePx >= 24 || (fontSizePx >= 18.66 && fontWeight >= 700);
        const minRatio = isLarge ? 3 : 4.5;
        if (ratio < minRatio) {
          const text = (el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60);
          if (!text) continue;
          // Dedupe: same text + same fg/bg combo only reported once per page
          const key = `${text}::${cs.color}::rgb(${bg.r},${bg.g},${bg.b})::${totalAlpha.toFixed(2)}`;
          if (contrastSeen.has(key)) continue;
          contrastSeen.add(key);
          // Build a diagnostic that shows the cascade.  When alpha was the
          // culprit, the message must surface that — otherwise the worker sees
          // "color: white; bg: black" and is confused why it's flagged.
          const alphaNote = totalAlpha < 0.99
            ? ` Effective alpha on this text is ${totalAlpha.toFixed(2)} (color-alpha ${(fgRaw.a == null ? 1 : fgRaw.a).toFixed(2)} × ancestor-opacity ${(elOpacity / (fgRaw.a == null ? 1 : 1)).toFixed(2)}); after compositing onto the background, the rendered pixel is rgb(${fg.r},${fg.g},${fg.b}). Faded text over a similar-colored background is the bug class — increase the alpha, drop the parent opacity, or pick a foreground color far enough from the background that the composited pixel still hits the WCAG threshold.`
            : ` This is the active-nav-black-on-black bug class — pick a foreground color that actually contrasts with the rendered background, OR fix the underlying theme variable so the named utility resolves correctly.`;
          report.issues.push({
            severity: 'fail',
            check: 'text-contrast',
            msg: `Text "${text}" (<${el.tagName.toLowerCase()}>, ${Math.round(fontSizePx)}px) renders with WCAG contrast ${ratio.toFixed(2)}:1 — below the ${minRatio}:1 minimum for ${isLarge ? 'large' : 'body'} text. Foreground ${cs.color} on effective background rgb(${bg.r},${bg.g},${bg.b}).${alphaNote}`,
          });
        }
      }
      // ---- end generic text-contrast audit ----

      // ---- Numbered section labels audit (added 2026-04-29) ----
      // Bracket-numbered or slash-prefixed numeric eyebrows (`01 — WHAT WE DO`,
      // `[ 02 ] · CATEGORY`, `01 / SERVICES`, `§ 01 · DIY RISK`, `SVC · 01`)
      // are FORBIDDEN on Option A and B non-blog pages — they're an editorial
      // / magazine affectation that doesn't belong on a small-business
      // contractor's website. Apply to the same eyebrow utility classes that
      // designers reach for: .eyebrow, .mono-caption, .label-mono.
      // See SKILL.md NUMBERED SECTION LABELS RULE.
      const numberedLabelPatterns = [
        // Leading bracket-numbered with editorial separator: "[ 01 ] ·", "01 — ", "01 / ", "§ 01 · "
        /^\s*(?:§\s*)?(?:\[\s*)?\d{1,2}(?:\s*\])?\s*[\/—·│\|]\s+\S/,
        // Slash-eyebrow with leading number: "01 / SERVICES" (digits + space + slash)
        /^\s*\d{1,2}\s+\/\s+\S/,
        // SVC-style decorative numbering: "SVC · 01", "FILE · 02", "SHEET 01 / 06"
        /\b(?:SVC|FILE|JOB|SHEET|REVIEW|CARD|FIELD|POST|SECTION)\s*[·\.\#]\s*\d{1,2}\b/i,
        // Standalone digit eyebrow ("01" with no other words)
        /^\s*\d{1,2}\s*$/,
      ];
      const eyebrowSelectors = '.eyebrow, .mono-caption, .label-mono, .label-mono-lg, .bracket-label';
      const seenNumberedLabels = new Set();
      for (const el of document.querySelectorAll(eyebrowSelectors)) {
        const text = (el.innerText || el.textContent || '').trim();
        if (!text || text.length > 80) continue;
        // Skip if any ancestor link points to a blog page (the eyebrow IS in
        // an article context — allowed under the rule).
        const inBlogContext = window.location.pathname.includes('/blog');
        if (inBlogContext) continue;
        // Match against patterns
        let matched = null;
        for (const pat of numberedLabelPatterns) {
          if (pat.test(text)) { matched = pat; break; }
        }
        if (!matched) continue;
        const key = `numlabel::${text}`;
        if (seenNumberedLabels.has(key)) continue;
        seenNumberedLabels.add(key);
        report.issues.push({
          severity: 'fail',
          check: 'numbered-section-labels',
          msg: `Numbered section eyebrow "${text}" on ${window.location.pathname} (${el.tagName.toLowerCase()}.${(el.className||'').split(/\s+/)[0]}). Numbered section labels (01 — / [ 02 ] / 01 /) are FORBIDDEN on non-blog pages — they're an editorial affectation that doesn't belong on a small-business contractor's website. Drop the number; keep the category label only. See NUMBERED SECTION LABELS RULE in SKILL.md.`,
        });
      }
      // ---- end numbered section labels audit ----

      // ---- Bilingual support: per-page checks (added 2026-04-30) ----
      // Activated by Node-side scope filter when --option=b or --option=c.  Always
      // emits these candidate issues; the scope filter strips them on options
      // where bilingual doesn't apply (A, or no --option flag).
      //
      // Three per-page checks fire here:
      //   1. html-lang-attribute — <html lang="es"> on /es/* pages, "en" otherwise.
      //   2. language-switcher-presence — nav must have a working EN/ES toggle
      //      with the right href (parallel-language path) and aria-label.
      //   3. testimonial-tag-on-es — every translated testimonial has the
      //      `(traducido del inglés)` tag near its <cite>.
      //
      // (The 4th rule, bilingual-page-parity, is site-wide — runs Node-side after
      // all pages walked.)
      const isEsPage = window.location.pathname.startsWith('/es/') || window.location.pathname === '/es';
      const htmlLang = (document.documentElement.getAttribute('lang') || '').toLowerCase();
      const expectedLang = isEsPage ? 'es' : 'en';
      if (htmlLang !== expectedLang) {
        report.issues.push({
          severity: 'fail',
          check: 'html-lang-attribute',
          msg: `<html lang="${htmlLang || '(unset)'}"> on ${window.location.pathname} — expected lang="${expectedLang}". Per BILINGUAL SUPPORT rule, /es/* pages must have <html lang="es"> and English pages must have <html lang="en">. Pass the lang prop to BaseLayout from each /es/*.astro page.`,
        });
      }

      // language-switcher-presence: look for a nav anchor that links to the
      // parallel-language URL.  On an EN page, expect a link to /es/<currentPath>.
      // On an ES page, expect a link to <currentPath>.replace(/^\/es/, '').
      const currentPath = window.location.pathname;
      const expectedSwitcherHref = isEsPage
        ? (currentPath.replace(/^\/es\//, '/').replace(/^\/es$/, '/'))
        : ('/es' + (currentPath === '/' ? '/' : currentPath));
      const navAnchors = document.querySelectorAll('nav a, header a');
      let switcherFound = false;
      let switcherHasAria = false;
      for (const a of navAnchors) {
        const href = a.getAttribute('href') || '';
        // Normalize trailing slashes for the comparison
        const norm = (p) => p.replace(/\/+$/, '') || '/';
        if (norm(href) === norm(expectedSwitcherHref)) {
          switcherFound = true;
          const aria = a.getAttribute('aria-label') || '';
          if (isEsPage) {
            if (/switch.*english|english/i.test(aria)) switcherHasAria = true;
          } else {
            if (/cambiar|espa[ñn]ol|spanish/i.test(aria)) switcherHasAria = true;
          }
          break;
        }
      }
      if (!switcherFound) {
        report.issues.push({
          severity: 'fail',
          check: 'language-switcher-presence',
          msg: `No language switcher found in nav on ${currentPath}. Per BILINGUAL SUPPORT rule, every page in Options B and C must have a visible nav anchor linking to the parallel-language URL. Expected an anchor with href="${expectedSwitcherHref}" in <nav> or <header>. Add an EN/ES toggle to the Nav component.`,
        });
      } else if (!switcherHasAria) {
        report.issues.push({
          severity: 'warn',
          check: 'language-switcher-presence',
          msg: `Language switcher found on ${currentPath} but missing the expected aria-label. On ${isEsPage ? 'ES' : 'EN'} pages, expected aria-label like "${isEsPage ? 'Switch to English' : 'Cambiar a Español'}". Improves accessibility without blocking deploy.`,
        });
      }

      // testimonial-tag-on-es: on /es/* pages, every <cite> following a
      // <blockquote> should have "(traducido del inglés)" near it (in <small>,
      // adjacent text, or anywhere in cite descendants/siblings within the
      // figure/article wrapper).
      if (isEsPage) {
        const blockquotes = document.querySelectorAll('blockquote');
        for (const bq of blockquotes) {
          // Look for the attribution element and the translation tag within
          // the surrounding figure/article (common testimonial wrapper) or
          // the immediate next-sibling chain.
          const wrapper = bq.closest('figure, article, .testimonial, [class*="testimonial"]') || bq.parentElement;
          const wrapperText = (wrapper?.innerText || '').toLowerCase();
          if (!wrapperText.includes('traducido del ingl')) {
            // Trim quote for the diagnostic
            const qText = (bq.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 60);
            report.issues.push({
              severity: 'fail',
              check: 'testimonial-translation-tag',
              msg: `Translated testimonial "${qText}…" on ${currentPath} is missing the "(traducido del inglés)" tag. Per BILINGUAL SUPPORT rule, every translated testimonial in /es/ pages must include this tag near the attribution so the reader knows the original was English. Add a <small>(traducido del inglés)</small> next to the <cite>.`,
            });
          }
        }
      }
      // ---- end bilingual per-page checks ----

      // ---- Image diversity audit (added 2026-04-25 after naples-pressure-washing-a) ----
      // Catches the "same image used N times in a service card grid" bug.
      // Scope: content-area images only (skip nav, header, footer, and tiny icons).
      // Rule: if the same /images/ src appears 2+ times in the page body content,
      //       fail with a clear message naming the duplicated file.
      const contentImgs = Array.from(document.querySelectorAll('img[src]'))
        .filter(img => {
          // Must be a customer image (served from /images/)
          if (!/\/images\//.test(img.src)) return false;
          // Skip nav/header/footer (logo + footer images can legitimately repeat across pages)
          if (img.closest('nav, header, footer')) return false;
          // Skip tiny images (icons, social glyphs)
          const rect = img.getBoundingClientRect();
          if (rect.width < 80 || rect.height < 80) return false;
          return true;
        });

      const srcCounts = {};
      for (const img of contentImgs) {
        // Normalize: strip query string, use just pathname
        let key = img.src;
        try { key = new URL(img.src, window.location.origin).pathname; } catch {}
        srcCounts[key] = (srcCounts[key] || 0) + 1;
      }

      for (const [src, count] of Object.entries(srcCounts)) {
        if (count > 1) {
          report.issues.push({
            severity: 'fail',
            check: 'duplicate-content-image',
            msg: `Same image "${src}" used ${count}× in content. Service cards / feature tiles / content sections must each have a DISTINCT image. Find different images from the manifest, OR omit the image and use a text-only card. Never duplicate an image across adjacent cards (see IMAGE DIVERSITY + SEMANTIC MATCHING rule in SKILL.md).`,
          });
        }
      }
      // ---- end image diversity audit ----

      // ---- Image resolution audit (added 2026-04-25, generalizes the logo res check) ----
      // Catches stretched/pixelated images on hero, service cards, gallery, etc.
      // Mirrors the logo natural-vs-displayed-px ratio (want ≥ 1.5x for retina).
      // Runs at BOTH viewports — mobile shows different displayed sizes than desktop,
      // so a hero that's "fine" at 800px on desktop might be "stretched" at 390px mobile
      // if the source is small AND CSS scales it up via min-width: 100vw.
      const RES_RATIO_FAIL = 1.0;  // displayed wider than natural = will look pixelated
      const RES_RATIO_WARN = 1.5;  // less than 1.5x = soft on retina but acceptable
      const allImgs = Array.from(document.querySelectorAll('img[src]'));
      for (const img of allImgs) {
        const rect = img.getBoundingClientRect();
        const displayedW = Math.round(rect.width);
        if (displayedW < 200) continue;                      // skip icons, glyphs, badges
        if (img.closest('nav, header')) continue;            // logos handled by logo check
        const naturalW = img.naturalWidth;
        if (naturalW === 0) continue;                        // already caught by broken-image
        const ratio = naturalW / displayedW;
        if (ratio < RES_RATIO_FAIL) {
          report.issues.push({
            severity: 'fail',
            check: 'image-low-resolution',
            msg: `Image "${img.src}" displays at ${displayedW}px wide but natural is only ${naturalW}px (ratio ${ratio.toFixed(2)}x — image is being STRETCHED, will look pixelated). Replace with a higher-resolution source from the manifest, OR add a srcset, OR shrink the displayed size to match the source.`,
          });
        } else if (ratio < RES_RATIO_WARN) {
          report.issues.push({
            severity: 'warn',
            check: 'image-low-resolution',
            msg: `Image "${img.src}" displays at ${displayedW}px wide, natural ${naturalW}px (ratio ${ratio.toFixed(2)}x, want ≥ 1.5x for retina). Will look soft on high-DPI screens. Consider a higher-resolution source if available.`,
          });
        }
      }
      // ---- end image resolution audit ----

      // ---- Icon contrast audit (added 2026-04-28 after thetreeguy.com) ----
      // Real bug: Worker shipped service-card icons that were nearly the same
      // color as the card background — icons visually disappeared into the card.
      // (User feedback 2026-04-28: "icons are light with light design, so, hard
      //  to see... I do not mind inventing icon assets where appropriate, but
      //  they need to be top quality assets!")
      //
      // The check: for each small <img> outside nav/header/footer, sample the
      // icon's dominant non-transparent color via canvas, find the effective
      // container background, and require WCAG 1.4.11 contrast ≥ 3:1 (the
      // minimum for graphics conveying information). Inline-SVG icons whose
      // color comes from CSS get caught by the generic text-contrast audit
      // already (currentColor flows through). Material Symbols / icon-font
      // glyphs render as text and are likewise covered by text-contrast.
      //
      // Skipped:
      // - Logo images (already covered by logo + logo-bg-mismatch checks)
      // - Sub-16px pixels (decorative spacers, tracking pixels — not real icons)
      // - Cross-origin tainted canvases (silently — we can't read the pixels)
      // - <img> over a background-image (HERO CONTRAST handles photo backdrops)
      const ICON_MIN_PX = 16;
      const ICON_MAX_PX = 80;
      const ICON_CONTRAST_MIN = 3.0;   // WCAG 1.4.11 minimum for non-text content
      const iconCandidates = Array.from(document.querySelectorAll('img[src]')).filter(img => {
        if (img.closest('nav, header, footer')) return false;
        const r = img.getBoundingClientRect();
        return r.width >= ICON_MIN_PX && r.width <= ICON_MAX_PX
            && r.height >= ICON_MIN_PX && r.height <= ICON_MAX_PX;
      });
      const iconSeen = new Set();
      for (const img of iconCandidates) {
        if (img.naturalWidth === 0) continue; // already caught by broken-image
        // Sample the icon's dominant opaque color via canvas
        let dominantRgb = null;
        try {
          const cv = document.createElement('canvas');
          const W = Math.min(img.naturalWidth, 64);
          const H = Math.min(img.naturalHeight, 64);
          cv.width = W; cv.height = H;
          const cx = cv.getContext('2d');
          cx.drawImage(img, 0, 0, W, H);
          const data = cx.getImageData(0, 0, W, H).data;
          let rSum = 0, gSum = 0, bSum = 0, count = 0;
          for (let i = 0; i < data.length; i += 4) {
            const a = data[i + 3];
            if (a < 200) continue;            // skip transparent + semi-transparent
            const R = data[i], G = data[i + 1], B = data[i + 2];
            // Skip near-white pixels (icon backplate + anti-aliased edges) so we
            // measure the icon's actual graphic color, not its negative space
            if (R > 245 && G > 245 && B > 245) continue;
            rSum += R; gSum += G; bSum += B; count++;
          }
          if (count >= 8) {
            dominantRgb = {
              r: Math.round(rSum / count),
              g: Math.round(gSum / count),
              b: Math.round(bSum / count),
              a: 1,
            };
          }
        } catch (_) {
          // Cross-origin / tainted canvas — silently skip
          continue;
        }
        if (!dominantRgb) continue;
        const bg = effectiveBgRgb(img);
        if (!bg) continue;  // background-image — covered by HERO CONTRAST
        const ratio = contrastRatio(dominantRgb, bg);
        if (ratio < ICON_CONTRAST_MIN) {
          const rect = img.getBoundingClientRect();
          const dispW = Math.round(rect.width);
          const dispH = Math.round(rect.height);
          const iconHex = '#' + [dominantRgb.r, dominantRgb.g, dominantRgb.b]
            .map(n => n.toString(16).padStart(2, '0')).join('');
          const bgHex = '#' + [bg.r, bg.g, bg.b]
            .map(n => n.toString(16).padStart(2, '0')).join('');
          const key = `${img.src}::${iconHex}::${bgHex}`;
          if (iconSeen.has(key)) continue;
          iconSeen.add(key);
          report.issues.push({
            severity: 'fail',
            check: 'icon-contrast',
            msg: `Icon "${img.src}" (${dispW}×${dispH}px) has dominant color ${iconHex} on container background ${bgHex} — WCAG contrast ${ratio.toFixed(2)}:1 is below the 3:1 minimum for graphics that convey information (WCAG 1.4.11). The icon is visually disappearing into its container. Fix by (a) using a darker / higher-contrast icon variant, (b) recoloring the icon, (c) changing the card background to contrast with the icon, OR (d) adding a contrasting badge shape (filled circle, rounded square) behind the icon. Inventing icon assets is OK if quality is high — but they MUST have ≥ 3:1 contrast against their container. See ICON QUALITY rule in SKILL.md.`,
          });
        }
      }
      // ---- end icon contrast audit ----

      // ---- Mobile-specific overflow audit (added 2026-04-25 with dual-viewport refactor) ----
      // Catches text or block-level content that spills past the viewport edge horizontally
      // — the most common mobile-only bug. Only meaningful when viewport is narrow.
      if (window.innerWidth < 600) {
        const docW = document.documentElement.scrollWidth;
        const viewportW = window.innerWidth;
        if (docW > viewportW + 8) {  // 8px tolerance for scrollbar artifacts
          // Find the offending element(s) — anything whose right edge sits past viewport
          const offenders = Array.from(document.querySelectorAll('body *')).filter(el => {
            const r = el.getBoundingClientRect();
            return r.right > viewportW + 4 && r.width > 50;  // skip tiny artifacts
          }).slice(0, 3);  // top 3 only — usually they're nested
          for (const el of offenders) {
            const text = (el.innerText || '').trim().slice(0, 40);
            report.issues.push({
              severity: 'fail',
              check: 'mobile-overflow',
              msg: `Mobile horizontal overflow: <${el.tagName.toLowerCase()}${el.className ? ' class="' + (el.className || '').toString().slice(0, 60) + '"' : ''}>${text ? ' containing "' + text + '"' : ''} extends past viewport (page scrollWidth ${docW}px > viewport ${viewportW}px). Mobile users will see horizontal scrolling. Common causes: fixed-width sections, oversized images without max-width:100%, long unbroken strings, table layouts.`,
            });
          }
        }
      }
      // ---- end mobile-overflow audit ----

      // ---- Tap target size audit (mobile only) ----
      // WCAG 2.5.5: interactive elements should be ≥ 44×44 CSS px on touch devices.
      // Only runs at narrow viewport (the touch context).
      if (window.innerWidth < 600) {
        const tapTargets = Array.from(document.querySelectorAll('a[href], button, input[type="submit"], input[type="button"], [role="button"]'));
        const tapSeen = new Set();
        for (const t of tapTargets) {
          const rect = t.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) continue;  // hidden
          if (rect.width < 44 || rect.height < 44) {
            const text = (t.innerText || t.getAttribute('aria-label') || '').trim().slice(0, 30);
            if (!text) continue;  // skip iconography we can't describe
            const key = `${text}::${Math.round(rect.width)}x${Math.round(rect.height)}`;
            if (tapSeen.has(key)) continue;
            tapSeen.add(key);
            report.issues.push({
              severity: 'warn',
              check: 'mobile-tap-target',
              msg: `Touch target "${text}" is ${Math.round(rect.width)}×${Math.round(rect.height)}px — smaller than the WCAG-recommended 44×44px minimum. Mobile users will mis-tap. Increase padding or min-height/min-width.`,
            });
          }
        }
      }
      // ---- end tap target size audit ----

      // ---- Design Quality Bar: system-fonts-only detector (added 2026-04-25) ----
      // Operationalizes "no site whose only fonts are system Inter/Arial/Helvetica"
      // (see DESIGN QUALITY BAR rule in SKILL.md). The check looks for ANY of:
      // - <link rel="stylesheet" href="...fonts.googleapis.com..."> in <head>
      // - <link rel="stylesheet" href="...fonts.bunny.net..."> (privacy-friendly Google Fonts mirror)
      // - @import url(https://fonts.googleapis.com/...) inside any <style>
      // - @fontsource/*  imports (typically bundled by Astro/Vite — visible as @font-face rules
      //   pointing at /node_modules/ paths in DOM)
      // - Any @font-face rule pointing at a custom .woff/.woff2/.ttf/.otf source
      // Only runs at desktop viewport (one check per page, not per viewport).
      if (window.innerWidth >= 1000) {
        const links = Array.from(document.querySelectorAll('link[rel="stylesheet"], link[rel="preload"][as="font"], link[rel="preconnect"]'));
        const usesGoogleFonts = links.some(l => /fonts\.(googleapis|gstatic|bunny\.net)/i.test(l.href || ''));
        // Look for @font-face rules in any stylesheet we can read (CORS-safe ones)
        let hasCustomFontFace = false;
        for (const sheet of document.styleSheets) {
          try {
            for (const rule of sheet.cssRules || []) {
              if (rule.type === CSSRule.FONT_FACE_RULE) { hasCustomFontFace = true; break; }
            }
          } catch (_) { /* CORS-blocked stylesheet — skip */ }
          if (hasCustomFontFace) break;
        }
        if (!usesGoogleFonts && !hasCustomFontFace) {
          report.issues.push({
            severity: 'warn',
            check: 'design-quality-fonts',
            msg: `No web fonts detected on this page (no Google/Bunny Fonts link, no @font-face rules). Site is likely relying on system Inter/Arial/Helvetica only — fails the DESIGN QUALITY BAR rule. Pick a display-quality font from any reputable foundry (Fraunces, Editorial New, DM Serif Display, Cormorant, Cabinet Grotesk, etc. via Google Fonts or @fontsource) for headlines. See DESIGN QUALITY BAR in SKILL.md.`,
          });
        }
      }
      // ---- end design quality fonts audit ----

      // ---- Extract live testimonials for TESTIMONIAL & REVIEW PRESERVATION check ----
      // Surfaces every <blockquote>/<q> innerText for Node-side comparison against
      // the reference-dist corpus (Option A's built HTML). See SKILL.md TESTIMONIAL
      // & REVIEW PRESERVATION rule.
      const liveTestimonials = Array.from(document.querySelectorAll('blockquote, q')).map(el => {
        return (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
      }).filter(t => t.length >= 8);
      report.liveTestimonials = liveTestimonials;
      // ---- end testimonial extraction ----

      // ---- Collect rendered image basenames for IMAGE REUSE RULE check ----
      // Walks the rendered DOM for every image reference: <img src>, inline
      // style="background-image: url(...)", computed CSS background-image on
      // every element, and any inline <style> blocks' url(...) entries.
      // Returned as an array of basenames (deduped Node-side after aggregation).
      // The 90% gate runs ONCE site-wide after all pages are walked, in Node.
      (function collectRenderedImages() {
        const basenames = new Set();
        const fromUrl = (raw) => {
          if (!raw) return null;
          try {
            const cleaned = raw.split('?')[0].split('#')[0];
            const segs = cleaned.split('/').filter(Boolean);
            if (!segs.length) return null;
            return segs[segs.length - 1];
          } catch { return null; }
        };
        // <img src>
        for (const el of document.querySelectorAll('img[src]')) {
          const b = fromUrl(el.getAttribute('src') || '');
          if (b) basenames.add(b);
        }
        // <picture><source srcset>
        for (const el of document.querySelectorAll('source[srcset]')) {
          const set = (el.getAttribute('srcset') || '').split(',').map(s => s.trim().split(/\s+/)[0]);
          for (const u of set) {
            const b = fromUrl(u);
            if (b) basenames.add(b);
          }
        }
        // Computed background-image on every visible-ish element.
        // (Iterating every element is fast — ~few hundred max on a typical page.)
        for (const el of document.querySelectorAll('*')) {
          const cs = getComputedStyle(el);
          const bgi = cs.backgroundImage;
          if (!bgi || bgi === 'none') continue;
          const matches = bgi.match(/url\(["']?([^"'\)]+)["']?\)/g);
          if (!matches) continue;
          for (const m of matches) {
            const u = m.replace(/^url\(["']?/, '').replace(/["']?\)$/, '');
            const b = fromUrl(u);
            if (b) basenames.add(b);
          }
        }
        report.renderedImageBasenames = [...basenames];
      })();
      // ---- end rendered-image collection ----

      // Surface visibleText so Node-side checks (FACT GROUNDING) can run against it
      report.visibleText = visibleText;

      return report;
    });

    // ---- Fact-grounding (Node-side, needs manifest corpus) ----
    if (manifestCorpus && out.visibleText) {
      const factIssues = runFactGroundingCheck(out.visibleText);
      out.issues.push(...factIssues);
    }
    delete out.visibleText; // don't bloat the report

    // ---- Testimonial-tampering (Node-side, needs reference dist) ----
    // Pass the page path so the EN/ES split (BILINGUAL SUPPORT) selects the
    // right reference set: /es/* pages compare against B's /es/, others
    // against A's English.
    if ((referenceTestimonialSet.size > 0 || referenceTestimonialSetEs.size > 0) && Array.isArray(out.liveTestimonials)) {
      // Only run at desktop viewport — testimonials should be identical at both,
      // running once is enough (and avoids duplicate report entries).
      if (viewport.name === 'desktop') {
        const tIssues = runTestimonialTamperingCheck(out.liveTestimonials, viewport.name, p);
        out.issues.push(...tIssues);
      }
    }
    delete out.liveTestimonials;

    results.push({ viewport: viewport.name, path: p, ...out });
  }

  await page.close();
  } // end viewport loop

  await browser.close();

  // ---- IMAGE REUSE RULE site-wide check (Option A only) ----
  // Aggregates the per-page renderedImageBasenames from every desktop visit
  // (mobile would double-count without adding new basenames) and computes the
  // reuse ratio against the must-reuse pool from the manifest. Fails the
  // build at < 90%. See SKILL.md `IMAGE REUSE RULE` for the full rationale.
  //
  // De-dup gotcha: manifestImageInventory has one entry per BASENAME, but
  // multiple basenames can share a canonical record (because the scraper
  // saves the same src URL under different filenames per page). We must
  // dedupe to canonical records before computing the ratio — otherwise the
  // BBB seal saved 12× counts as 12 different images, distorting the
  // denominator. We collect canonical records into a Set by identity.
  let imageReuseSiteIssue = null;
  if (optionName === 'a' && manifestImageInventory.size > 0) {
    const renderedBasenames = new Set();
    for (const r of results) {
      if (r.viewport !== 'desktop') continue;       // dedupe — desktop sees the same images mobile does
      if (Array.isArray(r.renderedImageBasenames)) {
        for (const b of r.renderedImageBasenames) renderedBasenames.add(b);
      }
    }
    // Dedupe inventory by canonical record identity (multiple basenames can
    // point at the same record via the aliases mechanism).
    const canonicalRecords = new Set(manifestImageInventory.values());
    const mustReuse = [...canonicalRecords].filter(isMustReusePhoto);
    // A canonical record counts as RENDERED if ANY of its alias basenames
    // appears in the rendered set — the build can use any of the duplicates.
    const renderedMustReuse = mustReuse.filter(r => {
      for (const alias of (r.aliases || [r.basename])) {
        if (renderedBasenames.has(alias)) return true;
      }
      return false;
    });
    const ratio = mustReuse.length === 0 ? 1 : renderedMustReuse.length / mustReuse.length;
    const unused = mustReuse.filter(r => {
      for (const alias of (r.aliases || [r.basename])) {
        if (renderedBasenames.has(alias)) return false;
      }
      return true;
    });
    const ratioPct = (ratio * 100).toFixed(1);

    if (ratio < 0.90) {
      const sample = unused.slice(0, 5).map(r => `${r.basename} (${r.width || '?'}×${r.height || '?'}${r.alt ? ` "${r.alt.slice(0,40)}"` : ''})`).join(', ');
      imageReuseSiteIssue = {
        severity: 'fail',
        check: 'image-reuse-A',
        msg: `Option A renders only ${renderedMustReuse.length} of ${mustReuse.length} must-reuse manifest photos (${ratioPct}%, target ≥ 90%). The customer's site is a small-business contractor's website with photos of the work — it's drifted to magazine / NYT layout. Add a portfolio / gallery / "Recent Work" section, give every service card a photo, add an about-the-crew section. Editorial / typographic / file-tab / bracket-numbered design language belongs to Option C, not A. First ${unused.slice(0,5).length} unused photos: ${sample}. (See IMAGE REUSE RULE in SKILL.md.)`,
      };
    } else {
      imageReuseSiteIssue = {
        severity: 'pass',
        check: 'image-reuse-A',
        msg: `Option A renders ${renderedMustReuse.length}/${mustReuse.length} must-reuse photos (${ratioPct}% ≥ 90%).`,
      };
    }
  } else if (optionName === 'a' && manifestPath && manifestImageInventory.size === 0) {
    console.warn('⚠ --option a passed but manifest had no image records — image-reuse-A check skipped.');
  } else if (!optionName && manifestImageInventory.size > 0) {
    // Quiet — back-compat for invocations that don't pass --option (e.g. checking C, B, or smoke tests)
  }
  // ---- end IMAGE REUSE RULE check ----

  // ---- NUMBERED SECTION LABELS rule scope filter ----
  // The numbered-section-labels check fires inside page.evaluate on every
  // page. For Option C (which may legitimately use bracket numerals when
  // industry-tokens.json calls for them — workwear-document for trades),
  // strip those issues from results before final reporting. Apply only to
  // A and B (where numbered labels are forbidden on non-blog pages).
  if (optionName === 'c') {
    for (const r of results) {
      if (r.issues) {
        r.issues = r.issues.filter(i => i.check !== 'numbered-section-labels');
      }
    }
  } else if (!optionName) {
    // No --option flag — back-compat: also strip the check (don't fail
    // legacy invocations that don't know about the rule)
    for (const r of results) {
      if (r.issues) {
        r.issues = r.issues.filter(i => i.check !== 'numbered-section-labels');
      }
    }
  }
  // ---- end numbered-section-labels scope filter ----

  // ---- BILINGUAL SUPPORT scope filter + site-wide page-parity check ----
  // The bilingual checks (html-lang-attribute, language-switcher-presence,
  // testimonial-translation-tag) fire inside page.evaluate on every page.
  // For Option A (English-only by design) and for invocations without
  // --option, strip those issues — A is monolingual.  For B and C, keep them.
  const isBilingualOption = optionName === 'b' || optionName === 'c';
  if (!isBilingualOption) {
    for (const r of results) {
      if (r.issues) {
        r.issues = r.issues.filter(i =>
          i.check !== 'html-lang-attribute' &&
          i.check !== 'language-switcher-presence' &&
          i.check !== 'testimonial-translation-tag'
        );
      }
    }
  }

  // bilingual-page-parity (site-wide): every English page in the URL list
  // must have a matching /es/<path> page in the URL list, and vice versa.
  // Walks the unique paths actually visited (`paths` from argv) and groups
  // them by EN-or-ES bucket.
  let bilingualParityIssue = null;
  if (isBilingualOption) {
    const enPaths = new Set();
    const esPaths = new Set();
    for (const p of paths) {
      const norm = p.replace(/\/+$/, '') || '/';
      if (norm.startsWith('/es/') || norm === '/es') {
        esPaths.add(norm.replace(/^\/es/, '') || '/');
      } else {
        enPaths.add(norm);
      }
    }
    const enWithoutEs = [...enPaths].filter(p => !esPaths.has(p));
    const esWithoutEn = [...esPaths].filter(p => !enPaths.has(p));
    if (enWithoutEs.length > 0 || esWithoutEn.length > 0) {
      const samples = [];
      if (enWithoutEs.length) samples.push(`English without Spanish: ${enWithoutEs.slice(0,5).join(', ')}`);
      if (esWithoutEn.length) samples.push(`Spanish without English: ${esWithoutEn.slice(0,5).join(', ')}`);
      bilingualParityIssue = {
        severity: 'fail',
        check: 'bilingual-page-parity',
        msg: `Option ${optionName.toUpperCase()} has bilingual page-parity gaps: ${samples.join(' | ')}. Per BILINGUAL SUPPORT rule, every English page must have a parallel /es/ page (and vice versa). Stage 5h completeness check should have caught this — fix in option-${optionName}/src/pages/es/ and rebuild.`,
      };
    } else {
      bilingualParityIssue = {
        severity: 'pass',
        check: 'bilingual-page-parity',
        msg: `Option ${optionName.toUpperCase()} bilingual page-parity OK (${enPaths.size} EN ↔ ${esPaths.size} ES pages).`,
      };
    }
  }
  // ---- end BILINGUAL SUPPORT scope filter + parity ----

  // ---- Static source lints (run once site-wide, not per-page) ----
  // These checks read SOURCE FILES (not rendered HTML) so they run independently
  // of Playwright. They look for code-level patterns the runtime QA can't see.
  const staticIssues = [];
  // Try to derive the source dir from the dist URL convention. If we have
  // --reference-dist, the option-a/dist sibling has a src/. We can also infer
  // from CWD. For robustness, scan a few likely paths.
  const candidateRoots = [];
  if (referenceDistPath) {
    // referenceDistPath = jobs/{domain}/option-a/dist  → sibling src/ + components/Footer.astro
    const optionDir = referenceDistPath.replace(/\/dist\/?$/, '');
    candidateRoots.push(optionDir);
  }
  // Heuristic: probe based on baseUrl port mapping if we know the job dir
  // (no good signal here without --source-dir flag — defer to caller).
  // For now, only run if referenceDistPath is provided.
  for (const root of candidateRoots) {
    const cssPath = `${root}/src/styles/global.css`;
    const footerPath = `${root}/src/components/Footer.astro`;
    // ---- TAILWIND V4 CASCADE TRAP ----
    // Bare element selectors (h1/h2/h3/p/a/etc.) at module top-level in
    // global.css that set color/background/font-family — must be in @layer
    // base { } so utility classes can override them. See SKILL.md.
    if (existsSync(cssPath)) {
      try {
        const css = readFileSync(cssPath, 'utf8');
        // Strip @layer { ... } blocks and @media { ... } blocks (rough — does not handle nested
        // braces, but good enough for the common case where @layer base wraps all base styles)
        const stripped = css.replace(/@layer\s+\w+\s*\{[\s\S]*?\n\}/g, '').replace(/@media[^\{]+\{[\s\S]*?\n\}/g, '');
        // Look for bare-element selectors with color/bg/font properties
        const bareRule = /(?:^|\n)\s*((?:[a-z][a-z0-9]*\s*,\s*)*[a-z][a-z0-9]*)\s*\{[^}]*?(?:color|background(?:-color)?|font-family)\s*:/g;
        let m;
        while ((m = bareRule.exec(stripped)) !== null) {
          const selector = m[1].trim();
          // Skip pseudo-classes / descendants / common safe selectors
          if (/[\.\#:>\+~\[\*]/.test(selector)) continue;
          if (selector.toLowerCase() === 'html' || selector.toLowerCase() === 'body') continue;
          staticIssues.push({
            severity: 'fail',
            check: 'tailwind-cascade-trap',
            msg: `Bare element selector '${selector}' in global.css sets color/font outside @layer base. Tailwind v4 unlayered base styles silently beat utility classes regardless of specificity. Wrap bare-element selectors in @layer base { ... } so utilities can override them. See TAILWIND V4 CASCADE TRAP in SKILL.md.`,
          });
        }
      } catch { /* swallow */ }
    }
    // ---- FOOTER-AFTER-DARK-CTABANNER ----
    // Footer.astro must rely on internal py-* for spacing. mt-{n} on the
    // outer Footer wrapper exposes a cream stripe between two dark sections.
    if (existsSync(footerPath)) {
      try {
        const footerSrc = readFileSync(footerPath, 'utf8');
        // Look at the FIRST <footer ...> tag and its class attribute
        const m = footerSrc.match(/<footer[^>]*class=["']([^"']+)["']/);
        if (m && /\bmt-(?!\[)\S+/.test(m[1])) {
          staticIssues.push({
            severity: 'fail',
            check: 'footer-margin-top',
            msg: `Footer.astro outer <footer> has 'mt-*' margin-top class ('${m[1].match(/\bmt-\S+/)[0]}'). When the section above the footer is also dark (e.g. dark CtaBanner), mt-* exposes a cream stripe between the two sections. Use internal py-* on the Footer instead. See FOOTER-AFTER-DARK-CTABANNER in SKILL.md.`,
          });
        }
      } catch { /* swallow */ }
    }
  }
  // ---- end static source lints ----

  // Report — grouped by viewport, with dedupe for issues that fire at both.
  // An issue that fires at desktop+mobile gets counted ONCE but tagged "[both]".
  // An issue that only fires at one viewport gets counted once and tagged with that viewport.
  console.log('\n========================================');
  console.log('  QA CHECK RESULTS');
  console.log('========================================');

  let failCount = 0;
  let warnCount = 0;

  // Site-wide image-reuse result (printed before per-page results)
  if (imageReuseSiteIssue) {
    if (imageReuseSiteIssue.severity === 'fail') {
      console.log(`\n[site-wide]\n  ✗ [${imageReuseSiteIssue.check}] ${imageReuseSiteIssue.msg}`);
      failCount++;
    } else {
      console.log(`\n[site-wide]\n  ✓ [${imageReuseSiteIssue.check}] ${imageReuseSiteIssue.msg}`);
    }
  }

  // Site-wide bilingual page-parity (BILINGUAL SUPPORT, B/C only)
  if (bilingualParityIssue) {
    if (bilingualParityIssue.severity === 'fail') {
      console.log(`\n[site-wide]\n  ✗ [${bilingualParityIssue.check}] ${bilingualParityIssue.msg}`);
      failCount++;
    } else {
      console.log(`\n[site-wide]\n  ✓ [${bilingualParityIssue.check}] ${bilingualParityIssue.msg}`);
    }
  }

  // Static source lints (cascade-trap + footer-mt-* + future static checks)
  for (const issue of staticIssues) {
    console.log(`\n[static-source]\n  ✗ [${issue.check}] ${issue.msg}`);
    failCount++;
  }

  // Build a per-path, cross-viewport view: map path -> { desktop: result, mobile: result }
  const byPath = {};
  for (const r of results) {
    if (!byPath[r.path]) byPath[r.path] = {};
    byPath[r.path][r.viewport] = r;
  }

  for (const path of Object.keys(byPath)) {
    console.log(`\n${path}`);
    const desktopR = byPath[path].desktop || { issues: [] };
    const mobileR  = byPath[path].mobile  || { issues: [] };

    if (desktopR.logo) {
      console.log(`  logo (desktop): natural=${desktopR.logo.naturalW}x${desktopR.logo.naturalH}, displayed=${desktopR.logo.displayedW}x${desktopR.logo.displayedH}`);
    }
    if (mobileR.logo && (mobileR.logo.displayedW !== (desktopR.logo && desktopR.logo.displayedW))) {
      console.log(`  logo (mobile):  natural=${mobileR.logo.naturalW}x${mobileR.logo.naturalH}, displayed=${mobileR.logo.displayedW}x${mobileR.logo.displayedH}`);
    }

    // Dedupe: same check + same msg at both viewports = one entry tagged "[both]"
    const issueMap = new Map(); // key: check::msg → { issue, viewports: Set }
    for (const v of ['desktop', 'mobile']) {
      const r = byPath[path][v];
      if (!r) continue;
      for (const i of r.issues) {
        const key = `${i.check}::${i.msg}`;
        if (issueMap.has(key)) {
          issueMap.get(key).viewports.add(v);
        } else {
          issueMap.set(key, { issue: i, viewports: new Set([v]) });
        }
      }
    }

    if (issueMap.size === 0) {
      console.log('  ✓ PASS (both viewports)');
    } else {
      for (const { issue, viewports } of issueMap.values()) {
        const mark = issue.severity === 'fail' ? '✗' : '⚠';
        const tag = viewports.size === 2 ? '[both]' : `[${[...viewports][0]}-only]`;
        console.log(`  ${mark} ${tag} [${issue.check}] ${issue.msg}`);
        if (issue.severity === 'fail') failCount++;
        if (issue.severity === 'warn') warnCount++;
      }
    }
  }

  if (consoleErrors.length) {
    console.log('\n  Console errors:');
    for (const e of consoleErrors) console.log(`  ✗ ${e}`);
    failCount += consoleErrors.length;
  }
  if (failedRequests.length) {
    console.log('\n  Failed requests:');
    for (const e of failedRequests) console.log(`  ✗ ${e}`);
    failCount += failedRequests.length;
  }

  console.log('\n========================================');
  if (failCount > 0) {
    console.log(`  ✗ FAILED (${failCount} failures, ${warnCount} warnings)`);
    console.log('  Fix all failures before deploying.');
    console.log('========================================');
    process.exit(1);
  } else if (warnCount > 0) {
    console.log(`  ⚠ PASSED with ${warnCount} warnings`);
    console.log('========================================');
    process.exit(0);
  } else {
    console.log('  ✓ ALL CHECKS PASSED');
    console.log('========================================');
    process.exit(0);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
