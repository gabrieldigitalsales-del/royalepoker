@echo off
setlocal
cd /d "%~dp0"
title Mesa Real - REACT - porta 5173
echo ========================================
echo   MESA REAL - REACT (porta 5173)
echo ========================================
node scripts\check-backend.mjs
if errorlevel 1 (
  echo [ERRO] React nao iniciado, porque o servidor de jogo nao esta pronto.
  pause
  exit /b 1
)
call npm.cmd run dev:web
echo.
echo React encerrado. Verifique os erros acima.
pause
