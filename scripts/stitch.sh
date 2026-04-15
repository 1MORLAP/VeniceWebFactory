#!/bin/bash
# Usage: ./scripts/stitch.sh <tool_name> [json_data]
export STITCH_API_KEY="***REMOVED-STITCH-KEY***"
if [ -z "$2" ]; then
  npx @_davideast/stitch-mcp tool "$1" 2>/dev/null
else
  npx @_davideast/stitch-mcp tool "$1" -d "$2" 2>/dev/null
fi
