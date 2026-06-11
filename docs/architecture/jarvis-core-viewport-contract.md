# Jarvis Core Viewport Contract

## 문제 정의

Jarvis Core 중앙 영역은 Orb, current phase label, Last Command readout, command input을 한 화면 안에 유지해야 한다. 상태 문구가 길어지거나 project analysis 실패 결과가 표시될 때 grid item의 intrinsic height가 커지면 하단 입력 영역이나 Last Command 영역이 viewport 밖으로 밀릴 수 있다.

## 왜 이 작업이 필요한지

DevJarvis Desktop은 사용자가 명령 상태를 계속 확인하면서 다음 명령을 입력하는 앱이다. 화면이 밀리면 입력창, 현재 상태, 실패 원인을 동시에 확인할 수 없고, 프로젝트 분석 같은 핵심 flow가 깨진 것처럼 보인다.

## 어떤 방향으로 해결했는지

- app shell을 viewport height 안에 고정한다.
- main command zone과 side stack은 내부에서만 shrink/scroll되도록 min-height와 overflow 경계를 명확히 한다.
- Orb 크기는 viewport height와 width를 동시에 기준으로 제한한다.
- Core phase label은 한 줄 ellipsis로 제한한다.
- Last Command readout은 별도 grid row로 고정하고 높이를 제한한다.
- 이전에 남아 있던 중복 Core CSS override를 제거한다.

## 보안상 고려사항

이번 변경은 layout contract 변경이다. 화면 이미지, OCR 원문, 음성 원문, 파일 원문 처리 경로는 변경하지 않는다.

## 현재 한계

작은 해상도에서는 모든 패널을 한 화면에 표시하는 대신 일부 side panel의 내부 scroll이 필요할 수 있다.

## 다음 확장 방향

- viewport regression screenshot test를 추가한다.
- 1366×768, 1600×900, 1920×1080 기준 visual smoke checklist를 자동화한다.
- 중앙 Core 영역의 motion scale을 사용자 설정으로 분리한다.
