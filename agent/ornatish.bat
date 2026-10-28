@echo off
rem Agentni fon xizmati sifatida o'rnatadi: oynasiz ishlaydi, Windows'ga kirganda o'zi ishga tushadi.
rem Bir marta ikki marta bosiladi. Admin huquqi shart emas.
chcp 65001 >nul
cd /d "%~dp0"
title Uy egalari agenti - o'rnatish
echo Uy egalari agenti - fon xizmati sifatida o'rnatish
echo.
where node >nul 2>nul || (echo Node.js topilmadi. https://nodejs.org dan LTS versiyasini o'rnating, kompyuterni qayta yoqing, keyin shu faylni qayta bosing. & pause & exit /b 1)
if not exist config.json (echo config.json yo'q. Sherigingiz bergan zipdan to'liq ochilganini tekshiring. & pause & exit /b 1)
if not exist node_modules (echo Paketlar o'rnatilmoqda, 1-2 daqiqa... & call npm install --silent || (echo Paketlar o'rnatilmadi - internet bormi? & pause & exit /b 1))

echo Eski ochiq agentlar to'xtatilmoqda...
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { ($_.Name -eq 'cmd.exe' -and ($_.CommandLine -like '*run-service.cmd*' -or $_.CommandLine -like '*start-agent.bat*')) -or ($_.Name -like 'node*' -and $_.CommandLine -like '*tsx*' -and $_.CommandLine -like '*index.ts*') } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"

echo Avtostart sozlanmoqda...
del "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\Uy egalari agenti.lnk" >nul 2>&1
powershell -NoProfile -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Startup')+'\Uy egalari agenti.lnk'); $s.TargetPath='wscript.exe'; $s.Arguments=[char]34+'%~dp0run-hidden.vbs'+[char]34; $s.WorkingDirectory='%~dp0'; $s.Description='Uy egalari doskasi agenti (fonda)'; $s.Save()" || (echo Avtostart yorlig'i yaratilmadi & pause & exit /b 1)

echo Agent ishga tushirilmoqda...
wscript.exe "%~dp0run-hidden.vbs"
timeout /t 6 /nobreak >nul
echo.
echo ================================================================
echo  Tayyor. Agent fonda ishlayapti, hech qanday oyna ochilmaydi.
echo  Kompyuter qayta yonganda o'zi ishga tushadi.
echo  Holatini ko'rish: shu papkadagi agent.log fayli.
echo  To'xtatish / olib tashlash: olib-tashlash.bat
echo ================================================================
echo.
echo agent.log oxirgi qatorlari:
powershell -NoProfile -Command "if (Test-Path agent.log) { Get-Content agent.log -Tail 6 }"
echo.
pause
