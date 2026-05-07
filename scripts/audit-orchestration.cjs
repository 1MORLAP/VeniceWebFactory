#!/usr/bin/env node
/**
 * audit-orchestration.cjs — drift report comparing prescribed vs actual orchestration
 *
 * Built 2026-05-04 to close the "what did the orchestrator actually do?"
 * gap. Reads `jobs/{domain}/orchestration.log` (JSON Lines, written by
 * `scripts/log-decision.cjs` at 17 instrumentation points across the
 * pipeline — see "ORCHESTRATION LOGGING CONTRACT" in SKILL.md) AND the
 * on-disk artifacts (manifest.json, specs/, option-{a|b|c}/dist/, etc.),
 * then prints a markdown drift report:
 *
 *   PRESCRIBED  ✓ logged  ✓ on-disk     [in agreement]
 *   PRESCRIBED  ✗ logged  ✓ on-disk     [silent bypass — orchestrator did the work but didn't log it]
 *   PRESCRIBED  ✓ logged  ✗ on-disk     [orphan log — orchestrator logged but the artifact is missing]
 *   PRESCRIBED  ✗ logged  ✗ on-disk     [stage skipped entirely — possible bypass, possible legitimate]
 *
 * The skill-owner uses this to spot regressions like:
 *   - Stage 7d plugin-invoked log missing while industry-tokens.json exists
 *     (orchestrator either skipped instrumentation OR ran inline)
 *   - sub-agent-dispatched count for Stage 3 doesn't match specs/ count
 *     (some pages went monolithic silently)
 *   - visual-pass-verdict missing from log AND from disk
 *     (Stage 4c-bis/6c/7g-h was bypassed inline — same regression class
 *     that prompted validate-visual-pass.cjs)
 *
 * Usage:
 *   node scripts/audit-orchestration.cjs <domain>
 *
 * Output: markdown report to stdout. No exit on drift — drift is the data,
 * not an error condition. Exit 1 only on bad CLI args / missing job dir.
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');

const domain = process.argv[2];
if (!domain) {
  console.error('Usage: node scripts/audit-orchestration.cjs <domain>');
  process.exit(1);
}

const jobDir = path.join(REPO_ROOT, 'jobs', domain);
if (!fs.existsSync(jobDir)) {
  console.error(`✗ Job directory not found: ${jobDir}`);
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────
// Load orchestration log (JSON Lines).
// ─────────────────────────────────────────────────────────────────────

const logPath = path.join(jobDir, 'orchestration.log');
const events = [];
if (fs.existsSync(logPath)) {
  const lines = fs.readFileSync(logPath, 'utf8').split('\n').filter(l => l.trim());
  for (const line of lines) {
    try {
      events.push(JSON.parse(line));
    } catch (e) {
      events.push({ _parseError: e.message, _raw: line.slice(0, 80) });
    }
  }
}

const eventsByEvent = new Map();
for (const e of events) {
  if (e.event) {
    if (!eventsByEvent.has(e.event)) eventsByEvent.set(e.event, []);
    eventsByEvent.get(e.event).push(e);
  }
}

// ─────────────────────────────────────────────────────────────────────
// Inspect on-disk artifacts.
// ─────────────────────────────────────────────────────────────────────

function exists(rel) { return fs.existsSync(path.join(jobDir, rel)); }
function readJson(rel) {
  try { return JSON.parse(fs.readFileSync(path.join(jobDir, rel), 'utf8')); }
  catch { return null; }
}
function listDir(rel) {
  try { return fs.readdirSync(path.join(jobDir, rel)); }
  catch { return []; }
}

const artifacts = {
  manifest: exists('manifest.json'),
  classification: exists('image-classification.json'),
  designBrief: exists('design-brief.json'),
  specs: listDir('specs').filter(f => f.endsWith('.md') && !f.startsWith('_')),
  optionADist: exists('option-a/dist/index.html'),
  optionBDist: exists('option-b/dist/index.html'),
  optionCDist: exists('option-c/dist/index.html'),
  industryTokens: readJson('option-c/industry-tokens.json'),
  aestheticBrief: exists('option-c/aesthetic-brief.md'),
  visualVerdictA: exists('qa-option-a/visual-pass-verdict.json'),
  visualVerdictB: exists('qa-option-b/visual-pass-verdict.json'),
  visualVerdictC: exists('qa-option-c/visual-pass-verdict.json'),
  metrics: readJson('metrics.json'),
  storeRegistration: exists('store-registration.json'),
};

// ─────────────────────────────────────────────────────────────────────
// Drift checks.
// ─────────────────────────────────────────────────────────────────────

function check(label, prescribed, logged, onDisk, note) {
  const status = logged === onDisk ? '✓' : '⚠';
  const loggedTag = logged ? '✓ logged' : '✗ logged';
  const diskTag = onDisk ? '✓ on-disk' : '✗ on-disk';
  return `| ${status} | ${label} | ${prescribed ? 'YES' : 'no'} | ${loggedTag} | ${diskTag} | ${note || ''} |`;
}

const rows = [];

// Stage 0: Smart Resume
rows.push(check(
  'Stage 0: smart-resume-report',
  true,
  eventsByEvent.has('smart-resume-report'),
  true,   // artifacts always exist; the question is whether the orchestrator logged the resume decision
  artifacts.metrics ? `runStartedAt=${artifacts.metrics.runStartedAt || '?'}` : ''
));

// Stage 1d: Image classification
rows.push(check(
  'Stage 1d: images-classified',
  true,
  eventsByEvent.has('images-classified'),
  artifacts.classification,
  artifacts.classification ? '' : 'image-classification.json missing — classify-images.cjs may not have run'
));

// Stage 2.5: spec mode
const modeEvents = eventsByEvent.get('mode-chosen') || [];
const specsExist = artifacts.specs.length > 0;
rows.push(check(
  'Stage 2.5: mode-chosen',
  true,
  modeEvents.length > 0,
  specsExist,
  modeEvents.length > 0 ? `mode=${modeEvents[0].details?.mode}` : (specsExist ? 'specs/ has files but no mode-chosen log — silent decomposed?' : 'no specs/ — monolithic mode')
));

// Stage 3: sub-agent-dispatched for option=a
const dispatchA = (eventsByEvent.get('sub-agent-dispatched') || []).filter(e => e.details?.option === 'a');
rows.push(check(
  'Stage 3: sub-agent-dispatched (Option A, per page)',
  true,
  dispatchA.length > 0,
  artifacts.optionADist,
  artifacts.specs.length > 0 && dispatchA.length === 0 ? `specs/ has ${artifacts.specs.length} pages but ZERO Stage 3 dispatch logs — silent monolithic` : (dispatchA.length > 0 ? `dispatched ${dispatchA.length}/${artifacts.specs.length}` : '')
));

// Stage 4c-bis: visual-pass for A
const visualPassA = (eventsByEvent.get('visual-pass-verdict') || []).filter(e => e.details?.option === 'a');
rows.push(check(
  'Stage 4c-bis: visual-pass-verdict (Option A)',
  true,
  visualPassA.length > 0,
  artifacts.visualVerdictA,
  visualPassA.length > 0 ? `verdict=${visualPassA[0].details?.verdict}` : (artifacts.optionADist ? 'A built but no visual-pass evidence (logged or on-disk) — Tier 2 bypass' : '')
));

// Stage 5: sub-agent-dispatched for option=b
const dispatchB = (eventsByEvent.get('sub-agent-dispatched') || []).filter(e => e.details?.option === 'b');
rows.push(check(
  'Stage 5: sub-agent-dispatched (Option B, per page)',
  true,
  dispatchB.length > 0,
  artifacts.optionBDist,
  artifacts.optionBDist && dispatchB.length === 0 ? `B built but ZERO Stage 5 dispatch logs — silent monolithic` : ''
));

// Stage 6c: visual-pass for B
const visualPassB = (eventsByEvent.get('visual-pass-verdict') || []).filter(e => e.details?.option === 'b');
rows.push(check(
  'Stage 6c: visual-pass-verdict (Option B)',
  true,
  visualPassB.length > 0,
  artifacts.visualVerdictB,
  visualPassB.length > 0 ? `verdict=${visualPassB[0].details?.verdict}` : ''
));

// Stage 7d: plugin-invoked
const plugin = eventsByEvent.get('plugin-invoked') || [];
const tokensRich = artifacts.industryTokens && artifacts.industryTokens.palette && Object.keys(artifacts.industryTokens.palette).length >= 5;
rows.push(check(
  'Stage 7d: plugin-invoked',
  true,
  plugin.length > 0,
  tokensRich,
  plugin.length > 0 ? `industry=${plugin[0].details?.industry || '?'}` : (tokensRich ? 'industry-tokens.json is rich but no plugin-invoked log — instrumentation bypass OR inline-thorough orchestrator' : 'no industry-tokens.json — Stage 7 skipped or --skip-c')
));

// Stage 7d-build: sub-agent-dispatched for option=c
const dispatchC = (eventsByEvent.get('sub-agent-dispatched') || []).filter(e => e.details?.option === 'c');
rows.push(check(
  'Stage 7d-build: sub-agent-dispatched (Option C, per page)',
  true,
  dispatchC.length > 0,
  artifacts.optionCDist,
  artifacts.optionCDist && dispatchC.length === 0 ? `C built but ZERO Stage 7d-build dispatch logs` : ''
));

// Stage 7g/h: visual-pass for C
const visualPassC = (eventsByEvent.get('visual-pass-verdict') || []).filter(e => e.details?.option === 'c');
rows.push(check(
  'Stage 7g/h: visual-pass-verdict (Option C)',
  true,
  visualPassC.length > 0,
  artifacts.visualVerdictC,
  visualPassC.length > 0 ? `verdict=${visualPassC[0].details?.verdict}` : ''
));

// Stage 8a: validate-pre-deploy gate ran. Three possible events emitted by
// the gate self-instrumentation (Phase F.2): pass / override / fail. Any of
// them proves the chokepoint executed. Absence means the deploy bypassed
// the gate entirely — the failure mode the gate exists to prevent. There's
// no on-disk artifact for this check (the gate's effect is "did the deploys
// happen?"); we treat metrics.optionA.url's presence as a coarse proxy.
const preDeployPass     = eventsByEvent.get('validate-pre-deploy-pass')     || [];
const preDeployOverride = eventsByEvent.get('validate-pre-deploy-override') || [];
const preDeployFail     = eventsByEvent.get('validate-pre-deploy-fail')     || [];
const preDeployRan = preDeployPass.length + preDeployOverride.length + preDeployFail.length > 0;
const preDeployVerdict = preDeployPass.length     ? 'pass'
                       : preDeployOverride.length ? 'override'
                       : preDeployFail.length     ? 'fail'
                       : '(gate did not run)';
rows.push(check(
  'Stage 8a: validate-pre-deploy ran',
  true,
  preDeployRan,
  !!artifacts.metrics?.optionA?.url || !!artifacts.metrics?.optionB?.url,
  `verdict=${preDeployVerdict}`
));

// Stage 8b: deploy-recorded per option
const deployA = (eventsByEvent.get('deploy-recorded') || []).filter(e => e.details?.option === 'a');
const deployB = (eventsByEvent.get('deploy-recorded') || []).filter(e => e.details?.option === 'b');
const deployC = (eventsByEvent.get('deploy-recorded') || []).filter(e => e.details?.option === 'c');
const urlA = artifacts.metrics?.optionA?.url;
const urlB = artifacts.metrics?.optionB?.url;
const urlC = artifacts.metrics?.optionC?.url;
rows.push(check(
  'Stage 8b: deploy-recorded (A)', true, deployA.length > 0, !!urlA,
  urlA ? `url=${urlA}` : ''
));
rows.push(check(
  'Stage 8b: deploy-recorded (B)', true, deployB.length > 0, !!urlB,
  urlB ? `url=${urlB}` : ''
));
rows.push(check(
  'Stage 8b: deploy-recorded (C)', true, deployC.length > 0, !!urlC,
  urlC ? `url=${urlC}` : ''
));

// Stage 10c: storefront-registered
const storeReg = eventsByEvent.get('storefront-registered') || [];
rows.push(check(
  'Stage 10c: storefront-registered',
  true,
  storeReg.length > 0,
  artifacts.storeRegistration,
  storeReg.length > 0 ? `slug=${storeReg[0].details?.slug || '?'}` : ''
));

// ─────────────────────────────────────────────────────────────────────
// Emit markdown report.
// ─────────────────────────────────────────────────────────────────────

const driftCount = rows.filter(r => r.startsWith('| ⚠')).length;
const totalCount = rows.length;

console.log(`# Orchestration audit — ${domain}`);
console.log('');
console.log(`Generated: ${new Date().toISOString()}`);
console.log(`Log entries: ${events.length}`);
console.log(`Drift checks: ${totalCount - driftCount} agreement, ${driftCount} drift`);
console.log('');

if (events.length === 0) {
  console.log('⚠ **No orchestration.log file found** at `jobs/' + domain + '/orchestration.log`.');
  console.log('');
  console.log('This means the orchestrator never called `scripts/log-decision.cjs` for this build.');
  console.log('Either the build pre-dates the logging contract (2026-05-04) or the orchestrator skipped instrumentation.');
  console.log('All "logged" columns below will show ✗.');
  console.log('');
}

console.log('| | Stage / Event | Prescribed | Logged | On-disk | Notes |');
console.log('|---|---|---|---|---|---|');
for (const r of rows) console.log(r);
console.log('');

if (driftCount > 0) {
  console.log(`## Drift summary`);
  console.log('');
  console.log(`${driftCount} of ${totalCount} checks show drift (logged ≠ on-disk OR neither). Common drift patterns:`);
  console.log('');
  console.log('- **`✗ logged ✓ on-disk`** — orchestrator did the work but didn\'t emit the log entry. Common during Phase 2 rollout (instrumentation not yet wired into every stage). Resolution: wire the missing `node scripts/log-decision.cjs` calls into the relevant stage prose.');
  console.log('- **`✓ logged ✗ on-disk`** — orchestrator logged the event but the artifact is missing. Indicates either a downstream step removed the artifact OR the log was emitted prematurely (before the work completed). Investigate which.');
  console.log('- **`✗ logged ✗ on-disk`** — neither logged nor on-disk. Could be (a) the stage was deliberately skipped (e.g., --skip-c), (b) the build halted before reaching that stage, or (c) silent bypass of a mandatory stage. Cross-reference the metrics.json `stages` map to disambiguate.');
  console.log('');
}

console.log('---');
console.log('See `SKILL.md` "ORCHESTRATION LOGGING CONTRACT" for the full instrumentation point list.');
process.exit(0);
