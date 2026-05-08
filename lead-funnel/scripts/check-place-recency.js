// Use Google Places Details API (v1) to fetch each lead's most recent review
// and rating-count. The recency of the newest review is the strongest free
// heartbeat we have for whether a small business is still active.
//
// Why this exists: Google's `business_status='OPERATIONAL'` is sticky — a
// shop that closed 2 years ago may still show OPERATIONAL because nobody
// updated the listing. But the last review date doesn't lie: if no one has
// reviewed the business since 2019, the business is probably gone.
//
// Cost: ~$0.017 per call (Atmosphere data tier in Places API New).
// 1000 leads = ~$17.
//
// Outcomes recorded in leads.last_review_at:
//   ISO timestamp string (most recent review's publishTime)
//   NULL if no reviews at all (also a weak liveness signal)
//
// CLI:
//   node scripts/check-place-recency.js                # check unchecked actionable
//   node scripts/check-place-recency.js --all          # re-check everyone
//   node scripts/check-place-recency.js --pipelined    # just queued + rebuilt
//   node scripts/check-place-recency.js --limit 50
//   node scripts/check-place-recency.js --dry          # preview, no DB write
//   node scripts/check-place-recency.js --place-id <id>  # single-lookup debug

import '../load-env.js';
import db, { updateLead } from '../db.js';

const args = process.argv.slice(2);
let mode = 'unchecked';
let limit = null;
let statusFilter = null;
let dry = false;
let onePlaceId = null;
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--all') mode = 'all';
  else if (a === '--limit') limit = parseInt(args[++i], 10);
  else if (a === '--status') statusFilter = args[++i];
  else if (a === '--pipelined') statusFilter = 'queued_for_rebuild,rebuilt';
  else if (a === '--dry' || a === '--dry-run') dry = true;
  else if (a === '--place-id') onePlaceId = args[++i];
}

const API_KEY = process.env.GOOGLE_PLACES_API_KEY;
if (!API_KEY) {
  console.error('GOOGLE_PLACES_API_KEY not set in lead-funnel/.env');
  process.exit(1);
}

// Field mask: which fields to bill for. We need only `reviews.publishTime`
// (newest review's timestamp) and `userRatingCount`. Reviews are in the
// "Atmosphere data" tier — billed at ~$0.017 per call.
const FIELD_MASK = ['reviews.publishTime', 'reviews.rating', 'userRatingCount'].join(',');

async function fetchPlaceRecency(placeId) {
  const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`;
  const res = await fetch(url, {
    headers: {
      'X-Goog-Api-Key': API_KEY,
      'X-Goog-FieldMask': FIELD_MASK,
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`http_${res.status}: ${body.slice(0, 100)}`);
  }
  const data = await res.json();
  // reviews is up to 5 entries (Google's API caps the count). publishTime is
  // ISO 8601. Pick the latest. If there are no reviews, return null.
  const reviews = data.reviews || [];
  let latest = null;
  for (const r of reviews) {
    const t = r.publishTime;
    if (t && (!latest || t > latest)) latest = t;
  }
  return {
    last_review_at: latest,
    review_count: data.userRatingCount || 0,
    reviews_returned: reviews.length,
  };
}

// ---- Driver --------------------------------------------------------------

if (onePlaceId) {
  const r = await fetchPlaceRecency(onePlaceId);
  console.log(JSON.stringify({ place_id: onePlaceId, ...r }, null, 2));
  process.exit(0);
}

const whereParts = [`filter_status='passed'`, `outreach_email IS NOT NULL`, `place_id IS NOT NULL`];
if (statusFilter) {
  const statuses = statusFilter.split(',').map(s => `'${s.trim()}'`).join(',');
  whereParts.push(`status IN (${statuses})`);
}
if (mode !== 'all') {
  whereParts.push(`recency_checked_at IS NULL`);
}
const sql = `SELECT id, business_name, place_id, google_review_count FROM leads WHERE ${whereParts.join(' AND ')} ORDER BY conversion_likelihood DESC NULLS LAST ${limit ? `LIMIT ${limit}` : ''}`;
const leads = db.prepare(sql).all();
console.log(`[check-recency] ${leads.length} leads to probe (cost ≈ $${(leads.length * 0.017).toFixed(2)})`);

if (dry) {
  console.log('[check-recency] DRY-RUN — no API calls, no DB writes.');
  process.exit(0);
}

// Buckets: how stale is the newest review?
const now = Date.now();
const YEAR_MS = 365 * 24 * 3600 * 1000;
function bucketize(iso) {
  if (!iso) return 'no_reviews';
  const ageYears = (now - new Date(iso).getTime()) / YEAR_MS;
  if (ageYears < 0.5) return '< 6mo';
  if (ageYears < 1) return '6-12mo';
  if (ageYears < 2) return '1-2y';
  if (ageYears < 3) return '2-3y';
  if (ageYears < 5) return '3-5y';
  return '5y+';
}

const buckets = {};
let processed = 0, errors = 0;
for (const lead of leads) {
  processed++;
  let r;
  try { r = await fetchPlaceRecency(lead.place_id); }
  catch (err) {
    errors++;
    console.error(`  ! [${processed}/${leads.length}] ${lead.business_name}: ${err.message.slice(0, 60)}`);
    continue;
  }
  const b = bucketize(r.last_review_at);
  buckets[b] = (buckets[b] || 0) + 1;
  const tag = b === 'no_reviews' ? '?' : b.includes('5y+') || b.includes('3-5y') ? '✗' : '✓';
  console.log(`  ${tag} [${processed}/${leads.length}] ${b.padEnd(11)} ${(lead.business_name || '').slice(0, 32).padEnd(32)} latest=${r.last_review_at || 'none'} (${r.review_count} total)`);
  updateLead(lead.id, {
    last_review_at: r.last_review_at,
    recency_checked_at: new Date().toISOString(),
  });
  // Polite pacing — not strictly needed at v1's quotas but safe
  await new Promise(rs => setTimeout(rs, 50));
}

console.log(`\n[check-recency] done. processed=${processed} errors=${errors}`);
console.log('  recency buckets:');
const order = ['< 6mo', '6-12mo', '1-2y', '2-3y', '3-5y', '5y+', 'no_reviews'];
for (const k of order) {
  if (buckets[k]) console.log(`    ${k.padEnd(12)} ${buckets[k]}`);
}
const stale = (buckets['3-5y'] || 0) + (buckets['5y+'] || 0);
console.log(`\n  presumed dead (last review 3y+):  ${stale}`);
