// Slug generator for the WebFactory marketplace.
// Format: webfactory.market/{slug}
// Examples:
//   "Lockett-Williams Mortuary, Inc." → "lockett-williams-mortuary"
//   "A A A Septic Tank Cleaning"      → "aaa-septic-tank-cleaning"
//   "McCarty's Septic Service"        → "mccartys-septic-service"
//
// On collision (same slug already in DB), append city: `…-cleveland`.
// On still-collision, append state: `…-cleveland-oh`.

import db from '../db.js';

// Reserved paths on the marketplace — never assign as slugs.
const RESERVED = new Set([
  'api', 'admin', 'dashboard', 'settings', 'auth', 'login', 'logout',
  'signup', 'signin', 'register', 'pricing', 'about', 'contact',
  'support', 'help', 'docs', 'blog', 'terms', 'privacy', 'legal',
  'sitemap', 'rss', 'feed', 'static', 'public', 'assets',
  'listings', 'browse', 'search', 'tag', 'tags', 'category', 'categories',
  'webfactory', 'index', 'home', 'root', 'null', 'undefined',
]);

const STOPWORDS_SUFFIX = new Set([
  'inc', 'llc', 'ltd', 'co', 'corp', 'corporation', 'company',
  'pllc', 'pa', 'pc', 'lp', 'llp',
]);

function baseSlug(text) {
  return (text || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')   // strip diacritics
    .replace(/['']/g, '')                                  // drop apostrophes (don't → dont)
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')                            // non-alphanum → dash
    .replace(/^-+|-+$/g, '')                                // trim dashes
    .replace(/-{2,}/g, '-');                                // collapse runs
}

function dropTrailingStopwords(slug) {
  const parts = slug.split('-').filter(Boolean);
  while (parts.length > 1 && STOPWORDS_SUFFIX.has(parts[parts.length - 1])) {
    parts.pop();
  }
  return parts.join('-');
}

export function makeSlug(business_name, { maxLen = 60 } = {}) {
  let s = baseSlug(business_name);
  s = dropTrailingStopwords(s);
  if (s.length > maxLen) s = s.slice(0, maxLen).replace(/-+$/, '');
  if (!s) s = 'unnamed-business';
  return s;
}

export function makeCitySlug(city) {
  return baseSlug(city || '').slice(0, 30);
}

const findExistingSlug = db.prepare(
  'SELECT id, marketplace_slug FROM leads WHERE marketplace_slug = ? LIMIT 1'
);

// Generate a unique slug for a lead. If the base slug is taken (by another
// lead), suffix with city; if that's taken too, suffix with state too.
// If the slug is reserved, prefix with the city.
export function uniqueSlugFor(lead) {
  const base = makeSlug(lead.business_name);
  const city = makeCitySlug(lead.city);
  const state = (lead.state || '').toLowerCase();

  const candidates = [];
  if (!RESERVED.has(base)) candidates.push(base);
  if (city) candidates.push(`${base}-${city}`);
  if (city && state) candidates.push(`${base}-${city}-${state}`);
  // Final fallback — append a 6-char suffix from the place_id
  const placeSuffix = (lead.place_id || '').replace(/[^a-z0-9]/gi, '').slice(-6).toLowerCase();
  if (placeSuffix) candidates.push(`${base}-${placeSuffix}`);

  for (const candidate of candidates) {
    const existing = findExistingSlug.get(candidate);
    if (!existing) return candidate;
    if (existing.id === lead.id) return candidate;  // already ours
  }
  return null;
}

export function marketplaceUrl(slug, { host = 'webfactory.market' } = {}) {
  if (!slug) return null;
  return `https://${host}/${slug}`;
}
