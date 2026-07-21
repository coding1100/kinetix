# Stop listeners on a port; start Kinetix API from backend-py.
param(
  [int]$PreferredPort = 4001,
  [int]$FallbackPort = 4002
)

$Root = Split-Path $PSScriptRoot -Parent

function Get-PortListeners([int]$port) {
  Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
}

function Stop-RealListeners([int]$port) {
  1..3 | ForEach-Object {
    Get-PortListeners $port | ForEach-Object {
      $op = $_.OwningProcess
      if ($op -le 0) { return }
      $proc = Get-Process -Id $op -ErrorAction SilentlyContinue
      if (-not $proc) { return }
      Write-Host "Stopping $($proc.ProcessName) (PID $op) on port $port"
      Stop-Process -Id $op -Force -ErrorAction SilentlyContinue
      taskkill /F /PID $op 2>$null | Out-Null
    }
    Start-Sleep -Seconds 1
  }
}

function Test-PortAvailable([int]$port) {
  $listeners = Get-PortListeners $port
  if (-not $listeners) { return $true }
  foreach ($l in $listeners) {
    $op = $l.OwningProcess
    if ($op -le 0) { continue }
    $proc = Get-Process -Id $op -ErrorAction SilentlyContinue
    if ($proc) { return $false }
  }
  # Port shows LISTENING but no live process (Windows ghost socket)
  return $false
}

function Explain-GhostPort([int]$port) {
  Write-Host ""
  Write-Host "Port $port looks stuck (ghost socket - common on Windows)." -ForegroundColor Yellow
  Write-Host "Using fallback port $FallbackPort instead." -ForegroundColor Yellow
  Write-Host ""
  Write-Host "Update frontend/.env.local:" -ForegroundColor Cyan
  Write-Host "  API_PROXY_TARGET=http://127.0.0.1:$FallbackPort"
  Write-Host "  NEXT_PUBLIC_API_ORIGIN=http://localhost:$FallbackPort"
  Write-Host ""
  Write-Host "Google Cloud redirect URI (if you use Google sign-in):" -ForegroundColor Cyan
  Write-Host "  http://localhost:$FallbackPort/api/v1/auth/google/callback"
  Write-Host ""
}

Stop-RealListeners $PreferredPort
$Port = $PreferredPort
if (-not (Test-PortAvailable $PreferredPort)) {
  Explain-GhostPort $PreferredPort
  Stop-RealListeners $FallbackPort
  if (-not (Test-PortAvailable $FallbackPort)) {
    Write-Host "Ports $PreferredPort and $FallbackPort are both in use." -ForegroundColor Red
    Write-Host "Restart your PC or end Python tasks in Task Manager, then retry."
    exit 1
  }
  $Port = $FallbackPort
}

Set-Location $Root
Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
Write-Host "Starting API at http://127.0.0.1:$Port from $Root"
Write-Host "Health check: http://127.0.0.1:$Port/health (expect build=google-oauth-v1)"
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port $Port
