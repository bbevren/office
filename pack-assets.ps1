# pack-assets.ps1
# Script to compress OnlyOffice assets for version control
# Run this before committing if you've made changes to public/onlyoffice/

param(
    [switch]$Unpack,
    [switch]$Pack,
    [switch]$Check
)

$ErrorActionPreference = "Stop"
$assetsFolder = "public\onlyoffice"
$archiveName = "onlyoffice-assets.7z"
$hashFile = "onlyoffice-assets.hash"

function Get-FolderHash {
    param([string]$Path)
    
    $files = Get-ChildItem -Path $Path -Recurse -File | Sort-Object FullName
    $hashString = ""
    foreach ($file in $files) {
        $relativePath = $file.FullName.Substring((Get-Location).Path.Length + 1)
        $fileHash = (Get-FileHash -Path $file.FullName -Algorithm SHA256).Hash
        $hashString += "$relativePath|$fileHash`n"
    }
    
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($hashString)
    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    $hash = $sha256.ComputeHash($bytes)
    return [BitConverter]::ToString($hash) -replace '-', ''
}

function Pack-Assets {
    Write-Host "Packing OnlyOffice assets..." -ForegroundColor Cyan
    
    if (-not (Test-Path $assetsFolder)) {
        Write-Host "Error: $assetsFolder folder not found!" -ForegroundColor Red
        exit 1
    }
    
    # Check if 7-Zip is available
    $7zPath = "C:\Program Files\7-Zip\7z.exe"
    if (-not (Test-Path $7zPath)) {
        # Try to find 7z in PATH
        $7zPath = (Get-Command 7z -ErrorAction SilentlyContinue).Path
        if (-not $7zPath) {
            Write-Host "7-Zip not found. Using Compress-Archive (slower, larger file)..." -ForegroundColor Yellow
            
            # Remove old archive
            if (Test-Path $archiveName.Replace(".7z", ".zip")) {
                Remove-Item $archiveName.Replace(".7z", ".zip") -Force
            }
            
            $zipName = $archiveName.Replace(".7z", ".zip")
            Compress-Archive -Path $assetsFolder -DestinationPath $zipName -CompressionLevel Optimal
            $archiveName = $zipName
        }
    }
    
    if ($7zPath -and (Test-Path $7zPath)) {
        # Remove old archive
        if (Test-Path $archiveName) {
            Remove-Item $archiveName -Force
        }
        
        Write-Host "Compressing with 7-Zip (this may take a few minutes)..." -ForegroundColor Yellow
        & $7zPath a -t7z -mx=9 -mfb=64 -md=32m -ms=on $archiveName $assetsFolder
    }
    
    # Calculate and save hash
    Write-Host "Calculating folder hash..." -ForegroundColor Yellow
    $hash = Get-FolderHash -Path $assetsFolder
    $hash | Out-File -FilePath $hashFile -NoNewline
    
    $size = (Get-Item $archiveName).Length / 1MB
    Write-Host "Done! Created $archiveName ($([math]::Round($size, 2)) MB)" -ForegroundColor Green
    Write-Host "Hash saved to $hashFile" -ForegroundColor Green
}

function Unpack-Assets {
    Write-Host "Unpacking OnlyOffice assets..." -ForegroundColor Cyan
    
    # Check for archive
    $archive = $null
    if (Test-Path $archiveName) {
        $archive = $archiveName
    } elseif (Test-Path $archiveName.Replace(".7z", ".zip")) {
        $archive = $archiveName.Replace(".7z", ".zip")
    } elseif (Test-Path "onlyoffice-editor.zip") {
        $archive = "onlyoffice-editor.zip"
    }
    
    if (-not $archive) {
        Write-Host "Error: No archive found!" -ForegroundColor Red
        Write-Host "Expected: $archiveName or onlyoffice-editor.zip" -ForegroundColor Yellow
        exit 1
    }
    
    Write-Host "Found archive: $archive" -ForegroundColor Yellow
    
    # Remove existing folder
    if (Test-Path $assetsFolder) {
        Write-Host "Removing existing $assetsFolder..." -ForegroundColor Yellow
        Remove-Item -Path $assetsFolder -Recurse -Force
    }
    
    # Extract based on archive type
    if ($archive -match "\.7z$") {
        $7zPath = "C:\Program Files\7-Zip\7z.exe"
        if (-not (Test-Path $7zPath)) {
            $7zPath = (Get-Command 7z -ErrorAction SilentlyContinue).Path
        }
        
        if ($7zPath) {
            Write-Host "Extracting with 7-Zip..." -ForegroundColor Yellow
            & $7zPath x $archive -o"public" -y
        } else {
            Write-Host "Error: 7-Zip required to extract .7z files" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "Extracting with Expand-Archive..." -ForegroundColor Yellow
        Expand-Archive -Path $archive -DestinationPath "." -Force
        
        # Handle nested folder structure from onlyoffice-editor.zip
        if ((Test-Path "onlyoffice") -and -not (Test-Path $assetsFolder)) {
            Move-Item "onlyoffice" $assetsFolder
        }
    }
    
    Write-Host "Done! Assets extracted to $assetsFolder" -ForegroundColor Green
}

function Check-Assets {
    Write-Host "Checking OnlyOffice assets..." -ForegroundColor Cyan
    
    if (-not (Test-Path $assetsFolder)) {
        Write-Host "Assets folder not found: $assetsFolder" -ForegroundColor Red
        Write-Host "Run: .\pack-assets.ps1 -Unpack" -ForegroundColor Yellow
        exit 1
    }
    
    $fileCount = (Get-ChildItem -Path $assetsFolder -Recurse -File).Count
    $size = (Get-ChildItem -Path $assetsFolder -Recurse -File | Measure-Object -Property Length -Sum).Sum / 1MB
    
    Write-Host "Assets folder: $assetsFolder" -ForegroundColor Green
    Write-Host "  Files: $fileCount" -ForegroundColor White
    Write-Host "  Size: $([math]::Round($size, 2)) MB" -ForegroundColor White
    
    if (Test-Path $hashFile) {
        $savedHash = Get-Content $hashFile -Raw
        Write-Host "  Saved hash: $($savedHash.Substring(0, 16))..." -ForegroundColor White
        
        Write-Host "Calculating current hash (this may take a moment)..." -ForegroundColor Yellow
        $currentHash = Get-FolderHash -Path $assetsFolder
        
        if ($currentHash -eq $savedHash) {
            Write-Host "  Status: UP TO DATE" -ForegroundColor Green
        } else {
            Write-Host "  Status: MODIFIED" -ForegroundColor Yellow
            Write-Host "  Run: .\pack-assets.ps1 -Pack  to update archive" -ForegroundColor Yellow
        }
    } else {
        Write-Host "  No hash file found. Run: .\pack-assets.ps1 -Pack" -ForegroundColor Yellow
    }
}

# Main
if ($Pack) {
    Pack-Assets
} elseif ($Unpack) {
    Unpack-Assets
} elseif ($Check) {
    Check-Assets
} else {
    Write-Host @"
OnlyOffice Assets Manager
=========================

Usage:
  .\pack-assets.ps1 -Pack      Create/update archive from public\onlyoffice\
  .\pack-assets.ps1 -Unpack    Extract archive to public\onlyoffice\
  .\pack-assets.ps1 -Check     Check if assets are up to date

The archive is tracked in git, the extracted folder is not.
This allows version control of large assets without bloating the repo.

For best compression, install 7-Zip: https://www.7-zip.org/
"@
}
