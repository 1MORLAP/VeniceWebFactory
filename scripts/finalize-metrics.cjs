#!/usr/bin/env node
/**
 * WebFactory Metrics Finalizer
 *
 * Called at the end of a WebFactory run. Measures output sizes,
 * calculates total wall-clock time, and writes the final metrics.json.
 *
 * Usage: node scripts/finalize-metrics.js <domain>
 */

const fs = require('fs');
const path = require('path');

const domain = process.argv[2];
if (!domain) {
  console.error('Usage: node scripts/finalize-metrics.js <domain>');
  process.exit(1);
}

const metricsPath = path.join('jobs', domain, 'metrics.json');
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

// Measure Option A output (Astro build output in dist/)
const optADir = path.join('jobs', domain, 'option-a', 'dist');
if (fs.existsSync(optADir)) {
  const files = walk(optADir);
  metrics.optionA = {
    files: files.length,
    totalBytes: files.reduce((sum, f) => sum + fs.statSync(f).size, 0),
    htmlFiles: files.filter(f => f.endsWith('.html')).length,
  };
}

// Measure Option B output (canonical conversion-tuned rewrite of A — same design, new copy)
const optBDir = path.join('jobs', domain, 'option-b', 'dist');
if (fs.existsSync(optBDir)) {
  const files = walk(optBDir);
  metrics.optionB = {
    files: files.length,
    totalBytes: files.reduce((sum, f) => sum + fs.statSync(f).size, 0),
    htmlFiles: files.filter(f => f.endsWith('.html')).length,
  };
}

// Measure Option C output (Astro build in dist/)
const optCDir = path.join('jobs', domain, 'option-c', 'dist');
if (fs.existsSync(optCDir)) {
  const files = walk(optCDir);
  metrics.optionC = {
    files: files.length,
    totalBytes: files.reduce((sum, f) => sum + fs.statSync(f).size, 0),
    htmlFiles: files.filter(f => f.endsWith('.html')).length,
  };
}

// Measure manifest input
const manifestPath = path.join('jobs', domain, 'manifest.json');
if (fs.existsSync(manifestPath)) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  metrics.input = {
    pages: manifest.pages.length,
    manifestBytes: fs.statSync(manifestPath).size,
  };
}

fs.writeFileSync(metricsPath, JSON.stringify(metrics, null, 2));
console.log(JSON.stringify(metrics, null, 2));
