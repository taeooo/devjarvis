@echo off
setlocal
cd /d %~dp0\..\..

if not exist .venv (
  py -m venv .venv
)

call .venv\Scripts\activate.bat
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python -m pip install -r requirements-tts.txt

echo.
echo MeloTTS local runtime installed.
echo Set DEVJARVIS_LOCAL_AGENT_TTS_PROVIDER=melotts_kr before starting the Local Agent.
echo.
endlocal
