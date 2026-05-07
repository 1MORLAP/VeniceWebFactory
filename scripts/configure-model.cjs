#!/usr/bin/env node
/**
 * configure-model.cjs — write per-stage (model, effort) assignment to metrics.json
 *
 * Built 2026-05-05 as Phase D infrastructure. Runs at Stage 0 (right after
 * init-metrics.cjs) to persist the per-stage assignment from CLI flags or
 * a cost-tier preset. Every dispatch template in the pipeline reads this
 * assignment back via get-model.cjs.
 *
 * Vocabulary (matches Claude Code UI as of 2026-05-05):
 *
 *   models: opus | opus-1m | sonnet | haiku | opus-legacy
 *           - opus        Claude Opus 4.7 standard ($5/$25)
 *           - opus-1m     Claude Opus 4.7 1M context tier (premium for >200K prompts)
 *           - sonnet      Claude Sonnet 4.6 ($3/$15, 1M default)
 *           - haiku       Claude Haiku 4.5 ($1/$5, 200K context)
 *           - opus-legacy Claude Opus 4.6 (kept for compat / regression diff)
 *
 *   effort: low | medium | high | extra-high | max
 *           Discrete labels matching the Claude Code effort picker.
 *
 * Cost-tier presets (HAIKU only used where quality risk is LOW per user
 * direction 2026-05-05 — never on per-page builds, fix-loops, or
 * brief/specs/visual passes):
 *
 *   --cost-tier=baseline      Pre-Phase-K default. All Opus where
 *                             applicable. ~1.0× cost.
 *   --cost-tier=balanced      Sonnet for brief/specs/visual; Opus for
 *                             4c-tris + plugin orchestration. Per-page stays
 *                             Sonnet. ~0.7× cost. Low quality risk (gates
 *                             enforce brief richness + specs + image-pool).
 *   --cost-tier=aggressive    Sonnet orchestrator + brief/specs/visual.
 *                             Haiku ONLY for low-risk mechanical stages:
 *                             multilingual translation, report, scaffold.
 *                             Per-page renders STAY ON SONNET (codegen
 *                             quality matters; medium risk on Haiku — kept
 *                             out per 2026-05-05 user direction). ~0.55×
 *                             cost. Medium risk on Sonnet orchestration.
 *   --cost-tier=opus-everywhere  Opus on every stage. ~3× cost. Showcase /
 *                                client-demo builds only.
 *
 * Per-stage overrides take precedence over the preset:
 *
 *   --orchestrator-model=sonnet   --brief-model=opus-1m
 *   --specs-model=sonnet          --visual-pass-model=sonnet
 *   --4c-tris-model=opus          --per-page-model=sonnet
 *   --fix-loop-model=sonnet       --multilingual-model=haiku
 *   --report-model=haiku
 *
 * Effort overrides:
 *
 *   --brief-effort=high   --specs-effort=high   --4c-tris-effort=max
 *   --visual-pass-effort=medium
 *
 * Usage:
 *   node scripts/configure-model.cjs <domain> [--cost-tier=<preset>] [<per-stage-overrides>...]
 *
 * Exit codes:
 *   0 — assignment written to metrics.json
 *   1 — bad CLI args OR metrics.json missing (run init-metrics.cjs first)
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
let domain = null;
// Phase K (2026-05-07): default flipped from `baseline` to `balanced`. The
// `balanced` preset runs Sonnet on brief/specs/visual-pass and keeps Opus
// on 4c-tris (taste call) + orchestrator (decision logic) — ~30% cost cut
// vs `baseline` with low quality risk because the validate-* gates and
// the Opus 4c-tris audit catch any drop in synthesis quality. To run
// the legacy preset: pass `--cost-tier=baseline` explicitly OR
// `--ab=baseline` for an A/B variant build.
let costTier = 'balanced';
const overrides = {};

for (const a of args) {
  if (a.startsWith('--cost-tier=')) { costTier = a.split('=')[1]; continue; }
  // Per-stage model overrides (kebab-case → camelCase mapping)
  const modelMatch = a.match(/^--([a-z0-9-]+)-model=([a-z0-9-]+)$/);
  if (modelMatch) {
    const stage = kebabToCamel(modelMatch[1]);
    overrides[stage] = overrides[stage] || {};
    overrides[stage].model = modelMatch[2];
    continue;
  }
  // Per-stage effort overrides
  const effortMatch = a.match(/^--([a-z0-9-]+)-effort=([a-z-]+)$/);
  if (effortMatch) {
    const stage = kebabToCamel(effortMatch[1]);
    overrides[stage] = overrides[stage] || {};
    overrides[stage].effort = effortMatch[2];
    continue;
  }
  if (!a.startsWith('--') && !domain) domain = a;
}

if (!domain) {
  console.error('Usage: node scripts/configure-model.cjs <domain> [--cost-tier=<baseline|balanced|aggressive|opus-everywhere>] [...overrides]');
  process.exit(1);
}

function kebabToCamel(s) {
  if (s === '4c-tris') return 'fourCtris';
  return s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

const VALID_MODELS = ['opus', 'opus-1m', 'sonnet', 'haiku', 'opus-legacy'];
const VALID_EFFORTS = ['low', 'medium', 'high', 'extra-high', 'max'];

// ─────────────────────────────────────────────────────────────────────
// Cost-tier preset definitions.
// ─────────────────────────────────────────────────────────────────────

const PRESETS = {
  // Today's pre-Phase-D defaults. The orchestrator runs Opus 4.7 1M Max
  // (matching what most operators have selected in their Claude Code UI).
  // Brief/specs lean on the 1M tier because they read large input sets
  // (manifest + REQUIRED-PATTERNS + screenshots).
  'baseline': {
    orchestrator: { model: 'opus-1m', effort: 'max'    },
    brief:        { model: 'opus-1m', effort: 'high'   },
    specs:        { model: 'opus-1m', effort: 'high'   },
    perPage:      { model: 'sonnet',  effort: 'low'    },
    visualPass:   { model: 'opus',    effort: 'medium' },
    fourCtris:    { model: 'opus',    effort: 'high'   },
    fixLoop:      { model: 'sonnet',  effort: 'medium' },
    plugin:       { model: 'opus',    effort: 'medium' },
    multilingual: { model: 'sonnet',  effort: 'low'    },
    scaffold:     { model: 'sonnet',  effort: 'low'    },
    report:       { model: 'sonnet',  effort: 'low'    },
  },
  // Sonnet for brief/specs/visual-pass; Opus only for 4c-tris (subjective
  // taste — cannot tier down) + plugin orchestration. Per-page stays Sonnet.
  // Estimated ~30% cost cut. LOW quality risk because the gates
  // (validate-design-brief, validate-specs, validate-image-pool, visual-pass)
  // catch quality regressions deterministically.
  'balanced': {
    orchestrator: { model: 'opus-1m', effort: 'high'   },
    brief:        { model: 'sonnet',  effort: 'high'   },
    specs:        { model: 'sonnet',  effort: 'high'   },
    perPage:      { model: 'sonnet',  effort: 'low'    },
    visualPass:   { model: 'sonnet',  effort: 'medium' },
    fourCtris:    { model: 'opus',    effort: 'high'   },
    fixLoop:      { model: 'sonnet',  effort: 'medium' },
    plugin:       { model: 'opus',    effort: 'medium' },
    multilingual: { model: 'sonnet',  effort: 'low'    },
    scaffold:     { model: 'sonnet',  effort: 'low'    },
    report:       { model: 'sonnet',  effort: 'low'    },
  },
  // Sonnet orchestrator + brief/specs/visual. Haiku ONLY on low-risk
  // mechanical stages — multilingual translation, report formatting,
  // scaffold. Per-page renders STAY ON SONNET (codegen quality matters,
  // medium risk on Haiku — kept out per 2026-05-05 user direction).
  // Fix-loop also stays on Sonnet (judgment + edits, medium risk).
  // Estimated ~45% cost cut. MEDIUM risk on Sonnet orchestration —
  // requires validate-fix-loop-classification + completion-contract gates
  // to confirm parity with Opus orchestrator.
  'aggressive': {
    orchestrator: { model: 'sonnet',  effort: 'high'   },
    brief:        { model: 'sonnet',  effort: 'high'   },
    specs:        { model: 'sonnet',  effort: 'high'   },
    perPage:      { model: 'sonnet',  effort: 'low'    },   // STAYS SONNET — not Haiku
    visualPass:   { model: 'sonnet',  effort: 'medium' },
    fourCtris:    { model: 'opus',    effort: 'high'   },   // never tiered down
    fixLoop:      { model: 'sonnet',  effort: 'medium' },   // STAYS SONNET — judgment + edits
    plugin:       { model: 'opus',    effort: 'medium' },
    multilingual: { model: 'haiku',   effort: 'low'    },   // LOW RISK — pure translation
    scaffold:     { model: 'haiku',   effort: 'low'    },   // LOW RISK — small task
    report:       { model: 'haiku',   effort: 'low'    },   // LOW RISK — formatting only
  },
  // Maximum quality. Per-page renders pay Opus prices. ~3× cost.
  'opus-everywhere': {
    orchestrator: { model: 'opus-1m', effort: 'max'    },
    brief:        { model: 'opus-1m', effort: 'max'    },
    specs:        { model: 'opus-1m', effort: 'max'    },
    perPage:      { model: 'opus',    effort: 'medium' },
    visualPass:   { model: 'opus',    effort: 'high'   },
    fourCtris:    { model: 'opus',    effort: 'max'    },
    fixLoop:      { model: 'opus',    effort: 'medium' },
    plugin:       { model: 'opus',    effort: 'medium' },
    multilingual: { model: 'opus',    effort: 'medium' },
    scaffold:     { model: 'opus',    effort: 'low'    },
    report:       { model: 'opus',    effort: 'low'    },
  },
};

if (!PRESETS[costTier]) {
  console.error(`✗ Unknown --cost-tier "${costTier}". Valid: ${Object.keys(PRESETS).join(', ')}`);
  process.exit(1);
}

// Validate per-stage overrides reference real models / efforts.
for (const [stage, ov] of Object.entries(overrides)) {
  if (ov.model && !VALID_MODELS.includes(ov.model)) {
    console.error(`✗ Override for "${stage}" specifies model="${ov.model}" — must be one of ${VALID_MODELS.join('|')}`);
    process.exit(1);
  }
  if (ov.effort && !VALID_EFFORTS.includes(ov.effort)) {
    console.error(`✗ Override for "${stage}" specifies effort="${ov.effort}" — must be one of ${VALID_EFFORTS.join('|')}`);
    process.exit(1);
  }
}

// Load metrics.json and merge.
const metricsPath = path.join(REPO_ROOT, 'jobs', domain, 'metrics.json');
if (!fs.existsSync(metricsPath)) {
  console.error(`✗ metrics.json not found: ${metricsPath}`);
  console.error('  Run init-metrics.cjs first.');
  process.exit(1);
}

const metrics = JSON.parse(fs.readFileSync(metricsPath, 'utf8'));
const assignment = JSON.parse(JSON.stringify(PRESETS[costTier]));

// Apply per-stage overrides.
for (const [stage, ov] of Object.entries(overrides)) {
  if (!assignment[stage]) {
    console.error(`✗ Override references unknown stage "${stage}". Valid: ${Object.keys(assignment).join(', ')}`);
    process.exit(1);
  }
  if (ov.model)  assignment[stage].model  = ov.model;
  if (ov.effort) assignment[stage].effort = ov.effort;
}

metrics.modelAssignment = assignment;
metrics.costTier = costTier;

fs.writeFileSync(metricsPath, JSON.stringify(metrics, null, 2));

console.log(`✓ Model assignment configured for ${domain}: cost-tier="${costTier}"${Object.keys(overrides).length ? ` + ${Object.keys(overrides).length} per-stage override(s)` : ''}`);
for (const [stage, a] of Object.entries(assignment)) {
  const mark = overrides[stage] ? '  *' : '';
  console.log(`  ${stage.padEnd(14)} ${a.model.padEnd(12)} effort=${a.effort.padEnd(11)}${mark}`);
}

// Phase F self-instrumentation
const { logDecision } = require('./_log-helper.cjs');
logDecision(domain, '0', 'cost-tier-configured', {
  costTier,
  overrides: Object.keys(overrides).length || 0,
  orchestratorModel: assignment.orchestrator.model,
  orchestratorEffort: assignment.orchestrator.effort,
});

process.exit(0);
