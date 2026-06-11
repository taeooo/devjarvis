# Local Agent Tauri Origin Bridge

## 문제 정의

Local Agent와 Ollama가 정상 실행 중이고 터미널 `curl` health check가 성공해도, DevJarvis Desktop WebView에서는 Local Agent readiness가 실패할 수 있다.

원인은 Desktop이 Tauri WebView origin에서 Local Agent를 호출할 때 브라우저 CORS 정책이 적용되는데, Local Agent의 CORS 허용 origin이 Vite 개발 서버 origin 위주로만 구성되어 있었기 때문이다.

## 왜 이 작업이 필요한지

사용자는 Local Agent가 켜져 있는데도 앱에서는 `Local Assistant is not running`으로 보게 된다. 이 상태는 실제 서비스 미실행 문제가 아니라 Desktop WebView와 Local Agent 사이의 local-only origin 계약 문제다.

DevJarvis는 화면 이미지, OCR 원문, LLM 입력을 외부 서버로 자동 전송하지 않는 구조이므로 Desktop과 Local Agent의 로컬 연결은 안정적으로 동작해야 한다.

## 어떤 방향으로 해결했는지

Local Agent CORS allowlist에 Tauri Desktop에서 사용할 수 있는 local app origin을 명시적으로 추가했다.

- `http://tauri.localhost`
- `https://tauri.localhost`
- `tauri://localhost`

기존 Vite/Tauri dev server origin도 유지했다.

- `http://localhost:1420`
- `http://127.0.0.1:1420`
- `http://localhost:5173`
- `http://127.0.0.1:5173`

## 보안상 고려사항

- wildcard CORS는 사용하지 않는다.
- LAN IP origin은 추가하지 않는다.
- Local Agent bind host는 `127.0.0.1` 기준을 유지한다.
- loopback-only middleware는 유지한다.
- Desktop이 준비 상태 확인에 실패해도 remote OCR/analysis fallback은 수행하지 않는다.

## 현재 한계

Tauri/WebView runtime이 실제로 보내는 origin은 개발/빌드 방식에 따라 달라질 수 있다. 향후 패키징 단계에서 실제 production build origin을 한 번 더 확인해야 한다.

## 다음 확장 방향

- Desktop 개발자 진단 모드에서 Local Agent 연결 실패 원인을 `network`, `cors`, `timeout`, `service unavailable` 정도로만 분류한다.
- 사용자 화면에는 내부 origin, provider, model, router 정보는 노출하지 않는다.
- production installer 단계에서 Local Agent readiness smoke test를 추가한다.
