#!/bin/bash
# Usage: ./scripts/stitch.sh <tool_name> [json_data]
# Requires STITCH_API_KEY env var to be set.

if [ -z "$STITCH_API_KEY" ]; then
  echo "Error: STITCH_API_KEY environment variable is not set." >&2
  echo "Set it with: export STITCH_API_KEY=\"your-key\"" >&2
  exit 1
fi

export STITCH_API_KEY
if [ -z "$2" ]; then
  npx @_davideast/stitch-mcp tool "$1" 2>/dev/null
else
  npx @_davideast/stitch-mcp tool "$1" -d "$2" 2>/dev/null
fi
