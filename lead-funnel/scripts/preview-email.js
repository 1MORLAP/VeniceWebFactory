// Render the outreach email for one lead and write it to disk for review.
//
//   node scripts/preview-email.js <lead-id>           # by leads.id
//   node scripts/preview-email.js <slug>              # by marketplace_slug
//   node scripts/preview-email.js --top               # the top conversion-likelihood lead
//
// Writes:
//   /tmp/email-preview-<slug>.html   (open in a browser)
//   /tmp/email-preview-<slug>.txt    (plain-text version)
// And prints subject + URL to stdout.

import '../load-env.js';
import fs from 'node:fs';
import path from 'node:path';
import db from '../db.js';
import { renderEmail } from './email-template.js';

const args = process.argv.slice(2);
let lead = null;

if (args[0] === '--top' || args.length === 0) {
  lead = db.prepare(`
    SELECT * FROM leads
    WHERE marketplace_slug IS NOT NULL AND conversion_likelihood IS NOT NULL
    ORDER BY conversion_likelihood DESC LIMIT 1
  `).get();
} else if (/^\d+$/.test(args[0])) {
  lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(parseInt(args[0], 10));
} else {
  lead = db.prepare('SELECT * FROM leads WHERE marketplace_slug = ?').get(args[0]);
}

if (!lead) {
  console.error('No matching lead. Usage:');
  console.error('  node scripts/preview-email.js --top');
  console.error('  node scripts/preview-email.js <lead-id>');
  console.error('  node scripts/preview-email.js <marketplace-slug>');
  process.exit(1);
}

const out = renderEmail(lead);
const dir = '/tmp';
const htmlPath = path.join(dir, `email-preview-${lead.marketplace_slug}.html`);
const textPath = path.join(dir, `email-preview-${lead.marketplace_slug}.txt`);
fs.writeFileSync(htmlPath, out.html);
fs.writeFileSync(textPath, out.text);

console.log(`Lead:       ${lead.business_name} (${lead.city}, ${lead.state})`);
console.log(`Slug:       ${lead.marketplace_slug}`);
console.log(`URL:        ${out.marketplace_url}`);
console.log(`Subject:    ${out.subject}`);
console.log(`Conv:       ${lead.conversion_likelihood?.toFixed?.(0) ?? '—'}`);
console.log(`Awful/Tech: ${lead.awfulness_score ?? '—'}/${lead.tech_age_score ?? '—'}`);
console.log(`Industry:   ${lead.industry ?? '—'}`);
console.log('');
console.log(`HTML preview: file://${htmlPath}`);
console.log(`Text preview: file://${textPath}`);
console.log('');
console.log('--- TEXT ---');
console.log(out.text);
