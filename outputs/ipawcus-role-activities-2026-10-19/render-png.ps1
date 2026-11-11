param([double]$Scale = 2)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$models = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'diagram-models.json') -Raw | ConvertFrom-Json
$ink = [System.Drawing.ColorTranslator]::FromHtml('#171717')
$white = [System.Drawing.Brushes]::White
$inkBrush = [System.Drawing.SolidBrush]::new($ink)
$quietBrush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#555555'))
$pen = [System.Drawing.Pen]::new($ink, 1.6)
$format = [System.Drawing.StringFormat]::GenericTypographic.Clone()
$fonts = @{}
$textChecks = 0

function Get-DiagramFont([double]$Size, [bool]$Bold = $false) {
    $key = "$Size-$Bold"
    if (-not $fonts.ContainsKey($key)) {
        $style = if ($Bold) { [System.Drawing.FontStyle]::Bold } else { [System.Drawing.FontStyle]::Regular }
        $fonts[$key] = [System.Drawing.Font]::new('Arial', [single]$Size, $style, [System.Drawing.GraphicsUnit]::Pixel)
    }
    return $fonts[$key]
}

function Draw-DiagramText($Graphics, [string]$Value, [double]$X, [double]$Baseline, [double]$Size, [bool]$Bold = $false, [bool]$Left = $false, [bool]$Quiet = $false) {
    if ($Value.Length -eq 0) { return }
    $font = Get-DiagramFont $Size $Bold
    $measured = $Graphics.MeasureString($Value, $font, [System.Drawing.PointF]::new(0, 0), $format)
    $tx = if ($Left) { $X } else { $X - $measured.Width / 2 }
    $ascent = $font.Size * $font.FontFamily.GetCellAscent($font.Style) / $font.FontFamily.GetEmHeight($font.Style)
    $brush = if ($Quiet) { $quietBrush } else { $inkBrush }
    $Graphics.DrawString($Value, $font, $brush, [System.Drawing.PointF]::new([single]$tx, [single]($Baseline - $ascent)), $format)
}

function Draw-DiagramPath($Graphics, $Points, [bool]$Arrow = $false) {
    $vertices = [System.Drawing.PointF[]]@($Points | ForEach-Object { [System.Drawing.PointF]::new([single]$_[0], [single]$_[1]) })
    $Graphics.DrawLines($pen, $vertices)
    if ($Arrow) {
        $a, $b = $Points[-2], $Points[-1]
        $length = [Math]::Sqrt([Math]::Pow($b[0] - $a[0], 2) + [Math]::Pow($b[1] - $a[1], 2))
        $dx = ($b[0] - $a[0]) / $length
        $dy = ($b[1] - $a[1]) / $length
        $triangle = [System.Drawing.PointF[]]@(
            [System.Drawing.PointF]::new([single]$b[0], [single]$b[1]),
            [System.Drawing.PointF]::new([single]($b[0] - $dx * 8 + $dy * 3.5), [single]($b[1] - $dy * 8 - $dx * 3.5)),
            [System.Drawing.PointF]::new([single]($b[0] - $dx * 8 - $dy * 3.5), [single]($b[1] - $dy * 8 + $dx * 3.5))
        )
        $Graphics.FillPolygon($inkBrush, $triangle)
    }
}

foreach ($model in $models) {
    $bitmap = [System.Drawing.Bitmap]::new([int]($model.width * $Scale), [int]($model.height * $Scale))
    $bitmap.SetResolution(192, 192)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.Clear([System.Drawing.Color]::White)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $graphics.ScaleTransform([single]$Scale, [single]$Scale)
    foreach ($edge in $model.edges) { Draw-DiagramPath $graphics $edge.points $true }
    foreach ($node in $model.nodes) {
        $cx = $node.x + $node.w / 2
        $cy = $node.y + $node.h / 2
        if ($node.kind -in @('start', 'end')) {
            $brush = if ($node.kind -eq 'start') { $inkBrush } else { $white }
            $graphics.FillEllipse($brush, [single]$node.x, [single]$node.y, [single]$node.w, [single]$node.h)
            $graphics.DrawEllipse($pen, [single]$node.x, [single]$node.y, [single]$node.w, [single]$node.h)
            if ($node.kind -eq 'end') {
                $graphics.FillEllipse($inkBrush, [single]($node.x + 4), [single]($node.y + 4), [single]($node.w - 8), [single]($node.h - 8))
            }
        } elseif ($node.kind -in @('decision', 'merge')) {
            $diamond = [System.Drawing.PointF[]]@(
                [System.Drawing.PointF]::new([single]$cx, [single]$node.y),
                [System.Drawing.PointF]::new([single]($node.x + $node.w), [single]$cy),
                [System.Drawing.PointF]::new([single]$cx, [single]($node.y + $node.h)),
                [System.Drawing.PointF]::new([single]$node.x, [single]$cy)
            )
            $graphics.FillPolygon($white, $diamond)
            $graphics.DrawPolygon($pen, $diamond)
        } else {
            $shape = [System.Drawing.Drawing2D.GraphicsPath]::new()
            $radius = 16
            $shape.AddArc([single]$node.x, [single]$node.y, $radius, $radius, 180, 90)
            $shape.AddArc([single]($node.x + $node.w - $radius), [single]$node.y, $radius, $radius, 270, 90)
            $shape.AddArc([single]($node.x + $node.w - $radius), [single]($node.y + $node.h - $radius), $radius, $radius, 0, 90)
            $shape.AddArc([single]$node.x, [single]($node.y + $node.h - $radius), $radius, $radius, 90, 90)
            $shape.CloseFigure()
            $graphics.FillPath($white, $shape)
            $graphics.DrawPath($pen, $shape)
            $shape.Dispose()
        }
        $leading = $node.size * 1.31
        $textHeight = $node.rows.Count * $leading
        $actorHeight = if ($node.actor) { 20 } else { 0 }
        $baseline = $node.y + ($node.h - $textHeight - $actorHeight) / 2 + $node.size
        for ($row = 0; $row -lt $node.rows.Count; $row++) {
            $value = [string]$node.rows[$row]
            if ($value.Length -gt 0) {
                $font = Get-DiagramFont $node.size
                $measured = $graphics.MeasureString($value, $font, [System.Drawing.PointF]::new(0, 0), $format)
                if ($node.kind -eq 'action' -and $measured.Width -gt $node.w - 12) { throw "Text overflow: $($model.id)/$($node.id): $value" }
                $textChecks++
            }
            Draw-DiagramText $graphics $value $cx ($baseline + $row * $leading) $node.size
        }
        if ($node.actor) {
            Draw-DiagramText $graphics $node.actor $cx ($baseline + $textHeight + 5) 11 $false $false $true
        }
    }
    foreach ($edge in $model.edges) {
        if (-not $edge.label) { continue }
        $box = $edge.labelBox
        $size = if ($edge.from -eq 'choose') { 17 } else { 13 }
        $graphics.FillRectangle($white, [single]$box.x, [single]$box.y, [single]$box.w, [single]$box.h)
        Draw-DiagramText $graphics $edge.label ($box.x + $box.w / 2) ($box.y + 16) $size $true
    }
    foreach ($text in $model.texts) {
        for ($row = 0; $row -lt $text.rows.Count; $row++) {
            $tx = if ($text.align -eq 'left') { $text.x + 4 } else { $text.x + $text.w / 2 }
            Draw-DiagramText $graphics $text.rows[$row] $tx ($text.y + $text.size + $row * $text.size * 1.4) $text.size $text.bold ($text.align -eq 'left') ($text.color -eq '#555555')
        }
    }
    $target = Join-Path $PSScriptRoot ($model.id + '.png')
    $bitmap.Save($target, [System.Drawing.Imaging.ImageFormat]::Png)
    # A compact review view; the full PNG remains at 2x resolution.
    $reviewScale = [Math]::Min(1400 / $bitmap.Width, 1800 / $bitmap.Height)
    $preview = [System.Drawing.Bitmap]::new([int]($bitmap.Width * $reviewScale), [int]($bitmap.Height * $reviewScale))
    $previewGraphics = [System.Drawing.Graphics]::FromImage($preview)
    $previewGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $previewGraphics.DrawImage($bitmap, 0, 0, $preview.Width, $preview.Height)
    $preview.Save((Join-Path $PSScriptRoot ($model.id + '-preview.png')), [System.Drawing.Imaging.ImageFormat]::Png)
    $previewGraphics.Dispose()
    $preview.Dispose()
    $graphics.Dispose()
    $bitmap.Dispose()
    Write-Output "$($model.role): PNG generated"
}
$fonts.Values | ForEach-Object { $_.Dispose() }
$format.Dispose()
$pen.Dispose()
$inkBrush.Dispose()
$quietBrush.Dispose()
Write-Output "$textChecks text rows checked against actual Arial font metrics."
