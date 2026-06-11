# Local Text Command Analysis Foundation

## 문제 정의

DevJarvis Desktop은 화면 캡처와 프로젝트 manifest 기반 분석 흐름은 갖추었지만, 사용자가 일반 질문이나 로그/에러 텍스트를 직접 입력했을 때 Local Agent LLM 분석으로 이어지지 않는 공백이 있었다. 특히 프로젝트가 선택되지 않은 상태에서 로그나 에러 메시지를 붙여 넣으면 분석 결과 대신 프로젝트 미선택 상태만 남을 수 있었다.

## 왜 이 작업이 필요한지

Desktop Assistant 앱은 화면, 프로젝트, 음성, RAG 외에도 기본 텍스트 명령을 즉시 처리할 수 있어야 한다. 텍스트 명령을 Local Agent로 연결하면 사용자는 프로젝트를 선택하지 않아도 짧은 질문, 붙여 넣은 로그, 에러 메시지를 로컬 모델로 분석할 수 있다. 또한 화면/프로젝트 파이프라인이 준비되지 않은 상황에서도 안전한 로컬 fallback이 아니라 명시적인 local text path로 처리할 수 있다.

## 어떤 방향으로 해결했는지

- `general` 명령을 `Command queued` 상태로 끝내지 않고 Local Agent LLM 분석으로 연결했다.
- 프로젝트 문맥이 필요한 명령이지만 프로젝트가 선택되지 않은 경우에도, 사용자가 입력한 텍스트 자체는 Local Agent로 분석할 수 있게 했다.
- 분석 결과는 기존 Result Panel의 `summary`, `preview`, `actionItems` 구조로 표시한다.
- 화면 분석 결과가 이미 있는 경우에는 중복 분석하지 않고 기존 화면 분석 결과를 우선한다.
- Local Agent readiness는 Local Agent app + Local LLM readiness만 확인하며 OCR readiness는 요구하지 않는다.

## 보안상 고려사항

- 텍스트 명령 분석은 Local Agent로만 보낸다.
- Backend 또는 NAS AI Server로 텍스트 분석 요청을 자동 전송하지 않는다.
- 파일 원문, 화면 이미지, OCR 원문 덤프, 실제 OS absolute path는 text command context에 포함하지 않는다.
- context에는 사용자 입력 길이, 요청 성격, 선택적으로 짧은 화면 요약만 포함한다.
- provider, model, router, internal status는 Desktop UI에 표시하지 않는다.

## 현재 한계

- 사용자가 입력한 텍스트 자체에 민감정보가 포함될 수 있으므로 Local Agent 내부 sanitizer에 의존한다.
- 긴 로그 전문을 구조화해 chunking하거나 파일 단위로 분석하는 기능은 아직 없다.
- 프로젝트 선택 없이 입력한 텍스트 분석은 manifest/RAG 기반 근거를 사용하지 않는다.
- 명령 분류는 현재 lightweight keyword router 기반이다.

## 다음 확장 방향

- 긴 로그/스택트레이스 chunking 및 local-only parser 추가
- Project manifest 기반 관련 파일 후보와 텍스트 분석 결과를 결합하는 RAG candidate stage 추가
- 음성 transcript가 들어왔을 때 동일한 local text command path를 재사용
- Local Agent diagnostics는 별도 개발자 전용 endpoint로 분리하고 기본 UI에는 최소 상태만 유지
