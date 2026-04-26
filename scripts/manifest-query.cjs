#!/usr/bin/env node
/**
 * WebFactory Manifest Query Helper
 *
 * Extracts specific info from manifest.json for use in bash scripts.
 * Avoids complex inline `node -e` calls with braces that trip safety checks.
 *
 * Usage: node scripts/manifest-query.js <domain> <query>
 *
 * Queries:
 *   page-count          → number of pages
 *   page-slugs          → one slug per line (for loop iteration, excludes home)
 *   testimonial-count   → total testimonials across all pages
 *   manifest-bytes      → file size of manifest.json
 */

const fs = require('fs');
const path = require('path');

const domain = process.argv[2];
const query = process.argv[3];

if (!domain || !query) {
  console.error('Usage: node scripts/manifest-query.js <domain> <query>');
  console.error('Queries: page-count, page-slugs, testimonial-count, manifest-bytes');
  process.exit(1);
}

const manifestPath = path.join('jobs', domain, 'manifest.json');
if (!fs.existsSync(manifestPath)) {
  console.error(`Manifest not found: ${manifestPath}`);
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

switch (query) {
  case 'page-count':
    console.log(manifest.pages.length);
    break;

  case 'page-slugs': {
    // Emit one slug per line, excluding homepage. Used by bash for-loops.
    for (const page of manifest.pages) {
      const slug = page.url === '/' ? '' : page.url.replace(/^\//, '').replace(/\/$/, '');
      if (slug) console.log(slug);
    }
    break;
  }

  case 'testimonial-count': {
    let total = 0;
    for (const page of manifest.pages) {
      if (Array.isArray(page.testimonials)) total += page.testimonials.length;
    }
    console.log(total);
    break;
  }

  case 'manifest-bytes':
    console.log(fs.statSync(manifestPath).size);
    break;

  default:
    console.error(`Unknown query: ${query}`);
    console.error('Available: page-count, page-slugs, testimonial-count, manifest-bytes');
    process.exit(1);
}
