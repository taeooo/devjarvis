@echo off
setlocal EnableExtensions

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..\..") do set "AGENT_DIR=%%~fI"

cd /d "%AGENT_DIR%" || exit /b 1

where py >nul 2>nul
if errorlevel 1 (
  echo Python launcher py was not found. Install Python 3.11, then retry.
  exit /b 1
)

py -3.11 -m venv .venv
if errorlevel 1 exit /b 1

".venv\Scripts\python.exe" -m pip install --upgrade pip
if errorlevel 1 exit /b 1

".venv\Scripts\python.exe" -m pip install -r requirements.txt
if errorlevel 1 exit /b 1

echo DevJarvis Local Agent environment is ready.
