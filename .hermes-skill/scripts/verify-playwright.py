#!/usr/bin/env python3
"""verify-playwright.py — Verify Playwright works headlessly (no permission prompts).

Uses the SAME pattern as qa.cjs: writes temp script to REPO_ROOT so
require('playwright') resolves from node_modules, NOT from /tmp/.
"""

import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

def verify():
    print("Verifying headless Playwright...")
    
    # Check Playwright is installed
    try:
        result = subprocess.run(
            ["node", "-e", "require('playwright'); console.log('OK')"],
            cwd=str(REPO_ROOT),
            capture_output=True,
            text=True,
            timeout=10,
        )
        if result.returncode != 0:
            print("✗ Playwright not installed.")
            print("  Fix: cd ~/VeniceWebFactory && npm install")
            return False
    except Exception:
        print("✗ Node.js not available")
        return False
    
    # Write temp script INSIDE REPO_ROOT (not /tmp) so require('playwright') resolves
    # Use .cjs extension because package.json has "type": "module"
    tmp_script = REPO_ROOT / "jobs" / "_verify-playwright.cjs"
    tmp_script.parent.mkdir(parents=True, exist_ok=True)
    
    test_script = """
const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  try {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto('https://example.com', { waitUntil: 'networkidle', timeout: 15000 });
    
    // Take screenshot (same as qa.cjs does)
    const tmpDir = require('os').tmpdir();
    const screenshotPath = tmpDir + '/webfactory-verify.png';
    await page.screenshot({ path: screenshotPath, fullPage: true });
    await browser.close();
    
    // Verify screenshot was written
    const stats = fs.statSync(screenshotPath);
    if (stats.size < 100) {
      console.log('FAILED: Screenshot is empty');
      process.exit(1);
    }
    
    // Clean up
    fs.unlinkSync(screenshotPath);
    console.log('OK');
    process.exit(0);
  } catch (err) {
    console.log('FAILED:', err.message);
    process.exit(1);
  }
})();
"""
    
    tmp_script.write_text(test_script)
    
    try:
        # Run from REPO_ROOT (same as qa.cjs)
        result = subprocess.run(
            ["node", str(tmp_script)],  # Use FULL PATH, not just name
            capture_output=True,
            text=True,
            cwd=str(REPO_ROOT),
            timeout=60,
        )
        
        output = result.stdout.strip()
        if output == "OK":
            print("✓ Playwright working correctly!")
            return True
        else:
            # Check if it's a permission error vs module resolution
            stderr = result.stderr.lower()
            if "cannot find module" in stderr or "permission" in stderr:
                print("✗ Permission or module error — run setup script:")
                print("  bash ~/VeniceWebFactory/scripts/setup-permissions.sh")
                print(f"  Details: {result.stderr[:200]}")
            else:
                print(f"✗ {output}")
                print(f"  stderr: {result.stderr[:200]}")
            return False
            
    finally:
        if tmp_script.exists():
            tmp_script.unlink()

if __name__ == "__main__":
    ok = verify()
    sys.exit(0 if ok else 1)
