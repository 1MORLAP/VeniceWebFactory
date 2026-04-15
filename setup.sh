#!/bin/bash
echo "Setting up WebFactory..."
npm install
npx playwright install chromium
mkdir -p jobs logs
mkdir -p ~/.claude/commands
cp SKILL.md ~/.claude/commands/webfactory.md

echo ""
echo "=== Setup complete ==="
echo ""
echo "For Option B (Stitch AI), set your API key:"
echo "  export STITCH_API_KEY=\"your-key-here\""
echo "  (or copy .env.example to .env and source it)"
echo ""
echo "Open Claude Code in this directory and run:"
echo "  /webfactory <url>"
