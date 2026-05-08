import './load-env.js';
import { chromium } from 'playwright';
import { listAllLeads, listLeadsByFilterStatus, updateLead, listLeadsInBatch, setBatchCounts } from './db.js';

// High-precision ecommerce signals. We want to reject only REAL stores,
// not service businesses whose pages happen to mention "products".
const ECOMMERCE_TOKENS = [
  'cdn.shopify.com',
  'shopify-section',
  'woocommerce-page',
  'wc-block-',
  'class="add-to-cart"',
  "class='add-to-cart'",
  'data-product-id=',
  '"product_price"',
  'bigcommerce.com',
  '/cart.js',
  'snipcart',
];

// Known national chain / franchise brand stems. We do SUBSTRING matching on
// the domain (after stripping dashes), so `mrrooter` catches `mrrooter.com`,
// `mrrooterpittsburgh.com`, AND `mr-rooter-cleveland.com`. Order doesn't matter.
const KNOWN_CHAIN_STEMS = [
  // plumbing / drain / restoration
  'mrrooter', 'rotorooter', 'benjaminfranklin', 'mistersparky',
  'aireserv', 'arsmaster', 'servpro', 'paulthepro',
  'rescuerooter', 'wrenchmasters',
  // hvac / home services
  'onehourheating', 'onehourair', 'horizonservices', 'serviceexperts',
  'thecleaningauthority', 'mollymaid', 'merrymaids', 'maidpro', 'twomaids',
  // pest
  'terminix', 'orkin', 'aptive', 'truegreen',
  // auto
  'jiffylube', 'meineke', 'aamco', 'maaco',
  'firestonecompleteauto', 'midas',
  // junk / moving
  '1800gotjunk', 'collegehunkshaulingjunk',
  // fitness
  'anytimefitness', 'planetfitness', 'orangetheory',
  // education
  'kumon', 'sylvanlearning', 'mathnasium',
  // tax / professional
  'hrblock', 'libertytax', 'jacksonhewitt',
  // misc home / cleaning
  'chemdry', 'coverall',
];

// Complex integrations we don't want in V1 — booking systems, scheduling
// SaaS, restaurant reservations. The /webfactory rebuild target is
// "marketing site with contact form" — anything that schedules / takes
// reservations / books appointments requires backend work to replicate.
//
// What we KEEP (V1-fine):
//   - Any <form> contact mechanism (mailto, server-side POST handler, JotForm,
//     Typeform, Wufoo, Gravity Forms, WPForms, Ninja Forms, Google Forms, Weave forms, etc.)
//     — we replace these with our own mailto in the rebuild.
//   - PDF downloads ("print our patient intake form")
//
// What we DROP (rejected as 'complex_integration'):
//   - Booking-widget vendors (Calendly, Acuity, ZocDoc, Vagaro, Mindbody, etc.)
//   - Restaurant reservation systems (OpenTable, Resy, Tock)
//   - Healthcare booking + practice management systems we'd have to integrate
//     with as a system-of-record (Dentrix, athenahealth practice mgmt)
const COMPLEX_TECH_TOKENS = [
  // Booking / scheduling SaaS — these book appointments to a calendar
  'calendly.com', 'assets.calendly.com',
  'acuityscheduling.com', 'app.acuityscheduling.com',
  'app.squarespacescheduling.com',
  'simplepractice.com',
  'zocdoc.com', 'widget.zocdoc.com',
  'vagaro.com', 'booking.vagaro.com',
  'styleseat.com',
  'squareup.com/appointments', 'square.site/book',
  'genbook.com',
  'youcanbook.me',
  'setmore.com',
  'booksy.com',
  '10to8.com',
  'mindbodyonline.com', 'clients.mindbodyonline.com',
  'reservationgenie.com',
  'fresha.com',
  'schedulista.com',
  // Restaurant reservations
  'opentable.com', 'opentable.us',
  'resy.com',
  'tock.com', 'exploretock.com',
  'yelp.com/reservations',
  // Healthcare practice management — system-of-record we'd have to integrate.
  // (NOT including patient-intake form vendors like Phreesia — those are forms.)
  'dentrix.com',
  'athenanet.athenahealth.com',
  // Funeral home obituary / tribute platforms — same complexity as ecommerce.
  // Provide: dynamic obituary listings, "send flowers", "send a card", "sign
  // guestbook", "upload photo", "light a candle", video tributes, condolence
  // streams, in-memoriam donations, livestream funeral services. Static rebuild
  // can't replicate any of this. Funeral home that has these = drop.
  // (Plain funeral home with mailto + obituary text page = keep.)
  'tukios.com', 'tukioswebsites',
  'tributecenter.com', 'tributepartner.com', 'tributetech',
  'frazerconsultants.com', 'frazer-consultants',
  'cfsbb.com', 'consolidatedfuneralservices',
  'frontrunnerpro.com', 'frontrunner360.com', 'frontrunnerpro',
  'funeralone.com', 'funeralnet.com',
  'funeralinnovations.com',
  'passare.com',
  'forevermissed.com',
  'tributearchive.com',
  // Legacy.com obituary syndication — embedded condolence books / send flowers
  'legacy.com/obituaries',
];

function detectComplexIntegration(html) {
  for (const tok of COMPLEX_TECH_TOKENS) {
    if (html.includes(tok)) return tok;
  }
  return null;
}

// HTML tokens that strongly suggest a multi-location chain
const CHAIN_HTML_TOKENS = [
  'find a location',
  'locations near you',
  'find your local',
  'choose your location',
  'select your area',
  'find a franchise',
  'find a dealer',
  'find a store near',
];

// Industries we permanently DO NOT pursue. Two reasons leads get blocklisted:
//   1. LEGAL_RISK — owners are litigious by training. Lawyers, law firms.
//      Cold-emailing about their site + hosting a derivative could trigger
//      C&D / trademark / bar complaints. Hard exclude.
//   2. (reserved for future categories the user adds)
//
// This list is checked in TWO places:
//   - Pre-probe: business name patterns (catches before we do any work)
//   - Post-score: by canonical industry value (catches anything name-pattern missed)
const BLOCKLISTED_INDUSTRIES = new Set([
  'law',  // legal risk — added 2026-04-29
]);

// Name patterns that strongly indicate a law firm. Pre-filter check so we
// reject before the HTTP probe. Conservative — better to drop a borderline
// non-lawyer than to email a lawyer.
const LAW_NAME_PATTERNS = [
  /\battorney(?:s)?\b/i,
  /\bat law\b/i,
  /\blaw firm\b/i,
  /\blaw offices?\b/i,
  /\blaw group\b/i,
  /\blaw center\b/i,
  /\blawyers?\b/i,
  /\blegal services\b/i,
  /\blegal group\b/i,
  /\bcounsel(?:ors)?\b.*\b(law|legal)\b/i,
  /\b(esquire|esq\.?)\b/i,
  /\bpersonal injury\b/i,
  /\bbankruptcy law\b/i,
  /\bcriminal defense\b/i,
  /\bestate planning\b.*\battorney\b/i,
  /\bfamily law\b/i,
  /\bdivorce attorney\b/i,
  /\b(pllc|pllp|pc|p\.c\.|llp|lc)\b.*\battorney\b/i,
  /\battorney\b.*\b(pllc|pllp|pc|p\.c\.|llp|lc)\b/i,
];

function isLegalRisk(lead) {
  const name = (lead.business_name || '').toLowerCase();
  for (const re of LAW_NAME_PATTERNS) {
    if (re.test(name)) return true;
  }
  return false;
}

// Industry associations / trade bodies / non-profits — not single-business
// targets for our marketplace. Examples: "Trade Association", "Foundation",
// "Society of X", "Council of Y", "Chamber of Commerce".
//
// Carefully exclude: "& Associates" (business naming convention; matches
// "associates" plural which is distinct from "association").
const ASSOCIATION_NAME_PATTERNS = [
  /\bassociation\b/i,                    // singular — "associates" plural is unmatched
  /\bchamber of commerce\b/i,
  /\bfoundation\b/i,
  /\bsociety of\b/i,
  /\bsociety for\b/i,
  /\bcoalition\b/i,
  /\bguild\b/i,
  /\bcouncil of\b/i,
  /\bnonprofit\b/i,
  /\bnon[\s-]profit\b/i,
  /\btrade group\b/i,
  /\bunion local\b/i,
];

function isAssociation(lead) {
  const name = (lead.business_name || '').toLowerCase();
  for (const re of ASSOCIATION_NAME_PATTERNS) {
    if (re.test(name)) return true;
  }
  return false;
}

// Government / regulatory-body domains. We reject these before the HTTP
// probe — state boards, .gov sites, agency domains aren't WebFactory targets.
const GOV_DOMAIN_PATTERNS = [
  /\.gov(\/|$|\?)/i,
  /\.gov\./i,                            // *.gov.us, *.gov.uk, etc.
  /\bsos\..*\.us\//i,                    // secretary-of-state portals
  /\.state\.[a-z]{2}\.us\//i,            // *.state.tn.us etc.
  /\.k12\.[a-z]{2}\.us\//i,              // public schools
];

// Business-name patterns that indicate a regulatory body, agency, board,
// authority, or similar non-rebuildable entity.
const GOV_NAME_PATTERNS = [
  /\bstate board of\b/i,
  /\bboard of\b.*\b(examiners|registration|certification|licensure)\b/i,
  /\bdepartment of\b/i,
  /\bbureau of\b/i,
  /\bcommission(?:ers)?\b.*\b(state|county|federal)\b/i,
  /\bcouncil of\b/i,
  /\bauthority\b.*\b(state|county|federal|public|housing|transit)\b/i,
  /\bagency\b.*\b(state|county|federal|public)\b/i,
  /\b(division|office) of\b/i,
  // Specific giveaways
  /\bregulatory\b/i,
  /\blicensing board\b/i,
  /\bexaminers\b/i,
];

function isGovernmentEntity(lead) {
  const url = (lead.website || '').toLowerCase();
  for (const re of GOV_DOMAIN_PATTERNS) {
    if (re.test(url)) return true;
  }
  const name = (lead.business_name || '').toLowerCase();
  for (const re of GOV_NAME_PATTERNS) {
    if (re.test(name)) return true;
  }
  return false;
}

// Apex domain (eTLD+1, simplified) — for grouping leads that share a site.
function apexDomain(url) {
  if (!url) return null;
  try {
    const host = new URL(url.startsWith('http') ? url : `https://${url}`)
      .hostname.toLowerCase().replace(/^www\./, '');
    const parts = host.split('.').filter(Boolean);
    if (parts.length <= 2) return host;
    // Common multi-part TLDs we'd want to keep grouped (.co.uk, .com.au)
    const last2 = parts.slice(-2).join('.');
    const last3 = parts.slice(-3).join('.');
    if (/^(co|com|net|org|gov|edu|ac)\.[a-z]{2}$/i.test(last2)) return last3;
    return last2;
  } catch {
    return null;
  }
}

const PROBE_TIMEOUT_MS = 8000;
// Plain Chrome UA — old shared hosts running mod_security reject anything
// that doesn't match a known browser pattern. We previously appended
// `WebFactoryLeadFunnel/0.1` and got blocked at ~10% of small-business hosts.
const PROBE_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Tech-age threshold default (caller passes via filterAll({ minTechAge })).
// 0 = no gate; everything passes.
// 4-6 = mild filter (one strong "old tech" signal).
// 8+ = aggressive filter (FrontPage / iWeb / no viewport).
// 12+ = museum pieces.
const DEFAULT_MIN_TECH_AGE = 0;

// Tech-age scorer: looks at the homepage HTML and assigns points for each
// "old web" signal it finds. Higher score = older / cruder tech stack.
// We use the RAW HTML (not lowercased) so case-sensitive markers like
// `<FONT>` (1990s ALL CAPS) survive — but match case-insensitively.
function scoreTechAge(html) {
  let score = 0;
  const signals = [];
  const add = (n, sig) => { score += n; signals.push(sig); };

  // 1. DOCTYPE — modern HTML5 sites use just `<!DOCTYPE html>`. Older
  //    declarations (HTML 3.2 / 4.01 / XHTML) point at pre-2010 markup.
  const doctypeMatch = html.match(/<!doctype[^>]*>/i);
  const doctype = (doctypeMatch && doctypeMatch[0] || '').toLowerCase();
  if (!doctype) add(5, 'no_doctype');
  else if (doctype.includes('html 3.2')) add(8, 'doctype_html_3_2');
  else if (/html 4(?:\.0|\.01)?/.test(doctype)) add(5, 'doctype_html_4');
  else if (doctype.includes('xhtml 1')) add(2, 'doctype_xhtml');

  // 2. Mobile viewport meta — its absence almost guarantees a non-responsive
  //    pre-2014 site. Single strongest "old" signal.
  if (!/<meta[^>]*name\s*=\s*["']?viewport/i.test(html)) {
    add(5, 'no_viewport_meta');
  }

  // 3. Generator meta — explicit fingerprints of dead/dying authoring tools.
  const genMatch = html.match(/<meta[^>]*name\s*=\s*["']?generator["']?[^>]*content\s*=\s*["']([^"']+)["']/i);
  const gen = (genMatch && genMatch[1] || '').toLowerCase();
  if (gen.includes('frontpage')) add(10, 'generator_frontpage');
  else if (gen.includes('iweb')) add(10, 'generator_iweb');
  else if (gen.includes('golive')) add(10, 'generator_golive');
  else if (gen.includes('homestead')) add(8, 'generator_homestead');
  else if (gen.includes('yahoo sitebuilder')) add(8, 'generator_yahoo_sitebuilder');
  else if (gen.includes('dreamweaver')) add(6, 'generator_dreamweaver');
  else if (gen.includes('yodle') || gen.includes('hibu')) add(6, 'generator_yodle_hibu');
  else if (gen.includes('yola')) add(5, 'generator_yola');
  else if (gen.includes('webs.com')) add(5, 'generator_webs_com');
  else if (gen.includes('weebly')) add(3, 'generator_weebly');
  else if (gen.includes('godaddy')) add(3, 'generator_godaddy');
  else if (/wordpress\s+[34]\./i.test(gen)) add(3, 'generator_old_wordpress');

  // 4. Deprecated / extinct presentational tags
  if (/<font[\s>]/i.test(html)) add(3, 'font_tag');
  if (/<center[\s>]/i.test(html)) add(3, 'center_tag');
  if (/<marquee/i.test(html)) add(5, 'marquee_tag');
  if (/<blink/i.test(html)) add(5, 'blink_tag');
  if (/<frameset|<frame[\s>]/i.test(html)) add(5, 'frames');
  if (/bgcolor\s*=/i.test(html)) add(2, 'bgcolor_attr');

  // 5. Layout-tables heuristic. Real data tables almost always use <thead>;
  //    1990s-2000s "table layout" sites have many tables and zero theads.
  const tableCount = (html.match(/<table\b/gi) || []).length;
  const theadCount = (html.match(/<thead\b/gi) || []).length;
  if (tableCount >= 6 && theadCount === 0) add(4, `layout_tables_${tableCount}`);

  // 6. jQuery vintage — modern stacks don't ship jQuery 1.x or 2.x anymore.
  const jq = html.match(/jquery[-/]?(\d+)\.(\d+)/i);
  if (jq) {
    const major = parseInt(jq[1], 10);
    if (major === 1) add(5, `jquery_1_${jq[2]}`);
    else if (major === 2) add(3, `jquery_2_${jq[2]}`);
  }
  // Other extinct JS frameworks
  if (/prototype\.js|prototypejs/i.test(html)) add(4, 'prototypejs');
  if (/mootools/i.test(html)) add(4, 'mootools');

  // 7. Old Google Analytics — Universal Analytics (UA-XXXXX) was deprecated
  //    in 2023. A UA tracker still in HTML = nobody's touched it since.
  if (/UA-\d{4,}/.test(html)) add(3, 'old_universal_analytics');

  // 8. Stale copyright year
  const yearMatch = html.match(/(?:©|&copy;|copyright)\s*(?:\(c\)\s*)?\b(20\d{2})\b/i);
  if (yearMatch) {
    const year = parseInt(yearMatch[1], 10);
    const currentYear = new Date().getFullYear();
    if (currentYear - year >= 10) add(6, `copyright_${year}`);
    else if (currentYear - year >= 5) add(3, `copyright_${year}`);
  }

  // 9. Nostalgic textual markers
  if (/best viewed (?:in|with) (?:internet explorer|netscape|firefox 1)/i.test(html)) {
    add(10, 'best_viewed_text');
  }
  if (/visitor counter|hit counter|free counter|number of visitors/i.test(html)) {
    add(4, 'hit_counter');
  }
  if (/under construction.*\.gif|<img[^>]*construction[^>]*\.gif/i.test(html)) {
    add(3, 'under_construction_gif');
  }

  return { score, signals };
}

function detectMultiLocationChainsFromBatch(allLeads) {
  // Same name in 2+ different cities → multi-location chain
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

// Domain-level dedup: if two leads point at the same apex domain, keep the
// "primary" one (most reviews, then shortest name) and mark the rest as
// duplicates. Returns Set of lead.id values to reject.
function detectDuplicateDomains(allLeads) {
  const byApex = new Map();
  for (const l of allLeads) {
    if (!l.website) continue;
    if (l.filter_status === 'rejected') continue;     // already gone
    const apex = apexDomain(l.website);
    if (!apex) continue;
    if (!byApex.has(apex)) byApex.set(apex, []);
    byApex.get(apex).push(l);
  }

  const losers = new Set();
  for (const [apex, leads] of byApex) {
    if (leads.length < 2) continue;
    // Pick winner: highest review count, ties broken by shortest name, ties
    // broken by lowest place_id (stable / first-seen).
    leads.sort((a, b) => {
      const ar = a.google_review_count ?? 0;
      const br = b.google_review_count ?? 0;
      if (br !== ar) return br - ar;
      const an = (a.business_name || '').length;
      const bn = (b.business_name || '').length;
      if (an !== bn) return an - bn;
      return (a.id ?? 0) - (b.id ?? 0);
    });
    const [winner, ...rest] = leads;
    for (const loser of rest) losers.add(loser.id);
  }
  return losers;
}

function detectChainFromUrl(lead) {
  const url = (lead.website || '').toLowerCase();
  if (!url) return null;

  let host = '';
  try {
    host = new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    host = url;
  }
  // Strip dashes for stem matching: `mr-rooter-cleveland.com` → `mrrootercleveland.com`
  const hostStripped = host.replace(/-/g, '');

  // Brand stem substring match — catches franchisee subdomains like
  // mrrooterpittsburgh.com or mr-rooter-philly.com.
  for (const stem of KNOWN_CHAIN_STEMS) {
    if (hostStripped.includes(stem.replace(/-/g, ''))) return 'chain_known_brand';
  }

  // City slug in URL path is a strong franchise signal
  // (national chains use /cleveland/ or /cleveland-oh/ city landing pages)
  const city = (lead.city || '').toLowerCase().trim().replace(/\s+/g, '-');
  if (city) {
    const cityPattern = new RegExp(`/${city}([-/?#]|-${(lead.state || '').toLowerCase()}[-/?#])`, 'i');
    if (cityPattern.test(url)) return 'chain_city_path';
  }

  // Generic franchise path indicators
  if (/\/locations?\//.test(url)) return 'chain_locations_path';
  if (/\/find-(?:a-)?(?:location|dealer|store|franchise)/.test(url)) return 'chain_find_path';

  return null;
}

function detectChainFromHtml(html) {
  for (const tok of CHAIN_HTML_TOKENS) {
    if (html.includes(tok)) return `chain_html_${tok.replace(/\s+/g, '_')}`;
  }
  return null;
}

function detectEcommerceFromHtml(html) {
  for (const tok of ECOMMERCE_TOKENS) {
    if (html.includes(tok)) return tok;
  }
  return null;
}

// Self-hosted ecommerce detector — independent of any specific platform.
//
// Real bug 2026-05-05 (cindysantiqueart.com): site had no Shopify/WooCommerce
// markers (it's a custom PHP cart system) but DID have on-domain user
// accounts + cart. WebFactory can't rebuild a site that requires database +
// auth + checkout — that's outside V1 scope.
//
// We need TWO independent signals because either alone produces too many
// false positives:
//   - "Login" alone: many small-business sites have an admin login link
//   - "Cart" alone: rare, but could be a single buyable downloadable product
//
// The combination — same site has BOTH user account creation AND a cart UI
// — is the unambiguous "this is an actual store" signal.
//
// We look for href paths (most reliable; survives JS obfuscation), with a
// lightweight visible-text fallback (catches `<button>Add to Cart</button>`
// patterns that aren't anchored hrefs).
const ACCOUNT_HREF_TOKENS = [
  '/account.php', '/account.html', '/account/',
  '/myaccount', '/my-account', '/my_account',
  '/create_account', '/create-account', '/createaccount',
  '/register.php', '/register.html', '/register/',
  '/signup', '/sign-up', '/sign_up',
  'href="/login', "href='/login",
];
const CART_HREF_TOKENS = [
  '/cart.php', '/cart.html', '/cart/',
  '/shopping-cart', '/shopping_cart', '/shoppingcart',
  '/checkout.php', '/checkout.html', '/checkout/',
];
const CART_TEXT_TOKENS = [
  '>add to cart<', '>add to bag<', '>buy now<', '>view cart<',
  '>your cart<', '>shopping cart<',
];

function detectSelfHostedEcommerce(lower) {
  const hasAccount = ACCOUNT_HREF_TOKENS.some(t => lower.includes(t));
  const hasCart = CART_HREF_TOKENS.some(t => lower.includes(t)) ||
                  CART_TEXT_TOKENS.some(t => lower.includes(t));
  if (hasAccount && hasCart) return 'account+cart';
  // Even without account creation, two separate cart paths = real store
  // (e.g. /cart.php AND /checkout.php both present)
  const cartPaths = CART_HREF_TOKENS.filter(t => lower.includes(t)).length;
  if (cartPaths >= 2) return 'cart+checkout';
  return null;
}

// White-label / external storefronts the customer's site links OUT to as their
// "shop" — common with screen printers, promo/apparel, embroidery, taxidermy
// supply, etc. The brochure site stays small and mailto-friendly, but the
// REAL business runs on the external store. Rebuilding the brochure doesn't
// move the needle for them — they need the storefront, not a redesign.
//
// Match is substring on the lowercased HTML — if any of these appear ANYWHERE
// in the page (typically as href), the lead is rejected.
const EXTERNAL_STOREFRONT_DOMAINS = [
  // Apparel / promo / embroidery white-label storefronts
  'companycasuals.com',          // Sanmar — bridgetownimprints leak found this
  'sanmar.com/promo',
  'alphabroder.com',
  'ssactivewear.com',
  'staton.com/store',
  'spectorandco.com',
  'gemline.com',
  'logomark.com',
  // Generic ecommerce platforms hosted as separate stores
  '.myshopify.com',
  'etsy.com/shop/',
  'bigcartel.com',
  'square.site',
  'squareup.com/store',
  'ecwid.com/store',
  'storenvy.com',
  'shopfat.com',
  'shopify.com/store',
];

function detectExternalStorefront(html) {
  for (const tok of EXTERNAL_STOREFRONT_DOMAINS) {
    if (html.includes(tok)) return tok;
  }
  return null;
}

// ---- Obituary CMS detector ------------------------------------------------
//
// Funeral homes that have an OBITUARY LISTING are running a CMS — the owner
// adds new obituaries the way an ecommerce owner adds new products. Each
// entry typically includes deceased name, photo, biography, service info,
// online guestbook / send-flowers / sign-card / livestream-funeral controls.
// WebFactory rebuilds MARKETING sites (mailto + photo gallery + service area
// + reviews); it cannot replicate a CMS that the customer actively manages.
//
// Funeral homes WITHOUT an active obituary section are FINE — those are
// brochure sites we can rebuild like any other small business.
//
// Two-stage detection:
//   1. Homepage check (cheap): path-token + entry-anchors / date-ranges /
//      year-ranges. Catches sites that embed recent obituaries on the homepage.
//   2. Deep probe (only when homepage has nav link to /obituaries but no
//      embedded entries): fetch the /obituaries page itself, count entry
//      anchors + single death dates. Catches sites whose obituaries live on
//      a sub-page only.
//
// Both stages use the same content predicate: presence of multiple deceased
// entries (anchors to obit slugs, full date ranges, or many year ranges).
const OBITUARY_PATH_TOKENS = [
  // Trailing-slash forms (subdirectory)
  '/obituaries/', '/obituary/',
  '/tributes/', '/tribute/',
  '/memorials/', '/memorial/',
  '/recent-obituaries', '/current-obituaries', '/past-services',
  '/in-memoriam', '/recent-services',
  '/tribute-wall', '/memorial-wall',
  // Closing-quote forms — catch both relative `href="/obituaries"` AND
  // absolute `href="https://...com/obituaries"` (common on Microsoft-IIS /
  // ASP.NET funeral CMSes that emit canonical absolute URLs in nav). The
  // pattern `/obituaries"` requires `/` before the term and `"` after,
  // which essentially only matches inside a quoted attribute.
  '/obituaries"', "/obituaries'",
  '/obituary"', "/obituary'",
  '/tributes"', "/tributes'",
  '/tribute"', "/tribute'",
  '/memorials"', "/memorials'",
  '/memorial"', "/memorial'",
];

// Anchors pointing at INDIVIDUAL obituary entries (slug after path)
// e.g. href="/obituaries/john-smith-1945-2026" or "/tribute/jane-doe"
const OBITUARY_ENTRY_ANCHOR_RE = /href\s*=\s*["'][^"']*\/(?:obituar(?:y|ies)|tributes?|memorials?)\/[a-z0-9][a-z0-9_.-]+[^"']*["']/gi;

// Death-date range — most common funeral-listing format. Highly unambiguous.
//   "January 5, 1945 - April 3, 2026"
//   "March 15, 1950 — February 28, 2026"
const DEATH_DATE_RANGE_RE = /(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s+(?:19|20)\d{2}\s*[-–—]\s*(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s+(?:19|20)\d{2}/gi;

// Bare year range — noisier (matches copyright "© 2020-2026", stat ranges,
// etc.). Only fires at threshold ≥ 3 to avoid those.
const YEAR_RANGE_RE = /\b(?:19|20)\d{2}\s*[-–—]\s*(?:19|20)\d{2}\b/g;

// Single full date — "January 5, 2026". Used ONLY on deep-probe pages
// (where the URL itself is /obituaries), at threshold ≥ 5, since an
// obituary-listing page virtually always shows the date for each deceased.
const SINGLE_DEATH_DATE_RE = /(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s+(?:19|20)\d{2}/gi;

function detectObituaryCMS(lower) {
  const hasPath = OBITUARY_PATH_TOKENS.some(t => lower.includes(t));
  if (!hasPath) return null;
  const entryAnchors = (lower.match(OBITUARY_ENTRY_ANCHOR_RE) || []).length;
  if (entryAnchors >= 1) return `entries_${entryAnchors}`;
  const fullDates = (lower.match(DEATH_DATE_RANGE_RE) || []).length;
  if (fullDates >= 1) return `dates_${fullDates}`;
  const yearRanges = (lower.match(YEAR_RANGE_RE) || []).length;
  if (yearRanges >= 3) return `years_${yearRanges}`;
  return null;
}

function detectObituaryNavLink(lower) {
  // Returns the first nav-link path token found (or null). Used to decide
  // whether the deep-probe is worth the extra request.
  return OBITUARY_PATH_TOKENS.find(t => lower.includes(t)) || null;
}

// On a deep-probe /obituaries page we accept softer signals because the URL
// itself disambiguates context: ANY page at /obituaries with multiple dated
// entries is by definition a CMS-driven listing.
function detectObituaryCMSDeep(lower) {
  const v = detectObituaryCMS(lower);
  if (v) return v;
  const singleDates = (lower.match(SINGLE_DEATH_DATE_RE) || []).length;
  if (singleDates >= 5) return `single_dates_${singleDates}`;
  return null;
}

// Funeral-tech vendor fingerprints found in JS bundles / SDK script src on
// CMS-driven /obituaries sub-pages. These often DON'T appear on the homepage
// (which is mostly static brochure content), so the homepage-level
// `detectComplexIntegration` misses them. The deep probe checks these on
// the /obituaries page itself.
//
// Subset of COMPLEX_TECH_TOKENS, broadened to common slug forms (e.g.
// 'tributestore' from a CDN URL even when 'tributestore.com' isn't on the
// page). Only used inside obituary deep-probe context where false positives
// on these tokens are essentially impossible.
const FUNERAL_VENDOR_TOKENS_DEEP = [
  'tukios', 'tributecenter', 'tributepartner', 'tributetech',
  'tributearchive', 'tributestore',
  'frazerconsultants', 'frazer-consultants',
  'cfsbb', 'consolidatedfuneralservices',
  'frontrunnerpro', 'frontrunner360',
  'funeralone', 'funeralnet', 'funeralinnovations', 'funeralinnov',
  'passare.com', 'forevermissed',
  'legacy.com/obituaries',
];

function detectFuneralVendorDeep(lower) {
  for (const tok of FUNERAL_VENDOR_TOKENS_DEEP) {
    if (lower.includes(tok)) return tok;
  }
  return null;
}

// Domains that look like emails in HTML but aren't real contact addresses
// (analytics, error tracking, CDN, vendor support, etc.).
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
  // Vendor placeholder emails — website-builder demo / template addresses
  // that leak into scraped sites. Adding 2026-05-07 after finding 7 unrelated
  // businesses all listing info@ndiscovered.com (NDiscovered vendor demo)
  // and emaildemo@hostopia.com (Hostopia website-builder demo).
  /^info@ndiscovered\.com$/i, /@ndiscovered\.com$/i,
  /^emaildemo@hostopia\.com$/i, /@hostopia\.com$/i,
];

function isFalsePositiveEmail(email) {
  return EMAIL_FALSE_POSITIVE_PATTERNS.some(re => re.test(email));
}

// Common typo → correct mappings for the TLD and well-known providers.
// Keep this conservative — only fix patterns where the right answer is
// unambiguous. We never invent a domain that wasn't on the page.
const TLD_TYPO_FIXES = [
  [/\.con$/i, '.com'],   // info@example.con → .com
  [/\.cmo$/i, '.com'],   // .cmo → .com
  [/\.cm$/i, '.com'],    // .cm (when not actually .cm Cameroon) → .com — safe because Cameroon SMBs aren't in our funnel
  [/\.ney$/i, '.net'],   // .ney → .net
  [/\.ner$/i, '.net'],   // .ner → .net
  [/\.nrt$/i, '.net'],   // .nrt → .net
  [/\.og$/i, '.org'],    // .og → .org
  [/\.ogr$/i, '.org'],   // .ogr → .org
  [/\.orgg$/i, '.org'],  // .orgg → .org
];
const PROVIDER_TYPO_FIXES = [
  [/@gmial\.com$/i, '@gmail.com'],
  [/@gmal\.com$/i, '@gmail.com'],
  [/@gnail\.com$/i, '@gmail.com'],
  [/@gmailcom$/i, '@gmail.com'],
  [/@gmail\.cm$/i, '@gmail.com'],
  [/@yaho\.com$/i, '@yahoo.com'],
  [/@yahho\.com$/i, '@yahoo.com'],
  [/@yahoocom$/i, '@yahoo.com'],
  [/@hotmial\.com$/i, '@hotmail.com'],
  [/@hotmal\.com$/i, '@hotmail.com'],
  [/@hotmailcom$/i, '@hotmail.com'],
  [/@outlok\.com$/i, '@outlook.com'],
  [/@outlookcom$/i, '@outlook.com'],
  [/@aol\.con$/i, '@aol.com'],
  [/@sbcgloba\.net$/i, '@sbcglobal.net'],
];

// Strip URL-encoding artifacts and trailing punctuation that scraped HTML
// often introduces around mailto links and freeform email mentions:
//   ` info@x.com`     ← leading space (from "%20info@x.com" decoded)
//   `%20info@x.com`   ← raw URL-encoded space prefix
//   `info@x.com,`     ← trailing comma from "Email: info@x.com, Phone: ..."
//   `info@x.com.`     ← trailing period (end of sentence)
//   `info@x.com>`     ← trailing angle bracket (mailto:foo@bar> in href)
function cleanEmailString(raw) {
  if (!raw) return null;
  let s = raw;
  // URL decode (%20 → space, %40 → @, etc.) — try once; bail on bad input
  try { s = decodeURIComponent(s); } catch {}
  // Strip whitespace + leading/trailing punctuation that's not valid in addresses
  s = s.trim().replace(/^[\s,;:<>"'()\[\]{}]+|[\s,;:<>"'()\[\]{}.!?]+$/g, '');
  // Lowercase
  s = s.toLowerCase();
  // Collapse doubled @ (rare scraper artifact: `info@@example.com`)
  s = s.replace(/@@+/g, '@');
  // Apply TLD typo fixes
  for (const [re, fix] of TLD_TYPO_FIXES) {
    const next = s.replace(re, fix);
    if (next !== s) { s = next; break; }
  }
  // Apply provider typo fixes
  for (const [re, fix] of PROVIDER_TYPO_FIXES) {
    const next = s.replace(re, fix);
    if (next !== s) { s = next; break; }
  }
  // Final shape check — must look like a real email
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(s)) return null;
  return s;
}

// Extract the best contact email from page HTML.
// Priority: mailto: links > plain-text emails matching the site's own domain.
function extractContactEmail(html, siteUrl) {
  // 1. Pull all candidates — generous regex that includes %-encoded chars,
  //    we clean each candidate before deciding.
  const mailtoMatches = [...html.matchAll(/mailto:([^"'\s>]+@[^"'\s>]+)/gi)];
  const plainMatches = [...html.matchAll(/\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g)];

  const candidates = [
    ...mailtoMatches.map(m => ({ raw: m[1], priority: 1 })),
    ...plainMatches.map(m => ({ raw: m[1], priority: 2 })),
  ]
    .map(c => ({ ...c, email: cleanEmailString(c.raw) }))
    .filter(c => c.email && !isFalsePositiveEmail(c.email));

  if (candidates.length === 0) return null;

  // 2. Prefer emails on the site's own apex domain
  let siteApex = null;
  try {
    siteApex = new URL(siteUrl).hostname.replace(/^www\./, '').toLowerCase();
    // Trim to apex: example.com from foo.bar.example.com
    const parts = siteApex.split('.');
    if (parts.length > 2) siteApex = parts.slice(-2).join('.');
  } catch {}

  const sortKey = c => {
    const emailDomain = c.email.split('@')[1] || '';
    const matchesSite = siteApex && emailDomain.endsWith(siteApex) ? 0 : 1;
    return [c.priority, matchesSite];
  };

  candidates.sort((a, b) => {
    const [pa, ma] = sortKey(a);
    const [pb, mb] = sortKey(b);
    if (pa !== pb) return pa - pb;
    return ma - mb;
  });

  // Dedup
  const seen = new Set();
  for (const c of candidates) {
    if (seen.has(c.email)) continue;
    seen.add(c.email);
    return c.email;
  }
  return null;
}

// Reachability — do we have a way to contact the owner?
// `mailto:` link or contact form in the HTML = yes. No reachability means
// the lead is much harder to convert (we can't email them about the rebuild).
function detectReachability(html, lower, siteUrl) {
  const hasEmail = /mailto:|@[a-z0-9.-]+\.[a-z]{2,}/i.test(html) ? 1 : 0;
  const hasForm = /<form\b/i.test(html) ? 1 : 0;
  const email = extractContactEmail(html, siteUrl);
  return { site_has_email: hasEmail, site_has_form: hasForm, contact_email: email };
}

// HTTP statuses where retrying with a real browser is worth the cost.
// 403 / 406 / 429 are the classic "WAF/bot-detection blocked us" signatures
// on small-business shared hosts (mod_security, Cloudflare, etc.).
const PLAYWRIGHT_FALLBACK_STATUSES = new Set([403, 406, 429, 503]);

// Lazy-init a single browser shared across the filter pass. We only pay the
// ~1-2s launch cost when at least one site needs the fallback. Closed by
// filterAll() at the end of the pass.
let sharedBrowser = null;
async function getBrowser() {
  if (!sharedBrowser) {
    sharedBrowser = await chromium.launch({ headless: true });
  }
  return sharedBrowser;
}

async function fetchHtmlViaPlaywright(url) {
  const browser = await getBrowser();
  const ctx = await browser.newContext({
    userAgent: PROBE_USER_AGENT,
    extraHTTPHeaders: { 'Accept-Language': 'en-US,en;q=0.9' },
  });
  const page = await ctx.newPage();
  try {
    // domcontentloaded is enough to get the HTML — we don't need full networkidle here
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    // Brief settle for sites that hydrate content client-side
    await page.waitForTimeout(1500);
    const html = await page.content();
    const status = page.url().startsWith('about:blank') ? 0 : 200;
    return { ok: true, html, status };
  } catch (err) {
    return { ok: false, error: err.name === 'TimeoutError' ? 'timeout' : err.message?.slice(0, 80) };
  } finally {
    await ctx.close().catch(() => {});
  }
}

// Site-size signal — small-to-medium business sites typically have 10-80
// anchors. 100+ suggests deep nav / many sub-pages — out of scope for V1
// (we rebuild marketing sites, not portals or large multi-page sites).
//
// Threshold is intentionally generous: a small dental practice with a few
// service pages + footer + social links sits around 30-50 anchors. We only
// reject genuinely BIG sites (>100 anchors).
const SITE_SIZE_ANCHOR_LIMIT = parseInt(process.env.SITE_SIZE_ANCHOR_LIMIT || '100', 10);

// Video-heavy sites are out of V1 scope: each video on the original needs to
// be hosted / embedded / synced in the rebuild, and most aren't critical
// content. A small business with one hero video is borderline — anything
// with multiple videos or YouTube/Vimeo embeds means the owner is invested
// in video and a text/photo rebuild won't satisfy them.
//
// Threshold: drop sites with > this many video signals on the homepage.
// Default 1 = "any more than one video reference and we drop". Set to 0 to
// drop EVERY site with any video, or higher to be more permissive.
const VIDEO_LIMIT = parseInt(process.env.VIDEO_LIMIT || '1', 10);

function countAnchors(html) {
  const m = html.match(/href\s*=\s*["'][^"']{1,500}["']/gi);
  return m ? m.length : 0;
}

function countVideos(html) {
  let n = 0;
  // Native HTML5 video element
  n += (html.match(/<video[\s>]/gi) || []).length;
  // YouTube embeds + links
  n += (html.match(/(?:youtube\.com\/(?:embed\/|watch\?v=)|youtu\.be\/|youtube-nocookie\.com)/gi) || []).length;
  // Vimeo embeds
  n += (html.match(/(?:vimeo\.com\/(?:video\/|\d+)|player\.vimeo)/gi) || []).length;
  // Wistia
  n += (html.match(/wistia/gi) || []).length;
  // Loom
  n += (html.match(/loom\.com\/(?:share|embed)/gi) || []).length;
  // Direct video file references (mp4/webm/mov)
  n += (html.match(/\.(?:mp4|webm|mov|m4v)(?:\?|"|'|\)|\s)/gi) || []).length;
  return n;
}

function analyzeHtml(html, url) {
  const lower = html.toLowerCase();
  const techAge = scoreTechAge(html);
  const reachability = detectReachability(html, lower, url);
  const ecommerce = detectEcommerceFromHtml(lower);
  const selfHostedEcommerce = detectSelfHostedEcommerce(lower);
  const externalStorefront = detectExternalStorefront(lower);
  const obituaryCMS = detectObituaryCMS(lower);
  const obituaryNavLink = obituaryCMS ? null : detectObituaryNavLink(lower);
  const chainHtml = detectChainFromHtml(lower);
  const complexTech = detectComplexIntegration(lower);
  const linkCount = countAnchors(html);
  const videoCount = countVideos(html);
  return {
    lower, techAge, reachability, ecommerce, selfHostedEcommerce,
    externalStorefront, obituaryCMS, obituaryNavLink,
    chainHtml, complexTech,
    linkCount, videoCount, html_len: html.length,
  };
}

// Deep probe: when the homepage has a nav link to /obituaries but no embedded
// entries, fetch the linked page directly and run the (softer) deep detector.
// Reuses the same fetch + Playwright fallback pattern as probeSite. Returns
// the verdict string or null.
//
// `homepageHtml` (optional) is the raw homepage HTML. When passed, we extract
// the actual on-domain obituary-related hrefs from it instead of guessing.
// This catches non-standard slugs like Duda's `/our-of-obituaries` or
// vendor-specific paths like `/obituaries/obituary-listings`.
async function probeObituaryDeep(siteUrl, navHint, homepageHtml = null) {
  let origin;
  try { origin = new URL(siteUrl).origin; } catch { return null; }

  // Build candidate path list. Order: hrefs extracted from homepage first
  // (they're the actual links — more likely to be the real CMS URL), then
  // the navHint, then standard fallbacks.
  const candidates = new Set();
  if (homepageHtml) {
    const urlRe = /href\s*=\s*["']([^"']*(?:obituar|tribute|memorial|in-memoriam|recent-services|past-services)[^"']*)["']/gi;
    let m;
    while ((m = urlRe.exec(homepageHtml)) !== null) {
      try {
        const abs = new URL(m[1], siteUrl);
        // Same-origin only — we don't probe newspaper obituary syndication
        // links (those are external services, not the customer's CMS).
        if (abs.origin === origin) candidates.add(abs.pathname || '/');
      } catch {}
    }
  }
  const m = navHint && navHint.match(/href\s*=\s*["']([^"']+)["']/);
  if (m) candidates.add(m[1]);
  if (navHint && navHint.startsWith('/')) {
    // Strip trailing quote (token may be `/obituaries"`) and any trailing slash.
    candidates.add(navHint.replace(/["'\/]+$/, ''));
  }
  candidates.add('/obituaries');
  candidates.add('/obituary');
  candidates.add('/tributes');
  candidates.add('/memorials');

  for (const path of candidates) {
    if (!path || !path.startsWith('/')) continue;
    const probeUrl = `${origin}${path}`;
    let html = null;
    try {
      const res = await fetch(probeUrl, {
        method: 'GET',
        redirect: 'follow',
        headers: { 'User-Agent': PROBE_USER_AGENT },
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      });
      if (res.ok) html = await res.text();
      else if (PLAYWRIGHT_FALLBACK_STATUSES.has(res.status)) {
        const pw = await fetchHtmlViaPlaywright(probeUrl);
        if (pw.ok) html = pw.html;
      }
    } catch {
      const pw = await fetchHtmlViaPlaywright(probeUrl).catch(() => ({ ok: false }));
      if (pw.ok) html = pw.html;
    }
    if (!html) continue;
    const lower = html.toLowerCase();
    const v = detectObituaryCMSDeep(lower);
    if (v) return v;
    // Funeral-tech vendor fingerprint check — catches IIS/ASP.NET sites where
    // the listings render via JS (Frazer / FrontRunner / Tribute Tech etc.).
    const vendor = detectFuneralVendorDeep(lower);
    if (vendor) return `vendor_${vendor.split('.')[0]}`;
    // First candidate already gave us a real page — don't keep guessing
    // (avoid 404-loop on sites that don't use /obituaries).
    return null;
  }
  return null;
}

// When the homepage has no email, try common /contact variants. We don't
// burn the Playwright fallback here — if the contact page is bot-blocked
// at the same hosting as the homepage, we'd already know from the main probe.
const CONTACT_PATHS = ['/contact', '/contact-us', '/contactus', '/contact.html'];

async function findContactEmailViaContactPage(siteUrl) {
  let origin;
  try { origin = new URL(siteUrl).origin; } catch { return null; }
  for (const p of CONTACT_PATHS) {
    const url = `${origin}${p}`;
    try {
      const res = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        headers: { 'User-Agent': PROBE_USER_AGENT },
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      });
      if (!res.ok) continue;
      const html = await res.text();
      const email = extractContactEmail(html, siteUrl);
      if (email) return email;
    } catch {}
  }
  return null;
}

async function probeSite(url) {
  // Phase 1: cheap fetch (works on ~85-90% of sites).
  let html;
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'User-Agent': PROBE_USER_AGENT },
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    if (res.ok) {
      html = await res.text();
    } else if (PLAYWRIGHT_FALLBACK_STATUSES.has(res.status)) {
      // Phase 2: WAF-blocked us → retry with real browser
      console.log(`[filter]   ↳ http_${res.status} on ${url} — retrying via Playwright`);
      const pw = await fetchHtmlViaPlaywright(url);
      if (!pw.ok) return { ok: false, reason: `pw_${pw.error}` };
      html = pw.html;
    } else {
      return { ok: false, reason: `http_${res.status}` };
    }
  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      return { ok: false, reason: 'timeout' };
    }
    // Network-level failure — try Playwright once more (some hosts reject
    // Node's fetch but accept Chromium, e.g. TLS quirks).
    const pw = await fetchHtmlViaPlaywright(url);
    if (!pw.ok) return { ok: false, reason: 'unreachable' };
    html = pw.html;
  }

  const a = analyzeHtml(html, url);
  // Always return size signals so we can store them even when probe rejects.
  const size = { link_count: a.linkCount, html_bytes: a.html_len, video_count: a.videoCount };
  if (a.ecommerce) return { ok: false, reason: 'ecommerce', tech_age: a.techAge, reachability: a.reachability, size };
  if (a.selfHostedEcommerce) return { ok: false, reason: `ecommerce_self_hosted_${a.selfHostedEcommerce}`, tech_age: a.techAge, reachability: a.reachability, size };
  if (a.externalStorefront) return { ok: false, reason: `ecommerce_external_storefront:${a.externalStorefront}`, tech_age: a.techAge, reachability: a.reachability, size };
  if (a.obituaryCMS) return { ok: false, reason: `obituary_cms_${a.obituaryCMS}`, tech_age: a.techAge, reachability: a.reachability, size };
  if (a.chainHtml) return { ok: false, reason: 'multi_location', tech_age: a.techAge, reachability: a.reachability, size };
  if (a.complexTech) return { ok: false, reason: `complex_integration:${a.complexTech.split('.')[0]}`, tech_age: a.techAge, reachability: a.reachability, size };
  // Nav link to /obituaries but no homepage entries — confirm via deep probe.
  if (a.obituaryNavLink) {
    const deep = await probeObituaryDeep(url, a.obituaryNavLink, html);
    if (deep) return { ok: false, reason: `obituary_cms_deep_${deep}`, tech_age: a.techAge, reachability: a.reachability, size };
  }
  if (a.linkCount > SITE_SIZE_ANCHOR_LIMIT) return { ok: false, reason: `site_too_big_${a.linkCount}_links`, tech_age: a.techAge, reachability: a.reachability, size };
  if (a.videoCount > VIDEO_LIMIT) return { ok: false, reason: `too_many_videos_${a.videoCount}`, tech_age: a.techAge, reachability: a.reachability, size };
  return { ok: true, html_len: a.html_len, tech_age: a.techAge, reachability: a.reachability, size };
}

export async function filterAll({ batchId = null, includeNonUS = false, minTechAge = null } = {}) {
  // Resolve threshold: explicit arg > env var > default (0)
  const MIN_TECH_AGE = minTechAge != null
    ? minTechAge
    : parseInt(process.env.MIN_TECH_AGE || String(DEFAULT_MIN_TECH_AGE), 10);

  const all = listAllLeads();
  const multiLocationChains = detectMultiLocationChainsFromBatch(all);
  // Cross-batch domain dedup — two Google Places listings often point at the
  // same site (e.g. Iowa Falls Family Dentistry + same-business-named-after-the-dentist).
  // We compute losers across the WHOLE leads table so dedup spans batches.
  const duplicateLeadIds = detectDuplicateDomains(all);

  let pool;
  if (batchId) {
    pool = listLeadsInBatch(batchId).filter(l => l.filter_status === 'pending');
  } else {
    pool = listLeadsByFilterStatus('pending');
  }

  console.log(`[filter] processing ${pool.length} pending leads (intra-batch chains: ${multiLocationChains.size}, dup-domains: ${duplicateLeadIds.size}, MIN_TECH_AGE=${MIN_TECH_AGE})`);

  let passed = 0, rejected = 0;
  const reasonCounts = {};

  for (const lead of pool) {
    let status = 'passed';
    let reason = null;
    let techAge = null;
    let reachability = null;

    if (!lead.website) {
      status = 'rejected'; reason = 'no_website';
    } else if (!includeNonUS && lead.country && !['us', 'united states', 'ca', 'canada'].includes(lead.country.toLowerCase())) {
      status = 'rejected'; reason = 'non_us_ca';
    } else if (lead.business_status && lead.business_status !== 'OPERATIONAL') {
      status = 'rejected'; reason = `status_${lead.business_status.toLowerCase()}`;
    } else if (multiLocationChains.has(lead.business_name.toLowerCase().trim())) {
      status = 'rejected'; reason = 'multi_location';
    } else if (isGovernmentEntity(lead)) {
      status = 'rejected'; reason = 'government_entity';
    } else if (isLegalRisk(lead)) {
      status = 'rejected'; reason = 'blocklist_legal_risk';
    } else if (isAssociation(lead)) {
      status = 'rejected'; reason = 'blocklist_association';
    } else if (duplicateLeadIds.has(lead.id)) {
      status = 'rejected'; reason = 'duplicate_domain';
    } else {
      const urlChain = detectChainFromUrl(lead);
      if (urlChain) {
        status = 'rejected'; reason = 'multi_location';
      } else {
        const probe = await probeSite(lead.website);
        if (probe.tech_age) techAge = probe.tech_age;
        if (probe.reachability) reachability = probe.reachability;
        // Size signals always recorded if the probe got HTML
        if (probe.size) {
          // stash on the lead so the post-loop update picks it up
          lead._size = probe.size;
        }
        if (!probe.ok) {
          status = 'rejected'; reason = probe.reason;
        } else if (MIN_TECH_AGE > 0 && (techAge?.score ?? 0) < MIN_TECH_AGE) {
          status = 'rejected';
          reason = `too_modern_${techAge.score}`;
        }

        // Email-required gate — if the lead would otherwise pass but we
        // have no contact email, try /contact variants. If still none,
        // reject as 'no_email' (we can't outreach to them, so they're
        // not actionable for the marketplace pipeline).
        if (status === 'passed' && !reachability?.contact_email) {
          const fallback = await findContactEmailViaContactPage(lead.website);
          if (fallback) {
            reachability = { ...(reachability || {}), contact_email: fallback, site_has_email: 1 };
          } else {
            status = 'rejected'; reason = 'no_email';
          }
        }
      }
    }

    const updates = { filter_status: status, filter_reason: reason };
    if (techAge) {
      updates.tech_age_score = techAge.score;
      updates.tech_age_signals = JSON.stringify(techAge.signals);
    }
    if (reachability) {
      updates.site_has_email = reachability.site_has_email;
      updates.site_has_form = reachability.site_has_form;
      // Only set outreach_email if we actually found one and the lead doesn't already have one
      if (reachability.contact_email && !lead.outreach_email) {
        updates.outreach_email = reachability.contact_email;
      }
    }
    if (lead._size) {
      updates.site_link_count = lead._size.link_count;
      updates.site_html_bytes = lead._size.html_bytes;
      updates.site_video_count = lead._size.video_count;
    }
    updateLead(lead.id, updates);

    if (status === 'passed') passed++;
    else { rejected++; reasonCounts[reason] = (reasonCounts[reason] || 0) + 1; }
  }

  if (batchId) setBatchCounts(batchId, { count_passed_filter: passed });

  // Close the lazy-launched Playwright browser if one was started during this pass.
  if (sharedBrowser) {
    await sharedBrowser.close().catch(() => {});
    sharedBrowser = null;
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
