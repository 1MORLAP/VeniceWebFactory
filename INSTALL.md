# WebFactory — Install Guide for a Fresh MacMini

Get the skill running on a new Mac in ~5 minutes (assuming Vercel auth + npm download speed cooperate).

---

## TL;DR — the 4 commands

If your username on the MacMini is `tomasz` (matches the canonical hardcoded paths in SKILL.md):

```bash
# 1. Install Claude Code first (one-time, manual download from Anthropic)
#    https://claude.com/claude-code

# 2. Clone WebFactory from GitHub
git clone https://github.com/1MORLAP/ClaudeWebFactory.git /Users/tomasz/WebFactory

# 3. Run the bootstrap script (installs Homebrew, Node, ffmpeg, Playwright,
#    the Frontend Design plugin, and prompts for Vercel login)
cd /Users/tomasz/WebFactory
./setup.sh

# 4. Smoke-test the install
claude
/webfactory https://www.example.com --skip-c
```

If your username is NOT `tomasz`, see "Step 4 — different username" below before running setup.sh.

---

## What you need before running setup.sh

| Required | How to get it |
|---|---|
| **macOS** (MacMini, MacBook, etc.) | This script doesn't support Linux/Windows — fork + adapt if needed |
| **Claude Code CLI** (`claude`) | Download from <https://claude.com/claude-code> |
| **An Anthropic account** with API access for Claude Code | Created during Claude Code first-run |
| **A Vercel account** with access to team `tomek-group` (or your equivalent) | If you don't have access, ask Tomasz to invite you, OR plan to update the team identifiers per "Different Vercel team" below |
| **GitHub access** to `1MORLAP/ClaudeWebFactory` | Currently a private repo — `git clone` will fail without auth (`gh auth login` or HTTPS token) |

Everything else (Homebrew, Node, ffmpeg, Playwright, the Frontend Design plugin) is auto-installed by `setup.sh`.

---

## What setup.sh does (10 idempotent steps)

| # | Step | What it does | Idempotent behavior |
|---|---|---|---|
| 0 | Platform check | Verifies macOS | exits if not macOS |
| 1 | Claude Code CLI check | Verifies `claude` is in PATH | exits with install link if missing |
| 2 | Homebrew | Installs if missing | skips if `brew` already works |
| 3 | Node.js v18+ | `brew install node` | skips if Node ≥ 18 already installed |
| 4 | ffmpeg | `brew install ffmpeg` (soft dep — used by future video splash transcode work) | skips if `ffmpeg` already installed |
| 5 | npm install | Downloads Playwright npm package | skips if `node_modules/playwright` exists |
| 6 | Playwright Chromium browser | `npx playwright install chromium` (~170MB) | skips if Chromium already in `~/Library/Caches/ms-playwright/` |
| 7 | Frontend Design plugin | `claude plugin install frontend-design@claude-plugins-official --scope project` | skips if plugin already in `~/.claude/plugins/cache/` |
| 8 | Vercel CLI auth + team scope | `npx vercel login` if not authed; verifies `tomek-group` team accessible | skips login if already authed |
| 9 | Path portability | Detects if repo is at `/Users/tomasz/WebFactory`; if not, offers symlink OR find-and-replace | offers no-op + warning if you decline |
| 10 | Final reminder | Tells you to restart Claude Code + smoke-test | always runs |

The script is **safe to re-run** — every step checks "already done?" before acting. If a step fails, you can fix the issue and re-run from the top; previously-completed steps will skip.

---

## Step 4 — different username on the MacMini

The repo's SKILL.md has 33 hardcoded references to `/Users/tomasz/WebFactory`. If your MacMini's username is NOT `tomasz`, you have three options (in order of cleanliness):

### Option A — Use the canonical path anyway (cleanest)

Clone to `/Users/tomasz/WebFactory` regardless of your actual username:

```bash
sudo mkdir -p /Users/tomasz
sudo chown $(whoami) /Users/tomasz/  # let your user write to /Users/tomasz/
git clone https://github.com/1MORLAP/ClaudeWebFactory.git /Users/tomasz/WebFactory
cd /Users/tomasz/WebFactory
./setup.sh
```

The `/Users/tomasz/` directory will exist alongside `/Users/yourusername/`. WebFactory lives in the `tomasz` directory but you operate as your own user.

### Option B — Symlink (almost as clean)

Clone wherever you want, then symlink at install time:

```bash
git clone https://github.com/1MORLAP/ClaudeWebFactory.git ~/WebFactory
cd ~/WebFactory
./setup.sh
# When the path-portability step asks, choose (A) symlink. The script handles
# the sudo + symlink creation for you.
```

### Option C — Find-and-replace (creates divergence from main)

Clone wherever you want, then let setup.sh rewrite all 33+ references:

```bash
git clone https://github.com/1MORLAP/ClaudeWebFactory.git ~/WebFactory
cd ~/WebFactory
./setup.sh
# When the path-portability step asks, choose (B) rewrite.
```

**Important if you choose Option C**: the rewrite creates a divergent local state. Do NOT push the rewritten paths back to `origin/main` — keep that as the canonical `/Users/tomasz/WebFactory` version. If you want to keep your rewrite locally, commit it to a separate branch:

```bash
git checkout -b local-paths
git add -A
git commit -m "Local path rewrite for $(pwd)"
```

---

## Different Vercel team (if you don't have access to tomek-group)

If your MacMini uses a different Vercel account that doesn't have access to `tomek-group`, update these references:

| File | What to change |
|---|---|
| `SKILL.md` | Find every occurrence of `tomek-group` (slug) and `team_4Hr5Lqd6pY5D7gmeXDVsDmYx` (ID) — replace with your team's slug + ID. Get your team ID from `npx vercel teams ls` or by inspecting any `.vercel/project.json` after a deploy. |
| `CLAUDE.md` | Same search-and-replace for both identifiers in the "Vercel Teams Configuration" section. |

After updating, the Vercel-related setup.sh checks will pass and your deploys will go to your team.

---

## Troubleshooting

### "claude: command not found"

Claude Code CLI isn't installed or isn't in PATH. Install from <https://claude.com/claude-code> and verify with `claude --version`.

### "npm install" hangs or fails

Slow network usually. Re-run setup.sh — npm install will resume. If consistently failing, check `~/.npmrc` for stale registry overrides.

### "npx playwright install chromium" downloads 170MB and fails

Network issue. Re-run setup.sh. The download is resumable.

### Vercel login opens a browser but doesn't return

Check your email for the login confirmation link. After clicking, the CLI session continues. If the CLI seems stuck, Ctrl+C and re-run `npx vercel login`.

### "Team 'tomek-group' not found" warning

You're logged into Vercel as the wrong user, OR your account doesn't have access. Either:
- `npx vercel logout && npx vercel login` and pick the right account
- OR ask Tomasz to invite you to the team (you'd give him your Vercel account email)
- OR follow "Different Vercel team" above to point everything at your own team

### `/webfactory` slash command not recognized in Claude Code

Restart Claude Code (close all sessions + reopen). The skill is loaded from the SKILL.md frontmatter when Claude Code starts a fresh session in this directory. If still missing, verify SKILL.md exists at the repo root and the frontmatter has `name: webfactory`.

### Frontend Design plugin shows "0% usage" in Claude Code's quota panel after a build

The build either skipped Stage 7 (used `--skip-c`?) or the plugin failed to engage. Check `~/.claude/plugins/cache/claude-plugins-official/frontend-design/` exists; if not, re-run `claude plugin install frontend-design@claude-plugins-official --scope project`.

---

## After setup completes

1. **Restart Claude Code** so the plugin loads cleanly. Close any existing Claude Code sessions and reopen.

2. **Verify with a smoke test**:
   ```bash
   cd /Users/tomasz/WebFactory   # or wherever you cloned
   claude
   /webfactory https://www.example.com --skip-c
   ```
   The `--skip-c` flag tests the A + B pipeline without engaging the Frontend Design plugin (useful for first-run verification).

3. **First real run**: pick a customer URL and run without `--skip-c`:
   ```
   /webfactory https://www.acmeplumbing.com
   ```
   Wait ~10–20 minutes for the full A + B + C pipeline to scrape, build, deploy. Final report shows 4 clickable links.

4. **Read SKILL.md** before doing anything custom. The architecture, rules, and per-stage behaviors are all documented there. ROADMAP.md gives the historical context. FEEDBACK.md shows every shipped fix and the user feedback that drove it.

---

## Backup discipline (going forward)

The skill auto-backs up to GitHub via the Self-Learning Protocol's "🔄 Auto-backup contract" — every `/webfactory-learn` session ends with `git commit && git push origin main`. You don't need to remember to commit; it's baked into the protocol.

If you need to back up manually (e.g., a manual edit to SKILL.md outside a `/webfactory-learn` flow):

```bash
cd /Users/tomasz/WebFactory
git add -A
git commit -m "Manual edit: {what changed and why}"
git push origin main
```

The `.gitignore` excludes `jobs/` (9GB+ of customer data, regeneratable) and per-user files (`.claude/settings.local.json`, etc.), so `git add -A` is safe.

---

## What lives where (orientation)

```
/Users/tomasz/WebFactory/
├── SKILL.md                  ← THE pipeline definition (canonical)
├── CLAUDE.md                 ← project memory (auto-loaded by Claude Code)
├── ROADMAP.md                ← architecture history + planned work
├── FEEDBACK.md               ← every shipped fix with verbatim user feedback
├── INSTALL.md                ← THIS FILE
├── setup.sh                  ← bootstrap script (re-runnable)
├── package.json              ← Playwright + Astro deps
├── .gitignore                ← excludes jobs/, node_modules/, settings.local.json, orphans
├── .claude/
│   └── settings.json         ← Claude Code permissions (committed); enabledPlugins
├── scripts/                  ← helper scripts (qa-check.js, scrape.js, etc.)
├── templates/
│   ├── scaffold/             ← copied per-build (pure scaffold, ZERO visual opinions)
│   ├── REQUIRED-PATTERNS.md  ← structural contract every build must satisfy
│   └── inspiration/          ← read-only design references (saas-default, industrial-trades)
├── jobs/                     ← per-job working dirs (gitignored — regeneratable)
└── docs/
    └── option-a-process.md   ← detailed Option A walkthrough (defer to SKILL.md if conflict)
```
