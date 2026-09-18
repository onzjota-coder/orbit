@echo off
cd /d "%~dp0"
npx tsc --noEmit > tsc-out.txt 2>&1
echo %errorlevel% > tsc-exit.txt
npx next build > build-out.txt 2>&1
echo %errorlevel% > build-exit.txt
