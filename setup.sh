#!/bin/bash
echo "Setting up WebFactory..."
npm install
npx playwright install chromium
mkdir -p jobs logs
mkdir -p ~/.claude/commands
cp SKILL.md ~/.claude/commands/webfactory.md
echo "Done! Open Claude Code in this directory and run: /webfactory <url>"
