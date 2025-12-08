#!/bin/bash
# OnlyOffice WASM Setup Script
# Sets up x2t-wasm converter and OnlyOffice web editors
# Works with Git LFS (cloned repo) or downloads from GitHub releases

set -e

echo "OnlyOffice WASM Setup"
echo "====================="
echo ""
echo "IMPORTANT: This script requires Git LFS to download large binary files."
echo "If you haven't installed Git LFS yet, run:"
echo ""
echo "  macOS:  brew install git-lfs && git lfs install"
echo "  Linux:  sudo apt-get install git-lfs && git lfs install"
echo "  Other:  Visit https://git-lfs.github.com/ for installation instructions"
echo ""
echo "If you already cloned this repo, run: git lfs pull"
echo ""

# URLs for downloading (fallback if not using Git LFS)
# These are fallback public releases in case Git LFS files are unavailable
X2T_URL="https://github.com/nicbarker/x2t-wasm/releases/download/v8.3.0%2B0/x2t.zip"
OO_URL="https://github.com/nicbarker/x2t-wasm/releases/download/v8.3.0%2B0/cryptpad_onlyoffice_v8.zip"

# Function to check if a file is a Git LFS pointer
is_lfs_pointer() {
    if [ ! -f "$1" ]; then
        return 1
    fi
    head -1 "$1" 2>/dev/null | grep -q "^version https://git-lfs"
}

# Function to check if Git LFS is installed
has_git_lfs() {
    git lfs version >/dev/null 2>&1
}

# Function to check if we're in a git repo
is_git_repo() {
    [ -d ".git" ]
}

# Create directories
echo ""
echo "[1/5] Creating directories..."
mkdir -p public/onlyoffice
mkdir -p output
echo "Directories ready!"

# Check for Git LFS and pull files if needed
echo ""
echo "[2/5] Checking Git LFS..."

if is_git_repo; then
    if has_git_lfs; then
        echo "✓ Git LFS detected. Pulling LFS files..."
        git lfs pull
        echo "✓ Git LFS files pulled!"
    else
        echo "✗ Git LFS not installed!"
        echo ""
        echo "To install Git LFS, run:"
        echo "  macOS:  brew install git-lfs && git lfs install"
        echo "  Linux:  sudo apt-get install git-lfs && git lfs install"
        echo "  Other:  Visit https://git-lfs.github.com/"
        echo ""
        echo "Then run this setup script again."
        exit 1
    fi
else
    echo "✗ Not in a git repository. Cannot verify LFS files."
    echo "Please clone the repository properly or pull LFS files manually."
    exit 1
fi

# Setup x2t-wasm
echo ""
echo "[3/5] Setting up x2t-wasm converter..."

needs_x2t=false
if [ ! -f "x2t.wasm" ] || [ ! -f "x2t.js" ]; then
    needs_x2t=true
elif is_lfs_pointer "x2t.wasm" || is_lfs_pointer "x2t.js"; then
    echo "✗ LFS pointer files detected instead of actual files!"
    echo "This means Git LFS files were not downloaded properly."
    echo ""
    echo "To fix this, run:"
    echo "  git lfs install"
    echo "  git lfs pull"
    echo ""
    echo "Then run this setup script again."
    exit 1
elif [ $(stat -f%z "x2t.wasm" 2>/dev/null || stat -c%s "x2t.wasm" 2>/dev/null) -lt 1000000 ]; then
    echo "✗ x2t.wasm seems incomplete, re-downloading..."
    needs_x2t=true
fi

if [ "$needs_x2t" = true ]; then
    # Attempt Git LFS pull again
    echo "Attempting to pull x2t files from Git LFS..."
    git lfs pull --include="x2t.wasm,x2t.js"
    
    # Verify we got the files
    x2t_size=$(stat -f%z "x2t.wasm" 2>/dev/null || stat -c%s "x2t.wasm" 2>/dev/null || echo "0")
    if [ "$x2t_size" -gt 1000000 ]; then
        echo "✓ x2t-wasm ready from Git LFS!"
    else
        echo "✗ Failed to pull x2t-wasm from Git LFS."
        echo "Falling back to GitHub download (public release)..."
        curl -L -o x2t.zip "$X2T_URL"
        echo "✓ Extracting x2t-wasm..."
        unzip -o x2t.zip
        rm -f x2t.zip
        echo "✓ x2t-wasm ready from GitHub!"
    fi
else
    echo "✓ x2t-wasm already exists, skipping."
fi

# Setup OnlyOffice editors
echo ""
echo "[4/5] Setting up OnlyOffice web editors..."

if [ ! -d "public/onlyoffice/v8" ]; then
    OO_ZIP="onlyoffice-editor.zip"
    
    # Check if we have the zip file (from LFS or previous download)
    zip_size=$(stat -f%z "$OO_ZIP" 2>/dev/null || stat -c%s "$OO_ZIP" 2>/dev/null || echo "0")
    
    if [ "$zip_size" -gt 1000000 ]; then
        echo "✓ Found onlyoffice-editor.zip, extracting..."
    else
        # Check for LFS pointer file
        if is_lfs_pointer "$OO_ZIP"; then
            echo "✗ Found LFS pointer file instead of actual archive!"
            echo "Running git lfs pull to download the file..."
            git lfs pull --include="onlyoffice-editor.zip"
        fi
        
        # Verify we got it
        zip_size=$(stat -f%z "$OO_ZIP" 2>/dev/null || stat -c%s "$OO_ZIP" 2>/dev/null || echo "0")
        if [ "$zip_size" -lt 1000000 ]; then
            echo "Falling back to GitHub download (public release)..."
            curl -L -o "$OO_ZIP" "$OO_URL"
        fi
    fi
    
    echo "✓ Extracting OnlyOffice editors (this may take a while)..."
    unzip -o "$OO_ZIP" -d public/onlyoffice/
    echo "✓ OnlyOffice editors ready!"
else
    echo "✓ OnlyOffice editors already exist, skipping."
fi

# Install npm dependencies
echo ""
echo "[5/5] Installing npm dependencies..."
npm install

echo ""
echo "====================="
echo "✓ Setup complete!"
echo "====================="
echo ""
echo "To start the server, run:"
echo "  node server.js"
echo ""
echo "Then open http://localhost:8080 in your browser."
echo ""
echo "For development details, see DEVELOPER_GUIDE.txt"
echo ""