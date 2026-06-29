@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..\..") do set "AGENT_DIR=%%~fI"

cd /d "%AGENT_DIR%" || exit /b 1

set "PYTHON_EXE=%AGENT_DIR%\.venv\Scripts\python.exe"
if not exist "%PYTHON_EXE%" (
  echo Local Agent virtual environment was not found.
  echo Run scripts\windows\setup-local-agent.cmd first.
  exit /b 1
)

if "%DEVJARVIS_RUNTIME_ROOT%"=="" set "DEVJARVIS_RUNTIME_ROOT=C:\devjarvis-runtime"
if "%DEVJARVIS_LOCAL_AGENT_PORT%"=="" set "DEVJARVIS_LOCAL_AGENT_PORT=17997"

set "DEVJARVIS_LOCAL_AGENT_HOST=127.0.0.1"
set "DEVJARVIS_LOCAL_AGENT_OLLAMA_BASE_URL=http://127.0.0.1:11434"

rem Voice input is a core desktop feature. Default to the local faster-whisper provider;
rem the health endpoint will still report setup-needed if the optional runtime is missing.
if "%DEVJARVIS_LOCAL_AGENT_STT_PROVIDER%"=="" set "DEVJARVIS_LOCAL_AGENT_STT_PROVIDER=faster_whisper"
if "%DEVJARVIS_LOCAL_AGENT_STT_MODEL%"=="" set "DEVJARVIS_LOCAL_AGENT_STT_MODEL=small"
if "%DEVJARVIS_LOCAL_AGENT_STT_DEVICE%"=="" set "DEVJARVIS_LOCAL_AGENT_STT_DEVICE=cpu"
if "%DEVJARVIS_LOCAL_AGENT_STT_COMPUTE_TYPE%"=="" set "DEVJARVIS_LOCAL_AGENT_STT_COMPUTE_TYPE=int8"
if "%DEVJARVIS_LOCAL_AGENT_STT_LANGUAGE%"=="" set "DEVJARVIS_LOCAL_AGENT_STT_LANGUAGE=ko"

set "COSY_ROOT=%DEVJARVIS_RUNTIME_ROOT%\tts\cosyvoice2"
set "COSY_REPO=%COSY_ROOT%\CosyVoice"
set "COSY_MODEL=%COSY_ROOT%\models\CosyVoice2-0.5B"
set "COSY_VOICE=%COSY_ROOT%\voices\jarvis-male-reference.wav"
set "COSY_PROMPT_TEXT_FILE=%COSY_ROOT%\voices\jarvis-male-reference.txt"

if "%DEVJARVIS_LOCAL_AGENT_TTS_PROVIDER%"=="" (
  if exist "%COSY_REPO%" if exist "%COSY_MODEL%" (
    rem CosyVoice2 runtime/model is installed. Start the provider even when the
    rem reference files are still missing so /internal/local-tts/health can
    rem report the exact missing setup item instead of a generic placeholder.
    set "DEVJARVIS_LOCAL_AGENT_TTS_PROVIDER=cosyvoice2_local"
    set "DEVJARVIS_LOCAL_AGENT_TTS_COSYVOICE_REPO_PATH=%COSY_REPO%"
    set "DEVJARVIS_LOCAL_AGENT_TTS_COSYVOICE_MODEL_DIR=%COSY_MODEL%"
    set "DEVJARVIS_LOCAL_AGENT_TTS_COSYVOICE_PROMPT_AUDIO_PATH=%COSY_VOICE%"
    if exist "%COSY_PROMPT_TEXT_FILE%" (
      set /p DEVJARVIS_LOCAL_AGENT_TTS_COSYVOICE_PROMPT_TEXT=<"%COSY_PROMPT_TEXT_FILE%"
    )
  ) else (
    set "DEVJARVIS_LOCAL_AGENT_TTS_PROVIDER=placeholder"
  )
)

if "%DEVJARVIS_LOCAL_AGENT_TTS_LEADING_SILENCE_MILLIS%"=="" set "DEVJARVIS_LOCAL_AGENT_TTS_LEADING_SILENCE_MILLIS=320"
if "%DEVJARVIS_LOCAL_AGENT_TTS_TIMEOUT_SECONDS%"=="" set "DEVJARVIS_LOCAL_AGENT_TTS_TIMEOUT_SECONDS=45"

"%PYTHON_EXE%" -m uvicorn app.main:app --host 127.0.0.1 --port %DEVJARVIS_LOCAL_AGENT_PORT%
