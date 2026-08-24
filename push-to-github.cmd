@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0push-to-github.ps1" %*
set "PUSH_EXIT=%ERRORLEVEL%"
echo.
if not "%PUSH_EXIT%"=="0" echo Push failed. Read the error above.
pause
exit /b %PUSH_EXIT%
