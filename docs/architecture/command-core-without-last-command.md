# Command Core Without Last Command Readout

## 문제 정의

중앙 Core 영역에 Last Command readout을 함께 배치하면 결과 문구가 길어질 때 Orb, 상태 문구, 입력창이 서로 밀리거나 겹친다.

## 왜 이 작업이 필요한지

DevJarvis의 메인 화면은 compact한 Desktop Assistant UI를 유지해야 한다. 상태 시각화 영역과 결과/히스토리 영역이 섞이면 화면 분석이나 프로젝트 분석 결과가 길어질 때 UX가 깨진다.

## 어떤 방향으로 해결했는지

- JarvisCore는 Orb와 현재 상태만 표시한다.
- Last Command readout을 제거한다.
- 실제 명령 결과와 전문 보기는 Result panel과 modal이 담당한다.
- Core 크기는 viewport width와 height를 함께 기준으로 제한한다.

## 보안상 고려사항

- UI layout 변경이며 데이터 전송 경로는 변경하지 않는다.
- command text나 내부 provider/model/path를 Core에 크게 노출하지 않는다.

## 현재 한계

- Core는 상태 중심이라 상세 context는 Result panel을 열어야 확인할 수 있다.

## 다음 확장 방향

- Core 상태 label i18n 분리
- 화면 크기별 visual density preset
- accessibility label 정리
