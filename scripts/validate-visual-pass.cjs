#!/usr/bin/env node
/**
 * validate-visual-pass.cjs — hard gate for Stage 4c-bis / 6c / 7g-h
 *
 * Built 2026-05-04 after the watkinsmonuments.com transcript review showed
 * Tier 2 (visual sanity pass sub-agent delegation, shipped earlier on
 * 2026-05-04) was silently bypassed. The orchestrator read 2 desktop
 * screenshots inline instead of dispatching the Opus sub-agent and reading
 * the 18-item verdict JSON. Same regression class as the empty-`specs/`
 * issue that prompted `validate-specs.cjs`: shipping an architecture
 * without a hard gate means orchestrators silently fall back to the
 * lighter inline path.
 *
 * The artifact this gate enforces is `qa-option-{a|b|c}/visual-pass-verdict.json`
 * — the structured JSON output the sub-agent (per
 * `skill-stages/visual-sanity-pass.md`) MUST write before returning.
 *
 * Usage:
 *   node scripts/validate-visual-pass.cjs <domain> <option:a|b|c> [--allow-inline]
 *
 * Exit codes:
 *   0 — verdict JSON exists, schema valid, verdict is `pass` or `fix` (deploy can proceed)
 *   2 — verdict missing OR schema invalid OR verdict is `rebuild`
 *
 * `--allow-inline` opt-out: lets the orchestrator declare that this stage
 * was done inline (not via sub-agent). Should be rare — used only when
 * the orchestrator has a documented reason to keep the pass in main
 * session (e.g., debugging, or tier-2 disabled per CLI flag in future).
 *
 * The `rebuild` verdict deserves a non-zero exit because it means the
 * sub-agent thinks the build needs more than a fix loop — the orchestrator
 * shouldn't deploy it.
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
let allowInline = false;
const positional = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--allow-inline') { allowInline = true; continue; }
  positional.push(args[i]);
}

const [domain, optionRaw] = positional;
if (!domain || !optionRaw) {
  console.error('Usage: node scripts/validate-visual-pass.cjs <domain> <option:a|b|c> [--allow-inline]');
  process.exit(2);
}

const option = optionRaw.toLowerCase();
if (!['a', 'b', 'c'].includes(option)) {
  console.error(`✗ Invalid option "${optionRaw}" — must be one of a, b, c`);
  process.exit(2);
}

const verdictPath = path.join(REPO_ROOT, 'jobs', domain, `qa-option-${option}`, 'visual-pass-verdict.json');

if (!fs.existsSync(verdictPath)) {
  if (allowInline) {
    console.warn(`⚠ Visual-pass verdict file missing at ${verdictPath} — proceeding per --allow-inline.`);
    console.warn(`  This bypass means Stage ${option === 'a' ? '4c-bis' : option === 'b' ? '6c' : '7g-h'} ran inline rather than via sub-agent. The orchestrator MUST justify this in the next stage's prose. Tier 2 of the context-optimization plan expects sub-agent dispatch.`);
    process.exit(0);
  }
  console.error('═══════════════════════════════════════════════════════════════════════');
  console.error(`  ✗ STAGE ${option === 'a' ? '4c-bis' : option === 'b' ? '6c' : '7g-h'} GATE FAILED — visual-pass verdict missing`);
  console.error('═══════════════════════════════════════════════════════════════════════');
  console.error('');
  console.error(`Expected: ${verdictPath}`);
  console.error('');
  console.error(`The visual sanity pass on Option ${option.toUpperCase()} must be dispatched to an Opus sub-agent`);
  console.error('per Tier 2 of the context-optimization plan (shipped 2026-05-04).');
  console.error('The sub-agent reads /Users/tomasz/WebFactory/skill-stages/visual-sanity-pass.md');
  console.error('for the 18-item checklist and JSON output schema.');
  console.error('');
  console.error('Two ways to resolve:');
  console.error('  1. (preferred) Dispatch the sub-agent. The orchestrator pattern is:');
  console.error('     Agent({');
  console.error('       subagent_type: "general-purpose",');
  console.error('       model: "opus",');
  console.error('       prompt: <visual-sanity-pass.md prompt template with screenshot paths>,');
  console.error('     })');
  console.error(`     The sub-agent must write its verdict to ${verdictPath}`);
  console.error('     and return a 1-line acknowledgment to the orchestrator.');
  console.error('');
  console.error('  2. (escape hatch) Pass --allow-inline if the orchestrator has a documented');
  console.error('     reason to keep the visual pass in main session. Use sparingly.');
  console.error('');
  console.error('See `skill-stages/visual-sanity-pass.md` for the canonical sub-agent spec.');
  process.exit(2);
}

let verdict;
try {
  verdict = JSON.parse(fs.readFileSync(verdictPath, 'utf8'));
} catch (e) {
  console.error(`✗ Failed to parse ${verdictPath}: ${e.message}`);
  process.exit(2);
}

// Schema validation. Required keys + types per skill-stages/visual-sanity-pass.md.
const REQUIRED = {
  verdict: v => ['pass', 'fix', 'rebuild'].includes(v),
  items_checked: v => Number.isInteger(v) && v >= 0,
  items_passed: v => Number.isInteger(v) && v >= 0,
  issues: v => Array.isArray(v),
  summary: v => typeof v === 'string' && v.length > 0,
};

const errors = [];
for (const [k, validator] of Object.entries(REQUIRED)) {
  if (!(k in verdict)) {
    errors.push(`missing key: ${k}`);
  } else if (!validator(verdict[k])) {
    errors.push(`invalid value for ${k}: ${JSON.stringify(verdict[k]).slice(0, 80)}`);
  }
}
if (errors.length) {
  console.error(`✗ ${verdictPath} schema invalid:`);
  for (const e of errors) console.error(`  • ${e}`);
  console.error('Required keys: verdict ∈ {pass,fix,rebuild}, items_checked: int, items_passed: int, issues: array, summary: string');
  process.exit(2);
}

// Bonus check: items_checked should be >= 16 to indicate a real 18-item pass.
// If it's much lower the sub-agent likely shortcut. Warn but don't fail.
if (verdict.items_checked < 16) {
  console.warn(`⚠ items_checked=${verdict.items_checked} is below the 18-item bar in skill-stages/visual-sanity-pass.md — sub-agent may have abbreviated.`);
}

if (verdict.verdict === 'rebuild') {
  console.error(`✗ Visual-pass verdict for Option ${option.toUpperCase()} is "rebuild" — sub-agent recommends rebuild, not deploy.`);
  console.error(`  Issues: ${verdict.issues.length}`);
  console.error(`  Summary: ${verdict.summary}`);
  console.error('');
  console.error('Address the issues, regenerate Option ' + option.toUpperCase() + ', re-run the visual pass, then re-gate.');
  process.exit(2);
}

console.log(`✓ Visual-pass gate passed for Option ${option.toUpperCase()} — verdict=${verdict.verdict} (${verdict.items_passed}/${verdict.items_checked} items passed, ${verdict.issues.length} issue${verdict.issues.length === 1 ? '' : 's'} flagged).`);

// Phase F self-instrumentation. Stage maps from option:
//   a → 4c-bis, b → 6c, c → 7g
const STAGE_FOR_OPT = { a: '4c-bis', b: '6c', c: '7g' };
const { logDecision } = require('./_log-helper.cjs');
logDecision(domain, STAGE_FOR_OPT[option], 'visual-pass-verdict', {
  option,
  verdict: verdict.verdict,
  items_passed: verdict.items_passed,
  items_checked: verdict.items_checked,
  issues: (verdict.issues || []).length,
});

process.exit(0);
