#!/usr/bin/env node
/**
 * WebFactory Metrics Initializer
 *
 * Creates the per-domain metrics.json file with:
 * - Domain, URL, model, start timestamp
 * - Dynamic port allocation based on domain hash (for parallel builds)
 * - Empty stages object for stage-by-stage timing
 *
 * Usage: node scripts/init-metrics.cjs <url> [--suffix=<string>]
 *
 * The optional --suffix flag (added 2026-05-05 for Phase D A/B variants)
 * appends to the derived domain name when computing the job directory.
 * Example: --suffix=-ab-balanced creates jobs/{domain}-ab-balanced/
 * instead of jobs/{domain}/. The metrics.domain field stores the
 * SUFFIXED name so all downstream scripts (which key off domain) read
 * the same suffixed dir consistently. The metrics.canonicalDomain field
 * stores the URL-derived name without suffix for reference.
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
let url = null;
let suffix = '';
for (const a of args) {
  if (a.startsWith('--suffix=')) { suffix = a.split('=')[1] || ''; continue; }
  if (!url && !a.startsWith('--')) url = a;
}

if (!url) {
  console.error('Usage: node scripts/init-metrics.cjs <url> [--suffix=<string>]');
  process.exit(1);
}

// Extract canonical domain from URL (no suffix).
const canonicalDomain = url.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');

// Apply optional suffix. The suffixed domain is what downstream scripts use
// as their <domain> arg — keeps each A/B variant isolated in its own dir.
const domain = canonicalDomain + suffix;

// Ensure job directory exists
const jobDir = path.join(REPO_ROOT, 'jobs', domain);
fs.mkdirSync(jobDir, { recursive: true });

// Allocate unique ports based on domain hash (deterministic per domain, avoids collisions in parallel runs)
// Each domain gets a 3-port slot: A = base, B = base+1, C = base+2
// Slots are spaced by 4 (with one buffer) so adjacent hash buckets can't collide
// IMPORTANT: hash uses the SUFFIXED domain, so A/B variants get DIFFERENT
// ports than the canonical build — required if all variants run in parallel.
let hash = 0;
for (const c of domain) hash = ((hash << 5) - hash) + c.charCodeAt(0);
const portA = 10000 + ((Math.abs(hash) % 12000) * 4);
const portB = portA + 1;
const portC = portA + 2;

// Build the metrics object
const metrics = {
  domain,
  canonicalDomain,
  url,
  model: process.env.ANTHROPIC_MODEL || 'unknown',
  runStartedAt: new Date().toISOString(),
  ports: { optionA: portA, optionB: portB, optionC: portC },
  stages: {},
};
if (suffix) metrics.abVariant = suffix.replace(/^-ab-/, '');   // e.g. "balanced", "aggressive"

// Write to disk
const metricsPath = path.join(jobDir, 'metrics.json');
fs.writeFileSync(metricsPath, JSON.stringify(metrics, null, 2));

console.log(`✓ Metrics initialized for ${domain}${suffix ? ` (A/B variant: ${metrics.abVariant})` : ''}`);
console.log(`  Ports — A: ${portA}, B: ${portB}, C: ${portC}`);
console.log(`  File: ${metricsPath}`);
