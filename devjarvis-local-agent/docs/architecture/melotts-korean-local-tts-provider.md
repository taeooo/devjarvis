# MeloTTS-Korean Local TTS Provider

## 문제 정의

Windows/WebView 기본 TTS는 한국어 음성 품질이 낮거나 영어식 억양으로 들릴 수 있다. DevJarvis가 음성 비서처럼 응답하려면 OS 기본 음성만 사용하지 않고, 사용자 PC에서 실행되는 고품질 로컬 TTS provider가 필요하다.

## 왜 이 작업이 필요한지

DevJarvis는 화면 이미지, OCR 원문, 음성 원문, 프로젝트 파일 원문을 NAS 또는 외부 API로 보내지 않는 로컬 우선 구조를 유지해야 한다. 클라우드 TTS는 음성 응답 품질은 좋을 수 있지만, 사용자의 명령/분석 요약 텍스트가 외부 서비스로 전송될 수 있고 배포 비용도 발생한다.

MeloTTS-Korean은 로컬 Python runtime에서 사용할 수 있는 한국어 TTS provider로, DevJarvis Local Agent의 loopback-only 경계 안에서 음성 파일을 생성할 수 있다.

## 해결 방향

- Local Agent에 `melotts_kr` provider를 추가한다.
- Desktop은 기존처럼 Local TTS endpoint를 우선 호출한다.
- Local TTS가 준비되지 않으면 OS 기본 TTS로 fallback한다.
- provider/model/path 등 내부 구현 정보는 사용자 UI에 노출하지 않는다.
- TTS 음성 앞부분이 잘리는 문제를 줄이기 위해 생성된 WAV 앞에 짧은 무음을 추가한다.
- WebView 오디오 재생은 `canplaythrough` 이후 짧은 preroll delay를 두고 시작한다.

## 런타임 경계

```text
Desktop
  -> 127.0.0.1 Local Agent
      -> MeloTTS-Korean runtime
      -> WAV bytes
  -> Desktop local audio playback
```

금지 경계:

```text
Desktop/Local Agent
  -> NAS Backend로 TTS 원문 전송 금지
  -> NAS FastAPI 서버로 TTS 원문 전송 금지
  -> 외부 TTS API 기본 사용 금지
```

## 로컬 설정

```bash
cd /c/projects/devjarvis/devjarvis-local-agent
source .venv/Scripts/activate
pip install -r requirements.txt
pip install -r requirements-tts.txt

export DEVJARVIS_LOCAL_AGENT_TTS_PROVIDER=melotts_kr
export DEVJARVIS_LOCAL_AGENT_TTS_MELOTTS_DEVICE=cpu
export DEVJARVIS_LOCAL_AGENT_TTS_MELOTTS_SPEED=0.92
export DEVJARVIS_LOCAL_AGENT_TTS_LEADING_SILENCE_MILLIS=220

uvicorn app.main:app --reload --host 127.0.0.1 --port 17997
```

GPU 사용 시:

```bash
export DEVJARVIS_LOCAL_AGENT_TTS_MELOTTS_DEVICE=cuda:0
```

## Windows setup script

```bat
cd /d C:\projects\devjarvis\devjarvis-local-agent
scripts\windows\setup-local-tts-melotts.cmd
```

## 확인

```bash
curl http://127.0.0.1:17997/internal/local-tts/health
```

Desktop에서 음성 명령을 실행하면 Local TTS가 준비된 경우 OS 기본 음성 대신 Local Agent가 생성한 WAV가 재생된다.

## 한계

MeloTTS-Korean은 한국어 로컬 TTS 품질 개선에는 적합하지만, 특정 영화 캐릭터와 같은 동일한 목소리를 목표로 하지 않는다. 남성형/저음형 음성까지 강하게 요구하려면, 라이선스 문제가 없는 별도 voice 모델 또는 직접 동의 받은 음성 데이터 기반의 별도 TTS 학습이 필요하다.
