#!/bin/bash
# setup-permissions.sh — One-time permission grant for WebFactory
# Run this ONCE in Terminal.app (not via Discord)
# After running, restart Terminal completely

echo "=================================="
echo "  WebFactory Permission Setup"
echo "=================================="
echo ""
echo "This script opens System Preferences."
echo "Follow these steps:"
echo ""
echo "1. Click the LOCK bottom-left, enter your password"
echo "2. Find your terminal app (Terminal.app or iTerm.app)"
echo "3. CHECK the box next to it"
echo "4. Click the LOCK again to save"
echo "5. QUIT and REOPEN Terminal"
echo ""
read -p "Press Enter to open Screen Recording settings..."

open "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenRecording"

echo ""
echo "After granting Screen Recording, press Enter to open Accessibility..."
read -p ""

open "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"

echo ""
echo "=================================="
echo "  IMPORTANT: Restart Terminal now!"
echo "=================================="
echo ""
echo "After restarting Terminal, verify with:"
echo "  cd ~/VeniceWebFactory && python3 scripts/verify-playwright.py"
