$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$taskOut = $PSScriptRoot
$meta = Get-Content -LiteralPath (Join-Path $taskOut 'broad-plan-validation.json') -Raw | ConvertFrom-Json
$sourcePath = $meta.file
$sourceHash = (Get-FileHash -LiteralPath $sourcePath -Algorithm SHA256).Hash
$testPath = Join-Path $taskOut 'broad-plan-excel-test-copy.xlsx'
Copy-Item -LiteralPath $sourcePath -Destination $testPath -Force
$green = [System.Drawing.ColorTranslator]::ToOle([System.Drawing.ColorTranslator]::FromHtml('#70AD47'))
$yellow = [System.Drawing.ColorTranslator]::ToOle([System.Drawing.ColorTranslator]::FromHtml('#FFD966'))
$white = [System.Drawing.ColorTranslator]::ToOle([System.Drawing.Color]::White)
$passed = [System.Collections.Generic.List[string]]::new()
$excel = $null
$book = $null

function Find-TaskRow($Sheet, [string]$Id) {
    $range = $Sheet.Range(('A8:A{0}' -f $Sheet.UsedRange.Rows.Count))
    $values = $range.Value2
    for ($i = 1; $i -le $values.GetLength(0); $i++) {
        if ($values.GetValue($i, 1) -eq $Id) { return $i + 7 }
    }
    throw ('Task not found: ' + $Id)
}
function Get-DayCell($Sheet, [int]$Row, [double]$Serial) {
    $firstDate = [double]$Sheet.Cells.Item(7, 4).Value2
    return $Sheet.Cells.Item($Row, [int](4 + $Serial - $firstDate))
}
function Assert-Color($Sheet, [int]$Row, [double]$Serial, [int]$Color, [string]$Label) {
    $cell = Get-DayCell $Sheet $Row $Serial
    $actual = [int]$cell.DisplayFormat.Interior.Color
    if ($actual -ne $Color) { throw ('{0}: {1}!{2}, expected {3}, got {4}' -f $Label, $Sheet.Name, $cell.Address(), $Color, $actual) }
}
function Date-Serial([string]$Text) { return [datetime]::ParseExact($Text, 'yyyy-MM-dd', [cultureinfo]::InvariantCulture).ToOADate() }
function Assert-AllRanges($Sheet) {
    foreach ($record in $meta.rows) {
        $a = $Sheet.Cells.Item([int]$record.row, [int]$meta.helperStartColumn).Value2
        $b = $Sheet.Cells.Item([int]$record.row, [int]$meta.helperEndColumn).Value2
        if ($record.start -and ([double]$a -gt [double]$b)) { throw ('Invalid date range: ' + $record.id) }
        if ($record.task -and $record.start) {
            $pa = [double]$Sheet.Cells.Item([int]$record.parentRow, [int]$meta.helperStartColumn).Value2
            $pb = [double]$Sheet.Cells.Item([int]$record.parentRow, [int]$meta.helperEndColumn).Value2
            if ([double]$a -lt $pa -or [double]$b -gt $pb) { throw ('Task falls outside its phase: ' + $record.id) }
        }
    }
}

try {
    $excel = New-Object -ComObject Excel.Application
    $excel.Visible = $false
    $excel.DisplayAlerts = $false
    $excel.EnableEvents = $false
    $book = $excel.Workbooks.Open($testPath, 0, $false)
    $excel.Calculation = -4105
    $excel.CalculateFullRebuild()
    if ($book.Worksheets.Count -ne 6) { throw 'Expected exactly one new sheet, for six sheets total.' }
    $broad = $book.Worksheets.Item('Broad Increment Plan')
    $main = $book.Worksheets.Item('Summary Gantt')
    Assert-AllRanges $broad
    $passed.Add('All 157 feature-task estimates calculate and remain inside their 18 current phase ranges.')

    $design = Find-TaskRow $broad 'I1-D-01'
    $testing = Find-TaskRow $broad 'I1-T-01'
    $oldDesignStart = [double]$broad.Cells.Item($design, [int]$meta.helperStartColumn).Value2
    $oldTestingStart = [double]$broad.Cells.Item($testing, [int]$meta.helperStartColumn).Value2
    Assert-Color $broad $design $oldDesignStart $green 'Initial design-task green'
    Assert-Color $broad $testing $oldTestingStart $yellow 'Initial testing-task yellow'
    $broad.Cells.Item($design, 3).Value2 = '1 Nov - 3 Nov'
    $broad.Cells.Item($testing, 3).Value2 = '4 Dec - 6 Dec'
    $excel.CalculateFullRebuild()
    Assert-Color $broad $design $oldDesignStart $white 'Old design-task range clears'
    Assert-Color $broad $design (Date-Serial '2026-11-01') $green 'Edited design-task green'
    Assert-Color $broad $testing $oldTestingStart $white 'Old testing-task range clears'
    Assert-Color $broad $testing (Date-Serial '2026-12-04') $yellow 'Edited testing-task yellow'
    $passed.Add('Typing a task date moves green/yellow bars and clears the old colored range.')

    $phase = Find-TaskRow $broad 'I1-D'
    $autoChild = Find-TaskRow $broad 'I1-D-02'
    $oldAutoStart = [double]$broad.Cells.Item($autoChild, [int]$meta.helperStartColumn).Value2
    $broad.Cells.Item($phase, 3).Value2 = '10 Nov - 16 Nov'
    $excel.CalculateFullRebuild()
    $newAutoStart = [double]$broad.Cells.Item($autoChild, [int]$meta.helperStartColumn).Value2
    if ($newAutoStart -lt (Date-Serial '2026-11-10') -or $newAutoStart -gt (Date-Serial '2026-11-16')) { throw 'Estimated child did not follow its phase.' }
    Assert-Color $broad $autoChild $oldAutoStart $white 'Old estimated child range clears'
    Assert-Color $broad $autoChild $newAutoStart $green 'Estimated child follows edited phase'
    if ($broad.Cells.Item($design, 3).Value2 -ne '1 Nov - 3 Nov') { throw 'A parent edit overwrote a manually adjusted child.' }
    $passed.Add('Changing a phase re-ranges estimated children and preserves manually overridden task dates.')

    $mainPhase = Find-TaskRow $main 'I2-C'
    $broadPhase = Find-TaskRow $broad 'I2-C'
    $broadChild = Find-TaskRow $broad 'I2-C-01'
    $main.Cells.Item($mainPhase, 3).Value2 = '10 Oct - 20 Oct'
    $excel.CalculateFullRebuild()
    if ($broad.Cells.Item($broadPhase, 3).Value2 -ne '10 Oct - 20 Oct') { throw 'The new phase did not follow the major summary.' }
    $childStart = [double]$broad.Cells.Item($broadChild, [int]$meta.helperStartColumn).Value2
    if ($childStart -lt (Date-Serial '2026-10-10') -or $childStart -gt (Date-Serial '2026-10-20')) { throw 'Summary change did not re-range a feature task.' }
    Assert-Color $broad $broadChild $childStart $green 'Child follows updated major summary'
    $passed.Add('Changing a major Summary Gantt phase updates its new phase header and feature-task estimates.')

    $broad.Cells.Item($testing, 3).ClearContents()
    $excel.CalculateFullRebuild()
    Assert-Color $broad $testing (Date-Serial '2026-12-04') $white 'Blank task date clears bar'
    $passed.Add('Clearing a task date removes its colored bar.')

    $report = [ordered]@{ passed = $true; excelVersion = $excel.Version; workbook = $sourcePath; tests = $passed.ToArray(); existingWorkbookUnchangedByTest = $true }
    $report | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $taskOut 'broad-plan-excel-test.json') -Encoding utf8
    $report | ConvertTo-Json -Depth 6 | Write-Output
}
finally {
    if ($null -ne $book) { $book.Close($false) }
    if ($null -ne $excel) { $excel.Quit() }
    if ($null -ne $book) { [void][System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($book) }
    if ($null -ne $excel) { [void][System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($excel) }
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
}
if ((Get-FileHash -LiteralPath $sourcePath -Algorithm SHA256).Hash -ne $sourceHash) { throw 'The source workbook changed during the isolated test.' }
