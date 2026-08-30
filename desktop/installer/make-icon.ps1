# Build multi-size icon.ico from logo PNG (classic BMP-in-ICO for Explorer compatibility)
param(
    [string]$PngPath = (Join-Path $PSScriptRoot "..\Assets\logo-icon.png"),
    [string]$IcoPath = (Join-Path $PSScriptRoot "..\Assets\icon.ico")
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

if (-not (Test-Path $PngPath)) {
    $fallback = Join-Path $PSScriptRoot "..\Assets\logo.png"
    if (Test-Path $fallback) { $PngPath = $fallback }
    else { throw "Missing PNG: $PngPath" }
}

function Get-IcoDimensionByte([int]$size) {
    if ($size -ge 256) { return [byte]0 }
    return [byte]$size
}

function Get-BitmapDibBytes([System.Drawing.Bitmap]$Bitmap) {
    $width = $Bitmap.Width
    $height = $Bitmap.Height
    $andMaskRowBytes = [int][Math]::Ceiling($width / 32.0) * 4
    $xorRowBytes = $width * 4
    $xorSize = $xorRowBytes * $height
    $andSize = $andMaskRowBytes * $height

    $header = New-Object byte[] 40
    [BitConverter]::GetBytes([uint32]40).CopyTo($header, 0)
    [BitConverter]::GetBytes([int32]$width).CopyTo($header, 4)
    [BitConverter]::GetBytes([int32]($height * 2)).CopyTo($header, 8)
    [BitConverter]::GetBytes([uint16]1).CopyTo($header, 12)
    [BitConverter]::GetBytes([uint16]32).CopyTo($header, 14)

    $rect = New-Object System.Drawing.Rectangle 0, 0, $width, $height
    $data = $Bitmap.LockBits(
        $rect,
        [System.Drawing.Imaging.ImageLockMode]::ReadOnly,
        [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)

    $xor = New-Object byte[] $xorSize
    for ($y = 0; $y -lt $height; $y++) {
        $srcY = $height - 1 - $y
        for ($x = 0; $x -lt $width; $x++) {
            $src = $srcY * $data.Stride + ($x * 4)
            $dst = ($y * $xorRowBytes) + ($x * 4)
            $xor[$dst] = [Runtime.InteropServices.Marshal]::ReadByte($data.Scan0, $src)
            $xor[$dst + 1] = [Runtime.InteropServices.Marshal]::ReadByte($data.Scan0, $src + 1)
            $xor[$dst + 2] = [Runtime.InteropServices.Marshal]::ReadByte($data.Scan0, $src + 2)
            $xor[$dst + 3] = [Runtime.InteropServices.Marshal]::ReadByte($data.Scan0, $src + 3)
        }
    }
    $Bitmap.UnlockBits($data)

    $and = New-Object byte[] $andSize
    $dib = New-Object byte[] (40 + $xorSize + $andSize)
    $header.CopyTo($dib, 0)
    $xor.CopyTo($dib, 40)
    return $dib
}

$sizes = @(16, 32, 48, 64, 128, 256)
$src = [System.Drawing.Image]::FromFile($PngPath)
$ms = New-Object System.IO.MemoryStream
$bw = New-Object System.IO.BinaryWriter($ms)

$bw.Write([uint16]0)
$bw.Write([uint16]1)
$bw.Write([uint16]$sizes.Count)

$offset = 6 + (16 * $sizes.Count)
$chunks = New-Object System.Collections.Generic.List[byte[]]

foreach ($size in $sizes) {
    $bmp = New-Object System.Drawing.Bitmap $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)
    $pad = [Math]::Max(1, [int][Math]::Round($size * 0.06))
    $inner = $size - (2 * $pad)
    $g.DrawImage($src, $pad, $pad, $inner, $inner)
    $g.Dispose()

    [void]$chunks.Add((Get-BitmapDibBytes $bmp))
    $bmp.Dispose()
}

for ($i = 0; $i -lt $sizes.Count; $i++) {
    $size = $sizes[$i]
    $bytes = $chunks[$i]
    $bw.Write((Get-IcoDimensionByte $size))
    $bw.Write((Get-IcoDimensionByte $size))
    $bw.Write([byte]0)
    $bw.Write([byte]0)
    $bw.Write([uint16]1)
    $bw.Write([uint16]32)
    $bw.Write([uint32]$bytes.Length)
    $bw.Write([uint32]$offset)
    $offset += $bytes.Length
}

foreach ($bytes in $chunks) { $bw.Write($bytes) }

$bw.Flush()
$data = $ms.ToArray()
$bw.Close()
$ms.Close()
$src.Dispose()

[System.IO.File]::WriteAllBytes($IcoPath, $data)
Write-Host "Created $IcoPath ($($data.Length) bytes, BMP-in-ICO) from $PngPath"
