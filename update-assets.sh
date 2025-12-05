#!/bin/bash
# Update Assets Script
# Re-creates zip files from the extracted folders for Git LFS
# Run this BEFORE committing when you've made changes to OnlyOffice files

set -e

echo "Update Assets for Git LFS"
echo "=========================="

# Check if OnlyOffice editor folder exists
if [ -d "public/onlyoffice/v8" ]; then
    echo ""
    echo "Checking OnlyOffice editor files..."
    
    if [ -f "onlyoffice-editor.zip" ]; then
        # Find if any file is newer than the zip
        newer_files=$(find public/onlyoffice -newer onlyoffice-editor.zip -type f | head -1)
        if [ -n "$newer_files" ]; then
            echo "  Files modified since last zip."
        else
            echo "  No changes detected."
        fi
    else
        echo "  No zip file exists."
    fi
fi

# Ask user what to do
echo ""
echo "What would you like to update?"
echo "  1. OnlyOffice editor (public/onlyoffice/ -> onlyoffice-editor.zip)"
echo "  2. All assets"
echo "  3. Cancel"
read -p "Enter choice (1/2/3): " choice

update_oo=false

case $choice in
    1) update_oo=true ;;
    2) update_oo=true ;;
    3) echo "Cancelled."; exit 0 ;;
    *) echo "Invalid choice."; exit 1 ;;
esac

# Update OnlyOffice editor zip
if [ "$update_oo" = true ]; then
    echo ""
    echo "Creating onlyoffice-editor.zip..."
    
    if [ -d "public/onlyoffice/v8" ]; then
        # Remove old zip
        rm -f onlyoffice-editor.zip
        
        # Create new zip
        echo "  Compressing public/onlyoffice/v8/..."
        echo "  This may take a few minutes..."
        
        cd public/onlyoffice
        zip -r ../../onlyoffice-editor.zip v8 -q
        cd ../..
        
        size=$(du -h onlyoffice-editor.zip | cut -f1)
        echo "  Created onlyoffice-editor.zip ($size)"
    else
        echo "  ERROR: public/onlyoffice/v8 folder not found!"
        exit 1
    fi
fi

# Show status
echo ""
echo "=========================="
echo "Done! Git LFS status:"
echo ""

# Show file sizes
[ -f "onlyoffice-editor.zip" ] && echo "  onlyoffice-editor.zip: $(du -h onlyoffice-editor.zip | cut -f1)"
[ -f "x2t.wasm" ] && echo "  x2t.wasm: $(du -h x2t.wasm | cut -f1)"
[ -f "x2t.js" ] && echo "  x2t.js: $(du -h x2t.js | cut -f1)"

echo ""
echo "Next steps:"
echo "  1. Review changes: git status"
echo "  2. Stage files:    git add ."
echo "  3. Commit:         git commit -m 'Update OnlyOffice assets'"
echo "  4. Push:           git push (LFS will upload large files)"
