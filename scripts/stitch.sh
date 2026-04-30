#!/bin/bash
# Usage: ./scripts/stitch.sh <tool_name> [json_data]
# NOTE: Stitch was retired 2026-04-24. This script is orphaned.
# STITCH_API_KEY must be set in the environment if you really need to run it.

if [ -z "$STITCH_API_KEY" ]; then
  echo "Error: STITCH_API_KEY environment variable is not set." >&2
  exit 1
fi

if [ -z "$2" ]; then
  npx @_davideast/stitch-mcp tool "$1" 2>/dev/null
else
  npx @_davideast/stitch-mcp tool "$1" -d "$2" 2>/dev/null
fi
