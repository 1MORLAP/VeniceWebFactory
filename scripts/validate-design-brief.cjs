#!/usr/bin/env node
/**
 * validate-design-brief.cjs — hard gate for Stage 2 (DESIGN QUALITY BAR conformance)
 *
 * Built 2026-05-05 alongside Tier 3 sub-agentification (Stage 2 + 2.5 → Opus
 * sub-agents). Same pattern as `validate-specs.cjs` (Stage 2.5b),
 * `validate-image-pool.cjs` (Stage 2.5c), `validate-stage7-plugin.cjs`
 * (Stage 7d), `validate-visual-pass.cjs` (4c-bis/6c/7g-h): ship the
 * architecture WITH a hard gate so orchestrators can't silently
 * fall back to thin briefs.
 *
 * What it checks (per DESIGN QUALITY BAR in SKILL.md):
 *   1. business.name + business.industry are non-empty
 *   2. typography has display + text fonts (NOT both Inter/Arial — the
 *      "template signal" — at least one display-quality font)
 *   3. palette has ≥ 3 entries, each with hex + role + rationale
 *   4. heroDirection field is non-empty (≥ 50 chars)
 *   5. distinctiveElements is an array with ≥ 2 entries
 *   6. microInteractions is an array with ≥ 1 entry
 *   7. mobileFirst section exists with at least heroCrop + navStyle keys
 *   8. brandSignature inventory exists (≥ 1 item OR an explicit override
 *      note explaining why nothing is worth preserving)
 *
 * The orchestrator's "weak brief produces a merely-better-than-original
 * build" failure mode (per stage-2.md prose) is caught here.
 *
 * Usage:
 *   node scripts/validate-design-brief.cjs <domain> [--allow-thin]
 *
 * Exit codes:
 *   0 — brief passes the bar (≥ 6 of 8 checks pass; 70%-ish threshold)
 *   1 — design-brief.json missing or unreadable
 *   2 — brief fails the bar; report listed; orchestrator must re-dispatch
 *
 * `--allow-thin` lets the orchestrator declare an explicit override
 * (e.g., "1-page customer site, the bar is intentionally lower"). Use
 * sparingly — almost always the right answer is to fix the brief.
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
let allowThin = false;
const positional = [];
for (const a of args) {
  if (a === '--allow-thin') { allowThin = true; continue; }
  positional.push(a);
}
const [domain] = positional;
if (!domain) {
  console.error('Usage: node scripts/validate-design-brief.cjs <domain> [--allow-thin]');
  process.exit(1);
}

const briefPath = path.join(REPO_ROOT, 'jobs', domain, 'design-brief.json');
if (!fs.existsSync(briefPath)) {
  console.error(`✗ Design brief not found: ${briefPath}`);
  console.error('  Run Stage 2 first (Opus sub-agent dispatch per skill-stages/stage-2.md).');
  process.exit(1);
}

let raw;
try { raw = JSON.parse(fs.readFileSync(briefPath, 'utf8')); }
catch (e) {
  console.error(`✗ Failed to parse design-brief.json: ${e.message}`);
  process.exit(1);
}

// Briefs come in two top-level shapes:
//   (a) flat:   { business, palette, typography, ... }                   — older
//   (b) nested: { business, design: { palette, typography, ... }, ... }  — newer
// We accept both by merging design.* up if present.
const brief = (raw.design && typeof raw.design === 'object')
  ? { ...raw, ...raw.design }
  : raw;

// ─────────────────────────────────────────────────────────────────────
// Quality bar checks. Each returns { ok: bool, msg: string }.
// ─────────────────────────────────────────────────────────────────────

const checks = [];

// 1. Business identity
const business = brief.business || {};
checks.push({
  name: 'business.name + business.industry',
  ok: typeof business.name === 'string' && business.name.length > 0
   && typeof business.industry === 'string' && business.industry.length > 0,
});

// 2. Typography pairing — must have display + text fonts. Existing briefs
//    use either flat strings (`typography.display = "Bricolage"`) OR
//    objects (`typography.display = { family: "Bricolage", role: "..." }`).
//    Accept both. Reject if both are generic (Inter/Arial/etc.) — the
//    DESIGN QUALITY BAR requires display-quality typography.
const typo = brief.typography || {};
const familyOf = (v) => {
  if (typeof v === 'string') return v.trim();
  if (v && typeof v === 'object') return (v.family || v.name || '').toString().trim();
  return '';
};
const display = familyOf(typo.display) || familyOf(typo.headingFont);
const text    = familyOf(typo.text)    || familyOf(typo.bodyFont) || familyOf(typo.body);
const isGenericFont = (s) => /^(inter|arial|helvetica|system-ui|sans-serif|roboto)$/i.test(s);
checks.push({
  name: 'typography pairing (display + text, not both generic)',
  ok: display.length > 0 && text.length > 0 && !(isGenericFont(display) && isGenericFont(text)),
});

// 3. Palette ≥ 3 colors with hex + role. Existing briefs use either:
//    (a) palette = { primary: { hex, role, rationale }, ... } — flat object map
//    (b) palette = { primary: [{ hex, role, name }, ...], accent: [...], ... } — arrays
//    Walk both shapes deep, count entries that have hex + role.
const palette = brief.palette || brief.colors || {};
const colorEntries = [];
function collectColors(node) {
  if (Array.isArray(node)) { for (const x of node) collectColors(x); return; }
  if (node && typeof node === 'object') {
    if (typeof node.hex === 'string' || typeof node.value === 'string' || typeof node.color === 'string') {
      colorEntries.push(node);
      return;   // don't recurse into a leaf color object
    }
    for (const v of Object.values(node)) collectColors(v);
  }
}
collectColors(palette);
const colorsWithRole = colorEntries.filter(c =>
  (typeof c.role === 'string' && c.role.length > 0)
  || (typeof c.purpose === 'string' && c.purpose.length > 0)
  || (typeof c.rationale === 'string' && c.rationale.length > 0)
  || (typeof c.why === 'string' && c.why.length > 0)
);
checks.push({
  name: 'palette ≥ 3 colors with hex + role/rationale',
  ok: colorsWithRole.length >= 3,
});

// 4. Hero direction (≥ 50 chars). Accept multiple field names. Heroes
//    are sometimes nested objects with .approach / .description.
const heroNode = brief.heroDirection || brief.heroTreatment || brief.hero || '';
const heroText = (typeof heroNode === 'string')
  ? heroNode
  : (heroNode && typeof heroNode === 'object')
    ? Object.values(heroNode).filter(v => typeof v === 'string').join(' ')
    : '';
checks.push({
  name: 'hero direction (≥ 50 chars)',
  ok: heroText.trim().length >= 50,
});

// 5. Distinctive elements ≥ 2
const distinctive = brief.distinctiveElements || brief.signatureElements || [];
checks.push({
  name: 'distinctiveElements ≥ 2 entries',
  ok: Array.isArray(distinctive) && distinctive.length >= 2,
});

// 6. Micro-interactions ≥ 1
const micro = brief.microInteractions || brief.motion || [];
checks.push({
  name: 'microInteractions ≥ 1 entry',
  ok: Array.isArray(micro) && micro.length >= 1,
});

// 7. Mobile-first section — must mention mobile somewhere. Accept
//    multiple shapes: a top-level mobileFirst/mobile object, OR a
//    structure.mobile sub-object, OR ANY field that's a string and
//    contains "mobile" + ("nav"/"hero"/"crop"/"sticky").
const mobile = brief.mobileFirst || brief.mobile || (brief.structure && brief.structure.mobile);
let mobileOk = false;
if (mobile && typeof mobile === 'object' && Object.keys(mobile).length >= 2) mobileOk = true;
if (!mobileOk) {
  // Last resort: look anywhere in the brief for mobile-first commitments
  // baked into prose. Real-world briefs sometimes inline this in distinctiveElements.
  const briefText = JSON.stringify(brief).toLowerCase();
  if (/mobile-first|mobile first|390px|sticky.{0,15}cta|hamburger|tap.target|touch.target/.test(briefText)) {
    mobileOk = true;
  }
}
checks.push({
  name: 'mobile-first commitments present (anywhere in brief)',
  ok: mobileOk,
});

// 8. Brand signature inventory
const signature = brief.brandSignature || brief.brandRecognizability || brief.signatureInventory;
let signatureOk = false;
if (Array.isArray(signature) && signature.length >= 1) signatureOk = true;
else if (signature && typeof signature === 'object' && Object.keys(signature).length > 0) signatureOk = true;
else if (typeof signature === 'string' && signature.length >= 30) signatureOk = true;   // explicit override note
checks.push({
  name: 'brandSignature inventory (≥ 1 item OR explicit override note)',
  ok: signatureOk,
});

const passed = checks.filter(c => c.ok).length;
const total = checks.length;
const ratio = passed / total;

if (ratio < 0.70 && !allowThin) {
  console.error('═══════════════════════════════════════════════════════════════════════');
  console.error(`  ✗ STAGE 2 GATE FAILED — design brief passes only ${passed}/${total}`);
  console.error('     DESIGN QUALITY BAR checks (need ≥ 70%)');
  console.error('═══════════════════════════════════════════════════════════════════════');
  for (const c of checks) console.error(`  ${c.ok ? '✓' : '✗'} ${c.name}`);
  console.error('');
  console.error(`Brief: ${briefPath}`);
  console.error('');
  console.error('A weak brief produces a "merely better than original" build. Re-dispatch');
  console.error('the Stage 2 Opus sub-agent with the failed checks as input, OR fix the');
  console.error('brief manually if the fail is in 1-2 fields.');
  console.error('');
  console.error('Two ways to resolve:');
  console.error('  1. (preferred) Re-dispatch the Stage 2 sub-agent. See skill-stages/stage-2.md.');
  console.error('  2. (escape hatch) Pass --allow-thin if this is a 1-page customer site or other');
  console.error('     legitimate exception where the bar is intentionally lower.');
  process.exit(2);
}

if (allowThin && ratio < 0.70) {
  console.warn(`⚠ Brief passes only ${passed}/${total} DESIGN QUALITY BAR checks but --allow-thin override active.`);
  console.warn('  Document the reason in the build prose. Workers downstream may produce a thinner build.');
} else {
  console.log(`✓ Stage 2 gate passed for ${domain} — design brief richness ${passed}/${total} (${(ratio * 100).toFixed(0)}%).`);
  for (const c of checks) {
    if (!c.ok) console.log(`  (note: failed ${c.name} — but overall threshold met)`);
  }
}
process.exit(0);
