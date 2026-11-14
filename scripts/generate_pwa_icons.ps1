param(
    [string]$OutputDirectory = (Join-Path $PSScriptRoot "..\frontend\assets\icons")
)

Add-Type -AssemblyName System.Drawing

function New-RoundedRectanglePath {
    param(
        [System.Drawing.RectangleF]$Rectangle,
        [float]$Radius
    )

    $diameter = $Radius * 2
    $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $path.AddArc($Rectangle.Left, $Rectangle.Top, $diameter, $diameter, 180, 90)
    $path.AddArc($Rectangle.Right - $diameter, $Rectangle.Top, $diameter, $diameter, 270, 90)
    $path.AddArc($Rectangle.Right - $diameter, $Rectangle.Bottom - $diameter, $diameter, $diameter, 0, 90)
    $path.AddArc($Rectangle.Left, $Rectangle.Bottom - $diameter, $diameter, $diameter, 90, 90)
    $path.CloseFigure()
    return $path
}

function New-BioTrackIcon {
    param(
        [int]$Size,
        [string]$OutputPath,
        [switch]$Maskable
    )

    $bitmap = [System.Drawing.Bitmap]::new($Size, $Size)
    $bitmap.SetResolution(96, 96)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.Clear($(if ($Maskable) { [System.Drawing.Color]::FromArgb(8, 127, 140) } else { [System.Drawing.Color]::White }))

    $petalColor = if ($Maskable) { [System.Drawing.Color]::White } else { [System.Drawing.Color]::FromArgb(8, 173, 169) }
    $crossColor = if ($Maskable) { [System.Drawing.Color]::FromArgb(8, 127, 140) } else { [System.Drawing.Color]::White }
    $petalBrush = [System.Drawing.SolidBrush]::new($petalColor)
    $crossBrush = [System.Drawing.SolidBrush]::new($crossColor)

    $markSize = $Size * $(if ($Maskable) { 0.56 } else { 0.68 })
    $markLeft = ($Size - $markSize) / 2
    $markTop = ($Size - $markSize) / 2
    $gap = $markSize * 0.035
    $petalSize = ($markSize - $gap) / 2
    $radius = $petalSize * 0.34

    $rectangles = @(
        [System.Drawing.RectangleF]::new($markLeft, $markTop, $petalSize, $petalSize),
        [System.Drawing.RectangleF]::new($markLeft + $petalSize + $gap, $markTop, $petalSize, $petalSize),
        [System.Drawing.RectangleF]::new($markLeft, $markTop + $petalSize + $gap, $petalSize, $petalSize),
        [System.Drawing.RectangleF]::new($markLeft + $petalSize + $gap, $markTop + $petalSize + $gap, $petalSize, $petalSize)
    )

    foreach ($rectangle in $rectangles) {
        $path = New-RoundedRectanglePath -Rectangle $rectangle -Radius $radius
        $graphics.FillPath($petalBrush, $path)
        $path.Dispose()
    }

    $crossLong = $markSize * 0.50
    $crossShort = $markSize * 0.18
    $horizontal = [System.Drawing.RectangleF]::new(($Size - $crossLong) / 2, ($Size - $crossShort) / 2, $crossLong, $crossShort)
    $vertical = [System.Drawing.RectangleF]::new(($Size - $crossShort) / 2, ($Size - $crossLong) / 2, $crossShort, $crossLong)
    $horizontalPath = New-RoundedRectanglePath -Rectangle $horizontal -Radius ($crossShort * 0.24)
    $verticalPath = New-RoundedRectanglePath -Rectangle $vertical -Radius ($crossShort * 0.24)
    $graphics.FillPath($crossBrush, $horizontalPath)
    $graphics.FillPath($crossBrush, $verticalPath)

    $directory = Split-Path -Parent $OutputPath
    [System.IO.Directory]::CreateDirectory($directory) | Out-Null
    $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)

    $horizontalPath.Dispose()
    $verticalPath.Dispose()
    $petalBrush.Dispose()
    $crossBrush.Dispose()
    $graphics.Dispose()
    $bitmap.Dispose()
}

$resolvedOutput = [System.IO.Path]::GetFullPath($OutputDirectory)
New-BioTrackIcon -Size 192 -OutputPath (Join-Path $resolvedOutput "biotrack-192.png")
New-BioTrackIcon -Size 512 -OutputPath (Join-Path $resolvedOutput "biotrack-512.png")
New-BioTrackIcon -Size 512 -OutputPath (Join-Path $resolvedOutput "biotrack-maskable-512.png") -Maskable

Write-Output "Generated BioTrack PWA icons in $resolvedOutput"
