#!/usr/bin/env node
/**
 * run-ab-build.cjs — A/B test harness for Phase D cost-tier validation
 *
 * Built 2026-05-05 alongside the rest of Phase D. Compares pipeline
 * outputs across cost-tier presets so the operator can see — with real
 * data — whether the cheaper tier degrades quality.
 *
 * The harness DOES NOT run pipelines itself (orchestrator role). It
 * READS the artifacts of completed builds run under different presets
 * and emits a side-by-side comparison table.
 *
 * Workflow (the --ab flag IS now wired — see SKILL.md Stage 0 prose):
 *   1. Operator runs `/webfactory <url>` once per preset:
 *        /webfactory <url>                  → jobs/{domain}/             (cost-tier=baseline, canonical)
 *        /webfactory <url> --ab=balanced    → jobs/{domain}-ab-balanced/   (cost-tier=balanced)
 *        /webfactory <url> --ab=aggressive  → jobs/{domain}-ab-aggressive/ (cost-tier=aggressive)
 *
 *      The orchestrator at Stage 0 parses --ab=<preset>, sets DOMAIN_SUFFIX
 *      and COST_TIER, calls init-metrics + configure-model + url-to-domain
 *      with the suffix. A/B variants automatically skip Stage 10c
 *      (storefront registration) and Stage 10d (mark-rebuilt) — those are
 *      canonical-only.
 *
 *   2. Operator runs this harness:
 *        node scripts/run-ab-build.cjs <domain> --variants baseline,balanced,aggressive
 *
 *   3. Output: markdown report comparing all gate pass rates, qa-check
 *      failure counts, visual-pass verdicts, brief richness, wallclock,
 *      cost — across the variants.
 *
 * Usage:
 *   node scripts/run-ab-build.cjs <base-domain> --variants <comma-list>
 *
 * Exit code: 0 always — this is observation, not a gate.
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const JOBS_DIR = path.join(REPO_ROOT, 'jobs');

const args = process.argv.slice(2);
let baseDomain = null;
let variants = ['baseline', 'balanced', 'aggressive'];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--variants' && args[i + 1]) {
    variants = args[++i].split(',').map(v => v.trim()).filter(Boolean);
    continue;
  }
  if (!args[i].startsWith('--') && !baseDomain) baseDomain = args[i];
}

if (!baseDomain) {
  console.error('Usage: node scripts/run-ab-build.cjs <base-domain> [--variants baseline,balanced,aggressive,opus-everywhere]');
  process.exit(1);
}

function jobDirFor(variant) {
  return variant === 'baseline'
    ? path.join(JOBS_DIR, baseDomain)
    : path.join(JOBS_DIR, `${baseDomain}-ab-${variant}`);
}

function readJsonSafe(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

function loadVariant(variant) {
  const dir = jobDirFor(variant);
  if (!fs.existsSync(dir)) {
    return { variant, dir, present: false };
  }
  const result = { variant, dir, present: true };

  const metrics = readJsonSafe(path.join(dir, 'metrics.json'));
  result.wallclockMin = metrics?.totalMinutes ?? null;

  // Run audit-cost to get cost estimate
  const costProbe = spawnSync('node', [path.join(REPO_ROOT, 'scripts/audit-cost.cjs'), variant === 'baseline' ? baseDomain : `${baseDomain}-ab-${variant}`], { encoding: 'utf8' });
  const costMatch = (costProbe.stdout || '').match(/\*\*\$([0-9.]+)\*\*/);
  result.cost = costMatch ? Number(costMatch[1]) : null;

  // Brief richness
  const briefGate = spawnSync('node', [path.join(REPO_ROOT, 'scripts/validate-design-brief.cjs'), variant === 'baseline' ? baseDomain : `${baseDomain}-ab-${variant}`], { encoding: 'utf8' });
  const richnessMatch = (briefGate.stdout + briefGate.stderr).match(/(\d+)\/(\d+)/);
  result.briefRichness = richnessMatch ? `${richnessMatch[1]}/${richnessMatch[2]}` : '—';
  result.briefGate = briefGate.status === 0 ? 'pass' : 'fail';

  // Stage 7 plugin gate
  const pluginGate = spawnSync('node', [path.join(REPO_ROOT, 'scripts/validate-stage7-plugin.cjs'), variant === 'baseline' ? baseDomain : `${baseDomain}-ab-${variant}`], { encoding: 'utf8' });
  const pluginMatch = (pluginGate.stdout + pluginGate.stderr).match(/richness\s+(\d+\/\d+)/);
  result.pluginRichness = pluginMatch ? pluginMatch[1] : '—';
  result.pluginGate = pluginGate.status === 0 ? 'pass' : 'fail';

  // Image-pool gate
  const poolGate = spawnSync('node', [path.join(REPO_ROOT, 'scripts/validate-image-pool.cjs'), variant === 'baseline' ? baseDomain : `${baseDomain}-ab-${variant}`], { encoding: 'utf8' });
  result.poolGate = poolGate.status === 0 ? 'pass' : 'fail';

  // Visual-pass verdicts
  for (const opt of ['a', 'b', 'c']) {
    const verdictPath = path.join(dir, `qa-option-${opt}`, 'visual-pass-verdict.json');
    const v = readJsonSafe(verdictPath);
    result[`visualPass${opt.toUpperCase()}`] = v?.verdict || '—';
    result[`visualPass${opt.toUpperCase()}_items`] = v ? `${v.items_passed}/${v.items_checked}` : '—';
  }

  // qa-check failure counts (from qa-check-report.json if present)
  for (const opt of ['a', 'b', 'c']) {
    const qaReport = readJsonSafe(path.join(dir, `qa-option-${opt}`, 'qa-check-report.json'));
    if (qaReport && Array.isArray(qaReport.issues)) {
      result[`qaFails${opt.toUpperCase()}`] = qaReport.issues.filter(i => i.severity === 'fail').length;
    } else {
      result[`qaFails${opt.toUpperCase()}`] = '—';
    }
  }

  // Final deploy URLs (presence)
  for (const opt of ['a', 'b', 'c']) {
    const url = metrics?.[`option${opt.toUpperCase()}`]?.url;
    result[`deploy${opt.toUpperCase()}`] = url ? '✓' : '—';
  }

  // Cost-tier configured
  result.costTier = metrics?.costTier || baseDomain === path.basename(dir) ? '?' : variant;

  return result;
}

const rows = variants.map(loadVariant);

console.log(`# A/B build comparison — ${baseDomain}`);
console.log('');
console.log(`Generated: ${new Date().toISOString()}`);
console.log(`Variants compared: ${variants.join(', ')}`);
console.log('');

// Variants present
const present = rows.filter(r => r.present);
const absent = rows.filter(r => !r.present);
if (absent.length > 0) {
  console.log(`⚠ ${absent.length} variant(s) not yet built: ${absent.map(r => r.variant).join(', ')}`);
  console.log('  Run /webfactory <url> --ab=<variant> for each missing variant before re-running this harness.');
  console.log('');
}

if (present.length === 0) {
  console.log('No variants present yet. Cannot compare.');
  process.exit(0);
}

console.log('## Quality (gates + verdicts)');
console.log('');
console.log('| Variant | Cost-tier | Brief | Plugin | Pool | A 4c-bis | A items | B 6c | B items | C 7g | C items | A qa fails | B qa fails | C qa fails |');
console.log('|---' + '|---'.repeat(13) + '|');
for (const r of present) {
  console.log(`| ${r.variant} | ${r.costTier} | ${r.briefRichness} (${r.briefGate}) | ${r.pluginRichness} (${r.pluginGate}) | ${r.poolGate} | ${r.visualPassA} | ${r.visualPassA_items} | ${r.visualPassB} | ${r.visualPassB_items} | ${r.visualPassC} | ${r.visualPassC_items} | ${r.qaFailsA} | ${r.qaFailsB} | ${r.qaFailsC} |`);
}
console.log('');

console.log('## Cost + wallclock');
console.log('');
console.log('| Variant | Wallclock (min) | Approx cost | Deploys (A / B / C) |');
console.log('|---|---|---|---|');
for (const r of present) {
  const deploys = `${r.deployA} / ${r.deployB} / ${r.deployC}`;
  const cost = r.cost != null ? `$${r.cost.toFixed(2)}` : '—';
  console.log(`| ${r.variant} | ${r.wallclockMin ?? '—'} | ${cost} | ${deploys} |`);
}
console.log('');

// Verdict
const baseline = present.find(r => r.variant === 'baseline');
if (baseline && present.length > 1) {
  console.log('## Cost vs baseline');
  console.log('');
  for (const r of present) {
    if (r.variant === 'baseline') continue;
    if (r.cost != null && baseline.cost != null && baseline.cost > 0) {
      const pct = Math.round((r.cost / baseline.cost) * 100);
      const cut = Math.round((1 - r.cost / baseline.cost) * 100);
      console.log(`- **${r.variant}**: ${pct}% of baseline cost (${cut > 0 ? cut + '% cut' : Math.abs(cut) + '% MORE'})`);
    }
  }
  console.log('');
}

console.log('---');
console.log('Quality interpretation: visual-pass verdicts (`pass` / `fix` / `rebuild`) and qa-fail counts are the ground-truth quality signals. If a cheaper variant shows ≥ 1 verdict regression OR > 50% more qa-fails than baseline, the cost-tier degraded quality.');
process.exit(0);
