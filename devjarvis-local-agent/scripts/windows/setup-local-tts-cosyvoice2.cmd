@echo off
setlocal enabledelayedexpansion

set "RUNTIME_ROOT=%DEVJARVIS_RUNTIME_ROOT%"
if "%RUNTIME_ROOT%"=="" set "RUNTIME_ROOT=C:\devjarvis-runtime"

set "COSY_ROOT=%RUNTIME_ROOT%\tts\cosyvoice2"
set "REPO_DIR=%COSY_ROOT%\CosyVoice"
set "MODEL_DIR=%COSY_ROOT%\models\CosyVoice2-0.5B"
set "VOICE_DIR=%COSY_ROOT%\voices"

if not exist "%COSY_ROOT%" mkdir "%COSY_ROOT%"
if not exist "%MODEL_DIR%" mkdir "%MODEL_DIR%"
if not exist "%VOICE_DIR%" mkdir "%VOICE_DIR%"

if not exist "%REPO_DIR%\.git" (
  git clone --recursive https://github.com/FunAudioLLM/CosyVoice.git "%REPO_DIR%"
) else (
  cd /d "%REPO_DIR%"
  git pull
  git submodule update --init --recursive
)

cd /d "%REPO_DIR%"
python -m pip install -r requirements.txt
python -m pip install huggingface_hub
python -c "from huggingface_hub import snapshot_download; snapshot_download('FunAudioLLM/CosyVoice2-0.5B', local_dir=r'%MODEL_DIR%')"


if not exist "%VOICE_DIR%\README-reference-voice.txt" (
  > "%VOICE_DIR%\README-reference-voice.txt" echo DevJarvis 고품질 남성 음성을 사용하려면 사용 권리가 있는 reference WAV와 동일 문장 txt가 필요합니다.
  >> "%VOICE_DIR%\README-reference-voice.txt" echo.
  >> "%VOICE_DIR%\README-reference-voice.txt" echo 1. 남성 음성 샘플을 5~15초 정도 WAV로 저장하세요.
  >> "%VOICE_DIR%\README-reference-voice.txt" echo 2. 파일명은 jarvis-male-reference.wav 로 두세요.
  >> "%VOICE_DIR%\README-reference-voice.txt" echo 3. jarvis-male-reference.txt 에 WAV에서 실제로 말한 문장을 그대로 적으세요.
  >> "%VOICE_DIR%\README-reference-voice.txt" echo 4. 유명인, 영화/드라마 음성, 성우 음성을 무단 사용하면 배포 리스크가 있습니다.
)

if not exist "%VOICE_DIR%\jarvis-male-reference.txt" (
  > "%VOICE_DIR%\jarvis-male-reference.txt" echo 안녕하세요. 저는 데브자비스입니다. 필요한 작업을 말씀해 주세요.
)
echo.
echo CosyVoice2 runtime has been prepared.
echo Repo: %REPO_DIR%
echo Model: %MODEL_DIR%
echo.
echo Runtime/model download is complete, but high-quality voice is not ready until the reference WAV exists.
echo Put a legally usable male reference WAV file here:
echo %VOICE_DIR%\jarvis-male-reference.wav
echo.
echo Edit this transcript file so it exactly matches the sentence spoken in the WAV:
echo %VOICE_DIR%\jarvis-male-reference.txt
echo.
echo Then set these env vars before starting Local Agent, or use start-local-agent.cmd auto-detection:
echo set DEVJARVIS_LOCAL_AGENT_TTS_PROVIDER=cosyvoice2_local
echo set DEVJARVIS_LOCAL_AGENT_TTS_COSYVOICE_REPO_PATH=%REPO_DIR%
echo set DEVJARVIS_LOCAL_AGENT_TTS_COSYVOICE_MODEL_DIR=%MODEL_DIR%
echo set DEVJARVIS_LOCAL_AGENT_TTS_COSYVOICE_PROMPT_AUDIO_PATH=%VOICE_DIR%\jarvis-male-reference.wav
echo set DEVJARVIS_LOCAL_AGENT_TTS_COSYVOICE_PROMPT_TEXT=REFERENCE_WAV_TRANSCRIPT_HERE

endlocal
