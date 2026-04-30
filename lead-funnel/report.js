import './load-env.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import db, { listLeadsInBatch, getLatestBatch, getBatch, updateLead } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPORTS_DIR = path.join(__dirname, 'reports');

// Industries where the website is load-bearing for trust / discovery — owners
// in these categories are more likely to engage with a rebuilt-site offer.
// This is a HYPOTHESIS we'll re-weight once conversion data arrives.
const TRUST_DEPENDENT_INDUSTRIES = new Set([
  // Healthcare / professional — prospects research online before calling
  'law', 'dental', 'medical', 'chiropractic', 'accounting', 'veterinary',
  // Trust-heavy life events — funeral, monuments
  'funeral_home', 'monument_headstone',
  // Real estate — listings + agent pages drive business
  'real_estate',
  // High-trust transactions where small business website signals legitimacy
  'bail_bonds', 'locksmith',
  'professional_services',
]);

// Composite conversion-likelihood score. This is THE ranking number — the
// best estimate of "if we rebuild this site and put it on the marketplace,
// how likely is the owner to buy it?"
//
// All weights are PRIORS. Real conversion data (purchased_at) will let us
// regress these weights to actual outcomes — see SKILL.md "Reinforcement
// learning loop". For now: visible reasoning, not magic.
function conversionLikelihood(lead) {
  let score = 0;
  const reasons = [];
  const add = (n, why) => { if (n !== 0) { score += n; reasons.push(`${n >= 0 ? '+' : ''}${n.toFixed(1)} ${why}`); } };

  // SITE PAIN — owner sees a rebuild and recognizes their site is hurting
  add((lead.tech_age_score ?? 0) * 1.5, 'tech-age');
  add((lead.awfulness_score ?? 0) * 2.0, 'awfulness');

  // ABILITY TO PAY — premium trades / professional services have budget
  const payWeight = { high: 15, mid: 8, low: 3 }[lead.ability_to_pay_tier] ?? 5;
  add(payWeight, `pay-tier-${lead.ability_to_pay_tier ?? 'unknown'}`);

  // DECISION SPEED — single owner = can say yes today
  add((lead.single_location_confidence ?? 0) * 8, 'single-location');

  // SCOPE FIT — V1 only rebuilds form-only sites
  add((lead.form_only_confidence ?? 0) * 5, 'form-only');

  // ENGAGEMENT — owner actively maintains Google Business profile
  if ((lead.google_review_count ?? 0) >= 10) add(3, 'reviews≥10');
  if ((lead.google_review_count ?? 0) >= 50) add(3, 'reviews≥50');
  if ((lead.google_rating ?? 0) >= 4.0) add(2, 'rating≥4.0');
  if ((lead.google_rating ?? 0) >= 4.5) add(2, 'rating≥4.5');
  if ((lead.photo_count ?? 0) >= 5) add(2, 'photos≥5');
  if (lead.has_open_hours) add(1, 'hours-listed');

  // REACHABILITY — can we actually contact the owner?
  if (lead.site_has_email) add(4, 'site-has-email');
  if (lead.site_has_form) add(2, 'site-has-form');

  // INDUSTRY TRUST DEPENDENCE — categories where website matters most
  if (TRUST_DEPENDENT_INDUSTRIES.has(lead.industry)) add(8, 'trust-dependent-industry');

  return { score, reasons };
}

function rankScore(lead) {
  return conversionLikelihood(lead).score;
}

function renderLeadRow(lead) {
  const conv = conversionLikelihood(lead).score.toFixed(0);
  const score = lead.awfulness_score ?? '—';
  const techAge = lead.tech_age_score != null ? `${lead.tech_age_score}` : '—';
  const pay = (lead.ability_to_pay_tier ?? '—').slice(0, 4);
  const reviews = lead.google_review_count ?? 0;
  const rating = lead.google_rating != null ? lead.google_rating.toFixed(1) : '—';
  const reach = lead.site_has_email ? '✉️' : (lead.site_has_form ? '📝' : '—');
  const location = [lead.city, lead.state].filter(Boolean).join(', ') || '—';
  const website = lead.website ? `[site](${lead.website})` : '—';

  return `| ${conv} | ${score} | ${techAge} | ${pay} | ${reach} | **${lead.business_name}** | ${location} | ${rating} (${reviews}) | ${website} |`;
}

function renderLeadDetail(lead) {
  const techSignals = (() => {
    if (!lead.tech_age_signals) return null;
    try { return JSON.parse(lead.tech_age_signals); } catch { return null; }
  })();
  const conv = conversionLikelihood(lead);
  const reach = [
    lead.site_has_email ? 'email' : null,
    lead.site_has_form ? 'form' : null,
  ].filter(Boolean).join(' + ') || 'none detected';
  return [
    `### ${conv.score.toFixed(0)} · ${lead.business_name}`,
    `- **Location**: ${[lead.address, lead.city, lead.state].filter(Boolean).join(' · ') || '—'}`,
    `- **Website**: ${lead.website || '—'} · **Reachability**: ${reach}`,
    `- **Google**: ${lead.google_rating ?? '—'} stars (${lead.google_review_count ?? 0} reviews) · ${lead.photo_count ?? 0} photos · category: ${lead.category || '—'}`,
    `- **Awfulness**: ${lead.awfulness_score ?? '—'}/10 · **Tech-age**: ${lead.tech_age_score ?? '—'}${techSignals && techSignals.length ? ` (${techSignals.join(', ')})` : ''}`,
    `- **Pay tier**: ${lead.ability_to_pay_tier ?? '—'} · **single-location**: ${lead.single_location_confidence != null ? Math.round(lead.single_location_confidence * 100) + '%' : '—'} · **form-only**: ${lead.form_only_confidence != null ? Math.round(lead.form_only_confidence * 100) + '%' : '—'}`,
    `- **Conversion-likelihood breakdown**: ${conv.reasons.join(', ')}`,
    `- **Reasoning**: ${lead.awfulness_reasoning || '—'}`,
  ].join('\n');
}

export function renderReport(batchId) {
  const batch = batchId ? getBatch(batchId) : getLatestBatch();
  if (!batch) {
    throw new Error('no batch found');
  }

  const all = listLeadsInBatch(batch.id);
  const passed = all.filter(l => l.filter_status === 'passed' && l.awfulness_score != null);
  const rejected = all.filter(l => l.filter_status === 'rejected');

  const rejectionByReason = {};
  for (const l of rejected) {
    rejectionByReason[l.filter_reason] = (rejectionByReason[l.filter_reason] || 0) + 1;
  }

  // Refresh conversion_likelihood across ALL passed-and-scored leads, not just
  // this batch. Filter weights and signal availability evolve over time, so we
  // re-score everything on every report run for an apples-to-apples ranking.
  const allScored = db.prepare(`
    SELECT * FROM leads
    WHERE filter_status='passed' AND awfulness_score IS NOT NULL
  `).all();
  for (const l of allScored) {
    const conv = conversionLikelihood(l);
    l.conversion_likelihood = conv.score;
    updateLead(l.id, { conversion_likelihood: conv.score });
  }
  // Now re-pull batch-local leads with fresh values so the report uses them
  for (const lead of passed) {
    const fresh = allScored.find(l => l.id === lead.id);
    if (fresh) lead.conversion_likelihood = fresh.conversion_likelihood;
  }
  passed.sort((a, b) => (b.conversion_likelihood ?? 0) - (a.conversion_likelihood ?? 0));

  const byIndustry = new Map();
  for (const l of passed) {
    const k = l.industry || 'other';
    if (!byIndustry.has(k)) byIndustry.set(k, []);
    byIndustry.get(k).push(l);
  }

  const lines = [];
  lines.push(`# Lead batch #${batch.id}`);
  lines.push('');
  lines.push(`**Query**: \`${batch.query}\``);
  lines.push(`**Created**: ${batch.created_at}`);
  lines.push(`**Discovered**: ${all.length} · **Passed filter**: ${passed.length + (all.length - passed.length - rejected.length)} · **Scored**: ${passed.length} · **Rejected**: ${rejected.length}`);
  lines.push('');

  if (rejected.length > 0) {
    lines.push('## Filter rejections');
    lines.push('');
    for (const [reason, n] of Object.entries(rejectionByReason).sort((a, b) => b[1] - a[1])) {
      lines.push(`- \`${reason}\`: ${n}`);
    }
    lines.push('');
  }

  if (passed.length > 0) {
    lines.push('## Top candidates (ranked)');
    lines.push('');
    lines.push('| Conv | Awful | Tech | Pay | Reach | Business | Location | Rating (n) | Site |');
    lines.push('|---:|---:|---:|---|:---:|---|---|---|---|');
    for (const lead of passed.slice(0, 50)) {
      lines.push(renderLeadRow(lead));
    }
    lines.push('');

    lines.push('## By industry');
    lines.push('');
    for (const [industry, leads] of [...byIndustry.entries()].sort((a, b) => b[1].length - a[1].length)) {
      lines.push(`### ${industry} (${leads.length})`);
      lines.push('');
      for (const lead of leads.slice(0, 10)) {
        lines.push(renderLeadDetail(lead));
        lines.push('');
      }
    }
  }

  return lines.join('\n');
}

export function writeReport(batchId) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const batch = batchId ? getBatch(batchId) : getLatestBatch();
  if (!batch) throw new Error('no batch found');

  const md = renderReport(batch.id);
  const date = new Date().toISOString().slice(0, 10);
  const filename = `batch-${batch.id}-${date}.md`;
  const filepath = path.join(REPORTS_DIR, filename);
  fs.writeFileSync(filepath, md, 'utf8');

  console.log(`[report] wrote ${filepath}`);
  return filepath;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const batchArg = process.argv[2];
  const batchId = batchArg ? parseInt(batchArg, 10) : null;
  try {
    writeReport(batchId);
  } catch (err) {
    console.error('[report] FAILED:', err.message);
    process.exit(1);
  }
}
