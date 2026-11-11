$ErrorActionPreference = 'Stop'
$excel = $null
$results = [System.Collections.Generic.List[object]]::new()
try {
    $excel = New-Object -ComObject Excel.Application
    $excel.Visible = $false
    $excel.DisplayAlerts = $false
    $excel.EnableEvents = $false
    foreach ($name in @('diagnostic-fixed-outline.xlsx', 'diagnostic-no-outline-pr.xlsx')) {
        $book = $null
        try {
            $path = [string](Join-Path $PSScriptRoot $name)
            $book = $excel.Workbooks.Open($path, 0, $true)
            $results.Add([pscustomobject]@{ file = $name; opened = $true; sheets = $book.Worksheets.Count })
        }
        catch { $results.Add([pscustomobject]@{ file = $name; opened = $false; error = $_.Exception.Message }) }
        finally { if ($null -ne $book) { $book.Close($false); [void][System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($book) } }
    }
    $results | ConvertTo-Json -Depth 5 | Write-Output
}
finally {
    if ($null -ne $excel) { $excel.Quit(); [void][System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($excel) }
    [GC]::Collect(); [GC]::WaitForPendingFinalizers()
}
