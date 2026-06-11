# Project Analysis Context Budget

## 문제 정의

프로젝트 분석 명령은 Desktop에서 생성한 project manifest summary를 Local Agent LLM endpoint로 전달한다. manifest sample이 커지면 Local Agent의 request validation limit을 초과해 분석이 실행되기 전에 실패할 수 있다.

## 왜 이 작업이 필요한지

프로젝트 분석은 backend 등록 여부와 무관하게 local-first로 동작해야 한다. 사용자가 프로젝트를 선택한 뒤 분석 명령을 실행했을 때 validation error가 발생하면 실제 프로젝트 구조 분석이 수행되지 않고, UI에는 명령 실패 상태만 남는다.

## 어떤 방향으로 해결했는지

Desktop에서 Local Agent에 전달하는 project analysis context에 고정 budget을 둔다. context는 manifest count, language/extension distribution, relative path sample만 포함하며, 지정된 크기를 넘기지 않는 선에서 줄 단위로 구성한다. 파일 원문은 포함하지 않는다.

## 보안상 고려사항

- 실제 OS absolute path는 context에 포함하지 않는다.
- rootPathAlias는 context에 포함하지 않는다.
- 파일 원문은 Local Agent로 전달하지 않는다.
- manifest sample은 relative path metadata만 사용한다.
- validation 실패를 피하기 위해 payload 크기를 Desktop 단계에서 제한한다.

## 현재 한계

현재 project analysis는 manifest metadata 수준의 구조 분석이다. 특정 파일의 실제 원인 분석은 아직 파일 원문을 읽지 않으므로 후보 제안 수준에 머문다.

## 다음 확장 방향

- 사용자가 명시적으로 승인한 파일만 local read 대상으로 확장한다.
- file content chunk도 local-only redaction 후 context budget 안에서 전달한다.
- project-aware screen diagnosis와 동일한 path candidate scoring을 project analysis에도 재사용한다.
