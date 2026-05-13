---
name: webfactory
description: Takes a website URL and builds three redesigned versions via Venice.ai API — faithful rebuild (Option A), conversion-tuned copy (Option B), and industry-anchored design (Option C). Deploys to Vercel. Runs fully unattended within a single Hermes session. Zero prompts. Zero sub-agents.
args: url
cost-tier: balanced
user_invocable: true
tags: [venice, webfactory, website-rebuild, astro, tailwind, vercel, hermes, unattended]
---

# WebFactory — Hermes-Native Website Rebuilder

This skill runs **entirely within a single Hermes session** using the original ClaudeWebFactory scripts (unchanged) for scraping and QA, plus Venice.ai API for all generation steps.

## 🔒 Permission Strategy (One-Time Setup)

Playwright runs **headless** (`headless: true`) — no visible window, no Screen Recording prompts.

**However**, macOS may still prompt for **Accessibility** or **Screen Recording** the first time headless Chromium runs. Run this ONCE in Terminal.app:

```bash
bash ~/VeniceWebFactory/scripts/setup-permissions.sh
# Grant Screen Recording + Accessibility to your terminal app
# Restart Terminal
python3 ~/VeniceWebFactory/scripts/verify-playwright.py
# Must print: "✓ Playwright working correctly!"
```

After that: zero prompts forever.

## Architecture

```
Orchestrator (Python) → Original scripts (Node) + Venice API (HTTP)
```

**What we kept from original** (unchanged, headless):
- `scrape.js` — Full multi-page scraper with image downloads
- `qa.cjs` — 4-viewport screenshot capture
- `qa-check.js` — 3,691-line deterministic QA gate
- `compress-screenshots.cjs` — PNG→JPEG compression
- `get-port.cjs` — Port allocation
- `cost-tracker.cjs` — Per-stage cost tracking

**What we replaced** (Claude → Venice):
- Design brief generation → Venice `/chat/completions`
- Per-page code generation → Venice `/chat/completions`
- Copy rewrite (Option B) → Venice `/chat/completions`
- Design language (Option C) → Venice `/chat/completions`
- Visual sanity pass → Venice `/chat/completions`
- World-class audit → Venice `/chat/completions`
- Fix loop → Venice `/chat/completions`

**What we improved**:
- **Unlimited pages** (original: 30-page limit)
- **No sub-agents** (original: used Claude Agent tool per page)
- **Deterministic models** (original: runtime discovery)
- **Single session** (original: multi-session with context loss)

## 🏁 The 10 Stages

## ⚠️ UNATTENDED EXECUTION CONTRACT

1. **Single-session execution** — the pipeline runs within THIS session. No `delegate_task`, no tmux, no spawned processes.
2. **Venice API for all generation** — every creative/synthesis/build step calls Venice `/chat/completions` directly.
3. **No permission dialogs mid-pipeline** — pre-flight check ensures permissions are granted before any work. If not → abort.
4. **Pre-authorized operations** — Vercel token must be pre-configured. No login prompts.
5. **File operations only** — use `write_file`, `patch`, `terminal` for deterministic operations.
6. **Headless Playwright** — screenshots only, no visible browser, no persistent context.

## 🏁 The 10 Stages (Single Session)

```
1. Scrape      → web_extract + curl → manifest.json (+ Playwright screenshots of original)
2. Brief       → Venice /chat/completions → design-brief.json
3. Build A     → Venice /chat/completions (page by page) → option-a/src/
4. QA A        → Playwright screenshots at 4 viewports + console error detection
5. Build B     → Venice /chat/completions (copy rewrite) → option-b/src/
6. QA B        → Fact preservation check + deterministic validation
7. Build C     → Venice /chat/completions (design language) → option-c/src/
8. Deploy      → npx astro build && npx vercel deploy --yes --prebuilt
9. Verify      → curl deployed URLs for HTTP 200 + title check
10. Report     → Emit clickable URLs + metrics
```

## 🔧 Architecture

### How This Is Different From ClaudeWebFactory

| Aspect | ClaudeWebFactory (V1) | WebFactory Hermes (V2) |
|--------|----------------------|------------------------|
| Runtime | Claude Code CLI + Agent tool | Single Hermes Discord/CLI session |
| Scraping | Playwright (macOS prompts) | `web_extract` + curl (no prompts for scraping) |
| Code gen | Claude Opus/Sonnet local | Venice API `/chat/completions` |
| Sub-agents | Yes (per-page dispatch) | **No** — single session loops |
| Permissions | Live Chromium window triggers prompts | **Headless Playwright** — pre-flight check + headless screenshots, no prompts |
| Build | Local Astro dev server | `npx astro build` (one-shot) |
| Deploy | Vercel CLI interactive | `npx vercel deploy --yes --prebuilt` |
| Design | Claude frontend-design plugin | Venice image-gen + Refero (if available) |
| Visual QA | Playwright 4-viewport screenshots | **Same** Playwright 4-viewport screenshots (restored) |

### Why No Sub-Agents?

`delegate_task` in Hermes:
- Runs in isolated context with **no access to parent memory**
- Cannot share file state (the parent and child don't share a filesystem view)
- Adds complexity and failure modes
- **Not needed** — a single Hermes session can execute 90+ turns

Instead: **sequential execution with loops**. Generate all pages in a loop, write them one by one.

## 🚀 Execution Flow

### Single Session, Zero Prompts

The entire pipeline runs within one Hermes session using loops, not sub-agents. See `references/original-scripts-are-headless.md` for the full rationale on why the original scripts must be kept unchanged.

### Stage 1: Scrape (Original scrape.js — Headless, Multi-Page, Image Download)

**DO NOT replace with curl/regex.** The original `scrape.js` (788 lines) already runs headless and extracts:
- Structured sections (hero, content) with full HTML
- Images with dimensions, alt text, background-images
- Video embeds (YouTube, Vimeo, Brightcove, JW, Vidyard, Wistia, Loom)
- Video CTA links
- Forms with field details
- Navigation structure
- Downloads images to `jobs/{domain}/assets/img/`

```bash
# Run the ORIGINAL script unchanged
cd ~/VeniceWebFactory && node scripts/scrape.js <url>
```

**Pitfall:** Replacing `scrape.js` with `curl + regex` loses section structure, image downloads, video detection, form extraction, and multi-page crawling. This was attempted in an earlier version and caused massive quality degradation. **Keep the original script.**

See `references/original-scripts-are-headless.md` for the full rationale.

### Stage 2: Brief (Venice API)

```python
# Call Venice /chat/completions with design-brief prompt
# Read manifest.json as input
# Write design-brief.json as output

# Use the best Venice model for reasoning (from config)
model = get_model_for_stage("brief", tier)
response = call_venice_chat(
    model=model,
    messages=[
        {"role": "system", "content": "You are a design analyst..."},
        {"role": "user", "content": f"Analyze this site and create a design brief:\n{manifest}"}
    ],
    temperature=0.3,
    max_completion_tokens=32000
)
brief = json.loads(response)
write_file("jobs/{domain}/design-brief.json", json.dumps(brief, indent=2))
```

### Stage 3: Build Option A (Loop, Not Dispatch)

```python
# For each page, call Venice API sequentially
for page in manifest["pages"]:
    # Call Venice API for this page's code
    response = call_venice_chat(
        model=get_model_for_stage("perPageA", tier),
        messages=[
            {"role": "system", "content": "Generate Astro 5 + Tailwind v4 code..."},
            {"role": "user", "content": f"Build {page['name']}:\n{page['content']}\nDesign brief: {brief}"}
        ],
        temperature=0.2,
        max_completion_tokens=32000
    )
    
    # Extract code from response
    code = extract_code(response)
    write_file(f"jobs/{domain}/option-a/src/pages/{page['path']}", code)
```

### Stage 4: QA A (Full Visual QA with Playwright)

```bash
# Run Playwright at 4 viewports: mobile, iPad, desktop, desktop-wide
# Pre-flight check ensures permissions are granted before pipeline starts
node scripts/qa.cjs jobs/{domain}/option-a
# Checks: HTML validity, CSS classes exist, links work, images present
# PLUS: Screenshots at 4 viewports, console error detection, broken image detection
```

**Full Playwright visual QA restored.** Same quality as original. Pre-flight check guarantees no permission prompts during execution.

### Stage 5-7: Build B and C (Same Pattern)

Same as Stage 3 — Venice API calls in a loop.

### Stage 8: Deploy (Pre-authorized)

```bash
# Pre-configured Vercel token must exist
cd jobs/{domain}/option-a && npx astro build
cd jobs/{domain}/option-a && npx vercel deploy --prebuilt --yes --scope tomek-group
# --yes flag prevents ALL interactive prompts
```

**Vercel must be pre-linked:** `npx vercel link --scope tomek-group --yes` was run once during setup.

### Stage 9: Verify

```python
# Fetch each deployed URL
for url in deploy_urls:
    result = web_extract([url])
    assert result.status == 200
    assert "<title>" in result.content
```

### Stage 10: Report

```python
# Emit final message with 4 URLs
message = f"""
## WebFactory Results for {domain}

1. **Option A**: <{urls['a']}>
2. **Option B**: <{urls['b']}>
3. **Option C**: <{urls['c']}>
4. **Comparison**: <{urls['vs']}>

### Metrics
| Metric | Value |
|---|---|
| Total Cost | ${cost} |
| Model Tier | {tier} |
"""
print(message)
```

## 📋 Prerequisites (One-Time Setup)

Before running WebFactory unattended, configure these once:

### 1. Vercel Pre-authorization

```bash
# Run once in terminal (NOT during pipeline)
npx vercel login  # or use token
npx vercel link --scope tomek-group --yes
# Creates .vercel/project.json with orgId for the team
```

### 2. Venice API Key

```bash
# In ~/.hermes/.env
VENICE_API_KEY=your-key
```

### 3. Playwright Permissions (One-Time)

```bash
# Run once in Terminal.app (NOT Discord) to grant permissions
bash ~/VeniceWebFactory/scripts/setup-permissions.sh
# Grant Screen Recording to your terminal app
# Restart Terminal
python3 ~/VeniceWebFactory/scripts/verify-playwright.py
# Must print "✓ Playwright working correctly!" before pipeline works
```

**Why:** Playwright headless screenshots of built output at 4 viewports. One-time grant, then zero prompts forever.

### 4. Project Scaffold

```bash
# Pre-download Astro scaffold (no npm install during pipeline)
cd ~/VeniceWebFactory/templates/astro-scaffold && npm install
```

## 🎨 Design Without Claude Plugin

Since we don't have Claude frontend-design plugin in Hermes:

### Option 1: Venice Image Generation
```python
# Generate hero images via Venice API
# POST /image/generate
# Use in place of Claude plugin's design generation
```

### Option 2: Refero Skill (if available)
```python
# If ~/.claude/skills/refero-design/ exists, read it
# Otherwise, use templates/inspiration/refero-styles/
```

### Option 3: Manual Design System
Use a curated design system from `templates/design-systems/`:
- `modern-minimal/` — clean, whitespace-heavy
- `dark-technical/` — dark mode, monospace
- `warm-approachable/` — earth tones, rounded

Selected based on industry classification from Stage 2.

## 💰 Cost Tracking (Per Job)

Track in `jobs/{domain}/metrics.json`:

```json
{
  "cost": {
    "currency": "USD",
    "total": 2.34,
    "perStage": {
      "brief": {"model": "qwen-3-6-plus", "tokens": 45000, "cost": 0.89}
    }
  }
}
```

## ⚠️ What NOT To Do

| Don't | Why |
|-------|-----|
| **Replace scrape.js/qa-check.js/qa.cjs with custom code** | The original scripts are 10,000+ lines of battle-tested code. Replacing them with curl/regex or simplified versions causes massive quality degradation. **Keep originals unchanged.** |
| `delegate_task` | Adds complexity, isolation breaks context |
| `tmux` + background Hermes | Not needed, harder to debug |
| Playwright without pre-flight | May trigger permission dialogs mid-pipeline → user can't click them from Discord |
| Live browser window during QA | Triggers macOS permission prompts — use `headless: true` |
| `preview_start` / Chrome MCP | Creates `.claude/` dirs, shows windows |
| `npx vercel deploy` without `--yes` | Prompts for project linking |
| `npm install` during pipeline | Slow, unpredictable, may prompt |
| Any operation requiring human click | Breaks unattended contract |

## ✅ What TO Do

| Do | How |
|----|-----|
| Use Venice API for generation | `POST /chat/completions` with model from config |
| Use `web_extract` for scraping | No permissions, fast, reliable |
| Pre-flight Playwright check | Run `verify-playwright.py` before any work |
| Headless Playwright for QA | `chromium.launch({ headless: true })` — screenshots only |
| Pre-install dependencies | `npm install` in scaffold template once |
| Pre-authorize Vercel | `vercel link --yes` during setup |
| Write files directly | `write_file` tool or `fs.writeFileSync` |
| Use `--yes` flags | Every CLI command that might prompt |
| Sequential loops | `for page in pages: generate(); write()` |
| Full visual QA with Playwright | 4 viewports, console errors, broken images — same as original |

## 🛠️ Troubleshooting

### "macOS permission dialog appeared during Discord run"
**What happened:** Playwright was used WITHOUT the pre-flight check, or the pre-flight was skipped with `--skip-preflight`.
**Fix:** The pre-flight should have caught this. Never use `--skip-preflight` in production. If it still happens, run setup script once.
**Prevention:** The pre-flight `verify-playwright.py` runs before ANY work. If it fails, pipeline aborts immediately.

### "Pre-flight failed but I granted permissions"
**Fix:** After granting Screen Recording, you MUST restart Terminal completely. macOS caches permission state per-process.

### "Vercel prompts for login"
**Fix:** Run `npx vercel login` and `npx vercel link --scope tomek-group --yes` once.

### "npm command not found"
**Fix:** Ensure Node.js is installed. Pre-install in scaffold.

### "macOS blocked execution"
**Fix:** You triggered a permission dialog. Review Stage 1-8 and remove the operation that caused it. Common culprits: Playwright, persistent browser contexts, unsigned binaries.

### "Token limit exceeded"
**Fix:** Use Venice models with larger context (GPT-5.5 1M, Qwen 3.6 Plus 1M) or compress manifest before sending.

## 🚀 Execution

### From Hermes CLI or Discord:
```
/webfactory https://example.com --tier=balanced
```

This executes the Python runner in a single session:
```bash
cd ~/VeniceWebFactory && python3 scripts/webfactory.py https://example.com --tier=balanced
```

### Runner Script
```
~/VeniceWebFactory/scripts/webfactory.py
```

Pure Python, no sub-agents, calls Venice API directly.

### Setup (One-Time)
```bash
cd ~/VeniceWebFactory && python3 scripts/setup-webfactory.py
```

Validates: Venice API key ✓, Vercel auth ✓, scaffold installed ✓
## 🔮 Future Enhancements (Phase 2+)

1. **Adaptive model selection** — choose model based on site complexity
2. **Image compression** — reduce token usage by compressing images before API calls
3. **Local inference** — run small models locally for mechanical stages
4. **A/B testing** — benchmark quality across model tiers
5. **Component library** — reusable Astro components
6. **Video generation** — use Venice video API for hero backgrounds

---

## References

- `references/original-scripts-are-headless.md` — Why replacing original scripts with curl/regex destroys quality
- `references/venice-parameters.md` — Venice API parameters (temperature, reasoning_effort, etc.)
- `references/pipeline-contract.md` — Unattended execution contract details

**Version:** 2.1.0  
**Hermes-native:** Yes  
**Sub-agents:** None  
**Permission prompts:** Zero (after one-time setup)  
**Unattended:** Guaranteed  
**Runner:** `~/VeniceWebFactory/scripts/webfactory.py`  
**Vision API:** `qwen3-vl-235b-a22b` for screenshot analysis  
**Refero Integration:** Local anti-ai-slop.md + craft-details.md loaded into world-class audit
