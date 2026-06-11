# Screen Math Solver Foundation

## 문제 정의

화면 OCR 결과를 일반 LLM 분석으로만 처리하면 초등 산수/빈칸 계산처럼 정답이 명확한 문제에서도 오답 또는 추상적 안내가 나올 수 있다. 사용자는 계산 결과를 기대하지만, 기존 흐름은 “풀이 방식 확인” 같은 일반 조언으로 끝날 수 있다.

## 왜 이 작업이 필요한지

DevJarvis의 화면 분석은 번역/요약/오류 분석뿐 아니라 사용자가 보고 있는 간단한 계산 문제를 즉시 해결할 수 있어야 한다. 특히 산술 계산은 LLM의 자연어 추론보다 deterministic parser가 더 안전하고 재현 가능하다.

## 어떤 방향으로 해결했는지

- Desktop command router에 계산/수식/빈칸/풀어줘 계열 명령을 `screen_math_solver` intent로 분류했다.
- 화면 맥락이 필요한 계산 명령은 기존 화면 선택/캡처 정책을 그대로 사용한다.
- Local Agent에 단순 정수 덧셈/뺄셈 worksheet 전용 solver를 추가했다.
- `screen_math_solver` 요청에서 OCR 텍스트 안의 `33 - 14 - 9 =` 같은 수식을 찾으면 LLM 호출 전에 deterministic solver가 답을 반환한다.
- 수식을 찾지 못하면 기존 Local LLM route로 fallback한다.

## 보안상 고려사항

- 화면 이미지는 기존 Local OCR First 정책을 유지한다.
- 수식 solver는 OCR 텍스트만 사용하고 원본 이미지를 저장하지 않는다.
- Python `eval`을 사용하지 않고 정수와 `+`, `-` token만 직접 계산한다.
- provider, model, router, absolute path, rootPathAlias는 사용자 화면에 노출하지 않는다.
- remote OCR/analysis fallback은 추가하지 않았다.

## 현재 한계

- 현재 solver는 정수 덧셈/뺄셈만 지원한다.
- 곱셈, 나눗셈, 괄호, 분수, 방정식, 도형 문제는 deterministic solver 대상이 아니다.
- OCR이 수식을 제대로 읽지 못하면 정확한 계산을 보장할 수 없다.
- 중간 계산칸의 모든 배치 의미를 시각적으로 해석하지는 않는다.

## 다음 확장 방향

- 곱셈/나눗셈/괄호 지원
- OCR block 좌표 기반 worksheet layout 해석
- 계산 전용 결과 UI 추가
- 사용자가 “답만”, “풀이도 같이”를 선택할 수 있는 출력 모드 추가
- Python calculator tool과 Local LLM explanation을 분리한 hybrid math pipeline
