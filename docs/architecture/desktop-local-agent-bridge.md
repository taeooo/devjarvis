# Desktop Local Agent Bridge

## Issue

DevJarvis는 화면 캡처, OCR, 화면 분석, 로컬 LLM 호출을 하나의 Assistant 경험으로 연결해야 한다. 이전 단계까지는 Local Agent와 model router가 준비되었지만, Desktop은 Local Agent의 상태를 알지 못했고 화면 분석 결과도 NAS Backend / AI Server 중심 pipeline에 남아 있었다.

이 구조를 그대로 두면 사용자가 `자비스, 지금 화면 번역해줘` 또는 `자비스, 이 에러 왜 나는지 봐줘` 같은 명령을 실행할 때 다음 문제가 생긴다.

- Desktop UI에서 Local Agent / Ollama 연결 상태를 알 수 없다.
- Local Agent가 꺼져 있어도 사용자는 원인을 바로 파악하기 어렵다.
- OCR 이후 분석 단계가 local-first로 분리되지 않아 화면 텍스트가 원격 분석 pipeline으로 흐를 가능성이 남는다.
- intent별 model routing 결과가 Desktop 결과 이력에 표시되지 않는다.

## Decision

Desktop에서 Local Agent 상태를 주기적으로 확인하고, 화면 분석 단계는 Local Agent가 준비된 경우 Local Agent를 우선 사용한다.

```text
Desktop
→ Backend /api/screen/ocr
→ OCR text
→ Local Agent /internal/local-llm/analyze
→ Ollama
→ Desktop Result Panel
```

이번 단계에서는 OCR 자체는 기존 Backend / AI Server OCR pipeline을 유지한다. 대신 LLM 분석 단계는 Local Agent를 우선 사용하여 향후 `Desktop → Local Agent OCR → Local Agent LLM` 구조로 확장하기 쉽게 만든다.

## Security Policy

- Local Agent는 `127.0.0.1` loopback 주소만 사용한다.
- Desktop은 Local Agent를 `http://127.0.0.1:17997`로 호출한다.
- Local Agent가 unavailable이면 분석을 자동으로 원격 fallback하지 않는다.
- 전체 모니터 자동 캡처는 하지 않는다.
- 사용자가 선택한 화면/창의 OCR text만 Local Agent에 전달한다.
- Local Agent는 LLM 호출 전 민감정보 redaction을 다시 수행한다.
- NAS 방화벽은 기존과 동일하게 HTTPS 443만 외부 공개하는 방향을 유지한다.

## Pipeline

```text
1. Desktop starts
2. Desktop polls Local Agent health every 30 seconds
3. Context Panel shows Agent / Local LLM / model status
4. User enters screen command
5. Desktop captures selected screen/window
6. Desktop sends capture to Backend OCR API
7. Backend validates image and calls AI Server OCR
8. Desktop receives OCR text
9. Desktop calls Local Agent analyze API
10. Local Agent routes intent to model role
11. Local Agent calls Ollama
12. Desktop stores result in Result Panel
```

## Model Routing

Local Agent model routing remains responsible for model selection.

```text
screen_translate      → translation model
screen_summary        → reasoning model
screen_error_analysis → code model
project_diagnosis     → code model
log_analysis          → code model
general_chat          → default model
```

Desktop only displays provider/model state and does not choose a model directly.

## Operational Notes

Local Agent 실행:

```bash
cd /c/projects/devjarvis/devjarvis-local-agent
source .venv/Scripts/activate
uvicorn app.main:app --reload --host 127.0.0.1 --port 17997
```

Desktop 실행 전 확인:

```bash
curl http://127.0.0.1:17997/health
curl http://127.0.0.1:17997/internal/local-llm/health
```

Ollama 확인:

```bash
ollama list
curl http://127.0.0.1:11434/api/tags
```
