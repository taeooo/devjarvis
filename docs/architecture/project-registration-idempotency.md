# Project Registration Idempotency

## 문제 정의

Desktop에서 같은 로컬 프로젝트를 다시 선택한 뒤 project analysis를 실행하면 Backend project create 단계에서 `PROJECT_NAME_CONFLICT`가 발생할 수 있었다. 이 실패가 Local manifest scan 이후의 project analysis까지 중단시키면서, 사용자는 이미 등록된 프로젝트를 다시 분석할 수 없었다.

## 왜 이 작업이 필요한지

DevJarvis Desktop MVP에서 project analysis의 주 실행 경로는 사용자 PC 안의 local manifest scan과 Local Agent analysis이다. Backend는 project metadata/manifest sync를 보조하는 저장 계층이므로, Backend 중복 등록 실패가 local analysis를 막아서는 안 된다.

## 어떤 방향으로 해결했는지

- Backend project create를 idempotent하게 변경했다.
- 같은 `rootPathAlias`의 active project가 있으면 새로 만들지 않고 기존 project를 반환한다.
- active project name이 이미 있으면 기존 project를 반환한다.
- Desktop은 Backend sync 실패를 project analysis 실패로 전파하지 않고, local manifest scan 결과만으로 분석을 계속한다.
- Result metadata에는 sync 성공/스킵 여부만 남기고, Backend 내부 오류 전문은 UI에 그대로 노출하지 않는다.

## 보안상 고려사항

- Backend idempotency는 실제 OS absolute path를 요구하지 않는다.
- Desktop은 Local Agent context에 `rootPathAlias`와 absolute path를 전달하지 않는다.
- Backend sync 실패 시 AI Server/NAS fallback을 추가하지 않는다.
- 파일 원문은 여전히 project analysis payload에 포함하지 않는다.

## 현재 한계

현재 `rootPathAlias`는 로컬 path 자체가 아니라 alias 값이다. 기존 데이터와 호환성을 우선하여 active project name 중복도 idempotent reuse로 처리한다. 따라서 완전히 같은 이름의 서로 다른 로컬 프로젝트를 별도 project로 관리하는 UX는 아직 없다.

## 다음 확장 방향

- 사용자에게 노출하지 않는 local-only project identifier를 별도 설계한다.
- 같은 display name의 여러 프로젝트를 구분할 수 있는 alias/label 정책을 추가한다.
- project metadata sync 실패 이력을 local history에 별도 저장한다.
