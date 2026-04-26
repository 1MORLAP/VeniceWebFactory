#!/usr/bin/env node
/**
 * WebFactory Stage Logger
 *
 * Records the completion timestamp for a given stage in metrics.json.
 *
 * Usage: node scripts/log-stage.js <domain> <stage-name>
 *
 * Stage names: scrape, designBrief, optionA, optionAQA, stitch, optionB, optionBQA, deploy
 */

const fs = require('fs');
const path = require('path');

const domain = process.argv[2];
const stageName = process.argv[3];

if (!domain || !stageName) {
  console.error('Usage: node scripts/log-stage.js <domain> <stage-name>');
  process.exit(1);
}

const metricsPath = path.join('jobs', domain, 'metrics.json');
if (!fs.existsSync(metricsPath)) {
  console.error(`Metrics file not found: ${metricsPath}. Run init-metrics.js first.`);
  process.exit(1);
}

const metrics = JSON.parse(fs.readFileSync(metricsPath, 'utf8'));
metrics.stages = metrics.stages || {};
metrics.stages[stageName] = metrics.stages[stageName] || {};
metrics.stages[stageName].completedAt = new Date().toISOString();

fs.writeFileSync(metricsPath, JSON.stringify(metrics, null, 2));
console.log(`✓ Logged stage "${stageName}" completion for ${domain}`);
