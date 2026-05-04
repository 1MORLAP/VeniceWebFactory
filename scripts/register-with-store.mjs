#!/usr/bin/env node
/**
 * register-with-store.mjs — Stage 10c registration with the WebFactory Store
 *
 * Posts the build's deploy URLs + manifest metadata + screenshots to the
 * storefront intake API at tomekgroup.com so the new job appears in the
 * storefront DB and cold-outreach email can pick it up.
 *
 * Usage:
 *   node scripts/register-with-store.mjs --domain <domain>
 *     [--option-a-url <url>] [--option-b-url <url>] [--option-c-url <url>]
 *     [--store-intake-url <override>]   # default: https://tomekgroup.com/wf/api/jobs/intake
 *     [--force]                          # re-register even if checkpoint exists
 *
 * Reads:
 *   jobs/{domain}/manifest.json    — business_name, industry, original URL
 *   jobs/{domain}/metrics.json     — option{A,B,C}.url (recorded by Stage 8b
 *                                    via scripts/record-deploy-url.cjs)
 *   lead-funnel/leads.db           — contact_email lookup by domain
 *                                    (or jobs/{domain}/lead.json fallback)
 *
 * Writes (on success):
 *   jobs/{domain}/store-registration.json — checkpoint with returned
 *                                           {job_id, slug, store_url, expires_at}
 *
 * Writes (on failure — NON-FATAL):
 *   appends to jobs/{domain}/feedback.md with the failure reason and a
 *   curl-equivalent for manual retry.
 *
 * Exit codes:
 *   0 — registered, OR already-registered (idempotency hit), OR non-fatal
 *       failure logged to feedback.md (pipeline must continue)
 *   2 — bad CLI args / unrecoverable misuse (caller should fix and retry)
 */

import { chromium } from 'playwright';
import {
  readFileSync,
  writeFileSync,
  existsSync,
  appendFileSync,
} from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(SCRIPT_DIR, '..');

// ---- arg parsing ----------------------------------------------------------
const args = process.argv.slice(2);
let domain = null;
let force = false;
const overrides = { a: null, b: null, c: null };
let intakeUrl = null;
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--domain' && args[i + 1])             { domain = args[++i]; continue; }
  if (a === '--option-a-url' && args[i + 1])       { overrides.a = args[++i]; continue; }
  if (a === '--option-b-url' && args[i + 1])       { overrides.b = args[++i]; continue; }
  if (a === '--option-c-url' && args[i + 1])       { overrides.c = args[++i]; continue; }
  if (a === '--store-intake-url' && args[i + 1])   { intakeUrl = args[++i]; continue; }
  if (a === '--force')                              { force = true; continue; }
}
if (!domain) {
  console.error('Usage: node scripts/register-with-store.mjs --domain <domain> [--option-a-url X --option-b-url Y --option-c-url Z] [--force]');
  process.exit(2);
}

// ---- env loading: 4-tier with sibling-storefront fallback ----------------
//
// Load order (first to set a variable wins; real shell env always beats files):
//   1. shell env       — `WEBFACTORY_STORE_API_KEY=... node ...` etc.
//   2. ~/WebFactory/.env.local         — local override (gitignored)
//   3. ~/WebFactory/.env               — committed-defaults fallback (gitignored)
//   4. ~/webfactory-store/.env.local   — sibling project's env file
//
// Tier 4 (sibling) exists because the WEBFACTORY_STORE_API_KEY is the SAME
// secret on both sides: the storefront authenticates intake POSTs with it,
// WebFactory signs them with it. Reading it from the storefront's env file
// means rotating the secret on the storefront side picks up automatically
// here — no copy/paste between repos. Easy to extend with more sibling
// project paths later if the pattern repeats.
//
// ENV_PROVENANCE tracks which file supplied each variable so the success log
// can show "Loaded WEBFACTORY_STORE_API_KEY from <file>" — useful for debug.
const ENV_PROVENANCE = new Map();   // varName → filePath that supplied it

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  for (const rawLine of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^(?:export\s+)?([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    // Treat empty values as "not set" — a placeholder line like
    // `WEBFACTORY_STORE_API_KEY=` from an earlier file in the load order
    // must NOT shadow a real value from a later file.
    const existing = process.env[m[1]];
    if (existing !== undefined && existing !== '') continue;
    const value = m[2].replace(/^["']|["']$/g, '');
    if (value === '') continue;   // empty value = effectively not set
    process.env[m[1]] = value;
    ENV_PROVENANCE.set(m[1], filePath);
  }
}
loadEnvFile(join(PROJECT_ROOT, '.env.local'));
loadEnvFile(join(PROJECT_ROOT, '.env'));
loadEnvFile(join(homedir(), 'webfactory-store', '.env.local'));

const apiKey = process.env.WEBFACTORY_STORE_API_KEY;
const STORE_INTAKE_URL =
  intakeUrl ||
  process.env.WEBFACTORY_STORE_INTAKE_URL ||
  'https://tomekgroup.com/wf/api/jobs/intake';

// ---- resolve job paths ----------------------------------------------------
const jobDir         = join(PROJECT_ROOT, 'jobs', domain);
const checkpointPath = join(jobDir, 'store-registration.json');
const manifestPath   = join(jobDir, 'manifest.json');
const metricsPath    = join(jobDir, 'metrics.json');
const feedbackPath   = join(jobDir, 'feedback.md');

// ---- idempotency: skip if already registered -----------------------------
if (existsSync(checkpointPath) && !force) {
  try {
    const prior = JSON.parse(readFileSync(checkpointPath, 'utf8'));
    console.log(`✓ Already registered (job_id=${prior.job_id}, slug=${prior.slug}). Pass --force to re-register.`);
    console.log(`  Storefront URL: ${prior.store_url}`);
    process.exit(0);
  } catch (e) {
    console.error(`⚠ Existing ${checkpointPath} unparseable (${e.message}); proceeding with re-registration.`);
  }
}

// ---- fail-fast preconditions ---------------------------------------------
if (!apiKey) {
  softFail(
    'WEBFACTORY_STORE_API_KEY not set in any of: shell env, ~/WebFactory/.env.local, ~/WebFactory/.env, ~/webfactory-store/.env.local',
    `Easiest: ensure the secret is set in ~/webfactory-store/.env.local — WebFactory reads it from there directly so you don't need a separate copy. `
    + `If you don't have the storefront repo locally, paste the secret into ~/WebFactory/.env.local instead: \`echo "WEBFACTORY_STORE_API_KEY=<token>" >> ~/WebFactory/.env.local\`.`
  );
}

// Trace which env file supplied the API key — useful when debugging which
// repo's env got read. Doesn't print the secret value.
const apiKeySource = ENV_PROVENANCE.get('WEBFACTORY_STORE_API_KEY') || '(shell env)';
console.log(`✓ Loaded WEBFACTORY_STORE_API_KEY from ${apiKeySource}`);
if (!existsSync(manifestPath)) {
  softFail(`manifest not found at ${manifestPath}`, 'Run /webfactory <url> first to produce the manifest.');
}
if (!existsSync(metricsPath)) {
  softFail(`metrics not found at ${metricsPath}`, 'Run /webfactory <url> first to populate metrics.json.');
}

// ---- read manifest + metrics ---------------------------------------------
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const metrics  = JSON.parse(readFileSync(metricsPath, 'utf8'));

// Resolve URLs — CLI override wins, then metrics.json. Try a couple of
// shapes for back-compat in case Stage 8b records under different keys.
function urlFromMetrics(block) {
  if (!block) return null;
  return block.url || block.deployUrl || block.deployedUrl || null;
}
const optionAUrl = overrides.a || urlFromMetrics(metrics.optionA);
const optionBUrl = overrides.b || urlFromMetrics(metrics.optionB);
const optionCUrl = overrides.c || urlFromMetrics(metrics.optionC);   // null = skip-c mode

if (!optionAUrl || !optionBUrl) {
  softFail(
    `metrics.optionA.url and/or metrics.optionB.url missing`,
    `Stage 8b should have called scripts/record-deploy-url.cjs after each successful deploy. `
    + `Either re-deploy and let the orchestrator record the URLs, OR pass them explicitly via `
    + `--option-a-url <url> --option-b-url <url> [--option-c-url <url>].`
  );
}

const skipC = !optionCUrl;
console.log(`Domain:       ${domain}`);
console.log(`Mode:         ${skipC ? 'A+B (--skip-c)' : 'A+B+C'}`);
console.log(`Option A URL: ${optionAUrl}`);
console.log(`Option B URL: ${optionBUrl}`);
if (!skipC) console.log(`Option C URL: ${optionCUrl}`);

// ---- contact_email lookup -----------------------------------------------
let contactEmail = null;
const leadsDbPath = join(PROJECT_ROOT, 'lead-funnel', 'leads.db');
if (existsSync(leadsDbPath)) {
  // Use the sqlite3 CLI binary — no library dep needed for one-shot lookup.
  const escDomain = domain.replace(/'/g, "''");
  const r = spawnSync(
    'sqlite3',
    [leadsDbPath, `SELECT outreach_email FROM leads WHERE domain = '${escDomain}' AND outreach_email IS NOT NULL LIMIT 1;`],
    { encoding: 'utf8', timeout: 10_000 }
  );
  const out = (r.stdout || '').trim();
  if (out && out !== '') contactEmail = out;
}
// Fallback: per-job lead.json
if (!contactEmail) {
  const leadJsonPath = join(jobDir, 'lead.json');
  if (existsSync(leadJsonPath)) {
    try {
      const lead = JSON.parse(readFileSync(leadJsonPath, 'utf8'));
      contactEmail = lead.contact_email || lead.email || lead.outreach_email || null;
    } catch {}
  }
}
console.log(`Contact email: ${contactEmail || '(none — outreach skipped)'}`);

// ---- screenshot capture (1280×800, fresh from deployed URL) ---------------
console.log(`\nCapturing screenshots at 1280×800...`);
async function captureScreenshot(url, label) {
  const browser = await chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      ignoreHTTPSErrors: true,
    });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
    await page.waitForTimeout(500);  // let any final paint settle
    const buf = await page.screenshot({ fullPage: false, type: 'png' });
    console.log(`  ✓ Option ${label}: ${(buf.length / 1024).toFixed(1)} KB`);
    return buf;
  } finally {
    await browser.close();
  }
}

let shotA, shotB, shotC;
try {
  shotA = await captureScreenshot(optionAUrl, 'A');
  shotB = await captureScreenshot(optionBUrl, 'B');
  if (!skipC) shotC = await captureScreenshot(optionCUrl, 'C');
} catch (e) {
  softFail(
    `screenshot capture failed: ${e.message}`,
    `Re-run \`node scripts/register-with-store.mjs --domain ${domain}\` after the deployed URLs are reachable.`,
    null
  );
}

// ---- build payload --------------------------------------------------------
const payload = {
  original_url:        manifest.url || `https://${domain}`,
  business_name:       manifest.businessName || manifest.business_name || manifest.title || domain,
  industry:            manifest.industry || null,
  contact_email:       contactEmail,
  option_a_url:        optionAUrl,
  option_b_url:        optionBUrl,
  option_c_url:        optionCUrl || null,
  webfactory_job_dir:  `jobs/${domain}`,
};

const form = new FormData();
form.append('metadata', JSON.stringify(payload));
form.append('screenshot_a', new Blob([shotA], { type: 'image/png' }), 'screenshot_a.png');
form.append('screenshot_b', new Blob([shotB], { type: 'image/png' }), 'screenshot_b.png');
if (shotC) {
  form.append('screenshot_c', new Blob([shotC], { type: 'image/png' }), 'screenshot_c.png');
}

// ---- POST -----------------------------------------------------------------
console.log(`\nPOSTing to ${STORE_INTAKE_URL}...`);
let res;
let bodyText = '';
let bodyJson = null;
try {
  res = await fetch(STORE_INTAKE_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  bodyText = await res.text();
  try { bodyJson = JSON.parse(bodyText); } catch { /* not JSON — keep raw */ }
} catch (e) {
  softFail(`network/transport error during POST: ${e.message}`, 'Check connectivity to tomekgroup.com and re-run.', { payload });
}

if (!res.ok) {
  softFail(`HTTP ${res.status} from store intake`, `Server response: ${bodyText.slice(0, 1000)}`, { payload });
}
if (!bodyJson?.job_id) {
  softFail(`store accepted the POST (HTTP ${res.status}) but returned no job_id`, `Body: ${bodyText.slice(0, 500)}`, { payload });
}

// ---- success: write checkpoint -------------------------------------------
const checkpoint = {
  job_id:        bodyJson.job_id,
  slug:          bodyJson.slug,
  store_url:     bodyJson.store_url,
  expires_at:    bodyJson.expires_at || null,
  registered_at: new Date().toISOString(),
  payload_summary: {
    domain,
    option_a_url: optionAUrl,
    option_b_url: optionBUrl,
    option_c_url: optionCUrl,
    contact_email: contactEmail,
  },
};
writeFileSync(checkpointPath, JSON.stringify(checkpoint, null, 2));
console.log(`\n✓ Registered with store: ${bodyJson.store_url}`);
console.log(`  job_id:     ${bodyJson.job_id}`);
console.log(`  slug:       ${bodyJson.slug}`);
if (bodyJson.expires_at) console.log(`  expires_at: ${bodyJson.expires_at}`);
console.log(`  checkpoint: ${checkpointPath}`);
process.exit(0);

// ---- helpers --------------------------------------------------------------
function softFail(reason, hint, payloadCtx) {
  console.error(`\n✗ Storefront registration FAILED (NON-FATAL — pipeline continues): ${reason}`);
  if (hint) console.error(`  Hint: ${hint}`);

  // Append to feedback.md so the operator notices later.
  let note = `\n## Storefront registration failed (${new Date().toISOString()})\n\n`;
  note += `**Reason**: ${reason}\n\n`;
  if (hint) note += `**Hint**: ${hint}\n\n`;
  note += `**Manual retry**:\n\n`;
  note += '```bash\n';
  note += `cd ${PROJECT_ROOT}\n`;
  note += `# ensure WEBFACTORY_STORE_API_KEY is set in .env first\n`;
  note += `node scripts/register-with-store.mjs --domain ${domain}\n`;
  note += '```\n\n';

  if (payloadCtx?.payload) {
    note += `**Curl equivalent** (substitute screenshot file paths):\n\n`;
    note += '```bash\n';
    note += `curl -X POST ${STORE_INTAKE_URL} \\\n`;
    note += `  -H "Authorization: Bearer $WEBFACTORY_STORE_API_KEY" \\\n`;
    const meta = JSON.stringify(payloadCtx.payload).replace(/'/g, "'\\''");
    note += `  -F 'metadata=${meta}' \\\n`;
    note += `  -F 'screenshot_a=@/path/to/screenshot_a.png' \\\n`;
    note += `  -F 'screenshot_b=@/path/to/screenshot_b.png'`;
    if (!skipC) note += ` \\\n  -F 'screenshot_c=@/path/to/screenshot_c.png'`;
    note += '\n```\n';
  }

  try {
    appendFileSync(feedbackPath, note);
    console.error(`  Logged to ${feedbackPath} with curl-equivalent for manual retry.`);
  } catch (writeErr) {
    console.error(`  (could not write feedback.md: ${writeErr.message})`);
  }
  process.exit(0);
}
