@echo off
title ANAND School Management System
echo.
echo  ====================================
echo   ANAND School Management System
echo  ====================================
echo.
echo  Starting development server...
echo  Open your browser at: http://localhost:3000
echo.
set PATH=C:\Program Files\nodejs;%PATH%
cd /d "%~dp0"
"C:\Program Files\nodejs\npm.cmd" run dev
pause
