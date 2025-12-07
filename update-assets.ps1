# Update Assets Script
# Re-creates zip files from the extracted folders for Git LFS
# Run this BEFORE committing when you've made changes to OnlyOffice files
# Run with -Restore after reverting a commit to extract from zip
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
param(
    [switch]$Restore  # Use -Restore to extract zip back to folder (after git revert)
)

$ErrorActionPreference = "Stop"

Write-Host "OnlyOffice Assets Manager" -ForegroundColor Cyan
Write-Host "==========================" -ForegroundColor Cyan

# RESTORE MODE: Extract zip to folder (after git revert)
if ($Restore) {
    Write-Host "`nRESTORE MODE: Extracting zip files to folders..." -ForegroundColor Yellow
    
    if (Test-Path "onlyoffice-editor.zip") {
        Write-Host "  Removing old public/onlyoffice/ folder..." -ForegroundColor Gray
        Remove-Item "public/onlyoffice" -Recurse -Force -ErrorAction SilentlyContinue
        New-Item -ItemType Directory -Path "public/onlyoffice" -Force | Out-Null
        
        Write-Host "  Extracting onlyoffice-editor.zip..." -ForegroundColor Gray
        Expand-Archive -Path "onlyoffice-editor.zip" -DestinationPath "public/onlyoffice" -Force
        
        Write-Host "  Done! Folder restored from zip." -ForegroundColor Green
    } else {
        Write-Host "  ERROR: onlyoffice-editor.zip not found!" -ForegroundColor Red
        Write-Host "  Run ./setup.ps1 to download it." -ForegroundColor Yellow
    }
    
    Write-Host "`nRestore complete!" -ForegroundColor Green
    exit 0
}

# NORMAL MODE: Create zip from folder

# Check what needs updating
$updateOO = $false
$updateX2t = $false

# Check if OnlyOffice editor folder exists and has been modified
if (Test-Path "public/onlyoffice/v8") {
    Write-Host "`nChecking OnlyOffice editor files..." -ForegroundColor Yellow
    
    if (Test-Path "onlyoffice-editor.zip") {
        $zipDate = (Get-Item "onlyoffice-editor.zip").LastWriteTime
        $newestFile = Get-ChildItem "public/onlyoffice" -Recurse -File | 
                      Sort-Object LastWriteTime -Descending | 
                      Select-Object -First 1
        
        if ($newestFile -and $newestFile.LastWriteTime -gt $zipDate) {
            Write-Host "  Files modified since last zip. Will update." -ForegroundColor Gray
            $updateOO = $true
        } else {
            Write-Host "  No changes detected." -ForegroundColor Gray
        }
    } else {
        Write-Host "  No zip file exists. Will create." -ForegroundColor Gray
        $updateOO = $true
    }
}

# Ask user what to do
Write-Host ""
Write-Host "What would you like to update?" -ForegroundColor White
Write-Host "  1. OnlyOffice editor (public/onlyoffice/ -> onlyoffice-editor.zip)" -ForegroundColor Gray
Write-Host "  2. All assets" -ForegroundColor Gray
Write-Host "  3. Cancel" -ForegroundColor Gray
$choice = Read-Host "Enter choice (1/2/3)"

switch ($choice) {
    "1" { $updateOO = $true }
    "2" { $updateOO = $true }
    "3" { 
        Write-Host "Cancelled." -ForegroundColor Yellow
        exit 0
    }
    default {
        Write-Host "Invalid choice." -ForegroundColor Red
        exit 1
    }
}

# Update OnlyOffice editor zip
if ($updateOO) {
    Write-Host "`nCreating onlyoffice-editor.zip..." -ForegroundColor Yellow
    
    if (Test-Path "public/onlyoffice/v8") {
        # Remove old zip
        if (Test-Path "onlyoffice-editor.zip") {
            Remove-Item "onlyoffice-editor.zip" -Force
        }
        
        # Create new zip (just the v8 folder contents)
        Write-Host "  Compressing public/onlyoffice/v8/..." -ForegroundColor Gray
        Write-Host "  This may take a few minutes..." -ForegroundColor Gray
        
        Compress-Archive -Path "public/onlyoffice/v8" -DestinationPath "onlyoffice-editor.zip" -CompressionLevel Optimal
        
        $size = [math]::Round((Get-Item "onlyoffice-editor.zip").Length / 1MB, 2)
        Write-Host "  Created onlyoffice-editor.zip ($size MB)" -ForegroundColor Green
    } else {
        Write-Host "  ERROR: public/onlyoffice/v8 folder not found!" -ForegroundColor Red
    }
}

# Show git status
Write-Host "`n==========================" -ForegroundColor Cyan
Write-Host "Done! Git LFS status:" -ForegroundColor Green
Write-Host ""

# Show file sizes
if (Test-Path "onlyoffice-editor.zip") {
    $size = [math]::Round((Get-Item "onlyoffice-editor.zip").Length / 1MB, 2)
    Write-Host "  onlyoffice-editor.zip: $size MB" -ForegroundColor White
}
if (Test-Path "x2t.wasm") {
    $size = [math]::Round((Get-Item "x2t.wasm").Length / 1MB, 2)
    Write-Host "  x2t.wasm: $size MB" -ForegroundColor White
}
if (Test-Path "x2t.js") {
    $size = [math]::Round((Get-Item "x2t.js").Length / 1MB, 2)
    Write-Host "  x2t.js: $size MB" -ForegroundColor White
}

Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Review changes: git status" -ForegroundColor Gray
Write-Host "  2. Stage files:    git add ." -ForegroundColor Gray
Write-Host "  3. Commit:         git commit -m 'Update OnlyOffice assets'" -ForegroundColor Gray
Write-Host "  4. Push:           git push (LFS will upload large files)" -ForegroundColor Gray
Write-Host ""
Write-Host "After reverting a commit, run:" -ForegroundColor Yellow
Write-Host "  .\update-assets.ps1 -Restore" -ForegroundColor Gray
