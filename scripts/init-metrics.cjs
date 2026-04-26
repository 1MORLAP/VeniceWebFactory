#!/usr/bin/env node
/**
 * WebFactory Metrics Initializer
 *
 * Creates the per-domain metrics.json file with:
 * - Domain, URL, model, start timestamp
 * - Dynamic port allocation based on domain hash (for parallel builds)
 * - Empty stages object for stage-by-stage timing
 *
 * Usage: node scripts/init-metrics.js <url>
 */

const fs = require('fs');
const path = require('path');

const url = process.argv[2];
if (!url) {
  console.error('Usage: node scripts/init-metrics.js <url>');
  process.exit(1);
}

// Extract domain from URL
const domain = url.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');

// Ensure job directory exists
const jobDir = path.join('jobs', domain);
fs.mkdirSync(jobDir, { recursive: true });

// Allocate unique ports based on domain hash (deterministic per domain, avoids collisions in parallel runs)
// Each domain gets a 3-port slot: A = base, B = base+1, C = base+2
// Slots are spaced by 4 (with one buffer) so adjacent hash buckets can't collide
let hash = 0;
for (const c of domain) hash = ((hash << 5) - hash) + c.charCodeAt(0);
const portA = 10000 + ((Math.abs(hash) % 12000) * 4);
const portB = portA + 1;
const portC = portA + 2;

// Build the metrics object
const metrics = {
  domain,
  url,
  model: process.env.ANTHROPIC_MODEL || 'unknown',
  runStartedAt: new Date().toISOString(),
  ports: { optionA: portA, optionB: portB, optionC: portC },
  stages: {},
};

// Write to disk
const metricsPath = path.join(jobDir, 'metrics.json');
fs.writeFileSync(metricsPath, JSON.stringify(metrics, null, 2));

console.log(`✓ Metrics initialized for ${domain}`);
console.log(`  Ports — A: ${portA}, B: ${portB}, C: ${portC}`);
console.log(`  File: ${metricsPath}`);
