@echo off
cd /d "%~dp0"
title Publish blog to GitHub Pages

echo.
echo   Publishing changes to GitHub...
echo.

git add -A
git diff --cached --quiet
if %errorlevel%==0 (
  echo   Nothing new to publish. No changes found.
  echo.
  pause
  exit /b 0
)

git commit -m "update: %date% %time%"
if errorlevel 1 (
  echo.
  echo   Commit failed. Please check the message above.
  pause
  exit /b 1
)

git push
if errorlevel 1 (
  echo.
  echo   Push failed. Check your network or GitHub login, then try again.
  pause
  exit /b 1
)

echo.
echo   Done! Your site will be updated in about 1 minute:
echo   https://wrywznb.github.io/xuhome/
echo.
pause
