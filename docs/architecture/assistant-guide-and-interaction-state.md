# Assistant Guide and Interaction State UX

## 문제 정의

DevJarvis Desktop은 화면 분석, 텍스트 분석, 프로젝트 분석 흐름을 자연어 명령으로 시작하는 구조다. 그러나 앱 안에는 사용자가 어떤 문장으로 명령을 시작해야 하는지, 화면 분석 시 왜 Windows 공유 선택창이 뜨는지, 음성 명령이 현재 가능한지에 대한 안내가 부족했다.

특히 이전 UI는 실제 STT가 구현되지 않았는데도 `Listening`, `Transcribing`, `Mic Available` 같은 표현을 보여주어 사용자가 헤드셋으로 말하면 앱이 인식해야 한다고 오해할 수 있었다.

## 왜 이 작업이 필요한지

현재 단계의 DevJarvis는 음성 기반 Jarvis UX를 목표로 하지만, 실제 구현은 아직 텍스트 명령과 Local Agent 기반 화면/프로젝트 분석이 중심이다. 구현되지 않은 음성 상태를 활성 상태처럼 보여주면 기능 실패처럼 보이고, 테스트 과정에서도 실제 문제와 UX 오해를 구분하기 어렵다.

또한 설정 아이콘은 아직 실질적인 설정 기능이 없으므로, 사용자가 가장 먼저 필요한 `사용법` 진입점으로 전환하는 편이 현재 MVP 단계에 더 적합하다.

## 어떤 방향으로 해결했는지

- 상단 톱니바퀴 아이콘을 `?` Guide 버튼으로 변경했다.
- Guide modal을 추가해 화면 분석, 텍스트/에러 분석, 프로젝트 분석 예시를 앱 안에서 확인할 수 있게 했다.
- 실제 STT가 구현되기 전까지 중앙 AI Core에서 `Listening`을 표시하지 않도록 정리했다.
- Voice 패널은 `Coming soon`으로 표시하고, 현재는 채팅 입력 중심이라는 안내를 추가했다.
- System status는 음성 상태가 아니라 Local Assistant readiness와 command processing 상태를 기준으로 표시한다.
- 입력창 placeholder를 실제 사용 가능한 명령 예시 중심으로 변경했다.

## 보안상 고려사항

- Guide에는 provider, model, intent, OCR provider, analysis provider 같은 내부 구현 정보를 표시하지 않는다.
- 화면 분석 안내는 사용자가 직접 창/화면을 선택해야 한다는 원칙을 설명한다.
- 전체 모니터 자동 캡처를 권장하지 않고, 선택한 화면/창만 처리한다는 정책을 유지한다.
- 음성 명령이 아직 구현되지 않았음을 명확히 표시해 마이크가 계속 수집 중이라는 오해를 줄인다.

## 현재 한계

- 실제 STT, wake word, TTS는 아직 구현되지 않았다.
- Guide modal은 정적 안내이며, 현재 runtime 상태에 따른 상세 troubleshooting까지 제공하지는 않는다.
- 마이크 장치 감지는 내부 상태 확인 수준이며, 음성 입력 파이프라인과 연결되어 있지 않다.

## 다음 확장 방향

- Assistant 상태를 `Waiting for screen selection`, `Reading screen`, `Thinking`, `Done`, `Failed`처럼 pipeline stage별로 더 세분화한다.
- Local Assistant readiness 실패 시 Guide에서 실행 명령어를 복사할 수 있게 한다.
- STT foundation 추가 시 Voice 패널을 `Push to talk`, `Listening`, `Transcribing` 상태로 실제 기능과 연결한다.
- 수동 통합 테스트 체크리스트와 smoke test script를 추가해 기능별 회귀를 빠르게 확인한다.
