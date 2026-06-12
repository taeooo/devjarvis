# Project File Approval Analysis

## 문제 정의

Manifest metadata만으로는 프로젝트의 실제 구조, 의존성 연결, 실행 흐름, 문제 원인을 충분히 분석할 수 없다. 반대로 프로젝트 전체 파일 원문을 자동으로 읽거나 NAS/AI Server로 전송하면 DevJarvis의 local-first 보안 원칙과 맞지 않는다.

## 왜 이 작업이 필요한지

DevJarvis는 Desktop Assistant이므로 사용자가 선택한 프로젝트를 실질적으로 도와야 한다. 파일 수와 확장자 분포만 보여주는 수준은 프로젝트 분석으로 보기 어렵다. 다만 보안상 파일 원문 접근은 명시적 승인 뒤 선택 파일에 한정해야 한다.

## 어떤 방향으로 해결했는지

- 1차 분석은 manifest metadata로 후보 파일을 산출한다.
- 상세 화면에서 사용자가 후보 파일을 직접 선택한다.
- 선택된 relative path만 Tauri command로 전달한다.
- Tauri는 선택 프로젝트 루트 내부 파일인지 검증하고, 정책상 제외 파일은 읽지 않는다.
- 읽은 파일은 byte budget 안에서 redaction 처리 후 Local Agent LLM으로 전달한다.
- Result detail에는 승인된 파일 목록과 분석 결과를 분리해 표시한다.

## 보안상 고려사항

- 실제 OS absolute path는 UI와 Local Agent context에 노출하지 않는다.
- rootPathAlias는 분석 context에 포함하지 않는다.
- 선택되지 않은 파일 원문은 읽지 않는다.
- 민감 파일 패턴, 바이너리, 대용량 파일, symlink는 읽기 대상에서 제외한다.
- 민감 패턴이 포함된 line은 Local Agent 전송 전에 redaction한다.
- NAS/Backend/AI Server fallback은 추가하지 않는다.

## 현재 한계

- 후보 파일 선정은 manifest metadata와 구조적 filename/path 신호 기반이다.
- 함수/클래스 단위 symbol index는 아직 없다.
- 사용자가 선택한 파일만 분석하므로 대규모 call graph 분석은 아직 제한적이다.
- Redaction은 line-level conservative policy이며 semantic secret detector는 아직 없다.

## 다음 확장 방향

- symbol index 생성
- dependency graph 추출
- 선택 파일 미리보기 없이 승인만 받는 compact UX
- per-language parser 기반 후보 추천
- local vector index와 pgvector/SQLite 기반 project memory 분리
