# LangGraph Orchestration Foundation

## 문제 정의

DevJarvis Local Agent의 기존 분석 흐름은 `/internal/local-llm/analyze` 요청을 서비스에서 바로 처리한 뒤 Local LLM 또는 결정적 계산 로직으로 넘기는 단순 호출 구조였습니다. 이 구조는 현재 MVP에서는 충분하지만, 제출/발표 관점에서 화면 컨텍스트, 프로젝트 컨텍스트, 분석 실행, 응답 정리 단계를 명확하게 설명하기 어렵고 향후 Observer Mode, RAG, Tool Calling, multi-step agent로 확장할 때 책임 경계가 흐려질 수 있습니다.

## 왜 LangChain/LangGraph를 추가했는지

LangGraph는 agent/workflow를 node와 edge로 표현하는 orchestration layer입니다. DevJarvis는 단순 채팅 앱이 아니라 사용자 요청, 화면 OCR 결과, 프로젝트 manifest/파일 컨텍스트를 순차적으로 정리한 뒤 로컬 분석 모델에 전달해야 하므로, 고정된 단계형 workflow를 graph로 감싸는 방식이 적합합니다.

이번 작업에서는 LangChain/LangGraph를 보여주기식 import가 아니라 Local Agent 분석 경로의 내부 실행 흐름으로 연결했습니다. 다만 마감 전 안정성이 우선이므로 기존 API contract와 Desktop 연동은 그대로 유지하고, 내부 orchestration layer만 얇게 추가했습니다.

## 기존 구조와의 차이

### 기존 흐름

```text
Desktop
→ Local Agent /internal/local-llm/analyze
→ LocalLlmService
→ deterministic math or OllamaClient
→ response
```

### 변경 후 흐름

```text
Desktop
→ Local Agent /internal/local-llm/analyze
→ LocalLlmService
→ JarvisOrchestratorService
→ JarvisGraphRunner
→ normalize_request
→ collect_screen_context
→ collect_project_context
→ analyze_request
→ format_jarvis_response
→ response
```

외부 API schema는 변경하지 않았습니다. Desktop이 받는 응답은 기존과 동일하게 `status`, `summary`, `detail`, `actionItems`, `warnings` 구조를 유지합니다.

## Graph node 구성

### 1. `normalize_request`

사용자 입력 텍스트를 trim하고, context 문자열이 화면 또는 프로젝트 성격인지 내부 state에 표시합니다. 이 state는 사용자 UI로 반환하지 않습니다.

### 2. `collect_screen_context`

`screen_*` intent에서 기존 OCR/screen context가 있으면 graph state에 화면 컨텍스트로 기록합니다. OCR 자체를 새로 고도화하지 않고, 이미 만들어진 context를 orchestration state에 정리하는 역할만 수행합니다.

### 3. `collect_project_context`

`project_diagnosis`, `log_analysis` intent에서 기존 프로젝트/로그 context가 있으면 graph state에 기록합니다. 이번 범위에서는 Qdrant, embedding, full RAG를 새로 붙이지 않습니다.

### 4. `analyze_request`

기존 분석 흐름을 호출합니다. 현재는 deterministic math solver와 Ollama 기반 local analysis를 그대로 재사용합니다. 따라서 기능 회귀 위험을 줄이면서 LangGraph node 기반 실행 경로를 확보합니다.

### 5. `format_jarvis_response`

Local LLM 응답을 사용자 친화적인 Jarvis 응답 형태로 정리합니다. 요약은 짧게 유지하고, 상세 내용과 action item은 기존 response schema 안에서 정리합니다. provider, model, internal path, rootPathAlias, graph state 같은 내부 구현 정보는 포함하지 않습니다.

## Local-first 보안 경계

- LangGraph는 Local Agent 내부 orchestration layer입니다.
- raw screen image, OCR text, project file content, audio를 외부 API나 NAS로 전송하는 새 경로를 만들지 않습니다.
- Desktop UI에는 provider/model/internal graph state/internal path/rootPathAlias를 노출하지 않습니다.
- 화면 OCR과 프로젝트 컨텍스트는 기존 Local Agent/Desktop 경계를 유지합니다.
- Backend/NAS는 이 변경의 필수 실행 경로가 아닙니다.

## STT/TTS/Wake 범위 제한

이번 변경은 분석 orchestration foundation과 Windows 앱 빌드 문서화가 목적입니다. 아래 항목은 고도화 범위에서 제외했습니다.

```text
- wake word detector 고도화
- continuous STT polling 개선
- CosyVoice2 음색 품질 개선
- reference voice 재작업
- 음성 합성 모델 교체
- 마이크 권한 UX 고도화
```

## 실패 처리와 fallback

Local 환경에 LangChain/LangGraph 의존성이 아직 설치되지 않은 경우에도 Local Agent가 즉시 죽지 않도록 동일한 node 순서를 sequential fallback으로 실행합니다. 실제 제출/실행 환경에서는 `requirements.txt` 설치 후 LangGraph 기반 graph가 사용됩니다.

## 현재 한계

- 현재 graph는 foundation 수준입니다.
- project context는 manifest/승인 파일 기반 흐름을 유지하며 full RAG는 아직 아닙니다.
- tool calling, memory, retry policy, human-in-the-loop approval은 아직 추가하지 않았습니다.
- LangGraph state는 내부 실행 정리 용도이며 UI/Backend 저장 contract로 사용하지 않습니다.

## 향후 확장 방향

- Observer Mode: 화면 변화 감지 이벤트를 graph 시작점으로 연결
- RAG: 프로젝트 chunking/indexing 후 `collect_project_context` node 확장
- Tool Calling: local file read, log parser, build checker를 승인 기반 tool node로 분리
- Multi-step Agent: 분석 결과에 따라 추가 node를 조건부 실행
- Persistence: 민감정보를 제외한 workflow metadata만 로컬 또는 Backend에 저장
