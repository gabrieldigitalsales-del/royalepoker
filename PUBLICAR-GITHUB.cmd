@echo off
setlocal
cd /d "%~dp0"
where git >nul 2>nul
if errorlevel 1 (
 echo Git nao encontrado. Instale Git para Windows: https://git-scm.com/download/win
 pause
 exit /b 1
)
if not exist .git (git init || goto :fail)
git branch -M main || goto :fail
git remote get-url origin >nul 2>nul
if errorlevel 1 (
 git remote add origin https://github.com/gabrieldigitalsales-del/royalepoker.git || goto :fail
)
git add . || goto :fail
git diff --cached --quiet
if errorlevel 1 (
 git commit -m "Poker Royale - deploy Render e correcoes de showdown" || goto :fail
)
git push -u origin main || goto :fail
echo.
echo Codigo enviado ao GitHub. Agora abra https://dashboard.render.com/blueprints
goto :end
:fail
echo.
echo Erro no envio. Verifique a autenticacao do GitHub mostrada acima.
:end
pause
