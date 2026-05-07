#!/usr/bin/env node
/**
 * WebFactory Metrics Finalizer
 *
 * Called at the end of a WebFactory run. Measures output sizes,
 * calculates total wall-clock time, and writes the final metrics.json.
 *
 * Usage: node scripts/finalize-metrics.cjs <domain>
 *
 * IMPORTANT: this script MERGES into metrics.optionX (does NOT overwrite).
 * Stage 8b's record-deploy-url.cjs writes optionX.url + optionX.deployedAt;
 * we add files/totalBytes/htmlFiles on top without clobbering. Pre-fix
 * (before 2026-05-04) this used `metrics.optionX = { ... }` which
 * silently dropped the url field — surfaced on watkinsmonuments.com
 * when Stage 10c failed to find URLs after running finalize.
 *
 * Path resolution: all jobs/ paths resolve from the repo root
 * (scripts/.. — i.e. parent of this script's dir), NOT from cwd. This
 * lets the script run from any directory without breaking.
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');

const domain = process.argv[2];
if (!domain) {
  console.error('Usage: node scripts/finalize-metrics.cjs <domain>');
  process.exit(1);
}

const metricsPath = path.join(REPO_ROOT, 'jobs', domain, 'metrics.json');
if (!fs.existsSync(metricsPath)) {
  console.error(`Metrics file not found: ${metricsPath}`);
  process.exit(1);
}

const metrics = JSON.parse(fs.readFileSync(metricsPath, 'utf8'));

// Mark completion
metrics.runCompletedAt = new Date().toISOString();

// Calculate total wall clock minutes
const start = new Date(metrics.runStartedAt);
const end = new Date(metrics.runCompletedAt);
metrics.totalMinutes = Math.round((end - start) / 60000);

// Walk helper
function walk(dir) {
  const files = [];
  const inner = (d) => {
    for (const f of fs.readdirSync(d, { withFileTypes: true })) {
      const fullPath = path.join(d, f.name);
      if (f.isDirectory()) inner(fullPath);
      else files.push(fullPath);
    }
  };
  inner(dir);
  return files;
}

// Per-option size measurement. CRITICAL: spread existing metrics.optionX
// so the url + deployedAt fields written by record-deploy-url.cjs at
// Stage 8b survive this step.
function measureOption(optionDir, key) {
  if (!fs.existsSync(optionDir)) return;
  const files = walk(optionDir);
  metrics[key] = {
    ...(metrics[key] || {}),
    files: files.length,
    totalBytes: files.reduce((sum, f) => sum + fs.statSync(f).size, 0),
    htmlFiles: files.filter(f => f.endsWith('.html')).length,
  };
}

measureOption(path.join(REPO_ROOT, 'jobs', domain, 'option-a', 'dist'), 'optionA');
measureOption(path.join(REPO_ROOT, 'jobs', domain, 'option-b', 'dist'), 'optionB');
measureOption(path.join(REPO_ROOT, 'jobs', domain, 'option-c', 'dist'), 'optionC');

// Measure manifest input
const manifestPath = path.join(REPO_ROOT, 'jobs', domain, 'manifest.json');
if (fs.existsSync(manifestPath)) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  metrics.input = {
    pages: manifest.pages.length,
    manifestBytes: fs.statSync(manifestPath).size,
  };
}

fs.writeFileSync(metricsPath, JSON.stringify(metrics, null, 2));
console.log(JSON.stringify(metrics, null, 2));

// Phase F self-instrumentation
const { logDecision } = require('./_log-helper.cjs');
logDecision(domain, '10', 'finalize-metrics-complete', {
  totalMinutes: metrics.totalMinutes,
  optionA_url: metrics.optionA?.url || null,
  optionB_url: metrics.optionB?.url || null,
  optionC_url: metrics.optionC?.url || null,
});
