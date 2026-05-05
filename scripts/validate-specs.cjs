#!/usr/bin/env node
/**
 * validate-specs.cjs — pre-dispatch fact-grounding lint for per-page specs
 *
 * Stage 2.5 (decomposed mode): Opus writes per-page specs into
 * jobs/{domain}/specs/<page>.md. This script verifies that every fact-shaped
 * claim in those specs is grounded in the manifest + design-brief BEFORE
 * Sonnet workers consume the specs.
 *
 * Why it exists: 2026-04-29 plumbers build had 35 first-run QA fails because
 * the spec author (Opus) seeded "Free estimates" into 5 separate per-page
 * specs. Workers faithfully copied. The bug propagated 5×. Catching it at
 * the spec stage instead of post-build is N× cheaper.
 *
 * Usage:
 *   node scripts/validate-specs.cjs \
 *     --manifest jobs/{domain}/manifest.json \
 *     --design-brief jobs/{domain}/design-brief.json \
 *     --specs jobs/{domain}/specs/
 *
 * Exits 0 on pass, 1 on any unsupported claim found.
 *
 * The patterns are the same as scripts/qa-check.js fact-grounding rules,
 * adapted to walk markdown files instead of rendered HTML. Same algorithm,
 * different input source.
 */

const fs = require('node:fs');
const path = require('node:path');

// ---- argv parsing ----
let manifestPath = null;
let designBriefPath = null;
let specsDir = null;
let allowEmpty = false;   // opt-in for monolithic mode (added 2026-05-04)
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--manifest' && args[i+1]) { manifestPath = args[++i]; continue; }
  if (a === '--design-brief' && args[i+1]) { designBriefPath = args[++i]; continue; }
  if (a === '--specs' && args[i+1]) { specsDir = args[++i]; continue; }
  if (a === '--allow-empty') { allowEmpty = true; continue; }
}

if (!manifestPath) {
  console.error('Usage: validate-specs.cjs --manifest <path> [--design-brief <path>] --specs <dir> [--allow-empty]');
  process.exit(2);
}
if (!specsDir) {
  console.error('Usage: validate-specs.cjs --manifest <path> [--design-brief <path>] --specs <dir> [--allow-empty]');
  process.exit(2);
}

// ---- Build the corpus (manifest + optional design-brief) ----
function buildCorpusFromJson(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return '';
  try {
    const obj = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const buf = [];
    function walk(v) {
      if (v === null || v === undefined) return;
      if (typeof v === 'string') { buf.push(v); return; }
      if (typeof v === 'number') { buf.push(String(v)); return; }   // include numbers (e.g. yearsExperience: 35)
      if (typeof v === 'boolean') return;                            // booleans: skip
      if (Array.isArray(v)) { v.forEach(walk); return; }
      if (typeof v === 'object') {
        for (const k of Object.keys(v)) {
          if (k === '_placeholder') continue;
          if (k.startsWith('_')) continue;
          // Include the KEY too, as a string — "yearsExperience" appearing in
          // the corpus along with "35" gives the verify regex evidence that
          // 35 is associated with years.
          buf.push(k);
          walk(v[k]);
        }
      }
    }
    walk(obj);
    return buf.join(' ');
  } catch (e) {
    console.warn(`⚠ Failed to parse ${filePath}: ${e.message}`);
    return '';
  }
}

const corpusRaw = buildCorpusFromJson(manifestPath) + ' ' + buildCorpusFromJson(designBriefPath);
const corpus = corpusRaw
  .toLowerCase()
  .replace(/[^a-z0-9@'\-\/\s]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

console.log(`✓ Built corpus from ${manifestPath}${designBriefPath ? ' + ' + designBriefPath : ''} — ${corpus.length} chars`);

// ---- Fact-grounding rules (ported verbatim from scripts/qa-check.js) ----
const CURRENT_YEAR = new Date().getFullYear();

const FACT_RULES = [
  {
    label: 'years-experience',
    pattern: /\b(?:over\s+|more\s+than\s+|nearly\s+|about\s+)?(\d{1,2})\+?\s*-?\s*years?(?:\s+(?:of\s+)?(?:experience|in\s+business|serving|established|of\s+service|combined))?/gi,
    verify(match, corpus) {
      const claimedYears = parseInt(match[1], 10);
      if (!Number.isFinite(claimedYears) || claimedYears < 5) return null;
      const directRx = new RegExp(`\\b${claimedYears}\\+?\\s*-?\\s*years?\\b`);
      if (directRx.test(corpus)) return null;
      const yearRx = /\b(?:since|established|founded|est\.?|estd|in|circa)\s+(\d{4})\b|\b(\d{4})\s*-\s*present\b|©\s*(\d{4})/g;
      let y;
      while ((y = yearRx.exec(corpus)) !== null) {
        const yyyy = parseInt(y[1] || y[2] || y[3], 10);
        if (yyyy >= 1900 && yyyy <= CURRENT_YEAR) {
          const derived = CURRENT_YEAR - yyyy;
          if (derived >= claimedYears - 1) return null;
        }
      }
      return `manifest contains no "${claimedYears} years" mention and no founding year that would derive ≥${claimedYears} years`;
    },
  },
  {
    label: 'since-year',
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
    pattern: /\b((?:family|veteran|woman|women|minority|locally|black|hispanic|asian|lgbtq?\+?)[- ]owned(?:\s+and\s+operated)?)\b/gi,
    verify(match, corpus) {
      const adj = match[1].split(/[- ]/)[0].toLowerCase();
      const flexRx = new RegExp(`\\b${adj}[- ]owned\\b`);
      if (flexRx.test(corpus)) return null;
      return `manifest does not contain "${match[1]}" or any "${adj}-owned" mention`;
    },
  },
  {
    label: 'review-count',
    pattern: /\b(\d{2,5})\+?\s*(five[- ]star|5[- ]star|happy|satisfied|delighted|verified|google|yelp)\s+(reviews?|customers?|clients?|ratings?)\b/gi,
    verify(match, corpus) {
      const n = match[1];
      if (new RegExp(`\\b${n}\\+?\\s*\\b`).test(corpus)) return null;
      return `manifest does not mention "${n}" alongside reviews/customers/clients (claim: "${match[0]}")`;
    },
  },
  {
    label: 'star-rating',
    pattern: /\b([45](?:\.\d)?)\s*[- ]?\s*star(?:\s+rated|\s+rating|s)?\b/gi,
    verify(match, corpus) {
      const n = match[1];
      if (new RegExp(`\\b${n}\\b`).test(corpus)) return null;
      if (n === '5' && /\b(5[- ]star|five[- ]star|★{4,})\b/.test(corpus)) return null;
      return `manifest does not contain a ${n}-star rating reference`;
    },
  },
  {
    label: 'availability-promise',
    pattern: /\b(24[\/.]7|24[- ]hour\s+(?:service|response|availability|emergency)|round[- ]the[- ]clock|same[- ]day\s+service|next[- ]day\s+service|free\s+(?:estimates?|quotes?|consultations?)|free\s+(?:in[- ]home|on[- ]site)\s+(?:estimates?|quotes?))\b/gi,
    verify(match, corpus) {
      const text = match[0].toLowerCase();
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

  // numbered-section-eyebrow: catches authored numbered eyebrows in specs
  // BEFORE worker dispatch (mirrors the qa-check.js `numbered-section-labels`
  // post-build check, but earlier in the pipeline = N× cheaper). The rule
  // is corpus-independent — there's NO valid corpus support for these on
  // non-blog pages; the post-strip qa-check pass is structurally unsafe
  // because CSS grids in the templates are dimensioned to hold the number
  // spans (e.g. `grid-template-columns: 56px 1fr`). Strip the spans, the
  // grid collapses; rows stack vertically. Real bug 2026-04-30
  // (cherokeecarpetcleaning.com — three deploys shipped with collapsed
  // grids before anyone noticed).
  //
  // Pattern matches all known eyebrow-numeric variants:
  //   `01 — WHAT WE DO`, `02 ── RECENT WORK`, `[ 03 ] · NEW`,
  //   `§ 01 · DIY RISK`, `SVC · 01`, `01 / SERVICES`, `01 · INTERIOR`.
  //
  // The verify() always returns a reason — no corpus search saves it.
  {
    label: 'numbered-section-eyebrow',
    pattern: /(?:^|\s|>|`|"|'|\*|\(|\[)(?:§\s*)?(?:\[\s*)?\d{1,2}(?:\s*\])?\s*[\/—·│|‒–-]\s+[A-Z][A-Z\s]{2,}/g,
    verify(match, _corpus) {
      const text = match[0].trim();
      // Allow blog post numerics like "Step 1 — How to..." since blog/article
      // contexts genuinely have ordered lists.  Detection: if the line context
      // includes "Step ", "Part ", or "Chapter ", skip.  We don't have line
      // context here in verify(), so as a coarse filter only fail on patterns
      // that look like section eyebrows (ALL-CAPS after the divider).
      // The pattern already requires [A-Z][A-Z\s]{2,} so "Step 1 — How to" doesn't match.
      return `numbered section eyebrow "${text}" — FORBIDDEN on non-blog/non-article pages per NUMBERED SECTION LABELS RULE. Drop the number, keep the category label only ("SERVICES · WHAT WE DO" not "01 / SERVICES · WHAT WE DO"). Real bug 2026-04-30 (cherokeecarpetcleaning.com): post-strip qa-check breaks CSS grids dimensioned to hold the number-spans. Eliminate at the spec source.`;
    },
  },
];

// ---- Walk specs/*.md and check each ----
if (!fs.existsSync(specsDir)) {
  console.error(`✗ Specs dir not found: ${specsDir}`);
  process.exit(2);
}

const specFiles = fs.readdirSync(specsDir)
  .filter(f => f.endsWith('.md'))
  .filter(f => !f.startsWith('_'))   // skip _shared.md, _service-template.md, _rewrite-shared.md
  .sort();

if (specFiles.length === 0) {
  // BEHAVIORAL CHANGE 2026-05-04: empty specs is now a HARD GATE in
  // decomposed mode (the default). Without per-page specs, Stage 3/5/7 cannot
  // dispatch parallel Sonnet sub-agents — there's nothing for the workers to
  // read. Stage 2.5 was either skipped or didn't persist its output to disk.
  //
  // Survey of jobs/ directories on 2026-05-04 showed 46 of 53 built jobs had
  // empty specs/ — orchestrators were silently bypassing decomposed mode.
  // SKILL.md's cost projections + wallclock estimates assume decomposed mode;
  // silent monolithic was the root cause of "painfully slow" feedback on
  // 6+-page sites.
  //
  // Pass --allow-empty to opt into monolithic mode (orchestrator does
  // per-page work itself instead of dispatching sub-agents). The /webfactory
  // --monolithic flag should map to this. Hard error otherwise so the choice
  // is EXPLICIT rather than IMPLICIT.
  if (allowEmpty) {
    console.warn(`⚠ No per-page specs in ${specsDir} — proceeding in MONOLITHIC mode per --allow-empty.`);
    console.warn(`  Cost will be higher than decomposed mode for 3+-page sites; wallclock will be ~3-5× slower.`);
    console.warn(`  Use this only when the orchestrator has explicitly opted into monolithic via /webfactory --monolithic.`);
    process.exit(0);
  }
  console.error('');
  console.error('═══════════════════════════════════════════════════════════════════════');
  console.error('  ✗ STAGE 2.5 GATE FAILED — empty specs/ directory');
  console.error('═══════════════════════════════════════════════════════════════════════');
  console.error(`  No per-page .md spec files found in ${specsDir}`);
  console.error(`  (looked for non-underscore-prefixed *.md — found ${fs.readdirSync(specsDir).length} total entries)`);
  console.error('');
  console.error('  Decomposed mode (DEFAULT since 2026-04-29) requires Stage 2.5 to write');
  console.error('  one self-contained spec per page so Stage 3/5/7 can dispatch parallel');
  console.error('  Sonnet sub-agents. Without specs, decomposed dispatch is impossible.');
  console.error('');
  console.error('  Two ways to resolve:');
  console.error('');
  console.error('  1) RUN STAGE 2.5 PROPERLY (recommended for 3+-page sites)');
  console.error('     - Read SKILL.md / skill-stages/stage-2.md Stage 2.5 instructions');
  console.error('     - Write _shared.md + one <page>.md per manifest page into specs/');
  console.error('     - Re-run validate-specs.cjs to confirm');
  console.error('');
  console.error('  2) OPT INTO MONOLITHIC MODE (only for 1-2 page sites or genuine fallback)');
  console.error('     - Re-run with: validate-specs.cjs ... --allow-empty');
  console.error('     - Orchestrator must then do per-page work inline (no sub-agents)');
  console.error('     - Wallclock will be 3-5× slower than decomposed for 3+-page sites');
  console.error('     - This should map to /webfactory --monolithic flag if user-requested');
  console.error('');
  console.error('  Real cause survey 2026-05-04: 46 of 53 jobs/ dirs had empty specs/,');
  console.error('  meaning orchestrators silently bypassed Stage 2.5. This gate makes the');
  console.error('  choice between modes EXPLICIT.');
  console.error('═══════════════════════════════════════════════════════════════════════');
  process.exit(2);
}

console.log(`Validating ${specFiles.length} spec(s) against corpus...\n`);

const allIssues = [];

// Build a "skip mask" for each spec — line ranges that are prohibition sections
// (e.g. "## What NOT to add", "## Do NOT touch") are NEGATIVE examples and should
// not be validated. The mask is a Set of line-numbers that are INSIDE a prohibition
// section.
function buildSkipMask(text) {
  const lines = text.split('\n');
  const skip = new Set();
  let inProhibition = false;
  let prohibitionLevel = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Detect a prohibition heading (any heading level + words signaling negation)
    const headingMatch = line.match(/^(#+)\s+(.*)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const headingText = headingMatch[2].toLowerCase();
      const isProhibition = /\b(not\s+to\s+add|not\s+to\s+touch|never|do\s+not|don't|forbidden|prohibited|avoid|must\s+not|cannot|skip)\b/.test(headingText);
      if (isProhibition) {
        inProhibition = true;
        prohibitionLevel = level;
        skip.add(i + 1); // skip the heading line itself
        continue;
      }
      // If we hit a heading at the same OR shallower level than the prohibition heading, exit prohibition mode
      if (inProhibition && level <= prohibitionLevel) {
        inProhibition = false;
        prohibitionLevel = 0;
      }
    }
    if (inProhibition) skip.add(i + 1);
  }
  return skip;
}

// Also: skip lines that are clearly negative-example callouts even outside prohibition sections.
// Pattern: line starts with "Do NOT" / "Don't" / "Never" / "Avoid" / "DON'T"
function isNegativeExampleLine(line) {
  return /^\s*(?:\*\s+|-\s+)?(?:\*\*\s*)?(?:NEVER|AVOID|FORBIDDEN|Do\s+NOT|Don't|DON'T)/i.test(line);
}

for (const f of specFiles) {
  const filePath = path.join(specsDir, f);
  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.split('\n');
  const skipMask = buildSkipMask(text);
  const seenInThisFile = new Set();   // de-dupe identical claims within a single spec

  for (const rule of FACT_RULES) {
    rule.pattern.lastIndex = 0;
    let m;
    while ((m = rule.pattern.exec(text)) !== null) {
      const matchText = m[0].trim();
      const reason = rule.verify(m, corpus);
      if (!reason) continue;

      // Find the line number
      const offset = m.index;
      let lineNum = 1;
      let acc = 0;
      for (let i = 0; i < lines.length; i++) {
        acc += lines[i].length + 1;
        if (acc > offset) { lineNum = i + 1; break; }
      }

      // SKIP if the line is in a prohibition section ("## What NOT to add", etc.)
      if (skipMask.has(lineNum)) continue;

      // SKIP if the line itself is a "Do NOT" / "Don't" / "Never" / "Avoid" example
      if (isNegativeExampleLine(lines[lineNum - 1] || '')) continue;

      // De-dupe same-claim-multiple-times in the same spec
      const dedupeKey = `${rule.label}::${matchText.toLowerCase()}`;
      if (seenInThisFile.has(dedupeKey)) continue;
      seenInThisFile.add(dedupeKey);

      allIssues.push({ file: f, line: lineNum, rule: rule.label, claim: matchText, reason });
    }
  }
}

// ---- Report ----
console.log('═'.repeat(72));
console.log(`  VALIDATE-SPECS RESULTS`);
console.log('═'.repeat(72));

if (allIssues.length === 0) {
  console.log(`\n  ✓ PASSED — all ${specFiles.length} spec(s) validated. No unsupported fact claims found.\n`);
  console.log('═'.repeat(72));
  process.exit(0);
}

// Group by file for readability
const byFile = {};
for (const issue of allIssues) {
  if (!byFile[issue.file]) byFile[issue.file] = [];
  byFile[issue.file].push(issue);
}

for (const f of Object.keys(byFile).sort()) {
  console.log(`\n  ${f}`);
  for (const issue of byFile[f]) {
    console.log(`    ✗ line ${issue.line.toString().padStart(3)} [${issue.rule}] "${issue.claim}"`);
    console.log(`        → ${issue.reason}`);
  }
}

console.log(`\n  ✗ FAILED (${allIssues.length} unsupported claim(s) across ${Object.keys(byFile).length} file(s))`);
console.log(`  Fix the specs (or add the claims to manifest.json / design-brief.json if true)`);
console.log(`  BEFORE dispatching workers. Catching this here is N× cheaper than at Stage 4 QA.`);
console.log('═'.repeat(72));
process.exit(1);
