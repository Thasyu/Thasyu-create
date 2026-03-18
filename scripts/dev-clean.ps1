$nextNodeProcesses = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" | Where-Object {
    $_.CommandLine -and (
        $_.CommandLine -match "next\\dist\\bin\\next" -or
        $_.CommandLine -match "\\bnext\\s+dev\\b" -or
        $_.CommandLine -match "\\bnext-dev\\b"
    )
}

foreach ($process in $nextNodeProcesses) {
    try {
        Stop-Process -Id $process.ProcessId -Force -ErrorAction Stop
    }
    catch {
    }
}

Start-Sleep -Milliseconds 500

$lockFile = ".next/dev/lock"
if (Test-Path $lockFile) {
    Remove-Item $lockFile -Force -ErrorAction SilentlyContinue
}

Write-Host "Next dev cleanup complete."
