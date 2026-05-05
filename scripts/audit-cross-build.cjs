#!/usr/bin/env node
/**
 * audit-cross-build.cjs — quantify drift across every build under jobs/
 *
 * Built 2026-05-04 to answer the "Claude Design 0%" dashboard question:
 * how many existing builds actually invoked the frontend-design plugin at
 * Stage 7d vs went inline? Without the per-build orchestration log
 * (Phase 2 instrumentation only just shipped), the only retroactive
 * signal is the richness of `option-c/industry-tokens.json` +
 * `option-c/aesthetic-brief.md` — exactly what `validate-stage7-plugin.cjs`
 * fingerprints.
 *
 * The script also rolls up image-classification numbers across builds so
 * the operator can spot patterns: "is chrome contamination a 90s-CMS
 * problem only, or does it leak on modern WordPress sites too?"
 *
 * Outputs a markdown report to stdout. Three tables:
 *   1. Stage 7 plugin invocation per build (pass / warn / fail / no-C)
 *   2. Image classification ratios per build (content% vs chrome%)
 *   3. Aggregate stats (overall plugin-invocation rate, chrome-rate
 *      median, builds with critical chrome contamination)
 *
 * Usage:
 *   node scripts/audit-cross-build.cjs              # full report to stdout
 *   node scripts/audit-cross-build.cjs --csv        # bonus CSV after markdown
 *   node scripts/audit-cross-build.cjs --json       # machine-readable JSON
 *
 * Exit code: 0 always — this is data, not a pass/fail gate.
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const JOBS_DIR = path.join(REPO_ROOT, 'jobs');

const args = process.argv.slice(2);
const wantCsv = args.includes('--csv');
const wantJson = args.includes('--json');

if (!fs.existsSync(JOBS_DIR)) {
  console.error(`✗ jobs directory not found: ${JOBS_DIR}`);
  process.exit(1);
}

const domains = fs.readdirSync(JOBS_DIR, { withFileTypes: true })
  .filter(e => e.isDirectory() && !e.name.startsWith('.'))
  .map(e => e.name)
  .sort();

const results = [];

for (const domain of domains) {
  const jobDir = path.join(JOBS_DIR, domain);
  const result = {
    domain,
    hasManifest: fs.existsSync(path.join(jobDir, 'manifest.json')),
    hasOptionA: fs.existsSync(path.join(jobDir, 'option-a/dist/index.html')),
    hasOptionB: fs.existsSync(path.join(jobDir, 'option-b/dist/index.html')),
    hasOptionC: fs.existsSync(path.join(jobDir, 'option-c/dist/index.html')),
    hasIndustryTokens: fs.existsSync(path.join(jobDir, 'option-c/industry-tokens.json')),
    plugin: null,        // 'pass' | 'fail' | 'no-c' | 'no-tokens'
    pluginRichness: null,
    chromeRatio: null,
    classification: null,
    storeRegistered: fs.existsSync(path.join(jobDir, 'store-registration.json')),
  };

  // Run validate-stage7-plugin if option-c exists.
  if (result.hasIndustryTokens) {
    const probe = spawnSync('node', [path.join(REPO_ROOT, 'scripts/validate-stage7-plugin.cjs'), domain], { encoding: 'utf8' });
    const out = (probe.stdout || '') + (probe.stderr || '');
    const m = out.match(/(\d+)\/(\d+)\s+richness/) || out.match(/richness\s+(\d+)\/(\d+)/);
    if (m) result.pluginRichness = `${m[1]}/${m[2]}`;
    result.plugin = probe.status === 0 ? 'pass' : 'fail';
  } else if (result.hasOptionC) {
    result.plugin = 'no-tokens';   // dist exists but no industry-tokens.json
  } else {
    result.plugin = 'no-c';
  }

  // Read classification report if present.
  const classifyPath = path.join(jobDir, 'image-classification.json');
  if (fs.existsSync(classifyPath)) {
    try {
      const c = JSON.parse(fs.readFileSync(classifyPath, 'utf8'));
      result.classification = c;
      const chromeCount = c.totalImages - (c.counts.content || 0);
      result.chromeRatio = c.totalImages > 0 ? chromeCount / c.totalImages : 0;
    } catch { /* swallow */ }
  }

  results.push(result);
}

// ─────────────────────────────────────────────────────────────────────
// Render report.
// ─────────────────────────────────────────────────────────────────────

if (wantJson) {
  console.log(JSON.stringify({ generated: new Date().toISOString(), results }, null, 2));
  process.exit(0);
}

console.log('# WebFactory cross-build audit');
console.log('');
console.log(`Generated: ${new Date().toISOString()}`);
console.log(`Total builds inspected: ${results.length}`);
console.log('');

// Table 1: Stage 7 plugin invocation
console.log('## Stage 7 plugin invocation per build');
console.log('');
console.log('Fingerprint via `validate-stage7-plugin.cjs` (richness ≥ 70% = plugin likely invoked).');
console.log('');
console.log('| Domain | A | B | C | Plugin | Richness |');
console.log('|---|---|---|---|---|---|');
const cBuildsCount = results.filter(r => r.hasOptionC).length;
for (const r of results) {
  const a = r.hasOptionA ? '✓' : '·';
  const b = r.hasOptionB ? '✓' : '·';
  const c = r.hasOptionC ? '✓' : '·';
  let pluginCol;
  switch (r.plugin) {
    case 'pass':      pluginCol = '✅ plugin';     break;
    case 'fail':      pluginCol = '❌ inline?';    break;
    case 'no-tokens': pluginCol = '⚠ no-tokens';   break;
    case 'no-c':      pluginCol = '— (no C)';      break;
    default:          pluginCol = '?';
  }
  console.log(`| ${r.domain} | ${a} | ${b} | ${c} | ${pluginCol} | ${r.pluginRichness || '—'} |`);
}
console.log('');

// Aggregate plugin stats
const pluginPass = results.filter(r => r.plugin === 'pass').length;
const pluginFail = results.filter(r => r.plugin === 'fail').length;
const pluginNoTokens = results.filter(r => r.plugin === 'no-tokens').length;
const cTotal = results.filter(r => r.hasOptionC || r.hasIndustryTokens).length;

console.log(`### Plugin-invocation summary (${cTotal} builds with Option C):`);
console.log('');
console.log(`- ✅ **${pluginPass} (${cTotal > 0 ? Math.round(pluginPass/cTotal*100) : 0}%)** — plugin fingerprint detected (richness ≥ 70%)`);
console.log(`- ❌ **${pluginFail} (${cTotal > 0 ? Math.round(pluginFail/cTotal*100) : 0}%)** — fingerprint failed (likely inline orchestrator at Stage 7d)`);
console.log(`- ⚠ **${pluginNoTokens}** — option-c/dist exists but no industry-tokens.json (older builds pre-2026-04-26)`);
console.log('');
if (pluginFail > 0) {
  console.log(`**${pluginFail} builds with likely Stage 7d plugin bypass.** This is the "Claude Design 0%" gap quantified — these builds shipped Option C without the frontend-design plugin's industry-anchored design system. Going forward, \`validate-stage7-plugin.cjs\` (added 2026-05-04 to Stage 7d) will block this regression at gate time.`);
  console.log('');
}

// Table 2: image classification per build
console.log('## Image classification per build');
console.log('');
console.log('Image-pool chrome contamination — % of scraped images classified as non-content. High chrome% indicates a 90s/2000s-era CMS site where the `portfolio-integrity` qa-check rule is most necessary.');
console.log('');
console.log('| Domain | Total | Content | Chrome% | nav-button | banner | line | spacer | tracking | tiny |');
console.log('|---|---|---|---|---|---|---|---|---|---|');
for (const r of results) {
  if (!r.classification) {
    console.log(`| ${r.domain} | — | — | — | — | — | — | — | — | — |`);
    continue;
  }
  const c = r.classification;
  const cn = c.counts;
  const chromePct = c.totalImages > 0 ? Math.round((c.totalImages - (cn.content || 0)) / c.totalImages * 100) : 0;
  console.log(`| ${r.domain} | ${c.totalImages} | ${cn.content || 0} | ${chromePct}% | ${cn['nav-button'] || 0} | ${cn.banner || 0} | ${cn.line || 0} | ${cn.spacer || 0} | ${cn.tracking || 0} | ${cn.tiny || 0} |`);
}
console.log('');

// Aggregate chrome stats
const withClass = results.filter(r => r.classification);
if (withClass.length > 0) {
  const ratios = withClass.map(r => r.chromeRatio).sort((a, b) => a - b);
  const median = ratios[Math.floor(ratios.length / 2)];
  const high = withClass.filter(r => r.chromeRatio > 0.30);
  console.log(`### Chrome-contamination summary (${withClass.length} builds with classification):`);
  console.log('');
  console.log(`- Median chrome ratio: **${Math.round(median * 100)}%**`);
  console.log(`- Builds with > 30% chrome (high contamination — portfolio-integrity rule essential): **${high.length}** (${Math.round(high.length/withClass.length*100)}%)`);
  if (high.length > 0) {
    console.log(`  ${high.slice(0, 8).map(r => `\`${r.domain}\` (${Math.round(r.chromeRatio*100)}%)`).join(', ')}${high.length > 8 ? ` and ${high.length-8} more` : ''}`);
  }
  console.log('');
}

// Bonus CSV output
if (wantCsv) {
  console.log('## Raw CSV');
  console.log('');
  console.log('```csv');
  console.log('domain,hasA,hasB,hasC,plugin,richness,total,content,chromePct,storeRegistered');
  for (const r of results) {
    const c = r.classification;
    const total = c?.totalImages || 0;
    const content = c?.counts?.content || 0;
    const chromePct = total > 0 ? Math.round((total - content) / total * 100) : 0;
    console.log([r.domain, r.hasOptionA?1:0, r.hasOptionB?1:0, r.hasOptionC?1:0, r.plugin || '', r.pluginRichness || '', total, content, chromePct + '%', r.storeRegistered?1:0].join(','));
  }
  console.log('```');
  console.log('');
}

console.log('---');
console.log('Run `node scripts/audit-orchestration.cjs <domain>` for per-build drift detail.');
process.exit(0);
