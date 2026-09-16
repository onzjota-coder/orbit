@echo off
cd /d c:\orbit
npm install docx > npm-out.txt 2>&1
echo %errorlevel% > npm-exit.txt