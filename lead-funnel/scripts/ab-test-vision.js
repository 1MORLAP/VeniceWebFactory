// A/B test the scoring model against current Gemma 3 27B baseline.
// Picks a diverse sample of already-scored leads and re-scores via the
// challenger model. Does NOT write to the leads table — read-only comparison.
//
// Usage:
//   node scripts/ab-test-vision.js                       # default: qwen3-vl-235b-a22b
//   node scripts/ab-test-vision.js claude-sonnet-4-6     # any Venice model id

import '../load-env.js';
import OpenAI from 'openai';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import db from '../db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LEAD_FUNNEL_DIR = path.dirname(__dirname);
const BASELINE_MODEL = process.env.SCORING_MODEL || 'google-gemma-3-27b-it';
const CHALLENGER_MODEL = process.argv[2] || 'qwen3-vl-235b-a22b';
const BASE_URL = process.env.VENICE_BASE_URL || 'https://api.venice.ai/api/v1';

// ---- Same prompt as score.js (kept inline so this script is portable) ----
const SCHEMA_HINT = `{
  "awfulness_score": <integer 1-10, 10 = worst>,
  "awfulness_reasoning": <string, 1-3 sentences>,
  "single_location_confidence": <number 0-1>,
  "form_only_confidence": <number 0-1>,
  "ability_to_pay_tier": <"low" | "mid" | "high">,
  "industry": <one of: hvac, plumbing, roofing, electrical, dental, chiropractic, law, accounting, landscaping, auto_repair, auto_body, tire_shop, medical, veterinary, salon, fitness, real_estate, construction, cleaning, pest_control, moving, restaurant, retail, funeral_home, well_drilling, septic, marine_repair, welding, machine_shop, bail_bonds, locksmith, monument_headstone, farm_equipment, sign_shop, antique_pawn, upholstery, professional_services, other>
}`;

const SYSTEM_PROMPT = `You are a website-quality grader for a website-rebuilding business. You'll see desktop and mobile screenshots of a small US business website. Score the visual quality across multiple dimensions and return STRICT JSON — no prose, no markdown fences, just one JSON object matching this exact shape:

${SCHEMA_HINT}

AWFULNESS SCORE rubric (1-10, 10 = worst):
- 9-10: ancient template feel, broken layout, low-res images, garish colors, walls of text, popups, animated GIFs
- 7-8: clearly outdated. Old Wix / GoDaddy / Hibu templates 2010-2018, poor mobile, busy/cluttered, generic stock photos
- 5-6: dated but functional. Passable on desktop, weak on mobile, generic templates
- 3-4: contemporary but unremarkable
- 1-2: polished, professional, distinctive

Respond with ONLY the JSON object.`;

function dataUri(p) {
  return `data:image/png;base64,${fs.readFileSync(p).toString('base64')}`;
}

function parseJson(text) {
  if (!text) return null;
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  try { return JSON.parse(cleaned); } catch {}
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return null;
}

async function scoreWith(client, model, lead) {
  const desktopPath = path.join(LEAD_FUNNEL_DIR, lead.screenshot_desktop);
  const mobilePath = path.join(LEAD_FUNNEL_DIR, lead.screenshot_mobile);
  const t0 = Date.now();
  const completion = await client.chat.completions.create({
    model,
    max_tokens: 2048,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'text', text: `Business: ${lead.business_name}\nLocation: ${[lead.city, lead.state].filter(Boolean).join(', ')}\n\nDesktop screenshot:` },
          { type: 'image_url', image_url: { url: dataUri(desktopPath) } },
          { type: 'text', text: 'Mobile screenshot:' },
          { type: 'image_url', image_url: { url: dataUri(mobilePath) } },
        ],
      },
    ],
    response_format: { type: 'json_object' },
  });
  const latency = Date.now() - t0;
  const text = completion.choices?.[0]?.message?.content || '';
  const data = parseJson(text);
  return { data, usage: completion.usage, latency };
}

// Pick a diverse sample: 2 high awful, 2 mid, 2 low — all must have screenshots
const sample = db.prepare(`
  WITH ranked AS (
    SELECT *, NTILE(3) OVER (ORDER BY awfulness_score) AS bucket
    FROM leads
    WHERE filter_status='passed'
      AND awfulness_score IS NOT NULL
      AND screenshot_desktop IS NOT NULL
      AND screenshot_mobile IS NOT NULL
  )
  SELECT * FROM (
    SELECT *, ROW_NUMBER() OVER (PARTITION BY bucket ORDER BY conversion_likelihood DESC) AS rk
    FROM ranked
  )
  WHERE rk <= 2
  ORDER BY bucket DESC, rk
`).all();

if (sample.length === 0) {
  console.error('[ab] no eligible leads with screenshots — run a batch first');
  process.exit(1);
}

console.log(`[ab] BASELINE = ${BASELINE_MODEL}`);
console.log(`[ab] CHALLENGER = ${CHALLENGER_MODEL}`);
console.log(`[ab] sample size = ${sample.length}\n`);

const client = new OpenAI({
  apiKey: process.env.VENICE_API_KEY,
  baseURL: BASE_URL,
});

const rows = [];
let totalIn = 0, totalOut = 0, totalLatencyMs = 0, failures = 0;

for (const lead of sample) {
  process.stdout.write(`  scoring ${lead.business_name.slice(0, 40).padEnd(40)} ... `);
  try {
    const { data, usage, latency } = await scoreWith(client, CHALLENGER_MODEL, lead);
    if (!data) {
      console.log('FAIL (no JSON)');
      failures++;
      continue;
    }
    totalIn += usage?.prompt_tokens || 0;
    totalOut += usage?.completion_tokens || 0;
    totalLatencyMs += latency;
    rows.push({ lead, baseline: lead, challenger: data, latency, usage });
    console.log(`new=${data.awfulness_score}/10 (was ${lead.awfulness_score})  [${latency}ms]`);
  } catch (err) {
    console.log(`ERR: ${err.message?.slice(0, 60)}`);
    failures++;
  }
}

console.log('\n=== SIDE-BY-SIDE ===\n');
console.log('| Awful (G→C) | Pay (G→C) | Industry (G→C) | Reasoning shift | Business |');
console.log('|---|---|---|---|---|');
for (const r of rows) {
  const g = r.baseline, c = r.challenger;
  const awf = `${g.awfulness_score}→${c.awfulness_score}${g.awfulness_score === c.awfulness_score ? ' =' : (c.awfulness_score > g.awfulness_score ? ' ↑' : ' ↓')}`;
  const pay = `${g.ability_to_pay_tier ?? '—'}→${c.ability_to_pay_tier}${g.ability_to_pay_tier === c.ability_to_pay_tier ? ' =' : ' ✦'}`;
  const ind = `${g.industry ?? '—'}→${c.industry}${g.industry === c.industry ? ' =' : ' ✦'}`;
  const reasonShort = (c.awfulness_reasoning || '').slice(0, 100).replace(/\n/g, ' ').replace(/\|/g, '/');
  console.log(`| ${awf} | ${pay} | ${ind} | ${reasonShort}… | ${g.business_name.slice(0, 35)} |`);
}

console.log('\n=== AGGREGATE ===\n');
const awfDeltas = rows.map(r => r.challenger.awfulness_score - r.baseline.awfulness_score);
const meanDelta = awfDeltas.reduce((a, b) => a + b, 0) / awfDeltas.length;
const indMatch = rows.filter(r => r.baseline.industry === r.challenger.industry).length;
const payMatch = rows.filter(r => r.baseline.ability_to_pay_tier === r.challenger.ability_to_pay_tier).length;

console.log(`scored: ${rows.length}, failed: ${failures}`);
console.log(`mean awfulness delta (challenger − baseline): ${meanDelta.toFixed(2)}`);
console.log(`industry match: ${indMatch}/${rows.length}`);
console.log(`pay-tier match: ${payMatch}/${rows.length}`);
console.log(`avg latency: ${Math.round(totalLatencyMs / rows.length)}ms`);
console.log(`total tokens: prompt=${totalIn} completion=${totalOut}`);
console.log(`approx cost: $${((totalIn / 1e6) * 0.25 + (totalOut / 1e6) * 1.50).toFixed(4)} (qwen3-vl-235b pricing)`);
