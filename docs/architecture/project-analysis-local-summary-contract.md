# Project Analysis Local Summary Contract

## 문제 정의

프로젝트 분석 결과가 Local LLM의 raw JSON 또는 영어 문장으로 그대로 노출될 수 있었다. 또한 Result card의 높이가 제한된 상태에서 `전문 보기` action이 카드 하단에 있어 사용자가 상세 modal을 열 수 없는 것처럼 보였다.

## 왜 이 작업이 필요한지

프로젝트 분석은 사용자가 프로젝트 구조와 다음 확인 지점을 빠르게 이해하기 위한 기능이다. manifest JSON 자체를 보여주면 분석 결과로 보기 어렵고, Local LLM 출력 형식이 흔들릴 때 UX가 불안정해진다. 상세 보기 진입점은 항상 보장되어야 한다.

## 어떤 방향으로 해결했는지

프로젝트 분석 결과는 우선 Desktop에서 local manifest metadata만으로 결정적 요약을 생성한다. 분석 결과에는 파일 원문 없이 파일 수, 제외 파일 수, 언어/확장자/상위 디렉터리 분포, 엔트리포인트 후보, 설정 파일 후보, 대표 상대경로 샘플만 포함한다. Result card의 `전문 보기` 버튼은 card top line으로 이동해 내용이 잘려도 항상 접근 가능하게 했다.

## 보안상 고려사항

- 파일 원문은 분석 결과 생성에 사용하지 않는다.
- 실제 OS absolute path와 rootPathAlias는 결과에 표시하지 않는다.
- manifest metadata와 relative path만 사용한다.
- Local LLM 출력이 JSON 형태여도 UI에서 raw JSON 그대로 노출하지 않는다.

## 현재 한계

현재 프로젝트 분석은 파일 내용을 읽지 않는 manifest-level 분석이다. 실제 코드 dependency, 함수 호출 관계, 설정 파일 내부 값은 아직 분석하지 않는다.

## 다음 확장 방향

- 사용자가 명시적으로 허용한 일부 파일만 local-only로 읽는 project file inspection 단계 추가
- manifest summary와 파일 내용 분석 결과를 분리한 상세 modal section 추가
- 분석 결과 copy/i18n 분리
