$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$taskOut = $PSScriptRoot
$layouts = Get-Content -LiteralPath (Join-Path $taskOut 'preview-layout.json') -Raw | ConvertFrom-Json
$warnings = [System.Collections.Generic.List[object]]::new()
function Get-TaskColor([string]$Hex) {
    return [System.Drawing.ColorTranslator]::FromHtml('#' + $Hex)
}
foreach ($layout in $layouts) {
    $bitmap = [System.Drawing.Bitmap]::new([int]$layout.width, [int]$layout.height)
    $bitmap.SetResolution(96, 96)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.Clear([System.Drawing.Color]::White)
    $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::None
    $fontCache = @{}
    $brushCache = @{}
    $penCache = @{}
    foreach ($cell in $layout.cells) {
        if (-not $brushCache.ContainsKey($cell.fill)) {
            $brushCache[$cell.fill] = [System.Drawing.SolidBrush]::new((Get-TaskColor $cell.fill))
        }
        $rect = [System.Drawing.RectangleF]::new([single]$cell.x, [single]$cell.y, [single]$cell.w, [single]$cell.h)
        $graphics.FillRectangle($brushCache[$cell.fill], $rect)
        foreach ($side in @('top', 'bottom', 'left', 'right')) {
            $borderColor = $cell.borders.$side
            if (-not $borderColor) { continue }
            if (-not $penCache.ContainsKey($borderColor)) {
                $penCache[$borderColor] = [System.Drawing.Pen]::new((Get-TaskColor $borderColor), [single]0.6)
            }
            $x1 = [single]$cell.x
            $y1 = [single]$cell.y
            $x2 = [single]($cell.x + $cell.w)
            $y2 = [single]($cell.y + $cell.h)
            switch ($side) {
                'top' { $graphics.DrawLine($penCache[$borderColor], $x1, $y1, $x2, $y1) }
                'bottom' { $graphics.DrawLine($penCache[$borderColor], $x1, $y2, $x2, $y2) }
                'left' { $graphics.DrawLine($penCache[$borderColor], $x1, $y1, $x1, $y2) }
                'right' { $graphics.DrawLine($penCache[$borderColor], $x2, $y1, $x2, $y2) }
            }
        }
        if (-not $cell.text) { continue }
        $fontKey = '{0}|{1}|{2}' -f $cell.font, $cell.size, $cell.bold
        if (-not $fontCache.ContainsKey($fontKey)) {
            $fontStyle = if ($cell.bold) { [System.Drawing.FontStyle]::Bold } else { [System.Drawing.FontStyle]::Regular }
            $fontCache[$fontKey] = [System.Drawing.Font]::new([string]$cell.font, [single]$cell.size, $fontStyle, [System.Drawing.GraphicsUnit]::Point)
        }
        if (-not $brushCache.ContainsKey($cell.color)) {
            $brushCache[$cell.color] = [System.Drawing.SolidBrush]::new((Get-TaskColor $cell.color))
        }
        $format = [System.Drawing.StringFormat]::new()
        $format.LineAlignment = [System.Drawing.StringAlignment]::Center
        $format.Alignment = if ($cell.align -eq 'center') { [System.Drawing.StringAlignment]::Center } else { [System.Drawing.StringAlignment]::Near }
        $format.Trimming = [System.Drawing.StringTrimming]::None
        $horizontalPadding = if ($cell.align -eq 'center') { 2 } else { 7 }
        $textRect = [System.Drawing.RectangleF]::new([single]($cell.x + $horizontalPadding), [single]($cell.y + 2), [single]([Math]::Max(1, $cell.w - 2 * $horizontalPadding)), [single]([Math]::Max(1, $cell.h - 4)))
        $measured = $graphics.MeasureString([string]$cell.text, $fontCache[$fontKey], [int]$textRect.Width, $format)
        if ($measured.Height -gt ($textRect.Height + 3)) {
            $warnings.Add([pscustomobject]@{ sheet = $layout.name; text = $cell.text; requiredHeight = [Math]::Round($measured.Height, 1); availableHeight = $textRect.Height })
        }
        $graphics.DrawString([string]$cell.text, $fontCache[$fontKey], $brushCache[$cell.color], $textRect, $format)
        $format.Dispose()
    }
    $bitmap.Save((Join-Path $taskOut $layout.file), [System.Drawing.Imaging.ImageFormat]::Png)
    foreach ($item in $fontCache.Values) { $item.Dispose() }
    foreach ($item in $brushCache.Values) { $item.Dispose() }
    foreach ($item in $penCache.Values) { $item.Dispose() }
    $graphics.Dispose()
    $bitmap.Dispose()
    Write-Output ('Rendered {0}: {1}x{2}' -f $layout.file, $layout.width, $layout.height)
}
$warnings | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $taskOut 'preview-text-warnings.json') -Encoding utf8
Write-Output ('Text fit warnings: {0}' -f $warnings.Count)
if ($warnings.Count -gt 0) { $warnings | Select-Object -First 12 | ConvertTo-Json -Depth 4 | Write-Output }
