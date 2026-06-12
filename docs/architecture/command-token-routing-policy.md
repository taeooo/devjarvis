# Command Token Routing Policy

## 문제 정의

소스 코드에 자연어 keyword list를 계속 추가하면 명령 라우팅이 장기적으로 유지보수하기 어려워진다. 새로운 표현이 나올 때마다 코드 수정이 필요하고, 한국어/영어/혼합 표현이 늘수록 예측 가능성이 떨어진다.

## 왜 이 작업이 필요한지

DevJarvis는 화면, 프로젝트, 수학, 로그, 채팅처럼 서로 다른 보안 경계를 가진 pipeline을 가진다. 라우팅 오판은 잘못된 capture, 파일 접근, LLM context 전달로 이어질 수 있다.

## 어떤 방향으로 해결했는지

- 명시적 command token을 우선 사용한다.
- 프로젝트가 선택된 상태의 일반 텍스트는 project context로 기본 처리한다.
- inline arithmetic expression처럼 구조적으로 판별 가능한 경우만 자동 분류한다.
- 화면 관련 작업은 `/screen`, `/translate`, `/summary`, `/math` 같은 token을 기준으로 분기한다.
- Assistant Guide와 입력 placeholder에서 자연어 예시 배열을 제거한다.

## 보안상 고려사항

- 화면 capture는 token 기반으로 명시 요청된 경우에만 실행한다.
- 프로젝트 파일 원문 읽기는 별도 승인 flow를 거친다.
- 자연어 표현 누적으로 의도치 않은 pipeline이 실행되는 위험을 줄인다.

## 현재 한계

- 자연어 명령만 입력했을 때 화면 분석으로 자동 분류하지 않는다.
- 사용자는 token 기반 입력 방식을 익혀야 한다.
- 향후 자연어 라우팅이 필요하면 LLM intent parser와 policy gate를 별도로 두어야 한다.

## 다음 확장 방향

- local intent parser 도입
- routing policy test suite 추가
- 사용자별 command alias 설정
- i18n copy와 routing policy 완전 분리
