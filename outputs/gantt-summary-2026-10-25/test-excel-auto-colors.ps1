$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$taskOut = $PSScriptRoot
$sourcePath = Join-Path $taskOut 'iPawcus_Gantt_Auto_Color_2026.xlsx'
$testPath = Join-Path $taskOut 'auto-color-excel-test-copy.xlsx'
Copy-Item -LiteralPath $sourcePath -Destination $testPath -Force
$excel = $null
$book = $null
$passed = [System.Collections.Generic.List[string]]::new()
$green = [System.Drawing.ColorTranslator]::ToOle([System.Drawing.ColorTranslator]::FromHtml('#70AD47'))
$yellow = [System.Drawing.ColorTranslator]::ToOle([System.Drawing.ColorTranslator]::FromHtml('#FFD966'))
$white = [System.Drawing.ColorTranslator]::ToOle([System.Drawing.Color]::White)

function Find-TaskRow($Sheet, [string]$TaskId) {
    for ($row = 8; $row -le $Sheet.UsedRange.Rows.Count; $row++) {
        if ($Sheet.Cells.Item($row, 1).Value2 -eq $TaskId) { return $row }
    }
    throw ('Task not found: ' + $TaskId)
}
function Get-DayCell($Sheet, [int]$Row, [string]$DateText) {
    $startSerial = [double]$Sheet.Cells.Item(7, 4).Value2
    $targetSerial = [datetime]::ParseExact($DateText, 'yyyy-MM-dd', [cultureinfo]::InvariantCulture).ToOADate()
    $col = [int](4 + $targetSerial - $startSerial)
    return $Sheet.Cells.Item($Row, $col)
}
function Assert-DayColor($Sheet, [int]$Row, [string]$DateText, [int]$Expected, [string]$Label) {
    $cell = Get-DayCell $Sheet $Row $DateText
    $actual = [int]$cell.DisplayFormat.Interior.Color
    if ($actual -ne $Expected) {
        $conditions = @()
        for ($i = 1; $i -le $cell.FormatConditions.Count; $i++) {
            $condition = $cell.FormatConditions.Item($i)
            $conditions += [pscustomobject]@{ formula = $condition.Formula1; color = $condition.Interior.Color; appliesTo = $condition.AppliesTo.Address() }
        }
        [pscustomobject]@{ sheet = $Sheet.Name; address = $cell.Address(); dateText = $Sheet.Cells.Item($Row, 3).Value2; cellFormula = $cell.Formula; cellValue = $cell.Value2; conditions = $conditions } | ConvertTo-Json -Depth 6 | Write-Output
        throw ('{0}: {1}!{2}, expected {3}, got {4}' -f $Label, $Sheet.Name, $cell.Address(), $Expected, $actual)
    }
}
function Set-Dates($Sheet, [int]$Row, [string]$Start, [string]$Finish) {
    $startDate = [datetime]::ParseExact($Start, 'yyyy-MM-dd', [cultureinfo]::InvariantCulture)
    $finishDate = [datetime]::ParseExact($Finish, 'yyyy-MM-dd', [cultureinfo]::InvariantCulture)
    $Sheet.Cells.Item($Row, 3).Value2 = $startDate.ToString('d MMM', [cultureinfo]::InvariantCulture) + ' - ' + $finishDate.ToString('d MMM', [cultureinfo]::InvariantCulture)
}

try {
    $excel = New-Object -ComObject Excel.Application
    $excel.Visible = $false
    $excel.DisplayAlerts = $false
    $excel.EnableEvents = $false
    $book = $excel.Workbooks.Open($testPath, 0, $false)
    $excel.Calculation = -4105
    $excel.CalculateFullRebuild()
    $main = $book.Worksheets.Item('Summary Gantt')
    $detail = $book.Worksheets.Item('Increment Gantt')
    $schedule = $book.Worksheets.Item('Edit Schedule')
    $design = Find-TaskRow $main 'I1-D'
    $designDetail = Find-TaskRow $detail 'I1-D'
    $testing = Find-TaskRow $main 'I1-T'
    $testingDetail = Find-TaskRow $detail 'I1-T'
    $system = Find-TaskRow $main 'SYS-REV'
    $paper = Find-TaskRow $main 'PAPER-REV'
    Assert-DayColor $main $design '2026-04-20' $green 'Initial green design'
    Assert-DayColor $main $design '2026-04-27' $white 'Initial design boundary'
    Assert-DayColor $main $testing '2026-05-11' $yellow 'Initial yellow testing'
    Assert-DayColor $main $system '2026-10-05' $green 'System revision start'
    Assert-DayColor $main $system '2026-10-21' $green 'System revision finish'
    Assert-DayColor $main $paper '2026-10-06' $green 'Paper revision start'
    Assert-DayColor $main $paper '2026-10-30' $green 'Paper revision finish'
    $passed.Add('Initial green/yellow dates and user-supplied revision ranges render in Excel.')

    Set-Dates $main $design '2026-05-01' '2026-05-03'
    $excel.CalculateFullRebuild()
    Assert-DayColor $main $design '2026-04-20' $white 'Old design date clears'
    Assert-DayColor $main $design '2026-05-01' $green 'Edited design starts green'
    Assert-DayColor $main $design '2026-05-03' $green 'Edited design finishes green'
    Assert-DayColor $main $design '2026-05-04' $white 'Edited design finish boundary'
    Assert-DayColor $detail $designDetail '2026-04-20' $white 'Linked detail old date clears'
    Assert-DayColor $detail $designDetail '2026-05-01' $green 'Linked detail moves automatically'
    if ($detail.Cells.Item($designDetail, 3).Value2 -ne '1 May - 3 May') { throw 'Linked detail date text did not update.' }
    $passed.Add('Changing design Date column C moves the green bar, clears the previous range and updates the linked Gantt.')

    Set-Dates $main $testing '2026-06-01' '2026-06-03'
    $excel.CalculateFullRebuild()
    Assert-DayColor $main $testing '2026-05-11' $white 'Old testing date clears'
    Assert-DayColor $main $testing '2026-06-01' $yellow 'Edited testing starts yellow'
    Assert-DayColor $main $testing '2026-06-03' $yellow 'Edited testing finishes yellow'
    Assert-DayColor $main $testing '2026-06-04' $white 'Edited testing boundary'
    Assert-DayColor $detail $testingDetail '2026-06-01' $yellow 'Linked testing moves automatically'
    $passed.Add('Changing testing dates moves the yellow bar and clears the previous range.')

    $coding = Find-TaskRow $main 'I2-C'
    $codingDetail = Find-TaskRow $detail 'I2-C'
    $codingSource = Find-TaskRow $schedule 'I2-C'
    $schedule.Cells.Item($codingSource, 6).Formula = '=DATE(2026,11,10)'
    $schedule.Cells.Item($codingSource, 7).Formula = '=DATE(2026,11,12)'
    $excel.CalculateFullRebuild()
    if ($main.Cells.Item($coding, 3).Value2 -ne '10 Nov - 12 Nov') { throw 'Date column C did not update from Edit Schedule.' }
    Assert-DayColor $main $coding '2026-05-20' $white 'Old source coding date clears'
    Assert-DayColor $main $coding '2026-11-10' $green 'Edit Schedule moves main coding bar'
    Assert-DayColor $detail $codingDetail '2026-11-10' $green 'Edit Schedule moves linked coding bar'
    $passed.Add('Editing the original Start/Finish cells on Edit Schedule updates Date column C and both colored Gantt views.')

    Set-Dates $main $system '2026-11-02' '2026-11-06'
    Set-Dates $main $paper '2026-12-01' '2026-12-05'
    $excel.CalculateFullRebuild()
    Assert-DayColor $main $system '2026-10-05' $white 'Old system revision clears'
    Assert-DayColor $main $system '2026-11-02' $green 'System revision moves into November'
    Assert-DayColor $main $system '2026-11-07' $white 'System revision end boundary'
    Assert-DayColor $main $paper '2026-10-06' $white 'Old paper revision clears'
    Assert-DayColor $main $paper '2026-12-01' $green 'Paper revision moves into December'
    Assert-DayColor $main $paper '2026-12-06' $white 'Paper revision end boundary'
    $passed.Add('Revision bars can be moved into November and December without leaving old colored cells.')

    $main.Cells.Item($paper, 3).Value2 = '1 Dec ' + [char]0x2013 + ' 5 Dec'
    $excel.CalculateFullRebuild()
    Assert-DayColor $main $paper '2026-12-01' $green 'En-dash date range starts green'
    Assert-DayColor $main $paper '2026-12-06' $white 'En-dash date range end boundary'
    $passed.Add('Date ranges accept a regular hyphen or an en dash between the dates.')

    $main.Cells.Item($design, 3).ClearContents()
    $excel.CalculateFullRebuild()
    Assert-DayColor $main $design '2026-05-01' $white 'Clearing dates removes bar'
    Assert-DayColor $detail $designDetail '2026-05-01' $white 'Clearing dates removes linked bar'
    $passed.Add('Clearing Date column C removes the bar in both views.')

    $result = [ordered]@{ passed = $true; excelVersion = $excel.Version; workbook = $sourcePath; tests = $passed.ToArray(); originalWorkbookUnchanged = $true }
    $result | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $taskOut 'excel-auto-color-test.json') -Encoding utf8
    $result | ConvertTo-Json -Depth 6 | Write-Output
}
finally {
    if ($null -ne $book) { $book.Close($false) }
    if ($null -ne $excel) { $excel.Quit() }
    if ($null -ne $book) { [void][System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($book) }
    if ($null -ne $excel) { [void][System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($excel) }
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
}
