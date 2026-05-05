#!/usr/bin/env node
/**
 * smart-resume.cjs — detect WebFactory job state, recommend resume point
 *
 * Stage 0 prelude for /webfactory <url>: the orchestrator shells out to this
 * script ONCE at the start of every pipeline run. The script inspects
 * jobs/{domain}/ for completed artifacts (manifest.json, design-brief.json,
 * option-X/dist/index.html, metrics.optionX.url, store-registration.json) and
 * prints a JSON object describing where to resume.
 *
 * Why this is a separate script (not inline orchestrator logic):
 *   - The orchestrator never reads manifest.json / dist/ contents. It just
 *     reads this script's small JSON output (~600 bytes).
 *   - Filesystem detection is deterministic and fast — no model reasoning
 *     about "is this stage really done?".
 *   - The script is also useful for batch tooling (queue-rebuilds.js can
 *     skip jobs that are already pipeline-complete, etc.).
 *
 * Usage:
 *   node scripts/smart-resume.cjs <domain>
 *
 * Output (stdout, JSON):
 *   {
 *     "domain":      "giffins.net",
 *     "jobDir":      "jobs/giffins.net",
 *     "resumeFrom":  "stage-2-design-brief",        // or "pipeline-complete", "stage-1-scrape", etc.
 *     "summary":     "Stage 1 complete (scrape + assets). Resume at Stage 2.",
 *     "artifactsFound": {
 *       "manifest.json":            true,
 *       "design-brief.json":        false,
 *       "specs/":                   false,
 *       "option-a/dist/":           false,
 *       "option-b/dist/":           false,
 *       "option-c/dist/":           false,
 *       "metrics.optionA.url":      false,
 *       "metrics.optionB.url":      false,
 *       "metrics.optionC.url":      false,
 *       "store-registration.json":  false
 *     }
 *   }
 *
 * Exit codes:
 *   0 — success (resume info printed)
 *   2 — bad CLI args
 *
 * NEVER non-zero on "no job dir found" — that's a valid state (fresh build).
 *
 * Resume points (in pipeline order, lowest-completion-state first):
 *   stage-1-scrape              — no manifest yet; run from start
 *   stage-2-design-brief        — manifest exists; brief missing
 *   stage-2.5-specs             — brief done; specs missing
 *   stage-3-build-a             — specs done; option-a/dist missing
 *   stage-5-build-b             — A built; B missing
 *   stage-7-build-c             — A+B built, C missing (run unless --skip-c)
 *   stage-8a-qa-gate            — all options built, deploys missing
 *   stage-8b-deploy             — partial deploy (some optionX.url missing)
 *   stage-10-report-and-register— all deploys done, storefront not registered
 *   pipeline-complete           — store-registration.json exists; nothing to do
 *                                 unless --full (rebuild from scratch)
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');

const domain = process.argv[2];
if (!domain) {
  console.error('Usage: node scripts/smart-resume.cjs <domain>');
  process.exit(2);
}

const jobDir = path.join(REPO_ROOT, 'jobs', domain);

// Helper: check if a relative path inside jobDir exists (file or dir).
function exists(relPath) {
  try {
    return fs.existsSync(path.join(jobDir, relPath));
  } catch {
    return false;
  }
}

// Helper: check if a directory exists AND contains at least one entry
// matching the predicate. Used for specs/ — empty dir or only `_shared.md`
// shouldn't count as "specs done".
function dirHasMatching(relPath, predicate) {
  const dir = path.join(jobDir, relPath);
  if (!fs.existsSync(dir)) return false;
  try {
    return fs.readdirSync(dir).some(predicate);
  } catch {
    return false;
  }
}

// Compute artifact presence. Build each value defensively — never throw.
const artifactsFound = {
  'manifest.json':           exists('manifest.json'),
  'placeholder-report.json': exists('placeholder-report.json'),
  'design-brief.json':       exists('design-brief.json'),
  // Specs: at least one non-underscore-prefixed .md file (matches the
  // convention validate-specs.cjs uses — `_shared.md` and `_*-template.md`
  // are scaffolding, not actual page specs).
  'specs/':                  dirHasMatching('specs', f => f.endsWith('.md') && !f.startsWith('_')),
  // dist/index.html is the canonical "Astro build succeeded" indicator.
  // option-X/src/ alone means source generated but not compiled — treat as
  // unbuilt and re-run that stage.
  'option-a/dist/':          exists('option-a/dist/index.html'),
  'option-b/dist/':          exists('option-b/dist/index.html'),
  'option-c/dist/':          exists('option-c/dist/index.html'),
  // Deploy URLs (recorded by record-deploy-url.cjs at Stage 8b).
  'metrics.optionA.url':     false,
  'metrics.optionB.url':     false,
  'metrics.optionC.url':     false,
  // Storefront registration checkpoint (Stage 10c).
  'store-registration.json': exists('store-registration.json'),
};

// Pull deploy URLs from metrics.json if present.
try {
  const metricsPath = path.join(jobDir, 'metrics.json');
  if (fs.existsSync(metricsPath)) {
    const m = JSON.parse(fs.readFileSync(metricsPath, 'utf8'));
    if (m.optionA?.url) artifactsFound['metrics.optionA.url'] = true;
    if (m.optionB?.url) artifactsFound['metrics.optionB.url'] = true;
    if (m.optionC?.url) artifactsFound['metrics.optionC.url'] = true;
  }
} catch {
  // metrics.json missing or unparseable — leave the URL flags at false.
  // The orchestrator may still resume correctly via dist/ presence.
}

// Decide resume point. Walk from highest-completion-state backward; first
// match wins. This intentionally does NOT try to detect --skip-c — that's a
// CLI flag, not an on-disk state. If the orchestrator was invoked with
// --skip-c originally and the worker session crashed, the user must
// re-pass --skip-c on the resume invocation.
let resumeFrom;
let summary;

if (artifactsFound['store-registration.json']) {
  resumeFrom = 'pipeline-complete';
  summary = 'Build is fully complete (registered with storefront). Re-running /webfactory will skip-or-resume cleanly; pass --full to rebuild from scratch.';
} else if (
  artifactsFound['metrics.optionA.url'] &&
  artifactsFound['metrics.optionB.url'] &&
  // Option C: deployed if its URL is present, OR --skip-c was implied (no dist)
  (artifactsFound['metrics.optionC.url'] || !artifactsFound['option-c/dist/'])
) {
  resumeFrom = 'stage-10-report-and-register';
  summary = 'All deploys complete. Resume at Stage 9 (Verify) → Stage 10 (Report) → Stage 10c (Store registration) → Stage 10d (mark-rebuilt).';
} else if (
  artifactsFound['option-a/dist/'] &&
  artifactsFound['option-b/dist/'] &&
  artifactsFound['option-c/dist/']
) {
  // All three options built. Some deploys may be missing — Stage 8b is
  // idempotent, re-running for already-deployed options is cheap.
  // NOTE: this branch requires option-c/dist EXACTLY (not "C built or
  // skipped"). The previous version used `(option-c/dist || true)` which
  // always evaluated true and trapped mid-pipeline builds (A+B built, C in
  // progress) into "all-built" state — returning stage-8a-qa-gate when the
  // correct answer was stage-7-build-c. Real bug surfaced 2026-05-04 on
  // watkinsmonuments.com mid-pipeline.
  //
  // The --skip-c case is handled in the next branch (A+B built, no C.dist):
  // smart-resume returns stage-7-build-c regardless, and the orchestrator's
  // CLI-flag context decides whether to honor --skip-c on the resume
  // invocation. smart-resume cannot detect --skip-c from on-disk state.
  if (
    !artifactsFound['metrics.optionA.url'] ||
    !artifactsFound['metrics.optionB.url'] ||
    !artifactsFound['metrics.optionC.url']
  ) {
    resumeFrom = 'stage-8a-qa-gate';
    summary = 'All three options built; deploys missing or partial. Resume at Stage 8a (QA gate) → Stage 8b (Deploy missing options).';
  } else {
    resumeFrom = 'stage-9-verify';
    summary = 'All builds + deploys present, but storefront not registered. Resume at Stage 9 (Verify) → Stage 10 → Stage 10c.';
  }
} else if (artifactsFound['option-a/dist/'] && artifactsFound['option-b/dist/']) {
  resumeFrom = 'stage-7-build-c';
  summary = 'Option A and B built; Option C missing. Resume at Stage 7 (Build C). If --skip-c was the original intent, re-pass that flag (smart-resume cannot detect CLI flag history) — the orchestrator will then skip Stage 7 and fall through to Stage 8a directly.';
} else if (artifactsFound['option-a/dist/']) {
  resumeFrom = 'stage-5-build-b';
  summary = 'Option A built; Option B missing. Resume at Stage 5 (Build B).';
} else if (artifactsFound['specs/']) {
  resumeFrom = 'stage-3-build-a';
  summary = 'Per-page specs generated; Option A not yet built. Resume at Stage 3 (Build A).';
} else if (artifactsFound['design-brief.json']) {
  resumeFrom = 'stage-2.5-specs';
  summary = 'Design brief done; per-page specs missing. Resume at Stage 2.5 (Per-page specs).';
} else if (artifactsFound['manifest.json']) {
  resumeFrom = 'stage-2-design-brief';
  summary = 'Stage 1 complete (scrape + assets + metrics). Resume at Stage 2 (Design Brief).';
} else {
  resumeFrom = 'stage-1-scrape';
  summary = fs.existsSync(jobDir)
    ? 'Job directory exists but no manifest. Resume at Stage 1 (Scrape).'
    : 'No job directory exists. Fresh build from Stage 1.';
}

console.log(JSON.stringify({
  domain,
  jobDir,
  resumeFrom,
  summary,
  artifactsFound,
}, null, 2));
process.exit(0);
