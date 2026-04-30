// WebFactory cold-outreach email template — V1.
//
// Goal: get the original business owner to click through to the marketplace
// listing of their rebuilt site. Tone: personal, honest, low-pressure,
// respectful (NOT insulting their current site). Single CTA.
//
// Variables (all required unless marked optional):
//   business_name        — "Lockett-Williams Mortuary, Inc."
//   city, state          — "Greenwood, MS"
//   current_website      — "http://www.lockettwilliams.com/"  (https-canonicalized at render time)
//   marketplace_url      — "https://webfactory.market/lockett-williams-mortuary"
//   sender_name          — "Tomek" / "WebFactory" / specific human (configurable per-batch)
//   webfactory_homepage  — "https://webfactory.com" (the company site)
//   price_usd            — optional, e.g. 499 (omit if you want to anchor on the link)
//   unsubscribe_url      — required, click-through to global suppression
//
// Output: { subject, text, html }

import { marketplaceUrl } from './slug.js';

function shortDomain(url) {
  if (!url) return '';
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`)
      .hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderSubject(vars) {
  // Tested-by-many-cold-outreach guides: 6-8 words, name in subject
  return `A new website for ${vars.business_name}`;
}

export function renderText(vars) {
  const {
    business_name,
    city,
    state,
    current_website,
    marketplace_url,
    sender_name = 'Tomek',
    webfactory_homepage = 'https://webfactory.com',
    price_usd,
    unsubscribe_url,
  } = vars;

  const domain = shortDomain(current_website);
  const priceLine = price_usd
    ? `One-time price: $${price_usd}. No subscription, no monthly fee. You own it forever and can host it anywhere — or we'll host it for you.`
    : `It's a one-time purchase — no subscription, no monthly fee. You own it forever, host it anywhere (or we'll host it).`;

  return `Hi — I'm reaching out about ${business_name} in ${city}, ${state}.

I work with WebFactory. We rebuild small-business websites and offer them to the original owner. We rebuilt yours.

Take a look:

${marketplace_url}

It's a fully-built modern version of ${domain ? domain : 'your site'} — your business, same content, redesigned. Mobile-first, fast, ready to publish.

${priceLine}

If you like what you see, the link above has the details. If not, just delete this email — we won't follow up.

— ${sender_name}
WebFactory · ${webfactory_homepage}

—
You received this because we found ${business_name} while researching small businesses with rebuildable websites. Reply STOP to be removed permanently, or click: ${unsubscribe_url}
`;
}

export function renderHtml(vars) {
  const {
    business_name,
    city,
    state,
    current_website,
    marketplace_url,
    sender_name = 'Tomek',
    webfactory_homepage = 'https://webfactory.com',
    price_usd,
    unsubscribe_url,
  } = vars;

  const bn = escapeHtml(business_name);
  const loc = escapeHtml([city, state].filter(Boolean).join(', '));
  const dom = escapeHtml(shortDomain(current_website));
  const url = escapeHtml(marketplace_url);
  const sender = escapeHtml(sender_name);
  const home = escapeHtml(webfactory_homepage);
  const unsub = escapeHtml(unsubscribe_url);

  const priceLine = price_usd
    ? `<strong>One-time price: $${escapeHtml(String(price_usd))}.</strong> No subscription, no monthly fee. You own it forever and can host it anywhere — or we'll host it for you.`
    : `It's a one-time purchase — no subscription, no monthly fee. You own it forever, host it anywhere (or we'll host it).`;

  // Plain HTML, no images / tracking pixels / web fonts. Renders cleanly in
  // every email client (Gmail, Apple Mail, Outlook). Max width 560px.
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${bn}</title></head>
<body style="margin:0;padding:24px;background:#f6f5f1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1a1a;line-height:1.55;font-size:16px">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;padding:32px 28px;border-radius:8px;border:1px solid #e8e4dc">
    <p style="margin:0 0 16px">Hi — I'm reaching out about <strong>${bn}</strong>${loc ? ` in ${loc}` : ''}.</p>
    <p style="margin:0 0 16px">I work with <a href="${home}" style="color:#1a1a1a;text-decoration:underline">WebFactory</a>. We rebuild small-business websites and offer them to the original owner. We rebuilt yours.</p>
    <p style="margin:0 0 16px">Take a look:</p>
    <p style="margin:0 0 24px;text-align:center">
      <a href="${url}" style="display:inline-block;padding:14px 22px;background:#1a1a1a;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600">View the rebuild for ${bn}</a>
    </p>
    <p style="margin:0 0 16px">It's a fully-built modern version of ${dom ? `<code style="font-family:ui-monospace,Menlo,monospace;font-size:14px">${dom}</code>` : 'your site'} — your business, same content, redesigned. Mobile-first, fast, ready to publish.</p>
    <p style="margin:0 0 16px">${priceLine}</p>
    <p style="margin:0 0 24px">If you like what you see, the link above has the details. If not, just delete this email — we won't follow up.</p>
    <p style="margin:0 0 4px">— ${sender}</p>
    <p style="margin:0;color:#6b6b6b;font-size:14px">WebFactory · <a href="${home}" style="color:#6b6b6b">${home}</a></p>
  </div>
  <p style="max-width:560px;margin:20px auto 0;font-size:12px;color:#8a8a8a;line-height:1.5">
    You received this because we found ${bn} while researching small businesses with rebuildable websites. Reply STOP to be removed permanently, or <a href="${unsub}" style="color:#8a8a8a">unsubscribe here</a>.
  </p>
</body></html>`;
}

// One-shot helper: render a complete payload from a leads-row + sender config.
export function renderEmail(lead, opts = {}) {
  const {
    sender_name = process.env.OUTREACH_SENDER_NAME || 'Tomek',
    webfactory_homepage = process.env.WEBFACTORY_HOMEPAGE || 'https://webfactory.com',
    price_usd = null,
    marketplace_host = process.env.MARKETPLACE_HOST || 'webfactory.market',
    unsubscribe_base = process.env.UNSUBSCRIBE_BASE || 'https://webfactory.market/u',
  } = opts;

  if (!lead.marketplace_slug) {
    throw new Error(`Lead ${lead.id} has no marketplace_slug — run scripts/backfill-slugs.js first`);
  }

  const url = marketplaceUrl(lead.marketplace_slug, { host: marketplace_host });
  const vars = {
    business_name: lead.business_name,
    city: lead.city,
    state: lead.state,
    current_website: lead.website,
    marketplace_url: url,
    sender_name,
    webfactory_homepage,
    price_usd,
    unsubscribe_url: `${unsubscribe_base}/${lead.marketplace_slug}`,
  };

  return {
    subject: renderSubject(vars),
    text: renderText(vars),
    html: renderHtml(vars),
    marketplace_url: url,
  };
}
