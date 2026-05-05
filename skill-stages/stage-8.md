# Stage 8 — Deploy to Vercel

> **Loaded by**: orchestrator (deterministic Vercel CLI invocations + QA-gate runs).
>
> **Source of truth**: this is the canonical text for Stage 8. The summary in `SKILL.md` is a stub that points here.

### Stage 8: Deploy to Vercel

#### 🟦 Vercel Teams Configuration (READ THIS BEFORE FIRST DEPLOY OF A PIPELINE RUN)

**All WebFactory deploys go to ONE specific Vercel team.** Deploying to the wrong scope (the user's personal account, a different team) is a real failure mode — projects show up under the wrong dashboard, billing splits, the user can't find them, and re-deploys may go to a different scope than original deploys leaving orphans.

**Canonical identifiers** (hardcode these — do not infer from `vercel whoami` output):

| Identifier                          | Value                                  | When to use                                                                                                                |
|-------------------------------------|----------------------------------------|----------------------------------------------------------------------------------------------------------------------------|
| **Team slug** (CLI)                 | `tomek-group`                          | `vercel --scope tomek-group ...`, AND verifying deploy URLs end in `-tomek-group.vercel.app`                                |
| **Team ID** (MCP tools)             | `team_4Hr5Lqd6pY5D7gmeXDVsDmYx`        | `teamId` parameter on EVERY Vercel MCP call (`list_projects`, `list_deployments`, `get_deployment`, `get_deployment_build_logs`, etc.) — without it, calls return empty or fail |
| **Team display name** (humans only) | `Tomek Group`                          | When referring to the team in user-facing output                                                                            |
| **Personal username (NOT a target)** | `tomekgroup` (no hyphen)              | This is what `vercel whoami` returns. **NEVER deploy here.**                                                                |

**The trap**: `tomekgroup` (personal, no hyphen) and `tomek-group` (team, with hyphen) look almost identical. `vercel whoami` shows `tomekgroup`, which a model unfamiliar with the setup might assume is the deploy target. **It is not.** Always use the team slug `tomek-group` for the CLI.

**How deploys actually land in the team**:

1. **Existing job directories** (`jobs/{domain}/option-*/`) already have `.vercel/project.json` linked to the team. Re-deploying from those directories automatically targets `tomek-group`. No `--scope` flag needed. This is the common case.

2. **Brand-new project directories** (first-ever deploy from a never-deployed location, e.g., a freshly created `option-c/` for a new domain). Two ways to ensure team scope:

   ```bash
   # Method A: pre-link before first deploy (preferred for unattended runs)
   cd jobs/{domain}/option-a/
   npx vercel link --scope tomek-group --project {domain-slug}-option-a --yes
   # then the standard deploy flow
   npx vercel build --yes
   npx vercel deploy --prebuilt --yes
   ```

   **CRITICAL — `--project` flag is mandatory** (real bug 2026-04-28, bwlocksmith.com): without `--project`, `vercel link` auto-names from the current directory (= `option-a`), which COLLIDES across customer builds. The first build creates a project literally called `option-a` under the team; the next domain's build attaches to the SAME project, mixing deployments. Always pass `--project {domain-slug}-option-{a|b|c}` where `{domain-slug}` is the customer's domain with dots replaced by hyphens (e.g., `bwlocksmith-com-option-a`, `libertylandscapefl-com-option-a`).

   ```bash
   # Method B: pass --scope on the first deploy (also works for scope, but does NOT solve the auto-naming collision)
   cd jobs/{domain}/option-a/
   npx vercel build --yes
   npx vercel --scope tomek-group deploy --prebuilt --yes
   # Method B still creates a bare-named project on first deploy; prefer Method A.
   ```

3. **Verification after first deploy of a pipeline change** (one-time per pipeline change):
   - Deployment URL MUST end in `-tomek-group.vercel.app`
   - If it ends in `-tomekgroup.vercel.app` (no hyphen) or has no team suffix → wrong scope. Delete the project from the personal account and re-deploy with `--scope tomek-group`.

**Vercel MCP tool calls — `teamId` is REQUIRED**:

```jsonc
// Correct — every Vercel MCP call must include teamId
list_projects({ teamId: "team_4Hr5Lqd6pY5D7gmeXDVsDmYx" })
list_deployments({ teamId: "team_4Hr5Lqd6pY5D7gmeXDVsDmYx", projectId: "prj_..." })
get_deployment({ teamId: "team_4Hr5Lqd6pY5D7gmeXDVsDmYx", idOrUrl: "dpl_..." })
get_deployment_build_logs({ teamId: "team_4Hr5Lqd6pY5D7gmeXDVsDmYx", idOrUrl: "dpl_..." })
get_runtime_logs({ teamId: "team_4Hr5Lqd6pY5D7gmeXDVsDmYx", idOrUrl: "dpl_..." })

// WRONG — no teamId, returns empty / errors / queries personal scope
list_projects({})
```

If you need to discover the team ID dynamically (you shouldn't — it's hardcoded above): `list_teams()` returns the available teams with their IDs.

**Disable Vercel Authentication after deploy** (the SSO protection that prompts for login on previews — needs to be off so the customer can view without logging in):

New Vercel projects in `tomek-group` ship with `ssoProtection: { deploymentType: "all_except_custom_domains" }` enabled by default. Customers visiting the preview URL get a 401 login wall until you disable it. Run this for EACH option after `vercel deploy` succeeds.

**Use the CLI command — NOT the REST API alone.** Real bug 2026-04-29 (giffins.net): the API call `PATCH /v9/projects/{name} {"ssoProtection": null}` returned 200 OK and a follow-up GET confirmed `ssoProtection: null` — but the live deployment URL still returned 401 indefinitely. The Vercel CLI's `vercel project protection disable` subcommand is what actually triggers the propagation. The API is useful as a diagnostic (verify the field really is null) but doesn't reliably flip the protection state on its own.

```bash
# CANONICAL: CLI subcommand (project-name first, then --sso flag — exact syntax matters)
cd jobs/{domain}/option-a/
npx vercel project protection disable {domain-slug}-option-a --sso
# Repeat for option-b, option-c (with --skip-c, only the first 2)
```

The CLI prints a JSON confirmation:
```json
{
  "action": "disable",
  "projectId": "prj_...",
  "projectName": "{domain-slug}-option-a",
  "ssoProtection": false
}
```

**API call as diagnostic only** (use to verify state, do NOT rely on it for the disable itself):

```bash
TOKEN=$(jq -r '.token' "$HOME/Library/Application Support/com.vercel.cli/auth.json")
TEAM=team_4Hr5Lqd6pY5D7gmeXDVsDmYx
PROJECT={domain-slug}-option-a

# Read state (diagnostic):
curl -s "https://api.vercel.com/v9/projects/$PROJECT?teamId=$TEAM" \
  -H "Authorization: Bearer $TOKEN" | jq '.ssoProtection'

# Write state (NOT reliable on its own — use CLI above; this is a fallback only):
curl -s -X PATCH "https://api.vercel.com/v9/projects/$PROJECT?teamId=$TEAM" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ssoProtection": null}'
```

**Verification**: after `vercel project protection disable`, poll the deploy URL until it returns 200:

```bash
DEPLOY_URL=https://{domain-slug}-option-a-{hash}-tomek-group.vercel.app
until [ "$(curl -s -o /dev/null -w '%{http_code}' "$DEPLOY_URL/?t=$(date +%s)")" = "200" ]; do sleep 2; done
echo "✓ public"
```

Propagation is usually 1-3 seconds after the CLI command succeeds.

This relies on the project being correctly scoped to `tomek-group` already (Step 1 or 2 above). If the project landed in the personal account, this command targets the wrong project and fails silently.

#### Stage 8a: Automated QA Gate (MANDATORY — BLOCKS deploy)

Before deploying, run the automated QA gate against local dev servers. This is a fast, exit-code-based check that fails the pipeline if ANY of these are detected: logo is low-res (<100px natural width OR naturalWidth < 1.5× displayed width = will appear blurry on retina), broken images, literal `\uXXXX` escapes rendered as visible text, missing nav/footer/h1, console errors, or failed network requests. It catches the class of bugs that slip past manifest-level grep checks and casual visual skim.

This gate was added after a real bug in fsolsidingcontractor.com (2026-04-16) where a 24×8px WordPress favicon crop was used as the nav logo and shipped to production. Screenshot-based QA missed it because the logo "looked like a logo" at a glance.

**Option A gate:**

```bash
cd jobs/{domain}/option-a
npm run build
```

```bash
PORT_A=$(node /Users/tomasz/WebFactory/scripts/get-port.cjs "$DOMAIN" a)
cd jobs/{domain}/option-a
(npx astro dev --port $PORT_A > /tmp/astro-a.log 2>&1 &)
sleep 4
```

```bash
PORT_A=$(node scripts/get-port.cjs "$DOMAIN" a)
cd /Users/tomasz/WebFactory
node scripts/qa-check.js http://localhost:$PORT_A --manifest jobs/$DOMAIN/manifest.json --option a / /about /contact
```

If `qa-check.js` exits non-zero, **STOP**. Read the output, fix the root cause, and re-run:
- Logo fail → re-run `node scripts/fix-logo.js {domain}`, copy fixed file to `option-a/public/images/logo.png`, `option-b/public/images/logo.png`, AND `option-c/public/images/logo.png`, rebuild, re-gate.
- Unicode escape fail (`\uXXXX`) → replace literal `\uXXXX` in source files with actual characters: `perl -CSD -i -pe 's/\\u2013/\x{2013}/g' src/pages/*.astro` (and similar for other escapes).
- **HTML entity literal fail (`&#NNN;` rendered as visible text)** → the source has a numeric character reference inside an Astro `{...}` JSX expression, where the `&` gets HTML-escaped to `&amp;` and the entity ships unrendered. Three valid fixes (any one of them works):
  1. **Use the literal Unicode character** in the source. For emoji, just paste the actual character: `icon: '🐛'` not `icon: '&#128027;'`. This is the cleanest fix — UTF-8 handles Unicode natively, no escaping needed.
  2. **Use Astro's `set:html` directive** if you must keep entity-reference syntax: `<span set:html={service.icon}></span>` injects raw HTML.
  3. **Place the entity in HTML markup directly** (outside `{...}` expressions): `<div>&#128027;</div>` works fine because Astro's HTML parser decodes entities, but `<div>{'&#128027;'}</div>` doesn't because the JSX expression context HTML-escapes the `&` first.
  Real bug shipped 2026-04-28 (Bugs-B-Gone Pest Control): six service-card icons rendered as raw `&#128027;` text instead of bug emoji because the worker put icon strings in a JS data array and rendered via `{service.icon}`.
- Broken image fail → verify file exists at referenced path under `public/images/`.

After Option A gate passes, run Option B gate (build + serve dist + qa-check):

```bash
pkill -f "astro dev"
cd jobs/{domain}/option-b
npm run build
```

```bash
PORT_A_PLUS=$(node /Users/tomasz/WebFactory/scripts/get-port.cjs "$DOMAIN" a-plus)
cd jobs/{domain}/option-b
(npx serve dist -l $PORT_A_PLUS > /tmp/serve-a-plus.log 2>&1 &)
sleep 3
```

```bash
PORT_A_PLUS=$(node scripts/get-port.cjs "$DOMAIN" a-plus)
cd /Users/tomasz/WebFactory

# Build the page list for qa-check.
# English pages always: / /about /contact (and any other English pages)
# Per active language in option-b/src/pages/<lang>/: prepend /<lang>/
ACTIVE_LANGS=""
for LANG_DIR in jobs/$DOMAIN/option-b/src/pages/*/; do
  LANG=$(basename "$LANG_DIR")
  if [ ${#LANG} -eq 2 ]; then
    ACTIVE_LANGS="$ACTIVE_LANGS $LANG"
  fi
done

EN_PAGES="/ /about /contact"
LANG_PAGES=""
for LANG in $ACTIVE_LANGS; do
  for P in $EN_PAGES; do
    LANG_PAGES="$LANG_PAGES /$LANG${P}"
  done
done

# Pass --reference-dist-i18n only if at least one language is active
if [ -n "$ACTIVE_LANGS" ]; then
  REF_I18N_FLAG="--reference-dist-i18n jobs/$DOMAIN/option-b/dist"
else
  REF_I18N_FLAG=""
fi

node scripts/qa-check.js http://localhost:$PORT_A_PLUS --manifest jobs/$DOMAIN/manifest.json --reference-dist jobs/$DOMAIN/option-a/dist $REF_I18N_FLAG --option b $EN_PAGES $LANG_PAGES
pkill -f "serve dist"
```

After B gate passes, run Option C gate (skip entirely if `$SKIP_C=1` OR if Option C wasn't built because the plugin isn't installed):

```bash
if [ "$SKIP_C" = "1" ]; then
  echo "⏭️  Option C QA gate skipped (SKIP-C mode)"
else
  echo "Running Option C QA gate..."
  # ... continue with the C gate substeps below
fi
```

```bash
cd jobs/{domain}/option-c
npm run build
```

```bash
PORT_C=$(node /Users/tomasz/WebFactory/scripts/get-port.cjs "$DOMAIN" c)
cd jobs/{domain}/option-c
(npx serve dist -l $PORT_C > /tmp/serve-c.log 2>&1 &)
sleep 3
```

```bash
PORT_C=$(node scripts/get-port.cjs "$DOMAIN" c)
cd /Users/tomasz/WebFactory

# Same conditional language detection as the B gate above. Active languages on
# C should mirror B (single source of truth — B owns translations, C reads from B).
ACTIVE_LANGS=""
for LANG_DIR in jobs/$DOMAIN/option-c/src/pages/*/; do
  LANG=$(basename "$LANG_DIR")
  if [ ${#LANG} -eq 2 ]; then
    ACTIVE_LANGS="$ACTIVE_LANGS $LANG"
  fi
done

EN_PAGES="/ /about /contact"
LANG_PAGES=""
for LANG in $ACTIVE_LANGS; do
  for P in $EN_PAGES; do
    LANG_PAGES="$LANG_PAGES /$LANG${P}"
  done
done

if [ -n "$ACTIVE_LANGS" ]; then
  REF_I18N_FLAG="--reference-dist-i18n jobs/$DOMAIN/option-b/dist"
else
  REF_I18N_FLAG=""
fi

node scripts/qa-check.js http://localhost:$PORT_C --manifest jobs/$DOMAIN/manifest.json --reference-dist jobs/$DOMAIN/option-a/dist $REF_I18N_FLAG --option c $EN_PAGES $LANG_PAGES
pkill -f "serve dist"
```

Only proceed to Stage 8b (actual deploy) once ALL gates pass:
- Default mode: A + B + C must all pass
- `--skip-c` mode: only A + B must pass (the C gate is skipped, not failed)
- Plugin-not-installed mode: A + B must pass; C gate is skipped with a warning

---

> **→ NEXT: Stage 8b — Deploy.** Stage 8a (QA Gate) just passed for all options. Continue IMMEDIATELY to Stage 8b. Do NOT ask the user "ready to push to Vercel?" Just push. (See PIPELINE COMPLETION CONTRACT at top.)

#### Stage 8b: Deploy

Deploy each option using the **canonical Vercel prebuilt flow**: run `vercel build` LOCALLY (which produces the `.vercel/output/` artifact that `--prebuilt` requires), then `vercel deploy --prebuilt` to upload that artifact as-is. This is the only way `--prebuilt` actually skips remote build infrastructure.

**Why this matters (real bug we shipped, fixed 2026-04-25):** the previous pattern was `npx vercel deploy ./dist --prebuilt --yes`. That looks correct but is silently broken — `./dist` doesn't contain a `.vercel/output/` directory (Astro's output is just static HTML/CSS/JS), so Vercel ignores the `--prebuilt` flag, spins up a remote Turbo Build Machine (30 cores / 60 GB), and runs `vercel build` remotely. The remote build completes in ~40ms because there's nothing to compile, but the build machine spin-up still consumes Vercel build minutes on every deploy. Confirmed via build logs from `dpl_BoRJDyfLhVZRdKQsHo9kmFgYx3Sv` (Claude/WebFactory) — both showed `"Running build in iad1 (Turbo Build Machine)"` despite `--prebuilt`.

The correct flow runs `vercel build` LOCALLY (which builds Astro AND wraps `dist/` into `.vercel/output/static/`), then `vercel deploy --prebuilt` (no path argument) uploads `.vercel/output/` directly. No remote build machine. Truly zero Vercel build minutes consumed.

**CRITICAL**: You must `cd` to the option's root directory (the one with `astro.config.mjs`, NOT the `dist/` directory) before each deploy command. Deploying from the wrong directory will deploy the wrong project. Pass NO path argument to `vercel deploy` — the prebuilt artifact lives at `.vercel/output/` relative to the current directory.

**PRE-DEPLOY LINK CHECK (mandatory for every option, every build)**: before running `vercel build` / `vercel deploy`, verify the option's `.vercel/project.json` exists. If missing, pre-link to a project under team `tomek-group` BEFORE attempting to build. This prevents the "Set up and deploy?" interactive prompt that breaks unattended mode. The Smart Resume `--full`/`--clean` handler preserves existing links across wipes (see Smart Resume section), so this check usually no-ops on existing domains. For brand-new domains, the worker session must use `Method A: pre-link before first deploy` from the Vercel Teams Configuration block.

```bash
# Run this BEFORE the build commands below for each option (a/b/c).
# Substitute the project name per option.
cd jobs/{domain}/option-a/
if [ ! -f .vercel/project.json ]; then
  echo "  ↪ no .vercel/project.json found — pre-linking to team tomek-group"
  # If the project already exists on Vercel under tomek-group with a known name,
  # link to it. Otherwise vercel link will create a new project named after the dir.
  npx vercel link --scope tomek-group --yes
fi
```

**Option A** — build locally, then deploy prebuilt:

```bash
cd jobs/{domain}/option-a/
npx vercel build --yes
```

```bash
cd jobs/{domain}/option-a/
DEPLOY_URL_A=$(npx vercel deploy --prebuilt --yes 2>/dev/null | tail -1)
echo "Option A deployed: $DEPLOY_URL_A"
cd /Users/tomasz/WebFactory
node scripts/record-deploy-url.cjs "$DOMAIN" a "$DEPLOY_URL_A"
node scripts/log-decision.cjs "$DOMAIN" 8b deploy-recorded --detail option=a --detail url="$DEPLOY_URL_A"
```

**Option B** — same pattern (B inherits A's design and outputs to its own Astro build):

```bash
cd jobs/{domain}/option-b/
npx vercel build --yes
```

```bash
cd jobs/{domain}/option-b/
DEPLOY_URL_B=$(npx vercel deploy --prebuilt --yes 2>/dev/null | tail -1)
echo "Option B deployed: $DEPLOY_URL_B"
cd /Users/tomasz/WebFactory
node scripts/record-deploy-url.cjs "$DOMAIN" b "$DEPLOY_URL_B"
node scripts/log-decision.cjs "$DOMAIN" 8b deploy-recorded --detail option=b --detail url="$DEPLOY_URL_B"
```

**Option C** — same pattern (skip ENTIRELY if `$SKIP_C=1` OR if Option C wasn't built because the plugin isn't installed):

```bash
if [ "$SKIP_C" = "1" ]; then
  echo "⏭️  Option C deploy skipped (SKIP-C mode)"
else
  # Run the two commands below
  echo "Deploying Option C..."
fi
```

```bash
cd jobs/{domain}/option-c/
npx vercel build --yes
```

```bash
cd jobs/{domain}/option-c/
DEPLOY_URL_C=$(npx vercel deploy --prebuilt --yes 2>/dev/null | tail -1)
echo "Option C deployed: $DEPLOY_URL_C"
cd /Users/tomasz/WebFactory
node scripts/record-deploy-url.cjs "$DOMAIN" c "$DEPLOY_URL_C"
node scripts/log-decision.cjs "$DOMAIN" 8b deploy-recorded --detail option=c --detail url="$DEPLOY_URL_C"
```

**Why capture + record the URLs**: Stage 10c (`scripts/register-with-store.mjs`) registers the build with the WebFactory storefront at `tomekgroup.com` and needs all three deploy URLs. Recording them to `metrics.json` here means the Stage 10 invocation needs no extra args. The capture pattern `$(npx vercel deploy ... | tail -1)` works because the Vercel CLI prints the deploy URL as its last stdout line; if any error output goes to stderr (`2>/dev/null` discards it), the URL captured is clean.

**Verify after first deploy** (one-time sanity check per pipeline change): the build logs in the Vercel dashboard for any of these deployments should NOT contain the lines `"Running build in ... (Turbo Build Machine)"` or `"Running 'vercel build'"`. Instead they should jump straight to `"Deploying outputs..."`. If you see remote-build lines, `--prebuilt` is being ignored — re-check that `.vercel/output/` exists in the option's root directory after `vercel build`, and that you're NOT passing `./dist` (or any path) to `vercel deploy`.

After deploying, disable Vercel Authentication (SSO protection) on all projects so the URLs are publicly accessible:

```bash
cd jobs/{domain}/option-a/
npx vercel project protection disable --sso option-a
```

```bash
cd jobs/{domain}/option-b/
npx vercel project protection disable --sso option-b
```

```bash
if [ "$SKIP_C" = "1" ]; then
  echo "⏭️  Option C SSO-disable skipped (SKIP-C mode)"
else
  cd jobs/{domain}/option-c/
  npx vercel project protection disable --sso option-c
fi
```

Record the preview URLs:
- Default mode: 3 URLs (A + B + C)
- `--skip-c` mode: 2 URLs (A + B only)
