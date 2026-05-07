#!/usr/bin/env node
/**
 * extract-brief-essentials.cjs — emit the slim downstream brief (Phase G.5)
 *
 * Built 2026-05-06 as Phase G.5 of the cost-optimization plan. Per-page
 * sub-agents at Stages 2.5b (Phase G.1's parallel spec-gen), 3 (Build A
 * per-page render), and 7d-build (Option C per-page render) historically
 * read the FULL `jobs/{domain}/design-brief.json` (~30KB on a typical
 * site) — but per-page work only needs:
 *
 *   - Industry classification + business name (~50 bytes)
 *   - Color palette with named brand roles (~600 bytes)
 *   - Typography pairing (~150 bytes)
 *   - Top 3 layout patterns + 3 design details (~400 bytes)
 *   - Style + 1-line aesthetic anchor (~200 bytes)
 *
 * The other 28KB of brief content (target audience reasoning, brand
 * signature inventory provenance, hero direction prose, the
 * distinctive-element catalog with rationale, micro-interaction list,
 * mobile-first commitments, full inspiration prose, currentSite SWOT)
 * was authored by the Stage 2 sub-agent for the orchestrator AND for
 * future audit, NOT for per-page render workers. Per-page workers
 * already get directives from `_shared.md` (palette, typography,
 * prohibitions, component sigs) — the full brief is overhead in their
 * context window.
 *
 * G.5 fix: orchestrator runs this script after Stage 2 (or after the
 * full brief is on disk) to produce `jobs/{domain}/brief-essentials.json`
 * (~2-4KB). Per-page sub-agent prompts replace `Read design-brief.json`
 * with `Read brief-essentials.json`. The full brief stays on disk for
 * audit + skill-owner review; only the slim version reaches workers.
 *
 * Usage:
 *   node scripts/extract-brief-essentials.cjs <domain>
 *
 * Output: writes jobs/{domain}/brief-essentials.json + prints summary
 *         to stdout.
 *
 * Exit codes:
 *   0 — success
 *   1 — bad CLI args
 *   2 — design-brief.json missing
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');

const domain = process.argv[2];
if (!domain) {
  console.error('Usage: node scripts/extract-brief-essentials.cjs <domain>');
  process.exit(1);
}

const jobDir = path.join(REPO_ROOT, 'jobs', domain);
const briefPath = path.join(jobDir, 'design-brief.json');
const outPath   = path.join(jobDir, 'brief-essentials.json');

if (!fs.existsSync(briefPath)) {
  console.error(`✗ Design brief not found: ${briefPath}`);
  console.error('  Run Stage 2 first (Opus brief generation).');
  process.exit(2);
}

const brief = JSON.parse(fs.readFileSync(briefPath, 'utf8'));

// Helper — pull the first N items of an array if it's an array, else passthrough.
function firstN(v, n) {
  if (Array.isArray(v)) return v.slice(0, n);
  return v;
}

// Helper — strip rationale prose from named-role colors when present, keep
// the hex + role name (the role name is what disambiguates "primary" from
// "accent" semantically, which a per-page worker uses to pick the right
// surface color).
function trimColor(c) {
  if (!c) return null;
  if (typeof c === 'string') return { hex: c };
  if (typeof c === 'object') {
    const out = {};
    if (c.hex) out.hex = c.hex;
    if (c.role) out.role = c.role;
    // Drop c.why / c.rationale / c.notes — those are for the brief author,
    // not per-page workers.
    return out;
  }
  return null;
}

function trimPalette(palette) {
  if (!palette || typeof palette !== 'object') return palette;
  const out = {};
  for (const [k, v] of Object.entries(palette)) {
    out[k] = trimColor(v);
  }
  return out;
}

const essentials = {
  // Provenance — point downstream readers back at the full brief if they
  // need anything that isn't here. Keeps brief-essentials.json honest
  // about what's been omitted.
  _meta: {
    extractedAt: new Date().toISOString(),
    extractedBy: 'scripts/extract-brief-essentials.cjs',
    fullBriefPath: 'design-brief.json',
    note: 'Slim brief for per-page sub-agents (Phase G.5). Read design-brief.json for full context (target audience, hero direction prose, distinctive-element rationale, etc.).',
  },

  business: {
    name: brief.business?.name,
    industry: brief.business?.industry,
    type: brief.business?.type,
    // First 2 value props — page workers use these for hero copy / CTA framing.
    valuePropositions: firstN(brief.business?.valuePropositions, 2),
  },

  design: {
    style: brief.design?.style,
    // Inspiration is often a full paragraph — we keep ~1 sentence by truncation.
    inspirationLead: typeof brief.design?.inspiration === 'string'
      ? brief.design.inspiration.slice(0, 250)
      : brief.design?.inspiration,

    // Palette + typography — full fidelity, these are the single most
    // important inputs to per-page rendering.
    colorPalette: trimPalette(brief.design?.colorPalette),
    typography: brief.design?.typography,

    // Top 3 of each list — per-page workers cite these for layout decisions
    // but rarely need the long tail (10+ items in some briefs).
    layoutPatterns: firstN(brief.design?.layoutPatterns, 3),
    designDetails: firstN(brief.design?.designDetails, 3),
    animations: firstN(brief.design?.animations, 3),
  },
};

fs.writeFileSync(outPath, JSON.stringify(essentials, null, 2));

const fullSize = fs.statSync(briefPath).size;
const slimSize = fs.statSync(outPath).size;
const pctSaved = ((1 - slimSize / fullSize) * 100).toFixed(0);

console.log(`✓ Brief essentials extracted for ${domain}`);
console.log(`  full   ${fullSize.toString().padStart(6)} bytes  (${briefPath.replace(REPO_ROOT + '/', '')})`);
console.log(`  slim   ${slimSize.toString().padStart(6)} bytes  (${outPath.replace(REPO_ROOT + '/', '')})  -${pctSaved}%`);

// Phase F self-instrumentation — emit so audit can see the extraction ran.
try {
  const { logDecision } = require('./_log-helper.cjs');
  logDecision(domain, '2-post', 'brief-essentials-extracted', {
    fullBytes: fullSize,
    slimBytes: slimSize,
    pctSaved: Number(pctSaved),
  });
} catch {}

process.exit(0);
