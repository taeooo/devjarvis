# Local-first Project Analysis Flow

## 문제 정의

프로젝트 디렉터리를 등록한 뒤 프로젝트 분석 명령을 실행할 때 Backend project registration이 실패하면 Desktop의 local project analysis도 같이 중단될 수 있었다. 특히 같은 프로젝트명이 이미 Backend에 등록되어 있으면 manifest refresh 단계에서 command result가 failed로 종료되어, 실제 프로젝트 구조 분석까지 진행되지 않았다.

## 왜 이 작업이 필요한지

DevJarvis의 핵심 진단 기능은 사용자 PC의 Desktop, Local Agent, project manifest scanner를 중심으로 동작해야 한다. Backend는 저장, 동기화, 히스토리 관리 역할로 분리되어야 하며, Backend 등록 실패가 local-only 분석을 막으면 보안 경계와 로컬 MVP 방향이 흐려진다.

## 어떤 방향으로 해결했는지

- Desktop project analysis는 먼저 Tauri project manifest scanner로 local manifest를 생성한다.
- Local LLM 분석에는 파일 원문이 아니라 manifest summary와 relative path sample만 전달한다.
- Backend manifest sync는 best-effort로 분리했다.
- Backend sync 실패는 command failure가 아니라 metadata warning으로만 남긴다.
- Backend project create는 같은 rootPathAlias가 이미 등록되어 있으면 기존 active project를 반환하는 idempotent flow로 바꿨다.
- 같은 프로젝트명인데 rootPathAlias가 다르면 `PROJECT_NAME_CONFLICT` 코드로 거절한다.

## 보안상 고려사항

- 실제 OS absolute path는 Backend payload와 UI에 보내지 않는다.
- rootPathAlias는 UI에 표시하지 않는다.
- Local LLM에는 파일 원문을 보내지 않는다.
- Backend가 내려가 있어도 화면 이미지, OCR 원문, 음성 원문을 remote fallback으로 보내지 않는다.
- manifest sync 실패 메시지는 command detail에 전체 payload나 absolute path를 포함하지 않는다.

## 현재 한계

- Backend schema는 아직 project name unique 제약을 유지한다.
- 같은 이름의 서로 다른 프로젝트를 동시에 등록하려면 향후 이름 정책 또는 rootPathAlias 기반 unique 정책을 다시 설계해야 한다.
- Backend sync 실패는 현재 경고 수준으로만 유지되며 별도 retry queue는 없다.

## 다음 확장 방향

- project identity를 display name이 아니라 stable project fingerprint 중심으로 재설계한다.
- Backend manifest sync retry queue를 Desktop-local 상태로 둔다.
- 프로젝트별 작업 히스토리 저장 시점과 local-only 분석 시점을 분리한다.
