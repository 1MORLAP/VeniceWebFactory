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

// Phase F.6 (2026-05-07): Count expected per-page dispatches by reading
// jobs/<domain>/specs/. The orchestrator should dispatch N parallel
// sub-agents at Stages 3 / 5 / 7d-build (one per spec). Sometimes the
// orchestrator goes monolithic instead (single sub-agent for all pages,
// or no per-page events at all). The chokepoint must catch this so the
// audit-trail-of-decomposition is reliable.
//
// Real bug 2026-05-07 (lisastephens G.1-fix): Stage 3, 5, and 7d-build
// each emitted ZERO per-page dispatch events. The orchestrator built
// the pages monolithically, deploys still happened, but the audit
// showed silent monolithic regression. This rule prevents that.
//
// We match per-page dispatch by `option=` AND `page=<slug>` (NOT
// `page=all` or `page=all-monolithic-subagent` or `page=batch` — those
// are the monolithic-fallback labels we want to flag).
const specsDir = path.join(jobDir, 'specs');
let expectedPageCount = 0;
if (fs.existsSync(specsDir)) {
  const specFiles = fs.readdirSync(specsDir).filter(f =>
    f.endsWith('.md') && !f.startsWith('_')
  );
  expectedPageCount = specFiles.length;
}

function countPerPageDispatches(events, stage, option) {
  // Match events that have a real page slug — exclude the monolithic
  // fallback labels.
  const MONOLITHIC_LABELS = new Set(['all', 'all-monolithic-subagent', 'all-pages-rewrite', 'batch']);
  const seen = new Set();
  for (const e of events) {
    if (e.stage !== stage || e.event !== 'sub-agent-dispatched') continue;
    const d = e.details || {};
    if (d.option !== option) continue;
    if (!d.page || MONOLITHIC_LABELS.has(d.page)) continue;
    seen.add(d.page);
  }
  return seen.size;
}

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
    label: 'Stage 3 per-page sub-agent dispatch (option=a, decomposed)',
    skipIf: () => expectedPageCount === 0,
    skipReason: 'no specs/ — monolithic mode or build never reached Stage 2.5',
    customCheck: events => {
      const got = countPerPageDispatches(events, '3', 'a');
      return {
        pass: got >= expectedPageCount,
        message: `dispatched ${got}/${expectedPageCount} pages (Phase F.6 decomposed-mode requirement)`,
      };
    },
  },
  {
    label: 'Stage 5 per-page sub-agent dispatch (option=b, decomposed)',
    skipIf: () => expectedPageCount === 0,
    skipReason: 'no specs/ — monolithic mode',
    customCheck: events => {
      const got = countPerPageDispatches(events, '5', 'b');
      return {
        pass: got >= expectedPageCount,
        message: `dispatched ${got}/${expectedPageCount} pages (Phase F.6 decomposed-mode requirement)`,
      };
    },
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
    label: 'Stage 7d-build per-page sub-agent dispatch (option=c, decomposed)',
    skipIf: () => !optionCBuilt || expectedPageCount === 0,
    skipReason: 'option-c not built or no specs/',
    customCheck: events => {
      // Stage 7d-build dispatches use stage="7d-build" OR "7d" depending on
      // whether the orchestrator emits with the build stage suffix. Accept either.
      const got = Math.max(
        countPerPageDispatches(events, '7d-build', 'c'),
        countPerPageDispatches(events, '7d', 'c'),
      );
      return {
        pass: got >= expectedPageCount,
        message: `dispatched ${got}/${expectedPageCount} pages (Phase F.6 decomposed-mode requirement)`,
      };
    },
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
  // Two check modes:
  //   - `match`: predicate that returns true if at least one event matches
  //   - `customCheck`: returns { pass, message } — used for count-based checks
  let pass, message;
  if (req.customCheck) {
    const r = req.customCheck(events);
    pass = r.pass;
    message = r.message;
  } else {
    pass = events.some(req.match);
  }
  if (pass) {
    results.push({ ...req, status: 'pass', message });
  } else {
    results.push({ ...req, status: 'fail', message });
    missingCount++;
  }
}

console.log('═══════════════════════════════════════════════════════════════════════');
console.log(`  Pre-deploy gate audit for ${domain}`);
console.log(`  ${events.length} log events read; ${REQUIRED.length} required checks`);
console.log('═══════════════════════════════════════════════════════════════════════');
for (const r of results) {
  const detail = r.message ? `  [${r.message}]` : '';
  if (r.status === 'pass')      console.log(`  ✓ ${r.label}${detail}`);
  else if (r.status === 'skipped') console.log(`  ⏭️  ${r.label}  (${r.reason})`);
  else                           console.log(`  ✗ ${r.label}${detail}  ← MISSING`);
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
