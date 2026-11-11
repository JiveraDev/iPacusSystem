$ErrorActionPreference = 'Stop'
$excel = $null
$book = $null
$started = Get-Date
try {
    $excel = New-Object -ComObject Excel.Application
    $excel.Visible = $false
    $excel.DisplayAlerts = $false
    $excel.EnableEvents = $false
    $missing = [System.Type]::Missing
    $source = Join-Path $PSScriptRoot 'broad-plan-excel-test-copy.xlsx'
    $book = $excel.Workbooks.Open($source, 0, $false, $missing, $missing, $missing, $true, $missing, $missing, $missing, $false, $missing, $false, $true, 1)
    $repaired = Join-Path $PSScriptRoot 'diagnostic-repaired-broad.xlsx'
    $book.SaveAs($repaired, 51)
    Write-Output ('Repaired sheet count: ' + $book.Worksheets.Count)
    Write-Output ('Repaired copy: ' + $repaired)
    $logs = Get-ChildItem -LiteralPath $env:TEMP -Filter 'error*.xml' -File -ErrorAction SilentlyContinue | Where-Object { $_.LastWriteTime -ge $started.AddMinutes(-1) }
    foreach ($log in $logs) { Write-Output $log.FullName; Get-Content -LiteralPath $log.FullName -Raw | Write-Output }
}
finally {
    if ($null -ne $book) { $book.Close($false); [void][System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($book) }
    if ($null -ne $excel) { $excel.Quit(); [void][System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($excel) }
    [GC]::Collect(); [GC]::WaitForPendingFinalizers()
}
