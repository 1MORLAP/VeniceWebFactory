#!/usr/bin/env node
/**
 * set-vercel-build-machine.cjs — switch project's build machine class (Phase J)
 *
 * Built 2026-05-07 after Vercel build-CPU-minutes hit $9.65/day during
 * WebFactory testing. Even though we deploy `--prebuilt` (no remote
 * build), Vercel allocates a "Turbo Build Machine" (30 cores, 60 GB)
 * by default for the upload pipeline and bills a 1-min minimum per
 * deploy. With 3 deploys/build × N builds/day, this scales to
 * ~$120/day at 100 builds/day — untenable.
 *
 * The fix: set each project's `resourceConfig.buildMachine.purchaseType`
 * to `standard` (4 cores / 8 GB). Standard machines bill at a lower
 * per-minute rate. The 2-3 second upload pipeline doesn't need 30
 * cores — Standard handles it identically.
 *
 * Per Vercel docs (verified 2026-05-07):
 *   buildMachine.purchaseType
 *     Enum: enhanced, turbo, standard, null
 *     Description: Machine type used for the build
 *
 * Usage:
 *   node scripts/set-vercel-build-machine.cjs <projectId|projectName> [class]
 *     class: standard (default) | enhanced | turbo
 *
 *   Scope: hardcoded to team_4Hr5Lqd6pY5D7gmeXDVsDmYx (tomek-group).
 *
 * Auth: reads token from ~/Library/Application Support/com.vercel.cli/auth.json
 *       OR env $VERCEL_TOKEN (env wins if set).
 *
 * Exit codes:
 *   0 — success (project updated, or already on the requested class)
 *   1 — bad CLI args
 *   2 — auth token not found
 *   3 — Vercel API error (project not found, scope mismatch, etc.)
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const TEAM_ID = 'team_4Hr5Lqd6pY5D7gmeXDVsDmYx';

const projectIdOrName = process.argv[2];
const machineClass = process.argv[3] || 'standard';
if (!projectIdOrName) {
  console.error('Usage: node scripts/set-vercel-build-machine.cjs <projectId|projectName> [standard|enhanced|turbo]');
  process.exit(1);
}
if (!['standard', 'enhanced', 'turbo'].includes(machineClass)) {
  console.error(`✗ Invalid class "${machineClass}" — must be standard | enhanced | turbo`);
  process.exit(1);
}

// Resolve auth token: env wins, then auth.json fallback.
function getToken() {
  if (process.env.VERCEL_TOKEN) return process.env.VERCEL_TOKEN;
  const authPath = path.join(os.homedir(), 'Library/Application Support/com.vercel.cli/auth.json');
  if (!fs.existsSync(authPath)) {
    console.error(`✗ Vercel auth file not found at ${authPath}`);
    console.error('  Run: npx vercel login');
    console.error('  Or set VERCEL_TOKEN env var with a token from https://vercel.com/account/tokens');
    process.exit(2);
  }
  try {
    const auth = JSON.parse(fs.readFileSync(authPath, 'utf8'));
    if (!auth.token) throw new Error('no token field in auth.json');
    return auth.token;
  } catch (e) {
    console.error(`✗ Failed to read token from ${authPath}: ${e.message}`);
    process.exit(2);
  }
}

const token = getToken();

async function main() {
  const url = `https://api.vercel.com/v9/projects/${encodeURIComponent(projectIdOrName)}?teamId=${TEAM_ID}`;
  const body = JSON.stringify({
    resourceConfig: {
      buildMachine: { purchaseType: machineClass },
    },
  });

  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`✗ Vercel API error (${res.status}): ${text.slice(0, 500)}`);
    process.exit(3);
  }

  const result = await res.json();
  const actualClass =
    result?.resourceConfig?.buildMachine?.purchaseType ?? '(default — turbo on Pro)';
  console.log(`✓ Project ${result.name} (${result.id}): build machine = ${actualClass}`);
  process.exit(0);
}

main().catch(e => {
  console.error(`✗ Unexpected error: ${e.message}`);
  process.exit(3);
});
