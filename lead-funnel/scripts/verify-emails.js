// Verify outreach_email deliverability via a third-party API (MillionVerifier
// by default; ZeroBounce / NeverBounce supported as alternates).
//
// Why this exists: building a /webfactory site for a lead with a dead email
// is ~$5-10 of wasted compute. Verifying upstream catches dead mailboxes
// BEFORE we spend the build budget. Reactive bounces (caught after outreach
// via AgentMail) are too late — we've already paid to build.
//
// Provider precedence (first non-empty wins):
//   1. MILLIONVERIFIER_API_KEY  — $0.0011/check, simple GET REST
//   2. ZEROBOUNCE_API_KEY       — $0.0065/check
//   3. NEVERBOUNCE_API_KEY      — $0.008/check, 1000 free trial credits
//
// Outcomes recorded in leads.email_status:
//   valid       — provider says deliverable
//   invalid     — provider says undeliverable (mailbox doesn't exist, syntax,
//                 disposable address, or domain dead)
//   catch_all   — provider can't tell (server accepts everything); risky
//   unknown     — provider checked but result inconclusive
//   error       — API call failed (network / quota); safe to retry
//
// CLI:
//   node scripts/verify-emails.js                   # verify all unverified actionable leads
//   node scripts/verify-emails.js --all             # re-verify everyone (ignore prior status)
//   node scripts/verify-emails.js --limit 50        # just the first 50
//   node scripts/verify-emails.js --email <e>       # verify a single email (debug)
//   node scripts/verify-emails.js --dry             # don't write to DB

import '../load-env.js';
import db, { updateLead } from '../db.js';

const args = process.argv.slice(2);
let mode = 'unverified';
let limit = null;
let dry = false;
let oneEmail = null;
let statusFilter = null;
let force = false;
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--all') mode = 'all';
  else if (a === '--limit') limit = parseInt(args[++i], 10);
  else if (a === '--dry' || a === '--dry-run') dry = true;
  else if (a === '--email') oneEmail = args[++i];
  else if (a === '--status') statusFilter = args[++i];  // comma-separated
  else if (a === '--pipelined') statusFilter = 'queued_for_rebuild,rebuilt';
  else if (a === '--force') force = true;  // re-verify even if already verified
}

// ---- Provider abstraction ------------------------------------------------

const providers = [];
if (process.env.MILLIONVERIFIER_API_KEY) {
  providers.push({ name: 'millionverifier', key: process.env.MILLIONVERIFIER_API_KEY, verify: verifyMillionVerifier });
}
if (process.env.ZEROBOUNCE_API_KEY) {
  providers.push({ name: 'zerobounce', key: process.env.ZEROBOUNCE_API_KEY, verify: verifyZeroBounce });
}
if (process.env.NEVERBOUNCE_API_KEY) {
  providers.push({ name: 'neverbounce', key: process.env.NEVERBOUNCE_API_KEY, verify: verifyNeverBounce });
}
if (providers.length === 0) {
  console.error('[verify-emails] No verification API key configured.');
  console.error('  Set MILLIONVERIFIER_API_KEY (cheapest, $0.0011/check) in lead-funnel/.env, OR');
  console.error('  Set ZEROBOUNCE_API_KEY ($0.0065/check), OR');
  console.error('  Set NEVERBOUNCE_API_KEY ($0.008/check; 1000 free trial credits).');
  process.exit(1);
}
const PRIMARY = providers[0];
console.log(`[verify-emails] using ${PRIMARY.name}`);

async function verifyMillionVerifier(email, key) {
  // https://app.millionverifier.com/api-documentation
  // GET https://api.millionverifier.com/api/v3/?api=KEY&email=ADDR&timeout=10
  // Response: { email, quality, result, resultcode, subresult, free, role,
  //             didyoumean, credits, executiontime }
  // result ∈ { "ok", "catch_all", "unknown", "error", "disposable", "invalid" }
  const url = `https://api.millionverifier.com/api/v3/?api=${encodeURIComponent(key)}&email=${encodeURIComponent(email)}&timeout=20`;
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`http_${res.status}`);
  const data = await res.json();
  const map = {
    ok: 'valid',
    invalid: 'invalid',
    disposable: 'invalid',  // disposable mail = effectively unreachable for us
    catch_all: 'catch_all',
    unknown: 'unknown',
    error: 'error',
  };
  return {
    status: map[data.result] || 'unknown',
    reason: data.subresult || data.result || '',
    raw: { result: data.result, quality: data.quality, free: data.free, role: data.role, didyoumean: data.didyoumean || null, credits: data.credits },
  };
}

async function verifyZeroBounce(email, key) {
  // https://docs.zerobounce.net/v2.0/reference/email-validation
  // GET https://api.zerobounce.net/v2/validate?api_key=KEY&email=ADDR
  // status ∈ { "valid", "invalid", "catch-all", "unknown", "spamtrap",
  //            "abuse", "do_not_mail" }
  const url = `https://api.zerobounce.net/v2/validate?api_key=${encodeURIComponent(key)}&email=${encodeURIComponent(email)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`http_${res.status}`);
  const data = await res.json();
  const map = {
    valid: 'valid',
    invalid: 'invalid',
    'catch-all': 'catch_all',
    unknown: 'unknown',
    spamtrap: 'invalid',
    abuse: 'invalid',
    do_not_mail: 'invalid',
  };
  return {
    status: map[data.status] || 'unknown',
    reason: data.sub_status || data.status || '',
    raw: { status: data.status, sub_status: data.sub_status, free_email: data.free_email, did_you_mean: data.did_you_mean || null },
  };
}

async function verifyNeverBounce(email, key) {
  // https://developers.neverbounce.com/reference/single-check
  // POST https://api.neverbounce.com/v4/single/check
  //   body: { key, email }
  // result ∈ { "valid", "invalid", "disposable", "catchall", "unknown" }
  const url = `https://api.neverbounce.com/v4/single/check?key=${encodeURIComponent(key)}&email=${encodeURIComponent(email)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`http_${res.status}`);
  const data = await res.json();
  const map = {
    valid: 'valid',
    invalid: 'invalid',
    disposable: 'invalid',
    catchall: 'catch_all',
    unknown: 'unknown',
  };
  return {
    status: map[data.result] || 'unknown',
    reason: (data.flags || []).join(',') || data.result || '',
    raw: { result: data.result, flags: data.flags, suggested_correction: data.suggested_correction || null },
  };
}

// ---- Driver --------------------------------------------------------------

const cache = new Map();
async function verifyOne(email) {
  if (cache.has(email)) return cache.get(email);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    const r = { status: 'invalid', reason: 'syntax' };
    cache.set(email, r); return r;
  }
  try {
    const r = await PRIMARY.verify(email, PRIMARY.key);
    cache.set(email, r);
    return r;
  } catch (err) {
    return { status: 'error', reason: err.message?.slice(0, 100) || String(err).slice(0, 100) };
  }
}

// ---- Main ----------------------------------------------------------------

if (oneEmail) {
  const r = await verifyOne(oneEmail);
  console.log(JSON.stringify({ email: oneEmail, ...r }, null, 2));
  process.exit(0);
}

const whereParts = [`filter_status='passed'`, `outreach_email IS NOT NULL`];
if (statusFilter) {
  const statuses = statusFilter.split(',').map(s => `'${s.trim()}'`).join(',');
  whereParts.push(`status IN (${statuses})`);
}
if (mode !== 'all' && !force) {
  whereParts.push(`email_status IS NULL`);
}
const sql = `SELECT id, business_name, outreach_email FROM leads WHERE ${whereParts.join(' AND ')} ORDER BY id ${limit ? `LIMIT ${limit}` : ''}`;
const leads = db.prepare(sql).all();

console.log(`[verify-emails] ${leads.length} leads to verify (mode=${mode}${dry ? ', DRY' : ''}, provider=${PRIMARY.name})`);

const counts = { valid: 0, invalid: 0, catch_all: 0, unknown: 0, error: 0 };
let i = 0, lastCredits = null;
for (const lead of leads) {
  i++;
  const email = lead.outreach_email.trim().toLowerCase();
  const r = await verifyOne(email);
  counts[r.status] = (counts[r.status] || 0) + 1;
  if (r.raw?.credits != null) lastCredits = r.raw.credits;

  const tag = { valid: '✓', invalid: '✗', catch_all: '~', unknown: '?', error: '!' }[r.status] || '?';
  console.log(`  ${tag} [${i}/${leads.length}] ${r.status.padEnd(10)} ${email.padEnd(40)} ${(lead.business_name || '').slice(0, 30).padEnd(30)} ${(r.reason || '').slice(0, 30)}`);

  if (!dry) {
    updateLead(lead.id, {
      email_status: r.status,
      email_verified_at: new Date().toISOString(),
      email_verify_reason: r.reason ? r.reason.slice(0, 200) : null,
    });
  }
}

console.log(`\n[verify-emails] done.`);
for (const [k, v] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
  if (v > 0) console.log(`  ${k}: ${v}`);
}
if (lastCredits != null) console.log(`\n  credits remaining: ${lastCredits}`);
const validPct = leads.length ? ((counts.valid / leads.length) * 100).toFixed(1) : 0;
const invalidPct = leads.length ? ((counts.invalid / leads.length) * 100).toFixed(1) : 0;
console.log(`  valid:   ${validPct}%`);
console.log(`  invalid: ${invalidPct}%  (would be dropped)`);
