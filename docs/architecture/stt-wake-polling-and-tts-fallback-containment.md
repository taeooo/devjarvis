# STT wake polling and TTS fallback containment

## 문제 정의

`헤이 자비스` 호출 감지를 STT polling으로 구현하면 Local Agent의 `/internal/local-stt/transcribe` 호출이 지속적으로 발생한다. 이 방식은 전용 wake word detector가 아니라 음성 인식 모델을 반복 호출하는 구조라서 CPU 사용량이 높고, 수동 음성 입력과 마이크 사용 타이밍이 충돌할 수 있다.

또한 Local TTS 합성이 실패할 때 Desktop이 OS 기본 TTS로 자동 fallback하면 사용자는 설정한 reference voice가 적용된 것으로 오해할 수 있다. Windows 기본 음성이 여성 음성인 환경에서는 DevJarvis가 의도하지 않은 목소리로 응답한다.

## 왜 이 작업이 필요한가

음성 기능은 사용자가 앱 품질을 가장 직접적으로 체감하는 부분이다. 자동 wake polling이 불안정하면 수동 STT까지 실패하는 것처럼 보이고, TTS fallback이 조용히 발생하면 모델 설정 문제를 찾기 어렵다. 특히 `speech_not_detected` 같은 내부 warning code가 그대로 음성 출력되면 제품 UX가 깨진다.

## 해결 방향

- STT 기반 wake polling은 기본 비활성화한다.
- 전용 wake word detector가 붙기 전까지 `헤이 자비스`는 실험 플래그로만 활성화한다.
- 수동 음성 입력은 wake polling과 분리해 안정성을 우선한다.
- `speech_not_detected` 같은 내부 warning code는 사용자 음성으로 읽지 않는다.
- Local TTS가 설정되어 있는데 합성에 실패하면 OS 기본 TTS로 조용히 fallback하지 않는다.
- 고품질 Local TTS 문제는 UI warning과 Local Agent health/synthesize 응답으로 드러낸다.

## 정책

기본값에서는 `VITE_DEVJARVIS_ENABLE_STT_WAKE_LOOP=true`를 설정하지 않는 한 STT polling wake loop를 실행하지 않는다. 이 플래그는 전용 wake detector 도입 전까지 로컬 실험 용도로만 사용한다.

브라우저/Windows 기본 TTS fallback도 기본 비활성화한다. 강제로 사용하려면 `VITE_DEVJARVIS_ALLOW_BROWSER_TTS_FALLBACK=true`를 명시해야 한다.
