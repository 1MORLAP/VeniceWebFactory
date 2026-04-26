#!/usr/bin/env node
/**
 * WebFactory Port Reader
 *
 * Reads the allocated port for a domain+option from metrics.json.
 * Three-track architecture: A, B, C.
 *
 * Usage: node scripts/get-port.cjs <domain> <a|b|c>
 */

const fs = require('fs');
const path = require('path');

const domain = process.argv[2];
const option = process.argv[3];

const VALID_OPTIONS = ['a', 'b', 'c', 'A', 'B', 'C'];

if (!domain || !option || !VALID_OPTIONS.includes(option)) {
  console.error('Usage: node scripts/get-port.cjs <domain> <a|b|c>');
  process.exit(1);
}

const metricsPath = path.join('jobs', domain, 'metrics.json');
if (!fs.existsSync(metricsPath)) {
  console.error(`Metrics file not found: ${metricsPath}. Run init-metrics.cjs first.`);
  process.exit(1);
}

const metrics = JSON.parse(fs.readFileSync(metricsPath, 'utf8'));
if (!metrics.ports) {
  console.error('No ports allocated in metrics.json');
  process.exit(1);
}

const normalized = option.toLowerCase();
const key = normalized === 'a' ? 'optionA' : normalized === 'b' ? 'optionB' : 'optionC';

if (!(key in metrics.ports)) {
  // Back-compat: legacy metrics.json may have lacked B or C entries
  if (key === 'optionC' && 'optionB' in metrics.ports) {
    console.log(metrics.ports.optionB + 1);
    process.exit(0);
  }
  if (key === 'optionB' && 'optionA' in metrics.ports) {
    console.log(metrics.ports.optionA + 1);
    process.exit(0);
  }
  console.error(`Port key ${key} not found in metrics.json`);
  process.exit(1);
}

console.log(metrics.ports[key]);
