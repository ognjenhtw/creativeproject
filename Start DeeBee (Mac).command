#!/bin/bash
# Double-click this file. It will install everything the first time, then start the app.

cd "$(dirname "$0")/app"

# Check Node.js is installed
if ! command -v node &> /dev/null; then
  osascript -e 'display alert "Node.js not installed" message "Please install Node.js from nodejs.org (LTS version), then double-click this file again."'
  open "https://nodejs.org/en/download/"
  exit 1
fi

# Install dependencies on first run
if [ ! -d "node_modules" ]; then
  echo ""
  echo "First-time setup. Installing dependencies (1-2 minutes)..."
  echo ""
  npm install
fi

echo ""
echo "Starting DeeBee..."
echo ""
npm start
