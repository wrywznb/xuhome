@echo off
cd /d "%~dp0"
title Publish blog to GitHub Pages

echo.
echo   Publishing changes to GitHub...
echo.

git add -A
git diff --cached --quiet
if errorlevel 1 (
  git commit -m "update: %date% %time%"
  if errorlevel 1 (
    echo.
    echo   Commit failed. Please check the message above.
    pause
    exit /b 1
  )
) else (
  echo   No new local changes to commit.
)

echo   Pushing...
git push
if errorlevel 1 (
  echo.
  echo   Push failed, but your commit is safe on this computer.
  echo   Check your proxy / network, then run this file again to retry.
  pause
  exit /b 1
)

echo.
echo   Done! Your site will be updated in about 1 minute:
echo   https://wrywznb.github.io/xuhome/
echo.
pause
