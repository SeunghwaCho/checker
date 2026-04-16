@echo off
setlocal

cd /d "%~dp0"

set RELEASE_DIR=release

if exist "%RELEASE_DIR%" rmdir /s /q "%RELEASE_DIR%"
mkdir "%RELEASE_DIR%"

copy style.css "%RELEASE_DIR%\" >nul
copy app.js    "%RELEASE_DIR%\" >nul

powershell -Command "(Get-Content 'index.html' -Encoding UTF8) | Where-Object { $_ -notmatch 'tests\.js' } | Set-Content '%RELEASE_DIR%\index.html' -Encoding UTF8"

echo Build done: %RELEASE_DIR%\
dir /b "%RELEASE_DIR%"
