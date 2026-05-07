#!/usr/bin/env node
/**
 * validate-pre-deploy.cjs — chokepoint hard gate before Stage 8b
 *
 * Built 2026-05-06 as Phase F.2 after the idahoequinehospital test build
 * exposed the structural failure: orchestrators silently skip QA stages
 * (Stage 4/6/7g visual passes, Stage 4c-tris audit, Stage 7d plugin gate)
 * AND the documented hard gates aren't called. The build deployed without
 * having run any of the gates we'd previously shipped.
 *
 * This script is the single chokepoint that prevents un-QA'd deploys. It
 * runs before Stage 8b's `vercel deploy --prebuilt` and HARD-FAILS if any
 * required pass-event is missing from `jobs/{domain}/orchestration.log`.
 *
 * Phase F.1 made every helper script self-instrument (calls log-decision
 * directly), so the events ARE emitted whenever the script runs. This
 * gate then verifies "did the script actually run?" by checking for the
 * event. If the event is missing, the script wasn't called — which means
 * the orchestrator skipped a quality gate.
 *
 * Required events (default — full A/B/C build):
 *   0/build-started                         — Stage 0 init-metrics ran
 *   1d/images-classified                    — classify-images.cjs ran
 *   2/validate-design-brief-pass            — Stage 2 brief gate passed
 *   2.5b/validate-specs-pass                — Stage 2.5b spec gate passed
 *   2.5c/validate-image-pool-pass           — Stage 2.5c chrome gate passed
 *   4c-bis/visual-pass-verdict (option=a)   — Stage 4c-bis visual pass
 *   6c/visual-pass-verdict (option=b)       — Stage 6c visual pass
 *   7d/validate-stage7-plugin-pass          — Stage 7 plugin gate (skip if --skip-c)
 *   7g/visual-pass-verdict (option=c)       — Stage 7g visual pass (skip if --skip-c)
 *
 * Note on Stage 4c-tris (Dramatic Improvement Audit): not currently
 * required because the script doesn't self-instrument (it's a sub-agent
 * dispatch, not a deterministic script). When that pattern stabilizes,
 * add `4c-tris/dramatic-improvement-audit-verdict` to the required list.
 *
 * --skip-c handling: if jobs/{domain}/option-c/dist/index.html is absent,
 * skip the Stage 7d + 7g requirements automatically. Explicit on-disk
 * state — no CLI flag inheritance needed.
 *
 * Usage:
 *   node scripts/validate-pre-deploy.cjs <domain> [--allow-missing-events]
 *
 * Exit codes:
 *   0 — all required events present; orchestrator may proceed to Stage 8b
 *   1 — bad CLI args
 *   2 — required event missing; deploy MUST be blocked. Report names what's missing.
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
let allowMissing = false;
const positional = [];
for (const a of args) {
  if (a === '--allow-missing-events') { allowMissing = true; continue; }
  positional.push(a);
}
const [domain] = positional;
if (!domain) {
  console.error('Usage: node scripts/validate-pre-deploy.cjs <domain> [--allow-missing-events]');
  process.exit(1);
}

const jobDir = path.join(REPO_ROOT, 'jobs', domain);
const logPath = path.join(jobDir, 'orchestration.log');

if (!fs.existsSync(logPath)) {
  console.error('═══════════════════════════════════════════════════════════════════════');
  console.error(`  ✗ PRE-DEPLOY GATE FAILED — orchestration.log missing`);
  console.error('═══════════════════════════════════════════════════════════════════════');
  console.error('');
  console.error(`Expected: ${logPath}`);
  console.error('');
  console.error('No log means no instrumentation events fired — pipeline ran with zero');
  console.error('audit trail. Either (a) the orchestrator skipped every script that should');
  console.error('self-instrument (Phase F regression), or (b) this domain dir is corrupt.');
  console.error('Either way, deploy MUST be blocked.');
  process.exit(2);
}

// Parse log into a list of events
const events = [];
for (const line of fs.readFileSync(logPath, 'utf8').split('\n')) {
  const t = line.trim();
  if (!t) continue;
  try { events.push(JSON.parse(t)); } catch { /* ignore malformed lines */ }
}

// Check whether option-c was built (determines whether 7d / 7g are required)
const optionCBuilt = fs.existsSync(path.join(jobDir, 'option-c/dist/index.html'));

// Required-event spec: each entry says which event must exist + an
// optional details predicate (e.g., option=a) + skip condition.
const REQUIRED = [
  {
    label: 'Stage 0 build-started',
    match: e => e.stage === '0' && e.event === 'build-started',
  },
  {
    label: 'Stage 1d images-classified',
    match: e => e.stage === '1d' && e.event === 'images-classified',
  },
  {
    label: 'Stage 2 validate-design-brief-pass',
    match: e => e.stage === '2' && e.event === 'validate-design-brief-pass',
  },
  {
    label: 'Stage 2.5b validate-specs-pass',
    match: e => e.stage === '2.5b' && e.event === 'validate-specs-pass',
  },
  {
    label: 'Stage 2.5c validate-image-pool-pass',
    match: e => e.stage === '2.5c' && e.event === 'validate-image-pool-pass',
  },
  {
    label: 'Stage 4c-bis visual-pass-verdict (option=a)',
    match: e => e.stage === '4c-bis' && e.event === 'visual-pass-verdict' && (e.details || {}).option === 'a',
  },
  {
    label: 'Stage 6c visual-pass-verdict (option=b)',
    match: e => e.stage === '6c' && e.event === 'visual-pass-verdict' && (e.details || {}).option === 'b',
  },
  {
    label: 'Stage 7d validate-stage7-plugin-pass',
    match: e => e.stage === '7d' && e.event === 'validate-stage7-plugin-pass',
    skipIf: () => !optionCBuilt,
    skipReason: 'option-c not built (--skip-c mode or C skipped)',
  },
  {
    label: 'Stage 7g visual-pass-verdict (option=c)',
    match: e => e.stage === '7g' && e.event === 'visual-pass-verdict' && (e.details || {}).option === 'c',
    skipIf: () => !optionCBuilt,
    skipReason: 'option-c not built',
  },
];

const results = [];
let missingCount = 0;
for (const req of REQUIRED) {
  if (req.skipIf && req.skipIf()) {
    results.push({ ...req, status: 'skipped', reason: req.skipReason });
    continue;
  }
  const found = events.some(req.match);
  if (found) {
    results.push({ ...req, status: 'pass' });
  } else {
    results.push({ ...req, status: 'fail' });
    missingCount++;
  }
}

console.log('═══════════════════════════════════════════════════════════════════════');
console.log(`  Pre-deploy gate audit for ${domain}`);
console.log(`  ${events.length} log events read; ${REQUIRED.length} required checks`);
console.log('═══════════════════════════════════════════════════════════════════════');
for (const r of results) {
  if (r.status === 'pass')      console.log(`  ✓ ${r.label}`);
  else if (r.status === 'skipped') console.log(`  ⏭️  ${r.label}  (${r.reason})`);
  else                           console.log(`  ✗ ${r.label}  ← MISSING`);
}
console.log('');

// Phase F self-instrumentation: emit a pass/override event so the chokepoint
// gate's own execution is auditable from the log, not just inferred from
// "did the deploys happen?". Without this we can't distinguish (a) gate ran
// and passed from (b) gate was skipped entirely. Both leave deploys to
// proceed if everything else is fine — only the log can tell us which.
const { logDecision } = require('./_log-helper.cjs');

if (missingCount === 0) {
  console.log(`✓ PRE-DEPLOY GATE PASSED — all required events present. Stage 8b deploy may proceed.`);
  logDecision(domain, '8a', 'validate-pre-deploy-pass', {
    eventsRead: events.length,
    requiredChecks: REQUIRED.length,
    skipped: results.filter(r => r.status === 'skipped').length,
    optionCBuilt,
  });
  process.exit(0);
}

if (allowMissing) {
  console.warn(`⚠ ${missingCount} required event(s) missing — proceeding per --allow-missing-events.`);
  console.warn('  Document the override in the build prose. Deploy is at your own risk.');
  logDecision(domain, '8a', 'validate-pre-deploy-override', {
    missingCount,
    missingLabels: results.filter(r => r.status === 'fail').map(r => r.label).join('|'),
    optionCBuilt,
  });
  process.exit(0);
}

console.error('═══════════════════════════════════════════════════════════════════════');
console.error(`  ✗ PRE-DEPLOY GATE FAILED — ${missingCount} required event(s) missing`);
console.error('═══════════════════════════════════════════════════════════════════════');
console.error('');
console.error('Each missing event indicates a quality gate that did NOT run for this build.');
console.error('Possible causes:');
console.error('  - The orchestrator skipped calling the gate script (e.g., `node scripts/validate-X.cjs`)');
console.error('  - The script ran but failed before self-instrumenting (check stderr / build logs)');
console.error('  - The build is being resumed from mid-pipeline and pre-existing events are missing');
console.error('');
console.error('Resolution paths:');
console.error('  1. (preferred) Re-run the missing stages so their scripts emit the required events.');
console.error('     Smart Resume can pick up from the right stage.');
console.error('  2. (escape hatch) Pass --allow-missing-events to override. Use sparingly — this is the');
console.error('     gate that was added specifically because un-QA\'d deploys keep slipping through.');
console.error('');
// Self-instrument the failure case too — even though exit(2) blocks the
// deploy, we still want a log trail showing the gate ran and rejected.
logDecision(domain, '8a', 'validate-pre-deploy-fail', {
  missingCount,
  missingLabels: results.filter(r => r.status === 'fail').map(r => r.label).join('|'),
  optionCBuilt,
});

console.error('See SKILL.md "ORCHESTRATION LOGGING CONTRACT" + Phase F notes.');
process.exit(2);
