# Command Context State Isolation

## 문제 정의

Screen/OCR/math 흐름 이후 project-only 명령을 실행할 때 이전 screen 상태와 result card가 현재 명령의 context처럼 보일 수 있다.

## 왜 이 작업이 필요한지

DevJarvis는 screen image/OCR text, project manifest, text command를 서로 다른 local context로 다뤄야 한다. 이전 screen context가 project command와 섞이면 사용자가 의도하지 않은 화면 정보가 분석에 포함된 것처럼 오해할 수 있고, 보안 경계도 흐려진다.

## 어떤 방향으로 해결했는지

- project-only/text-only 명령 시작 시 stale screen state를 초기화한다.
- Result panel은 Current와 History를 분리한다.
- screen state의 captured 표시는 current command 상태가 아니라 last captured 상태로 표현한다.
- project analysis는 screen capture/OCR pipeline을 호출하지 않는다.

## 보안상 고려사항

- screen 명령이 아닌 경우 화면 캡처/OCR을 실행하지 않는다.
- Local OCR/Local LLM 실패 시 remote fallback을 추가하지 않는다.
- project context에는 actual OS absolute path를 넣지 않는다.

## 현재 한계

- command router에는 기존 natural-language hint가 남아 있다.
- 향후에는 intent classifier를 source-level keyword list가 아니라 local model 또는 externalized policy로 분리해야 한다.

## 다음 확장 방향

- command context audit log를 local-only metadata 형태로 추가한다.
- routing policy를 UI-selectable mode 또는 local classifier로 분리한다.
