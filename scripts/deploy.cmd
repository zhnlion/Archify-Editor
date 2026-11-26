@echo off
REM Archify Editor — Windows CMD 入口（转发到 deploy.ps1）
setlocal EnableExtensions DisableDelayedExpansion
cd /d "%~dp0.."

where powershell >nul 2>&1
if errorlevel 1 (
  if not exist "logs" mkdir "logs"
  set "FAIL_LOG=%CD%\logs\deploy-startup-failed-%RANDOM%.log"
  > "%FAIL_LOG%" echo [%date% %time%] PowerShell not found.
  >> "%FAIL_LOG%" echo cwd=%CD%
  echo ERROR: PowerShell not found.
  echo Log: %FAIL_LOG%
  exit /b 1
)

set "STAMP=unknown"
for /f "delims=" %%I in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set "STAMP=%%I"
if not exist "logs" mkdir "logs"
set "ARCHIFY_DEPLOY_LOG=%CD%\logs\deploy-%STAMP%-%RANDOM%.log"
> "%ARCHIFY_DEPLOY_LOG%" echo [%date% %time%] deploy.cmd start
>> "%ARCHIFY_DEPLOY_LOG%" echo cwd=%CD%
>> "%ARCHIFY_DEPLOY_LOG%" echo args=%*

echo Log: %ARCHIFY_DEPLOY_LOG%
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy.ps1" %*
set "DEPLOY_EXIT=%ERRORLEVEL%"
>> "%ARCHIFY_DEPLOY_LOG%" echo [%date% %time%] deploy.cmd exit=%DEPLOY_EXIT%

if not "%DEPLOY_EXIT%"=="0" (
  echo.
  echo ERROR: Deploy failed. Exit code: %DEPLOY_EXIT%
  echo Log retained at: %ARCHIFY_DEPLOY_LOG%
) else (
  echo Log: %ARCHIFY_DEPLOY_LOG%
)
exit /b %DEPLOY_EXIT%
