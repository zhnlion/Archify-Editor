# Archify Editor - Windows one-click deploy (build + optional preview)
param(
  [switch]$NoServe,
  [switch]$WithArchifyCheck,
  [switch]$ReinstallDeps,
  [int]$Port = 4173
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$LogDir = Join-Path $Root "logs"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$LogPath = if ($env:ARCHIFY_DEPLOY_LOG) {
  [System.IO.Path]::GetFullPath($env:ARCHIFY_DEPLOY_LOG)
} else {
  Join-Path $LogDir ("deploy-{0}.log" -f (Get-Date -Format "yyyyMMdd-HHmmss"))
}

function Write-DeployLog {
  param(
    [string]$Message,
    [ConsoleColor]$Color = [ConsoleColor]::Gray
  )
  $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Message
  try {
    Add-Content -LiteralPath $LogPath -Value $line -Encoding UTF8
  } catch {
    # Console output must still work if the log volume becomes unavailable.
  }
  Write-Host $Message -ForegroundColor $Color
}

function Invoke-Npm {
  param([string[]]$NpmArgs)

  Write-DeployLog ("==> npm " + ($NpmArgs -join " "))
  & $NpmCommand @NpmArgs 2>&1 |
    ForEach-Object {
      $line = $_.ToString()
      Write-Host $line
      Add-Content -LiteralPath $LogPath -Value $line -Encoding UTF8
    }
  $code = $LASTEXITCODE
  Write-DeployLog "(npm exit=$code)"
  return $code
}

$ExitCode = 0
try {
  Write-DeployLog "==> Archify Editor deploy (Windows)" ([ConsoleColor]::Cyan)
  Write-DeployLog "    cwd: $Root"
  Write-DeployLog "    log: $LogPath"

  if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw "node not found. Install Node.js >= 18."
  }
  if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw "npm not found. Install Node.js >= 18."
  }
  $NpmCommand = if (Get-Command npm.cmd -ErrorAction SilentlyContinue) { "npm.cmd" } else { "npm" }

  $nodeVer = node -v
  $major = [int](($nodeVer.TrimStart("v").Split("."))[0])
  if ($major -lt 18) {
    throw "Node.js >= 18 required (found $nodeVer)."
  }
  $npmVer = (& $NpmCommand -v 2>&1 | Select-Object -First 1)
  Write-DeployLog "==> node $nodeVer / npm $npmVer"

  $requiredDeps = @(
    "node_modules\vite\package.json",
    "node_modules\typescript\package.json",
    "node_modules\react\package.json",
    "node_modules\react-dom\package.json"
  )
  $missingDeps = @($requiredDeps | Where-Object { -not (Test-Path (Join-Path $Root $_)) })
  $depsReady = $missingDeps.Count -eq 0
  $nodeModulesExists = Test-Path (Join-Path $Root "node_modules")

  if ($ReinstallDeps -or -not $nodeModulesExists) {
    if ($ReinstallDeps) {
      Write-DeployLog "==> dependency reinstall requested"
    } else {
      Write-DeployLog "==> node_modules missing; clean install"
    }

    # npm ci removes node_modules first. Use it only for a clean install request.
    if (Test-Path "package-lock.json") {
      $code = Invoke-Npm @("ci")
      if ($code -ne 0) {
        throw "npm ci failed with exit code $code. Close running Node/Vite processes, then rerun."
      }
    } else {
      $code = Invoke-Npm @("install")
      if ($code -ne 0) {
        throw "npm install failed with exit code $code"
      }
    }
  } elseif (-not $depsReady) {
    Write-DeployLog "==> dependencies incomplete; repairing with npm install"
    $code = Invoke-Npm @("install")
    if ($code -ne 0) {
      throw "npm install repair failed with exit code $code"
    }
  } else {
    Write-DeployLog "==> dependencies already installed; skipping npm ci"
    Write-DeployLog "    Use -ReinstallDeps to force a clean dependency reinstall."
  }

  $code = Invoke-Npm @("run", "build")
  if ($code -ne 0) {
    throw "npm run build failed with exit code $code"
  }

  if ($WithArchifyCheck) {
    $candidates = @()
    if ($env:ARCHIFY_BIN) { $candidates += $env:ARCHIFY_BIN }
    $candidates += (Join-Path $Root "tools\archify\bin\archify.mjs")
    $found = $candidates | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
    if ($found) {
      Write-DeployLog "==> Archify CLI OK: $found"
    } else {
      Write-DeployLog "==> WARN: Archify CLI not found (HTML finalize optional)."
      Write-DeployLog "    Expect tools\archify or set ARCHIFY_BIN."
    }
  }

  Write-DeployLog "==> build OK -> $Root\dist" ([ConsoleColor]::Green)
  Write-DeployLog "    Tip: for lowest footprint, host dist\ with Nginx/IIS and use -NoServe."

  if ($NoServe) {
    Write-DeployLog "==> done (-NoServe)" ([ConsoleColor]::Green)
  } else {
    Write-DeployLog "==> preview http://127.0.0.1:$Port/  (Ctrl+C to stop)" ([ConsoleColor]::Cyan)
    $code = Invoke-Npm @("run", "preview", "--", "--host", "0.0.0.0", "--port", "$Port")
    if ($code -ne 0) {
      throw "preview failed with exit code $code"
    }
  }
} catch {
  $ExitCode = 1
  Write-DeployLog ""
  Write-DeployLog "ERROR: $($_.Exception.Message)" ([ConsoleColor]::Red)
  if ($_.ScriptStackTrace) {
    Write-DeployLog $_.ScriptStackTrace ([ConsoleColor]::DarkGray)
  }
}

Write-DeployLog "deploy script exit=$ExitCode" ($(if ($ExitCode -eq 0) { [ConsoleColor]::Green } else { [ConsoleColor]::Red }))
Write-DeployLog "Deploy log retained at: $LogPath" ([ConsoleColor]::Yellow)
exit $ExitCode
