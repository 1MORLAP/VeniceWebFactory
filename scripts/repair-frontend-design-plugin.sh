#!/usr/bin/env bash
# repair-frontend-design-plugin.sh — fix Claude Design quota attribution
#
# The frontend-design@claude-plugins-official plugin has a recurring
# upstream marketplace bug: its install metadata is missing a
# "version" field, so Claude Code's installer falls back to literal
# "unknown" for both the cache directory name and the
# installed_plugins.json version field.
#
# Consequence: Anthropic's telemetry can't attribute plugin invocations
# to the Claude Design product. The user's "Weekly · Claude Design"
# quota meter stays at 0% while plugin invocations consume from
# "Weekly · all models" general API quota.
#
# Real bug filed 2026-04-29; reproduced 2026-05-07 after a fresh
# `claude plugin install` again resolved to "unknown".
#
# Fix: patch local files (.claude-plugin/plugin.json + installed_plugins.json)
# to declare version "1.0.0". The plugin code itself is byte-identical
# between the upstream-broken install and the working 1.0.0 install
# (verified via `diff -q`). Only the metadata changes.
#
# Usage:
#   bash scripts/repair-frontend-design-plugin.sh
#
# Run after any `claude plugin install frontend-design@claude-plugins-official`
# until the upstream marketplace fix lands.
#
# Idempotent: safe to re-run; skips if version is already not "unknown".

set -e

INSTALLED_JSON="$HOME/.claude/plugins/installed_plugins.json"
PLUGIN_DIR="$HOME/.claude/plugins/cache/claude-plugins-official/frontend-design/unknown"
PLUGIN_JSON="$PLUGIN_DIR/.claude-plugin/plugin.json"

if [ ! -f "$INSTALLED_JSON" ]; then
  echo "Error: Claude Code installed_plugins.json not found at $INSTALLED_JSON"
  echo "Install plugin first: claude plugin install frontend-design@claude-plugins-official"
  exit 1
fi

CURRENT_VERSION=$(node -e "
const d = JSON.parse(require('fs').readFileSync('$INSTALLED_JSON', 'utf8'));
const entries = d.plugins['frontend-design@claude-plugins-official'] || [];
const versions = [...new Set(entries.map(e => e.version))];
console.log(versions.join(','));
")

if [ -z "$CURRENT_VERSION" ]; then
  echo "Error: frontend-design plugin not registered in installed_plugins.json"
  echo "Install first: claude plugin install frontend-design@claude-plugins-official"
  exit 1
fi

case "$CURRENT_VERSION" in
  unknown|*unknown*)
    echo "Repairing frontend-design plugin (version: $CURRENT_VERSION -> 1.0.0)"
    ;;
  *)
    echo "Plugin version already set to '$CURRENT_VERSION' - no repair needed."
    exit 0
    ;;
esac

if [ -f "$PLUGIN_JSON" ]; then
  cp "$PLUGIN_JSON" "$PLUGIN_JSON.pre-repair.bak"
  node -e "
const fs = require('fs');
const path = '$PLUGIN_JSON';
const plugin = JSON.parse(fs.readFileSync(path, 'utf8'));
if (!plugin.version) plugin.version = '1.0.0';
const out = {
  name: plugin.name,
  version: plugin.version,
  description: plugin.description,
  author: plugin.author,
  ...plugin,
};
fs.writeFileSync(path, JSON.stringify(out, null, 2));
console.log('  patched ' + path);
"
else
  echo "  Note: plugin.json not found at $PLUGIN_JSON - skipping"
fi

cp "$INSTALLED_JSON" "$INSTALLED_JSON.pre-repair.bak"
node -e "
const fs = require('fs');
const path = '$INSTALLED_JSON';
const d = JSON.parse(fs.readFileSync(path, 'utf8'));
const entries = d.plugins['frontend-design@claude-plugins-official'] || [];
let patched = 0;
for (const e of entries) {
  if (e.version === 'unknown') {
    e.version = '1.0.0';
    patched++;
  }
}
fs.writeFileSync(path, JSON.stringify(d, null, 2));
console.log('  patched ' + path + ' (' + patched + ' entry/ies)');
"

echo ""
echo "Repair complete. Restart Claude Code sessions for change to take effect."
echo ""
echo "Verify:"
echo "  cat ~/.claude/plugins/installed_plugins.json | grep -A 4 frontend-design"
