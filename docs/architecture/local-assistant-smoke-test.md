# Local Assistant Smoke Test

## 문제 정의

Local Agent, OCR, Local LLM/Ollama가 각각 켜져 있어도 Desktop에서 명령을 실행하기 전까지 어떤 단계가 깨졌는지 빠르게 확인하기 어려웠다. 수동 `curl` 명령만으로는 deterministic math route까지 한 번에 확인하기 어렵다.

## 왜 이 작업이 필요한지

DevJarvis는 화면 이미지와 OCR 원문을 외부로 보내지 않는 local-first 구조이므로, 로컬 loopback endpoint가 정상인지 먼저 확인해야 한다. smoke test가 있으면 Desktop UI 문제와 Local Agent 준비 문제를 분리해서 볼 수 있고, 이후 Tauri/CSP 문제를 진단할 때도 기준점이 생긴다.

## 어떤 방향으로 해결했는지

- 표준 라이브러리만 사용하는 `devjarvis-local-agent/scripts/smoke_local_agent.py`를 추가했다.
- `/health`, `/internal/local-ocr/health`, `/internal/local-llm/health`를 순서대로 확인한다.
- `/internal/local-llm/analyze`에 간단한 `screen_math_solver` 요청을 보내 deterministic math route까지 확인한다.
- `--base-url`은 `localhost` 또는 `127.0.0.1`만 허용한다.

## 보안상 고려사항

- smoke script는 loopback base URL만 허용한다.
- 화면 이미지, OCR 원문, 파일 원문, secret 값을 전송하지 않는다.
- deterministic math smoke payload만 사용한다.
- LAN IP 또는 `0.0.0.0` 대상 호출을 허용하지 않는다.

## 현재 한계

- 실제 화면 캡처 picker/Tauri WebView CSP까지 검증하지는 않는다.
- OCR provider가 placeholder인 경우에도 health contract가 available이면 통과할 수 있다.
- Ollama 모델 품질은 검증하지 않고 endpoint readiness와 deterministic route만 확인한다.

## 다음 확장 방향

- Desktop build 이후 CSP connect-src 정적 검사 추가
- Tauri invoke 기반 screen picker smoke test 추가
- Local Agent startup script와 smoke test 연동
