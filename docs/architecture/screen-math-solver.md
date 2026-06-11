# Screen Math Solver Foundation

## 문제 정의

화면 OCR 결과를 일반 LLM 분석으로만 처리하면 답이 명확한 계산 문제에서도 오답 또는 추상적 안내가 나올 수 있다. 특히 곱셈, 나눗셈, 괄호, 몫/나머지 문제는 LLM이 화면 텍스트를 설명만 하고 실제 답을 안정적으로 계산하지 못할 수 있다.

## 왜 이 작업이 필요한지

DevJarvis의 화면 분석은 번역/요약/오류 분석뿐 아니라 사용자가 보고 있는 계산 문제를 즉시 해결할 수 있어야 한다. 산술 계산은 LLM의 자연어 추론보다 deterministic parser가 더 안전하고 재현 가능하다.

## 어떤 방향으로 해결했는지

- Desktop command router에 계산/수식/빈칸/풀어줘/곱셈/나눗셈/몫/나머지 계열 명령을 `screen_math_solver` intent로 분류했다.
- 화면 맥락이 필요한 계산 명령은 기존 화면 선택/캡처 정책을 그대로 사용한다.
- Local Agent에 산술 worksheet 전용 solver를 추가했다.
- 지원 범위는 정수/소수, `+`, `-`, `×`, `÷`, `*`, `/`, 괄호, 단순 몫/나머지 출력이다.
- `screen_math_solver` 요청에서 OCR 텍스트 안의 수식을 찾으면 LLM 호출 전에 deterministic solver가 답을 반환한다.
- 사용자가 몫/나머지를 요청했거나 OCR 텍스트에 관련 표현이 있으면 단순 정수 나눗셈에 대해 몫과 나머지도 함께 표시한다.
- 수식을 찾지 못하면 기존 Local LLM route로 fallback한다.

## 보안상 고려사항

- 화면 이미지는 기존 Local OCR First 정책을 유지한다.
- 수식 solver는 OCR 텍스트와 사용자가 입력한 로컬 요청 문맥만 사용하고 원본 이미지를 저장하지 않는다.
- Python `eval`을 사용하지 않고 제한된 token parser와 `Fraction` 기반 계산만 사용한다.
- division by zero, 잘못된 괄호, 지원하지 않는 token은 deterministic solver에서 처리하지 않고 fallback 대상으로 둔다.
- provider, model, router, absolute path, rootPathAlias는 사용자 화면에 노출하지 않는다.
- remote OCR/analysis fallback은 추가하지 않았다.

## 현재 한계

- 현재 solver는 산술 계산용이며 미분, 적분, 행렬, 방정식, 복소수 같은 공학수학은 deterministic 처리 대상이 아니다.
- OCR이 수식을 잘못 읽으면 정확한 계산을 보장할 수 없다.
- `x`가 변수인지 곱셈 기호인지 문맥상 애매한 경우에는 숫자 사이의 `x`만 곱셈으로 정규화한다.
- 중간 계산칸의 모든 배치 의미를 시각적으로 해석하지는 않는다.

## 다음 확장 방향

- 분수 표기와 mixed number 표기 보강
- OCR block 좌표 기반 worksheet layout 해석
- SymPy 기반 algebra/calculus route 추가
- 계산 전용 결과 UI 추가
- 사용자가 “답만”, “풀이도 같이”를 선택할 수 있는 출력 모드 추가
- Local LLM은 최종 계산값을 만들기보다 풀이 설명 생성에만 사용하는 hybrid math pipeline으로 확장
