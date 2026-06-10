# Local Assistant Readiness UX

## 문제 정의

DevJarvis Desktop의 화면 명령은 사용자가 선택한 화면/창을 캡처한 뒤 Local Agent OCR과 Local LLM 분석을 호출한다. Local Agent, Local OCR, Ollama 중 하나라도 준비되지 않으면 화면 캡처 이후 단계에서 실패할 수 있다.

이 상태를 단순 네트워크 오류로 보여주면 사용자는 무엇을 켜야 하는지 알기 어렵고, 이미 화면 캡처가 끝난 뒤에 실패하기 때문에 보안상으로도 불필요한 capture step이 먼저 실행된다.

## 왜 이 작업이 필요한지

화면 이미지와 OCR text는 민감정보를 포함할 수 있다. DevJarvis의 기본 보안 경계는 사용자 PC 내부이므로, Local Assistant가 준비되지 않은 상태에서는 화면 명령을 안전하게 중단해야 한다.

또한 Desktop UI는 provider, model, intent, OCR provider, analysis provider, internal status 같은 개발자용 정보를 노출하지 않는 방향이어야 한다. 따라서 readiness 실패 메시지도 사용자가 이해할 수 있는 수준으로만 안내해야 한다.

## 어떤 방향으로 해결했는지

Desktop에서 화면 캡처 전에 Local Assistant readiness를 먼저 확인하도록 정리했다.

```text
Desktop
→ /health
→ /internal/local-ocr/health
→ /internal/local-llm/health
→ 준비 완료일 때만 화면 선택/캡처 진행
```

준비되지 않은 경우에는 아래처럼 사용자 친화적인 메시지로 중단한다.

- Local Agent 미실행: Local Agent를 시작하라고 안내
- Local OCR 미준비: Local OCR 설정을 확인하라고 안내
- Local LLM 미준비: Ollama와 로컬 모델 설치를 확인하라고 안내

Desktop 내부 state에는 상세 정보를 저장할 수 있지만, 사용자 화면 메시지에는 provider/model/router 상세값을 표시하지 않는다.

## 보안상 고려사항

- Local Assistant 준비 전에는 화면 캡처를 시작하지 않는다.
- Local OCR 실패 또는 Local LLM 미준비 시 remote OCR/analysis로 자동 fallback하지 않는다.
- Desktop 사용자 메시지에는 provider, model, intent, OCR provider, analysis provider, internal status, absolute path, rootPathAlias를 표시하지 않는다.
- Local Agent와 Ollama는 `127.0.0.1` 기준으로만 사용한다.
- `.env.example`에는 secret을 넣지 않고 로컬 기본값만 둔다.

## 현재 한계

- Desktop이 Local Agent 프로세스를 직접 자동 시작하지는 않는다.
- Ollama 설치 여부와 모델 pull 여부는 health 결과를 통해 간접적으로만 판단한다.
- Local Agent를 Windows 시작 프로그램/서비스로 등록하는 구조는 아직 설계 단계다.
- OCR은 여전히 텍스트 추출 중심이며, 화면 layout/vision 분석은 별도 확장이 필요하다.

## 다음 확장 방향

- Local Agent 자동 시작 설계
- Windows installer에서 Local Agent/Ollama 준비 상태 점검
- Local Agent tray/background process 관리
- Local OCR 결과와 Project Context/RAG 결합
- STT foundation과 wake word 전 단계 권한 흐름 정리
