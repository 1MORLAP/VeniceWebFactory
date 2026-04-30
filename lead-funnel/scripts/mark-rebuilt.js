// Mark a lead as rebuilt (or published) by domain or URL.
// Idempotent — safe to run multiple times. Soft-fails when the domain
// isn't in our funnel (so /webfactory rebuilds of ad-hoc URLs don't error).
//
// Designed to be called from /webfactory's Stage 10 after a successful build:
//
//   node /Users/tomasz/WebFactory/lead-funnel/scripts/mark-rebuilt.js \
//     --domain <domain> \
//     --marketplace-url <option-c-deployed-url>
//
// Or manually after any rebuild:
//
//   node mark-rebuilt.js --url https://www.example.com/                # mark rebuilt
//   node mark-rebuilt.js --domain example.com --status published \
//     --marketplace-url https://webfactory.market/example
//
// CLI:
//   --domain <domain>           — required if --url not given (eg "example.com")
//   --url <url>                 — alternative to --domain; we extract the apex
//   --marketplace-url <url>     — optional; sets leads.marketplace_url + listed_at
//   --status <status>           — default 'rebuilt'. Use 'published' once
//                                 the marketplace listing is live.
//   --notes <text>              — optional free-form notes appended to the lead

import '../load-env.js';
import db, { updateLead } from '../db.js';

const args = process.argv.slice(2);
let domain = null, url = null, marketplaceUrl = null, status = 'rebuilt', notes = null;

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--domain') domain = args[++i];
  else if (a === '--url') url = args[++i];
  else if (a === '--marketplace-url') marketplaceUrl = args[++i];
  else if (a === '--status') status = args[++i];
  else if (a === '--notes') notes = args[++i];
}

function toApexDomain(input) {
  if (!input) return null;
  let v = input.trim();
  // If it looks like a URL, parse it; otherwise treat as a bare domain
  try {
    if (/^https?:\/\//i.test(v) || v.includes('/')) {
      v = new URL(v.startsWith('http') ? v : `https://${v}`).hostname;
    }
  } catch {}
  return v.toLowerCase().replace(/^www\./, '');
}

const lookup = toApexDomain(domain || url);
if (!lookup) {
  console.error('Usage: mark-rebuilt.js --domain <domain> | --url <url>');
  console.error('       optional: --marketplace-url <url> --status <rebuilt|published> --notes "..."');
  process.exit(1);
}

const validStatuses = new Set(['rebuilt', 'published', 'outreach_sent', 'sold', 'dead']);
if (!validStatuses.has(status)) {
  console.error(`[mark-rebuilt] invalid --status '${status}'. Must be one of: ${[...validStatuses].join(', ')}`);
  process.exit(2);
}

// Find the lead by domain. Prefer exact match on `domain` column; fall back
// to www-prefixed match on `website` for older rows that didn't get domain set.
let lead = db.prepare(
  'SELECT id, business_name, status, marketplace_url, notes FROM leads WHERE domain = ? LIMIT 1'
).get(lookup);
if (!lead) {
  lead = db.prepare(`
    SELECT id, business_name, status, marketplace_url, notes FROM leads
    WHERE website LIKE ? OR website LIKE ?
    LIMIT 1
  `).get(`%//${lookup}/%`, `%//www.${lookup}/%`);
}

if (!lead) {
  // Soft-fail — /webfactory might be rebuilding ad-hoc URLs not in our funnel.
  console.warn(`[mark-rebuilt] no lead in funnel matches domain=${lookup} — skipping (this is fine if the rebuild was ad-hoc).`);
  process.exit(0);
}

const updates = {
  status,
  status_changed_at: new Date().toISOString(),
};
if (marketplaceUrl) {
  updates.marketplace_url = marketplaceUrl;
  if (status === 'published' || lead.status !== 'published') {
    updates.marketplace_listed_at = new Date().toISOString();
  }
}
if (notes) {
  updates.notes = [lead.notes, notes].filter(Boolean).join('\n');
}

updateLead(lead.id, updates);

console.log(`[mark-rebuilt] ✓ ${lead.business_name} (id=${lead.id}): status='${status}'${marketplaceUrl ? `\n   marketplace_url=${marketplaceUrl}` : ''}`);
