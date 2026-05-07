#!/usr/bin/env node
/**
 * get-model.cjs — read per-stage (model, effort) assignment from metrics.json
 *
 * Built 2026-05-05 as Phase D of the cost-reduction shipment. Earlier
 * phases delegated work to sub-agents but kept everything on Opus.
 * Phase D adds two independent dials per stage:
 *   - model:   opus | opus-1m | sonnet | haiku | opus-legacy
 *              (the 5 options exposed in the Claude Code model picker UI)
 *   - effort:  low | medium | high | extra-high | max
 *              (the 5 effort levels exposed in the Claude Code effort picker)
 *
 * Available models as of 2026-05-05 (per Anthropic docs + Claude Code UI):
 *   - opus         Claude Opus 4.7 standard ($5 input / $25 output)
 *   - opus-1m      Claude Opus 4.7 1M context tier (premium for >200K prompts)
 *   - sonnet       Claude Sonnet 4.6 ($3 input / $15 output, 1M default)
 *   - haiku        Claude Haiku 4.5 ($1 input / $5 output, 200K context)
 *   - opus-legacy  Claude Opus 4.6 ($5 input / $25 output, kept for compat)
 *
 * Note: the Agent tool's `model` parameter accepts only `opus | sonnet | haiku`.
 * The 1M and Legacy variants are session-level selections in the Claude Code
 * UI; Agent-dispatched sub-agents inherit session defaults for those dimensions.
 * This script's `model` field is therefore PRESCRIPTIVE — it documents the
 * ideal model for the stage; the operator must configure their Claude Code
 * session UI to match the strictest stage's requirement.
 *
 * Effort is similarly prescriptive — the Agent tool doesn't expose an effort
 * parameter, so sub-agents inherit session-level effort. The orchestrator
 * should configure session effort at the highest stage requirement.
 *
 * Usage:
 *   node scripts/get-model.cjs <domain> <stage>                  # prints "model:effort"
 *   node scripts/get-model.cjs <domain> <stage> --field model    # prints just the model
 *   node scripts/get-model.cjs <domain> <stage> --field effort   # prints just the effort
 *   node scripts/get-model.cjs <domain> <stage> --json           # prints JSON object
 *   node scripts/get-model.cjs <domain> <stage> --agent-model    # prints the Agent-tool-compatible
 *                                                                  alias (opus / sonnet / haiku),
 *                                                                  collapsing opus-1m → opus etc.
 *
 * Stage names recognized: orchestrator, brief, specs, perPage, visualPassA,
 *                         visualPassB, visualPassC, fourCtris, fixLoop,
 *                         plugin, multilingual, scaffold, report
 *
 * Legacy alias: `visualPass` (no suffix) returns visualPassA — the most
 * conservative (Opus-default) of the three. Phase K-narrow split the
 * single `visualPass` field into per-option keys 2026-05-07.
 *
 * Defaults if metrics.modelAssignment is missing:
 *   Mirrors the `baseline` preset in configure-model.cjs (today's pre-Phase-D
 *   behavior — all Opus where applicable, Sonnet for per-page renders).
 *
 * Exit codes:
 *   0 — value printed
 *   1 — bad CLI args OR malformed metrics.json
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
let domain = null;
let stage = null;
let field = null;
let asJson = false;
let asAgentModel = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--field' && args[i + 1]) { field = args[++i]; continue; }
  if (args[i] === '--json') { asJson = true; continue; }
  if (args[i] === '--agent-model') { asAgentModel = true; continue; }
  if (!domain) { domain = args[i]; continue; }
  if (!stage)  { stage  = args[i]; continue; }
}

if (!domain || !stage) {
  console.error('Usage: node scripts/get-model.cjs <domain> <stage> [--field <model|effort>] [--json] [--agent-model]');
  process.exit(1);
}

// Default per-stage assignment — the `baseline` cost-tier preset.
// Effort defaults are CONSERVATIVE (lean toward higher effort on judgment-heavy
// stages, lower on mechanical stages) to match today's Opus-everywhere quality.
//
// Phase K-narrow split (2026-05-07): visualPass is now per-option. A stays
// Opus (canonical first read of Option A); B and C drop to Sonnet (post-A
// QA already established baseline). See FEEDBACK.md Phase K-narrow entry.
const DEFAULTS = {
  orchestrator: { model: 'opus-1m', effort: 'max'        },  // session-level; current user runs this
  brief:        { model: 'opus-1m', effort: 'high'       },
  specs:        { model: 'opus-1m', effort: 'high'       },
  perPage:      { model: 'sonnet',  effort: 'low'        },
  visualPassA:  { model: 'opus',    effort: 'medium'     },
  visualPassB:  { model: 'sonnet',  effort: 'medium'     },
  visualPassC:  { model: 'sonnet',  effort: 'medium'     },
  fourCtris:    { model: 'opus',    effort: 'high'       },
  fixLoop:      { model: 'sonnet',  effort: 'medium'     },
  plugin:       { model: 'opus',    effort: 'medium'     }, // plugin-controlled
  multilingual: { model: 'sonnet',  effort: 'low'        },
  scaffold:     { model: 'sonnet',  effort: 'low'        },
  report:       { model: 'sonnet',  effort: 'low'        },
};

// Legacy alias: `visualPass` (no suffix) → returns visualPassA (most
// conservative, Opus-default). Pre-2026-05-07 a single `visualPass` field
// applied to all three options. The Phase K-narrow split kept this alias
// so old callsites don't break — they get the safest behavior. New
// callsites should use the option-specific keys.
if (stage === 'visualPass') stage = 'visualPassA';

if (!DEFAULTS[stage]) {
  console.error(`✗ Unknown stage "${stage}". Valid: ${Object.keys(DEFAULTS).join(', ')} (or legacy 'visualPass' aliased to visualPassA)`);
  process.exit(1);
}

const metricsPath = path.join(REPO_ROOT, 'jobs', domain, 'metrics.json');

let assignment = { ...DEFAULTS[stage] };

if (fs.existsSync(metricsPath)) {
  try {
    const metrics = JSON.parse(fs.readFileSync(metricsPath, 'utf8'));
    const stored = metrics.modelAssignment && metrics.modelAssignment[stage];
    if (stored && typeof stored === 'object') {
      assignment = {
        model:  stored.model  || assignment.model,
        effort: stored.effort || assignment.effort,
      };
    }
  } catch {
    // Fall through to defaults — metrics.json malformed shouldn't block dispatch.
  }
}

// Helper: collapse the 5-model vocabulary to the 3-alias Agent-tool vocabulary.
// opus-1m + opus-legacy both fall back to 'opus' — those distinctions are
// session-level (user picks them in the UI) and aren't dispatchable via Agent.
function toAgentAlias(model) {
  if (model === 'opus' || model === 'opus-1m' || model === 'opus-legacy') return 'opus';
  if (model === 'sonnet') return 'sonnet';
  if (model === 'haiku') return 'haiku';
  return 'opus';   // conservative default
}

if (asAgentModel) {
  console.log(toAgentAlias(assignment.model));
} else if (asJson) {
  console.log(JSON.stringify({ ...assignment, agentModel: toAgentAlias(assignment.model) }));
} else if (field) {
  if (!(field in assignment)) {
    console.error(`✗ Unknown field "${field}". Valid: model, effort`);
    process.exit(1);
  }
  console.log(assignment[field]);
} else {
  console.log(`${assignment.model}:${assignment.effort}`);
}
process.exit(0);
