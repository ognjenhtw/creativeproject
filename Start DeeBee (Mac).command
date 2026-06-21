#!/bin/bash
# Double-click this file. It will install everything the first time, then start the app.

cd "$(dirname "$0")/app" || { echo "Could not find the app folder."; read -p "Press enter to close..."; exit 1; }

# ── Node.js check ──────────────────────────────────────────────
if ! command -v node &> /dev/null; then
  osascript -e 'display alert "Node.js not installed" message "Please install Node.js from nodejs.org (LTS version), then double-click this file again."'
  open "https://nodejs.org/en/download/"
  read -p "Press enter to close..."
  exit 1
fi

# ── First-run dependency install ───────────────────────────────
if [ ! -d "node_modules" ]; then
  echo ""
  echo "First-time setup. Installing dependencies (1-2 minutes)..."
  echo ""
  npm install
fi

# ── Verify the Electron binary actually unpacked correctly ─────
# The .app bundle uses symlinks inside the Frameworks directory. npm's
# postinstall extraction sometimes leaves these broken, in which case
# we re-download the platform zip directly and extract it with ditto
# (the only macOS extractor that preserves the framework's symlinks).
FRAMEWORK="node_modules/electron/dist/Electron.app/Contents/Frameworks/Electron Framework.framework/Electron Framework"
PATH_TXT="node_modules/electron/path.txt"

if [ ! -f "$FRAMEWORK" ]; then
  echo ""
  echo "Electron's framework is missing or broken. Repairing the install..."
  echo ""
  rm -rf node_modules/electron/dist
  npm install electron@33.2.0 --no-save

  if [ ! -f "$FRAMEWORK" ]; then
    echo ""
    echo "npm couldn't finish the install. Downloading Electron directly from GitHub..."
    echo ""
    rm -rf node_modules/electron/dist
    mkdir -p node_modules/electron/dist
    ARCH=$(uname -m)
    if [ "$ARCH" = "arm64" ]; then
      URL="https://github.com/electron/electron/releases/download/v33.2.0/electron-v33.2.0-darwin-arm64.zip"
    else
      URL="https://github.com/electron/electron/releases/download/v33.2.0/electron-v33.2.0-darwin-x64.zip"
    fi
    curl -L -o /tmp/deebee-electron.zip "$URL"
    if [ ! -s /tmp/deebee-electron.zip ]; then
      echo ""
      echo "Could not download Electron from GitHub. Check your internet connection,"
      echo "then double-click this launcher again."
      echo ""
      read -p "Press enter to close..."
      exit 1
    fi
    ditto -x -k /tmp/deebee-electron.zip node_modules/electron/dist
    rm /tmp/deebee-electron.zip
  fi
fi

# ── Make sure path.txt always points the wrapper at the binary ─
if [ ! -s "$PATH_TXT" ] || [ "$(cat "$PATH_TXT" 2>/dev/null)" != "Electron.app/Contents/MacOS/Electron" ]; then
  printf "Electron.app/Contents/MacOS/Electron" > "$PATH_TXT"
fi

# ── Final check before launch ──────────────────────────────────
if [ ! -f "$FRAMEWORK" ]; then
  echo ""
  echo "Electron is still not installed correctly. This is unusual."
  echo "If you have antivirus or firewall software, try disabling it briefly and run again."
  echo ""
  read -p "Press enter to close..."
  exit 1
fi

echo ""
echo "Starting DeeBee..."
echo ""
npm start
