# Jarvis Core Responsive Layout

## 문제 정의

프로젝트 분석처럼 상태 문구와 결과 메시지가 길어지는 명령을 실행하면 중앙 Orb와 AI Core readout이 하단 Last Command panel과 겹치며 화면이 밀리거나 깨져 보였다.

## 왜 이 작업이 필요한지

DevJarvis의 main screen은 항상 현재 명령 상태를 안정적으로 보여줘야 한다. 핵심 visual 영역이 command readout과 겹치면 사용자는 project analysis가 실패했는지, 화면 상태가 섞였는지 구분하기 어렵다.

## 어떤 방향으로 해결했는지

- Jarvis Core panel을 absolute overlay 중심에서 grid row layout으로 변경했다.
- Orb visual 영역과 command readout 영역을 서로 다른 row로 분리했다.
- Orb 크기는 viewport width와 height를 모두 고려해 clamp한다.
- Core status label은 한 줄 ellipsis로 제한한다.
- Last Command message는 최대 높이와 line clamp를 적용해 main panel을 밀지 않게 했다.
- Result panel은 내부 scroll을 허용해 오른쪽 side stack 전체가 밀리지 않게 했다.

## 보안상 고려사항

- 이번 변경은 layout 구조 변경이며 화면 이미지, OCR 원문, 파일 원문, 음성 원문 처리 경로를 변경하지 않는다.
- provider, model, rootPathAlias, absolute path 같은 내부 정보 노출을 추가하지 않는다.

## 현재 한계

- 극단적으로 작은 window size에서는 compact layout이 우선이며 일부 텍스트는 ellipsis 처리된다.
- detail 정보는 result modal에서 확인하는 정책을 유지한다.

## 다음 확장 방향

- window size별 visual density token을 분리한다.
- command readout을 접기/펼치기 가능한 drawer로 분리한다.
- Tauri window minimum size 정책과 CSS breakpoint를 함께 정리한다.
