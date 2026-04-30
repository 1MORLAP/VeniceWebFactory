import './load-env.js';
import OpenAI from 'openai';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listLeadsForScoring, updateLead, setBatchCounts, getLatestBatch } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODEL = process.env.SCORING_MODEL || 'google-gemma-3-27b-it';
const BASE_URL = process.env.VENICE_BASE_URL || 'https://api.venice.ai/api/v1';

const SCHEMA_HINT = `{
  "awfulness_score": <integer 1-10, 10 = worst>,
  "awfulness_reasoning": <string, 1-3 sentences>,
  "single_location_confidence": <number 0-1, 1 = clearly single-location>,
  "form_only_confidence": <number 0-1, 1 = simple site / no e-commerce>,
  "ability_to_pay_tier": <"low" | "mid" | "high">,
  "industry": <EXACTLY one of these underscore-snake-case strings, no variation: hvac, plumbing, roofing, electrical, dental, chiropractic, law, accounting, landscaping, auto_repair, auto_body, tire_shop, medical, veterinary, salon, fitness, real_estate, construction, cleaning, pest_control, moving, restaurant, retail, funeral_home, well_drilling, septic, marine_repair, welding, machine_shop, bail_bonds, locksmith, monument_headstone, farm_equipment, sign_shop, antique_pawn, upholstery, professional_services, other>
}`;

const SYSTEM_PROMPT = `You are a website-quality grader for a website-rebuilding business. You'll see desktop and mobile screenshots of a small US business website. Score the visual quality across multiple dimensions and return STRICT JSON — no prose, no markdown fences, just one JSON object matching this exact shape:

${SCHEMA_HINT}

AWFULNESS SCORE rubric (1-10, 10 = worst):
- 9-10: ancient. Mid-2000s template feel, broken layout, low-res images, garish colors, console-style fonts, walls of text, popups, animated GIFs, autoplay audio, "best viewed in IE6"
- 7-8: clearly outdated. Old Wix / GoDaddy / Hibu templates 2010-2018, poor mobile responsiveness, busy/cluttered, generic stock photos, default fonts, hero photo + headline + nothing else
- 5-6: dated but functional. Passable on desktop, weak on mobile, generic templates, no visual hierarchy, weak typography
- 3-4: contemporary but unremarkable. Modern enough but flat / generic, no distinctive elements, looks like an unloved Squarespace template
- 1-2: polished, professional, distinctive. Strong typography, considered palette, custom imagery, real visual hierarchy

CONFIDENCE FIELDS (0.0 to 1.0):
- single_location_confidence: 1.0 = clearly serves one location / has one address. 0.0 = clearly multi-location chain or franchise. 0.5 = unclear.
- form_only_confidence: 1.0 = simple site with just info + a contact form, no e-commerce. 0.0 = full online store with cart/checkout/products. 0.5 = unclear.

ABILITY TO PAY TIER:
- "high": premium trades (HVAC, roofing, custom home builders), attorneys, dentists, specialty medical, B2B professional services
- "mid": general trades, small offices, salons, restaurants, retail, fitness
- "low": single-operator local trades, hourly services, very small consumer businesses

Score the WORST aspects honestly. We hunt opportunity sites we'd rebuild, so be calibrated: a site that's "fine" deserves a 4-5, not a 7-8. Reserve 8+ for sites that genuinely look broken/ancient. Reserve 1-2 for sites that need no help.

INDUSTRY DISAMBIGUATION (common confusions — choose carefully):
- Septic tank pumping / portable toilet rental / drain cleaning → "septic" (NOT "pest_control")
- Termite / rodent / insect extermination → "pest_control"
- Funeral home, mortuary, crematorium → "funeral_home" (always with underscore, never "funeral home" or "funeral")
- Headstone / monument / cemetery memorial → "monument_headstone"
- Tractor / farm-equipment repair → "farm_equipment"
- Boat / marine engine repair → "marine_repair"
- Welding / machine shop / fabrication → "welding"
- Use "professional_services" only when the business defies all other categories.

Respond with ONLY the JSON object. No prose before or after. No markdown code fences. Industry MUST be one of the listed enum values exactly as shown — underscore-snake-case, no spaces.`;

function parseJson(text) {
  if (!text) return null;
  // Strip markdown fences if any
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  try { return JSON.parse(cleaned); } catch {}
  // Fallback: find first {...} block
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]); } catch {}
  }
  return null;
}

// Industries we hard-block post-score (matches BLOCKLISTED_INDUSTRIES in
// filter.js). Even if name-pattern check missed a law firm, Gemma will
// classify it correctly and we reject here before it shows up in reports.
const POST_SCORE_BLOCKLIST = new Set([
  'law',
]);

// Canonical industry enum (kept in sync with the prompt's enum list).
const CANONICAL_INDUSTRIES = new Set([
  'hvac', 'plumbing', 'roofing', 'electrical', 'dental', 'chiropractic',
  'law', 'accounting', 'landscaping', 'auto_repair', 'auto_body', 'tire_shop',
  'medical', 'veterinary', 'salon', 'fitness', 'real_estate', 'construction',
  'cleaning', 'pest_control', 'moving', 'restaurant', 'retail', 'funeral_home',
  'well_drilling', 'septic', 'marine_repair', 'welding', 'machine_shop',
  'bail_bonds', 'locksmith', 'monument_headstone', 'farm_equipment',
  'sign_shop', 'antique_pawn', 'upholstery', 'professional_services', 'other',
]);

// Map common Gemma drifts to canonical enum values.
const INDUSTRY_ALIASES = {
  // funeral
  'funeral': 'funeral_home', 'funeral home': 'funeral_home', 'funeral homes': 'funeral_home',
  'mortuary': 'funeral_home', 'crematorium': 'funeral_home', 'crematory': 'funeral_home',
  // septic vs pest_control — Gemma confuses these
  'septic_services': 'septic', 'septic_service': 'septic', 'septic services': 'septic',
  'septic tank': 'septic', 'portable toilet': 'septic',
  // monuments
  'monument': 'monument_headstone', 'monuments': 'monument_headstone',
  'headstone': 'monument_headstone', 'headstones': 'monument_headstone',
  'memorial': 'monument_headstone', 'cemetery': 'monument_headstone',
  // farm
  'tractor_repair': 'farm_equipment', 'tractor': 'farm_equipment',
  'farm equipment': 'farm_equipment', 'agricultural': 'farm_equipment',
  // marine
  'boat_repair': 'marine_repair', 'marine': 'marine_repair', 'boat': 'marine_repair',
  // misc
  'attorneys': 'law', 'attorney': 'law', 'legal': 'law', 'lawyer': 'law',
  'dentist': 'dental', 'dentists': 'dental',
  'auto repair': 'auto_repair', 'auto body': 'auto_body',
  'tire shop': 'tire_shop', 'tire': 'tire_shop',
  'pest control': 'pest_control', 'exterminator': 'pest_control',
  'real estate': 'real_estate', 'realtor': 'real_estate',
  'professional services': 'professional_services',
  'sign shop': 'sign_shop', 'antique': 'antique_pawn', 'pawn': 'antique_pawn',
  'machine shop': 'machine_shop', 'fabrication': 'welding',
  'bail bonds': 'bail_bonds', 'well drilling': 'well_drilling',
};

export function normalizeIndustry(raw, lead = null) {
  if (!raw) return 'other';
  const lower = String(raw).toLowerCase().trim();
  // 1. Already canonical
  if (CANONICAL_INDUSTRIES.has(lower)) return lower;
  // 2. Alias map
  if (INDUSTRY_ALIASES[lower]) return INDUSTRY_ALIASES[lower];
  // 3. Underscore-flatten and retry
  const flat = lower.replace(/[\s-]+/g, '_');
  if (CANONICAL_INDUSTRIES.has(flat)) return flat;
  if (INDUSTRY_ALIASES[flat]) return INDUSTRY_ALIASES[flat];
  // 4. Heuristic on business name as last-resort hint
  if (lead?.business_name) {
    const name = lead.business_name.toLowerCase();
    if (/septic|portable toilet|porta-potty/.test(name)) return 'septic';
    if (/funeral|mortuary|cremation|crematorium/.test(name)) return 'funeral_home';
    if (/monument|headstone|memorial/.test(name)) return 'monument_headstone';
    if (/tractor|farm equipment/.test(name)) return 'farm_equipment';
    if (/marine|boat/.test(name)) return 'marine_repair';
    if (/welding|fabrication/.test(name)) return 'welding';
    if (/locksmith|lock/.test(name)) return 'locksmith';
    if (/bail|bond/.test(name)) return 'bail_bonds';
  }
  return 'other';
}

function dataUri(filePath) {
  const b64 = fs.readFileSync(filePath).toString('base64');
  return `data:image/png;base64,${b64}`;
}

async function scoreOne(client, lead) {
  const desktopPath = path.join(__dirname, lead.screenshot_desktop);
  const mobilePath = path.join(__dirname, lead.screenshot_mobile);

  if (!fs.existsSync(desktopPath) || !fs.existsSync(mobilePath)) {
    return { error: 'screenshot_missing' };
  }

  const completion = await client.chat.completions.create({
    model: MODEL,
    // 2048 leaves plenty of headroom for the reasoning string; Gemma
    // occasionally writes a 4-5 sentence reasoning that truncated at 1024.
    max_tokens: 2048,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: [
              `Business: ${lead.business_name}`,
              `Website: ${lead.website}`,
              `Google category: ${lead.category || 'unknown'}`,
              `Location: ${[lead.city, lead.state].filter(Boolean).join(', ') || 'unknown'}`,
              '',
              'Desktop screenshot (1440×900):',
            ].join('\n'),
          },
          { type: 'image_url', image_url: { url: dataUri(desktopPath) } },
          { type: 'text', text: 'Mobile screenshot (390×844):' },
          { type: 'image_url', image_url: { url: dataUri(mobilePath) } },
        ],
      },
    ],
    response_format: { type: 'json_object' },
  });

  const text = completion.choices?.[0]?.message?.content || '';
  const data = parseJson(text);
  if (!data) {
    return { error: 'json_parse_failed', raw: text.slice(0, 400), usage: completion.usage };
  }

  return { ok: true, data, usage: completion.usage };
}

export async function scoreAll() {
  if (!process.env.VENICE_API_KEY) {
    throw new Error('VENICE_API_KEY not set in lead-funnel/.env (needed for scoring)');
  }

  const client = new OpenAI({
    apiKey: process.env.VENICE_API_KEY,
    baseURL: BASE_URL,
  });

  const leads = listLeadsForScoring();
  if (leads.length === 0) {
    console.log('[score] nothing to do');
    return { scored: 0, failed: 0 };
  }

  console.log(`[score] scoring ${leads.length} leads with ${MODEL} (via Venice)`);
  let scored = 0, failed = 0;
  let promptTotal = 0, completionTotal = 0;

  for (const lead of leads) {
    try {
      const result = await scoreOne(client, lead);
      if (result.usage) {
        promptTotal += result.usage.prompt_tokens || 0;
        completionTotal += result.usage.completion_tokens || 0;
      }

      if (result.error) {
        failed++;
        console.error(`[score] ✗ ${lead.business_name}: ${result.error}${result.raw ? ` — ${result.raw.slice(0, 80)}` : ''}`);
        continue;
      }

      const d = result.data;
      const industry = normalizeIndustry(d.industry, lead);

      // Post-score blocklist — catches a law firm whose name didn't match
      // pre-filter patterns (e.g. "Smith & Johnson" with no "law" in name).
      if (POST_SCORE_BLOCKLIST.has(industry)) {
        updateLead(lead.id, {
          industry,
          awfulness_score: d.awfulness_score,
          awfulness_reasoning: d.awfulness_reasoning,
          scored_at: new Date().toISOString(),
          filter_status: 'rejected',
          filter_reason: `blocklist_${industry}`,
        });
        failed++;
        console.error(`[score] ✗ ${lead.business_name}: post-score blocklist (industry=${industry})`);
        continue;
      }

      updateLead(lead.id, {
        awfulness_score: d.awfulness_score,
        awfulness_reasoning: d.awfulness_reasoning,
        single_location_confidence: d.single_location_confidence,
        form_only_confidence: d.form_only_confidence,
        ability_to_pay_tier: d.ability_to_pay_tier,
        industry,
        scored_at: new Date().toISOString(),
      });
      scored++;
      console.log(`[score] ✓ ${lead.business_name} → ${d.awfulness_score}/10 [${industry}${d.industry !== industry ? ` (←${d.industry})` : ''}, pay:${d.ability_to_pay_tier}]`);
    } catch (err) {
      failed++;
      if (err instanceof OpenAI.RateLimitError) {
        console.error(`[score] ✗ ${lead.business_name}: rate limited (Venice)`);
      } else if (err instanceof OpenAI.AuthenticationError) {
        console.error(`[score] ✗ ${lead.business_name}: bad VENICE_API_KEY`);
      } else if (err instanceof OpenAI.APIError) {
        console.error(`[score] ✗ ${lead.business_name}: Venice ${err.status} — ${err.message}`);
      } else {
        console.error(`[score] ✗ ${lead.business_name}: ${err.message}`);
      }
    }
  }

  const latestBatch = getLatestBatch();
  if (latestBatch) setBatchCounts(latestBatch.id, { count_scored: scored });

  console.log(`[score] scored=${scored} failed=${failed}`);
  if (promptTotal || completionTotal) {
    console.log(`[score] tokens: prompt=${promptTotal} completion=${completionTotal}`);
  }
  return { scored, failed };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  scoreAll().catch(err => {
    console.error('[score] FAILED:', err.message);
    process.exit(1);
  });
}
