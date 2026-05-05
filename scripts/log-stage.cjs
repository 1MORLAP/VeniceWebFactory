#!/usr/bin/env node
/**
 * WebFactory Stage Logger
 *
 * Records the completion timestamp for a given stage in metrics.json.
 *
 * Usage: node scripts/log-stage.cjs <domain> <stage-name> [status]
 *
 * Stage names: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 (or descriptive names —
 * any string is accepted; metrics.json is just a key/value bag).
 *
 * Path resolution: jobs/{domain}/metrics.json resolves from the repo
 * root (scripts/.. — i.e. parent of this script's dir), NOT from cwd.
 * This lets the script run from any directory without breaking — which
 * matters because the orchestrator may invoke it from the option-a/,
 * option-b/, or option-c/ subdirs depending on which stage just completed.
 * Pre-fix (before 2026-05-04) the script used `path.join('jobs', ...)`
 * which silently created an empty metrics.json under the wrong cwd.
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');

const domain = process.argv[2];
const stageName = process.argv[3];
// process.argv[4] is an optional status word (e.g. "done") — accepted
// for compatibility with `log-stage.cjs <domain> <stage> done` calls.
// Currently we only record completedAt; status is ignored.

if (!domain || !stageName) {
  console.error('Usage: node scripts/log-stage.cjs <domain> <stage-name> [status]');
  process.exit(1);
}

const metricsPath = path.join(REPO_ROOT, 'jobs', domain, 'metrics.json');
if (!fs.existsSync(metricsPath)) {
  console.error(`Metrics file not found: ${metricsPath}. Run init-metrics.cjs first.`);
  process.exit(1);
}

const metrics = JSON.parse(fs.readFileSync(metricsPath, 'utf8'));
metrics.stages = metrics.stages || {};
metrics.stages[stageName] = metrics.stages[stageName] || {};
metrics.stages[stageName].completedAt = new Date().toISOString();

fs.writeFileSync(metricsPath, JSON.stringify(metrics, null, 2));
console.log(`✓ Logged stage "${stageName}" completion for ${domain}`);
