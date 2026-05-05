# Stage 10 — Report (final stage)

> **Loaded by**: orchestrator (Opus runs the final report directly — emits the 4-URL deliverable + metrics table, then runs deterministic Stage 10c/10d scripts).
>
> **Source of truth**: this is the canonical text for Stage 10. The summary in `SKILL.md` is a stub that points here.

### Stage 10: Report

First, finalize the metrics file with output sizes and total timing:

```bash
cd /Users/tomasz/WebFactory
node scripts/finalize-metrics.cjs "$DOMAIN"
```

This measures Option A, Option B, and Option C output sizes, calculates total wall clock time, and prints the full metrics JSON.

**The final deliverable depends on mode**:
- **Default mode**: 4 links — Original, A, B, C
- **`--skip-c` mode**: 3 links — Original, A, B (with explicit "Option C: skipped" note)
- **Plugin-not-installed**: 3 links — Original, A, B (with "Option C: not built (plugin missing)" note)

**CRITICAL OUTPUT-FORMAT RULES (read before emitting the report)**:

1. **NEVER wrap the report in a fenced code block** (no ` ``` ` around it). A fenced code block renders the URLs as plain text → the user cannot click them. Real bug shipped 2026-04-25 (accelwindows.com): worker emitted the entire 4-link block inside ` ``` ` fences; user couldn't click any URL.

2. **Every URL MUST be a clickable markdown autolink** — wrap the URL in angle brackets: `<https://example.com>`. This works in Claude Code's UI, GitHub markdown, Notion, every standard markdown renderer. DO NOT emit bare URLs (`https://...` with no syntax) — those auto-link in some renderers but not others.

3. **Use markdown headings (`##`, `###`), markdown lists (`1.`, `-`), and markdown tables (`|`)** — render normally. The ONLY thing forbidden is wrapping the whole report in ` ``` ` fences.

The format below is what the user should SEE rendered (not the literal characters with fences). Emit it as raw markdown directly into chat — no code block wrapper:

---

## ✅ WebFactory Complete — {Customer Business Name} ({domain})

Here are your {3 or 4} final links:

1. **Original**: <{customer URL}>
2. **Option A** (faithful — original copy + new design): <{vercel-url-a}>
3. **Option B** (A's design + agency conversion-tuned copy): <{vercel-url-b}>
4. **Option C** (B's words in plugin's industry-anchored design language): <{vercel-url-c}>

(If `$SKIP_C = 1`, replace line 4 with: `4. **Option C**: skipped (--skip-c mode — A and B only this run)`)

(If plugin not installed, replace line 4 with: `4. **Option C**: not built (Frontend Design plugin not installed — install with `claude plugin install frontend-design@claude-plugins-official --scope project` and re-run with `--option-c`)`)

### 📊 Metrics

| Metric | Value |
|--------|-------|
| Model | {model} |
| Total time | {totalMinutes} min |
| Input pages | {input.pages} |
| Option A output | {optionA.htmlFiles} pages, {optionA.totalBytes} bytes |
| Option B output | {optionB.htmlFiles} pages, {optionB.totalBytes} bytes |
| Option C output | {optionC.htmlFiles} pages, {optionC.totalBytes} bytes (or "skipped" if --skip-c) |
| Metrics file | `jobs/{domain}/metrics.json` |

Languages: English-only by default (since 2026-04-30 per MULTILINGUAL SUPPORT rule). Translations are explicit opt-in via `--languages <list>` (initial-build flag) OR `/webfactory <domain> --add-language <name|iso> --to <b|c|both>` (post-build incremental flag). Active languages on this build: {detect from option-b/src/pages/ subdirs and report — "English only" if none}. A always stays English-only.

---

**Verification before finalizing**: scan your own output. If you see ` ``` ` anywhere wrapping the link list or the table — DELETE the fences and re-emit. Inline code spans like `` `jobs/{domain}/metrics.json` `` are fine (and intended); whole-block fences are the bug.

---

#### Stage 10c: Register with the WebFactory Store (non-fatal)

After the user-facing report is emitted, register the build with the WebFactory storefront at `tomekgroup.com` so the new job appears in the storefront DB and cold-outreach email can pick it up. This MUST run after the report — registering before the report would risk publishing a build that turned out to fail at the report-emit step.

**A/B variant builds SKIP Stage 10c** (added 2026-05-05 with Phase D). A/B variants are local experiments comparing cost-tier presets — they should NEVER appear in the customer-facing storefront. The check:

```bash
AB_VARIANT=$(node -e 'try { console.log(JSON.parse(require("fs").readFileSync("jobs/'$DOMAIN'/metrics.json","utf8")).abVariant || "") } catch { console.log("") }')
if [ -n "$AB_VARIANT" ]; then
  echo "⏭️  Stage 10c skipped — this is A/B variant '$AB_VARIANT', not registering with storefront"
else
  cd /Users/tomasz/WebFactory
  node scripts/register-with-store.mjs --domain "$DOMAIN"
fi
```

For canonical (non-A/B) builds, just run:

```bash
cd /Users/tomasz/WebFactory
node scripts/register-with-store.mjs --domain "$DOMAIN"
```

The script:
- Reads deploy URLs from `jobs/{domain}/metrics.json` (recorded by Stage 8b's `record-deploy-url.cjs` calls). On `--skip-c` runs, `option-c.url` is absent and the script omits `option_c_url` + `screenshot_c` from the POST automatically.
- **Derives the project's canonical URL** from each option's `.vercel/project.json`: `https://{projectName}.vercel.app`. The canonical URL is what gets POSTed to the intake API and what the screenshots are captured against — NOT the deployment-specific URL with the hash + `-tomek-group` suffix that Stage 8b recorded. Why: deployment-specific URLs are immutable (frozen at build time); canonical URLs always serve the project's CURRENT production deployment. After any future re-deploy (post-purchase, `--add-language`, manual fix), the storefront's preview buttons / admin links / pre-purchase pages keep working without a backfill. The deployment-specific URL is preserved in `metrics.json` and in the checkpoint's `payload_summary.deployment_urls_at_registration` for diagnostic traceability. If `.vercel/project.json` is missing for an option (very old build, link wiped), the script falls back to the deployment-specific URL with a log line so the operator knows.
- Captures fresh 1280×800 PNG screenshots from each canonical URL via Playwright (~3s each, ~9-12s total for A+B+C).
- Looks up `contact_email` in `lead-funnel/leads.db` (`SELECT outreach_email FROM leads WHERE domain = ?`); falls back to `jobs/{domain}/lead.json` if present; sends `null` if neither has it.
- POSTs `multipart/form-data` to `https://tomekgroup.com/wf/api/jobs/intake` with `Authorization: Bearer ${WEBFACTORY_STORE_API_KEY}`.
- On success: writes `jobs/{domain}/store-registration.json` checkpoint with the returned `{job_id, slug, store_url, expires_at}`. Prints `✓ Registered with store: <store_url>`.
- On failure: appends a structured note + curl-equivalent to `jobs/{domain}/feedback.md`. **NON-FATAL** — exits 0 so the pipeline still reports success. The build itself is fine; only registration retry remains.

**Idempotency**: if `jobs/{domain}/store-registration.json` already exists, the script prints the existing storefront URL and exits without re-POSTing (the intake API generates a fresh slug on every call — calling twice creates duplicate storefront entries). Pass `--force` to re-register intentionally (e.g., after substantive content changes).

**API key requirement**: the script loads `WEBFACTORY_STORE_API_KEY` from FOUR sources, in order (first non-empty value wins; real shell env always beats files):

1. **shell env** — `WEBFACTORY_STORE_API_KEY=... node ...`
2. **`~/WebFactory/.env.local`** — local override (gitignored)
3. **`~/WebFactory/.env`** — committed-defaults fallback (gitignored)
4. **`~/webfactory-store/.env.local`** — sibling storefront repo's env file

**Tier 4 is the canonical setup.** The same secret authenticates storefront intake POSTs (server side) AND signs them (WebFactory side); both projects need it; storing it once in the storefront's env file (where `vercel env pull` writes by default) and letting WebFactory read it from there means rotating the secret in production picks up here automatically — no copy/paste between repos. The placeholder line in `~/WebFactory/.env.local` and `~/WebFactory/.env` are for the rare case where the operator wants to override (e.g., testing against a preview-deploy storefront).

To populate (only needed if the storefront repo isn't cloned locally OR `vercel env pull` hasn't been run there):

```bash
# Easiest path — pull the storefront's production env if not already done.
# This writes WEBFACTORY_STORE_API_KEY (plus all other shared secrets) into
# the sibling file that register-with-store.mjs reads automatically.
cd ~/webfactory-store
vercel env pull .env.local --environment=production --scope tomek-group --yes
# Done — register-with-store.mjs picks it up next run.

# OR (only if you don't have the storefront repo locally):
echo "WEBFACTORY_STORE_API_KEY=<token>" >> /Users/tomasz/WebFactory/.env.local
```

The script's success log shows which file supplied the secret, so you can always trace where it came from:

```
✓ Loaded WEBFACTORY_STORE_API_KEY from /Users/tomasz/webfactory-store/.env.local
```

If missing from all four tiers, the script soft-fails (logs to feedback.md, does not block the pipeline).

---

#### Stage 10d: Sync the lead-funnel DB (mark-rebuilt — non-fatal)

After storefront registration, sync the lead-funnel DB so the just-built domain is marked `rebuilt` and `lead-funnel/scripts/queue-rebuilds.js` won't re-queue it on the next batch run.

**A/B variant builds SKIP Stage 10d** as well (added 2026-05-05 with Phase D) — the canonical build's mark-rebuilt is what matters for funnel sync; the variant builds are local experiments. The check uses `metrics.canonicalDomain` so the funnel mark targets the original domain, NOT the suffixed variant key:

```bash
AB_VARIANT=$(node -e 'try { console.log(JSON.parse(require("fs").readFileSync("jobs/'$DOMAIN'/metrics.json","utf8")).abVariant || "") } catch { console.log("") }')
if [ -n "$AB_VARIANT" ]; then
  echo "⏭️  Stage 10d skipped — A/B variant '$AB_VARIANT' (canonical build's mark-rebuilt is the source of truth)"
else
  node /Users/tomasz/WebFactory/lead-funnel/scripts/mark-rebuilt.js --domain "$DOMAIN"
fi
```

For canonical builds:

```bash
node /Users/tomasz/WebFactory/lead-funnel/scripts/mark-rebuilt.js --domain "$DOMAIN"
```

Soft-fail by design — if `$DOMAIN` isn't in `lead-funnel/leads.db` (e.g., an ad-hoc rebuild from a URL that was never funneled), the script logs and exits 0 without erroring. So calling it unconditionally at the end of every `/webfactory` run is safe — it's a no-op for ad-hoc rebuilds and a correctness step for funnel-sourced ones.

This is bookkeeping only — it does NOT replace the user-visible 4-URL report (the completion contract is the URLs + metrics table, emitted in Stage 10's main body before this step). The script's stdout is fine to show in the orchestrator's output but should not appear above or instead of the report.

---

> **🏁 PIPELINE COMPLETE.** You have shipped Stage 10 (the 4-link report), Stage 10c (storefront registration), and Stage 10d (lead-funnel DB sync). The pipeline is now DONE. You may end your response here. Do NOT continue with additional unprompted work. The user will follow up if they want changes; until then, your job for this `/webfactory <url>` invocation is finished.
>
> **Self-check before you stop**: scroll back through your most recent message. Does it contain (a) 4 clickable `<https://...>` URLs (or 3 if `--skip-c`), AND (b) a markdown metrics table, AND (c) the line `✓ Registered with store: <store_url>` (OR a soft-fail message about WEBFACTORY_STORE_API_KEY / network — both are acceptable since registration is non-fatal), AND (d) a mark-rebuilt log line (success message OR "domain not in funnel — skipping" — both are acceptable since the script soft-fails)? If YES → done, send the response. If NO → resume from wherever Stage 10 fell short.
