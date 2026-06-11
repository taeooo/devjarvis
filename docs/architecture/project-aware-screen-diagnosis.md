# Project-aware Screen Diagnosis Foundation

## 문제 정의

화면 오류 분석이 OCR text만 보면 현재 선택된 프로젝트의 파일 구조와 연결되지 않아 원인 후보와 다음 확인 파일을 좁히기 어렵다.

## 왜 이 작업이 필요한지

사용자가 “이 화면 왜 그런거야?”라고 물을 때 실제 개발자 관점에서는 화면의 error, route, component, file name을 프로젝트 구조와 연결해야 한다. 단, 파일 원문을 무작정 읽거나 전송하면 local-first 보안 원칙에 어긋난다.

## 어떤 방향으로 해결했는지

- OCR text에서 file-like token, relative path, API path, component-like identifier 같은 구조적 신호만 추출한다.
- 선택된 project manifest의 metadata와 relative path만 사용해 related file candidates를 산출한다.
- 파일 원문은 읽지 않는다.
- Local LLM context에는 detected signal과 related relative path만 전달한다.
- UI detail modal에 related file candidates를 표시한다.

## 보안상 고려사항

- 화면 이미지는 Local Agent OCR 경로만 사용한다.
- OCR 원문은 NAS로 보내지 않는다.
- project absolute path와 rootPathAlias는 UI와 Local LLM context에 넣지 않는다.
- related file candidate는 relative path만 표시한다.
- source-level natural-language keyword list를 추가하지 않고 technical structure 기반 regex만 사용한다.

## 현재 한계

- 파일 원문 기반 RAG는 아직 수행하지 않는다.
- OCR text 품질이 낮으면 related file candidate recall이 낮을 수 있다.
- 원인 후보와 next action은 Local LLM 응답 품질에 의존한다.

## 다음 확장 방향

- 사용자가 명시적으로 승인한 파일만 local-only로 읽는 file snippet stage를 추가한다.
- manifest metadata에 package/module graph를 추가한다.
- source-level keyword list 대신 local intent classifier를 도입한다.
