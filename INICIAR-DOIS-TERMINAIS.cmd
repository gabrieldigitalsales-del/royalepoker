@echo off
setlocal
cd /d "%~dp0"
title Poker Royale - Inicializador
if not exist "package.json" (
  echo [ERRO] Execute este arquivo dentro da pasta Poker Royale / MesaReal.
  pause
  exit /b 1
)
where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo [ERRO] npm nao encontrado. Instale Node.js com npm.
  pause
  exit /b 1
)
rem Confere as duas dependencias essenciais antes de abrir ambos os terminais.
if not exist "node_modules\vite\bin\vite.js" goto install
if not exist "node_modules\ws\package.json" goto install
if not exist "node_modules\react\package.json" goto install
if not exist "node_modules\typescript\bin\tsc" goto install
goto launch
:install
echo.
echo [Poker Royale] Dependencias incompletas. Instalando tudo com npm install...
call npm.cmd install
if errorlevel 1 (
  echo [ERRO] npm install falhou. Veja a mensagem acima.
  pause
  exit /b 1
)
if not exist "node_modules\ws\package.json" (
  echo [ERRO] O pacote ws ainda nao foi instalado.
  pause
  exit /b 1
)
if not exist "node_modules\vite\bin\vite.js" (
  echo [ERRO] O Vite ainda nao foi instalado.
  pause
  exit /b 1
)
if not exist "node_modules\react\package.json" (
  echo [ERRO] React nao encontrado apos instalacao.
  pause
  exit /b 1
)
if not exist "node_modules\typescript\bin\tsc" (
  echo [ERRO] TypeScript nao encontrado apos instalacao.
  pause
  exit /b 1
)
:launch
start "" "%~dp0ABRIR-SERVIDOR.cmd"
start "" "%~dp0ABRIR-REACT.cmd"
echo.
echo [Poker Royale] Servidor e React iniciados em janelas separadas.
echo Acesse: http://127.0.0.1:5173
exit /b 0
