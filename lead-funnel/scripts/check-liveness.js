// Check whether each lead's website is actually alive.
//
// Google Places `business_status='OPERATIONAL'` is sticky — businesses that
// shut down years ago can still show OPERATIONAL because nobody updated the
// listing. The website itself is a stronger heartbeat: if it's parked,
// returns 404, has a dead SSL cert, or is suspiciously thin, the business
// is probably gone.
//
// Outcomes recorded in leads.site_status:
//   live          — 200 OK, ≥5KB HTML, no parking markers
//   thin          — 200 OK but < 5KB HTML (unusual for a real biz site)
//   parked        — known parking-platform marker in body
//   error         — 4xx HTTP status (404, 403, 410, etc.)
//   server_error  — 5xx HTTP status
//   ssl_error     — SSL/TLS handshake failed
//   dns_error     — domain doesn't resolve
//   timeout       — fetch timed out (10s)
//   redirect_loop — too many redirects
//
// CLI:
//   node scripts/check-liveness.js                # check all unverified actionable
//   node scripts/check-liveness.js --all          # re-check everyone
//   node scripts/check-liveness.js --pipelined    # just queued + rebuilt
//   node scripts/check-liveness.js --limit 50
//   node scripts/check-liveness.js --concurrency 10

import '../load-env.js';
import db, { updateLead } from '../db.js';

const args = process.argv.slice(2);
let mode = 'unchecked';
let limit = null;
let statusFilter = null;
let concurrency = 8;
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--all') mode = 'all';
  else if (a === '--limit') limit = parseInt(args[++i], 10);
  else if (a === '--status') statusFilter = args[++i];
  else if (a === '--pipelined') statusFilter = 'queued_for_rebuild,rebuilt';
  else if (a === '--concurrency') concurrency = parseInt(args[++i], 10);
}

const FETCH_TIMEOUT_MS = 10_000;
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Parking-platform / for-sale markers. Most domain parking pages use one of
// these phrases verbatim — they're served by a small handful of platforms
// (Sedo, GoDaddy, HugeDomains, Bodis/ParkingCrew, Afternic).
const PARKED_MARKERS = [
  'this domain may be for sale',
  'this domain is for sale',
  'buy this domain',
  'this domain has expired',
  'domain is parked',
  'domain has been parked',
  'parkingcrew.net',
  'sedoparking.com',
  'sedo.com/search',
  'hugedomains.com',
  'afternic.com',
  'godaddy.com/forsale',
  'godaddy.com/dpp',
  'register this domain',
  'inquire about this domain',
  'make an offer on this domain',
  // Common parked-page text that doesn't include the word "domain"
  'related searches',  // SEDO
  'domain for sale',
];

function classifyHtml(html, status) {
  if (!html) return { status: 'error', reason: `http_${status || 'no_response'}` };
  const lower = html.toLowerCase();
  for (const marker of PARKED_MARKERS) {
    if (lower.includes(marker)) {
      // 2nd-level guard: the marker must appear without lots of normal page
      // chrome around it (parked pages are tiny).
      if (html.length < 50_000) return { status: 'parked', reason: `marker:${marker.slice(0, 30)}` };
    }
  }
  if (html.length < 1000) return { status: 'thin', reason: `html_${html.length}b` };
  if (html.length < 5000) return { status: 'thin', reason: `html_${html.length}b` };
  return { status: 'live', reason: `${html.length}b` };
}

async function probe(url) {
  let res;
  try {
    res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      redirect: 'follow',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (err) {
    const code = err.code || err.cause?.code || err.message;
    if (/CERT_/i.test(code) || /SSL/i.test(code) || /UNABLE_TO_VERIFY/i.test(code)) {
      return { status: 'ssl_error', reason: code.slice(0, 100) };
    }
    if (/ENOTFOUND|EAI_AGAIN|ENXDOMAIN/i.test(code)) {
      return { status: 'dns_error', reason: code.slice(0, 100) };
    }
    if (/TimeoutError|TIMEOUT|ETIMEDOUT/i.test(err.name + code)) {
      return { status: 'timeout', reason: 'fetch timeout 10s' };
    }
    if (/redirect/i.test(code)) {
      return { status: 'redirect_loop', reason: code.slice(0, 100) };
    }
    return { status: 'error', reason: code.slice(0, 100) };
  }
  if (res.status >= 500) return { status: 'server_error', reason: `http_${res.status}` };
  if (res.status >= 400) return { status: 'error', reason: `http_${res.status}` };
  let html = '';
  try { html = await res.text(); } catch { return { status: 'error', reason: 'body_read_failed' }; }
  return classifyHtml(html, res.status);
}

// ---- Driver --------------------------------------------------------------

const whereParts = [`filter_status='passed'`, `outreach_email IS NOT NULL`];
if (statusFilter) {
  const statuses = statusFilter.split(',').map(s => `'${s.trim()}'`).join(',');
  whereParts.push(`status IN (${statuses})`);
}
if (mode !== 'all') {
  whereParts.push(`site_status IS NULL`);
}
const sql = `SELECT id, business_name, website FROM leads WHERE ${whereParts.join(' AND ')} AND website IS NOT NULL ORDER BY id ${limit ? `LIMIT ${limit}` : ''}`;
const leads = db.prepare(sql).all();
console.log(`[check-liveness] ${leads.length} leads to probe (concurrency=${concurrency})`);

const counts = { live: 0, thin: 0, parked: 0, error: 0, server_error: 0, ssl_error: 0, dns_error: 0, timeout: 0, redirect_loop: 0 };
let done = 0;

async function processOne(lead) {
  const r = await probe(lead.website);
  counts[r.status] = (counts[r.status] || 0) + 1;
  done++;

  const tag = {
    live: '✓', thin: '~', parked: '✗', error: '✗', server_error: '?',
    ssl_error: '?', dns_error: '✗', timeout: '?', redirect_loop: '?',
  }[r.status] || '?';
  console.log(`  ${tag} [${done}/${leads.length}] ${r.status.padEnd(13)} ${(lead.business_name || '').slice(0, 32).padEnd(32)} ${lead.website.slice(0, 50)} ${(r.reason || '').slice(0, 30)}`);

  updateLead(lead.id, {
    site_status: r.status,
    site_status_reason: r.reason ? r.reason.slice(0, 200) : null,
    site_status_at: new Date().toISOString(),
  });
}

// Simple concurrency: keep a worker pool of N
async function runPool(items, workerN) {
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      try { await processOne(items[idx]); }
      catch (err) {
        counts.error = (counts.error || 0) + 1;
        done++;
        console.error(`  ! ${items[idx].business_name}: ${err.message}`);
      }
    }
  }
  await Promise.all(Array.from({ length: workerN }, () => worker()));
}

await runPool(leads, concurrency);

console.log(`\n[check-liveness] done.`);
for (const [k, v] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
  if (v > 0) console.log(`  ${k}: ${v}`);
}
const dead = (counts.parked || 0) + (counts.error || 0) + (counts.dns_error || 0);
console.log(`\n  presumed dead: ${dead}  (parked + 4xx + dns_error)`);
console.log(`  ambiguous:     ${(counts.thin || 0) + (counts.timeout || 0) + (counts.server_error || 0) + (counts.ssl_error || 0) + (counts.redirect_loop || 0)}`);
console.log(`  alive:         ${counts.live || 0}`);
