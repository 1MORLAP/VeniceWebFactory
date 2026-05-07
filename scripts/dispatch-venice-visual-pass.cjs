#!/usr/bin/env node
/**
 * dispatch-venice-visual-pass.cjs — Venice / Qwen3-VL 235B visual-pass dispatcher
 * (Phase K-narrow A/B harness — 3rd variant alongside Anthropic Opus + Sonnet)
 *
 * Built 2026-05-07 for Phase K-narrow expanded. The two existing variants
 * (Anthropic Opus 4.7, Anthropic Sonnet 4.6) dispatch via the Claude Code
 * `Agent` tool — that path is invoked from inside a Claude Code session, not
 * from a CLI script. This script handles ONLY the Venice variant — direct
 * call to Venice's OpenAI-compatible `/chat/completions` endpoint with
 * vision input (base64-encoded JPEGs).
 *
 * Why Venice / Qwen3-VL 235B specifically?
 *   Pricing: $0.25 / $1.50 per 1M tokens (vs Anthropic Opus 4.7 $5 / $25 —
 *   ~95% cheaper). Vision-capable. Multimodal up to 10 images per request.
 *   256K context. Function-calling + response-schema for structured JSON.
 *
 * Why this is defensible NOW:
 *   The Phase N.1/N.2/N.3 design-time integration shipped 2026-05-07
 *   pushes anti-ai-slop bans into Stage 2 brief, Stage 2.5 specs, Stage 3
 *   per-page workers, AND adds qa-check Layer-1 deterministic rules
 *   (anti-slop-indigo-violet + anti-slop-emoji-as-icon). Anti-slop tells
 *   are unlikely to ship into dist; the visual-pass's residual job is
 *   non-deterministic taste calls (card grid consistency, hero treatment,
 *   $80k smell test, control-plane reflex). Qwen3-VL might handle that
 *   acceptably — Phase K-narrow is the test.
 *
 * Inputs:
 *   <domain>                — jobs/<domain>/ — must contain qa-option-{a|b|c}/*.jpg
 *                              OR abc-screenshots/{A,B,C}-*-{desktop,mobile}.jpg
 *   --option <a|b|c>        — which option's screenshots to evaluate (default: a)
 *   --max-images <N>        — limit screenshots sent (default: 10, Venice cap)
 *
 * Outputs:
 *   jobs/<domain>/ab-results/visual-pass-verdict-venice-qwen3-vl.json
 *
 * Reads VENICE_API_KEY + VENICE_BASE_URL from (first non-empty wins,
 * matching the storefront-API pattern):
 *   1. shell env
 *   2. ~/WebFactory/.env.local
 *   3. ~/WebFactory/.env
 *   4. ~/webfactory-store/.env.local   (canonical Tier 4)
 *
 * Strips a leading `VENICE_API_KEY=` from the value if present (defensive
 * handling for the common copy-paste artifact where the env var assignment
 * line gets pasted into the value slot).
 *
 * Self-instruments via Phase F: emits 4c-bis-ab/venice-dispatched event.
 *
 * Usage:
 *   node scripts/dispatch-venice-visual-pass.cjs <domain> [--option=a]
 *
 * Exit codes:
 *   0 — verdict JSON written
 *   1 — bad CLI args / missing env / domain dir not found
 *   2 — Venice API call failed (network, 5xx, parse error)
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const VENICE_MODEL = 'qwen3-vl-235b-a22b';
const DEFAULT_MAX_IMAGES = 10;   // Venice's per-request image cap

// ─────────────────────────────────────────────────────────────────────
// Env-var reader — same 4-tier chain as register-with-store.mjs
// ─────────────────────────────────────────────────────────────────────

function readEnvVar(name) {
  const sources = [
    process.env[name],
    readDotEnv(path.join(REPO_ROOT, '.env.local'), name),
    readDotEnv(path.join(REPO_ROOT, '.env'), name),
    readDotEnv(path.join(process.env.HOME || '', 'webfactory-store/.env.local'), name),
  ];
  for (const v of sources) {
    if (v && String(v).trim()) {
      const stripped = stripPrefixDuplicate(name, String(v).trim());
      return stripped;
    }
  }
  return null;
}

function readDotEnv(filePath, name) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const text = fs.readFileSync(filePath, 'utf8');
    for (const line of text.split('\n')) {
      const m = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m && m[1] === name) {
        let v = m[2];
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1);
        }
        return v;
      }
    }
  } catch (e) { /* ignore */ }
  return null;
}

function stripPrefixDuplicate(name, value) {
  // Defensive: strip a leading `<NAME>=` from the value (common paste artifact).
  const prefix = `${name}=`;
  return value.startsWith(prefix) ? value.slice(prefix.length) : value;
}

// ─────────────────────────────────────────────────────────────────────
// CLI parsing
// ─────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { domain: null, option: 'a', maxImages: DEFAULT_MAX_IMAGES };
  for (const a of argv.slice(2)) {
    if (a.startsWith('--option=')) args.option = a.split('=')[1];
    else if (a.startsWith('--max-images=')) args.maxImages = Math.min(20, Math.max(1, parseInt(a.split('=')[1], 10) || DEFAULT_MAX_IMAGES));
    else if (!a.startsWith('--') && !args.domain) args.domain = a;
  }
  return args;
}

// ─────────────────────────────────────────────────────────────────────
// Screenshot discovery
// ─────────────────────────────────────────────────────────────────────

function findScreenshots(jobDir, option) {
  // Preferred: qa-option-{a|b|c}/*.jpg (Phase L.1 sidecars)
  // Fallback:  qa-option-{a|b|c}/*.png (uncompressed)
  // Fallback:  abc-screenshots/{A,B,C}-*-{desktop,mobile}.jpg (legacy A/B/C compare set)
  const optionUpper = option.toUpperCase();
  const candidates = [];

  const qaDir = path.join(jobDir, `qa-option-${option}`);
  if (fs.existsSync(qaDir)) {
    for (const f of fs.readdirSync(qaDir)) {
      if (/\.(jpg|jpeg|png)$/i.test(f) && (f.startsWith('mobile-') || f.startsWith('desktop-') || f.startsWith('ipad-'))) {
        candidates.push(path.join(qaDir, f));
      }
    }
  }

  if (candidates.length === 0) {
    const abcDir = path.join(jobDir, 'abc-screenshots');
    if (fs.existsSync(abcDir)) {
      for (const f of fs.readdirSync(abcDir)) {
        if (f.startsWith(`${optionUpper}-`) && /\.(jpg|jpeg|png)$/i.test(f)) {
          candidates.push(path.join(abcDir, f));
        }
      }
    }
  }

  // Prefer JPG over PNG (smaller payload). Mobile FIRST per Phase O scan order.
  candidates.sort((a, b) => {
    const aMobile = a.includes('mobile') ? 0 : 1;
    const bMobile = b.includes('mobile') ? 0 : 1;
    if (aMobile !== bMobile) return aMobile - bMobile;
    const aJpg = /\.jpg$/i.test(a) ? 0 : 1;
    const bJpg = /\.jpg$/i.test(b) ? 0 : 1;
    if (aJpg !== bJpg) return aJpg - bJpg;
    return a.localeCompare(b);
  });

  return candidates;
}

function imageToBase64Url(filePath) {
  const buf = fs.readFileSync(filePath);
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
  return `data:${mime};base64,${buf.toString('base64')}`;
}

// ─────────────────────────────────────────────────────────────────────
// Visual-pass prompt — mirrors what Stage 4c-bis sub-agent receives in
// production (visual-sanity-pass.md), with the JSON-schema instruction
// inlined so Venice/Qwen3-VL produces parseable JSON.
// ─────────────────────────────────────────────────────────────────────

function buildPrompt(domain, option, screenshotCount) {
  const stage = option === 'a' ? '4c-bis' : option === 'b' ? '6c' : '7g';
  return `You are running the **Stage ${stage} Visual Sanity Pass** on Option ${option.toUpperCase()} for ${domain}. Apply the 18-item checklist from /Users/tomasz/WebFactory/skill-stages/visual-sanity-pass.md and return a structured JSON verdict.

You will see ${screenshotCount} screenshots below. They include mobile (390×844 — primary, FIRST), iPad (1024×1366), desktop (1440×900), and desktop-wide (1920×1080) viewports across multiple pages. Mobile FIRST per item #1.

The 18-item checklist (apply ALL on each screenshot, mobile first):

1. Mobile experience FIRST — hamburger working, no horizontal overflow, hero photo crops cleanly, ≥44×44 tap targets, body ≥16px, phone CTA visible, cards restack properly. INCLUDES sub-items 1a (iPad — md/lg breakpoint edge case: hamburger transition, card squish, nav clipping) and 1b (desktop-wide — hero lost in gutters, max-width too tight, type cramped).
2. Active nav state — current item visually distinct AND legible (avoid black-on-black bugs)
3. Active state shape — right shape for the design language
4. Image quality + content match — relevant, not stretched, not duplicated across cards
5. Card grid consistency — same height/padding/icon-style/heading-weight within a grid
6. Empty / placeholder content — no "lorem ipsum" / "Service title here" / gray boxes
7. Hero section — headline reads over background, overlay/scrim visible, mobile hero composition holds
8. CTA visibility + intent — obviously clickable, descriptive copy, sticky bottom-bar on mobile for trades
9. Typography hierarchy — H1 > H2 > body clearly distinct
10. Whitespace + spacing rhythm — sections breathe
11. Color combinations — even if WCAG passes, no ugly pairings (yellow on cream, etc.)
12. Off-canvas / overflowing elements
13. Image-to-section mapping — semantic match (painting photo on painting service)
14. Footer completeness — social icons aligned, phone/address/hours/copyright present
15. "Would I send this to a customer?" gut check
16. The "$80k smell test" — display-quality typography? Hero earns the photo? At least one moment of design ambition? Considered palette?
17. Editorial-drift check (Option C ONLY — silent pass for A/B) — industry-anchored or generic-magazine?
18. Diversity check — does this look distinguishable from other industry-peer builds?

Return EXACTLY this JSON shape (no markdown fence, no prose preamble):

{
  "stage": "${stage}",
  "option": "${option}",
  "verdict": "pass | fix | rebuild",
  "items_checked": 18,
  "items_passed": <integer 0-18>,
  "issues": [
    {
      "item": "<checklist item name, e.g. 'active-nav-state' or 'mobile-hero-composition'>",
      "severity": "fail | warn",
      "screenshot": "<filename of the screenshot where it appears, e.g. 'mobile-home.jpg'>",
      "description": "<one sentence — what's wrong>",
      "suggested_fix": "<one sentence — proposed remediation>"
    }
  ],
  "summary": "<one sentence — overall judgment, fed into build-design-decisions.md>"
}

Verdict semantics:
- "pass" — items_passed >= 16, no severity=fail in issues
- "fix"  — items_passed 12-15, OR 1-3 severity=fail items that fix-loop can address
- "rebuild" — items_passed < 12, OR design-language-level failure that fix-loop can't reach

Be concise — issues array should NOT exceed ~10 entries. Target ~400 tokens of output.`;
}

// ─────────────────────────────────────────────────────────────────────
// Venice API call (OpenAI-compatible /chat/completions with vision)
// ─────────────────────────────────────────────────────────────────────

async function callVenice({ apiKey, baseUrl, model, prompt, imagePaths }) {
  const imageContent = imagePaths.map(p => ({
    type: 'image_url',
    image_url: { url: imageToBase64Url(p) },
  }));
  const userContent = [...imageContent, { type: 'text', text: prompt }];

  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
  const body = {
    model,
    messages: [{ role: 'user', content: userContent }],
    temperature: 0.2,
    max_tokens: 2000,
    response_format: { type: 'json_object' },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '<no body>');
    throw new Error(`Venice API ${res.status} ${res.statusText}: ${errText.slice(0, 500)}`);
  }
  const json = await res.json();
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error(`Venice response missing choices[0].message.content: ${JSON.stringify(json).slice(0, 300)}`);
  return { rawContent: content, usage: json.usage || null };
}

// ─────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv);
  if (!args.domain) {
    console.error('Usage: node scripts/dispatch-venice-visual-pass.cjs <domain> [--option=a|b|c] [--max-images=10]');
    process.exit(1);
  }
  const jobDir = path.join(REPO_ROOT, 'jobs', args.domain);
  if (!fs.existsSync(jobDir)) {
    console.error(`error: jobs/${args.domain}/ does not exist`);
    process.exit(1);
  }
  const apiKey = readEnvVar('VENICE_API_KEY');
  if (!apiKey) {
    console.error('error: VENICE_API_KEY not found in shell env / WebFactory/.env.local / WebFactory/.env / webfactory-store/.env.local');
    process.exit(1);
  }
  const baseUrl = readEnvVar('VENICE_BASE_URL') || 'https://api.venice.ai/api/v1';

  const screenshots = findScreenshots(jobDir, args.option);
  if (screenshots.length === 0) {
    console.error(`error: no screenshots found at jobs/${args.domain}/qa-option-${args.option}/ or jobs/${args.domain}/abc-screenshots/${args.option.toUpperCase()}-*`);
    process.exit(1);
  }
  const sent = screenshots.slice(0, args.maxImages);
  console.log(`Found ${screenshots.length} screenshots; sending ${sent.length} to Venice (${args.maxImages} max).`);
  console.log(`Variant: venice-qwen3-vl (${VENICE_MODEL})`);
  console.log(`Customer: ${args.domain}, option=${args.option}`);
  for (const s of sent) console.log(`  - ${path.basename(s)} (${(fs.statSync(s).size / 1024).toFixed(1)}KB)`);

  const prompt = buildPrompt(args.domain, args.option, sent.length);
  const t0 = Date.now();
  let result;
  try {
    result = await callVenice({ apiKey, baseUrl, model: VENICE_MODEL, prompt, imagePaths: sent });
  } catch (e) {
    console.error(`error: Venice API call failed: ${e.message}`);
    process.exit(2);
  }
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`Venice responded in ${elapsed}s. Tokens: input=${result.usage?.prompt_tokens || '?'}, output=${result.usage?.completion_tokens || '?'}`);

  // Parse the JSON verdict
  let verdict;
  try {
    verdict = JSON.parse(result.rawContent);
  } catch (e) {
    console.error(`error: Venice returned non-JSON content (${e.message}). Raw:\n${result.rawContent.slice(0, 1000)}`);
    process.exit(2);
  }

  // Annotate
  verdict._meta = {
    variant: 'venice-qwen3-vl',
    model: VENICE_MODEL,
    provider: 'venice',
    domain: args.domain,
    option: args.option,
    screenshotCount: sent.length,
    elapsedSec: parseFloat(elapsed),
    inputTokens: result.usage?.prompt_tokens || null,
    outputTokens: result.usage?.completion_tokens || null,
    generatedAt: new Date().toISOString(),
  };

  // Write to ab-results/
  const outDir = path.join(jobDir, 'ab-results');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `visual-pass-verdict-venice-qwen3-vl-option-${args.option}.json`);
  fs.writeFileSync(outPath, JSON.stringify(verdict, null, 2));
  console.log(`Wrote: ${outPath}`);
  console.log(`Verdict: ${verdict.verdict} (${verdict.items_passed}/${verdict.items_checked} passed, ${(verdict.issues || []).length} issues)`);

  // Self-instrument (Phase F)
  try {
    const { logDecision } = require('./_log-helper.cjs');
    logDecision(args.domain, '4c-bis-ab', 'venice-dispatched', {
      variant: 'venice-qwen3-vl',
      model: VENICE_MODEL,
      option: args.option,
      verdict: verdict.verdict,
      items_passed: verdict.items_passed,
      issue_count: (verdict.issues || []).length,
      elapsed_sec: parseFloat(elapsed),
      input_tokens: result.usage?.prompt_tokens || null,
      output_tokens: result.usage?.completion_tokens || null,
    });
  } catch (e) { /* logging is best-effort */ }
}

main().catch(e => {
  console.error(`fatal: ${e.message}`);
  process.exit(2);
});
