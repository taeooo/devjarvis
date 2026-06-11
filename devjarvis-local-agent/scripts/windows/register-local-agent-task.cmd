@echo off
setlocal EnableExtensions

set "SCRIPT_DIR=%~dp0"
set "TASK_NAME=DevJarvisLocalAgent"
set "START_SCRIPT=%SCRIPT_DIR%start-local-agent.cmd"

if not exist "%START_SCRIPT%" (
  echo start-local-agent.cmd was not found.
  exit /b 1
)

schtasks /Create /TN "%TASK_NAME%" /SC ONLOGON /TR "cmd.exe /c \"%START_SCRIPT%\"" /RL LIMITED /F
if errorlevel 1 exit /b 1

echo Registered %TASK_NAME% to start at user logon.
