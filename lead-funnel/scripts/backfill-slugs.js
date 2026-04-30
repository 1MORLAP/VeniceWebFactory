// One-shot: assign marketplace_slug to every lead that doesn't already have one.
// Run after the DB has accumulated leads but before the marketplace goes live.
// Re-running is safe (idempotent) — leads with slugs are skipped.

import '../load-env.js';
import db, { updateLead } from '../db.js';
import { uniqueSlugFor, marketplaceUrl } from './slug.js';

const leads = db.prepare(
  'SELECT id, place_id, business_name, city, state, marketplace_slug FROM leads ORDER BY id'
).all();

let assigned = 0, skipped = 0, failed = 0;
const collisions = [];

for (const lead of leads) {
  if (lead.marketplace_slug) { skipped++; continue; }
  const slug = uniqueSlugFor(lead);
  if (!slug) {
    failed++;
    console.error(`✗ no slug for ${lead.business_name} (id=${lead.id})`);
    continue;
  }
  updateLead(lead.id, {
    marketplace_slug: slug,
    marketplace_url: marketplaceUrl(slug),
  });
  assigned++;
  // Track which slugs needed disambiguation (multi-segment)
  const baseFromName = slug.split('-').slice(0, 4).join('-');
  if (slug.split('-').length > baseFromName.split('-').length) {
    collisions.push({ name: lead.business_name, slug });
  }
}

console.log(`[backfill] assigned=${assigned} skipped=${skipped} failed=${failed}`);
if (collisions.length) {
  console.log(`[backfill] ${collisions.length} disambiguation slugs:`);
  for (const c of collisions) console.log(`  ${c.name} → ${c.slug}`);
}
