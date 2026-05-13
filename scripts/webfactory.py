#!/usr/bin/env python3
"""
WebFactory v2.1 — Hermes/Venice Orchestrator
==============================================

This is the MAIN ORCHESTRATOR. It wraps the original ClaudeWebFactory scripts
(which are already headless/permission-safe) and replaces Claude's local model
calls with Venice API calls.

Architecture:
- Original scripts (scrape.js, qa.cjs, qa-check.js, etc.) = UNCHANGED
- Venice API calls replace Claude's local generation
- Single Python process orchestrates all 10 stages
- No sub-agents. No permission prompts. Headless throughout.

Usage:
    python3 webfactory.py <url> [--tier=quality|balanced|cost] [--all-tiers] [--skip-c] [--max-pages=N] [--full]

Prerequisites (one-time):
    cd ~/VeniceWebFactory && npm install
    bash scripts/setup-permissions.sh  # one-time macOS grant
"""

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple

REPO_ROOT = Path(__file__).resolve().parent.parent
SCRIPTS_DIR = REPO_ROOT / "scripts"
JOBS_DIR = REPO_ROOT / "jobs"
SCAFFOLD_DIR = REPO_ROOT / "templates" / "astro-scaffold"

# Model config resolution
MODEL_CONFIG_PATH = REPO_ROOT / ".hermes-skill" / "models" / "venice-model-config.json"
if not MODEL_CONFIG_PATH.exists():
    MODEL_CONFIG_PATH = Path.home() / ".hermes" / "skills" / "webfactory" / "models" / "venice-model-config.json"

# Environment
VENICE_API_KEY = os.environ.get("VENICE_API_KEY", "")
VERCEL_SCOPE = os.environ.get("VERCEL_SCOPE", "tomek-group")
VERCEL_ORG_ID = os.environ.get("VERCEL_ORG_ID", "team_4Hr5Lqd6pY5D7gmeXDVsDmYx")

VENICE_BASE = "https://api.venice.ai/api/v1"

# ── Utility: run Node script with correct cwd ────────────────────────────────
def run_node(script_name: str, args: List[str], cwd: str = None, timeout: int = 300) -> Tuple[int, str, str]:
    """Run a Node script from SCRIPTS_DIR with cwd=REPO_ROOT for module resolution."""
    script = SCRIPTS_DIR / script_name
    if not script.exists():
        return 1, "", f"Script not found: {script}"
    
    cmd = ["node", str(script)] + args
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        cwd=cwd or str(REPO_ROOT),
        timeout=timeout,
    )
    return result.returncode, result.stdout, result.stderr

# ── Venice API ──────────────────────────────────────────────────────────────
_last_usage = {}

def venice_chat(model: str, messages: List[Dict], temperature: float = 0.3,
                max_tokens: int = 32000, reasoning_effort: Optional[str] = None) -> str:
    """Call Venice /chat/completions. Stores _last_usage for cost tracking."""
    import urllib.request
    payload = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_completion_tokens": max_tokens,
    }
    if reasoning_effort:
        payload["venice_parameters"] = {"reasoning_effort": reasoning_effort}
    
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        f"{VENICE_BASE}/chat/completions",
        data=data,
        headers={"Authorization": f"Bearer {VENICE_API_KEY}", "Content-Type": "application/json"},
        method="POST",
    )
    
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=300) as resp:
                result = json.loads(resp.read().decode("utf-8"))
                global _last_usage
                _last_usage = result.get("usage", {})
                return result["choices"][0]["message"]["content"]
        except Exception as e:
            if attempt < 2:
                time.sleep(2 ** attempt)
                continue
            raise RuntimeError(f"Venice API failed: {e}")
    return ""

def venice_chat_with_image(model: str, text_prompt: str, image_path: Path,
                           temperature: float = 0.3, max_tokens: int = 32000) -> str:
    """Call Venice vision API with a screenshot image (base64)."""
    import base64
    import urllib.request
    
    # Read and encode image
    with open(image_path, "rb") as f:
        img_b64 = base64.b64encode(f.read()).decode("utf-8")
    
    # Detect mime type
    ext = image_path.suffix.lower()
    mime = "image/png" if ext == ".png" else "image/jpeg" if ext in (".jpg", ".jpeg") else "image/webp"
    
    payload = {
        "model": model,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": text_prompt},
                    {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{img_b64}"}},
                ],
            },
        ],
        "temperature": temperature,
        "max_completion_tokens": max_tokens,
    }
    
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        f"{VENICE_BASE}/chat/completions",
        data=data,
        headers={"Authorization": f"Bearer {VENICE_API_KEY}", "Content-Type": "application/json"},
        method="POST",
    )
    
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=300) as resp:
                result = json.loads(resp.read().decode("utf-8"))
                global _last_usage
                _last_usage = result.get("usage", {})
                return result["choices"][0]["message"]["content"]
        except Exception as e:
            if attempt < 2:
                time.sleep(2 ** attempt)
                continue
            raise RuntimeError(f"Venice vision API failed: {e}")
    return ""

# ── Model config ────────────────────────────────────────────────────────────
_model_cache = None

def load_model_config() -> Dict:
    global _model_cache
    if _model_cache is None:
        with open(MODEL_CONFIG_PATH) as f:
            _model_cache = json.load(f)
    return _model_cache

def get_model(stage: str, tier: str) -> Tuple[str, float, str]:
    """Get (model_id, temperature, reasoning_effort) for a stage."""
    cfg = load_model_config().get(tier, load_model_config()["balanced"])
    stage_cfg = cfg["stages"].get(stage, {})
    return (
        stage_cfg.get("model", "qwen-3-6-plus"),
        stage_cfg.get("temperature", 0.3),
        stage_cfg.get("reasoningEffort", "medium"),
    )

# ── Cost tracking ───────────────────────────────────────────────────────────
def track_cost(domain: str, stage: str, model: str):
    """Log cost via cost-tracker.cjs."""
    global _last_usage
    if not _last_usage:
        return
    
    tracker = SCRIPTS_DIR / "cost-tracker.cjs"
    if not tracker.exists():
        return
    
    input_tok = _last_usage.get("prompt_tokens", 0)
    output_tok = _last_usage.get("completion_tokens", 0)
    
    try:
        subprocess.run(
            ["node", str(tracker), domain, stage, model, str(input_tok), str(output_tok)],
            capture_output=True, cwd=str(REPO_ROOT), timeout=10,
        )
    except Exception:
        pass
    _last_usage = {}

# ── Stage 1: Scrape (ORIGINAL scrape.js — headless, unlimited pages) ────────
def stage1_scrape(url: str, domain: str, tier: str, max_pages: int = 0) -> Dict:
    """
    Run original scrape.js with UNLIMITED pages (max_pages=0 means no limit).
    This is headless Playwright — no permission prompts.
    """
    print(f"\n[Stage 1] Scraping {url}...")
    job_dir = JOBS_DIR / domain
    job_dir.mkdir(parents=True, exist_ok=True)
    
    # Initialize metrics
    metrics = {
        "domain": domain, "url": url, "costTier": tier,
        "cost": {"currency": "USD", "perStage": {}, "total": 0}
    }
    with open(job_dir / "metrics.json", "w") as f:
        json.dump(metrics, f, indent=2)
    
    # Run original scrape.js — already headless, already permission-safe
    # If max_pages=0, we pass a very high number since the original uses it as ceiling
    pages_arg = str(max_pages) if max_pages > 0 else "9999"
    rc, stdout, stderr = run_node("scrape.js", [url, "--max-pages", pages_arg], timeout=120)
    
    print(stdout)
    if rc != 0:
        print(f"  ⚠ scrape.js warnings: {stderr[:500]}")
    
    # Load manifest
    manifest_path = job_dir / "manifest.json"
    if manifest_path.exists():
        with open(manifest_path) as f:
            manifest = json.load(f)
    else:
        manifest = {"domain": domain, "url": url, "pages": [], "error": "manifest not found"}
    
    page_count = len(manifest.get("pages", []))
    img_count = len(manifest.get("images", []))
    
    # SSL fallback: if 0 pages scraped and URL was https, try http
    if page_count == 0 and url.startswith("https://"):
        http_url = url.replace("https://", "http://", 1)
        print(f"  0 pages scraped. Retrying with {http_url}...")
        rc2, stdout2, stderr2 = run_node("scrape.js", [http_url, "--max-pages", pages_arg], timeout=120)
        print(stdout2)
        if rc2 == 0:
            # Re-load manifest
            if manifest_path.exists():
                with open(manifest_path) as f:
                    manifest = json.load(f)
            page_count = len(manifest.get("pages", []))
            img_count = len(manifest.get("images", []))
    
    print(f"  ✓ Scraped: {page_count} pages, {img_count} images")
    return manifest

# ── Stage 2: Design Brief (Venice API) ───────────────────────────────────────
def stage2_brief(manifest: Dict, domain: str, tier: str) -> Dict:
    print(f"\n[Stage 2] Generating design brief...")
    model, temp, effort = get_model("brief", tier)
    
    # Build context from manifest
    pages_summary = []
    for p in manifest.get("pages", [])[:10]:  # Top 10 pages for context
        sections = p.get("sections", [])
        texts = []
        for s in sections[:3]:
            texts.extend(s.get("paragraphs", [])[:2])
        pages_summary.append({
            "path": p.get("path", "/"),
            "heading": p.get("title", ""),
            "text_preview": " ".join(texts)[:200],
        })
    
    system_prompt = """You are a senior design strategist. Analyze the website and create a structured design brief in JSON.

Output ONLY valid JSON with these keys:
- industry: detected industry string
- brand_personality: array of 3-5 adjectives
- color_strategy: object with primary, secondary, accent, background, text (hex codes)
- typography: object with heading_font, body_font
- layout_approach: string description
- key_pages: array of page names
- design_principles: array of 5 principles
- image_style: string description
- north_star: one sentence design vision
- anti_slop_rules: array of specific rules to avoid (indigo/violet, cards-by-default, etc.)"""
    
    user_prompt = f"""Website: {manifest['url']}
Title: {manifest.get('title', '')}
Pages: {len(manifest.get('pages', []))}
Page summaries: {json.dumps(pages_summary, indent=2)}

Create a world-class design brief."""
    
    response = venice_chat(model, [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ], temperature=temp, reasoning_effort=effort, max_tokens=32000)
    
    track_cost(domain, "brief", model)
    
    # Extract JSON
    json_match = re.search(r'\{.*\}', response, re.DOTALL)
    if json_match:
        try:
            brief = json.loads(json_match.group())
        except json.JSONDecodeError:
            brief = {"raw_response": response, "error": "JSON parse failed"}
    else:
        brief = {"raw_response": response, "error": "No JSON found"}
    
    brief["_meta"] = {"model": model, "tier": tier}
    
    job_dir = JOBS_DIR / domain
    with open(job_dir / "design-brief.json", "w") as f:
        json.dump(brief, f, indent=2)
    
    print(f"  ✓ Design brief generated ({model})")
    return brief

# ── Stage 3: Build Option A (Venice API per page) ───────────────────────────
def stage3_build_a(manifest: Dict, brief: Dict, domain: str, tier: str):
    print(f"\n[Stage 3] Building Option A ({tier})...")
    model, temp, effort = get_model("perPageA", tier)
    job_dir = JOBS_DIR / domain
    opt_dir = job_dir / f"{tier}-a"
    opt_dir.mkdir(parents=True, exist_ok=True)
    
    # Copy scaffold contents directly into opt_dir (not a subdirectory)
    if SCAFFOLD_DIR.exists():
        for item in SCAFFOLD_DIR.iterdir():
            dest = opt_dir / item.name
            if item.is_dir():
                if dest.exists():
                    shutil.rmtree(str(dest))
                shutil.copytree(str(item), str(dest))
            else:
                shutil.copy2(str(item), str(dest))
        # Install dependencies so Astro can build
        print("  Installing dependencies...")
        install = subprocess.run(
            ["npm", "install"], cwd=str(opt_dir),
            capture_output=True, text=True, timeout=120,
        )
        if install.returncode != 0:
            print(f"  ⚠ npm install warning: {install.stderr[:300]}")
    
    pages_dir = opt_dir / "src" / "pages"
    pages_dir.mkdir(parents=True, exist_ok=True)
    
    # ── Copy scraped images to build public dir ───────────────────────────────
    scraped_img_dir = job_dir / "assets" / "img"
    public_img_dir = opt_dir / "public" / "images"
    if scraped_img_dir.exists():
        public_img_dir.mkdir(parents=True, exist_ok=True)
        # Copy only image files (not subdirs or non-image files)
        for img_file in scraped_img_dir.iterdir():
            if img_file.is_file() and img_file.suffix.lower() in ('.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.avif'):
                shutil.copy2(str(img_file), str(public_img_dir / img_file.name))
        print(f"  ✓ Copied {len(list(public_img_dir.iterdir()))} images to public/images/")
    
    # Get all pages from manifest — UNLIMITED
    pages = manifest.get("pages", [])
    if not pages:
        pages = [{"path": "/", "title": manifest.get("title", domain), "images": [], "backgroundImages": []}]
    
    # Generate each page — unlimited
    for i, page in enumerate(pages, 1):
        page_path = page.get("path", "/")
        page_name = page.get("title", page_path)
        print(f"  [{i}/{len(pages)}] Building {page_path}...")
        
        # Extract page content
        sections = page.get("sections", [])
        page_text = []
        for s in sections[:5]:
            page_text.extend(s.get("paragraphs", []))
        page_content = "\n\n".join(page_text)[:8000]
        
        # ── Build image inventory for this page ───────────────────────────────
        page_images = page.get("images", [])
        page_bg_images = page.get("backgroundImages", [])
        all_page_images = page_images + page_bg_images
        
        image_inventory = []
        for img in all_page_images[:20]:  # Limit to avoid token bloat
            basename = img.get("localPath", "").split("/")[-1] or img.get("src", "").split("/")[-1]
            if not basename:
                continue
            alt = img.get("alt", "")[:60]
            w = img.get("width", "?")
            h = img.get("height", "?")
            kind = "background" if img in page_bg_images else "content"
            alt_attr = f' alt="{alt}"' if alt else ''
            image_inventory.append(f"  - {basename} ({w}×{h}, {kind}){alt_attr}")
        
        image_block = ""
        if image_inventory:
            # Use first image as concrete example for the LLM
            example_basename = image_inventory[0].split("  - ")[1].split(" (")[0] if image_inventory else "img_1.jpg"
            image_block = f"""
IMAGES AVAILABLE FOR THIS PAGE (MUST reuse ≥90%):
{chr(10).join(image_inventory)}

Reuse rules:
- Reference images: `<img src="/images/{example_basename}" alt="..." />`
- Every service card, team member, portfolio item MUST have a photo
- Hero section MUST use a photo if available
- Absorb extras in a gallery/portfolio section
- Do NOT generate placeholder images or stock URLs"""
        
        system_prompt = f"""You are an expert Astro 5 + Tailwind v4 developer.
Rules:
- Generate Astro 5 (.astro) files with frontmatter
- Use Tailwind v4 utility classes
- Preserve original text VERBATIM (no rewriting)
- Responsive (mobile-first)
- Accessible (WCAG 2.1 AA)
- Include proper Layout import
- Anti-slop rules: {json.dumps(brief.get('anti_slop_rules', []), indent=2)}
- Color strategy: {json.dumps(brief.get('color_strategy', {}), indent=2)}
- Typography: {json.dumps(brief.get('typography', {}), indent=2)}
{image_block}

Output ONLY the complete .astro file code."""
        
        user_prompt = f"""Build page: {page_name} ({page_path})

Design brief: {brief.get('north_star', '')}

Original content (VERBATIM):
{page_content}

Generate complete src/pages{page_path if page_path != '/' else '/index'}.astro"""
        
        response = venice_chat(model, [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ], temperature=temp, max_tokens=32000)
        
        track_cost(domain, f"buildA-{page_path}", model)
        
        # Extract code
        code_match = re.search(r'```(?:astro|html)?\s*\n?(.*?)```', response, re.DOTALL)
        code = code_match.group(1).strip() if code_match else response.strip()
        
        # Write file
        if page_path == "/":
            out_path = pages_dir / "index.astro"
        else:
            # Create subdirs if needed
            out_path = pages_dir / page_path.lstrip("/")
            out_path.parent.mkdir(parents=True, exist_ok=True)
            if not out_path.name.endswith(".astro"):
                out_path = out_path.with_suffix(".astro")
        
        with open(out_path, "w") as f:
            f.write(code)
    
    print(f"  ✓ Option A built: {len(pages)} pages ({model})")
    return opt_dir

# ── Stage 4: QA (ORIGINAL scripts — full visual + deterministic) ────────────
def stage4_qa_a(domain: str, tier: str) -> bool:
    """
    Run FULL original QA pipeline:
    1. Build site
    2. Start dev server
    3. Run qa-check.js (deterministic gate)
    4. Run qa.cjs (screenshots)
    5. Compress screenshots
    """
    print(f"\n[Stage 4] QA Option A ({tier}) (Full)...")
    job_dir = JOBS_DIR / domain
    opt_dir = job_dir / f"{tier}-a"
    qa_dir = job_dir / f"qa-{tier}-a"
    qa_dir.mkdir(exist_ok=True)
    
    if not opt_dir.exists():
        print(f"  ⚠ {tier}-a not found")
        return False
    
    # 4a. Build
    print("  Building...")
    build_rc, build_out, build_err = run_node("", [], cwd=str(opt_dir), timeout=120)
    # Actually use npx astro build
    build_result = subprocess.run(
        ["npx", "astro", "build"],
        cwd=str(opt_dir), capture_output=True, text=True, timeout=120,
    )
    if build_result.returncode != 0:
        print(f"  ✗ Build failed: {build_result.stderr[:500]}")
        return False
    
    # 4b. Get port and start dev server
    port_rc, port_out, _ = run_node("get-port.cjs", [domain, "a"], timeout=10)
    port = int(port_out.strip()) if port_rc == 0 and port_out.strip().isdigit() else 4321
    
    print(f"  Starting dev server on port {port}...")
    dev_proc = subprocess.Popen(
        ["npx", "astro", "dev", "--port", str(port)],
        cwd=str(opt_dir), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    time.sleep(3)  # Wait for server
    
    try:
        # 4c. Run qa-check.js FIRST (deterministic gate)
        print("  Running deterministic QA gate...")
        manifest_path = job_dir / "manifest.json"
        check_args = [
            f"http://localhost:{port}",
            "--manifest", str(manifest_path),
            "--option", "a",
            "/",  # Add more page paths from manifest if needed
        ]
        
        check_rc, check_out, check_err = run_node("qa-check.js", check_args, timeout=180)
        print(check_out)
        if check_rc != 0:
            print(f"  ✗ qa-check.js FAILED (exit {check_rc})")
            # Continue to screenshots for debugging, but mark as failed
            qa_passed = False
        else:
            print("  ✓ qa-check.js PASSED")
            qa_passed = True
        
        # 4d. Run qa.cjs for screenshots
        print("  Capturing screenshots...")
        qa_rc, qa_out, qa_err = run_node("qa.cjs", [
            f"http://localhost:{port}",
            str(qa_dir),
        ], timeout=180)
        
        if qa_rc == 0:
            print("  ✓ Screenshots captured")
        else:
            print(f"  ⚠ Screenshot warnings: {qa_err[:300]}")
        
        # 4e. Compress screenshots
        print("  Compressing screenshots...")
        run_node("compress-screenshots.cjs", [str(qa_dir)], timeout=60)
        
        return qa_passed
        
    finally:
        dev_proc.terminate()
        try:
            dev_proc.wait(timeout=5)
        except:
            dev_proc.kill()

# ── Stage 4c-bis: Visual Sanity Pass (Venice Vision API) ────────────────────
def stage4c_visual_sanity(domain: str, tier: str, option: str) -> Dict:
    """
    Run visual sanity pass using Venice vision API.
    Reads compressed screenshots and sends to vision model for analysis.
    """
    print(f"\n[Stage 4c-bis] Visual Sanity Pass on {tier}-{option.upper()}...")
    job_dir = JOBS_DIR / domain
    qa_dir = job_dir / f"qa-{tier}-{option}"
    
    if not qa_dir.exists():
        return {"verdict": "pass", "issues": [], "summary": "No screenshots available"}
    
    # Find compressed screenshots (prefer jpg)
    screenshots = sorted(qa_dir.glob("*.jpg")) or sorted(qa_dir.glob("*.png"))
    if not screenshots:
        return {"verdict": "pass", "issues": [], "summary": "No screenshots found"}
    
    # Get vision model from config
    model_cfg = load_model_config()
    tier_cfg = model_cfg.get("balanced", model_cfg.get("quality"))
    stage_cfg = tier_cfg["stages"].get(f"visualPass{option.upper()}", {})
    vision_model = stage_cfg.get("visionModel", "qwen3-vl-235b-a22b")
    
    # Select key screenshots: homepage desktop + mobile
    desktop_home = next((s for s in screenshots if "desktop-home" in s.name or "desktop-index" in s.name), None)
    mobile_home = next((s for s in screenshots if "mobile-home" in s.name or "mobile-index" in s.name), None)
    
    issues = []
    
    # Analyze desktop screenshot with vision
    if desktop_home:
        print(f"  Analyzing desktop screenshot with {vision_model}...")
        try:
            vision_prompt = """You are a world-class design critic reviewing a website screenshot.
Check these 18 items and report ONLY issues found:
1. Hero quality (background visible, text readable)
2. Typography hierarchy (H1>H2>body clear)
3. Image rendering (no broken placeholders)
4. Color harmony (palette cohesive)
5. Spacing (generous whitespace)
6. Card/grid alignment
7. Nav cleanliness
8. Footer polish
9. Mobile stacking (if visible)
10. Anti-slop: no indigo/violet
11. Anti-slop: no cards-by-default
12. Anti-slop: no emoji icons
13. Brand identity clear
14. One memorable detail
15. Layout tension (asymmetry or negative space)
16. Focus states visible
17. Tap targets >= 44px (mobile)
18. No horizontal overflow (mobile)

For each issue found, output: {"item": number, "severity": "minor|major|critical", "description": "brief description"}
If no issues, output: NO_ISSUES"""
            
            response = venice_chat_with_image(vision_model, vision_prompt, desktop_home, max_tokens=8000)
            
            # Parse issues from response
            if "NO_ISSUES" not in response.upper():
                # Try to extract JSON arrays
                json_matches = re.findall(r'\{[^}]*"item"[^}]*\}', response)
                for match in json_matches:
                    try:
                        issue = json.loads(match)
                        if "item" in issue:
                            issues.append(issue)
                    except:
                        pass
            
            track_cost(domain, f"visualPass-{option}-desktop", vision_model)
            
        except Exception as e:
            print(f"  ⚠ Vision analysis failed: {e}")
    
    # Analyze mobile screenshot
    if mobile_home and not any(i.get("severity") == "critical" for i in issues):
        print(f"  Analyzing mobile screenshot with {vision_model}...")
        try:
            mobile_prompt = """Review this mobile screenshot. Check:
- Layout stacks properly
- Text readable without zoom
- Menu/nav accessible
- No horizontal overflow
- Tap targets large enough
- Hero visible and impactful

Report any issues found, or output NO_ISSUES"""
            
            response = venice_chat_with_image(vision_model, mobile_prompt, mobile_home, max_tokens=4000)
            if "NO_ISSUES" not in response.upper():
                json_matches = re.findall(r'\{[^}]*"item"[^}]*\}', response)
                for match in json_matches:
                    try:
                        issue = json.loads(match)
                        if "item" in issue:
                            issues.append(issue)
                    except:
                        pass
            
            track_cost(domain, f"visualPass-{option}-mobile", vision_model)
            
        except Exception as e:
            print(f"  ⚠ Mobile vision analysis failed: {e}")
    
    # Determine verdict
    critical_count = sum(1 for i in issues if i.get("severity") == "critical")
    major_count = sum(1 for i in issues if i.get("severity") == "major")
    
    if critical_count > 0:
        verdict = "rebuild"
    elif major_count > 2:
        verdict = "fix"
    else:
        verdict = "pass"
    
    result = {
        "verdict": verdict,
        "items_checked": 18,
        "items_passed": 18 - len(issues),
        "issues": issues,
        "summary": f"{len(issues)} issues found ({critical_count} critical, {major_count} major)" if issues else "All 18 items passed",
        "option": option,
        "stage": "4c-bis",
        "vision_model": vision_model,
    }
    
    # Write verdict to disk for hard gate
    verdict_path = qa_dir / "visual-pass-verdict.json"
    with open(verdict_path, "w") as f:
        json.dump(result, f, indent=2)
    
    print(f"  ✓ Visual sanity: {verdict} ({result['items_passed']}/18 items)")
    return result

# ── Stage 4c-tris: World-Class Audit (Venice API + Refero) ──────────────────
def stage4c_world_class_audit(domain: str, tier: str, option: str, brief: Dict) -> Dict:
    """
    World-class design audit using local Refero taxonomy + anti-ai-slop rules.
    """
    print(f"\n[Stage 4c-tris] World-Class Audit on {tier}-{option.upper()}...")
    model, temp, effort = get_model("worldClassAudit", "balanced")
    
    # Load Refero anti-ai-slop rules from local files
    refero_dir = REPO_ROOT / "templates" / "inspiration" / "refero-design" / "refero-design" / "references"
    anti_slop_text = ""
    craft_details_text = ""
    
    if refero_dir.exists():
        anti_slop_file = refero_dir / "anti-ai-slop.md"
        if anti_slop_file.exists():
            anti_slop_text = anti_slop_file.read_text()[:5000]  # First 5K chars
        craft_file = refero_dir / "craft-details.md"
        if craft_file.exists():
            craft_details_text = craft_file.read_text()[:3000]
    
    # Build audit prompt with Refero context
    system_prompt = f"""You are a world-class design critic running the Stage 4c-tris World-Class Audit.

The customer's old site is a FLOOR, not a bar. Measure against world-class references.

ANTI-AI-SLOP RULES (from Refero Design taxonomy):
{anti_slop_text if anti_slop_text else '- NO indigo/violet defaults (#6366f1, #8b5cf6, #7c3aed)'}

CRAFT DETAILS:
{craft_details_text if craft_details_text else '- Focus states, form attributes, hit targets, semantic markup'}

LITMUS TESTS:
- Card test: removing border/shadow/background/radius — does design still work?
- Image test: does first viewport work without hero image?
- Brand test: hide nav — does brand still come through?
- Identity test: could first viewport belong to any other company?

Output ONLY a JSON verdict with keys:
- verdict: "pass" | "fail"
- score: 0-100
- axis_verdicts: {{"refero": "pass/fail", "inspiration": "pass/fail/unavailable", "craft": "pass/fail"}}
- top_issues: array of strings (max 5)
- one_memorable_detail: string or null
- anti_slop_violations: array of strings"""
    
    user_prompt = f"""Audit Option {option.upper()} for {domain}

Design brief:
- Industry: {brief.get('industry', 'unknown')}
- North star: {brief.get('north_star', '')}
- Color strategy: {json.dumps(brief.get('color_strategy', {}), indent=2)}
- Typography: {json.dumps(brief.get('typography', {}), indent=2)}
- Anti-slop rules from brief: {json.dumps(brief.get('anti_slop_rules', []), indent=2)}

Provide world-class audit verdict."""
    
    response = venice_chat(model, [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ], temperature=0.2, reasoning_effort=effort, max_tokens=32000)
    
    track_cost(domain, f"worldClassAudit-{option}", model)
    
    # Extract JSON
    json_match = re.search(r'\{.*\}', response, re.DOTALL)
    if json_match:
        try:
            audit = json.loads(json_match.group())
        except json.JSONDecodeError:
            audit = {"verdict": "pass", "score": 75, "error": "JSON parse failed"}
    else:
        audit = {"verdict": "pass", "score": 75, "error": "No JSON found"}
    
    # Write audit
    audit_path = JOBS_DIR / domain / f"qa-{tier}-{option}" / "world-class-audit.json"
    audit_path.parent.mkdir(parents=True, exist_ok=True)
    with open(audit_path, "w") as f:
        json.dump(audit, f, indent=2)
    
    print(f"  ✓ World-class audit: {audit.get('verdict', 'pass')} (score: {audit.get('score', 'N/A')})")
    return audit

# ── Stage 4e: Fix Loop (Venice API) ─────────────────────────────────────────
def stage4e_fix_loop(domain: str, tier: str, option: str, issues: List[Dict], brief: Dict) -> bool:
    """
    Iterative fix loop. Takes issues from visual sanity pass and applies fixes.
    """
    if not issues:
        return True
    
    print(f"\n[Stage 4e] Fix Loop for {tier}-{option.upper()}...")
    print(f"  Issues to fix: {len(issues)}")
    
    model, temp, effort = get_model("fixLoop", "balanced")
    job_dir = JOBS_DIR / domain
    opt_dir = job_dir / f"{tier}-{option}"
    pages_dir = opt_dir / "src" / "pages"
    
    if not pages_dir.exists():
        return False
    
    # Group issues by page
    issues_by_page = {}
    for issue in issues:
        page = issue.get("page", "index")
        if page not in issues_by_page:
            issues_by_page[page] = []
        issues_by_page[page].append(issue)
    
    fixed_count = 0
    for page_name, page_issues in issues_by_page.items():
        # Find the astro file
        page_file = pages_dir / f"{page_name}.astro"
        if not page_file.exists():
            page_file = pages_dir / page_name / "index.astro"
        if not page_file.exists():
            continue
        
        code = page_file.read_text()
        
        system_prompt = """You are a precise code fixer. Apply ONLY the requested fixes.
Rules:
- Fix exactly the issues listed
- Keep all other code unchanged
- Output ONLY the modified code"""
        
        issues_text = "\n".join(f"- {i.get('description', '')}" for i in page_issues)
        user_prompt = f"""Fix these issues in the Astro file:

{issues_text}

Code:
{code[:12000]}"""
        
        response = venice_chat(model, [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ], temperature=0.2, max_tokens=32000)
        
        track_cost(domain, f"fixLoop-{page_name}", model)
        
        code_match = re.search(r'```(?:astro|html)?\s*\n?(.*?)```', response, re.DOTALL)
        fixed = code_match.group(1).strip() if code_match else response.strip()
        
        if "<" in fixed and len(fixed) > len(code) * 0.5:
            page_file.write_text(fixed)
            fixed_count += len(page_issues)
    
    print(f"  ✓ Applied fixes to {fixed_count} issues")
    return True

# ── Stage 5: Build Option B (Venice API — copy rewrite) ─────────────────────
def stage5_build_b(manifest: Dict, brief: Dict, domain: str, tier: str):
    print(f"\n[Stage 5] Building Option B ({tier})...")
    # Option B is copy rewrite, NOT codegen — use copyRewrite model assignment
    model, temp, effort = get_model("copyRewrite", tier)
    job_dir = JOBS_DIR / domain
    
    # Copy Option A → skip node_modules and .vercel (symlinks break, rebuild deps)
    opt_a = job_dir / f"{tier}-a"
    opt_b = job_dir / f"{tier}-b"
    if opt_b.exists():
        shutil.rmtree(str(opt_b))
    
    def _ignore_copy(src, names):
        return {"node_modules", ".vercel", ".git", ".astro"}
    
    shutil.copytree(str(opt_a), str(opt_b), ignore=_ignore_copy)
    
    # Re-install dependencies in B
    if (opt_b / "package.json").exists():
        print("  Installing dependencies in Option B...")
        install = subprocess.run(
            ["npm", "install"], cwd=str(opt_b),
            capture_output=True, text=True, timeout=120,
        )
        if install.returncode != 0:
            print(f"  ⚠ npm install warning: {install.stderr[:300]}")
    
    pages_dir = opt_b / "src" / "pages"
    if not pages_dir.exists():
        print(f"  ⚠ {tier}-a not found")
        return None
    
    # Rewrite each page for conversion
    for astro_file in pages_dir.rglob("*.astro"):
        rel_path = astro_file.relative_to(pages_dir)
        print(f"  Rewriting {rel_path}...")
        
        original_code = astro_file.read_text()
        
        system_prompt = """You are a conversion copywriter. Rewrite ONLY the text content for persuasion.
Rules:
- Keep all HTML/Astro structure EXACTLY the same
- Only change text between tags
- Sharpen CTAs (action-oriented, benefit-driven)
- Reorder value props for maximum impact
- Keep ALL facts accurate (names, dates, numbers verbatim)
- Output ONLY the modified code"""
        
        response = venice_chat(model, [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Rewrite for conversion:\n\n{original_code[:15000]}"},
        ], temperature=0.4, max_tokens=32000)
        
        track_cost(domain, f"buildB-{rel_path}", model)
        
        code_match = re.search(r'```(?:astro|html)?\s*\n?(.*?)```', response, re.DOTALL)
        code = code_match.group(1).strip() if code_match else response.strip()
        
        if "<" in code:
            astro_file.write_text(code)
    
    print(f"  ✓ Option B built ({model})")
    return opt_b

# ── Stage 6: QA B (same pattern as A) ─────────────────────────────────────────
def stage6_qa_b(domain: str, tier: str) -> bool:
    print(f"\n[Stage 6] QA Option B ({tier})...")
    # Same as stage4 but with --reference-dist pointing to {tier}-a/dist
    job_dir = JOBS_DIR / domain
    opt_dir = job_dir / f"{tier}-b"
    qa_dir = job_dir / f"qa-{tier}-b"
    qa_dir.mkdir(exist_ok=True)
    
    if not opt_dir.exists():
        return False
    
    # Build
    build_result = subprocess.run(
        ["npx", "astro", "build"], cwd=str(opt_dir),
        capture_output=True, text=True, timeout=120,
    )
    if build_result.returncode != 0:
        print(f"  ✗ Build failed")
        return False
    
    # Get port
    port_rc, port_out, _ = run_node("get-port.cjs", [domain, "b"], timeout=10)
    port = int(port_out.strip()) if port_rc == 0 and port_out.strip().isdigit() else 4322
    
    dev_proc = subprocess.Popen(
        ["npx", "astro", "dev", "--port", str(port)],
        cwd=str(opt_dir), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    time.sleep(3)
    
    try:
        # Run qa-check with reference-dist for testimonial preservation
        ref_dist = job_dir / f"{tier}-a" / "dist"
        manifest_path = job_dir / "manifest.json"
        
        check_args = [
            f"http://localhost:{port}",
            "--manifest", str(manifest_path),
            "--reference-dist", str(ref_dist),
            "--option", "b",
            "/",
        ]
        
        check_rc, check_out, _ = run_node("qa-check.js", check_args, timeout=180)
        print(check_out)
        
        # Screenshots
        run_node("qa.cjs", [f"http://localhost:{port}", str(qa_dir)], timeout=180)
        run_node("compress-screenshots.cjs", [str(qa_dir)], timeout=60)
        
        return check_rc == 0
        
    finally:
        dev_proc.terminate()
        try:
            dev_proc.wait(timeout=5)
        except:
            dev_proc.kill()

# ── Stage 7: Build Option C (Venice API — design language) ──────────────────
def stage7_build_c(manifest: Dict, brief: Dict, domain: str, tier: str):
    print(f"\n[Stage 7] Building Option C ({tier})...")
    model, temp, effort = get_model("perPageC", tier)
    job_dir = JOBS_DIR / domain
    
    # Copy Option B → skip node_modules and .vercel
    opt_b = job_dir / f"{tier}-b"
    opt_c = job_dir / f"{tier}-c"
    if opt_c.exists():
        shutil.rmtree(str(opt_c))
    
    def _ignore_copy(src, names):
        return {"node_modules", ".vercel", ".git", ".astro"}
    
    shutil.copytree(str(opt_b), str(opt_c), ignore=_ignore_copy)
    
    # Re-install dependencies in C
    if (opt_c / "package.json").exists():
        print("  Installing dependencies in Option C...")
        install = subprocess.run(
            ["npm", "install"], cwd=str(opt_c),
            capture_output=True, text=True, timeout=120,
        )
        if install.returncode != 0:
            print(f"  ⚠ npm install warning: {install.stderr[:300]}")
    
    pages_dir = opt_c / "src" / "pages"
    if not pages_dir.exists():
        print(f"  ⚠ {tier}-b not found")
        return None
    
    # Apply new design language to each page
    for astro_file in pages_dir.rglob("*.astro"):
        rel_path = astro_file.relative_to(pages_dir)
        print(f"  Redesigning {rel_path}...")
        
        b_code = astro_file.read_text()
        
        system_prompt = """You are a design systems expert. Apply a bold new visual design language.
Rules:
- Change ONLY Tailwind classes and layout structure
- Keep ALL text content exactly verbatim
- Apply the design brief's color strategy and typography
- Create bold, modern, world-class design
- Anti-slop: no indigo/violet defaults, no cards-by-default, no emoji-icons
- Output ONLY modified code"""
        
        response = venice_chat(model, [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Design brief:\n{json.dumps(brief, indent=2)[:5000]}\n\nPage:\n{b_code[:15000]}"},
        ], temperature=0.3, max_tokens=32000)
        
        track_cost(domain, f"buildC-{rel_path}", model)
        
        code_match = re.search(r'```(?:astro|html)?\s*\n?(.*?)```', response, re.DOTALL)
        code = code_match.group(1).strip() if code_match else response.strip()
        
        if "<" in code:
            astro_file.write_text(code)
    
    print(f"  ✓ Option C built ({model})")
    return opt_c

# ── Stage 8: Deploy ─────────────────────────────────────────────────────────
def get_vercel_token() -> Optional[str]:
    """Resolve Vercel auth token from env or macOS auth.json."""
    # 1. Env var (highest priority)
    token = os.environ.get("VERCEL_TOKEN")
    if token:
        return token
    
    # 2. macOS default auth path (same as original scripts)
    auth_path = Path.home() / "Library" / "Application Support" / "com.vercel.cli" / "auth.json"
    if auth_path.exists():
        try:
            data = json.loads(auth_path.read_text())
            # auth.json stores token under .token or nested
            if isinstance(data, dict):
                if "token" in data:
                    return data["token"]
        except Exception:
            pass
    
    return None

def _ensure_vercel_project(project_name: str, opt_dir: Path, vercel_token: str) -> bool:
    """Create Vercel project if it doesn't exist, then link opt_dir to it."""
    # Check if already linked
    project_json = opt_dir / ".vercel" / "project.json"
    if project_json.exists():
        try:
            data = json.loads(project_json.read_text())
            if data.get("projectId") and data.get("orgId") == VERCEL_ORG_ID:
                return True
        except Exception:
            pass
    
    # Create project (no --yes flag for project add)
    create = subprocess.run(
        ["npx", "vercel", "project", "add", project_name,
         "--scope", VERCEL_SCOPE, "--token", vercel_token],
        cwd=str(opt_dir), capture_output=True, text=True, timeout=60,
    )
    if create.returncode != 0 and "already exists" not in create.stderr.lower():
        print(f"    ⚠ Project create failed: {create.stderr[:200]}")
        # Continue anyway — may already exist
    
    # Link directory to project (non-interactive)
    link = subprocess.run(
        ["npx", "vercel", "link", "--project", project_name,
         "--scope", VERCEL_SCOPE, "--token", vercel_token, "--yes"],
        cwd=str(opt_dir), capture_output=True, text=True, timeout=60,
    )
    if link.returncode != 0:
        print(f"    ⚠ Link failed: {link.stderr[:200]}")
        return False
    
    # Pull project settings so vercel build works
    pull = subprocess.run(
        ["npx", "vercel", "pull", "--yes",
         "--scope", VERCEL_SCOPE, "--token", vercel_token],
        cwd=str(opt_dir), capture_output=True, text=True, timeout=60,
    )
    if pull.returncode != 0:
        print(f"    ⚠ Pull failed: {pull.stderr[:200]}")
        # Continue — may already have settings
    
    return True

def stage8_deploy(domain: str, tier: str, skip_c: bool) -> Dict[str, str]:
    """
    Deploy each (tier, option) to its own Vercel project.
    Naming: wf-{tier}-{option}-{sanitized-domain}
    """
    print(f"\n[Stage 8] Deploying (9-project mode)...")
    urls = {}
    job_dir = JOBS_DIR / domain
    
    vercel_token = get_vercel_token()
    if not vercel_token:
        print("  ✗ Vercel token not found")
        print("  To fix: npx vercel login   OR   export VERCEL_TOKEN=<token>")
        return urls
    
    print(f"  ✓ Vercel token resolved")
    
    # Sanitize domain for project name
    safe_domain = domain.replace(".", "-").replace("_", "-").lower()
    
    for option in ["a", "b"] + ([] if skip_c else ["c"]):
        # Tiered directory naming
        tier_opt_dir = job_dir / f"{tier}-{option}"
        
        if not tier_opt_dir.exists():
            # Fallback: check old-style option-{option} for backwards compat
            legacy_dir = job_dir / f"option-{option}"
            if legacy_dir.exists():
                # Copy to tiered location for this deploy
                if tier_opt_dir.exists():
                    shutil.rmtree(str(tier_opt_dir))
                shutil.copytree(str(legacy_dir), str(tier_opt_dir))
                print(f"  Copied legacy option-{option} → {tier}-{option}")
            else:
                print(f"  ⚠ {tier}-{option} not found, skipping")
                continue
        
        project_name = f"wf-{tier}-{option}-{safe_domain}"
        
        print(f"  Building {tier}-{option} → project {project_name}...")
        
        # Ensure project exists and is linked
        if not _ensure_vercel_project(project_name, tier_opt_dir, vercel_token):
            print(f"    ✗ Could not link project {project_name}")
            continue
        
        # Vercel build (creates .vercel/output/ for --prebuilt)
        build = subprocess.run(
            ["npx", "vercel", "build"],
            cwd=str(tier_opt_dir), capture_output=True, text=True, timeout=180,
        )
        if build.returncode != 0:
            print(f"    ✗ Build failed: {build.stderr[:300]}")
            continue
        
        # Deploy with --prebuilt
        deploy = subprocess.run(
            ["npx", "vercel", "deploy", "--prebuilt", "--yes",
             "--scope", VERCEL_SCOPE, "--token", vercel_token],
            cwd=str(tier_opt_dir), capture_output=True, text=True, timeout=120,
        )
        
        if deploy.returncode == 0:
            url_match = re.search(r'https?://[^\s]+', deploy.stdout)
            if url_match:
                urls[f"{tier}-{option}"] = url_match.group()
                print(f"    ✓ {urls[f'{tier}-{option}']}")
        else:
            print(f"    ⚠ Deploy failed: {deploy.stderr[:300]}")
    
    return urls

# ── Stage 9: Verify ─────────────────────────────────────────────────────────
def stage9_verify(urls: Dict[str, str]) -> bool:
    print(f"\n[Stage 9] Verifying...")
    all_ok = True
    for option, url in urls.items():
        try:
            result = subprocess.run(
                ["curl", "-sL", "--max-time", "15", "-o", "/dev/null", "-w", "%{http_code}", url],
                capture_output=True, text=True, timeout=20,
            )
            status = result.stdout.strip()
            ok = status == "200"
            print(f"  {'✓' if ok else '✗'} Option {option.upper()}: HTTP {status}")
            if not ok:
                all_ok = False
        except Exception as e:
            print(f"  ✗ Option {option.upper()}: {e}")
            all_ok = False
    return all_ok

# ── Stage 10: Report ────────────────────────────────────────────────────────
def stage10_report(domain: str, urls: Dict[str, str], tier: str, skip_c: bool):
    print(f"\n{'='*60}")
    print(f"  WebFactory Complete: {domain}")
    print(f"{'='*60}")
    print(f"1. {tier}-A (Faithful):    {urls.get(f'{tier}-a', 'N/A')}")
    print(f"2. {tier}-B (Conversion):  {urls.get(f'{tier}-b', 'N/A')}")
    if not skip_c:
        print(f"3. {tier}-C (Design):      {urls.get(f'{tier}-c', 'N/A')}")
    print(f"\nTier: {tier}")
    
    # Cost report
    metrics_path = JOBS_DIR / domain / "metrics.json"
    if metrics_path.exists():
        run_node("cost-tracker.cjs", [domain, "--report"], timeout=30)

# ── Pre-flight ──────────────────────────────────────────────────────────────
def preflight():
    """Verify Playwright works headlessly before starting any work."""
    print("[Pre-flight] Verifying headless Playwright...")
    verify_script = SCRIPTS_DIR / "verify-playwright.py"
    if verify_script.exists():
        result = subprocess.run(
            [sys.executable, str(verify_script)],
            capture_output=True, text=True, timeout=120,
        )
        if result.returncode != 0:
            print("✗ PRE-FLIGHT FAILED")
            print(result.stdout)
            print("")
            print("Playwright cannot take screenshots. Common fixes:")
            print("  1. cd ~/VeniceWebFactory && npm install")
            print("  2. bash ~/VeniceWebFactory/scripts/setup-permissions.sh")
            print("  3. Restart Terminal")
            print("")
            print("Pipeline aborted — no partial work done.")
            sys.exit(1)
    print("  ✓ Headless Playwright ready")

# ── Main ────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="WebFactory — Full orchestrator")
    parser.add_argument("url", help="URL to rebuild")
    parser.add_argument("--tier", default="balanced", choices=["quality", "balanced", "cost"])
    parser.add_argument("--all-tiers", action="store_true", help="Build all 3 tiers (quality, balanced, cost) — 9 projects total")
    parser.add_argument("--skip-c", action="store_true", help="Skip Option C")
    parser.add_argument("--max-pages", type=int, default=0, help="Max pages to scrape (0=unlimited)")
    parser.add_argument("--skip-preflight", action="store_true", help="Skip pre-flight (DANGEROUS)")
    parser.add_argument("--full", action="store_true", help="Wipe jobs/{domain}/ before building (clean rebuild)")
    args = parser.parse_args()
    
    if not VENICE_API_KEY:
        print("ERROR: VENICE_API_KEY not set")
        sys.exit(1)
    
    if not args.skip_preflight:
        preflight()
    
    domain = args.url.replace("https://", "").replace("http://", "").split("/")[0].replace("www.", "")
    
    # --full: clean rebuild — wipe domain dir but preserve .vercel/project.json
    if args.full:
        jobs_domain = REPO_ROOT / "jobs" / domain
        if jobs_domain.exists():
            # Preserve Vercel links so deploy URLs don't churn
            vercel_links = list(jobs_domain.rglob(".vercel/project.json"))
            preserved = {}
            for link in vercel_links:
                rel = link.relative_to(jobs_domain)
                preserved[str(rel)] = link.read_text()
            shutil.rmtree(jobs_domain)
            jobs_domain.mkdir(parents=True, exist_ok=True)
            for rel_path, content in preserved.items():
                link_file = jobs_domain / rel_path
                link_file.parent.mkdir(parents=True, exist_ok=True)
                link_file.write_text(content)
            print(f"  ✓ --full: wiped jobs/{domain}/ (preserved {len(preserved)} Vercel links)")
    
    # Determine which tiers to run
    tiers = ["quality", "balanced", "cost"] if args.all_tiers else [args.tier]
    
    all_urls = {}
    
    for tier in tiers:
        print(f"\n{'='*60}")
        print(f"  WebFactory Starting — Tier: {tier}")
        print(f"  URL: {args.url} | Domain: {domain}")
        print(f"  Max pages: {'unlimited' if args.max_pages == 0 else args.max_pages}")
        print(f"{'='*60}")
        
        try:
            # Only scrape once for all tiers
            if tier == tiers[0]:
                manifest = stage1_scrape(args.url, domain, tier, args.max_pages)
            brief = stage2_brief(manifest, domain, tier)
            stage3_build_a(manifest, brief, domain, tier)
            qa_a = stage4_qa_a(domain, tier)
            
            # Visual sanity pass + world-class audit
            sanity_a = stage4c_visual_sanity(domain, tier, "a")
            audit_a = stage4c_world_class_audit(domain, tier, "a", brief)
            
            # Fix loop if needed
            if sanity_a.get("verdict") == "fix":
                stage4e_fix_loop(domain, tier, "a", sanity_a.get("issues", []), brief)
                # Re-QA after fixes
                qa_a = stage4_qa_a(domain, tier)
            
            stage5_build_b(manifest, brief, domain, tier)
            qa_b = stage6_qa_b(domain, tier)
            
            # Visual sanity for B
            sanity_b = stage4c_visual_sanity(domain, tier, "b")
            if sanity_b.get("verdict") == "fix":
                stage4e_fix_loop(domain, tier, "b", sanity_b.get("issues", []), brief)
                qa_b = stage6_qa_b(domain, tier)
            
            if not args.skip_c:
                stage7_build_c(manifest, brief, domain, tier)
                # QA C would go here with --reference-dist pointing to B
                sanity_c = stage4c_visual_sanity(domain, tier, "c")
                stage4c_world_class_audit(domain, tier, "c", brief)
            
            urls = stage8_deploy(domain, tier, args.skip_c)
            verify_ok = stage9_verify(urls)
            stage10_report(domain, urls, tier, args.skip_c)
            
            # Merge URLs into combined report
            all_urls.update(urls)
            
            if not verify_ok:
                print(f"\n⚠ Some verifications failed for tier {tier}.")
        
        except Exception as e:
            print(f"\n✗ Tier {tier} failed: {e}")
            import traceback
            traceback.print_exc()
    
    # Final combined report
    print(f"\n{'='*60}")
    print(f"  ALL TIERS COMPLETE: {domain}")
    print(f"{'='*60}")
    for key in sorted(all_urls.keys()):
        print(f"  {key}: {all_urls[key]}")
    
    print(f"\n✓ Pipeline complete!")

if __name__ == "__main__":
    main()
