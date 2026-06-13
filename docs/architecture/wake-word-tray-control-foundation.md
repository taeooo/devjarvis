# Wake Word Tray Control Foundation

## 문제 정의
DevJarvis의 최종 음성 UX는 사용자가 버튼을 누르는 방식보다 `헤이 자비스` 호출형에 가깝습니다. 다만 호출어 감지는 마이크 입력을 로컬에서 계속 처리하는 상태이므로, 메인 화면에 과한 토글을 노출하지 않더라도 사용자가 마이크를 일시 중지하거나 상태를 확인할 수 있는 제어권은 필요합니다.

## 왜 이 작업이 필요한지
- 사용자는 일반적인 음성 비서처럼 호출어로 자연스럽게 DevJarvis를 깨우길 기대합니다.
- 메인 화면에 Wake word ON/OFF 토글을 두면 사용 흐름이 버튼 중심으로 돌아가고, Jarvis형 UX와 맞지 않습니다.
- 반대로 제어권이 전혀 없으면 프라이버시 관점에서 사용자가 불편함을 느낄 수 있습니다.

## 어떤 방향으로 해결하는지
- 메인 화면에는 Wake word ON/OFF 토글을 두지 않습니다.
- Voice 영역에는 마이크 사용 안내와 현재 상태만 표시합니다.
- 마이크 일시 중지/재개는 트레이 또는 설정 화면의 제어권으로 분리합니다.
- Local Agent에는 wake word endpoint foundation을 추가합니다.
  - `GET /internal/local-wake/health`
  - `POST /internal/local-wake/session/start`
  - `POST /internal/local-wake/session/stop`
- 현재 provider는 placeholder이며, 후속 작업에서 openWakeWord 등 로컬 provider를 붙일 수 있게 경계를 분리합니다.

## 보안 기준
- wake word raw audio는 저장하지 않습니다.
- wake word raw audio는 로그에 남기지 않습니다.
- wake word, STT, OCR, 프로젝트 파일 원문은 NAS/Backend/AI Server로 전송하지 않습니다.
- Local Agent는 loopback only 전제를 유지합니다.
- STT는 wake word 감지 후 짧은 session 또는 수동 fallback에서만 실행합니다.
- 트레이/설정에는 Mic pause/resume 제어권을 제공합니다.

## 현재 한계
- 이번 작업은 wake word engine 자체를 포함하지 않습니다.
- 실제 `헤이 자비스` 감지는 후속 provider 구현이 필요합니다.
- OS tray menu command와 Desktop 상태 동기화는 다음 단계에서 구현해야 합니다.

## 다음 확장 방향
- openWakeWord provider 연결
- tray menu `Pause microphone` / `Resume microphone` 구현
- wake word 감지 후 자동 STT session 시작
- 무음 감지 기반 자동 종료
- 사용자 PC 사양별 wake word 모델 선택
