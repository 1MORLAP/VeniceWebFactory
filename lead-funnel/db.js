import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DB_PATH = path.join(__dirname, 'leads.db');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    place_id TEXT UNIQUE NOT NULL,
    business_name TEXT NOT NULL,
    website TEXT,
    domain TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    postal_code TEXT,
    country TEXT,
    category TEXT,
    google_rating REAL,
    google_review_count INTEGER,
    business_status TEXT,

    industry TEXT,

    filter_status TEXT DEFAULT 'pending',
    filter_reason TEXT,

    screenshot_desktop TEXT,
    screenshot_mobile TEXT,
    screenshot_at TEXT,

    awfulness_score INTEGER,
    awfulness_reasoning TEXT,
    single_location_confidence REAL,
    form_only_confidence REAL,
    ability_to_pay_tier TEXT,
    scored_at TEXT,

    tech_age_score INTEGER,
    tech_age_signals TEXT,

    -- Discovery enrichment (engagement proxies from Places API)
    photo_count INTEGER,
    has_open_hours INTEGER,
    primary_type TEXT,

    -- Site reachability proxies (computed during HTTP probe)
    site_has_email INTEGER,
    site_has_form INTEGER,

    -- Composite conversion-likelihood score (computed at report time;
    -- stored for trend analysis as the model evolves)
    conversion_likelihood REAL,

    -- Funnel tracking — populated as marketplace + outreach come online
    outreach_email TEXT,                  -- where to email the owner
    outreach_sent_at TEXT,                -- when we sent the first outreach
    outreach_opened_at TEXT,              -- email open event from outreach provider
    outreach_clicked_at TEXT,             -- click-through event
    marketplace_url TEXT,                 -- listing URL on the marketplace
    marketplace_listed_at TEXT,           -- when listing went live
    marketplace_visited_at TEXT,          -- first visit by the owner (last-touch ok for V1)
    marketplace_visit_count INTEGER DEFAULT 0,
    purchase_offered_at TEXT,             -- inquiry / negotiation start
    purchased_at TEXT,                    -- THE ONE THAT MATTERS — sale closed
    purchase_amount_usd REAL,
    dead_at TEXT,                         -- explicit no, bounce, or N-day silence cutoff
    dead_reason TEXT,                     -- 'no_response_30d' | 'bounced' | 'unsubscribed' | 'rejected' | etc.

    status TEXT DEFAULT 'identified',
    status_changed_at TEXT,
    notes TEXT,

    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
  CREATE INDEX IF NOT EXISTS idx_leads_filter ON leads(filter_status);
  CREATE INDEX IF NOT EXISTS idx_leads_score ON leads(awfulness_score);
  CREATE INDEX IF NOT EXISTS idx_leads_industry ON leads(industry);

  CREATE TABLE IF NOT EXISTS batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    query TEXT NOT NULL,
    industry_hint TEXT,
    count_requested INTEGER,
    count_discovered INTEGER DEFAULT 0,
    count_passed_filter INTEGER DEFAULT 0,
    count_scored INTEGER DEFAULT 0,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS batch_leads (
    batch_id INTEGER NOT NULL,
    lead_id INTEGER NOT NULL,
    PRIMARY KEY (batch_id, lead_id),
    FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE,
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
  );
`);

// Migrations for upgrading existing databases. CREATE TABLE IF NOT EXISTS is
// a no-op against existing tables, so any new columns must be added via
// ALTER TABLE. We compute the diff by reading PRAGMA table_info and add any
// columns from the desired schema that are missing.
const desiredColumns = [
  ['tech_age_score', 'INTEGER'],
  ['tech_age_signals', 'TEXT'],
  ['photo_count', 'INTEGER'],
  ['has_open_hours', 'INTEGER'],
  ['primary_type', 'TEXT'],
  ['site_has_email', 'INTEGER'],
  ['site_has_form', 'INTEGER'],
  ['site_link_count', 'INTEGER'],
  ['site_html_bytes', 'INTEGER'],
  ['site_video_count', 'INTEGER'],
  ['conversion_likelihood', 'REAL'],
  ['marketplace_slug', 'TEXT'],
  ['outreach_email', 'TEXT'],
  ['outreach_sent_at', 'TEXT'],
  ['outreach_message_id', 'TEXT'],
  ['outreach_opened_at', 'TEXT'],
  ['outreach_clicked_at', 'TEXT'],
  ['marketplace_url', 'TEXT'],
  ['marketplace_listed_at', 'TEXT'],
  ['marketplace_visited_at', 'TEXT'],
  ['marketplace_visit_count', 'INTEGER DEFAULT 0'],
  ['purchase_offered_at', 'TEXT'],
  ['purchased_at', 'TEXT'],
  ['purchase_amount_usd', 'REAL'],
  ['dead_at', 'TEXT'],
  ['dead_reason', 'TEXT'],
];
const existingCols = new Set(db.prepare('PRAGMA table_info(leads)').all().map(c => c.name));
for (const [name, type] of desiredColumns) {
  if (!existingCols.has(name)) db.exec(`ALTER TABLE leads ADD COLUMN ${name} ${type}`);
}
db.exec('CREATE INDEX IF NOT EXISTS idx_leads_techage ON leads(tech_age_score)');
db.exec('CREATE INDEX IF NOT EXISTS idx_leads_conv ON leads(conversion_likelihood)');
db.exec('CREATE INDEX IF NOT EXISTS idx_leads_purchased ON leads(purchased_at)');
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_slug ON leads(marketplace_slug) WHERE marketplace_slug IS NOT NULL');
db.exec('CREATE INDEX IF NOT EXISTS idx_leads_msgid ON leads(outreach_message_id) WHERE outreach_message_id IS NOT NULL');

const insertLead = db.prepare(`
  INSERT INTO leads (
    place_id, business_name, website, domain, address, city, state, postal_code, country,
    category, google_rating, google_review_count, business_status,
    photo_count, has_open_hours, primary_type
  )
  VALUES (
    @place_id, @business_name, @website, @domain, @address, @city, @state, @postal_code, @country,
    @category, @google_rating, @google_review_count, @business_status,
    @photo_count, @has_open_hours, @primary_type
  )
  ON CONFLICT(place_id) DO UPDATE SET
    business_name = excluded.business_name,
    website = excluded.website,
    domain = excluded.domain,
    address = excluded.address,
    city = excluded.city,
    state = excluded.state,
    postal_code = excluded.postal_code,
    country = excluded.country,
    category = excluded.category,
    google_rating = excluded.google_rating,
    google_review_count = excluded.google_review_count,
    business_status = excluded.business_status,
    photo_count = excluded.photo_count,
    has_open_hours = excluded.has_open_hours,
    primary_type = excluded.primary_type,
    updated_at = datetime('now')
  RETURNING id
`);

export function upsertLead(lead) {
  // Fill in defaults for any missing enrichment fields so the prepared
  // statement bind doesn't throw "missing named parameter".
  const row = insertLead.get({
    photo_count: null,
    has_open_hours: null,
    primary_type: null,
    ...lead,
  });
  return row.id;
}

const insertBatch = db.prepare(`
  INSERT INTO batches (query, industry_hint, count_requested, notes)
  VALUES (@query, @industry_hint, @count_requested, @notes)
  RETURNING id, query, count_requested, created_at
`);

export function createBatch({ query, industry_hint = null, count_requested = null, notes = null }) {
  return insertBatch.get({ query, industry_hint, count_requested, notes });
}

const linkBatch = db.prepare(`
  INSERT OR IGNORE INTO batch_leads (batch_id, lead_id) VALUES (?, ?)
`);

export function linkLeadToBatch(batchId, leadId) {
  linkBatch.run(batchId, leadId);
}

const allowedBatchCountFields = new Set(['count_discovered', 'count_passed_filter', 'count_scored']);

export function setBatchCounts(id, counts) {
  const keys = Object.keys(counts).filter(k => allowedBatchCountFields.has(k));
  if (keys.length === 0) return;
  const setClause = keys.map(k => `${k} = @${k}`).join(', ');
  db.prepare(`UPDATE batches SET ${setClause} WHERE id = @id`).run({ id, ...counts });
}

const allowedUpdateFields = new Set([
  'business_name', 'website', 'domain', 'address', 'city', 'state', 'postal_code',
  'country', 'category', 'google_rating', 'google_review_count', 'business_status',
  'industry', 'filter_status', 'filter_reason',
  'screenshot_desktop', 'screenshot_mobile', 'screenshot_at',
  'awfulness_score', 'awfulness_reasoning', 'single_location_confidence',
  'form_only_confidence', 'ability_to_pay_tier', 'scored_at',
  'tech_age_score', 'tech_age_signals',
  'photo_count', 'has_open_hours', 'primary_type',
  'site_has_email', 'site_has_form', 'site_link_count', 'site_html_bytes',
  'site_video_count', 'conversion_likelihood',
  'marketplace_slug',
  'outreach_email', 'outreach_sent_at', 'outreach_message_id',
  'outreach_opened_at', 'outreach_clicked_at',
  'marketplace_url', 'marketplace_listed_at', 'marketplace_visited_at', 'marketplace_visit_count',
  'purchase_offered_at', 'purchased_at', 'purchase_amount_usd',
  'dead_at', 'dead_reason',
  'status', 'status_changed_at', 'notes',
]);

export function updateLead(id, fields) {
  const keys = Object.keys(fields).filter(k => allowedUpdateFields.has(k));
  if (keys.length === 0) return;
  const setClause = keys.map(k => `${k} = @${k}`).join(', ');
  const stmt = db.prepare(`UPDATE leads SET ${setClause}, updated_at = datetime('now') WHERE id = @id`);
  stmt.run({ id, ...fields });
}

export function listAllLeads() {
  return db.prepare('SELECT * FROM leads').all();
}

export function listLeadsByFilterStatus(status) {
  return db.prepare('SELECT * FROM leads WHERE filter_status = ?').all(status);
}

export function listLeadsForScreenshot() {
  return db.prepare(`
    SELECT * FROM leads
    WHERE filter_status = 'passed'
      AND website IS NOT NULL
      AND screenshot_desktop IS NULL
  `).all();
}

export function listLeadsForScoring() {
  return db.prepare(`
    SELECT * FROM leads
    WHERE filter_status = 'passed'
      AND screenshot_desktop IS NOT NULL
      AND awfulness_score IS NULL
  `).all();
}

export function listLeadsInBatch(batchId) {
  return db.prepare(`
    SELECT l.* FROM leads l
    INNER JOIN batch_leads bl ON bl.lead_id = l.id
    WHERE bl.batch_id = ?
  `).all(batchId);
}

export function getLatestBatch() {
  return db.prepare('SELECT * FROM batches ORDER BY id DESC LIMIT 1').get();
}

export function getLeadByMessageId(messageId) {
  if (!messageId) return null;
  return db.prepare('SELECT * FROM leads WHERE outreach_message_id = ?').get(messageId);
}

export function getBatch(id) {
  return db.prepare('SELECT * FROM batches WHERE id = ?').get(id);
}

export default db;
