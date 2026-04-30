// Re-run industry normalization on every lead that already has a value.
// Safe to run repeatedly (idempotent).

import '../load-env.js';
import db, { updateLead } from '../db.js';
import { normalizeIndustry } from '../score.js';

const leads = db.prepare(
  'SELECT id, business_name, industry FROM leads WHERE industry IS NOT NULL'
).all();

let changed = 0, kept = 0;
for (const lead of leads) {
  const fixed = normalizeIndustry(lead.industry, lead);
  if (fixed !== lead.industry) {
    updateLead(lead.id, { industry: fixed });
    console.log(`  ${lead.business_name}: '${lead.industry}' → '${fixed}'`);
    changed++;
  } else {
    kept++;
  }
}

console.log(`[normalize-industries] changed=${changed} kept=${kept}`);
