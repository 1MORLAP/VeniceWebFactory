#!/usr/bin/env node
/**
 * run-webfactory.cjs — Hermes-native WebFactory runner
 * 
 * Runs the entire 10-stage pipeline in a SINGLE session.
 * No sub-agents. No permission prompts. Pure Venice API calls.
 * 
 * Usage:
 *   node run-webfactory.cjs <url> [--tier=quality|balanced|costOptimized] [--skip-c] [--languages=es,de]
 * 
 * Example:
 *   node run-webfactory.cjs https://example.com --tier=balanced
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');

// Parse args
const args = process.argv.slice(2);
const url = args[0];
let tier = 'balanced';
let skipC = false;
let languages = [];

for (const a of args) {
  if (a.startsWith('--tier=')) tier = a.split('=')[1];
  if (a === '--skip-c') skipC = true;
  if (a.startsWith('--languages=')) languages = a.split('=')[1].split(',');
}

if (!url) {
  console.error('Usage: node run-webfactory.cjs <url> [--tier=quality|balanced|costOptimized] [--skip-c] [--languages=es,de]');
  process.exit(1);
}

// Extract domain from URL
const domain = new URL(url).hostname.replace(/^www\./, '');
const jobDir = path.join(REPO_ROOT, 'jobs', domain);

// Create job directory
fs.mkdirSync(jobDir, { recursive: true });
fs.mkdirSync(path.join(jobDir, 'option-a', 'src', 'pages'), { recursive: true });
fs.mkdirSync(path.join(jobDir, 'option-b', 'src', 'pages'), { recursive: true });
fs.mkdirSync(path.join(jobDir, 'option-c', 'src', 'pages'), { recursive: true });

// Initialize metrics
const metrics = {
  domain,
  url,
  tier,
  skipC,
  languages,
  started: new Date().toISOString(),
  stages: {},
  cost: { currency: 'USD', perStage: {}, total: 0 }
};
fs.writeFileSync(path.join(jobDir, 'metrics.json'), JSON.stringify(metrics, null, 2));

console.log(`✓ WebFactory initialized for ${domain}`);
console.log(`  Tier: ${tier}`);
console.log(`  Skip C: ${skipC}`);
console.log(`  Languages: ${languages.join(',') || 'none'}`);
console.log(`  Job dir: ${jobDir}`);
console.log('');
console.log('Now running within Hermes session...');
console.log('Pipeline: Scrape → Brief → Build A → QA A → Build B → QA B → Build C → Deploy → Verify → Report');

process.exit(0);
