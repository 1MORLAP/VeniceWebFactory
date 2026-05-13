#!/usr/bin/env python3
"""setup.py — One-time WebFactory setup (run once manually)"""

import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

def check_venice_key():
    """Check Venice API key exists."""
    env_file = Path.home() / ".hermes" / ".env"
    if not env_file.exists():
        print("✗ ~/.hermes/.env not found")
        return False
    
    content = env_file.read_text()
    if "VENICE_API_KEY=" not in content:
        print("✗ VENICE_API_KEY not found in ~/.hermes/.env")
        return False
    
    print("✓ VENICE_API_KEY found")
    return True

def check_vercel_auth():
    """Check Vercel is pre-authenticated."""
    vercel_dir = Path.home() / ".local" / "share" / "com.vercel.cli"  # or .vercel
    if not vercel_dir.exists():
        vercel_dir = Path.home() / ".vercel"
    
    if not vercel_dir.exists():
        print("✗ Vercel not authenticated. Run: npx vercel login")
        return False
    
    print("✓ Vercel authenticated")
    return True

def setup_scaffold():
    """Pre-install Astro scaffold dependencies."""
    scaffold_dir = REPO_ROOT / "templates" / "astro-scaffold"
    if not scaffold_dir.exists():
        print("⚠ Scaffold not found, creating minimal...")
        scaffold_dir.mkdir(parents=True, exist_ok=True)
        # Create minimal package.json
        (scaffold_dir / "package.json").write_text('''{
  "name": "astro-scaffold",
  "type": "module",
  "dependencies": {
    "astro": "^5.0.0",
    "@tailwindcss/vite": "^4.0.0",
    "tailwindcss": "^4.0.0"
  }
}''')
    
    # Check if node_modules exists
    if not (scaffold_dir / "node_modules").exists():
        print("📦 Installing scaffold dependencies (one-time)...")
        result = subprocess.run(
            ["npm", "install"],
            cwd=str(scaffold_dir),
            capture_output=True,
            text=True,
            timeout=300,
        )
        if result.returncode != 0:
            print(f"✗ npm install failed: {result.stderr[:500]}")
            return False
        print("✓ Dependencies installed")
    else:
        print("✓ Dependencies already installed")
    
    return True

def main():
    print("=" * 60)
    print("  WebFactory Setup")
    print("=" * 60)
    print()
    
    ok = True
    ok &= check_venice_key()
    ok &= check_vercel_auth()
    ok &= setup_scaffold()
    
    print()
    if ok:
        print("✓ Setup complete! You can now run:")
        print("  python3 scripts/webfactory.py https://example.com --tier=balanced")
    else:
        print("✗ Setup incomplete. Fix issues above.")
        sys.exit(1)

if __name__ == "__main__":
    main()
