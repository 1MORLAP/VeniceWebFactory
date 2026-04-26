#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
#  WebFactory Setup — fresh-machine bootstrap script
#  Idempotent: safe to re-run. Each step checks "already done?" before acting.
#
#  Usage (after cloning the repo from GitHub):
#    cd /Users/tomasz/WebFactory  (or wherever you cloned)
#    ./setup.sh
#
#  What this script DOES install / configure:
#    1. Verifies Claude Code is installed (does not auto-install)
#    2. Homebrew (if missing)
#    3. Node.js v18+ (via Homebrew)
#    4. ffmpeg (soft dep for future video splash work)
#    5. npm dependencies (Playwright)
#    6. Playwright Chromium browser binary
#    7. Frontend Design plugin (Claude Code marketplace plugin)
#    8. Vercel CLI auth + team scope verification
#    9. Path-portability handling (symlink OR find-and-replace if cloned to non-default path)
#
#  What it does NOT do (because they need user action / decision):
#    - Install Claude Code itself (https://claude.com/claude-code)
#    - Provision the Vercel team or grant access (this script verifies access)
#    - Set up MCP servers beyond the included plugins
#
#  Designed for macOS (MacMini, MacBook). For Linux, fork + adapt.
# ─────────────────────────────────────────────────────────────────────

set -e
set -u

# ─── Pretty output helpers ──────────────────────────────────────────
RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
YELLOW=$'\033[0;33m'
BLUE=$'\033[0;34m'
RESET=$'\033[0m'

step()    { echo ""; echo "${BLUE}━━ $1 ━━${RESET}"; }
ok()      { echo "  ${GREEN}✓${RESET} $1"; }
warn()    { echo "  ${YELLOW}⚠${RESET} $1"; }
err()     { echo "  ${RED}✗${RESET} $1"; }
ask()     { printf "  ${YELLOW}?${RESET} %s [y/N] " "$1"; read -r REPLY; [[ "$REPLY" =~ ^[Yy]$ ]]; }

EXPECTED_PATH="/Users/tomasz/WebFactory"
ACTUAL_PATH="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo "${BLUE}╔══════════════════════════════════════════════════════════╗${RESET}"
echo "${BLUE}║       WebFactory Setup — fresh-machine bootstrap         ║${RESET}"
echo "${BLUE}╚══════════════════════════════════════════════════════════╝${RESET}"
echo ""
echo "Repo location: ${ACTUAL_PATH}"
echo "Expected path: ${EXPECTED_PATH}"
echo ""

# ─── Step 0: Verify macOS ───────────────────────────────────────────
step "Step 0 — Platform check"
if [[ "$(uname)" != "Darwin" ]]; then
  err "This script is macOS-only. You're on $(uname). For Linux, fork + adapt."
  exit 1
fi
ok "Running on macOS"

# ─── Step 1: Verify Claude Code is installed ────────────────────────
step "Step 1 — Claude Code CLI"
if ! command -v claude >/dev/null 2>&1; then
  err "Claude Code CLI not found in PATH."
  echo ""
  echo "    Install from: https://claude.com/claude-code"
  echo "    Then re-run this script."
  exit 1
fi
ok "claude CLI is installed"

# ─── Step 2: Homebrew ───────────────────────────────────────────────
step "Step 2 — Homebrew"
if ! command -v brew >/dev/null 2>&1; then
  warn "Homebrew not found. Installing (will prompt for sudo password)..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  if [[ -f /opt/homebrew/bin/brew ]]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
  elif [[ -f /usr/local/bin/brew ]]; then
    eval "$(/usr/local/bin/brew shellenv)"
  fi
  ok "Homebrew installed"
else
  ok "Homebrew already installed ($(brew --version | head -1))"
fi

# ─── Step 3: Node.js v18+ ───────────────────────────────────────────
step "Step 3 — Node.js (v18+ required for Astro 5)"
NODE_OK=false
if command -v node >/dev/null 2>&1; then
  NODE_MAJOR=$(node -v | sed 's/v//' | cut -d. -f1)
  if [[ "${NODE_MAJOR}" -ge 18 ]]; then
    ok "Node.js $(node -v) already installed"
    NODE_OK=true
  else
    warn "Node.js $(node -v) is too old (need v18+). Upgrading via brew..."
  fi
fi
if [[ "${NODE_OK}" == "false" ]]; then
  brew install node 2>&1 | tail -3 || brew upgrade node 2>&1 | tail -3
  ok "Node.js $(node -v) installed"
fi

# ─── Step 4: ffmpeg (soft dep) ──────────────────────────────────────
step "Step 4 — ffmpeg (soft dep for future video splash work)"
if command -v ffmpeg >/dev/null 2>&1; then
  ok "ffmpeg already installed"
else
  warn "ffmpeg not found. Installing (used by future video splash transcode work)..."
  brew install ffmpeg 2>&1 | tail -3
  ok "ffmpeg installed"
fi

# ─── Step 5: npm install ────────────────────────────────────────────
step "Step 5 — npm dependencies (Playwright)"
cd "${ACTUAL_PATH}"
if [[ -d node_modules ]] && [[ -f node_modules/playwright/package.json ]]; then
  ok "node_modules already populated (Playwright present)"
else
  warn "Running npm install (this may take 30–60 seconds)..."
  npm install 2>&1 | tail -3
  ok "npm dependencies installed"
fi

# ─── Step 6: Playwright Chromium ────────────────────────────────────
step "Step 6 — Playwright Chromium browser binary"
if npx playwright --version >/dev/null 2>&1; then
  CHROMIUM_DIR=$(find ~/Library/Caches/ms-playwright -maxdepth 2 -type d -name "chromium-*" 2>/dev/null | head -1 || true)
  if [[ -n "${CHROMIUM_DIR}" ]] && [[ -d "${CHROMIUM_DIR}" ]]; then
    ok "Playwright Chromium already downloaded ($(basename "${CHROMIUM_DIR}"))"
  else
    warn "Downloading Playwright Chromium (~170MB)..."
    npx playwright install chromium 2>&1 | tail -5
    ok "Playwright Chromium downloaded"
  fi
else
  err "Playwright npm package not found despite npm install. Re-run setup or check package.json."
  exit 1
fi

# ─── Step 7: Frontend Design plugin ─────────────────────────────────
step "Step 7 — Frontend Design plugin (Claude Code marketplace)"
PLUGIN_DIR="${HOME}/.claude/plugins/cache/claude-plugins-official/frontend-design"
if [[ -d "${PLUGIN_DIR}" ]]; then
  ok "frontend-design plugin already installed"
else
  warn "Installing frontend-design plugin..."
  if claude plugin install frontend-design@claude-plugins-official --scope project 2>&1 | tail -5; then
    ok "frontend-design plugin installed"
  else
    err "Plugin install failed. Try manually: claude plugin install frontend-design@claude-plugins-official --scope project"
    warn "Skipping — Option C builds will fail until this is resolved. Options A and B work without it."
  fi
fi

# ─── Step 8: Vercel CLI auth + team scope ────────────────────────────
step "Step 8 — Vercel CLI auth + team scope"
if npx vercel whoami >/dev/null 2>&1; then
  VERCEL_USER=$(npx vercel whoami 2>&1 | tail -1)
  ok "Vercel CLI authenticated as: ${VERCEL_USER}"
else
  warn "Not logged in to Vercel. Opening browser for login..."
  echo "    (You'll receive an email with a link to confirm.)"
  if ! npx vercel login; then
    err "Vercel login failed or was cancelled. Re-run setup or 'npx vercel login' manually."
    exit 1
  fi
  ok "Vercel login complete"
fi

if npx vercel teams ls 2>&1 | grep -q "tomek-group"; then
  ok "Team 'tomek-group' is accessible"
else
  warn "Team 'tomek-group' not found in 'npx vercel teams ls' output."
  warn "Either you're logged in as the wrong user, OR this MacMini's Vercel"
  warn "account doesn't have access to the team. If this is a different account,"
  warn "update the team identifiers in:"
  warn "  - SKILL.md (search for 'tomek-group' and 'team_4Hr5Lqd6pY5D7gmeXDVsDmYx')"
  warn "  - CLAUDE.md (search for 'tomek-group')"
fi

# ─── Step 9: Path portability ────────────────────────────────────────
step "Step 9 — Path portability (SKILL.md hardcodes /Users/tomasz/WebFactory)"
if [[ "${ACTUAL_PATH}" == "${EXPECTED_PATH}" ]]; then
  ok "Repo is at the expected path — no rewriting needed"
else
  warn "Repo is at ${ACTUAL_PATH}, but SKILL.md/CLAUDE.md/scripts/ contain"
  warn "hardcoded references to ${EXPECTED_PATH}."
  echo ""
  echo "    Two options:"
  echo "      (A) Symlink — creates ${EXPECTED_PATH} → ${ACTUAL_PATH} (preserves files as-is, needs sudo)"
  echo "      (B) Rewrite — find-and-replace the path globally in tracked files (no sudo, but creates a divergent local commit)"
  echo ""
  if ask "Create a symlink ${EXPECTED_PATH} → ${ACTUAL_PATH}?"; then
    PARENT_DIR=$(dirname "${EXPECTED_PATH}")
    if [[ ! -d "${PARENT_DIR}" ]]; then
      sudo mkdir -p "${PARENT_DIR}"
    fi
    if [[ -e "${EXPECTED_PATH}" ]] && [[ ! -L "${EXPECTED_PATH}" ]]; then
      err "${EXPECTED_PATH} already exists and is not a symlink. Refusing to overwrite."
      err "Either remove it manually OR pick option B (rewrite paths)."
    else
      sudo ln -sfn "${ACTUAL_PATH}" "${EXPECTED_PATH}"
      ok "Symlink created: ${EXPECTED_PATH} → ${ACTUAL_PATH}"
    fi
  elif ask "Rewrite ${EXPECTED_PATH} → ${ACTUAL_PATH} in all tracked files?"; then
    grep -rl "${EXPECTED_PATH}" \
      "${ACTUAL_PATH}/SKILL.md" \
      "${ACTUAL_PATH}/CLAUDE.md" \
      "${ACTUAL_PATH}/ROADMAP.md" \
      "${ACTUAL_PATH}/FEEDBACK.md" \
      "${ACTUAL_PATH}/INSTALL.md" \
      "${ACTUAL_PATH}/.claude/settings.json" \
      "${ACTUAL_PATH}/scripts/" \
      "${ACTUAL_PATH}/templates/" 2>/dev/null \
    | while read -r file; do
        sed -i '' "s|${EXPECTED_PATH}|${ACTUAL_PATH}|g" "${file}"
        echo "      rewrote: ${file#${ACTUAL_PATH}/}"
      done
    ok "Path rewrite complete."
    warn "This puts your repo into a divergent state from origin/main. The rewrite is LOCAL — do NOT push it to origin/main; keep the canonical version pointing at /Users/tomasz/WebFactory."
    warn "If you want to keep the rewrite locally, commit it to a separate branch: 'git checkout -b local-paths && git commit -am \"Local path rewrite\"'"
  else
    warn "Path-portability skipped. The skill will likely misbehave because of stale absolute paths."
    warn "Re-run setup.sh to address this later, or do the symlink/rewrite manually."
  fi
fi

# ─── Step 10: Final reminder ─────────────────────────────────────────
step "Step 10 — Setup complete"
ok "All install steps finished."
echo ""
echo "${YELLOW}Important next steps:${RESET}"
echo "  1. Restart Claude Code so the frontend-design plugin loads cleanly"
echo "     (close + reopen any active Claude Code sessions)"
echo ""
echo "  2. Smoke test the install by running:"
echo ""
echo "       cd ${ACTUAL_PATH}"
echo "       claude"
echo "       /webfactory https://www.example.com --skip-c"
echo ""
echo "     The --skip-c flag skips Option C on first run (useful for verifying"
echo "     the basic A+B pipeline works before exercising the plugin)."
echo ""
echo "  3. See INSTALL.md for the full one-page guide and troubleshooting."
echo ""
