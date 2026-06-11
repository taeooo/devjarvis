# Push-to-talk STT Foundation

## 문제 정의

항상 듣는 wake word 방식은 초기 버전에서 권한, 오탐, 민감 음성 수집 위험이 크다.

## 왜 이 작업이 필요한지

DevJarvis의 음성 입력은 로컬 PC에서만 처리되어야 하며, 사용자가 명시적으로 버튼을 누른 경우에만 마이크를 사용해야 한다. STT 모델이 붙기 전에도 UI state와 Local Agent API contract를 먼저 안정화할 필요가 있다.

## 어떤 방향으로 해결했는지

- Desktop Voice panel에 push-to-talk button과 voice state를 추가했다.
- voice state는 idle, recording, processing, text_ready, unavailable, error로 분리했다.
- Local Agent에 `/internal/local-stt/health`, `/internal/local-stt/transcribe` endpoint foundation을 추가했다.
- 현재 provider는 placeholder이며 remote fallback은 없다.

## 보안상 고려사항

- 음성 원문 remote fallback은 없다.
- 항상 듣는 wake word는 구현하지 않는다.
- STT endpoint는 Local Agent loopback middleware 안에서만 동작한다.
- health response는 provider/model 내부 정보를 노출하지 않는다.
- transcribe response는 placeholder 상태에서 음성 원문이나 preview를 반환하지 않는다.

## 현재 한계

- 실제 audio recording과 STT model inference는 아직 연결하지 않았다.
- Desktop은 endpoint contract만 확인하고 실제 microphone stream을 생성하지 않는다.

## 다음 확장 방향

- faster-whisper, Vosk, sherpa-onnx 중 하나를 local provider로 붙인다.
- MediaRecorder 기반 push-to-talk capture를 추가한다.
- 민감정보 redaction 후 text command pipeline으로 연결한다.
