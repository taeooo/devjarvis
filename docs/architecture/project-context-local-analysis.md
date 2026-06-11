# Project Context Local Analysis Foundation

## 문제 정의

DevJarvis Desktop의 프로젝트 명령은 프로젝트 폴더를 선택하고 파일 manifest를 Backend에 등록하는 foundation까지만 연결되어 있었다. 따라서 `이 프로젝트 왜 빌드가 안 될까`, `소스 구조를 보고 원인 후보를 알려줘` 같은 명령에서 실제 Local Agent 분석 결과가 사용자에게 제공되지 않고, 결과 패널에는 프로젝트 manifest가 갱신되었다는 상태만 남았다.

## 왜 이 작업이 필요한지

DevJarvis는 화면 분석뿐 아니라 로컬 프로젝트 맥락을 함께 보는 assistant 앱을 목표로 한다. 화면 캡처/OCR 흐름만 작동하고 프로젝트 명령이 manifest refresh 단계에서 멈추면, 사용자는 RAG나 project context 기능이 실제로 동작한다고 느끼기 어렵다. 또한 다음 단계에서 파일 단위 RAG, 로그 분석, 코드 진단으로 확장하려면 먼저 `파일 원문 없이 manifest metadata만으로 Local Agent에 안전하게 분석 요청하는 경계`가 필요하다.

## 어떤 방향으로 해결했는지

- Desktop 프로젝트 명령 실행 시 project manifest를 스캔하고 Backend에 등록한 뒤 Local Agent LLM 분석을 호출하도록 연결했다.
- Local Agent에 전달하는 context는 source file content가 아니라 manifest metadata 요약으로 제한했다.
- 전달 context에는 파일 수, 제외 파일 수, 언어 분포, 상위 디렉터리 분포, 제외 사유 분포, 대표 상대 경로만 포함한다.
- 화면+프로젝트가 함께 필요한 `auto` 명령에서는 화면 분석 요약을 project analysis context에 짧게 포함할 수 있게 했다.
- project-only 명령은 OCR readiness가 아니라 Local Agent app + Local LLM readiness만 확인한다.
- 결과 패널에는 Local Agent가 생성한 summary/action items를 표시한다.

## 보안상 고려사항

- 파일 원문은 Local Agent나 Backend로 전송하지 않는다.
- Local Agent project context에는 실제 OS absolute path를 포함하지 않는다.
- 대표 파일 목록은 상대 경로만 사용한다.
- sensitive/generated/binary/large/tooling 제외 파일은 대표 파일 목록에서 제외한다.
- rootPathAlias, provider, model, routing 정보는 사용자 화면에 노출하지 않는다.
- project analysis 실패 시 remote analysis fallback을 추가하지 않는다.

## 현재 한계

- 아직 파일 본문 chunk 기반 RAG는 아니다.
- manifest metadata 기반 분석이므로 구체적인 코드 라인 원인 분석은 제한된다.
- 상대 경로 자체에 민감한 이름이 포함된 경우까지 완전히 제거하지는 않는다. 다만 absolute path와 파일 원문은 전달하지 않는다.
- Local LLM이 준비되지 않으면 project analysis는 중단된다.

## 다음 확장 방향

- allowlist 기반 파일 chunk preview를 Local Agent 내부에서만 생성하는 RAG pipeline으로 확장한다.
- 민감 파일명 redaction 정책을 path segment 단위로 강화한다.
- 로그 파일 선택/붙여넣기 전용 local analysis flow를 분리한다.
- project manifest 변경 감지와 incremental indexing job을 연결한다.
