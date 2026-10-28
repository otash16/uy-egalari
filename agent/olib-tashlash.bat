@echo off
rem Fon agentini to'xtatadi va avtostartdan olib tashlaydi.
chcp 65001 >nul
cd /d "%~dp0"
title Uy egalari agenti - olib tashlash
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { ($_.Name -eq 'cmd.exe' -and ($_.CommandLine -like '*run-service.cmd*' -or $_.CommandLine -like '*start-agent.bat*')) -or ($_.Name -like 'node*' -and $_.CommandLine -like '*tsx*' -and $_.CommandLine -like '*index.ts*') } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
del "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\Uy egalari agenti.lnk" >nul 2>&1
echo Agent to'xtatildi va avtostartdan olib tashlandi. Papkani o'chirsangiz bo'ladi.
pause
