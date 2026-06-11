# Natural Language Routing Boundary

## 문제 정의

command router에 자연어 synonym list가 계속 추가되면 장기적으로 라우팅 규칙이 불투명해지고, 새로운 표현이 들어올 때마다 source code 수정이 반복된다.

## 왜 이 작업이 필요한지

DevJarvis는 Desktop command shell로 발전해야 하며, source-level 자연어 분기 규칙은 최소화해야 한다. 특히 한국어 표현을 계속 코드에 추가하는 방식은 유지보수성과 테스트 가능성을 떨어뜨린다.

## 어떤 방향으로 해결했는지

- 긴 자연어 keyword list를 제거했다.
- 명시적 slash command prefix를 우선 라우팅 경계로 둔다.
- prefix 예시는 `/screen`, `/project`, `/math`, `/translate`, `/summary`, `/log`이다.
- prefix가 없는 경우에는 screen/project/math의 최소 anchor와 구조적 신호만 사용한다.
- 프로젝트 파일명 또는 확장자 패턴은 자연어 synonym이 아니라 구조적 신호로 취급한다.

## 보안상 고려사항

- routing 단계에서는 파일 원문, OCR 원문, 음성 원문을 외부로 보내지 않는다.
- project-aware flow는 선택된 프로젝트 manifest metadata만 사용한다.
- screen command가 아닌 경우 stale screen context를 현재 명령 context로 재사용하지 않는다.

## 현재 한계

- 완전한 자연어 intent classification은 아직 없다.
- prefix 없는 모호한 명령은 general command로 처리될 수 있다.
- 향후 Local LLM 기반 intent classifier를 붙일 때도 remote fallback은 금지해야 한다.

## 다음 확장 방향

- source-level keyword list 대신 local intent classifier contract를 설계한다.
- command prefix와 UI guide를 정리해 사용자가 안정적으로 의도를 지정할 수 있게 한다.
- intent classifier의 입출력에는 민감정보 redaction 정책을 적용한다.
