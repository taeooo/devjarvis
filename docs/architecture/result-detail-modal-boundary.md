# Result Detail Modal Boundary

## 문제 정의

결과 카드의 `View detail`을 눌렀을 때 상세 결과가 전체 화면 modal로 안정적으로 표시되지 않고, 오른쪽 결과 패널 안에 갇히거나 잘려 보이는 문제가 있었다.

## 왜 이 작업이 필요한지

DevJarvis 결과 패널은 compact dashboard 역할이고, 긴 분석 결과는 별도의 읽기 영역에서 확인되어야 한다. 상세 결과가 패널 안에 갇히면 프로젝트 분석, 화면 진단, 계산 풀이처럼 긴 결과를 검토할 수 없다.

## 어떤 방향으로 해결했는지

- 상세 dialog를 result panel 내부가 아니라 document body portal로 렌더링한다.
- modal z-index와 viewport height 경계를 명확히 한다.
- modal body는 독립 스크롤 영역으로 둔다.
- ESC로 닫을 수 있는 기본 keyboard close 동작을 추가한다.
- Result panel은 current/history 요약만 담당하고, 전문은 modal에서 확인하도록 역할을 분리한다.

## 보안상 고려사항

- modal 변경은 UI 렌더링 경계만 바꾼다.
- 화면 이미지, OCR 원문, 음성 원문, 파일 원문 처리 경로는 변경하지 않는다.
- 상세 결과에서도 absolute path와 rootPathAlias를 노출하지 않는 기존 정책을 유지한다.

## 현재 한계

- modal 내부 섹션 디자인은 아직 text/pre 중심이다.
- 프로젝트 분석 결과를 더 읽기 좋은 table/card 구조로 바꾸는 작업은 후속 UI 작업으로 남긴다.

## 다음 확장 방향

- project analysis 섹션을 overview, evidence, next checks로 시각적으로 분리한다.
- 수식 풀이 결과 전용 layout과 로그 분석 결과 전용 layout을 별도 컴포넌트로 분리한다.
