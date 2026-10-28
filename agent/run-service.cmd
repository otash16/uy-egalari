@echo off
rem Agentni oynasiz, uzluksiz yuritadi (run-hidden.vbs shuni chaqiradi). Chiqish agent.log ga yoziladi.
chcp 65001 >nul
cd /d "%~dp0"
if not exist node_modules call npm install --silent >> agent.log 2>&1
:loop
for %%A in (agent.log) do if %%~zA GTR 2000000 del agent.log
echo [%date% %time%] agent ishga tushdi >> agent.log
call npx tsx src/index.ts >> agent.log 2>&1
echo [%date% %time%] agent to'xtadi, 5 soniyadan keyin qayta >> agent.log
timeout /t 5 /nobreak >nul
goto loop
