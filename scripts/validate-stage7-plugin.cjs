#!/usr/bin/env node
/**
 * validate-stage7-plugin.cjs — hard gate for Stage 7d (Frontend Design plugin invocation)
 *
 * Built 2026-05-04 in response to the "Claude Design 0%" dashboard signal —
 * the user observed a recent week of WebFactory builds with 0% plugin-skill
 * usage. While the watkinsmonuments.com run reviewed in real time DID
 * invoke the plugin (per worker transcript), prior builds may have
 * silently bypassed it. Same regression class as the empty-`specs/` issue
 * (gated by validate-specs.cjs) and the inline-visual-pass issue (gated by
 * validate-visual-pass.cjs): shipping an architecture without a hard gate
 * means orchestrators silently fall back to the lighter inline path.
 *
 * Detection: the plugin's signature output is RICH industry tokens. When
 * the orchestrator writes industry-tokens.json inline (without invoking
 * the plugin), the file is typically thinner — fewer palette entries,
 * shorter rationale strings, no `distinct_from_option_a` section, no
 * `ornament.avoid` array, no `imagery_directive` field. The plugin
 * always writes these. We fingerprint plugin presence by the richness of
 * industry-tokens.json + the existence of aesthetic-brief.md + the size
 * of aesthetic-brief.md.
 *
 * This is a heuristic — perfect plugin-vs-inline detection requires
 * orchestration.log instrumentation (Phase 2 of the context-optimization
 * plan). But the heuristic catches the common bypass case where the
 * orchestrator generates a thin JSON inline.
 *
 * Usage:
 *   node scripts/validate-stage7-plugin.cjs <domain> [--allow-inline]
 *
 * Exit codes:
 *   0 — industry-tokens.json + aesthetic-brief.md present and rich (plugin likely invoked)
 *   2 — files missing OR contents are too thin to be plugin output
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
let allowInline = false;
const positional = [];
for (const a of args) {
  if (a === '--allow-inline') { allowInline = true; continue; }
  positional.push(a);
}

const [domain] = positional;
if (!domain) {
  console.error('Usage: node scripts/validate-stage7-plugin.cjs <domain> [--allow-inline]');
  process.exit(2);
}

const optionCDir = path.join(REPO_ROOT, 'jobs', domain, 'option-c');
const tokensPath = path.join(optionCDir, 'industry-tokens.json');
const briefPath = path.join(optionCDir, 'aesthetic-brief.md');

function softFail(msg) {
  if (allowInline) {
    console.warn(`⚠ ${msg} — proceeding per --allow-inline.`);
    console.warn('  This bypass means Stage 7 ran inline (Opus orchestrator wrote tokens directly,');
    console.warn('  did not invoke the frontend-design plugin). Document why in the build prose.');
    process.exit(0);
  }
  console.error('═══════════════════════════════════════════════════════════════════════');
  console.error('  ✗ STAGE 7 GATE FAILED — plugin likely not invoked');
  console.error('═══════════════════════════════════════════════════════════════════════');
  console.error('');
  console.error(msg);
  console.error('');
  console.error('Stage 7d MUST invoke the frontend-design plugin via:');
  console.error('  Skill({ skill: "frontend-design:frontend-design", args: <industry-anchored prompt> })');
  console.error('');
  console.error('The plugin produces:');
  console.error('  - jobs/{domain}/option-c/industry-tokens.json  (RICH — palette with role+rationale per entry, ornament shapes+avoid arrays, distinct_from_option_a, imagery_directive)');
  console.error('  - jobs/{domain}/option-c/aesthetic-brief.md  (≥1500 chars, articulating the design direction + why-this-vs-other-industries reasoning)');
  console.error('  - jobs/{domain}/option-c/src/  (full component set + global.css with theme tokens wired)');
  console.error('');
  console.error('Two ways to resolve:');
  console.error('  1. (preferred) Invoke the plugin properly. See skill-stages/stage-7.md.');
  console.error('  2. (escape hatch) Pass --allow-inline if Stage 7 was deliberately run inline.');
  process.exit(2);
}

if (!fs.existsSync(tokensPath)) softFail(`Missing: ${tokensPath}`);
if (!fs.existsSync(briefPath))  softFail(`Missing: ${briefPath}`);

let tokens;
try { tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8')); }
catch (e) { softFail(`Failed to parse industry-tokens.json: ${e.message}`); }

const briefContent = fs.readFileSync(briefPath, 'utf8');
const briefBytes = briefContent.length;

// Plugin-quality richness checks. Each one independently increments a score;
// the threshold is tuned to catch obvious thin-inline outputs while
// allowing for legitimate variation.
const checks = [];

// 1. industry field present (any string).
checks.push({ name: 'industry field', ok: typeof tokens.industry === 'string' && tokens.industry.length > 0 });

// 2. direction field present (any string ≥ 30 chars — direction sentences are usually descriptive).
checks.push({ name: 'direction field (≥30 chars)', ok: typeof tokens.direction === 'string' && tokens.direction.length >= 30 });

// 3. palette object with ≥ 5 entries (plugin typically writes 7-9; thin inline often 3-4).
const paletteKeys = tokens.palette && typeof tokens.palette === 'object' ? Object.keys(tokens.palette) : [];
checks.push({ name: 'palette ≥ 5 entries', ok: paletteKeys.length >= 5 });

// 4. palette entries have role+rationale strings (plugin signature; thin inline usually just hex).
let paletteWithRole = 0;
for (const k of paletteKeys) {
  const v = tokens.palette[k];
  if (v && typeof v === 'object' && typeof v.role === 'string' && typeof v.rationale === 'string') {
    paletteWithRole++;
  }
}
checks.push({ name: 'palette entries with role+rationale', ok: paletteWithRole >= Math.max(3, Math.floor(paletteKeys.length * 0.6)) });

// 5. typography object with display+text at minimum.
const typo = tokens.typography || {};
checks.push({ name: 'typography.display + .text', ok: typo.display && typo.text });

// 6. ornament.shapes array with ≥ 3 entries.
const ornamentShapes = tokens.ornament && Array.isArray(tokens.ornament.shapes) ? tokens.ornament.shapes : [];
checks.push({ name: 'ornament.shapes ≥ 3 entries', ok: ornamentShapes.length >= 3 });

// 7. ornament.avoid array with ≥ 3 entries (plugin signature — knows what NOT to do).
const ornamentAvoid = tokens.ornament && Array.isArray(tokens.ornament.avoid) ? tokens.ornament.avoid : [];
checks.push({ name: 'ornament.avoid ≥ 3 entries', ok: ornamentAvoid.length >= 3 });

// 8. distinct_from_option_a object — the plugin self-differentiates from A.
checks.push({ name: 'distinct_from_option_a object', ok: tokens.distinct_from_option_a && typeof tokens.distinct_from_option_a === 'object' });

// 9. aesthetic-brief.md size — plugin writes thorough briefs (typically 2-5 KB).
checks.push({ name: 'aesthetic-brief.md ≥ 1500 chars', ok: briefBytes >= 1500 });

// 10. aesthetic-brief.md mentions either "drift" awareness or industry comparison
//     (plugin signature phrases — "wedding-invitation drift", "control-plane drift",
//     "editorial drift", "this is NOT industrial / trades", etc.)
const briefSignatures = /\b(wedding-?invitation drift|control-?plane drift|editorial drift|industrial drift|this is NOT|distinct from)\b/i;
checks.push({ name: 'aesthetic-brief.md has drift-awareness or industry-comparison signal', ok: briefSignatures.test(briefContent) });

const passed = checks.filter(c => c.ok).length;
const total = checks.length;
const ratio = passed / total;

// Threshold: ≥ 70% of checks must pass. Conservative — most plugin outputs pass 9-10/10.
// Inline-thin outputs typically pass 3-5/10.
if (ratio < 0.70) {
  console.error('');
  console.error('═══════════════════════════════════════════════════════════════════════');
  console.error(`  ✗ STAGE 7 GATE FAILED — industry-tokens.json + aesthetic-brief.md`);
  console.error(`     pass only ${passed}/${total} richness checks (need ≥ 70%)`);
  console.error('═══════════════════════════════════════════════════════════════════════');
  for (const c of checks) {
    console.error(`  ${c.ok ? '✓' : '✗'} ${c.name}`);
  }
  console.error('');
  console.error(`industry-tokens.json: ${tokensPath}`);
  console.error(`aesthetic-brief.md:   ${briefPath}  (${briefBytes} chars)`);
  console.error('');
  console.error('This indicates the orchestrator wrote design tokens INLINE rather than');
  console.error('invoking the frontend-design plugin. The plugin\'s signature is rich');
  console.error('multi-entry palette with role+rationale, ornament shapes+avoid arrays,');
  console.error('distinct_from_option_a comparison, and an aesthetic brief that articulates');
  console.error('drift-awareness ("wedding-invitation drift", "control-plane drift",');
  console.error('"this is NOT industrial / trades", etc.).');
  console.error('');
  console.error('Two ways to resolve:');
  console.error('  1. (preferred) Re-invoke the plugin properly:');
  console.error('     Skill({ skill: "frontend-design:frontend-design", args: <prompt> })');
  console.error('     Then re-run this gate.');
  console.error('  2. (escape hatch) Pass --allow-inline if the inline output is intentional');
  console.error('     (rare — almost always the right answer is to use the plugin).');
  process.exit(2);
}

console.log(`✓ Stage 7 plugin gate passed for ${domain} — industry-tokens.json + aesthetic-brief.md richness ${passed}/${total} (${(ratio * 100).toFixed(0)}%) consistent with plugin invocation.`);
for (const c of checks) {
  if (!c.ok) console.log(`  (note: failed ${c.name} — but overall threshold still met)`);
}
process.exit(0);
