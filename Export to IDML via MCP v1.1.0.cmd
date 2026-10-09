@echo off
REM Script Name: Export to IDML via MCP
REM Description: Exports the currently active Affinity document through the MCP bridge and verifies import.
REM Preview image: Add a 16x9 preview image before publishing.
REM Version: 1.1.0
REM version: 1.1.0
REM Author: zaum
REM Contact: https://github.com/zaum
REM Code:
setlocal
cd /d "%~dp0"
node "tools\run_idml_export.cjs" --check-import --check-fonts
if errorlevel 1 (
  echo.
  echo IDML export failed. Keep Affinity open and check that its MCP connection is enabled.
) else (
  echo.
  echo IDML export and Affinity import check completed.
)
echo.
pause
