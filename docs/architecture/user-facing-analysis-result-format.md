# User-Facing Analysis Result Format

## 문제 정의

Project Deep Index 또는 선택 파일 분석 결과에서 Local Agent가 반환한 구조화 JSON 값이 사용자 상세 화면에 그대로 노출될 수 있었다. 사용자는 분석 결과를 읽으려는 것이지, 내부 응답 payload나 JSON schema를 확인하려는 것이 아니다.

## 왜 이 작업이 필요한지

DevJarvis는 로컬 프로젝트 전체 흐름과 에러 화면 원인 후보를 사용자가 이해할 수 있는 형태로 설명해야 한다. JSON payload가 그대로 보이면 분석 품질이 낮아 보이고, 사용자가 실제로 확인해야 할 실행 흐름, 모듈 경계, 위험 지점, 다음 액션을 빠르게 파악하기 어렵다.

## 어떤 방향으로 해결했는지

Desktop Result panel에서 JSON-like 문자열을 사용자용 섹션 텍스트로 변환하는 방어 로직을 추가했다. Local Agent가 nested JSON을 반환하더라도 `실행 흐름`, `모듈 경계`, `UI/API/서비스 연결`, `잠재 위험 지점`, `다음 확인 항목` 같은 섹션으로 표시한다. 선택 파일 분석 결과도 Local Agent raw 응답을 그대로 쓰지 않고, 승인 범위와 보안 경계가 포함된 한국어 리포트로 재구성한다.

## 보안상 고려사항

표시 형식 변경은 데이터 전송 경로를 변경하지 않는다. 파일 원문은 승인된 로컬 파일만 읽고, 민감 라인 redaction 이후 Local Agent로만 전달한다. NAS, Backend, AI Server로 파일 원문을 보내는 fallback은 추가하지 않는다. 실제 OS absolute path와 rootPathAlias도 UI에 노출하지 않는다.

## 현재 한계

Local Agent가 영어 문장이나 모호한 텍스트를 반환하는 경우, Desktop은 JSON 노출을 막을 수는 있지만 의미 품질까지 완전히 보장하지는 못한다. prompt level에서도 plain Korean string을 요구하지만, 로컬 모델 특성상 항상 지켜진다고 가정하지 않는다.

## 다음 확장 방향

분석 결과 schema를 UI 전용 typed contract로 분리하고, Local Agent 응답을 별도 normalizer에서 검증한 뒤 Result panel에 전달하는 구조로 확장한다. 이후 flow graph, endpoint graph, UI/API/service 연결 정보를 별도 컴포넌트로 시각화할 수 있다.
