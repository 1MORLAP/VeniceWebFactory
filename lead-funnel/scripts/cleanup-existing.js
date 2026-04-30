// Apply current blocklist + scope filters to all leads already in the DB.
// Idempotent — leads already rejected for these reasons are left alone.
//
// Filters applied here (in order):
//   1. legal_risk        — law firms (name-pattern, fast)
//   2. industry blocklist — leads scored as industry='law' (post-score catch)
//   3. government_entity — gov / state board sites
//   4. duplicate_domain  — multiple Place listings on the same site
//   5. complex_integration — true booking systems (Calendly etc.) ONLY when
//      they appear to be same-domain; external vendor links/iframes are kept.
//      In V1, conservatively kept for booking-only domains.
//   6. site_too_big      — >100 anchors (HTML probe). Stahl Plumbing-class.
//      Out of scope for V1 (we rebuild small-to-medium marketing sites).

import '../load-env.js';
import { chromium } from 'playwright';
import db, { updateLead, listAllLeads } from '../db.js';

const PROBE_TIMEOUT_MS = 8000;
const PROBE_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const PLAYWRIGHT_FALLBACK_STATUSES = new Set([403, 406, 429, 503]);

// ---- Mirrored rule sets (kept in sync with filter.js) ---------------------

const LAW_NAME_PATTERNS = [
  /\battorney(?:s)?\b/i, /\bat law\b/i, /\blaw firm\b/i,
  /\blaw offices?\b/i, /\blaw group\b/i, /\blaw center\b/i,
  /\blawyers?\b/i, /\blegal services\b/i, /\blegal group\b/i,
  /\bcounsel(?:ors)?\b.*\b(law|legal)\b/i, /\b(esquire|esq\.?)\b/i,
  /\bpersonal injury\b/i, /\bbankruptcy law\b/i, /\bcriminal defense\b/i,
  /\bestate planning\b.*\battorney\b/i, /\bfamily law\b/i,
  /\bdivorce attorney\b/i,
  /\b(pllc|pllp|pc|p\.c\.|llp|lc)\b.*\battorney\b/i,
  /\battorney\b.*\b(pllc|pllp|pc|p\.c\.|llp|lc)\b/i,
];

const ASSOCIATION_NAME_PATTERNS = [
  /\bassociation\b/i, /\bchamber of commerce\b/i, /\bfoundation\b/i,
  /\bsociety of\b/i, /\bsociety for\b/i, /\bcoalition\b/i, /\bguild\b/i,
  /\bcouncil of\b/i, /\bnonprofit\b/i, /\bnon[\s-]profit\b/i,
  /\btrade group\b/i, /\bunion local\b/i,
];

const GOV_DOMAIN_PATTERNS = [
  /\.gov(\/|$|\?)/i, /\.gov\./i,
  /\bsos\..*\.us\//i, /\.state\.[a-z]{2}\.us\//i, /\.k12\.[a-z]{2}\.us\//i,
];
const GOV_NAME_PATTERNS = [
  /\bstate board of\b/i,
  /\bboard of\b.*\b(examiners|registration|certification|licensure)\b/i,
  /\bdepartment of\b/i, /\bbureau of\b/i,
  /\bcommission(?:ers)?\b.*\b(state|county|federal)\b/i,
  /\bcouncil of\b/i,
  /\bauthority\b.*\b(state|county|federal|public|housing|transit)\b/i,
  /\bagency\b.*\b(state|county|federal|public)\b/i,
  /\b(division|office) of\b/i, /\bregulatory\b/i, /\blicensing board\b/i,
  /\bexaminers\b/i,
];

// Mirror filter.js — only TRUE booking / scheduling / practice-management
// systems. Form integrations (JotForm, Typeform, Gravity Forms, Weave forms,
// etc.) are V1-fine; we replace them with mailto in the rebuild.
const COMPLEX_TECH_TOKENS = [
  'calendly.com', 'assets.calendly.com',
  'acuityscheduling.com', 'app.acuityscheduling.com', 'app.squarespacescheduling.com',
  'simplepractice.com', 'zocdoc.com', 'widget.zocdoc.com',
  'vagaro.com', 'booking.vagaro.com', 'styleseat.com',
  'squareup.com/appointments', 'square.site/book',
  'genbook.com', 'youcanbook.me', 'setmore.com', 'booksy.com', '10to8.com',
  'mindbodyonline.com', 'clients.mindbodyonline.com',
  'reservationgenie.com', 'fresha.com', 'schedulista.com',
  'opentable.com', 'opentable.us', 'resy.com', 'tock.com', 'exploretock.com',
  'yelp.com/reservations',
  'dentrix.com', 'athenanet.athenahealth.com',
];

// ---- Predicates -----------------------------------------------------------

const isLegalRisk = lead => {
  const n = (lead.business_name || '').toLowerCase();
  return LAW_NAME_PATTERNS.some(re => re.test(n));
};
const isAssociation = lead => {
  const n = (lead.business_name || '').toLowerCase();
  return ASSOCIATION_NAME_PATTERNS.some(re => re.test(n));
};
const isGov = lead => {
  const u = (lead.website || '').toLowerCase();
  if (GOV_DOMAIN_PATTERNS.some(re => re.test(u))) return true;
  const n = (lead.business_name || '').toLowerCase();
  return GOV_NAME_PATTERNS.some(re => re.test(n));
};
const detectComplexTech = lower => {
  for (const tok of COMPLEX_TECH_TOKENS) if (lower.includes(tok)) return tok;
  return null;
};

function apexDomain(url) {
  if (!url) return null;
  try {
    const host = new URL(url.startsWith('http') ? url : `https://${url}`)
      .hostname.toLowerCase().replace(/^www\./, '');
    const parts = host.split('.').filter(Boolean);
    if (parts.length <= 2) return host;
    const last2 = parts.slice(-2).join('.');
    const last3 = parts.slice(-3).join('.');
    if (/^(co|com|net|org|gov|edu|ac)\.[a-z]{2}$/i.test(last2)) return last3;
    return last2;
  } catch { return null; }
}

// ---- HTML fetch with fallback --------------------------------------------

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

const SITE_SIZE_ANCHOR_LIMIT = parseInt(process.env.SITE_SIZE_ANCHOR_LIMIT || '100', 10);
const VIDEO_LIMIT = parseInt(process.env.VIDEO_LIMIT || '1', 10);

function countAnchors(html) {
  const m = html.match(/href\s*=\s*["'][^"']{1,500}["']/gi);
  return m ? m.length : 0;
}

function countVideos(html) {
  let n = 0;
  n += (html.match(/<video[\s>]/gi) || []).length;
  n += (html.match(/(?:youtube\.com\/(?:embed\/|watch\?v=)|youtu\.be\/|youtube-nocookie\.com)/gi) || []).length;
  n += (html.match(/(?:vimeo\.com\/(?:video\/|\d+)|player\.vimeo)/gi) || []).length;
  n += (html.match(/wistia/gi) || []).length;
  n += (html.match(/loom\.com\/(?:share|embed)/gi) || []).length;
  n += (html.match(/\.(?:mp4|webm|mov|m4v)(?:\?|"|'|\)|\s)/gi) || []).length;
  return n;
}

// ---- Cleanup passes -------------------------------------------------------

const all = listAllLeads();
console.log(`[cleanup] scanning ${all.length} leads`);

// Pass 1: legal risk (fast, name-pattern only)
let legalCount = 0;
for (const lead of all) {
  if (lead.filter_status === 'rejected') continue;
  if (isLegalRisk(lead)) {
    updateLead(lead.id, { filter_status: 'rejected', filter_reason: 'blocklist_legal_risk' });
    legalCount++;
    console.log(`  · legal_risk: ${lead.business_name}`);
  }
}

// Pass 1.5: associations / non-profits / trade bodies
let assocCount = 0;
for (const lead of listAllLeads()) {
  if (lead.filter_status === 'rejected') continue;
  if (isAssociation(lead)) {
    updateLead(lead.id, { filter_status: 'rejected', filter_reason: 'blocklist_association' });
    assocCount++;
    console.log(`  · association: ${lead.business_name}`);
  }
}

// Pass 1b: industry='law' caught by Gemma but missed by name patterns
let lawIndustry = 0;
for (const lead of listAllLeads()) {
  if (lead.filter_status === 'rejected') continue;
  if (lead.industry === 'law') {
    updateLead(lead.id, { filter_status: 'rejected', filter_reason: 'blocklist_law' });
    lawIndustry++;
    console.log(`  · blocklist_law (industry-based): ${lead.business_name}`);
  }
}

// Pass 2: government entities
let govCount = 0;
for (const lead of listAllLeads()) {
  if (lead.filter_status === 'rejected') continue;
  if (isGov(lead)) {
    updateLead(lead.id, { filter_status: 'rejected', filter_reason: 'government_entity' });
    govCount++;
    console.log(`  · government_entity: ${lead.business_name}`);
  }
}

// Pass 3: duplicate domains
let dupCount = 0;
const byApex = new Map();
for (const l of listAllLeads()) {
  if (l.filter_status !== 'passed') continue;
  if (!l.website) continue;
  const apex = apexDomain(l.website);
  if (!apex) continue;
  if (!byApex.has(apex)) byApex.set(apex, []);
  byApex.get(apex).push(l);
}
for (const [apex, leads] of byApex) {
  if (leads.length < 2) continue;
  leads.sort((a, b) => {
    const ar = a.google_review_count ?? 0;
    const br = b.google_review_count ?? 0;
    if (br !== ar) return br - ar;
    const an = (a.business_name || '').length;
    const bn = (b.business_name || '').length;
    if (an !== bn) return an - bn;
    return (a.id ?? 0) - (b.id ?? 0);
  });
  const [, ...losers] = leads;
  for (const loser of losers) {
    updateLead(loser.id, { filter_status: 'rejected', filter_reason: 'duplicate_domain' });
    dupCount++;
    console.log(`  · duplicate_domain: ${loser.business_name} [${apex}]`);
  }
}

// Pass 4 + 5 + 6: complex integrations + site size + video count
//                  — re-fetch HTML, check all three
const stillPassed = listAllLeads().filter(l => l.filter_status === 'passed' && l.website);
console.log(`\n[cleanup] re-probing ${stillPassed.length} passed leads for complex-tech + size + videos`);

let complexCount = 0, sizeCount = 0, videoCount = 0, htmlMiss = 0;
for (const lead of stillPassed) {
  try {
    const html = await fetchHtml(lead.website);
    if (!html) { htmlMiss++; continue; }
    const lower = html.toLowerCase();

    // Persist size + video signals on every successful re-fetch
    const linkCount = countAnchors(html);
    const htmlBytes = html.length;
    const videos = countVideos(html);
    const updates = {
      site_link_count: linkCount,
      site_html_bytes: htmlBytes,
      site_video_count: videos,
    };

    const tok = detectComplexTech(lower);
    if (tok) {
      updates.filter_status = 'rejected';
      updates.filter_reason = `complex_integration:${tok.split('.')[0]}`;
      complexCount++;
      console.log(`  · complex_integration:${tok.split('.')[0]}: ${lead.business_name}`);
    } else if (linkCount > SITE_SIZE_ANCHOR_LIMIT) {
      updates.filter_status = 'rejected';
      updates.filter_reason = `site_too_big_${linkCount}_links`;
      sizeCount++;
      console.log(`  · site_too_big (${linkCount} links): ${lead.business_name} [${lead.website}]`);
    } else if (videos > VIDEO_LIMIT) {
      updates.filter_status = 'rejected';
      updates.filter_reason = `too_many_videos_${videos}`;
      videoCount++;
      console.log(`  · too_many_videos (${videos}): ${lead.business_name} [${lead.website}]`);
    }
    updateLead(lead.id, updates);
  } catch (err) {
    console.error(`  ✗ ${lead.business_name}: ${err.message?.slice(0, 80)}`);
  }
}

if (sharedBrowser) await sharedBrowser.close().catch(() => {});

console.log(`\n[cleanup] legal_risk=${legalCount} association=${assocCount} blocklist_law=${lawIndustry} gov=${govCount} duplicate_domain=${dupCount} complex_integration=${complexCount} site_too_big=${sizeCount} too_many_videos=${videoCount} html_miss=${htmlMiss}`);
