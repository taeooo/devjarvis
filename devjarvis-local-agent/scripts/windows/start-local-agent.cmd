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

if "%DEVJARVIS_LOCAL_AGENT_PORT%"=="" set "DEVJARVIS_LOCAL_AGENT_PORT=17997"

set "DEVJARVIS_LOCAL_AGENT_HOST=127.0.0.1"
set "DEVJARVIS_OLLAMA_BASE_URL=http://127.0.0.1:11434"

"%PYTHON_EXE%" -m uvicorn app.main:app --host 127.0.0.1 --port %DEVJARVIS_LOCAL_AGENT_PORT%
