@echo off
cd /d "%~dp0"
echo TESTES RAPIDOS: showdown, Run It 2/3, Cucurucho, privacidade, Double Board
call npm run test:smoke
echo.
pause
