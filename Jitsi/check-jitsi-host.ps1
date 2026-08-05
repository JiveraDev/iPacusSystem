$ErrorActionPreference = 'Continue'

$meetingHost = 'meet.ipawcus.com'
$composeDirectory = Join-Path $PSScriptRoot 'docker-jitsi-meet-stable-11031'

Write-Output '=== iPawcus Jitsi host check ==='
Write-Output "Checked at: $([DateTimeOffset]::Now.ToString('yyyy-MM-dd HH:mm:ss zzz'))"

Write-Output "`nLAN addresses and gateways"
[Net.NetworkInformation.NetworkInterface]::GetAllNetworkInterfaces() |
    Where-Object { $_.OperationalStatus -eq [Net.NetworkInformation.OperationalStatus]::Up } |
    ForEach-Object {
        $properties = $_.GetIPProperties()
        $addresses = $properties.UnicastAddresses |
            Where-Object { $_.Address.AddressFamily -eq [Net.Sockets.AddressFamily]::InterNetwork } |
            ForEach-Object { $_.Address.IPAddressToString }
        $gateways = $properties.GatewayAddresses |
            Where-Object { $_.Address.AddressFamily -eq [Net.Sockets.AddressFamily]::InterNetwork } |
            ForEach-Object { $_.Address.IPAddressToString }

        if ($addresses) {
            [PSCustomObject]@{
                Interface = $_.Name
                IPv4 = $addresses -join ', '
                Gateway = $gateways -join ', '
            }
        }
    } | Format-Table -AutoSize

Write-Output "`nPublic IPv4"
try {
    $publicIPv4 = (Invoke-RestMethod -UseBasicParsing -Uri 'https://api.ipify.org?format=text' -TimeoutSec 10).Trim()
    Write-Output $publicIPv4
} catch {
    Write-Warning "Unable to retrieve the public IPv4: $($_.Exception.Message)"
    $publicIPv4 = $null
}

Write-Output "`nDNS A records for $meetingHost"
try {
    $dnsAddresses = Resolve-DnsName $meetingHost -Type A -ErrorAction Stop |
        Where-Object { $_.IPAddress } |
        Select-Object -ExpandProperty IPAddress -Unique
    if ($dnsAddresses) {
        $dnsAddresses | ForEach-Object { Write-Output $_ }
        if ($publicIPv4 -and $publicIPv4 -notin $dnsAddresses) {
            Write-Warning 'The public IPv4 does not match the meeting DNS record.'
        }
    } else {
        Write-Warning 'No A record was returned.'
    }
} catch {
    Write-Warning "The meeting DNS record is unavailable: $($_.Exception.Message)"
}

Write-Output "`nLocal HTTPS"
if (Get-Command curl.exe -ErrorAction SilentlyContinue) {
    & curl.exe -k -sS -o NUL -w "HTTP status: %{http_code}`n" https://localhost:8443/
} else {
    Write-Warning 'curl.exe is unavailable; local HTTPS was not checked.'
}

Write-Output "`nDocker services"
if ((Get-Command docker -ErrorAction SilentlyContinue) -and (Test-Path -LiteralPath $composeDirectory)) {
    Push-Location $composeDirectory
    try {
        & docker compose --project-name docker-jitsi-meet ps --all
    } finally {
        Pop-Location
    }
} else {
    Write-Warning 'Docker or the Jitsi Compose directory is unavailable.'
}

Write-Output "`nExpected local mappings"
Write-Output 'HTTP:       localhost:8088 -> container:80'
Write-Output 'HTTPS:      localhost:8443 -> container:443'
Write-Output 'Media UDP:  host:10000 -> container:10000'
