#!/usr/bin/env node
/**
 * validate-fix-loop-classification.cjs — gate for fix-loop bug classification
 *
 * Built 2026-05-05 as Phase D infrastructure. Enables Sonnet-orchestrator
 * tier (cost-tier=aggressive) by gating the one judgment call orchestrators
 * make in the fix-loop: "is this qa-check failure a shared-component bug
 * (Opus orchestrator fixes once) or a per-page bug (Sonnet sub-agents fix
 * in parallel)?"
 *
 * A Sonnet orchestrator might misclassify a shared bug as per-page (causing
 * N parallel Sonnet workers to do duplicated work) OR a per-page bug as
 * shared (causing the orchestrator to apply a global fix that breaks
 * pages that didn't need it). Either misclassification is bounded-cost
 * but adds noise.
 *
 * The gate uses a deterministic heuristic to second-guess the orchestrator's
 * classification:
 *
 *   Shared-component bug signal (must classify as "shared"):
 *     - Same `check` ID fires on ≥ 3 pages (or ≥ 50% of pages, whichever lower)
 *     - The check ID matches a known-shared family:
 *         logo, nav, footer, hero (the components are shared)
 *         tailwind-cascade-trap, tailwind-v4-class-collision (CSS is shared)
 *         testimonial-tampering (data file is shared)
 *
 *   Per-page bug signal (must classify as "per-page"):
 *     - Check fires on exactly 1 page
 *     - Check ID is in {image-resolution, image-reuse, mobile-overflow,
 *       portfolio-integrity}  (page-specific)
 *
 * Reads jobs/{domain}/qa-option-X/qa-check-report.json (or the qa.cjs
 * report.json with consoleErrors / networkErrors arrays mapped to fails).
 * Reads orchestration.log for the orchestrator's actual classification
 * (sub-agent-dispatched events at Stage 4e/6e/7f) and compares.
 *
 * Usage:
 *   node scripts/validate-fix-loop-classification.cjs <domain> <option:a|b|c> [--allow-mismatch]
 *
 * Exit codes:
 *   0 — orchestrator's classification matches the heuristic (or no fix-loop ran)
 *   1 — bad CLI args
 *   2 — classification mismatch detected; report listed
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
let allowMismatch = false;
const positional = [];
for (const a of args) {
  if (a === '--allow-mismatch') { allowMismatch = true; continue; }
  positional.push(a);
}
const [domain, optionRaw] = positional;
if (!domain || !optionRaw) {
  console.error('Usage: node scripts/validate-fix-loop-classification.cjs <domain> <option:a|b|c> [--allow-mismatch]');
  process.exit(1);
}

const option = optionRaw.toLowerCase();
if (!['a', 'b', 'c'].includes(option)) {
  console.error(`✗ Invalid option "${optionRaw}"`);
  process.exit(1);
}

const jobDir = path.join(REPO_ROOT, 'jobs', domain);
const logPath = path.join(jobDir, 'orchestration.log');
const qaReportPath = path.join(jobDir, `qa-option-${option}`, 'qa-check-report.json');

// Soft-skip when there's nothing to audit.
if (!fs.existsSync(logPath)) {
  console.log(`✓ No orchestration.log for ${domain} — skipping fix-loop classification audit.`);
  process.exit(0);
}
if (!fs.existsSync(qaReportPath)) {
  console.log(`✓ No qa-check-report for option-${option} — skipping fix-loop classification audit.`);
  process.exit(0);
}

const report = JSON.parse(fs.readFileSync(qaReportPath, 'utf8'));
const logEvents = fs.readFileSync(logPath, 'utf8').split('\n').filter(l => l.trim()).map(l => {
  try { return JSON.parse(l); } catch { return null; }
}).filter(Boolean);

// Group qa-check failures by check ID + count distinct pages.
const failuresByCheck = new Map();
const issues = report.issues || report.failures || [];
for (const i of issues) {
  if (i.severity !== 'fail') continue;
  const checkId = i.check || 'unknown';
  const page = i.page || i.path || i.url || '?';
  const set = failuresByCheck.get(checkId) || new Set();
  set.add(page);
  failuresByCheck.set(checkId, set);
}

// Heuristic classification per check.
const SHARED_CHECK_FAMILY = new Set([
  'logo', 'nav', 'footer', 'hero', 'logo-bg-mismatch',
  'tailwind-cascade-trap', 'tailwind-v4-class-collision',
  'testimonial-tampering', 'footer-margin-top',
  'invented-brand-graphic',
]);
const PER_PAGE_CHECK_FAMILY = new Set([
  'image-resolution', 'image-reuse-A', 'mobile-overflow',
  'portfolio-integrity', 'mobile-tap-target',
]);

function expectedClassification(checkId, pages) {
  // Family-based hard signals
  if (SHARED_CHECK_FAMILY.has(checkId)) return 'shared';
  if (PER_PAGE_CHECK_FAMILY.has(checkId)) return pages.size === 1 ? 'per-page' : 'mixed';
  // Page-count threshold: ≥ 3 pages OR ≥ 50% of all pages → shared
  // Single page → per-page
  if (pages.size === 1) return 'per-page';
  if (pages.size >= 3) return 'shared';
  return 'either';   // ambiguous — orchestrator's call is fine
}

// Read orchestrator's actual classification from the log.
// Stage 4e/6e/7f fix-loop dispatches use sub-agent-dispatched events
// with `option=X` and `page=Y` per dispatch. Aggregate by option:
//   - many sub-agents dispatched in parallel for same option → per-page
//   - zero sub-agents dispatched but fix happened (inline edits) → shared
const stagesByOption = { a: '4e', b: '6e', c: '7f' };
const fixLoopStage = stagesByOption[option];
const fixLoopDispatches = logEvents.filter(e =>
  e.event === 'sub-agent-dispatched'
  && (e.stage === fixLoopStage || e.stage === '4e' || e.stage === '6e' || e.stage === '7f')
  && e.details?.option === option
);

// If no fix-loop ran (qa-check passed first try), gate is a no-op.
if (issues.length === 0) {
  console.log(`✓ qa-check passed first try for option-${option} — no fix-loop classification to audit.`);
  process.exit(0);
}

// Walk each unique check, compute expected vs orchestrator-actual.
const mismatches = [];
for (const [checkId, pages] of failuresByCheck) {
  const expected = expectedClassification(checkId, pages);
  if (expected === 'either') continue;   // ambiguous, no opinion
  const orchestratorPerPage = fixLoopDispatches.filter(e => pages.has(e.details?.page || '?')).length;
  const orchestratorActual = orchestratorPerPage > 0 ? 'per-page' : 'shared';
  if (expected !== orchestratorActual && expected !== 'mixed') {
    mismatches.push({
      checkId,
      pageCount: pages.size,
      pages: [...pages].slice(0, 5),
      expected,
      actual: orchestratorActual,
    });
  }
}

if (mismatches.length === 0) {
  console.log(`✓ Fix-loop classification audit passed for option-${option} — orchestrator's classifications match the deterministic heuristic.`);
  process.exit(0);
}

if (allowMismatch) {
  console.warn(`⚠ ${mismatches.length} fix-loop classification mismatch(es) — proceeding per --allow-mismatch.`);
  for (const m of mismatches) {
    console.warn(`    ${m.checkId}: ${m.pageCount} page${m.pageCount === 1 ? '' : 's'}, expected=${m.expected}, actual=${m.actual}`);
  }
  process.exit(0);
}

console.error('═══════════════════════════════════════════════════════════════════════');
console.error(`  ✗ FIX-LOOP CLASSIFICATION MISMATCH (option-${option})`);
console.error('═══════════════════════════════════════════════════════════════════════');
console.error('');
for (const m of mismatches) {
  console.error(`  ${m.checkId}:`);
  console.error(`    pages affected: ${m.pageCount} (${m.pages.join(', ')}${m.pages.length < m.pageCount ? '...' : ''})`);
  console.error(`    expected classification: ${m.expected}`);
  console.error(`    orchestrator's actual:   ${m.actual}`);
  console.error('');
}
console.error('Mismatches indicate the orchestrator (likely Sonnet under cost-tier=aggressive)');
console.error('may have misclassified a fix-loop bug. Misclassification doesn\'t cause');
console.error('fabrication, but wastes compute (shared bug fixed N times) or breaks pages');
console.error('(per-page bug fixed globally in a shared component).');
console.error('');
console.error('Two ways to resolve:');
console.error('  1. Re-run the fix-loop with the corrected classification (preferred).');
console.error('  2. Pass --allow-mismatch if the orchestrator has a documented reason.');
process.exit(2);
