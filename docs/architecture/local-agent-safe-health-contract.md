# Local Agent Safe Health Contract

## 문제 정의

Local Agent의 health/readiness 계열 API는 Desktop이 로컬 기능 사용 가능 여부를 확인하기 위해 호출한다. 기존 응답에는 provider, model, model routing, service version 같은 개발자용 세부 정보가 포함될 수 있었다.

이 정보는 Desktop UI에 직접 표시하지 않더라도, 앱 내부 payload와 curl 확인 결과에 남아 사용자가 볼 수 있는 진단 경로로 노출될 수 있다.

## 왜 이 작업이 필요한지

DevJarvis는 사용자 화면 이미지, OCR text, 로컬 LLM 호출을 사용자 PC 내부에서 우선 처리하는 구조다. 따라서 상태 확인 API도 최소 정보만 반환해야 한다.

특히 모델명과 provider는 실행 설정과 문서에서만 관리하고, 일반 health 응답에는 노출하지 않는 편이 안전하다. 이렇게 해야 Desktop UI와 내부 통신 계약 모두에서 개발자용 정보를 줄일 수 있다.

## 어떤 방향으로 해결했는지

Local Agent의 기본 상태 확인 응답을 readiness 판단에 필요한 값 중심으로 축소했다.

```text
/health
- status
- loopbackOnly

/internal/local-ocr/health
- available
- maxImageBytes
- maxWidth
- maxHeight
- warning

/internal/local-llm/health
- available
- warning
```

아래 항목은 기본 health/analyze/extract 응답에서 제거했다.

```text
provider
model
modelRole
modelRouting
baseUrl
service
version
intent
```

Desktop은 Local Agent 준비 여부만 사용하고, 사용자 화면에는 기존처럼 간단한 안내 문구만 표시한다.

## 보안상 고려사항

- health 응답은 readiness 판단에 필요한 최소 값만 반환한다.
- Local LLM 분석 응답에서 provider/model/modelRole/intent를 제거한다.
- Local OCR 추출 응답에서 provider를 제거한다.
- Desktop type에서도 Local Agent provider/model/routing snapshot을 제거한다.
- 화면 이미지, OCR 원문, LLM prompt는 로그나 health 응답에 포함하지 않는다.
- Local Agent와 Ollama는 계속 loopback 기준으로만 사용한다.

## 현재 한계

- 개발자용 상세 diagnostics endpoint는 아직 분리하지 않았다.
- Ollama에 어떤 모델이 누락되었는지는 기본 health 응답에서 알 수 없다.
- 상세 원인 분석이 필요할 때는 Local Agent 로그 또는 별도 local-only diagnostic API가 필요하다.

## 다음 확장 방향

- 개발 모드에서만 활성화되는 local-only diagnostics endpoint 추가
- Desktop settings 화면에서 Local Agent/Ollama 준비 가이드 제공
- Local Agent 자동 시작/프로세스 관리 설계
- 오류 코드는 사용자 친화 메시지와 개발자 diagnostics를 분리해서 관리
