#!/usr/bin/env node
/**
 * log-decision.cjs — append structured orchestration events to jobs/{domain}/orchestration.log
 *
 * Built 2026-05-05 to close the "what did the orchestrator actually do?" gap.
 * Until this script existed, the only evidence of orchestrator behavior was
 * the on-disk artifacts (manifest, specs, dist, screenshots, store-registration).
 * That left major decisions invisible — most importantly, whether Stage 3/5/7
 * went decomposed (parallel Sonnet sub-agents) or monolithic (Opus inline).
 * Survey 2026-05-04 found 46 of 53 built jobs had empty specs/, indicating
 * silent monolithic-mode for ~87% of builds — a regression that hid for weeks.
 *
 * The orchestrator (Opus main session running /webfactory) calls this script
 * at key decision points. Calls are append-only and structured (JSON Lines —
 * one JSON object per line). The skill-owner session can then run
 * scripts/audit-orchestration.cjs <domain> to compare what was prescribed in
 * SKILL.md vs what actually happened.
 *
 * Usage:
 *   node scripts/log-decision.cjs <domain> <stage> <event> [--detail key=val] [--detail key2=val2] ...
 *
 *   <domain>: the job's domain (e.g. "giffins.net")
 *   <stage>:  pipeline stage tag ("0", "1", "2", "2.5", "2.5b", "3", "4", "4c-bis",
 *             "5", "6", "7", "7d", "7h", "8a", "8b", "9", "10", "10c", "10d")
 *   <event>:  short identifier of the decision/action ("mode-chosen",
 *             "sub-agent-dispatched", "fix-loop-iter", "smart-resume-report",
 *             "stage-skipped", "plugin-invoked", "fact-grounding-fail", etc.)
 *   --detail key=val: any number of key=val pairs collected into details object
 *
 * Each call appends one JSON line to jobs/{domain}/orchestration.log:
 *   { "ts": "ISO-8601", "stage": "...", "event": "...", "details": {...} }
 *
 * Exit codes:
 *   0 — appended successfully (or job dir didn't exist — graceful no-op)
 *   2 — bad CLI args
 */

const fs = require('node:fs');
const path = require('node:path');

const args = process.argv.slice(2);
if (args.length < 3) {
  console.error('Usage: log-decision.cjs <domain> <stage> <event> [--detail key=val ...]');
  process.exit(2);
}

const [domain, stage, event] = args;
const details = {};

for (let i = 3; i < args.length; i++) {
  if (args[i] === '--detail' && args[i + 1]) {
    const kv = args[++i];
    const eq = kv.indexOf('=');
    if (eq > 0) {
      const k = kv.slice(0, eq);
      const v = kv.slice(eq + 1);
      // Coerce numerics + booleans for cleaner audit reports
      if (/^-?\d+(\.\d+)?$/.test(v)) details[k] = Number(v);
      else if (v === 'true') details[k] = true;
      else if (v === 'false') details[k] = false;
      else details[k] = v;
    }
  }
}

const jobDir = path.join('jobs', domain);
if (!fs.existsSync(jobDir)) {
  // Graceful no-op — orchestrator may call this before Stage 1 creates the dir.
  // Better to silently skip than fail the pipeline on a logging-only step.
  process.exit(0);
}

const entry = {
  ts: new Date().toISOString(),
  stage,
  event,
  details,
};

const logPath = path.join(jobDir, 'orchestration.log');
try {
  fs.appendFileSync(logPath, JSON.stringify(entry) + '\n');
  process.exit(0);
} catch (e) {
  // Logging failure should NEVER block the pipeline. Print to stderr for visibility
  // and exit 0 so the orchestrator's bash chain doesn't fail.
  console.error(`⚠ log-decision: failed to append to ${logPath}: ${e.message}`);
  process.exit(0);
}
