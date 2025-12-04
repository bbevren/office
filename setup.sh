#!/bin/bash
# OnlyOffice WASM Setup Script
# Downloads x2t-wasm converter and OnlyOffice web editors

set -e

echo "OnlyOffice WASM Setup"
echo "====================="

# Create directories
mkdir -p public/onlyoffice

# Download x2t-wasm
echo ""
echo "[1/3] Downloading x2t-wasm converter..."
X2T_URL="https://github.com/nicbarker/x2t-wasm/releases/download/v8.3.0%2B0/x2t.zip"

if [ ! -f "x2t.wasm" ] || [ ! -f "x2t.js" ]; then
    curl -L -o x2t.zip "$X2T_URL"
    echo "Extracting x2t-wasm..."
    unzip -o x2t.zip
    echo "x2t-wasm ready!"
else
    echo "x2t-wasm already exists, skipping."
fi

# Download OnlyOffice editors
echo ""
echo "[2/3] Downloading OnlyOffice web editors..."
OO_URL="https://github.com/nicbarker/x2t-wasm/releases/download/v8.3.0%2B0/cryptpad_onlyoffice_v8.zip"

if [ ! -d "public/onlyoffice/v8" ]; then
    curl -L -o onlyoffice-editor.zip "$OO_URL"
    echo "Extracting OnlyOffice editors (this may take a while)..."
    unzip -o onlyoffice-editor.zip -d public/onlyoffice/
    echo "OnlyOffice editors ready!"
else
    echo "OnlyOffice editors already exist, skipping."
fi

# Install npm dependencies
echo ""
echo "[3/3] Installing npm dependencies..."
npm install

echo ""
echo "====================="
echo "Setup complete!"
echo ""
echo "To start the server, run:"
echo "  node server.js"
echo ""
echo "Then open http://localhost:8080 in your browser."
