#!/usr/bin/env node
/**
 * record-deploy-url.cjs — record a Vercel deploy URL into metrics.json
 *
 * Stage 8b runs `npx vercel deploy --prebuilt --yes` per option, captures the
 * stdout (the deploy URL), and immediately invokes this helper so the
 * canonical URL ends up in metrics.json. Downstream consumers
 * (register-with-store.mjs at Stage 10, the report emitter, any future
 * tooling) can then read URLs from a single source instead of grepping logs.
 *
 * Usage: node scripts/record-deploy-url.cjs <domain> <option> <url>
 *
 *   <domain>: e.g. "giffins.net"
 *   <option>: "a" | "b" | "c"
 *   <url>:    full https URL (e.g. "https://giffins-net-option-a-abc123-tomek-group.vercel.app")
 *
 * The helper merges into metrics.optionX.url without overwriting existing
 * keys (files / totalBytes / htmlFiles populated by finalize-metrics.cjs at
 * Stage 10).
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');

const [, , domain, optionRaw, urlRaw] = process.argv;
if (!domain || !optionRaw || !urlRaw) {
  console.error('Usage: node scripts/record-deploy-url.cjs <domain> <option:a|b|c> <url>');
  process.exit(2);
}

const option = optionRaw.toLowerCase();
if (!['a', 'b', 'c'].includes(option)) {
  console.error(`✗ Invalid option "${optionRaw}" — must be one of a, b, c`);
  process.exit(2);
}

// Light validation — the URL must look like a real https URL. A bare domain
// (no scheme) gets the https:// prefix added so we never write nonsense.
let url = urlRaw.trim();
if (!/^https?:\/\//.test(url)) {
  if (/^[a-z0-9.-]+\.vercel\.app/i.test(url)) {
    url = 'https://' + url;
  } else {
    console.error(`✗ URL "${urlRaw}" does not look like an https URL or vercel.app hostname`);
    process.exit(2);
  }
}

const metricsPath = path.join(REPO_ROOT, 'jobs', domain, 'metrics.json');
if (!fs.existsSync(metricsPath)) {
  console.error(`✗ ${metricsPath} not found — run scripts/init-metrics.cjs first`);
  process.exit(2);
}

const metrics = JSON.parse(fs.readFileSync(metricsPath, 'utf8'));
const key = `option${option.toUpperCase()}`;
metrics[key] = metrics[key] || {};
metrics[key].url = url;
metrics[key].deployedAt = new Date().toISOString();

fs.writeFileSync(metricsPath, JSON.stringify(metrics, null, 2));
console.log(`✓ Recorded ${key}.url = ${url}`);

// Phase F self-instrumentation
const { logDecision } = require('./_log-helper.cjs');
logDecision(domain, '8b', 'deploy-recorded', { option, url });
