$ErrorActionPreference = 'Stop'

$environmentPath = Join-Path $PSScriptRoot '.env'
if (-not (Test-Path -LiteralPath $environmentPath)) {
    throw "Jitsi environment file was not found: $environmentPath"
}

$passwordNames = @(
    'JICOFO_AUTH_PASSWORD',
    'JVB_AUTH_PASSWORD',
    'JIGASI_XMPP_PASSWORD',
    'JIGASI_TRANSCRIBER_PASSWORD',
    'JIBRI_RECORDER_PASSWORD',
    'JIBRI_XMPP_PASSWORD'
)

$content = Get-Content -LiteralPath $environmentPath -Raw

foreach ($passwordName in $passwordNames) {
    $passwordBytes = New-Object byte[] 16
    $randomNumberGenerator = [Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $randomNumberGenerator.GetBytes($passwordBytes)
    } finally {
        $randomNumberGenerator.Dispose()
    }
    $password = ([BitConverter]::ToString($passwordBytes) -replace '-', '').ToLowerInvariant()

    $pattern = "(?m)^$([Regex]::Escape($passwordName))=.*$"
    if (-not [Regex]::IsMatch($content, $pattern)) {
        throw "Missing required setting in .env: $passwordName"
    }

    $content = [Regex]::Replace($content, $pattern, "$passwordName=$password")
}

[IO.File]::WriteAllText($environmentPath, $content, [Text.UTF8Encoding]::new($false))
Write-Output 'Generated all required Jitsi internal passwords.'
