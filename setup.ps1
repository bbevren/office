# OnlyOffice WASM Setup Script
# Downloads x2t-wasm converter and OnlyOffice web editors

$ErrorActionPreference = "Stop"

Write-Host "OnlyOffice WASM Setup" -ForegroundColor Cyan
Write-Host "=====================" -ForegroundColor Cyan

# Create directories
if (!(Test-Path "public/onlyoffice")) {
    New-Item -ItemType Directory -Path "public/onlyoffice" -Force | Out-Null
}

# Download x2t-wasm
Write-Host "`n[1/3] Downloading x2t-wasm converter..." -ForegroundColor Yellow
$x2tUrl = "https://github.com/nicbarker/x2t-wasm/releases/download/v8.3.0%2B0/x2t.zip"
$x2tZip = "x2t.zip"

if (!(Test-Path "x2t.wasm") -or !(Test-Path "x2t.js")) {
    Invoke-WebRequest -Uri $x2tUrl -OutFile $x2tZip
    Write-Host "Extracting x2t-wasm..." -ForegroundColor Gray
    Expand-Archive -Path $x2tZip -DestinationPath "." -Force
    Write-Host "x2t-wasm ready!" -ForegroundColor Green
} else {
    Write-Host "x2t-wasm already exists, skipping." -ForegroundColor Gray
}

# Download OnlyOffice editors
Write-Host "`n[2/3] Downloading OnlyOffice web editors..." -ForegroundColor Yellow
$ooUrl = "https://github.com/nicbarker/x2t-wasm/releases/download/v8.3.0%2B0/cryptpad_onlyoffice_v8.zip"
$ooZip = "onlyoffice-editor.zip"

if (!(Test-Path "public/onlyoffice/v8")) {
    Invoke-WebRequest -Uri $ooUrl -OutFile $ooZip
    Write-Host "Extracting OnlyOffice editors (this may take a while)..." -ForegroundColor Gray
    Expand-Archive -Path $ooZip -DestinationPath "public/onlyoffice" -Force
    Write-Host "OnlyOffice editors ready!" -ForegroundColor Green
} else {
    Write-Host "OnlyOffice editors already exist, skipping." -ForegroundColor Gray
}

# Install npm dependencies
Write-Host "`n[3/3] Installing npm dependencies..." -ForegroundColor Yellow
npm install

Write-Host "`n=====================" -ForegroundColor Cyan
Write-Host "Setup complete!" -ForegroundColor Green
Write-Host "`nTo start the server, run:" -ForegroundColor White
Write-Host "  node server.js" -ForegroundColor Yellow
Write-Host "`nThen open http://localhost:8080 in your browser." -ForegroundColor White
