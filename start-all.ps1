# start-all.ps1 — Boot all DocVault services in separate windows
param([switch]$StopAll)

$root = $PSScriptRoot

$services = @(
  @{ name="metadata-service"; dir="services\metadata-service"; port=3001 }
  @{ name="document-service"; dir="services\document-service"; port=3002 }
  @{ name="workflow-service"; dir="services\workflow-service"; port=3003 }
  @{ name="audit-service";    dir="services\audit-service";    port=3004 }
  @{ name="notification-service"; dir="services\notification-service"; port=3005 }
  @{ name="gateway";          dir="services\gateway";          port=3000 }
  @{ name="web";              dir="apps\web";                  port=3010 }
)

if ($StopAll) {
  Write-Host "Stopping all services..."
  foreach ($svc in $services) {
    $procs = Get-NetTCPConnection -LocalPort $svc.port -ErrorAction SilentlyContinue | ForEach-Object { Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue }
    foreach ($p in $procs) {
      Write-Host "Stopping $($svc.name) (PID $($p.Id))"
      Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
    }
  }
  return
}

Write-Host "Starting DocVault services..."
foreach ($svc in $services) {
  $dir = Join-Path $root $svc.dir
  $existing = Get-NetTCPConnection -LocalPort $svc.port -ErrorAction SilentlyContinue
  if ($existing) {
    Write-Host "[SKIP] $($svc.name) already on port $($svc.port)"
    continue
  }
  if ($svc.name -eq "web") {
    $cmd = "npx next dev -p 3010"
  } else {
    $cmd = "npm run start:dev"
  }
  Write-Host "[BOOT] $($svc.name) in $dir"
  Start-Process -FilePath "cmd.exe" -ArgumentList "/c cd /d `"$dir`" && $cmd" -WindowStyle Normal
  Start-Sleep -Milliseconds 500
}

Write-Host ""
Write-Host "All services launching. Wait ~30s for ready, then run:"
Write-Host "  node scripts/e2e-check.mjs"
