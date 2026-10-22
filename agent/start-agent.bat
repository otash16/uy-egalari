@echo off
chcp 65001 >nul
title Uy egalari agenti
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js topilmadi. https://nodejs.org dan LTS versiyasini o'rnating. & pause & exit /b 1)
if not exist node_modules (echo Paketlar o'rnatilmoqda... & call npm install --silent || (pause & exit /b 1))
if not exist config.json (echo config.json yo'q. config.example.json dan nusxa olib to'ldiring. & pause & exit /b 1)
:loop
call npx tsx src/index.ts
echo Agent to'xtadi, 5 soniyadan keyin qayta ishga tushadi...
timeout /t 5 >nul
goto loop
