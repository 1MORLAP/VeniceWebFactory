#!/usr/bin/env node
/**
 * url-to-domain.cjs — portable URL → domain derivation
 *
 * Built 2026-05-05 to replace the latently-broken sed prose
 * `sed 's|https\\?://||; s|www\\.||; s|/.*||'` which only works under
 * GNU sed (Linux). On macOS BSD sed, `\\?` is treated literally, so the
 * orchestrator's $DOMAIN variable would end up with "https:" prefix.
 * Existing pipelines work because init-metrics.cjs derives the domain
 * INTERNALLY in JS — but every other script call needs DOMAIN as input.
 *
 * Usage:
 *   node scripts/url-to-domain.cjs <url> [--suffix=<s>]
 *
 * Examples:
 *   node scripts/url-to-domain.cjs https://www.example.com/path
 *     → example.com
 *   node scripts/url-to-domain.cjs https://example.com --suffix=-ab-balanced
 *     → example.com-ab-balanced
 *
 * Exit code: 0 always (for shell-substitution friendliness).
 */

const args = process.argv.slice(2);
let url = null;
let suffix = '';
for (const a of args) {
  if (a.startsWith('--suffix=')) { suffix = a.split('=')[1] || ''; continue; }
  if (!url && !a.startsWith('--')) url = a;
}

if (!url) {
  console.error('Usage: node scripts/url-to-domain.cjs <url> [--suffix=<s>]');
  process.exit(1);
}

const domain = url
  .replace(/^https?:\/\//i, '')
  .replace(/^www\./i, '')
  .replace(/\/.*$/, '')
  .toLowerCase();

console.log(domain + suffix);
