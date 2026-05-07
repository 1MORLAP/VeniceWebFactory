#!/usr/bin/env node
/**
 * deploy-with-gate.cjs — atomic Stage 8a-gate + 8b-deploy wrapper (Phase F.4)
 *
 * Built 2026-05-07 after the lisastephens G.1-fix build silently bypassed
 * the validate-pre-deploy.cjs chokepoint. The gate's protection model was
 * circular: the chokepoint exists to prevent un-QA'd deploys, but the
 * orchestrator has to remember to run it. The audit later showed
 * "verdict=(gate did not run)" — deploys happened anyway.
 *
 * The structural fix: combine the gate AND the deploy into a single
 * atomic script. If the orchestrator skips this script, no deploy
 * happens. If the orchestrator calls it, the gate runs unconditionally
 * before any vercel-cli invocation. Removes "did the orchestrator
 * remember the gate?" as a degree of freedom.
 *
 * What it does (per option):
 *   1. Run validate-pre-deploy.cjs <domain> [--allow-missing-events]
 *      • Exit 2 if any required event missing (no override) → no deploy
 *      • Exit 0 if pass OR override accepted → continue
 *   2. cd to jobs/<domain>/option-<a|b|c>
 *   3. npx vercel build --yes (locally — produces .vercel/output/)
 *   4. npx vercel deploy --prebuilt --yes (uploads prebuilt artifact)
 *      Captures URL by regex (the Phase F.3 / B1 fix pattern):
 *      `grep -oE 'https://[^[:space:]]+\.vercel\.app' | tail -1`
 *   5. node scripts/record-deploy-url.cjs <domain> <option> <url>
 *      (which self-instruments 8b/deploy-recorded per Phase F.1)
 *
 * Why a Node wrapper instead of a bash script:
 *   • The B1 URL-capture pattern is fragile in bash (already broke once
 *     when the Vercel CLI changed output format). Capturing in JS via
 *     spawnSync + regex is robust to format drift.
 *   • Node lets us cleanly propagate exit codes from sub-processes and
 *     emit structured JSON to stderr on failure for the audit log.
 *   • Single file to maintain, single source of truth for "what does
 *     'deploy' mean structurally?"
 *
 * Usage:
 *   node scripts/deploy-with-gate.cjs <domain> <option> [--allow-missing-events]
 *
 *   <option>: a | b | c (matches the option directory under jobs/<domain>/)
 *
 * Exit codes:
 *   0 — gate passed AND deploy succeeded AND URL recorded
 *   1 — bad CLI args / option directory missing / `vercel` not on PATH
 *   2 — pre-deploy gate failed (and no --allow-missing-events override)
 *   3 — `vercel build` failed (Astro compile error or missing deps)
 *   4 — `vercel deploy --prebuilt` failed (auth issue, scope mismatch,
 *       Vercel API outage); URL not captured
 *   5 — deploy succeeded but record-deploy-url.cjs failed
 */

const { spawnSync } = require('node:child_process');
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
const [domain, option] = positional;

if (!domain || !option) {
  console.error('Usage: node scripts/deploy-with-gate.cjs <domain> <option> [--allow-missing-events]');
  console.error('  option: a | b | c');
  process.exit(1);
}
if (!['a', 'b', 'c'].includes(option)) {
  console.error(`✗ Invalid option "${option}" — must be one of: a, b, c`);
  process.exit(1);
}

const optionDir = path.join(REPO_ROOT, 'jobs', domain, `option-${option}`);
if (!fs.existsSync(optionDir)) {
  console.error(`✗ Option directory not found: ${optionDir}`);
  console.error('  Did Stage 3/5/7 build complete? Check jobs/<domain>/.');
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────
// Step 1: Pre-deploy gate (Phase F.2 chokepoint)
// ─────────────────────────────────────────────────────────────────────

console.log(`▶ deploy-with-gate: domain=${domain} option=${option}`);
console.log(`▶ Step 1/3: validate-pre-deploy gate`);

const gateArgs = [path.join(REPO_ROOT, 'scripts', 'validate-pre-deploy.cjs'), domain];
if (allowMissing) gateArgs.push('--allow-missing-events');
const gate = spawnSync('node', gateArgs, { stdio: 'inherit' });

if (gate.status !== 0) {
  console.error('');
  console.error('✗ Pre-deploy gate FAILED — deploy blocked.');
  console.error('  See validate-pre-deploy.cjs output above for the missing events.');
  console.error('');
  console.error('  To override (use sparingly + document in build prose):');
  console.error(`  node scripts/deploy-with-gate.cjs ${domain} ${option} --allow-missing-events`);
  process.exit(2);
}

// ─────────────────────────────────────────────────────────────────────
// Step 1.5: ensure .vercel/project.json is linked correctly
//
// CRITICAL (Phase J followup, 2026-05-07): if `.vercel/project.json`
// is missing OR has the wrong projectName (e.g., bare "option-a"
// instead of "{domain}-option-a"), `vercel deploy` will auto-create
// a generic project that COLLIDES across customers. Real bug observed
// 2026-05-07: lisastephenscpa-com `--full` build deployed to a
// project literally named "option-a" because the prior project link
// got wiped by --full and deploy-with-gate.cjs didn't re-link.
// All future customer builds would silently push deployments into
// the same shared "option-a"/"option-b"/"option-c" projects.
//
// Fix: pre-link the project before any vercel-cli call. The expected
// project name is `{domain-slug}-option-{a|b|c}` where {domain-slug}
// is the canonical domain with dots replaced by hyphens.
const expectedProjectName = `${domain.replace(/\./g, '-')}-option-${option}`;
const projectJsonPath = path.join(optionDir, '.vercel', 'project.json');
let needsLink = !fs.existsSync(projectJsonPath);
if (!needsLink) {
  try {
    const linked = JSON.parse(fs.readFileSync(projectJsonPath, 'utf8'));
    if (linked.projectName !== expectedProjectName) {
      console.warn(`⚠ Existing .vercel/project.json has wrong projectName: "${linked.projectName}" (expected "${expectedProjectName}"). Re-linking.`);
      needsLink = true;
    }
  } catch (e) {
    console.warn(`⚠ Could not parse .vercel/project.json: ${e.message}. Re-linking.`);
    needsLink = true;
  }
}

if (needsLink) {
  console.log('');
  console.log(`▶ Step 1.5/4: pre-link Vercel project to ${expectedProjectName}`);
  // Wipe stale .vercel/ if present — vercel link refuses if there's a
  // partial link state.
  const vercelDir = path.join(optionDir, '.vercel');
  if (fs.existsSync(vercelDir)) {
    try { fs.rmSync(vercelDir, { recursive: true, force: true }); } catch {}
  }
  const link = spawnSync('npx', [
    'vercel', 'link',
    '--scope', 'tomek-group',
    '--project', expectedProjectName,
    '--yes',
  ], {
    cwd: optionDir,
    stdio: 'inherit',
  });
  if (link.status !== 0) {
    console.error(`✗ vercel link failed (exit ${link.status}) — no deploy attempted.`);
    process.exit(3);
  }
}

// ─────────────────────────────────────────────────────────────────────
// Step 2: vercel build + vercel deploy --prebuilt
// ─────────────────────────────────────────────────────────────────────

console.log('');
console.log(`▶ Step 2/3: vercel build + vercel deploy --prebuilt`);

// Build locally (produces .vercel/output/) — this MUST run from the
// option directory so vercel-cli picks up the project's .vercel/ link.
const build = spawnSync('npx', ['vercel', 'build', '--yes'], {
  cwd: optionDir,
  stdio: 'inherit',
});

if (build.status !== 0) {
  console.error(`✗ vercel build failed (exit ${build.status}) — no deploy attempted.`);
  process.exit(3);
}

// Deploy the prebuilt output. Capture stdout via spawnSync so we can
// extract the deploy URL by regex (the B1 fix pattern from Phase F.3).
//
// `--archive=tgz` (Phase J, 2026-05-07): compress the build output as
// a single tarball before uploading. Per Vercel docs:
//   "Build a project locally with `vercel build`, then deploy the
//    prebuilt output using `--prebuilt` and `--archive=tgz` to compress
//    the build output and minimize upload size."
// Smaller upload = less billable Build CPU time per deploy.
//
// Note: we don't use stdio: 'inherit' here because we need stdout
// content for URL extraction. Stderr gets echoed live so the operator
// can see progress.
const deploy = spawnSync('npx', ['vercel', 'deploy', '--prebuilt', '--archive=tgz', '--yes'], {
  cwd: optionDir,
  encoding: 'utf8',
  // Pipe stdout so we can extract; let stderr stream live to the parent.
  stdio: ['ignore', 'pipe', 'inherit'],
});

if (deploy.status !== 0) {
  console.error(`✗ vercel deploy failed (exit ${deploy.status}) — URL not captured.`);
  console.error('  stdout was:');
  console.error((deploy.stdout || '').slice(-2000));
  process.exit(4);
}

// Extract the deploy URL via regex. Vercel CLI may print other lines
// before/after the URL (build summary, status emoji, JSON closing brace
// in newer CLI versions); the URL is whatever line matches the
// `-tomek-group.vercel.app` shape. Tail -1 picks the last match if
// multiple URLs are printed (e.g., the deploy URL plus an inspector
// URL — we want the deploy URL, which is always last).
const stdout = deploy.stdout || '';
const urls = stdout.match(/https:\/\/[^\s"']+\.vercel\.app/g) || [];
const url = urls.length ? urls[urls.length - 1] : null;

if (!url) {
  console.error('✗ vercel deploy succeeded but no URL found in stdout.');
  console.error('  This usually means the CLI output format changed. Inspect the stdout below:');
  console.error('  ─────────────────────────────────────────────────────────────────');
  console.error(stdout.slice(-2000));
  console.error('  ─────────────────────────────────────────────────────────────────');
  console.error('  Update the URL-capture regex in scripts/deploy-with-gate.cjs.');
  process.exit(4);
}

console.log('');
console.log(`✓ vercel deploy succeeded`);
console.log(`  URL: ${url}`);

// ─────────────────────────────────────────────────────────────────────
// Step 3: Record the URL via record-deploy-url.cjs (self-instrumenting)
// ─────────────────────────────────────────────────────────────────────

console.log('');
console.log(`▶ Step 3/3: record-deploy-url + emit 8b/deploy-recorded`);

const record = spawnSync('node', [
  path.join(REPO_ROOT, 'scripts', 'record-deploy-url.cjs'),
  domain,
  option,
  url,
], {
  stdio: 'inherit',
});

if (record.status !== 0) {
  console.error(`✗ record-deploy-url failed (exit ${record.status}) — URL captured but not persisted.`);
  console.error(`  Manually run:`);
  console.error(`    node scripts/record-deploy-url.cjs ${domain} ${option} '${url}'`);
  process.exit(5);
}

console.log('');
console.log(`✓ deploy-with-gate complete: option=${option} url=${url}`);
process.exit(0);
