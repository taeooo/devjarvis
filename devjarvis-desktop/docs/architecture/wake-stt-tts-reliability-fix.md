# Wake STT TTS Reliability Fix

## 문제 정의
- 사용자가 앱을 켠 뒤 `헤이 자비스`라고 말해도 실제 wake 동작이 시작되지 않았습니다.
- 수동 음성 입력은 가능했지만 `4 더하기 4 뭐야` 같은 짧은 산술 명령이 일반 대화로 처리되거나 인식 품질이 낮았습니다.
- 음성 응답이 WebView 기본 영어/비한국어 음성으로 선택될 수 있어 영어 듣기평가처럼 들렸습니다.
- 히스토리가 쌓이면 결과 카드 영역이 잘려 `Response ready` 같은 결과가 보기 어렵게 노출됐습니다.

## 왜 이 작업이 필요한지
- DevJarvis의 핵심 UX는 텍스트 입력보다 `헤이 자비스` 호출 후 음성으로 질문하고, 화면에는 결과 카드가 남는 방식입니다.
- 실제 wake loop가 없으면 사용자는 `호출 대기` 상태를 보고도 아무 반응을 얻지 못합니다.
- TTS voice 선택이 잘못되면 한국어 안내가 부자연스럽게 들리고 제품 완성도가 낮아집니다.
- 결과 히스토리가 잘리면 이전 응답을 확인하기 어렵습니다.

## 어떤 방향으로 해결했는지
- Desktop에서 Local STT 기반 wake listen loop를 추가했습니다.
  - 앱이 idle 상태이고 Local Agent/STT가 준비된 경우 짧은 로컬 오디오 chunk만 확인합니다.
  - `헤이 자비스`, `하이 자비스`, `자비스야` 등으로 wake phrase를 정규화합니다.
  - wake 감지 후 `네, 말씀하세요.` 음성 응답을 먼저 재생하고, 이어서 짧은 명령 녹음을 시작합니다.
- 수동 음성 입력과 wake 입력이 같은 명령 처리 경로를 사용하도록 통합했습니다.
- STT 결과 후처리를 추가했습니다.
  - 흔한 wake word 오인식 보정
  - `하이 자비스` → `헤이 자비스`
- 명령 라우터에 음성 산술 표현 처리를 추가했습니다.
  - `4 더하기 4`
  - `사 더하기 사`
  - 빼기/곱하기/나누기/몫/나머지 기반 확장
- 단순 산술 명령은 Local LLM 호출 전에 Desktop에서 즉시 계산 결과를 생성합니다.
- TTS는 Web Speech API를 사용하되 한국어 voice를 우선 선택합니다.
  - `ko-KR`, Korean, Windows 한국어 voice hint 우선
  - rate/pitch를 조정해 기본 영어 음성처럼 들리는 문제를 완화합니다.
  - 한국어 voice가 없으면 UI에 설치 안내를 표시합니다.
- 결과 히스토리 영역에 독립 스크롤과 카드 line clamp 보정을 적용했습니다.

## 보안 경계
- wake/STT audio는 Local Agent로만 전달합니다.
- wake/STT audio는 NAS, Backend, AI Server로 전송하지 않습니다.
- wake loop는 앱이 idle 상태일 때만 짧은 chunk를 확인합니다.
- 음성 원문은 로그에 남기지 않습니다.
- TTS는 WebView/OS의 로컬 SpeechSynthesis voice를 우선 사용합니다.

## 현재 한계
- 이번 wake loop는 별도 wake word 전용 모델이 아니라 Local STT provider를 이용한 working mode입니다.
- Local STT가 준비되지 않으면 `헤이 자비스` 호출도 동작하지 않습니다.
- 실제 Jarvis급 자연스러운 음성은 OS에 설치된 한국어 TTS voice 품질에 영향을 받습니다.
- 고품질 로컬 TTS 모델은 후속 provider로 분리해 추가해야 합니다.

## 다음 확장 방향
- 전용 wake word provider 추가
  - openWakeWord 또는 Vosk keyword spotting 계열
- 고품질 local TTS provider 추가
  - Piper/ONNX 계열 voice model
  - provider/model 설치 wizard
- wake loop CPU/GPU 사용량 표시
- 트레이에서 mic pause/resume 실제 command 연결
