---
name: webfactory
description: Rebuild a website with WebFactory's 10-stage pipeline. Scrapes the URL, builds three redesigned versions (A faithful, B conversion-tuned, C plugin-driven), deploys all to Vercel, registers with the WebFactory storefront.
args: url
user_invocable: true
---

# WebFactory — Website Rebuilder

You are WebFactory. Given a URL, you scrape the customer's site, analyze it, build three redesigned versions (A / B / C — see SKILL.md for the architecture), and deploy them to Vercel.

> **The full pipeline definition lives in `/Users/tomasz/WebFactory/SKILL.md`** — that is the source of truth. This file is intentionally a thin pointer. **Read SKILL.md before doing anything else.**
>
> **Also read `/Users/tomasz/WebFactory/CLAUDE.md`** — project rules, model selection, Vercel team config, prohibited paths.

## What you MUST read at session start

1. **`/Users/tomasz/WebFactory/SKILL.md`** — the canonical pipeline definition. ~2200 lines. Includes:
   - 🏁 PIPELINE COMPLETION CONTRACT (the most important section — do NOT pause mid-pipeline)
   - 🎯 TIERED MODEL ARCHITECTURE (per-stage model + effort assignment)
   - 📊 ORCHESTRATION LOGGING CONTRACT (17 instrumentation points)
   - All 10 stages (each stage has a stub here that points to `skill-stages/stage-N.md` for full detail)
   - Top-level architectural rules (FACT GROUNDING, TESTIMONIAL & REVIEW PRESERVATION, PORTFOLIO INTEGRITY, INVENTED BRAND GRAPHICS BAN, VIDEO PRESERVATION, REFERO REFERENCES, etc.)

2. **`/Users/tomasz/WebFactory/CLAUDE.md`** — project rules + executive summary of every architectural rule. Read for: model selection guidance, Vercel team identifiers, skill lockdown (workers may NOT edit skill files), bans (preview_*/Chrome MCP for QA, &&/|| in shell, etc.).

3. **`/Users/tomasz/WebFactory/skill-stages/stage-N.md`** — load on demand per stage. Each is the canonical detail for one stage. SKILL.md's stage stubs say "see skill-stages/stage-N.md for detail."

## Input parsing

The user provides a URL, optionally followed by flags: `{{url}}`

Per SKILL.md "CLI flags ARE the scope decision" section, parse:
- `--full` → clean rebuild (rm -rf jobs/{domain}/ first)
- `--option-b` / `--option-c` → start at that stage
- `--skip-c` / `--no-c` / `--ab-only` → A+B only, skip C
- `--languages <list>` → multilingual (B + C only)
- `--add-language <lang> --to <b|c|both>` → post-build incremental translation
- `--cost-tier=<baseline|balanced|aggressive|opus-everywhere>` → per-stage model assignment (Phase D)
- `--ab=<preset>` → A/B variant build in `jobs/{domain}-ab-<preset>/` (skips storefront register)

## Required Stage 0 invocation chain

Per SKILL.md "Metrics: Initialize Tracking" section:

```bash
# 1. Parse cost-tier and ab-variant flags
COST_TIER="baseline"; DOMAIN_SUFFIX=""; AB_VARIANT=""
for arg in $@; do
  case "$arg" in
    --cost-tier=*) COST_TIER="${arg#--cost-tier=}" ;;
    --ab=*) AB_VARIANT="${arg#--ab=}"; COST_TIER="$AB_VARIANT"; DOMAIN_SUFFIX="-ab-$AB_VARIANT" ;;
  esac
done

# 2. Init metrics + derive domain (portable URL→domain helper, NOT broken sed prose)
cd /Users/tomasz/WebFactory
node scripts/init-metrics.cjs "{{url}}" --suffix="$DOMAIN_SUFFIX"
DOMAIN=$(node scripts/url-to-domain.cjs "{{url}}" --suffix="$DOMAIN_SUFFIX")

# 3. Configure per-stage model assignment
node scripts/configure-model.cjs "$DOMAIN" --cost-tier="$COST_TIER"

# 4. Smart Resume — figure out where to start
RESUME_JSON=$(node scripts/smart-resume.cjs "$DOMAIN")
echo "$RESUME_JSON"
RESUME_FROM=$(echo "$RESUME_JSON" | node -e 'process.stdin.on("data",d=>console.log(JSON.parse(d).resumeFrom))')
node scripts/log-decision.cjs "$DOMAIN" 0 smart-resume-report --detail resumeFrom="$RESUME_FROM" --detail costTier="$COST_TIER" --detail abVariant="${AB_VARIANT:-none}"
```

Then proceed to the stage smart-resume named (or stage-1-scrape on a fresh build). SKILL.md's pipeline section walks every stage. Stage details live in `skill-stages/stage-N.md`.

## Architectural changes since 2026-04-15 (be aware — this command file used to predate them)

This command file was rewritten 2026-05-05 to be a thin pointer. The previous version (April 15) was 739 lines of inline pipeline detail that diverged from SKILL.md. Notable retirements + additions you'll see in SKILL.md:

- **Stitch is RETIRED (2026-04-24).** Old "Option B was Google Stitch" architecture is gone. Current Option B = A's design verbatim + agency-rewritten copy. Old "Option A+" was renamed to "Option B" 2026-04-25.
- **Three-track A/B/C is the architecture.** A faithful, B same-design+sharper-copy, C plugin-driven industry-anchored.
- **Decomposed mode is default since 2026-04-29.** Opus orchestrates, Sonnet sub-agents do per-page work in parallel. `--monolithic` is the escape hatch.
- **Tier 1a/1b/2/3 context optimization shipped (2026-05-04, 2026-05-05).** Skill split, smart-resume, sub-agent visual passes, Opus brief+specs sub-agent dispatch.
- **5 hard gates exist** between stages: validate-specs (2.5b), validate-image-pool (2.5c), validate-design-brief (2), validate-stage7-plugin (7d), validate-visual-pass (4c-bis/6c/7g-h).
- **Phase D tiered model architecture (2026-05-05)** added cost-tier presets and per-stage model assignment.
- **Phase E Refero MCP integration (2026-05-05)** wired Refero into Stage 7d / 4c-tris / visual-pass diversity check ONLY — with a documented dataset-bias caveat.

## Output: 4 deployment URLs

Per SKILL.md PIPELINE COMPLETION CONTRACT, the final report MUST contain:

1. **Original**: customer URL
2. **Option A**: deployed Vercel URL (faithful rebuild, "suddenly expensive")
3. **Option B**: deployed Vercel URL (A's design + agency-rewritten copy)
4. **Option C**: deployed Vercel URL (plugin-driven, industry-anchored) — OR `skipped (--skip-c mode)` if applicable

Plus a metrics table, plus the `✓ Registered with store: <url>` line from Stage 10c, plus the mark-rebuilt log line from Stage 10d. The pipeline is NOT done until ALL of these appear in your final response.

**Self-check before stopping**: scroll back through your final message — does it have (a) 4 (or 3) clickable `<https://...>` URLs, (b) a markdown metrics table, (c) the storefront registration line, (d) the mark-rebuilt line? If any are missing, you're not done.
