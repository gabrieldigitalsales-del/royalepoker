@echo off
setlocal
cd /d "%~dp0"
title Mesa Real - SERVIDOR - porta 4190
if exist "%~dp0portable\windows-x64\python\python.exe" set "PYTHON=%~dp0portable\windows-x64\python\python.exe"
echo ========================================
echo   MESA REAL - SERVIDOR (porta 4190)
echo ========================================
call npm.cmd run dev:server
echo.
echo Servidor encerrado. Verifique os erros acima.
pause
