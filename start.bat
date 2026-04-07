@echo off
chcp 65001 >nul 2>&1
title Earl - Desktop Duckling
color 0E
echo.
echo        ,_,
echo       (o,o)
echo       {`"'}
echo       -"-"-
echo.
echo    Adding love to your
echo      desktop, one waddle
echo        at a time.
echo.

:: Add cargo to PATH if not already there
set PATH=%USERPROFILE%\.cargo\bin;%PATH%

:: Run from the earl directory
cd /d "%~dp0"
cargo tauri dev

if %ERRORLEVEL% neq 0 (
    echo.
    echo Earl failed to start. Press any key to close.
    pause >nul
)
