# 7-10 Inventory - Release + Installer build
# Usage: powershell -ExecutionPolicy Bypass -File .\installer\build.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$publishDir = Join-Path $root "dist\app"
$distDir = Join-Path $root "dist"
$iss = Join-Path $PSScriptRoot "7-10.iss"
$csproj = Join-Path $root "SevenTenProductsManagementSystem.csproj"
$iconIco = Join-Path $root "Assets\icon.ico"
$appExeName = "SevenTenInventorySystem.exe"

# App version comes from Properties\AssemblyInfo.cs (AssemblyInformationalVersion)
$assemblyInfo = Get-Content (Join-Path $root "Properties\AssemblyInfo.cs") -Raw
if ($assemblyInfo -notmatch 'AssemblyInformationalVersion\("([0-9]+(\.[0-9]+){1,3})"\)') {
    throw "AssemblyInformationalVersion not found in Properties\AssemblyInfo.cs"
}
$appVersion = $Matches[1]
Write-Host "==> Building version $appVersion" -ForegroundColor Cyan

# Where the app looks for updates (Updates.ManifestUrl in appsettings.json). For GitHub Releases the
# installer URL is derived from it: .../releases/latest/download/latest.json -> .../releases/download/v<ver>/SevenTenSetup.exe
$appSettings = Get-Content (Join-Path $root "appsettings.json") -Raw | ConvertFrom-Json
$manifestUrl = $null
if ($appSettings.Updates) { $manifestUrl = $appSettings.Updates.ManifestUrl }

# Resolve dotnet CLI with SDK
$dotnetCmd = "dotnet"
$localDotnet = Join-Path $env:LocalAppData "Microsoft\dotnet"
$localDotnetExe = Join-Path $localDotnet "dotnet.exe"

$hasSdk = $false
try {
    $sdks = & dotnet --list-sdks 2>$null
    if ($sdks) { $hasSdk = $true }
} catch { }

if (-not $hasSdk -and (Test-Path (Join-Path $localDotnet "sdk"))) {
    Write-Host "==> Using local .NET SDK at $localDotnet" -ForegroundColor Cyan
    $env:DOTNET_ROOT = $localDotnet
    $env:PATH = "$localDotnet;$env:PATH"
    $dotnetCmd = $localDotnetExe
} elseif (-not $hasSdk) {
    Write-Host "==> No .NET SDK found. Installing .NET 8 SDK locally via dotnet-install..." -ForegroundColor Yellow
    $installScript = Join-Path $PSScriptRoot "dotnet-install.ps1"
    if (-not (Test-Path $installScript)) {
        Invoke-WebRequest -Uri "https://dot.net/v1/dotnet-install.ps1" -OutFile $installScript -UseBasicParsing
    }
    & $installScript -Channel 8.0 -Architecture x64
    if (Test-Path (Join-Path $localDotnet "sdk")) {
        $env:DOTNET_ROOT = $localDotnet
        $env:PATH = "$localDotnet;$env:PATH"
        $dotnetCmd = $localDotnetExe
    } else {
        throw "Failed to locate or install .NET 8 SDK"
    }
} else {
    # System dotnet already has SDK, ensure DOTNET_ROOT is set if needed
    if (Test-Path $localDotnetExe) {
        $localSdks = & $localDotnetExe --list-sdks 2>$null
        if ($localSdks) {
            $env:DOTNET_ROOT = $localDotnet
            $env:PATH = "$localDotnet;$env:PATH"
            $dotnetCmd = $localDotnetExe
        }
    }
}

Write-Host "==> Regenerating Assets\icon.ico from logo..." -ForegroundColor Cyan
& (Join-Path $PSScriptRoot "make-icon.ps1")
if (-not (Test-Path $iconIco)) {
    throw "Missing Assets\icon.ico - required for app exe and setup icons"
}
Write-Host "==> Using Assets\icon.ico for app exe and setup" -ForegroundColor Cyan

Write-Host "==> Publishing self-contained Release (win-x64)..." -ForegroundColor Cyan
if (Test-Path $publishDir) { Remove-Item $publishDir -Recurse -Force }
New-Item -ItemType Directory -Force -Path $publishDir | Out-Null

& $dotnetCmd publish $csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=false -o $publishDir
if ($LASTEXITCODE -ne 0) { throw "dotnet publish failed" }

Write-Host "==> Publishing portable single-file exe..." -ForegroundColor Cyan
$singleDir = Join-Path $root "dist\_single"
$portableExe = Join-Path $distDir "SevenTenInventory.exe"
if (Test-Path $singleDir) { Remove-Item $singleDir -Recurse -Force }
New-Item -ItemType Directory -Force -Path $distDir | Out-Null
New-Item -ItemType Directory -Force -Path $singleDir | Out-Null
& $dotnetCmd publish $csproj -c Release -r win-x64 --self-contained true `
    -p:PublishSingleFile=true `
    -p:IncludeNativeLibrariesForSelfExtract=true `
    -p:IncludeAllContentForSelfExtract=true `
    -p:EnableCompressionInSingleFile=true `
    -o $singleDir
if ($LASTEXITCODE -ne 0) { throw "dotnet publish (single-file) failed" }
$publishedExe = Join-Path $singleDir $appExeName
if (-not (Test-Path $publishedExe)) { throw "Single-file exe not found: $publishedExe" }
Copy-Item $publishedExe $portableExe -Force
Start-Sleep -Milliseconds 500
for ($retry = 0; $retry -lt 3; $retry++) {
    try {
        if (Test-Path $singleDir) { Remove-Item $singleDir -Recurse -Force -ErrorAction Stop }
        break
    } catch {
        Start-Sleep -Milliseconds 800
    }
}
Write-Host "Portable app: $portableExe" -ForegroundColor Green

Write-Host "==> Looking for Inno Setup 6.4+ (ISCC)..." -ForegroundColor Cyan
$pf86 = ${env:ProgramFiles(x86)}
$pf = $env:ProgramFiles
$lad = $env:LocalAppData
$isccCandidates = @(
    (Join-Path $pf86 "Inno Setup 6\ISCC.exe"),
    (Join-Path $pf "Inno Setup 6\ISCC.exe"),
    (Join-Path $lad "Programs\Inno Setup 6\ISCC.exe"),
    (Join-Path $pf86 "Inno Setup 7\ISCC.exe"),
    (Join-Path $pf "Inno Setup 7\ISCC.exe")
)
$iscc = $isccCandidates | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1

New-Item -ItemType Directory -Force -Path $distDir | Out-Null

if ($iscc) {
    Write-Host "==> Building SevenTenSetup.exe with $iscc" -ForegroundColor Cyan
    Write-Host "    (Setup will auto-install WebView2 on PCs that need it)" -ForegroundColor DarkGray
    & $iscc "/DMyAppVersion=$appVersion" $iss
    if ($LASTEXITCODE -ne 0) { throw "ISCC failed" }
    $setup = Get-ChildItem $distDir -Filter "SevenTenSetup.exe" | Select-Object -First 1
    if ($setup) {
        Write-Host ""
        Write-Host "SUCCESS - give buyers this file:" -ForegroundColor Green
        Write-Host $setup.FullName -ForegroundColor Green
        Write-Host ""
        Write-Host "Target PC needs: Windows 10/11 64-bit. WebView2 is installed by setup if missing." -ForegroundColor Cyan

        # Update manifest the installed apps read. Upload it next to SevenTenSetup.exe.
        $tag = "v$appVersion"
        $setupUrl = $null
        if ($manifestUrl -match '^(https://github\.com/[^/]+/[^/]+)/releases/') {
            $setupUrl = "$($Matches[1])/releases/download/$tag/SevenTenSetup.exe"
        } elseif ($manifestUrl) {
            $setupUrl = ($manifestUrl -replace '[^/]+$', '') + "SevenTenSetup.exe"
        }
        $notesFile = Join-Path $root "installer\release-notes.txt"
        $notes = ""
        if (Test-Path $notesFile) {
            # Lines starting with # are instructions, not notes
            $notes = ((Get-Content $notesFile) | Where-Object { $_ -notmatch '^\s*#' }) -join "`n"
            $notes = $notes.Trim()
        }
        $manifest = [ordered]@{
            version     = $appVersion
            url         = $setupUrl
            sha256      = (Get-FileHash $setup.FullName -Algorithm SHA256).Hash
            size        = $setup.Length
            notes       = $notes
            publishedAt = (Get-Date).ToUniversalTime().ToString("o")
        }
        $latestJson = Join-Path $distDir "latest.json"
        # UTF-8 without BOM so any HTTP client parses it
        [System.IO.File]::WriteAllText($latestJson, ($manifest | ConvertTo-Json), (New-Object System.Text.UTF8Encoding $false))

        Write-Host ""
        Write-Host "UPDATE - to push v$appVersion to installed apps:" -ForegroundColor Green
        if ($setupUrl -like "https://github.com/*") {
            Write-Host "  1. GitHub -> Releases -> Draft a new release, tag: $tag" -ForegroundColor Green
            Write-Host "  2. Attach BOTH files: SevenTenSetup.exe and latest.json (from $distDir)" -ForegroundColor Green
            Write-Host "  3. Publish (not as pre-release). Apps offer the update on next launch." -ForegroundColor Green
        } else {
            Write-Host "  Upload SevenTenSetup.exe and latest.json to: $setupUrl" -ForegroundColor Green
        }
    }
}
else {
    $zip = Join-Path $distDir "SevenTenInventory-Portable.zip"
    if (Test-Path $zip) { Remove-Item $zip -Force }
    Compress-Archive -Path (Join-Path $publishDir "*") -DestinationPath $zip
    Write-Host ""
    Write-Host "Inno Setup not available - created portable zip instead:" -ForegroundColor Yellow
    Write-Host $zip
}

Write-Host ""
Write-Host "Published app folder: $publishDir"
Write-Host "Portable exe: $(Join-Path $distDir 'SevenTenInventory.exe')"
Write-Host "Run locally: $(Join-Path $publishDir $appExeName)"
