#!/usr/bin/env node
/**
 * audit-cost.cjs — roll up cost-per-stage cost-per-build from orchestration.log
 *
 * Built 2026-05-05 alongside Phase C of the tiered model architecture
 * shipment. Reads `jobs/{domain}/orchestration.log` (JSON Lines per
 * ORCHESTRATION LOGGING CONTRACT in SKILL.md), groups events by stage +
 * model, and emits a markdown report.
 *
 * Cost model uses approximate per-million-token rates (USD, output tokens):
 *   Opus:   $75 / M tokens
 *   Sonnet: $15 / M tokens
 *   Haiku:  $1.25 / M tokens
 *
 * The `tokensApprox` detail on each event is the rough output-token
 * count — orchestrators emit it where they have a measurable proxy
 * (JSON byte count / 4, HTML byte count / 4, etc.). Where missing, this
 * script estimates from event semantics:
 *   - sub-agent-dispatched (Sonnet per page): ~3000 tokens/page
 *   - visual-pass-verdict (Opus): ~600 tokens (the ~400-token JSON + ~200 reasoning)
 *   - plugin-invoked (Opus): ~2000 tokens (industry-tokens.json + components scaffold)
 *   - design-brief-written (Opus): ~5000 tokens (per Stage 2 brief size)
 *   - specs-written (Opus): ~specCount × 1500 tokens
 *   - everything else: ~200 tokens (logging-only events)
 *
 * Usage:
 *   node scripts/audit-cost.cjs <domain>           # single-build report
 *   node scripts/audit-cost.cjs --all              # rollup across every job with a log
 *   node scripts/audit-cost.cjs --all --csv        # CSV-only for spreadsheet
 *
 * Exit code: 0 always — this is data, not a gate.
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const JOBS_DIR = path.join(REPO_ROOT, 'jobs');

const args = process.argv.slice(2);
let domain = null;
let allMode = false;
let csvOnly = false;
for (const a of args) {
  if (a === '--all') { allMode = true; continue; }
  if (a === '--csv') { csvOnly = true; continue; }
  if (!a.startsWith('--')) domain = a;
}

if (!domain && !allMode) {
  console.error('Usage: node scripts/audit-cost.cjs <domain>  (single build)');
  console.error('   or: node scripts/audit-cost.cjs --all     (cross-build rollup)');
  process.exit(1);
}

const PRICES_PER_M_TOKENS = { opus: 75, sonnet: 15, haiku: 1.25 };

// Default token estimates per event type when tokensApprox is missing.
const TOKEN_DEFAULTS = {
  'smart-resume-report':         200,
  'images-classified':           200,
  'videos-classified':           200,
  'mode-chosen':                 200,
  'validate-specs-pass':         200,
  'validate-image-pool-pass':    200,
  'validate-stage7-plugin-pass': 200,
  'validate-design-brief-pass':  200,
  'design-brief-written':       5000,
  'specs-written':              5000,   // multiplied by specCount when available
  'sub-agent-dispatched':       3000,   // per page
  'fix-loop-iter':              1500,
  'visual-pass-dispatched':      400,
  'visual-pass-verdict':         600,
  'plugin-invoked':             2000,
  'deploy-recorded':             100,
  'storefront-registered':       200,
};

function loadLog(jobDir) {
  const logPath = path.join(jobDir, 'orchestration.log');
  if (!fs.existsSync(logPath)) return [];
  const lines = fs.readFileSync(logPath, 'utf8').split('\n').filter(l => l.trim());
  const events = [];
  for (const l of lines) {
    try { events.push(JSON.parse(l)); } catch { /* swallow */ }
  }
  return events;
}

function tokensFor(event) {
  const d = event.details || {};
  if (d.tokensApprox && Number.isFinite(Number(d.tokensApprox))) return Number(d.tokensApprox);
  let base = TOKEN_DEFAULTS[event.event] ?? 200;
  if (event.event === 'specs-written' && d.specCount) base = base * Number(d.specCount);
  return base;
}

function modelFor(event) {
  const d = event.details || {};
  if (d.model && PRICES_PER_M_TOKENS[d.model]) return d.model;
  // Fallback: infer from stage-event pair
  if (event.event === 'visual-pass-dispatched' || event.event === 'visual-pass-verdict') return 'opus';
  if (event.event === 'plugin-invoked' || event.event === 'design-brief-written' || event.event === 'specs-written') return 'opus';
  if (event.event === 'sub-agent-dispatched') return 'sonnet';
  if (event.event === 'fix-loop-iter') return 'sonnet';
  return 'opus';   // conservative — unknowns charged at orchestrator rate
}

function dollars(tokens, model) {
  const rate = PRICES_PER_M_TOKENS[model] || PRICES_PER_M_TOKENS.opus;
  return (tokens / 1_000_000) * rate;
}

function summarize(events) {
  const byStage = new Map();
  const byModel = new Map();
  let totalTokens = 0;
  let totalCost = 0;

  for (const e of events) {
    const tokens = tokensFor(e);
    const model = modelFor(e);
    const cost = dollars(tokens, model);
    totalTokens += tokens;
    totalCost += cost;

    const stageKey = e.stage || '?';
    const stageRow = byStage.get(stageKey) || { tokens: 0, cost: 0, events: 0 };
    stageRow.tokens += tokens;
    stageRow.cost += cost;
    stageRow.events += 1;
    byStage.set(stageKey, stageRow);

    const modelRow = byModel.get(model) || { tokens: 0, cost: 0, events: 0 };
    modelRow.tokens += tokens;
    modelRow.cost += cost;
    modelRow.events += 1;
    byModel.set(model, modelRow);
  }

  return { totalTokens, totalCost, byStage, byModel, eventCount: events.length };
}

function reportSingle(d) {
  const jobDir = path.join(JOBS_DIR, d);
  if (!fs.existsSync(jobDir)) {
    console.error(`✗ Job directory not found: ${jobDir}`);
    process.exit(1);
  }
  const events = loadLog(jobDir);
  if (events.length === 0) {
    console.log(`# Cost audit — ${d}`);
    console.log('');
    console.log('⚠ No `orchestration.log` found. Either this build pre-dates the logging contract (2026-05-04) or the orchestrator skipped instrumentation. Cost cannot be computed.');
    return;
  }
  const s = summarize(events);

  console.log(`# Cost audit — ${d}`);
  console.log('');
  console.log(`Generated: ${new Date().toISOString()}`);
  console.log(`Log entries: ${s.eventCount}`);
  console.log(`Total approximate tokens: ${s.totalTokens.toLocaleString()}`);
  console.log(`Total approximate cost: **$${s.totalCost.toFixed(2)}**`);
  console.log('');
  console.log('## By stage');
  console.log('');
  console.log('| Stage | Events | Tokens | Cost |');
  console.log('|---|---|---|---|');
  const stageRows = [...s.byStage.entries()].sort((a, b) => b[1].cost - a[1].cost);
  for (const [stage, row] of stageRows) {
    console.log(`| ${stage} | ${row.events} | ${row.tokens.toLocaleString()} | $${row.cost.toFixed(2)} |`);
  }
  console.log('');
  console.log('## By model');
  console.log('');
  console.log('| Model | Events | Tokens | Cost |');
  console.log('|---|---|---|---|');
  const modelRows = [...s.byModel.entries()].sort((a, b) => b[1].cost - a[1].cost);
  for (const [model, row] of modelRows) {
    const pct = s.totalCost > 0 ? Math.round(row.cost / s.totalCost * 100) : 0;
    console.log(`| ${model} | ${row.events} | ${row.tokens.toLocaleString()} | $${row.cost.toFixed(2)} (${pct}%) |`);
  }
  console.log('');
  console.log('Token counts are estimates derived from `--detail tokensApprox=<N>` where present, or from per-event-type defaults in `audit-cost.cjs`. Real spend numbers come from the Anthropic console.');
}

function reportAll() {
  const domains = fs.readdirSync(JOBS_DIR, { withFileTypes: true })
    .filter(e => e.isDirectory() && !e.name.startsWith('.'))
    .map(e => e.name);

  const rows = [];
  for (const d of domains) {
    const events = loadLog(path.join(JOBS_DIR, d));
    if (events.length === 0) continue;
    const s = summarize(events);
    rows.push({ domain: d, ...s });
  }
  rows.sort((a, b) => b.totalCost - a.totalCost);

  if (csvOnly) {
    console.log('domain,events,tokens,cost_usd,opus_cost,sonnet_cost');
    for (const r of rows) {
      const opus = r.byModel.get('opus')?.cost || 0;
      const sonnet = r.byModel.get('sonnet')?.cost || 0;
      console.log(`${r.domain},${r.eventCount},${r.totalTokens},${r.totalCost.toFixed(2)},${opus.toFixed(2)},${sonnet.toFixed(2)}`);
    }
    return;
  }

  console.log('# Cost audit — cross-build rollup');
  console.log('');
  console.log(`Generated: ${new Date().toISOString()}`);
  console.log(`Builds with orchestration.log: ${rows.length}`);
  if (rows.length === 0) {
    console.log('');
    console.log('⚠ No builds have orchestration.log. The instrumentation only shipped 2026-05-04 — historical builds will not have data until a fresh run.');
    return;
  }
  const totalCost = rows.reduce((sum, r) => sum + r.totalCost, 0);
  console.log(`Aggregate cost (approximate): **$${totalCost.toFixed(2)}**`);
  console.log('');
  console.log('## Per build (sorted by cost descending)');
  console.log('');
  console.log('| Domain | Events | Tokens | Total cost | Opus % | Sonnet % |');
  console.log('|---|---|---|---|---|---|');
  for (const r of rows) {
    const opus = r.byModel.get('opus')?.cost || 0;
    const sonnet = r.byModel.get('sonnet')?.cost || 0;
    const opusPct = r.totalCost > 0 ? Math.round(opus / r.totalCost * 100) : 0;
    const sonnetPct = r.totalCost > 0 ? Math.round(sonnet / r.totalCost * 100) : 0;
    console.log(`| ${r.domain} | ${r.eventCount} | ${r.totalTokens.toLocaleString()} | $${r.totalCost.toFixed(2)} | ${opusPct}% | ${sonnetPct}% |`);
  }
  console.log('');
  console.log('Token counts are estimates. Real spend comes from the Anthropic console; this report quantifies the relative shape of where each build spends its budget.');
}

if (allMode) reportAll();
else reportSingle(domain);
process.exit(0);
