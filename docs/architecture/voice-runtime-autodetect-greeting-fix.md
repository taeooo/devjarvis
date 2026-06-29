# Voice Runtime Auto-detection and Greeting Fix

## 문제 정의

이전 패치에서는 `헤이 자비스` 호출과 고품질 Local TTS provider를 추가했지만, 실제 실행 환경에서는 다음 문제가 남았다.

- Local Agent 실행 스크립트가 STT/TTS provider를 기본적으로 `placeholder`로 시작할 수 있어 음성 호출이 준비되지 않는다.
- CosyVoice2 provider는 모델, repo, reference WAV, reference transcript가 모두 준비되어야 하는데 이 중 하나라도 없으면 고품질 음성이 비활성화된다.
- 고품질 TTS 미설정 상태가 사용자에게 전체 Assistant 설정 문제처럼 보일 수 있다.
- `안녕` 같은 단순 인사도 일반 LLM 요청으로 넘어가 어색한 응답이 표시된다.
- wake 감지 중 실제 마이크 모니터가 동작 중인지 UI에서 판단하기 어렵다.

## 왜 필요한가

DevJarvis의 음성 UX는 설치 후 바로 이해 가능한 상태여야 한다. 특히 지인 테스트용 설치파일에서는 사용자가 환경변수를 직접 설정하지 않아도 가능한 범위에서 자동 감지되어야 하며, 고품질 TTS가 없어도 음성 호출과 기본 응답은 계속 동작해야 한다.

또한 자연스러운 assistant UX를 위해 `안녕`, `고마워` 같은 짧은 대화는 원격/NAS/LLM 경로로 보내지 않고 로컬에서 즉시 응답하는 편이 더 안정적이다.

## 해결 방향

- Local Agent Windows start script에서 STT 기본 provider를 `faster_whisper`로 설정한다.
- CosyVoice2 runtime 파일이 표준 경로에 모두 존재하면 Local TTS provider를 자동 설정한다.
- CosyVoice2 reference transcript는 `jarvis-male-reference.txt` 파일로 관리한다.
- 고품질 TTS 미설정은 전체 setup failure가 아니라 `기본 음성 fallback` 상태로 표시한다.
- `안녕`, `고마워` 같은 짧은 인사는 Desktop command router에서 로컬 응답으로 처리한다.
- wake monitor 상태 문구를 `헤이 자비스 대기 · 마이크 감지 중`처럼 실제 대기 상태가 보이게 변경한다.

## 보안 기준

- 음성 원문은 Local Agent loopback으로만 전달한다.
- 음성 원문은 NAS Backend, NAS FastAPI, 외부 STT/TTS API로 전송하지 않는다.
- TTS 텍스트도 Local Agent loopback으로만 전달한다.
- reference WAV는 사용 권리와 재배포 권한이 명확한 파일만 사용한다.
- provider/model/path는 사용자 UI에 노출하지 않는다.
