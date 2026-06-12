# Project Deep Index Korean Flow Result

## 문제 정의

프로젝트 분석 결과가 Local LLM 응답을 그대로 우선 표시하면서 영어 요약이 노출되고, 사용자가 기대한 전체 실행 흐름 분석보다 파일 후보/카운트 리포트처럼 보였다. 또한 상세 화면에서 추가 선택 파일 목록이 먼저 눈에 띄어 Project Deep Index가 전체 흐름을 이해했다는 느낌을 주지 못했다.

## 왜 이 작업이 필요한지

DevJarvis의 목표는 에러 화면과 프로젝트 전체 흐름을 함께 보고 원인 후보를 좁히는 로컬 assistant이다. 프로젝트 분석 결과가 영어이거나 파일 목록 중심이면 사용자는 어떤 런타임 경계, 모듈, API, service 흐름을 확인해야 하는지 바로 파악할 수 없다.

## 어떤 방향으로 해결했는지

프로젝트 분석의 기본 표시 결과는 Desktop에서 생성한 한국어 Project Deep Index 리포트를 사용한다. Local Agent 응답은 한국어일 때만 보조 판단으로 덧붙이고, 영어 응답은 기본 결과로 노출하지 않는다. 상세 화면은 모듈 역할, 런타임 흐름, UI/API/service/repository 후보, endpoint/symbol 후보, 에러 화면 진단 시 사용할 흐름을 우선 보여준다. 특정 파일 추가 분석은 고급 섹션으로 접어 기본 결과와 분리한다.

## 보안상 고려사항

Project Deep Index는 safe source만 로컬에서 읽는다. 민감 파일, binary, large file, dependency/build output, symlink, project root 밖 경로는 차단한다. 실제 OS absolute path와 rootPathAlias는 UI와 Local LLM context에 노출하지 않는다. 파일 원문은 NAS, Backend, AI Server로 전송하지 않는다.

## 현재 한계

현재 flow graph는 source excerpt, endpoint, symbol, role, module path 기반의 lightweight index이다. 정적 import graph, Spring DI graph, Tauri command graph, DB schema graph까지 완전하게 연결하지는 않는다.

## 다음 확장 방향

다음 단계에서는 module graph builder, API route graph, Tauri command graph, frontend API client graph를 분리해 에러 화면 OCR 신호와 더 정확히 매칭한다. 이후 화면 진단 시 Project Deep Index에서 관련 flow만 검색해 Local LLM context로 전달한다.
