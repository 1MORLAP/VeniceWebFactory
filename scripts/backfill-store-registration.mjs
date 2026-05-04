#!/usr/bin/env node
/**
 * backfill-store-registration.mjs — register pre-Stage-10c builds with the store
 *
 * Stage 10c (registration) only became part of the pipeline on 2026-05-03.
 * Builds that completed before that date have built option-{a,b,c}/dist/
 * directories, were deployed to Vercel, but never POSTed to the storefront
 * intake API. This script walks every jobs/{domain}/ with completed
 * option-a/ AND option-b/ builds, rediscovers each option's deployed URL via
 * the Vercel API, records URLs into metrics.json (so the next manual pass
 * sees them too), and invokes register-with-store.mjs per domain.
 *
 * Usage:
 *   node scripts/backfill-store-registration.mjs            # backfill all real-customer jobs
 *   node scripts/backfill-store-registration.mjs --include-tests
 *   node scripts/backfill-store-registration.mjs --domain giffins.net
 *   node scripts/backfill-store-registration.mjs --dry-run  # show plan, no API calls
 *   node scripts/backfill-store-registration.mjs --force    # re-register even if checkpoint exists
 *
 * Requires:
 *   - WEBFACTORY_STORE_API_KEY in env (or in any tier loaded by
 *     register-with-store.mjs — sibling ~/webfactory-store/.env.local works)
 *   - Vercel CLI auth at ~/Library/Application Support/com.vercel.cli/auth.json
 *
 * Behavior:
 *   - Each domain is processed sequentially (not parallel) — Playwright
 *     screenshot capture inside register-with-store.mjs is heavy and Vercel
 *     API rate limits prefer serial.
 *   - Per-domain failures are NON-FATAL — logged + summary at end. The next
 *     domain processes regardless.
 *   - Already-registered domains are skipped (idempotency via
 *     jobs/{domain}/store-registration.json) unless --force.
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';

const SCRIPT_DIR   = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(SCRIPT_DIR, '..');
const TEAM_ID      = 'team_4Hr5Lqd6pY5D7gmeXDVsDmYx';

// Hardcoded skip list — these are internal tests / experiments, not real
// customer pitches. Override with --include-tests if you want to backfill
// them anyway. Match by exact domain.
const SKIP_DOMAINS = new Set([
  'tomekgroup-website.vercel.app',         // internal
  'accelwindows.com',                       // early architecture experiment
  'bwlocksmith.com',                        // early architecture experiment
  'apachecostructionllc.wixsite.com',       // wixsite test
  'beautifulcasa.wordpress.com',            // wordpress test
  'twoirishplumbers.squarespace.com',       // squarespace test
]);

// ---- arg parsing ---------------------------------------------------------
const args = process.argv.slice(2);
let onlyDomain = null;
let dryRun = false;
let force = false;
let includeTests = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--domain' && args[i + 1])  { onlyDomain = args[++i]; continue; }
  if (args[i] === '--dry-run')                 { dryRun = true; continue; }
  if (args[i] === '--force')                   { force = true; continue; }
  if (args[i] === '--include-tests')           { includeTests = true; continue; }
  if (args[i] === '-h' || args[i] === '--help') {
    console.log('Usage: node scripts/backfill-store-registration.mjs [--domain <name>] [--dry-run] [--force] [--include-tests]');
    process.exit(0);
  }
}

// ---- read Vercel auth token (for API queries) ----------------------------
function loadVercelToken() {
  const authPath = join(homedir(), 'Library', 'Application Support', 'com.vercel.cli', 'auth.json');
  if (!existsSync(authPath)) {
    console.error(`✗ Vercel auth not found at ${authPath}. Run 'npx vercel login' first.`);
    process.exit(2);
  }
  try {
    return JSON.parse(readFileSync(authPath, 'utf8')).token;
  } catch (e) {
    console.error(`✗ Failed to parse Vercel auth: ${e.message}`);
    process.exit(2);
  }
}
const vercelToken = loadVercelToken();

// ---- helpers --------------------------------------------------------------

// Read the linked project from .vercel/project.json. The project NAME drifted
// across early builds (some are `{slug}-option-a`, some are
// `{shortname}-option-a`, some have the TLD stripped) so we can't reliably
// compute the project name from the domain. The project.json file is the
// source of truth — it has both projectId and projectName.
function loadLinkedProject(jobDir, option) {
  const linkPath = join(jobDir, `option-${option}`, '.vercel', 'project.json');
  if (!existsSync(linkPath)) return null;
  try {
    const json = JSON.parse(readFileSync(linkPath, 'utf8'));
    return {
      projectId: json.projectId,
      projectName: json.projectName,
      orgId: json.orgId,
    };
  } catch {
    return null;
  }
}

// Query Vercel API for the most recent READY deployment URL of a project.
// Use the projectId (resilient to name drift). Returns the canonical URL
// (https://...) or null on any failure.
async function getLatestDeployUrl(projectId) {
  const url = `https://api.vercel.com/v6/deployments?projectId=${encodeURIComponent(projectId)}&teamId=${TEAM_ID}&limit=10&state=READY`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${vercelToken}` },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const deps = Array.isArray(json.deployments) ? json.deployments : [];
    if (deps.length === 0) return null;
    const top = deps[0];
    if (Array.isArray(top.aliasAssigned) && top.aliasAssigned.length > 0) {
      const a = top.aliasAssigned[0];
      if (typeof a === 'string') return 'https://' + a;
    }
    if (top.url) return 'https://' + top.url;
    return null;
  } catch {
    return null;
  }
}

// Discover all jobs with completed Option A + B builds.
function listBuiltJobs() {
  const jobsDir = join(PROJECT_ROOT, 'jobs');
  if (!existsSync(jobsDir)) return [];
  return readdirSync(jobsDir)
    .filter(name => {
      const d = join(jobsDir, name);
      try {
        if (!statSync(d).isDirectory()) return false;
        if (!existsSync(join(d, 'option-a', 'dist'))) return false;
        if (!existsSync(join(d, 'option-b', 'dist'))) return false;
        return true;
      } catch { return false; }
    })
    .sort();
}

// Run a sub-script and capture stdout/stderr. Returns { ok, stdout, stderr }.
function runSubscript(args, opts = {}) {
  const r = spawnSync('node', args, {
    cwd: PROJECT_ROOT,
    encoding: 'utf8',
    timeout: opts.timeout || 120_000,
    env: process.env,
  });
  return {
    ok: r.status === 0,
    status: r.status,
    stdout: r.stdout || '',
    stderr: r.stderr || '',
  };
}

// ---- main ----------------------------------------------------------------
const allJobs = listBuiltJobs();
const targetJobs = allJobs.filter(d => {
  if (onlyDomain) return d === onlyDomain;
  if (!includeTests && SKIP_DOMAINS.has(d)) return false;
  return true;
});

console.log(`\n${'═'.repeat(72)}`);
console.log(`  BACKFILL STORE REGISTRATION`);
console.log(`${'═'.repeat(72)}`);
console.log(`  ${allJobs.length} built jobs found, ${targetJobs.length} targeted${dryRun ? ' (DRY RUN)' : ''}`);
if (!includeTests && !onlyDomain) {
  const skipped = allJobs.filter(d => SKIP_DOMAINS.has(d));
  if (skipped.length > 0) console.log(`  Skipping ${skipped.length} test/internal: ${skipped.join(', ')}`);
}
console.log(`${'═'.repeat(72)}\n`);

const results = [];   // { domain, status, message }

for (let idx = 0; idx < targetJobs.length; idx++) {
  const domain = targetJobs[idx];
  console.log(`\n[${idx + 1}/${targetJobs.length}] ${domain}`);
  console.log('─'.repeat(72));

  const jobDir = join(PROJECT_ROOT, 'jobs', domain);

  // Idempotency: skip if already registered (unless --force)
  const checkpoint = join(jobDir, 'store-registration.json');
  if (existsSync(checkpoint) && !force) {
    let prior = null;
    try { prior = JSON.parse(readFileSync(checkpoint, 'utf8')); } catch {}
    console.log(`  ⏭  ALREADY REGISTERED (job_id=${prior?.job_id || '?'}). Use --force to re-register.`);
    results.push({ domain, status: 'skipped-already-registered', store_url: prior?.store_url });
    continue;
  }

  // Discover deploy URLs via Vercel API (per option that has a built dist/)
  const optionUrls = {};
  for (const opt of ['a', 'b', 'c']) {
    const distExists = existsSync(join(jobDir, `option-${opt}`, 'dist'));
    if (!distExists) continue;
    const linked = loadLinkedProject(jobDir, opt);
    if (!linked || !linked.projectId) {
      console.log(`  ✗ option-${opt} URL: no .vercel/project.json link — option was built but never deployed (or link was wiped)`);
      continue;
    }
    const url = await getLatestDeployUrl(linked.projectId);
    if (url) {
      optionUrls[opt] = url;
      console.log(`  ✓ option-${opt} URL: ${url}  (project: ${linked.projectName})`);
    } else {
      console.log(`  ✗ option-${opt} URL: project "${linked.projectName}" (${linked.projectId}) has no READY deployment — likely deleted or evicted`);
    }
  }

  if (!optionUrls.a || !optionUrls.b) {
    console.log(`  ✗ SKIPPED — Option A and/or B URL undiscoverable. Cannot register without both.`);
    results.push({ domain, status: 'skipped-no-deploy-urls' });
    continue;
  }

  if (dryRun) {
    console.log(`  → DRY RUN: would record URLs + invoke register-with-store.mjs`);
    results.push({ domain, status: 'dry-run' });
    continue;
  }

  // Record URLs into metrics.json (so other tooling can read them later too)
  for (const opt of ['a', 'b', 'c']) {
    if (!optionUrls[opt]) continue;
    const r = runSubscript(['scripts/record-deploy-url.cjs', domain, opt, optionUrls[opt]]);
    if (!r.ok) {
      console.log(`  ⚠ record-deploy-url failed for option-${opt}: ${r.stderr.trim() || r.stdout.trim()}`);
    }
  }

  // Invoke register-with-store.mjs with explicit URL overrides — even though
  // we just recorded them to metrics.json, passing them as args makes this
  // step independent of the metrics-write succeeding.
  const subArgs = [
    'scripts/register-with-store.mjs',
    '--domain', domain,
    '--option-a-url', optionUrls.a,
    '--option-b-url', optionUrls.b,
  ];
  if (optionUrls.c) subArgs.push('--option-c-url', optionUrls.c);
  if (force) subArgs.push('--force');

  const reg = runSubscript(subArgs, { timeout: 180_000 });   // 3min max per domain
  // Re-emit the script's stdout under indent so progress is visible.
  for (const line of reg.stdout.split('\n')) {
    if (line.trim()) console.log(`    ${line}`);
  }
  for (const line of reg.stderr.split('\n')) {
    if (line.trim()) console.log(`    ${line}`);
  }

  // Determine result by checking for the checkpoint file (success indicator)
  if (existsSync(checkpoint)) {
    try {
      const cp = JSON.parse(readFileSync(checkpoint, 'utf8'));
      results.push({ domain, status: 'registered', store_url: cp.store_url });
    } catch {
      results.push({ domain, status: 'registered-but-checkpoint-unreadable' });
    }
  } else {
    results.push({ domain, status: 'soft-failed', stderr: reg.stderr.slice(0, 200) });
  }
}

// ---- summary --------------------------------------------------------------
console.log(`\n${'═'.repeat(72)}`);
console.log(`  BACKFILL SUMMARY`);
console.log(`${'═'.repeat(72)}\n`);

const byStatus = new Map();
for (const r of results) {
  if (!byStatus.has(r.status)) byStatus.set(r.status, []);
  byStatus.get(r.status).push(r);
}

const labels = {
  'registered': '✓ Registered (newly POSTed)',
  'skipped-already-registered': '⏭  Skipped (already registered)',
  'skipped-no-deploy-urls': '✗ Skipped (no deploy URLs)',
  'soft-failed': '✗ Soft-failed during registration',
  'registered-but-checkpoint-unreadable': '⚠ Registered but checkpoint unreadable',
  'dry-run': '— Dry run (would have registered)',
};

for (const [status, rs] of byStatus) {
  console.log(`  ${labels[status] || status}: ${rs.length}`);
  for (const r of rs) {
    let line = `    • ${r.domain}`;
    if (r.store_url) line += `  →  ${r.store_url}`;
    console.log(line);
  }
  console.log();
}

const successCount = (byStatus.get('registered') || []).length + (byStatus.get('skipped-already-registered') || []).length;
const failCount    = (byStatus.get('soft-failed') || []).length + (byStatus.get('skipped-no-deploy-urls') || []).length;
console.log(`  Total processed: ${results.length} | Success: ${successCount} | Failed/skipped: ${failCount}`);
console.log(`${'═'.repeat(72)}\n`);

// Always exit 0 — soft-fails are expected and tracked in the summary.
process.exit(0);
