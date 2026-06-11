# Project Analysis Result Contract

## 문제 정의

프로젝트 분석 명령이 Local Agent 응답을 그대로 화면에 표시하면서, 사용자가 기대한 프로젝트 구조/위험 구역/다음 확인 지점 대신 JSON 문자열이나 파일 개수 중심의 요약만 노출되는 문제가 있었다.

## 왜 이 작업이 필요한지

DevJarvis의 프로젝트 분석은 파일 원문을 읽지 않는 단계에서도 사용자가 다음에 무엇을 봐야 하는지 판단할 수 있어야 한다. 단순 파일 수, 확장자 수, raw JSON 출력은 분석 결과가 아니라 진단 재료에 가깝다. 이 상태가 지속되면 사용자는 프로젝트 분석 기능을 신뢰하기 어렵다.

## 어떤 방향으로 해결했는지

- 프로젝트 manifest metadata에서 구조적 요약을 먼저 만든다.
- Local Agent에는 context budget 이하의 manifest summary만 전달한다.
- Local Agent 응답이 JSON fence 또는 nested JSON 형태로 돌아와도 Desktop에서 한 번 더 정규화한다.
- 최종 상세 결과에는 Local Agent 분석과 manifest evidence를 분리해서 표시한다.
- 파일 원문은 읽지 않고 relative path, language, extension, top-level path distribution만 사용한다.

## 보안상 고려사항

- 실제 OS absolute path는 Local Agent context에 포함하지 않는다.
- rootPathAlias는 Local Agent context에 포함하지 않는다.
- 파일 원문은 Local Agent로 전달하지 않는다.
- 분석 결과에는 relative path와 manifest metadata만 표시한다.
- Local Agent 실패 시 AI Server/NAS fallback을 추가하지 않는다.

## 현재 한계

- 파일 내용을 읽지 않기 때문에 실제 코드 내부의 버그 원인은 아직 확정할 수 없다.
- 프로젝트 구조 판단은 manifest metadata 기반의 후보 분석이다.
- 추후 파일 단위 분석은 사용자가 명시적으로 선택한 파일에 대해서만 local-only 방식으로 확장해야 한다.

## 다음 확장 방향

- 사용자가 선택한 관련 파일만 Local Agent로 읽는 allowlist 기반 local file analysis를 추가한다.
- manifest evidence와 Local Agent 응답을 UI에서 별도 섹션으로 더 명확하게 분리한다.
- 프로젝트별 runtime profile을 저장해 Backend는 metadata/history 저장 역할로만 사용한다.
