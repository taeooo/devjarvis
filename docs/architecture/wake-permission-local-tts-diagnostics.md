# Wake Word Permission Diagnostics and Local TTS Provider

## 문제 정의

음성 호출 UX에서 아래 문제가 확인되었습니다.

- 앱 실행 후 `헤이 자비스`를 말해도 아무 반응이 없었습니다.
- 마이크 권한 창이 이미 허용된 상태에서는 다시 뜨지 않아, 사용자가 현재 권한/장치 상태를 확인하기 어려웠습니다.
- Wake loop가 STT 준비 상태가 아니라 전체 Local Assistant readiness에 묶여 있어, OCR/LLM 준비 상태에 따라 음성 호출이 조용히 멈출 수 있었습니다.
- WebView 기본 SpeechSynthesis 음성은 OS voice 품질에 의존하므로, 한국어 voice가 없거나 품질이 낮으면 영어 듣기평가처럼 들릴 수 있었습니다.

## 왜 이 작업이 필요한지

DevJarvis의 목표 UX는 사용자가 버튼을 계속 누르는 도구가 아니라, `헤이 자비스` 호출 후 짧은 명령을 전달하는 데스크톱 비서입니다. 이 흐름에서 실패가 조용히 발생하면 사용자는 마이크 권한 문제인지, STT 설정 문제인지, Local Agent 문제인지 구분할 수 없습니다.

또한 실제 배포형 앱에서는 WebView 기본 TTS만으로 자연스러운 Jarvis형 음성을 보장하기 어렵습니다. 자연스러운 음성은 별도 로컬 TTS 모델/provider가 필요하므로, Desktop이 Local Agent의 TTS provider를 우선 사용하고 실패 시 OS 기본 음성으로 fallback하는 구조가 필요합니다.

## 어떤 방향으로 해결했는지

### 마이크 권한 진단

- Desktop에 마이크 권한 상태 확인 유틸을 추가했습니다.
- `granted`, `prompt`, `denied`, `unsupported`, `unknown` 상태를 구분합니다.
- 이미 권한이 허용된 경우 새 권한 창이 뜨지 않는다는 점을 UI 메시지로 설명합니다.
- 권한 확인이 필요한 경우 Voice 영역에 `마이크 확인` 버튼을 표시합니다.

### Wake loop 조건 수정

- Wake loop가 전체 Assistant readiness에 묶이지 않도록 변경했습니다.
- 음성 호출은 Local Agent STT health와 마이크 권한을 기준으로 동작합니다.
- OCR/LLM이 준비되지 않아도 `헤이 자비스` 감지와 단순 산술 명령은 동작할 수 있게 분리했습니다.
- STT가 준비되지 않았을 때는 `음성 호출 준비 필요` 상태를 표시합니다.

### Local TTS provider foundation

- Local Agent에 `/internal/local-tts/health`와 `/internal/local-tts/synthesize` endpoint를 추가했습니다.
- 기본 provider는 `placeholder`입니다.
- `piper_cli` provider를 설정하면 Local Agent가 로컬 Piper CLI와 모델 파일로 WAV 음성을 생성합니다.
- Desktop은 Local TTS가 사용 가능하면 해당 음성을 우선 재생하고, 실패하면 OS 기본 SpeechSynthesis로 fallback합니다.
- TTS text는 Local Agent loopback으로만 전달합니다.

## 보안 고려사항

- 마이크 음성은 Local Agent로만 전달합니다.
- wake/STT/TTS 관련 데이터는 NAS, Backend, AI Server로 전송하지 않습니다.
- Local TTS는 `127.0.0.1` Local Agent endpoint를 통해서만 호출됩니다.
- TTS provider/model 경로는 사용자 UI에 노출하지 않습니다.
- OS absolute path는 Desktop UI에 표시하지 않습니다.

## 현재 한계

- `헤이 자비스` wake 감지는 아직 전용 keyword spotting model이 아니라 STT 기반 chunk 감지입니다.
- STT 기반 wake loop는 CPU 환경에서 전용 wake model보다 느릴 수 있습니다.
- 자연스러운 음성 품질은 설치된 Local TTS 모델 품질에 의존합니다.
- `piper_cli` provider는 Piper 실행 파일과 voice model을 사용자가 별도로 준비해야 합니다.

## 다음 확장 방향

- openWakeWord 계열 전용 wake word provider 추가
- Piper 외 ONNX/Torch 기반 Korean TTS provider 추가
- 트레이 메뉴에서 마이크 일시 중지/재개 실제 구현
- Voice diagnostic 상세 패널 추가
