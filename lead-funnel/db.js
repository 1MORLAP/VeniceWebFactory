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

const insertLead = db.prepare(`
  INSERT INTO leads (place_id, business_name, website, domain, address, city, state, postal_code, country,
                     category, google_rating, google_review_count, business_status)
  VALUES (@place_id, @business_name, @website, @domain, @address, @city, @state, @postal_code, @country,
          @category, @google_rating, @google_review_count, @business_status)
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
    updated_at = datetime('now')
  RETURNING id
`);

export function upsertLead(lead) {
  const row = insertLead.get(lead);
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

const updateBatchCounts = db.prepare(`
  UPDATE batches SET
    count_discovered = COALESCE(@count_discovered, count_discovered),
    count_passed_filter = COALESCE(@count_passed_filter, count_passed_filter),
    count_scored = COALESCE(@count_scored, count_scored)
  WHERE id = @id
`);

export function setBatchCounts(id, counts) {
  updateBatchCounts.run({ id, ...counts });
}

const allowedUpdateFields = new Set([
  'business_name', 'website', 'domain', 'address', 'city', 'state', 'postal_code',
  'country', 'category', 'google_rating', 'google_review_count', 'business_status',
  'industry', 'filter_status', 'filter_reason',
  'screenshot_desktop', 'screenshot_mobile', 'screenshot_at',
  'awfulness_score', 'awfulness_reasoning', 'single_location_confidence',
  'form_only_confidence', 'ability_to_pay_tier', 'scored_at',
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

export function getBatch(id) {
  return db.prepare('SELECT * FROM batches WHERE id = ?').get(id);
}

export default db;
