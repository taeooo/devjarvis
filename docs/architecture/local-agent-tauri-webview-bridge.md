# Local Agent Tauri WebView Bridge

## 문제 정의

Local Agent와 Ollama가 정상 실행 중이고 터미널 `curl` 요청도 성공하는데, DevJarvis Desktop에서는 `Local Assistant is not running`으로 표시될 수 있다.

이 경우 실제 Local Agent 프로세스 문제가 아니라 Tauri WebView의 브라우저 보안 경계에서 Local Agent 호출이 차단되는 문제가 원인일 수 있다. 확인된 위험 요소는 두 가지다.

- Local Agent CORS allowlist에 Tauri origin이 없을 수 있음
- Tauri Content Security Policy의 `connect-src`에 `127.0.0.1:17997`가 없을 수 있음

## 왜 이 작업이 필요한지

DevJarvis Desktop은 화면 이미지, OCR 결과, 텍스트 명령을 로컬 우선으로 처리하기 위해 Local Agent와 안정적으로 통신해야 한다.

터미널에서 `curl`이 성공하더라도 Tauri WebView는 브라우저 보안 정책을 적용하므로 CORS 또는 CSP가 맞지 않으면 Desktop만 실패한다. 이 상태를 방치하면 사용자는 Local Agent가 실행 중인데도 앱이 계속 실패한다고 느끼게 된다.

## 어떤 방향으로 해결했는지

Local Agent와 Desktop 사이의 local-only 통신 경계를 명시적으로 정리했다.

- Local Agent CORS allowlist에 Tauri local origin을 추가했다.
- Tauri CSP `connect-src`에 Local Agent loopback endpoint를 추가했다.
- 기존 Backend local endpoint는 유지했다.
- wildcard CORS나 LAN IP는 추가하지 않았다.

허용한 Local Agent endpoint는 다음과 같다.

- `http://localhost:17997`
- `http://127.0.0.1:17997`

## 보안상 고려사항

- Local Agent는 계속 loopback 주소 기준으로만 사용한다.
- `0.0.0.0` 또는 LAN IP를 허용하지 않는다.
- CORS wildcard `*`를 사용하지 않는다.
- Tauri CSP도 필요한 local endpoint만 허용한다.
- Local Agent 연결 실패 시 remote OCR/analysis fallback은 추가하지 않는다.
- 사용자 화면에는 origin, provider, model, router 같은 내부 정보를 노출하지 않는다.

## 현재 한계

Tauri 개발 모드와 패키징 모드의 origin은 런타임/플랫폼 설정에 따라 달라질 수 있다. production installer 단계에서는 실제 WebView origin과 CSP 동작을 다시 확인해야 한다.

현재 Desktop 오류 문구는 Local Agent 미실행과 WebView 연결 차단을 충분히 구분하지 못한다.

## 다음 확장 방향

- Desktop 개발자 진단 모드에서 연결 실패 원인을 `service not running`, `blocked by browser policy`, `timeout` 정도로만 분류한다.
- 앱 내부에는 사용자를 위한 단순 안내만 표시하고, 내부 origin이나 포트 상세 정보는 숨긴다.
- Local Agent readiness smoke test를 installer/개발 실행 체크리스트에 추가한다.
