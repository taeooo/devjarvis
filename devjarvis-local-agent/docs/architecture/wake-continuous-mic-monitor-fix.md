# Wake Word Continuous Microphone Monitor Fix

## 문제 정의

수동 음성 입력은 동작하지만 앱을 켠 뒤 `헤이 자비스`라고 말해도 응답하지 않는 문제가 있었다. 이전 구현은 일정 간격으로 짧은 녹음을 새로 시작하고 종료한 뒤 STT를 호출하는 구조였다. 이 방식은 녹음 사이에 공백이 생기고, 짧은 호출어가 녹음 구간 경계에 걸리면 STT가 호출어를 놓칠 수 있다.

또한 wake 감지를 일반 명령 STT와 동일한 조건으로 처리하여 VAD가 짧은 호출어를 음성이 아닌 구간으로 제거할 수 있었다. 실패 원인이 사용자에게 보이지 않아 앱이 마이크를 듣고 있는지, STT가 준비됐는지 파악하기 어려웠다.

## 왜 이 작업이 필요한가

DevJarvis의 기본 UX는 버튼을 누르는 음성 입력보다 `헤이 자비스` 호출형에 가깝다. wake가 조용히 실패하면 사용자는 앱이 멈춘 것처럼 느끼며, 수동 음성 버튼만 동작하는 반쪽짜리 음성 UX가 된다.

보안 경계는 그대로 유지해야 한다. wake/STT audio는 사용자 PC의 Local Agent로만 전달되어야 하며 NAS, Backend, AI Server로 전송하면 안 된다.

## 해결 방향

- Desktop에서 마이크 스트림을 한 번 열고 유지하는 continuous wake monitor를 추가한다.
- `MediaRecorder` timeslice로 음성 조각을 받고 최근 몇 초를 sliding window로 묶어 Local Agent STT에 전달한다.
- 녹음 사이 공백을 줄여 짧은 `헤이 자비스` 발화가 구간 경계에 걸려 누락되는 문제를 완화한다.
- wake 목적의 STT 요청에는 `purpose=wake`를 전달한다.
- Local Agent는 wake STT에서 VAD를 끄고 호출어 중심 initial prompt를 사용한다.
- 호출어 오인식 변형을 command router와 Local Agent 후처리에서 보정한다.
- Local Agent/STT가 준비되어 있고 마이크가 허용된 경우에만 wake monitor를 시작한다.

## 보안 경계

- 마이크 audio는 `127.0.0.1` Local Agent로만 전달한다.
- wake audio 원문은 저장하지 않는다.
- wake audio 원문은 로그에 남기지 않는다.
- NAS Backend, NAS FastAPI, 외부 TTS/STT API로 전달하지 않는다.
- wake 감지 이후에만 명령 STT session으로 전환한다.

## 남은 한계

이번 수정은 전용 wake word 모델이 아니라 Local STT 기반 wake 감지를 더 안정화한 것이다. CPU 환경에서는 주기적 Whisper 호출 비용이 남아 있다. 장기적으로는 openWakeWord 같은 전용 wake detector provider를 별도로 붙이는 것이 더 효율적이다.
