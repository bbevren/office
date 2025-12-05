# OnlyOffice WASM Setup Script
# Sets up x2t-wasm converter and OnlyOffice web editors
# Works with Git LFS (cloned repo) or downloads from GitHub releases

$ErrorActionPreference = "Stop"

Write-Host "OnlyOffice WASM Setup" -ForegroundColor Cyan
Write-Host "=====================" -ForegroundColor Cyan

# URLs for downloading (fallback if not using Git LFS)
$x2tUrl = "https://github.com/nicbarker/x2t-wasm/releases/download/v8.3.0%2B0/x2t.zip"
$ooUrl = "https://github.com/nicbarker/x2t-wasm/releases/download/v8.3.0%2B0/cryptpad_onlyoffice_v8.zip"

# Function to check if a file is a Git LFS pointer
function Test-LfsPointer {
    param([string]$FilePath)
    if (!(Test-Path $FilePath)) { return $false }
    $content = Get-Content $FilePath -Raw -ErrorAction SilentlyContinue
    return $content -match "^version https://git-lfs"
}

# Function to check if Git LFS is installed
function Test-GitLfs {
    try {
        $null = git lfs version 2>$null
        return $LASTEXITCODE -eq 0
    } catch {
        return $false
    }
}

# Create directories
Write-Host "`n[1/5] Creating directories..." -ForegroundColor Yellow
if (!(Test-Path "public/onlyoffice")) {
    New-Item -ItemType Directory -Path "public/onlyoffice" -Force | Out-Null
}
if (!(Test-Path "output")) {
    New-Item -ItemType Directory -Path "output" -Force | Out-Null
}
Write-Host "Directories ready!" -ForegroundColor Green

# Check for Git LFS and pull files if needed
Write-Host "`n[2/5] Checking Git LFS..." -ForegroundColor Yellow
$hasGitLfs = Test-GitLfs
$isGitRepo = Test-Path ".git"

if ($isGitRepo -and $hasGitLfs) {
    Write-Host "Git LFS detected. Pulling LFS files..." -ForegroundColor Gray
    git lfs pull
    Write-Host "Git LFS files pulled!" -ForegroundColor Green
} elseif ($isGitRepo -and !$hasGitLfs) {
    Write-Host "Git LFS not installed. Installing..." -ForegroundColor Gray
    # Try to install Git LFS
    try {
        git lfs install
        git lfs pull
        Write-Host "Git LFS installed and files pulled!" -ForegroundColor Green
    } catch {
        Write-Host "Could not install Git LFS. Will download files instead." -ForegroundColor Yellow
    }
} else {
    Write-Host "Not a git repository. Will download files." -ForegroundColor Gray
}

# Setup x2t-wasm
Write-Host "`n[3/5] Setting up x2t-wasm converter..." -ForegroundColor Yellow

$needsX2t = $false
if (!(Test-Path "x2t.wasm") -or !(Test-Path "x2t.js")) {
    $needsX2t = $true
} elseif ((Test-LfsPointer "x2t.wasm") -or (Test-LfsPointer "x2t.js")) {
    Write-Host "LFS pointer files detected, need to pull actual files..." -ForegroundColor Gray
    $needsX2t = $true
} elseif ((Get-Item "x2t.wasm").Length -lt 1000000) {
    # File exists but is too small (probably LFS pointer)
    Write-Host "x2t.wasm seems incomplete, re-downloading..." -ForegroundColor Gray
    $needsX2t = $true
}

if ($needsX2t) {
    # Try Git LFS first
    if ($isGitRepo -and $hasGitLfs) {
        git lfs pull --include="x2t.wasm,x2t.js"
    }
    
    # Check if we got the files from LFS
    if ((Test-Path "x2t.wasm") -and (Get-Item "x2t.wasm").Length -gt 1000000) {
        Write-Host "x2t-wasm ready from Git LFS!" -ForegroundColor Green
    } else {
        # Download from GitHub releases
        Write-Host "Downloading x2t-wasm from GitHub..." -ForegroundColor Gray
        Invoke-WebRequest -Uri $x2tUrl -OutFile "x2t.zip"
        Write-Host "Extracting x2t-wasm..." -ForegroundColor Gray
        Expand-Archive -Path "x2t.zip" -DestinationPath "." -Force
        Remove-Item "x2t.zip" -ErrorAction SilentlyContinue
        Write-Host "x2t-wasm ready!" -ForegroundColor Green
    }
} else {
    Write-Host "x2t-wasm already exists, skipping." -ForegroundColor Gray
}

# Setup OnlyOffice editors
Write-Host "`n[4/5] Setting up OnlyOffice web editors..." -ForegroundColor Yellow

$needsOO = $false
if (!(Test-Path "public/onlyoffice/v8")) {
    $needsOO = $true
}

if ($needsOO) {
    # Check if we have the zip file (from LFS or previous download)
    $ooZip = "onlyoffice-editor.zip"
    
    if ((Test-Path $ooZip) -and (Get-Item $ooZip).Length -gt 1000000) {
        Write-Host "Found onlyoffice-editor.zip, extracting..." -ForegroundColor Gray
    } else {
        # Try Git LFS first
        if ($isGitRepo -and $hasGitLfs) {
            git lfs pull --include="onlyoffice-editor.zip"
        }
        
        # Check if we got it from LFS
        if (!((Test-Path $ooZip) -and (Get-Item $ooZip).Length -gt 1000000)) {
            Write-Host "Downloading OnlyOffice editors from GitHub..." -ForegroundColor Gray
            Invoke-WebRequest -Uri $ooUrl -OutFile $ooZip
        }
    }
    
    Write-Host "Extracting OnlyOffice editors (this may take a while)..." -ForegroundColor Gray
    Expand-Archive -Path $ooZip -DestinationPath "public/onlyoffice" -Force
    Write-Host "OnlyOffice editors ready!" -ForegroundColor Green
} else {
    Write-Host "OnlyOffice editors already exist, skipping." -ForegroundColor Gray
}

# Install npm dependencies
Write-Host "`n[5/5] Installing npm dependencies..." -ForegroundColor Yellow
npm install

Write-Host "`n=====================" -ForegroundColor Cyan
Write-Host "Setup complete!" -ForegroundColor Green
Write-Host "`nTo start the server, run:" -ForegroundColor White
Write-Host "  node server.js" -ForegroundColor Yellow
Write-Host "`nThen open http://localhost:8080 in your browser." -ForegroundColor White
Write-Host "`nFor development details, see DEVELOPER_GUIDE.txt" -ForegroundColor Gray
