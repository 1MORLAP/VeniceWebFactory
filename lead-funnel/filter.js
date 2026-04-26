import './load-env.js';
import { listAllLeads, listLeadsByFilterStatus, updateLead, getBatch, listLeadsInBatch, setBatchCounts } from './db.js';

const ECOMMERCE_TOKENS = [
  'shopify', 'woocommerce', 'bigcommerce', 'magento', 'wix-stores',
  'add to cart', 'add-to-cart', 'addtocart',
  '/cart', '/checkout', '/products/', '/shop/', '/store/',
  'data-product-id', 'product_price', 'shop-now',
];

const PROBE_TIMEOUT_MS = 8000;
const PROBE_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36 WebFactoryLeadFunnel/0.1';

function detectMultiLocationChains(allLeads) {
  const byName = new Map();
  for (const l of allLeads) {
    const key = (l.business_name || '').toLowerCase().trim();
    if (!key) continue;
    if (!byName.has(key)) byName.set(key, new Set());
    byName.get(key).add(((l.city || '') + '|' + (l.state || '')).toLowerCase());
  }
  const multi = new Set();
  for (const [name, locations] of byName) {
    if (locations.size > 1) multi.add(name);
  }
  return multi;
}

async function probeSite(url) {
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'User-Agent': PROBE_USER_AGENT },
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    if (!res.ok) return { ok: false, reason: `http_${res.status}` };
    const html = (await res.text()).toLowerCase();

    for (const tok of ECOMMERCE_TOKENS) {
      if (html.includes(tok)) return { ok: false, reason: 'ecommerce', detected: tok };
    }
    return { ok: true, html_len: html.length };
  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      return { ok: false, reason: 'timeout' };
    }
    return { ok: false, reason: 'unreachable', error: err.message };
  }
}

export async function filterAll({ batchId = null, includeNonUS = false } = {}) {
  const all = listAllLeads();
  const multiLocationChains = detectMultiLocationChains(all);

  let pool;
  if (batchId) {
    pool = listLeadsInBatch(batchId).filter(l => l.filter_status === 'pending');
  } else {
    pool = listLeadsByFilterStatus('pending');
  }

  console.log(`[filter] processing ${pool.length} pending leads (chains detected: ${multiLocationChains.size})`);

  let passed = 0, rejected = 0;
  const reasonCounts = {};

  for (const lead of pool) {
    let status = 'passed';
    let reason = null;

    if (!lead.website) {
      status = 'rejected'; reason = 'no_website';
    } else if (!includeNonUS && lead.country && lead.country.toLowerCase() !== 'us' && lead.country.toLowerCase() !== 'united states') {
      status = 'rejected'; reason = 'non_us';
    } else if (lead.business_status && lead.business_status !== 'OPERATIONAL') {
      status = 'rejected'; reason = `status_${lead.business_status.toLowerCase()}`;
    } else if (multiLocationChains.has(lead.business_name.toLowerCase().trim())) {
      status = 'rejected'; reason = 'multi_location';
    } else {
      const probe = await probeSite(lead.website);
      if (!probe.ok) {
        status = 'rejected';
        reason = probe.reason;
      }
    }

    updateLead(lead.id, { filter_status: status, filter_reason: reason });
    if (status === 'passed') passed++;
    else { rejected++; reasonCounts[reason] = (reasonCounts[reason] || 0) + 1; }
  }

  if (batchId) {
    setBatchCounts(batchId, { count_passed_filter: passed });
  }

  console.log(`[filter] passed=${passed} rejected=${rejected}`);
  for (const [r, n] of Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`[filter]   ${r}: ${n}`);
  }

  return { passed, rejected, reasonCounts };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const batchArg = process.argv[2];
  const batchId = batchArg ? parseInt(batchArg, 10) : null;
  filterAll({ batchId }).catch(err => {
    console.error('[filter] FAILED:', err.message);
    process.exit(1);
  });
}
