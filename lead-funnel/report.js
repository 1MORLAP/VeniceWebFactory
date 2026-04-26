import './load-env.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listLeadsInBatch, getLatestBatch, getBatch } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPORTS_DIR = path.join(__dirname, 'reports');

function rankScore(lead) {
  const awful = lead.awfulness_score ?? 0;
  const single = lead.single_location_confidence ?? 0;
  const formOnly = lead.form_only_confidence ?? 0;
  const payWeight = { high: 1.0, mid: 0.7, low: 0.4 }[lead.ability_to_pay_tier] ?? 0.5;
  return awful * 10 + single * 5 + formOnly * 5 + payWeight * 10;
}

function renderLeadRow(lead) {
  const score = lead.awfulness_score ?? '—';
  const single = lead.single_location_confidence != null ? `${Math.round(lead.single_location_confidence * 100)}%` : '—';
  const form = lead.form_only_confidence != null ? `${Math.round(lead.form_only_confidence * 100)}%` : '—';
  const pay = lead.ability_to_pay_tier ?? '—';
  const reviews = lead.google_review_count ?? 0;
  const rating = lead.google_rating != null ? lead.google_rating.toFixed(1) : '—';
  const location = [lead.city, lead.state].filter(Boolean).join(', ') || '—';
  const website = lead.website ? `[site](${lead.website})` : '—';

  return `| ${score} | **${lead.business_name}** | ${location} | ${rating} (${reviews}) | ${pay} | ${single} | ${form} | ${website} |`;
}

function renderLeadDetail(lead) {
  return [
    `### ${lead.awfulness_score ?? '—'}/10 · ${lead.business_name}`,
    `- **Location**: ${[lead.address, lead.city, lead.state].filter(Boolean).join(' · ') || '—'}`,
    `- **Website**: ${lead.website || '—'}`,
    `- **Google**: ${lead.google_rating ?? '—'} stars (${lead.google_review_count ?? 0} reviews) · category: ${lead.category || '—'}`,
    `- **Pay tier**: ${lead.ability_to_pay_tier ?? '—'} · **single-location**: ${lead.single_location_confidence != null ? Math.round(lead.single_location_confidence * 100) + '%' : '—'} · **form-only**: ${lead.form_only_confidence != null ? Math.round(lead.form_only_confidence * 100) + '%' : '—'}`,
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

  passed.sort((a, b) => rankScore(b) - rankScore(a));

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
    lines.push('| Awful | Business | Location | Rating (n) | Pay | Single | Form-only | Site |');
    lines.push('|---:|---|---|---|---|---:|---:|---|');
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
