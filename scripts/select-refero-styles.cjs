#!/usr/bin/env node
/**
 * select-refero-styles.cjs — pick top-N relevant DESIGN.md INSPIRATION priors
 * from the local `templates/inspiration/refero-styles/` library
 *
 * INSPIRATION, NOT SPECIFICATION. The picks emitted by this script are
 * EXAMPLES of what considered design looks like in similar industries —
 * NOT a spec workers should copy verbatim. Workers extract structural
 * patterns, role thinking, typographic moves, and do's/don'ts; they DO
 * NOT copy hex codes, font families, spacing scales, or border radii.
 * The customer's `industry-tokens.json` (Option C) or `design-brief.json`
 * (Option A) is the canonical specification. See REFERO REFERENCES rule
 * in SKILL.md for the full inspiration-vs-spec architecture.
 *
 * Built 2026-05-07 alongside the Stage 4c-tris reshape and the "use local
 * library, drop the MCP" pivot. Refero ships ~1,226 DESIGN.md files
 * (Tailwind v4 @theme variant) covering color tokens, typography, spacing,
 * components, do's & don'ts, surfaces, elevation, imagery, layout, agent
 * prompt guide. Each file is ~10-15KB; the index is 1.36MB. We don't want
 * sub-agents reading the whole index just to filter.
 *
 * This script:
 *   1. Loads `templates/inspiration/refero-styles/_index.json` (Node-side,
 *      fast — never touches the sub-agent's context)
 *   2. Reads the customer's industry direction:
 *        - jobs/{domain}/industry-tokens.json (Option C — has a `direction`
 *          field like "industrial / trades — workwear-document for an
 *          outdoor contractor")
 *        - jobs/{domain}/design-brief.json (Option A — has a `business.industry`
 *          field + `design.style` notes)
 *   3. Tokenizes the direction into a keyword set + an exclude set
 *   4. Scores each refero-styles entry by northStar keyword overlap +
 *      colorScheme alignment; subtracts for exclude-keywords
 *   5. Returns top N entries (default 5) — writes a slim priors file at
 *      jobs/{domain}/refero-style-priors-{a|c}.json with:
 *      { entries: [{slug, file, northStar, fonts, colors, colorScheme, score}],
 *        query: "<keywords used>", excludedSaaSClones: <count> }
 *
 * The sub-agents (Stage 4c-tris audit, Stage 4c-bis/6c/7g visual-pass diversity
 * check, Stage 7d Option C plugin invocation) read the priors file (small,
 * deterministic) then Read the chosen 2-3 .md files.
 *
 * Self-instruments via Phase F: emits "1-post/refero-styles-selected" event with
 * count + top match.
 *
 * Usage:
 *   node scripts/select-refero-styles.cjs <domain> [--for=a|c] [--n=5] [--keywords="kw1 kw2"]
 *
 *   --for=a   — read design-brief.json, write refero-style-priors-a.json (default)
 *   --for=c   — read industry-tokens.json, write refero-style-priors-c.json
 *   --n=N     — number of top entries to return (default 5, max 20)
 *   --keywords="..." — additional positive keywords (added to the auto-derived set)
 *
 * Exit codes:
 *   0 — priors file written
 *   1 — bad CLI args / domain dir missing
 *   2 — refero-styles library not found
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const STYLES_DIR = path.join(REPO_ROOT, 'templates/inspiration/refero-styles');

// SaaS / fintech / productivity / digital-agency keywords that flag entries to
// DOWN-WEIGHT for small-business-contractor customers. The refero-styles
// corpus skews HEAVILY toward this aesthetic territory, and bleed-through is
// the editorial-drift failure mode WebFactory has been fighting for months.
// Penalties are heavy by design — for a trade customer we'd rather return
// an EMPTY picks list (caller falls back to local inspiration directory)
// than five mismatched SaaS clones.
const SAAS_PRIOR_KEYWORDS = [
  // Pure SaaS / fintech terms
  'dashboard', 'saas', 'fintech', 'b2b', 'enterprise', 'platform', 'app',
  'productivity', 'crm', 'analytics', 'admin', 'control panel', 'settings',
  'developer', 'devtool', 'devops', 'api', 'sdk', 'cloud',
  // Digital-agency / studio marketing copy that bleeds into trade matches
  'digital craftsmanship', 'digital atelier', 'software studio', 'creative studio',
  'design studio', 'web studio', 'startup', 'workspace', 'productivity tool',
  // Generic-AI-design tells
  'ai', 'agent', 'llm', 'chatbot', 'gradient', 'glassmorphism',
];

// Tight industry-specific keyword expansions. Keep these conservative —
// each expansion should be a HARD signal of the target industry, not a
// soft marketing word that bleeds into SaaS copy. No "agency", "studio",
// "craft" alone — those leak through (Refero entries describe themselves
// as "ateliers of digital craftsmanship," etc.).
const INDUSTRY_KEYWORDS = {
  'industrial':         ['industrial', 'workwear', 'machinery', 'foundry', 'forge', 'metal-shop', 'fabrication'],
  'trades':             ['contractor', 'tradesperson', 'plumber', 'electrician', 'roofing', 'landscaping', 'hvac', 'pest', 'septic'],
  'photo-led':          ['photo', 'photography', 'gallery', 'photographer', 'documentary', 'darkroom', 'large-format'],
  'workwear-document':  ['workwear', 'kraft', 'manila', 'archival', 'blueprint', 'document-grade', 'work-order'],
  'food':               ['restaurant', 'cafe', 'bakery', 'kitchen', 'dining', 'cuisine', 'menu', 'butcher', 'farm-to-table'],
  'clinical':           ['clinical', 'medical', 'dental', 'patient', 'hospital', 'pediatric', 'orthodontic', 'optometry'],
  'editorial':          ['editorial', 'newsroom', 'publication', 'newspaper', 'literary', 'typographic'],
  'architectural':      ['architecture', 'brutalist', 'concrete', 'realtor', 'real-estate', 'realty'],
  'garage':             ['garage', 'auto-body', 'mechanical', 'detailing', 'tire', 'oil-change'],
  'tree':               ['tree', 'arborist', 'forestry', 'pruning', 'logging', 'land-clearing'],
  'outdoor':            ['outdoor', 'landscape', 'landscaping', 'lawn', 'yard', 'park-ranger'],
};

function parseArgs(argv) {
  // minScore=3 means a single direct industry-keyword hit in the northStar
  // clears the bar (one positive keyword = +3, threshold = 3). The SaaS
  // penalty (-6 per SaaS phrase) means SaaS-clone entries that match one
  // industry word still lose net score and stay out — so we get genuine
  // industry matches when the corpus has them, and an empty list (caller
  // falls back to local inspiration) when it doesn't.
  const args = { domain: null, forOption: 'a', n: 5, keywords: '', minScore: 3 };
  for (const a of argv.slice(2)) {
    if (a.startsWith('--for=')) args.forOption = a.split('=')[1];
    else if (a.startsWith('--n=')) args.n = Math.min(20, Math.max(1, parseInt(a.split('=')[1], 10) || 5));
    else if (a.startsWith('--keywords=')) args.keywords = a.split('=').slice(1).join('=');
    else if (a.startsWith('--min-score=')) args.minScore = parseFloat(a.split('=')[1]) || 4;
    else if (!a.startsWith('--') && !args.domain) args.domain = a;
  }
  return args;
}

function loadIndustryDirection(jobDir, forOption) {
  // Option C: prefer industry-tokens.json (Stage 7b-bis output — explicit direction)
  if (forOption === 'c') {
    const p = path.join(jobDir, 'industry-tokens.json');
    if (fs.existsSync(p)) {
      try {
        const t = JSON.parse(fs.readFileSync(p, 'utf8'));
        return {
          source: 'industry-tokens.json',
          direction: t.direction || t.industry || '',
          colorScheme: (t.palette && (t.palette.scheme || t.palette.mode)) || null,
        };
      } catch (e) { /* fall through */ }
    }
  }
  // Option A — try in order of richness:
  //   1. design-brief.json (Stage 2 output — best, but only available POST-Stage 2)
  //   2. brief-input.json (slim manifest extract from Phase L.2 — POST-Stage 1)
  //   3. manifest.json (raw scrape — POST-Stage 1; rough fallback)
  // This ordering lets the orchestrator pre-run the selector BEFORE Stage 2
  // (so the brief author can read priors as inspiration) AND re-run it AFTER
  // Stage 2 (for higher-quality picks driven by the explicit brief).
  const briefPath = path.join(jobDir, 'design-brief.json');
  if (fs.existsSync(briefPath)) {
    try {
      const b = JSON.parse(fs.readFileSync(briefPath, 'utf8'));
      const direction = [
        b.business && b.business.industry,
        b.business && b.business.subIndustry,
        b.design && b.design.style,
        b.design && b.design.inspiration,
      ].filter(Boolean).join(' ');
      const colorScheme = (b.design && b.design.colorPalette && b.design.colorPalette.mode) || null;
      return { source: 'design-brief.json', direction, colorScheme };
    } catch (e) { /* fall through */ }
  }
  const briefInputPath = path.join(jobDir, 'brief-input.json');
  if (fs.existsSync(briefInputPath)) {
    try {
      const bi = JSON.parse(fs.readFileSync(briefInputPath, 'utf8'));
      const businessName = (bi.business && bi.business.name) || '';
      const businessIndustry = (bi.business && bi.business.industry) || '';
      const titles = (bi.pages || []).slice(0, 6).map(p => p.title || '').join(' ');
      const direction = [businessName, businessIndustry, titles].filter(Boolean).join(' ');
      return { source: 'brief-input.json', direction, colorScheme: null };
    } catch (e) { /* fall through */ }
  }
  const manifestPath = path.join(jobDir, 'manifest.json');
  if (fs.existsSync(manifestPath)) {
    try {
      const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      const businessName = (m.business && m.business.name) || (m.meta && m.meta.businessName) || '';
      const titles = (m.pages || []).slice(0, 6).map(p => p.title || '').join(' ');
      const headings = (m.pages || []).slice(0, 6).flatMap(p => (p.sections || []).slice(0, 3).map(s => s.heading || '')).filter(Boolean).slice(0, 12).join(' ');
      const direction = [businessName, titles, headings].filter(Boolean).join(' ');
      return { source: 'manifest.json', direction, colorScheme: null };
    } catch (e) { /* fall through */ }
  }
  return { source: null, direction: '', colorScheme: null };
}

function tokenize(s) {
  return (s || '').toLowerCase().split(/[^a-z0-9-]+/).filter(t => t.length >= 3);
}

function buildKeywordSet(direction, extra) {
  const tokens = new Set(tokenize(direction));
  // Pull in industry-keyword expansions
  for (const [key, expansions] of Object.entries(INDUSTRY_KEYWORDS)) {
    if (tokens.has(key) || (direction || '').toLowerCase().includes(key)) {
      for (const e of expansions) tokens.add(e);
    }
  }
  // Extra worker-supplied keywords
  for (const t of tokenize(extra || '')) tokens.add(t);
  return tokens;
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function wordBoundaryMatch(text, kw) {
  // Word-boundary match: "tree" matches "tree" but NOT "street" or "treetop".
  // Multi-word phrases ("digital craftsmanship") use simple includes since
  // they're already specific.
  if (kw.includes(' ') || kw.length >= 12) return text.includes(kw);
  // For hyphenated keywords ("land-clearing"), match exact phrase
  if (kw.includes('-')) return text.includes(kw);
  // Single tokens: word-boundary regex
  const re = new RegExp(`\\b${escapeRegex(kw)}\\b`);
  return re.test(text);
}

function scoreEntry(entry, keywords, colorScheme) {
  const ns = (entry.northStar || '').toLowerCase();
  // Positive: track UNIQUE keyword hits (a Set, not occurrences). This
  // weights dense multi-keyword matches over single-word metaphor noise:
  // "Warm Terracotta Cafe" hitting cafe+kitchen scores 6, while a SaaS
  // entry's "Digital Desert Dawn ... landscape" hits landscape once for 3.
  // Uses word-boundary matching so "tree" doesn't match "street".
  const matched = new Set();
  for (const kw of keywords) {
    if (wordBoundaryMatch(ns, kw)) matched.add(kw);
  }
  let score = matched.size * 3;
  // ColorScheme bonus if explicitly requested
  if (colorScheme && entry.colorScheme === colorScheme) score += 2;
  // SaaS prior penalty — heavy. The refero-styles corpus skews B2B SaaS;
  // for trade customers we'd rather emit zero picks than five mismatched
  // SaaS clones. Penalty is -6 per SaaS phrase hit. A single SaaS phrase
  // needs 2+ unique industry keywords to survive into the picks.
  for (const kw of SAAS_PRIOR_KEYWORDS) {
    if (wordBoundaryMatch(ns, kw)) score -= 6;
  }
  // Tiny tiebreaker — recency proxy
  if (entry.createdAt) {
    const year = parseInt(entry.createdAt.slice(0, 4), 10) || 2024;
    score += Math.max(0, year - 2024) * 0.1;
  }
  return { score, matchedKeywords: Array.from(matched) };
}

function main() {
  const args = parseArgs(process.argv);
  if (!args.domain) {
    console.error('Usage: node scripts/select-refero-styles.cjs <domain> [--for=a|c] [--n=5] [--keywords="..."]');
    process.exit(1);
  }
  if (!fs.existsSync(STYLES_DIR)) {
    console.error(`error: refero-styles library not found at ${STYLES_DIR}`);
    process.exit(2);
  }
  const indexPath = path.join(STYLES_DIR, '_index.json');
  if (!fs.existsSync(indexPath)) {
    console.error(`error: ${indexPath} missing — refero-styles library is incomplete`);
    process.exit(2);
  }
  const jobDir = path.join(REPO_ROOT, 'jobs', args.domain);
  if (!fs.existsSync(jobDir)) {
    console.error(`error: jobs/${args.domain}/ does not exist`);
    process.exit(1);
  }

  const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  const { source, direction, colorScheme } = loadIndustryDirection(jobDir, args.forOption);
  const keywords = buildKeywordSet(direction, args.keywords);

  // Score every entry; skip missing
  const scored = [];
  let saasPenalized = 0;
  for (const entry of index) {
    if (entry.missing) continue;
    const { score, matchedKeywords } = scoreEntry(entry, keywords, colorScheme);
    if (score < 0) saasPenalized++;
    scored.push({ entry, score, matchedKeywords });
  }
  // Sort by score desc; pick top N (only entries that clear the min-score
  // threshold). Default min-score=3 means a single direct industry-keyword
  // hit in the northStar clears the bar. The SaaS penalty (-6 per SaaS
  // phrase) means SaaS-clone entries that match one industry word still
  // lose net score and stay out. If nothing clears the threshold, the
  // priors file is empty — caller falls back to templates/inspiration/<dir>/
  // + customer's own peer-build PNGs.
  scored.sort((a, b) => b.score - a.score);
  const picks = scored.filter(s => s.score >= args.minScore).slice(0, args.n);

  const slim = picks.map(({ entry, score, matchedKeywords }) => ({
    slug: (entry.file || '').replace(/\.md$/, ''),
    siteName: entry.siteName,
    file: entry.file,
    path: path.join(STYLES_DIR, entry.file || ''),
    northStar: entry.northStar,
    fonts: entry.fonts,
    colors: (entry.colors || []).slice(0, 6),
    colorScheme: entry.colorScheme,
    score: Number(score.toFixed(1)),
    matchedKeywords,
  }));

  const priorsFile = path.join(jobDir, `refero-style-priors-${args.forOption}.json`);
  const priors = {
    domain: args.domain,
    forOption: args.forOption,
    source,
    direction,
    keywordsUsed: Array.from(keywords).slice(0, 30),
    requestedColorScheme: colorScheme,
    candidatePoolSize: index.length,
    saasPenalizedCount: saasPenalized,
    n: args.n,
    entries: slim,
    generatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(priorsFile, JSON.stringify(priors, null, 2));

  // Self-instrument (Phase F)
  try {
    const { logDecision } = require('./_log-helper.cjs');
    logDecision(args.domain, '1-post', 'refero-styles-selected', {
      forOption: args.forOption,
      count: picks.length,
      poolSize: index.length,
      saasPenalized,
      topMatch: picks[0] ? picks[0].entry.siteName : null,
      topScore: picks[0] ? Number(picks[0].score.toFixed(1)) : 0,
    });
  } catch (e) { /* logging is best-effort */ }

  console.log(`Selected ${slim.length}/${args.n} refero-styles for ${args.domain} (option=${args.forOption})`);
  if (slim.length > 0) {
    console.log(`  Top picks (by score):`);
    for (const s of slim) {
      const slugLabel = (s.slug || '').padEnd(28);
      const ns = (s.northStar || '').slice(0, 60);
      console.log(`    ${s.score.toFixed(1).padStart(6)}  ${slugLabel}  ${ns}`);
    }
  } else {
    console.log(`  (no positive-score matches — caller should fall back to templates/inspiration/<dir>/)`);
  }
  console.log(`  Wrote: ${priorsFile}`);
}

main();
