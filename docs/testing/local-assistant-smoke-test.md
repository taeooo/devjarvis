# Local Assistant Smoke Test

## 문제 정의

Local Agent, OCR, LLM, STT, Ollama, Tauri CSP가 서로 맞지 않으면 Desktop에서만 실패하는 문제가 반복될 수 있다.

## 왜 이 작업이 필요한지

DevJarvis는 Desktop + Local Agent + Ollama 조합으로 동작한다. 기능이 늘어날수록 로컬 실행 전 빠르게 확인할 수 있는 smoke check가 필요하다.

## 어떤 방향으로 해결했는지

- Windows CMD smoke script를 추가했다.
- Local Agent `/health`, Local OCR, Local LLM, Local STT, Ollama tags를 확인한다.
- Desktop `index.html`과 Tauri config에 Local Agent CSP endpoint가 있는지 확인한다.

## 보안상 고려사항

- smoke script는 127.0.0.1 endpoint만 확인한다.
- secret, token, env 값을 출력하지 않는다.
- NAS endpoint나 remote fallback은 확인하지 않는다.

## 현재 한계

- 실제 OCR/LLM inference 품질까지 검증하지 않는다.
- STT는 placeholder health contract만 확인한다.

## 다음 확장 방향

- Desktop build artifact와 Tauri dev startup까지 선택적으로 점검한다.
- Local-only E2E screen diagnosis check를 별도 manual checklist로 분리한다.
