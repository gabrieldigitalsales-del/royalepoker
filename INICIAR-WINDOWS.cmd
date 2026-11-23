@echo off
setlocal
cd /d "%~dp0"
set "PYTHON=%~dp0portable\windows-x64\python\python.exe"
"%~dp0portable\windows-x64\node\node.exe" launcher.mjs
echo.
pause
