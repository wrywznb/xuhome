@echo off
cd /d "%~dp0"
title Blog Preview - http://localhost:4173

echo.
echo   Blog preview: http://localhost:4173
echo   The browser will open in a moment.
echo   Close this window to stop the server.
echo.

start "" /min cmd /c "timeout /t 2 /nobreak >nul & explorer http://localhost:4173"
node scripts/serve.mjs

echo.
echo Server stopped. Press any key to close.
pause >nul
