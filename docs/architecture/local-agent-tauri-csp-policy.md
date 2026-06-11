# Local Agent Tauri CSP Policy

## 문제 정의

DevJarvis Desktop은 Tauri WebView 안에서 실행되며 Local Agent의 loopback API를 호출한다. Local Agent와 Ollama가 정상 실행 중이어도 Tauri Content Security Policy(CSP)의 `connect-src`가 `127.0.0.1:17997`를 허용하지 않으면 WebView fetch가 차단된다.

## 왜 이 작업이 필요한지

터미널 `curl` 호출은 CSP의 영향을 받지 않기 때문에 성공할 수 있다. 그러나 Desktop WebView fetch는 CSP를 적용받는다. 따라서 Local Agent가 정상 실행 중임에도 앱에서는 `Local Assistant is not running`처럼 잘못된 실패로 보일 수 있다.

## 어떤 방향으로 해결했는지

Tauri `tauri.conf.json`의 `connect-src`에 Local Agent loopback endpoint를 명시적으로 추가했다.

- `http://localhost:17997`
- `http://127.0.0.1:17997`

Tauri 내부 IPC 호출이 개발 도구에서 CSP 오류로 보이지 않도록 아래도 허용했다.

- `http://ipc.localhost`
- `ipc:`

기존 Backend local endpoint는 유지했다.

- `http://localhost:8080`
- `http://127.0.0.1:8080`

## 보안상 고려사항

- `connect-src`에 wildcard `*`를 사용하지 않는다.
- LAN IP 또는 `0.0.0.0` endpoint를 허용하지 않는다.
- Local Agent는 계속 loopback `127.0.0.1:17997` 기준으로만 사용한다.
- Local Agent 연결 실패 시 remote OCR 또는 remote analysis fallback을 추가하지 않는다.
- Desktop UI에는 CSP, origin, provider, model 같은 내부 정보를 노출하지 않는다.

## 현재 한계

현재 실패 메시지는 WebView 정책 차단과 Local Agent 미실행을 구분하지 못할 수 있다. 이후 UX에서 연결 실패 원인을 사용자 친화적으로 구분할 필요가 있다.

## 다음 확장 방향

- Desktop DevTools에서 확인 가능한 smoke check 안내 추가
- Local Assistant 연결 실패 메시지 개선
- 앱 내부 Guide 모달에서 Local Assistant 준비 방법 안내
