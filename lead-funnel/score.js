import './load-env.js';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listLeadsForScoring, updateLead, setBatchCounts, getLatestBatch } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODEL = process.env.SCORING_MODEL || 'claude-haiku-4-5';

const SYSTEM_PROMPT = `You are a website-quality grader for a website-rebuilding business. You'll see desktop and mobile screenshots of a small US business website. Score the visual quality across multiple dimensions and return strict JSON.

AWFULNESS SCORE (1-10, 10 = worst):
- 9-10: ancient. Mid-2000s template feel, broken layout, low-res images, garish colors, console-style fonts, walls of text, popups, animated GIFs, autoplay audio, "best viewed in IE6"
- 7-8: clearly outdated. Old Wix / GoDaddy / Hibu templates 2010-2018, poor mobile responsiveness, busy/cluttered, generic stock photos, default fonts, hero photo + headline + nothing else
- 5-6: dated but functional. Passable on desktop, weak on mobile, generic templates, no visual hierarchy, weak typography
- 3-4: contemporary but unremarkable. Modern enough but flat / generic, no distinctive elements, looks like an unloved Squarespace template
- 1-2: polished, professional, distinctive. Strong typography, considered palette, custom imagery, real visual hierarchy

CONFIDENCE FIELDS (0.0 to 1.0):
- single_location_confidence: 1.0 = clearly serves one location / has one address. 0.0 = clearly multi-location chain or franchise. 0.5 = unclear from screenshots.
- form_only_confidence: 1.0 = simple site with just info + a contact form, no e-commerce. 0.0 = full online store with cart/checkout/products. 0.5 = unclear.

ABILITY TO PAY TIER:
- "high": premium trades (HVAC, roofing, custom home builders), attorneys, dentists, specialty medical, B2B professional services
- "mid": general trades, small offices, salons, restaurants, retail, fitness
- "low": single-operator local trades, hourly services, very small consumer businesses

INDUSTRY (normalized — pick the closest): hvac, plumbing, roofing, electrical, dental, chiropractic, law, accounting, landscaping, auto_repair, medical, veterinary, salon, fitness, real_estate, construction, cleaning, pest_control, moving, restaurant, retail, professional_services, other

Score the WORST aspects honestly. We hunt opportunity sites we'd rebuild, so be calibrated: a site that's "fine" deserves a 4-5, not a 7-8. Reserve 8+ for sites that genuinely look broken/ancient. Reserve 1-2 for sites that need no help.`;

const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    awfulness_score: { type: 'integer' },
    awfulness_reasoning: { type: 'string' },
    single_location_confidence: { type: 'number' },
    form_only_confidence: { type: 'number' },
    ability_to_pay_tier: { type: 'string', enum: ['low', 'mid', 'high'] },
    industry: {
      type: 'string',
      enum: [
        'hvac', 'plumbing', 'roofing', 'electrical', 'dental', 'chiropractic',
        'law', 'accounting', 'landscaping', 'auto_repair',
        'medical', 'veterinary', 'salon', 'fitness', 'real_estate',
        'construction', 'cleaning', 'pest_control', 'moving',
        'restaurant', 'retail', 'professional_services', 'other',
      ],
    },
  },
  required: [
    'awfulness_score', 'awfulness_reasoning',
    'single_location_confidence', 'form_only_confidence',
    'ability_to_pay_tier', 'industry',
  ],
  additionalProperties: false,
};

function parseJson(text) {
  try { return JSON.parse(text); } catch {}
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]); } catch {}
  }
  return null;
}

async function scoreOne(client, lead) {
  const desktopPath = path.join(__dirname, lead.screenshot_desktop);
  const mobilePath = path.join(__dirname, lead.screenshot_mobile);

  if (!fs.existsSync(desktopPath) || !fs.existsSync(mobilePath)) {
    return { error: 'screenshot_missing' };
  }

  const desktop = fs.readFileSync(desktopPath).toString('base64');
  const mobile = fs.readFileSync(mobilePath).toString('base64');

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: [
      { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
    ],
    output_config: {
      format: { type: 'json_schema', schema: OUTPUT_SCHEMA },
    },
    messages: [
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
            ].join('\n'),
          },
          { type: 'text', text: 'Desktop screenshot (1440×900):' },
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: desktop } },
          { type: 'text', text: 'Mobile screenshot (390×844):' },
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: mobile } },
        ],
      },
    ],
  });

  const textBlock = message.content.find(b => b.type === 'text');
  if (!textBlock) return { error: 'no_text_in_response', usage: message.usage };

  const data = parseJson(textBlock.text);
  if (!data) return { error: 'json_parse_failed', raw: textBlock.text.slice(0, 400), usage: message.usage };

  return { ok: true, data, usage: message.usage };
}

export async function scoreAll() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not set in lead-funnel/.env (needed for scoring)');
  }

  const client = new Anthropic();
  const leads = listLeadsForScoring();
  if (leads.length === 0) {
    console.log('[score] nothing to do');
    return { scored: 0, failed: 0 };
  }

  console.log(`[score] scoring ${leads.length} leads with ${MODEL}`);
  let scored = 0, failed = 0;
  let cacheRead = 0, cacheWrite = 0, inputTotal = 0, outputTotal = 0;

  for (const lead of leads) {
    try {
      const result = await scoreOne(client, lead);
      if (result.usage) {
        cacheRead += result.usage.cache_read_input_tokens || 0;
        cacheWrite += result.usage.cache_creation_input_tokens || 0;
        inputTotal += result.usage.input_tokens || 0;
        outputTotal += result.usage.output_tokens || 0;
      }

      if (result.error) {
        failed++;
        console.error(`[score] ✗ ${lead.business_name}: ${result.error}`);
        continue;
      }

      const d = result.data;
      updateLead(lead.id, {
        awfulness_score: d.awfulness_score,
        awfulness_reasoning: d.awfulness_reasoning,
        single_location_confidence: d.single_location_confidence,
        form_only_confidence: d.form_only_confidence,
        ability_to_pay_tier: d.ability_to_pay_tier,
        industry: d.industry,
        scored_at: new Date().toISOString(),
      });
      scored++;
      console.log(`[score] ✓ ${lead.business_name} → ${d.awfulness_score}/10 [${d.industry}, pay:${d.ability_to_pay_tier}]`);
    } catch (err) {
      failed++;
      if (err instanceof Anthropic.RateLimitError) {
        console.error(`[score] ✗ ${lead.business_name}: rate limited`);
      } else if (err instanceof Anthropic.APIError) {
        console.error(`[score] ✗ ${lead.business_name}: API ${err.status} — ${err.message}`);
      } else {
        console.error(`[score] ✗ ${lead.business_name}: ${err.message}`);
      }
    }
  }

  const latestBatch = getLatestBatch();
  if (latestBatch) setBatchCounts(latestBatch.id, { count_scored: scored });

  console.log(`[score] scored=${scored} failed=${failed}`);
  if (inputTotal || outputTotal) {
    console.log(`[score] tokens: input=${inputTotal} cache_read=${cacheRead} cache_write=${cacheWrite} output=${outputTotal}`);
  }
  return { scored, failed };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  scoreAll().catch(err => {
    console.error('[score] FAILED:', err.message);
    process.exit(1);
  });
}
