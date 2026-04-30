// Queue top-N leads for /webfactory rebuilds.
//
// Idempotency model:
//   - Pulls leads where status IN ('identified', 'queued_for_rebuild')
//   - For each one, runs a PRE-FLIGHT check against jobs/{domain}/:
//       * If a complete build already exists → flips to status='rebuilt' (self-heal)
//       * Otherwise → flips to status='queued_for_rebuild', emits the /webfactory cmd
//   - Leads with status='rebuilt' / 'published' / 'sold' / 'dead' / etc. are NEVER
//     picked, so re-running is safe and produces no duplicate work.
//
// CLI:
//   node scripts/queue-rebuilds.js                  # default --top 5
//   node scripts/queue-rebuilds.js --top 10
//   node scripts/queue-rebuilds.js --top 5 --dry    # preview without DB writes
//   node scripts/queue-rebuilds.js --reset-stuck    # flip 'queued_for_rebuild' that
//                                                   # never got built back to 'identified'
//
// Output: a clean list of `/webfactory <url>` commands you can run (or pipe).

import '../load-env.js';
import db, { updateLead } from '../db.js';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const JOBS_DIR = path.join(REPO_ROOT, 'jobs');

const args = process.argv.slice(2);
let topN = 5;
let dryRun = false;
let resetStuck = false;
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--top') topN = parseInt(args[++i], 10);
  else if (a === '--dry' || a === '--dry-run') dryRun = true;
  else if (a === '--reset-stuck') resetStuck = true;
}

// --reset-stuck: flip leads that have been 'queued_for_rebuild' for > 1 hour
// (likely abandoned mid-flight) back to 'identified' so they can be re-queued.
if (resetStuck) {
  const oneHourAgo = new Date(Date.now() - 3600_000).toISOString();
  const stmt = db.prepare(`
    SELECT id, business_name FROM leads
    WHERE status = 'queued_for_rebuild'
      AND (status_changed_at IS NULL OR status_changed_at < ?)
  `);
  const stuck = stmt.all(oneHourAgo);
  for (const l of stuck) {
    if (!dryRun) {
      updateLead(l.id, { status: 'identified', status_changed_at: new Date().toISOString() });
    }
    console.log(`[reset-stuck] ${l.business_name} → identified`);
  }
  console.log(`[reset-stuck] ${stuck.length} leads reset${dryRun ? ' (DRY-RUN)' : ''}`);
  process.exit(0);
}

// --- Pre-flight: does jobs/{domain}/ already have a finished build? ---
//
// "Finished" = at least one option's dist/index.html exists. /webfactory
// supports --skip-c, so we accept option-a or option-b as proof of completion.
// A repo where someone deleted dist/ but kept the source still counts as
// in-progress (we'll surface a warning, not auto-mark rebuilt).
function checkExistingBuild(domain) {
  if (!domain) return null;
  const candidates = [
    path.join(JOBS_DIR, domain),
    path.join(JOBS_DIR, `www.${domain}`),
  ];
  for (const dir of candidates) {
    if (!fs.existsSync(dir)) continue;
    for (const opt of ['option-a', 'option-b', 'option-c']) {
      if (fs.existsSync(path.join(dir, opt, 'dist', 'index.html'))) {
        return { dir, builtOption: opt };
      }
    }
    // Directory exists but no dist — partially built. Worth flagging.
    return { dir, builtOption: null, partial: true };
  }
  return null;
}

// --- Pick eligible leads ---
const candidates = db.prepare(`
  SELECT id, business_name, website, domain, marketplace_slug, marketplace_url,
         conversion_likelihood, awfulness_score, tech_age_score, industry,
         city, state, status
  FROM leads
  WHERE filter_status = 'passed'
    AND status IN ('identified', 'queued_for_rebuild')
    AND awfulness_score IS NOT NULL
    AND website IS NOT NULL
  ORDER BY conversion_likelihood DESC NULLS LAST
  LIMIT ?
`).all(topN);

if (candidates.length === 0) {
  console.log('[queue] no eligible leads. Nothing to do.');
  console.log('[queue] eligibility: filter_status=passed, status=identified|queued_for_rebuild, has score, has website.');
  process.exit(0);
}

console.log(`[queue] reviewing top ${candidates.length} candidate(s)${dryRun ? ' (DRY-RUN)' : ''}\n`);

let queued = 0, alreadyBuilt = 0, partialBuild = 0;
const queueOutput = [];

for (const lead of candidates) {
  const conv = Math.round(lead.conversion_likelihood ?? 0);
  const head = `${lead.business_name} [conv=${conv}, awful=${lead.awfulness_score}, tech=${lead.tech_age_score ?? '—'}]`;
  const existing = checkExistingBuild(lead.domain);

  if (existing && existing.builtOption) {
    // Already fully built — mark rebuilt, never re-queue.
    if (!dryRun) {
      updateLead(lead.id, {
        status: 'rebuilt',
        status_changed_at: new Date().toISOString(),
      });
    }
    alreadyBuilt++;
    console.log(`  ✓ already built  | ${head}`);
    console.log(`                   |   → ${existing.dir} (${existing.builtOption})`);
  } else if (existing && existing.partial) {
    // Directory exists but no dist — flag it, don't auto-mark or re-queue
    partialBuild++;
    console.log(`  ⚠ partial build  | ${head}`);
    console.log(`                   |   → ${existing.dir} (no dist/index.html — was Stage 8 interrupted?)`);
    console.log(`                   |   suggested: cd into the directory and continue or rm -rf to restart`);
  } else {
    // Fresh — queue it
    if (!dryRun && lead.status !== 'queued_for_rebuild') {
      updateLead(lead.id, {
        status: 'queued_for_rebuild',
        status_changed_at: new Date().toISOString(),
      });
    }
    queued++;
    queueOutput.push(lead);
    console.log(`  → queue          | ${head}`);
    console.log(`                   |   ${lead.website}`);
  }
}

console.log('');
console.log(`[queue] queued=${queued}, already_built=${alreadyBuilt}, partial=${partialBuild}${dryRun ? ' (DRY-RUN)' : ''}`);

if (queueOutput.length > 0) {
  console.log('');
  console.log('Run these to start rebuilds (one at a time, in series — /webfactory is heavyweight):');
  console.log('');
  for (const q of queueOutput) {
    console.log(`  /webfactory ${q.website}`);
  }
  console.log('');
  console.log('When each finishes, mark it rebuilt:');
  console.log('  node lead-funnel/scripts/mark-rebuilt.js --domain <domain> --marketplace-url <option-c-url>');
  console.log('');
  console.log('(or just re-run this script — pre-flight will detect finished builds and self-heal.)');
}
