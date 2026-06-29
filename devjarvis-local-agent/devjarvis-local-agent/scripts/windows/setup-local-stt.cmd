@echo off
setlocal EnableExtensions

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..\..") do set "AGENT_DIR=%%~fI"

cd /d "%AGENT_DIR%" || exit /b 1

set "PYTHON_EXE=%AGENT_DIR%\.venv\Scripts\python.exe"
if not exist "%PYTHON_EXE%" (
  echo Local Agent virtual environment was not found.
  echo Run scripts\windows\setup-local-agent.cmd first.
  exit /b 1
)

"%PYTHON_EXE%" -m pip install -r requirements-stt.txt
if errorlevel 1 exit /b 1

echo Optional local STT runtime is ready.
echo Set DEVJARVIS_LOCAL_AGENT_STT_PROVIDER=faster_whisper before starting Local Agent.
