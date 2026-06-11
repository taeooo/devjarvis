# Local Agent Startup Foundation

## 문제 정의

DevJarvis Desktop의 화면 분석 기능은 Local Agent와 Ollama가 준비되어 있어야 동작한다. 기존 구조에서는 사용자가 매번 수동으로 Local Agent를 실행해야 했기 때문에, 앱은 정상이어도 화면 명령 실행 시 `Local Assistant is not running` 상태가 반복될 수 있었다.

## 왜 이 작업이 필요한지

화면 이미지와 OCR 원문을 NAS로 보내지 않는 보안 정책을 유지하려면 Local Agent가 안정적으로 실행되어야 한다. 사용자가 로컬 서비스를 켜지 못해 remote OCR/analysis fallback을 요구하게 되는 흐름은 장기적으로 보안 정책을 약화시킬 수 있다.

또한 Desktop UI는 provider/model/router 같은 내부 정보를 노출하지 않으면서도, 사용자가 현재 Assistant 준비 여부를 빠르게 이해할 수 있어야 한다.

## 어떤 방향으로 해결했는지

- Desktop Context Panel에 `Assistant` 상태 타일을 추가했다.
- 상태 값은 `Ready`, `Checking`, `Setup needed`처럼 사용자 친화적인 최소 표현만 사용한다.
- Local Agent 실행을 위한 Windows helper script를 추가했다.
  - `setup-local-agent.cmd`: Python 3.11 venv 생성 및 의존성 설치
  - `start-local-agent.cmd`: Local Agent를 `127.0.0.1:17997`로 실행
  - `register-local-agent-task.cmd`: 사용자 로그온 시 Local Agent 시작 작업 등록
  - `unregister-local-agent-task.cmd`: 자동 시작 작업 제거
  - `check-local-assistant.cmd`: Local Agent/OCR/LLM readiness 확인
- README에 Git Bash 기준 실행 방법과 Windows helper 사용 방법을 추가했다.

## 보안상 고려사항

- Startup helper는 Local Agent host를 `127.0.0.1`로 고정한다.
- Local Agent와 Ollama를 `0.0.0.0` 또는 LAN 주소로 열지 않는다.
- helper script에는 secret, token, password, key 값을 넣지 않는다.
- scheduled task는 사용자 로그온 기준 `LIMITED` 권한으로 등록한다.
- Desktop 화면에는 model/provider/router/internal status를 노출하지 않는다.
- Local Agent 미실행 시 remote OCR/analysis fallback을 추가하지 않는다.

## 현재 한계

- 이번 작업은 startup foundation이며, Tauri sidecar packaging까지 포함하지 않는다.
- scheduled task 등록은 Windows 개발/로컬 실행 편의용이다.
- Local Agent 프로세스 중복 실행 방지는 운영체제/포트 점유 상태에 의존한다.
- Ollama 설치와 모델 pull은 사용자가 별도로 수행해야 한다.

## 다음 확장 방향

- Tauri sidecar 또는 installer 단계에서 Local Agent 실행 파일을 포함하는 구조 검토
- Desktop에서 사용자가 직접 Local Agent 설정 안내를 열 수 있는 compact action UX 추가
- Local Agent process lock 또는 health 기반 중복 실행 방지 추가
- Windows service 방식과 user logon scheduled task 방식의 장단점 비교 문서화
- STT/wake-word 전 단계에서도 Local Agent readiness를 재사용
