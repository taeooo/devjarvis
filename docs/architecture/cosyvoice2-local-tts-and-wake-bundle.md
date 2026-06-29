# CosyVoice2 Local TTS and Wake Stabilization Bundle

## 문제 정의

MeloTTS-Korean은 로컬/무료/배포 측면에서는 유리하지만, 짧은 assistant 응답에서 말투와 음색이 딱딱하게 들릴 수 있다. 또한 이전 wake 감지는 짧은 녹음을 반복하는 구조라 `헤이 자비스` 발화가 녹음 공백에 걸리거나 VAD에서 잘려 실제 호출이 누락될 수 있었다.

## 왜 이 작업이 필요한가

DevJarvis의 기본 UX는 버튼 클릭형 챗봇이 아니라, 사용자가 앱을 켜둔 상태에서 `헤이 자비스`로 호출하고 음성으로 응답받는 로컬-first assistant에 가깝다. 따라서 wake 감지는 조용히 실패하지 않아야 하고, TTS는 OS 기본 음성이나 딱딱한 단일 TTS 모델에 고정되면 안 된다.

## 해결 방향

- wake 감지는 continuous microphone monitor 구조를 사용한다.
- 최근 음성 구간을 sliding window로 묶어 Local Agent STT에 전달한다.
- wake 목적 STT는 `purpose=wake`로 구분해 짧은 호출어가 잘리지 않도록 한다.
- TTS provider에 `cosyvoice2_local`을 추가한다.
- CosyVoice2는 로컬 PC Local Agent loopback 안에서만 실행한다.
- CosyVoice2는 Apache-2.0 모델을 사용하되, 남성 음색은 사용 권리가 명확한 reference WAV를 별도로 지정한다.
- MeloTTS는 fallback으로 유지한다.
- provider/model/path는 사용자 UI에 노출하지 않는다.

## Runtime boundary

```text
Desktop
→ 127.0.0.1 Local Agent
→ Local STT / Local TTS / Local Wake
```

음성 원문, wake audio, TTS text는 NAS Backend, NAS FastAPI, 외부 TTS/STT API로 전송하지 않는다.

## CosyVoice2 설정

필수 설정:

```bash
export DEVJARVIS_LOCAL_AGENT_TTS_PROVIDER=cosyvoice2_local
export DEVJARVIS_LOCAL_AGENT_TTS_COSYVOICE_REPO_PATH='/c/devjarvis-runtime/tts/cosyvoice2/CosyVoice'
export DEVJARVIS_LOCAL_AGENT_TTS_COSYVOICE_MODEL_DIR='/c/devjarvis-runtime/tts/cosyvoice2/models/CosyVoice2-0.5B'
export DEVJARVIS_LOCAL_AGENT_TTS_COSYVOICE_PROMPT_AUDIO_PATH='/c/devjarvis-runtime/tts/cosyvoice2/voices/jarvis-male-reference.wav'
export DEVJARVIS_LOCAL_AGENT_TTS_COSYVOICE_PROMPT_TEXT='reference wav transcript'
```

`PROMPT_TEXT`는 reference WAV에 실제로 녹음된 문장과 일치해야 한다. 유명인, 영화 캐릭터, 성우 음성을 무단 reference로 사용하지 않는다.

## 배포 정책

지인 테스트용 설치파일에서는 CosyVoice2 runtime/model/reference voice를 설치파일에 포함할 수 있다. 단, 포함하는 reference voice는 사용 동의와 재배포 권한이 명확해야 한다. 공개 배포에서는 모델과 license 고지, checksum 검증, voice data 권리 확인 절차를 별도 관리한다.
