import './load-env.js';
import { upsertLead, createBatch, linkLeadToBatch, setBatchCounts } from './db.js';

const PLACES_URL = 'https://places.googleapis.com/v1/places:searchText';
const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.addressComponents',
  'places.websiteUri',
  'places.types',
  'places.primaryType',
  'places.primaryTypeDisplayName',
  'places.rating',
  'places.userRatingCount',
  'places.businessStatus',
  'nextPageToken',
].join(',');

async function searchText(query, pageSize, pageToken) {
  const body = { textQuery: query, pageSize };
  if (pageToken) body.pageToken = pageToken;

  const res = await fetch(PLACES_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY,
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Places API ${res.status}: ${text}`);
  }
  return res.json();
}

function componentByType(components, type) {
  const c = components?.find(c => c.types?.includes(type));
  return c?.shortText || c?.longText || null;
}

function extractDomain(url) {
  if (!url) return null;
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

export async function discover(query, count = 20, { industry_hint = null } = {}) {
  if (!process.env.GOOGLE_PLACES_API_KEY) {
    throw new Error('GOOGLE_PLACES_API_KEY not set in lead-funnel/.env');
  }

  console.log(`[discover] query="${query}" count=${count}`);
  const batch = createBatch({ query, industry_hint, count_requested: count });

  const collected = [];
  let pageToken = null;
  let page = 0;

  while (collected.length < count) {
    page++;
    const remaining = count - collected.length;
    const pageSize = Math.min(20, remaining);
    const data = await searchText(query, pageSize, pageToken);
    const places = data.places || [];

    if (places.length === 0) {
      console.log(`[discover] page ${page}: zero results — stopping`);
      break;
    }

    for (const p of places) {
      const components = p.addressComponents || [];
      const lead = {
        place_id: p.id,
        business_name: p.displayName?.text || '(unknown)',
        website: p.websiteUri || null,
        domain: extractDomain(p.websiteUri),
        address: p.formattedAddress || null,
        city: componentByType(components, 'locality'),
        state: componentByType(components, 'administrative_area_level_1'),
        postal_code: componentByType(components, 'postal_code'),
        country: componentByType(components, 'country'),
        category: p.primaryTypeDisplayName?.text || p.primaryType || (p.types?.[0]) || null,
        google_rating: p.rating ?? null,
        google_review_count: p.userRatingCount ?? null,
        business_status: p.businessStatus || null,
      };
      const id = upsertLead(lead);
      linkLeadToBatch(batch.id, id);
      collected.push({ ...lead, id });
    }

    console.log(`[discover] page ${page}: +${places.length} (total ${collected.length})`);

    pageToken = data.nextPageToken;
    if (!pageToken) break;
    await sleep(2000); // Places requires brief delay before pageToken use
  }

  setBatchCounts(batch.id, { count_discovered: collected.length });

  console.log(`[discover] batch #${batch.id}: ${collected.length} leads stored`);
  return { batch, leads: collected };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: node discover.js "<text query>" [count]');
    console.error('Example: node discover.js "plumbers in Cleveland Ohio" 30');
    process.exit(1);
  }
  const query = args[0];
  const count = parseInt(args[1] || '20', 10);
  discover(query, count).catch(err => {
    console.error('[discover] FAILED:', err.message);
    process.exit(1);
  });
}
