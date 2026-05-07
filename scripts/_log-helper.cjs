/**
 * _log-helper.cjs — shared `logDecision()` helper for self-instrumenting scripts.
 *
 * Built 2026-05-06 as Phase F infrastructure after the idahoequinehospital
 * test build revealed orchestrator-emitted prose-based instrumentation is
 * fragile: the orchestrator follows ~30% of the documented log-decision
 * calls and silently drops the rest. The fix is to have scripts EMIT THEIR
 * OWN events. The orchestrator can't skip what the script does itself.
 *
 * Usage from any .cjs script:
 *
 *   const { logDecision } = require('./_log-helper.cjs');
 *   logDecision(domain, '1d', 'images-classified', {
 *     total: 89, content: 88, contentPct: 99
 *   });
 *
 * The helper:
 *   - Spawns scripts/log-decision.cjs as a child process (same process
 *     model as register-with-store.mjs has used since Phase E).
 *   - SWALLOWS errors silently — logging must never block the parent
 *     script's exit. If log-decision.cjs is broken, missing, or the disk
 *     is full, the parent still completes its work.
 *   - Resolves the script path from __dirname so it works regardless of
 *     where the parent is invoked from.
 */

const { spawnSync } = require('node:child_process');
const path = require('node:path');

const SCRIPT_DIR = __dirname;

exports.logDecision = function logDecision(domain, stage, event, details = {}) {
  if (!domain || !stage || !event) return;   // missing required args — no-op
  const args = [path.join(SCRIPT_DIR, 'log-decision.cjs'), String(domain), String(stage), String(event)];
  for (const [k, v] of Object.entries(details)) {
    if (v === undefined || v === null) continue;
    args.push('--detail', `${k}=${v}`);
  }
  try {
    // stdio: 'ignore' — the parent script doesn't want log-decision's
    // stdout/stderr cluttering its own output. Errors swallowed.
    spawnSync('node', args, { stdio: 'ignore' });
  } catch {
    /* swallow — logging is best-effort */
  }
};
