# Project Deep Index Foundation

## 문제 정의

프로젝트 분석이 manifest 파일 수, 확장자 분포, 후보 파일 목록에 머물면 에러 화면 원인 분석에 필요한 전체 실행 흐름을 파악하기 어렵다. 실제 화면 진단은 Frontend, Tauri, Local Agent, Backend, 설정 파일, API 경로가 연결된 흐름을 함께 봐야 한다.

## 왜 이 작업이 필요한지

사용자가 에러 화면을 공유하고 원인을 물을 때 특정 파일 하나만 읽는 방식은 충분하지 않다. DevJarvis는 프로젝트 전체를 로컬에서 이해하는 인덱스를 만들고, 화면 OCR 결과와 연결해 관련 모듈과 파일 흐름을 추적해야 한다.

## 어떤 방향으로 해결했는지

프로젝트 분석 명령에서 safe source 전체를 로컬에서 스캔하고, 제외 정책을 통과한 파일 중 runtime boundary, entrypoint, API boundary, service, UI boundary, config 파일을 우선 읽어 Project Deep Index를 만든다. 인덱스는 파일 원문을 NAS나 Backend로 보내지 않고 Tauri 로컬 command가 생성한다. Local Agent에는 redaction 된 excerpt와 구조 정보만 전달한다.

## 보안상 고려사항

- `.env`, key, token, secret, password, 인증서, binary, build output, dependency folder는 제외한다.
- symlink와 프로젝트 루트 밖 경로는 읽지 않는다.
- 파일 내용은 line-level redaction 후 Local Agent로만 전달한다.
- 실제 OS absolute path와 rootPathAlias는 UI와 Local LLM context에 노출하지 않는다.
- AI Server/NAS/Backend로 파일 원문을 전송하는 fallback은 추가하지 않는다.

## 현재 한계

- 전체 파일을 무제한으로 읽지 않고 byte/file budget 안에서 우선순위 기반으로 읽는다.
- 정교한 dependency graph는 아직 AST 기반이 아니라 import/endpoint/symbol line 추출 기반이다.
- 대형 monorepo에서는 budget 밖 파일이 skipped 될 수 있다.

## 다음 확장 방향

- 언어별 AST parser 또는 tree-sitter 기반 symbol graph 추가
- Local vector index 또는 SQLite/pgvector local store 추가
- 에러 화면 OCR signal과 Project Deep Index를 연결하는 ranking 개선
- 파일 변경 감지 incremental indexing 추가
