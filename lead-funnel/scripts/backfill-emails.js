// Re-probe each passed lead's homepage and extract a contact email.
// Idempotent — leads with outreach_email already set are skipped.
//
// Uses fetch first (~500ms) and falls back to Playwright on 4xx WAF blocks.

import '../load-env.js';
import { chromium } from 'playwright';
import db, { updateLead } from '../db.js';

const PROBE_TIMEOUT_MS = 8000;
const PROBE_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const PLAYWRIGHT_FALLBACK_STATUSES = new Set([403, 406, 429, 503]);

const EMAIL_FALSE_POSITIVE_PATTERNS = [
  // Analytics / tracking / vendor noise
  /sentry\.io$/i, /sentry-cdn/i,
  /\.googletagmanager\.com$/i, /\.google-analytics\.com$/i,
  /\.cloudflare\.com$/i, /\.amazonaws\.com$/i,
  // Site-builder defaults that the owner never replaced
  /wixpress\.com$/i, /squarespace\.com$/i, /godaddy\.com$/i,
  /^email@email\.com$/i, /^mymail@mailservice\.com$/i,
  /^info@example\.com$/i, /^contact@example\.com$/i,
  /^name@example\.com$/i, /^test@test\.com$/i, /^sample@sample\.com$/i,
  /^you@your(domain|site)\.com$/i, /^email@yourdomain\.com$/i,
  /^email@yoursite\.com$/i, /^contact@yoursite\.com$/i,
  // Generic placeholder domains
  /@example\.(com|org|net)$/i, /@yoursite\.com$/i, /@yourdomain\.com$/i,
  /@yourcompany\.com$/i, /@email\.com$/i, /@mailservice\.com$/i,
  // No-reply / system addresses
  /^noreply@/i, /^no-reply@/i, /^donotreply@/i, /^do-not-reply@/i,
  /^postmaster@/i, /^abuse@/i, /^webmaster@/i, /^hostmaster@/i,
  // File extensions accidentally caught
  /\.(png|jpg|jpeg|gif|svg|webp|ico|css|js)$/i,
  // Test / dev placeholders
  /^sentry@|^admin@example|^test@/i,
  // Vendor placeholder emails (mirror filter.js — added 2026-05-07)
  /^info@ndiscovered\.com$/i, /@ndiscovered\.com$/i,
  /^emaildemo@hostopia\.com$/i, /@hostopia\.com$/i,
];

function isFalsePositive(email) {
  return EMAIL_FALSE_POSITIVE_PATTERNS.some(re => re.test(email));
}

// Mirror of cleanEmailString in filter.js — strip URL-encoding, doubled @,
// trailing punctuation; fix common TLD/provider typos. Returns null if the
// cleaned string doesn't look like a valid email.
const TLD_TYPO_FIXES = [
  [/\.con$/i, '.com'], [/\.cmo$/i, '.com'], [/\.cm$/i, '.com'],
  [/\.ney$/i, '.net'], [/\.ner$/i, '.net'], [/\.nrt$/i, '.net'],
  [/\.og$/i, '.org'], [/\.ogr$/i, '.org'], [/\.orgg$/i, '.org'],
];
const PROVIDER_TYPO_FIXES = [
  [/@gmial\.com$/i, '@gmail.com'], [/@gmal\.com$/i, '@gmail.com'],
  [/@gnail\.com$/i, '@gmail.com'], [/@gmailcom$/i, '@gmail.com'],
  [/@gmail\.cm$/i, '@gmail.com'],
  [/@yaho\.com$/i, '@yahoo.com'], [/@yahho\.com$/i, '@yahoo.com'],
  [/@yahoocom$/i, '@yahoo.com'],
  [/@hotmial\.com$/i, '@hotmail.com'], [/@hotmal\.com$/i, '@hotmail.com'],
  [/@hotmailcom$/i, '@hotmail.com'],
  [/@outlok\.com$/i, '@outlook.com'], [/@outlookcom$/i, '@outlook.com'],
  [/@aol\.con$/i, '@aol.com'],
  [/@sbcgloba\.net$/i, '@sbcglobal.net'],
];
function cleanEmailString(raw) {
  if (!raw) return null;
  let s = raw;
  try { s = decodeURIComponent(s); } catch {}
  s = s.trim().replace(/^[\s,;:<>"'()\[\]{}]+|[\s,;:<>"'()\[\]{}.!?]+$/g, '');
  s = s.toLowerCase().replace(/@@+/g, '@');
  for (const [re, fix] of TLD_TYPO_FIXES) {
    const next = s.replace(re, fix);
    if (next !== s) { s = next; break; }
  }
  for (const [re, fix] of PROVIDER_TYPO_FIXES) {
    const next = s.replace(re, fix);
    if (next !== s) { s = next; break; }
  }
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(s)) return null;
  return s;
}

function extractContactEmail(html, siteUrl) {
  const mailtoMatches = [...html.matchAll(/mailto:([^"'\s>]+@[^"'\s>]+)/gi)];
  const plainMatches = [...html.matchAll(/\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g)];
  const candidates = [
    ...mailtoMatches.map(m => ({ raw: m[1], priority: 1 })),
    ...plainMatches.map(m => ({ raw: m[1], priority: 2 })),
  ]
    .map(c => ({ ...c, email: cleanEmailString(c.raw) }))
    .filter(c => c.email && !isFalsePositive(c.email));
  if (candidates.length === 0) return null;

  let siteApex = null;
  try {
    siteApex = new URL(siteUrl).hostname.replace(/^www\./, '').toLowerCase();
    const parts = siteApex.split('.');
    if (parts.length > 2) siteApex = parts.slice(-2).join('.');
  } catch {}

  candidates.sort((a, b) => {
    const ad = a.email.split('@')[1] || '';
    const bd = b.email.split('@')[1] || '';
    const am = siteApex && ad.endsWith(siteApex) ? 0 : 1;
    const bm = siteApex && bd.endsWith(siteApex) ? 0 : 1;
    return a.priority !== b.priority ? a.priority - b.priority : am - bm;
  });

  const seen = new Set();
  for (const c of candidates) {
    if (!seen.has(c.email)) { seen.add(c.email); return c.email; }
  }
  return null;
}

let sharedBrowser = null;
async function pwHtml(url) {
  if (!sharedBrowser) sharedBrowser = await chromium.launch({ headless: true });
  const ctx = await sharedBrowser.newContext({ userAgent: PROBE_USER_AGENT });
  const page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(1500);
    return await page.content();
  } finally {
    await ctx.close().catch(() => {});
  }
}

async function fetchHtml(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': PROBE_USER_AGENT },
      redirect: 'follow',
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    if (res.ok) return await res.text();
    if (PLAYWRIGHT_FALLBACK_STATUSES.has(res.status)) return await pwHtml(url);
    return null;
  } catch {
    try { return await pwHtml(url); } catch { return null; }
  }
}

const leads = db.prepare(`
  SELECT id, business_name, website, outreach_email, conversion_likelihood
  FROM leads
  WHERE filter_status = 'passed' AND website IS NOT NULL AND outreach_email IS NULL
  ORDER BY conversion_likelihood DESC NULLS LAST
`).all();

// extra contact-page paths to try (filter.js tries these too)
const EXTRA_CONTACT_PATHS = ['/contact-us', '/contactus', '/contact.html'];

console.log(`[backfill-emails] processing ${leads.length} passed leads without emails`);

let found = 0, miss = 0, error = 0;
for (const lead of leads) {
  try {
    const html = await fetchHtml(lead.website);
    if (!html) { miss++; console.log(`  · ${lead.business_name}: no html`); continue; }
    const email = extractContactEmail(html, lead.website);
    if (email) {
      updateLead(lead.id, { outreach_email: email });
      found++;
      console.log(`  ✓ ${lead.business_name} → ${email}`);
    } else {
      // Try /contact + variants
      let foundViaContact = null;
      try {
        const u = new URL(lead.website);
        for (const p of ['/contact', ...EXTRA_CONTACT_PATHS]) {
          const cu = `${u.origin}${p}`;
          const ch = await fetchHtml(cu);
          if (!ch) continue;
          const ce = extractContactEmail(ch, lead.website);
          if (ce) { foundViaContact = { email: ce, path: p }; break; }
        }
      } catch {}
      if (foundViaContact) {
        updateLead(lead.id, { outreach_email: foundViaContact.email });
        found++;
        console.log(`  ✓ ${lead.business_name} → ${foundViaContact.email} (via ${foundViaContact.path})`);
      } else {
        miss++;
        console.log(`  · ${lead.business_name}: no email found`);
      }
    }
  } catch (err) {
    error++;
    console.error(`  ✗ ${lead.business_name}: ${err.message}`);
  }
}

if (sharedBrowser) await sharedBrowser.close().catch(() => {});

console.log(`\n[backfill-emails] found=${found} miss=${miss} error=${error}`);
console.log(`[backfill-emails] reachable rate: ${((found / leads.length) * 100).toFixed(0)}%`);
