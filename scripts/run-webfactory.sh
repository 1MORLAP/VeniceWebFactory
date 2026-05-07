#!/usr/bin/env bash
# run-webfactory.sh — wrapper for unattended /webfactory builds (Phase F.5)
#
# Built 2026-05-07 after the lisastephens G.2+G.5 build sat 8 hours waiting on
# a permission prompt that --permission-mode bypassPermissions didn't bypass.
# The default `nohup claude -p ... &` pattern captures stdout but the user
# has no easy way to discover the log path, watch for prompts, or detect
# idle hangs. This wrapper standardizes all three.
#
# What it does:
#   1. Launches `claude -p "/webfactory <url> <flags>"` with full
#      stdout+stderr capture into a predictable log path
#      (/tmp/webfactory-<domain>-<timestamp>.log)
#   2. Prints a clear "tail -f" instruction so the operator can monitor
#      from another terminal and see any blocking prompt within seconds
#   3. Spawns a background watchdog that polls log freshness every 60s.
#      If the log hasn't grown for IDLE_LIMIT seconds (default 1800 = 30
#      min), kills the build with TERM then KILL, and writes a final
#      WATCHDOG note to the log naming the last few lines (which usually
#      contain the blocking prompt).
#
# Usage:
#   scripts/run-webfactory.sh <url> [/webfactory flags]
#   scripts/run-webfactory.sh http://www.example.com/ --full
#   scripts/run-webfactory.sh http://www.example.com/ --full --skip-c
#
# Environment overrides:
#   IDLE_LIMIT=<seconds>   default 1800 (30 min). Maximum gap without log
#                          activity before the watchdog kills the build.
#                          Stage 7 can take ~15 min between events; 30 min
#                          is the safe upper bound. Set higher for
#                          14+-page sites or lower for tight diagnostic
#                          loops.
#   LOG_DIR=<path>         default /tmp. Where the wrapper writes its log.
#   NO_WATCHDOG=1          disable the idle watchdog. Use only for
#                          interactive debugging where you'll babysit.
#
# Exit codes:
#   0 — wrapper successfully launched the build (does NOT mean the build
#       completed successfully — it ran in background; check the log)
#   1 — bad CLI args
#   2 — `claude` binary not on PATH

set -e

URL="$1"
shift || true
FLAGS=("$@")

if [ -z "$URL" ]; then
  echo "Usage: $0 <url> [/webfactory flags]"
  echo "  e.g., $0 http://www.example.com/ --full"
  echo "  e.g., $0 http://www.example.com/ --full --skip-c"
  exit 1
fi

if ! command -v claude > /dev/null 2>&1; then
  echo "✗ \`claude\` binary not found on PATH"
  echo "  Install Claude Code first: https://claude.com/claude-code"
  exit 2
fi

REPO_ROOT=$(cd "$(dirname "$0")/.." && pwd)
LOG_DIR="${LOG_DIR:-/tmp}"
IDLE_LIMIT="${IDLE_LIMIT:-1800}"
DOMAIN=$(node "${REPO_ROOT}/scripts/url-to-domain.cjs" "$URL" 2>/dev/null || echo "unknown")
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
LOG="${LOG_DIR}/webfactory-${DOMAIN}-${TIMESTAMP}.log"

# Build the /webfactory command string with optional flags.
WEBFACTORY_CMD="/webfactory $URL"
for f in "${FLAGS[@]}"; do
  WEBFACTORY_CMD="$WEBFACTORY_CMD $f"
done

cat <<HEADER > "$LOG"
═══════════════════════════════════════════════════════════════════════
  WebFactory unattended build (run-webfactory.sh wrapper, Phase F.5)
═══════════════════════════════════════════════════════════════════════

URL:         $URL
Domain:      $DOMAIN
Flags:       ${FLAGS[*]:-(none)}
Started:     $(date -u +"%Y-%m-%dT%H:%M:%SZ")
Log:         $LOG
Idle limit:  $IDLE_LIMIT seconds ($((IDLE_LIMIT / 60)) min)
Watchdog:    $([ "$NO_WATCHDOG" = "1" ] && echo "disabled" || echo "enabled")

Tail this log from another terminal to see prompts in real time:
  tail -f $LOG

If a permission prompt appears that --permission-mode bypassPermissions
didn't suppress, it will land in this log. Copy the prompt text and the
last few lines preceding it; that's the diagnostic data needed to figure
out which prompt class is leaking past bypass mode.

═══════════════════════════════════════════════════════════════════════

HEADER

# Launch the build in the background. CRITICAL: the redirection chain is
#   exec > >(tee -a "$LOG") 2>&1
# inside the subshell so BOTH stdout and stderr land in the log AND the
# subshell's terminal. We use `nohup` to detach from the parent shell so
# the build survives the wrapper's exit (the wrapper exits immediately
# after launching; the background subprocess runs to completion or until
# the watchdog kills it).
nohup bash -c "
  exec >> '$LOG' 2>&1
  claude -p '$WEBFACTORY_CMD' \\
    --model opus \\
    --permission-mode bypassPermissions \\
    --add-dir '$REPO_ROOT'
  echo ''
  echo '═══════════════════════════════════════════════════════════════════════'
  echo 'Build subprocess exited at \$(date -u +\"%Y-%m-%dT%H:%M:%SZ\")'
  echo '═══════════════════════════════════════════════════════════════════════'
" > /dev/null 2>&1 &
BUILD_PID=$!
disown $BUILD_PID 2>/dev/null || true

# Print launch summary to the user's terminal.
cat <<LAUNCH
✓ WebFactory build launched

  PID:    $BUILD_PID
  Log:    $LOG
  Tail:   tail -f $LOG

Watch the log for prompts or progress events. Stage milestones land in
jobs/$DOMAIN/orchestration.log (one JSON line per event).

LAUNCH

# Watchdog: poll log file size every 60s. If it hasn't changed for
# IDLE_LIMIT seconds, the build is hung — typically on a permission prompt
# that bypassPermissions didn't suppress. Kill the build and append a
# diagnostic note to the log so the operator can see the last lines
# (which usually contain the prompt text).
if [ "$NO_WATCHDOG" != "1" ]; then
  # Phase F.5 v2 (2026-05-07): the prior watchdog watched only the wrapper
  # stdout log file. That went silent during long Opus API waits (Stage
  # 2.5 specs takes 7-15 min of subprocess sleep with no stdout). Real
  # bug observed 2026-05-07: johnsepticservice A/B builds got killed at
  # 30-min idle even though orchestration.log was actively growing
  # (Stage 2.5 + Stage 3 progressing).
  #
  # Fix: watchdog also watches `jobs/{DOMAIN}*/orchestration.log` (glob
  # so --ab=preset suffixed dirs are covered). If EITHER the wrapper
  # log OR any matching orchestration.log was modified within IDLE_LIMIT,
  # the build is alive. Only kill when BOTH have gone idle.
  nohup bash -c "
    LAST_TS=0
    IDLE_SECS=0
    while kill -0 $BUILD_PID 2>/dev/null; do
      sleep 60
      # Most-recent mtime across the wrapper log + any
      # jobs/{DOMAIN}*/orchestration.log matching this domain.
      LATEST=0
      for path in '$LOG' /Users/tomasz/WebFactory/jobs/$DOMAIN/orchestration.log /Users/tomasz/WebFactory/jobs/$DOMAIN-ab-*/orchestration.log; do
        if [ -f \"\$path\" ]; then
          M=\$(stat -f '%m' \"\$path\" 2>/dev/null || stat -c '%Y' \"\$path\" 2>/dev/null || echo 0)
          if [ \"\$M\" -gt \"\$LATEST\" ]; then LATEST=\$M; fi
        fi
      done
      if [ \"\$LATEST\" -gt \"\$LAST_TS\" ]; then
        IDLE_SECS=0
        LAST_TS=\$LATEST
      else
        IDLE_SECS=\$((IDLE_SECS + 60))
        if [ \"\$IDLE_SECS\" -ge $IDLE_LIMIT ]; then
          echo '' >> '$LOG'
          echo '═══════════════════════════════════════════════════════════════════════' >> '$LOG'
          echo \"  ✗ WATCHDOG: wrapper-log AND orchestration.log both stale for $IDLE_LIMIT sec — killing PID $BUILD_PID\" >> '$LOG'
          echo '═══════════════════════════════════════════════════════════════════════' >> '$LOG'
          tail -50 '$LOG' > '$LOG.last-50-before-kill' 2>/dev/null
          kill -TERM $BUILD_PID 2>/dev/null
          sleep 5
          kill -KILL $BUILD_PID 2>/dev/null
          exit 1
        fi
      fi
    done
  " > /dev/null 2>&1 &
  WATCHDOG_PID=$!
  disown $WATCHDOG_PID 2>/dev/null || true
  echo "  Watchdog PID: $WATCHDOG_PID  (kills build if wrapper-log AND orchestration.log both stale >$IDLE_LIMIT sec)"
fi

echo ""
exit 0
