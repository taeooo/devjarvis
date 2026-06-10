# DevJarvis Local Agent

FastAPI 기반 로컬 PC 전용 agent입니다. Desktop 앱과 같은 PC에서만 실행되며, Ollama 같은 로컬 LLM 런타임을 감싸는 역할을 합니다.

## 보안 기준

- 기본 바인딩: `127.0.0.1:17997`
- 외부/LAN 인바운드 노출 금지
- Ollama도 `127.0.0.1:11434` 기준 사용
- 원문 화면 이미지 저장 없음
- 명령 텍스트는 LLM 호출 전 민감정보 redaction 처리
- NAS에서 이 agent 포트를 열 필요 없음

## 실행

```bash
cd /c/projects/devjarvis/devjarvis-local-agent
py -3.11 -m venv .venv
source .venv/Scripts/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 17997
```

## 확인

```bash
curl http://127.0.0.1:17997/health
curl http://127.0.0.1:17997/internal/local-llm/health
```

## 테스트

```bash
cd /c/projects/devjarvis/devjarvis-local-agent
source .venv/Scripts/activate
pytest -q
```


## Model routing

Local Agent does not hard-code a single LLM. It resolves an Ollama model by command intent.

```text
screen_translate      -> translation model
screen_summary        -> reasoning model
screen_error_analysis -> code model
project_diagnosis     -> code model
log_analysis          -> code model
general_chat          -> default model
```

Recommended first setup:

```env
DEVJARVIS_LOCAL_AGENT_DEFAULT_MODEL=qwen3:8b
DEVJARVIS_LOCAL_AGENT_CODE_MODEL=qwen2.5-coder:7b
DEVJARVIS_LOCAL_AGENT_TRANSLATION_MODEL=qwen3:8b
DEVJARVIS_LOCAL_AGENT_REASONING_MODEL=qwen3:8b
DEVJARVIS_LOCAL_AGENT_FALLBACK_MODEL=qwen3:8b
```

`DEVJARVIS_LOCAL_AGENT_OLLAMA_MODEL` remains supported for backward-compatible single-model mode.

## Local OCR

Local Agent also provides a local-only OCR endpoint so selected screen images do not need to move to the NAS OCR pipeline.

```bash
curl http://127.0.0.1:17997/internal/local-ocr/health
```

Provider selection:

```env
DEVJARVIS_LOCAL_AGENT_OCR_PROVIDER=placeholder
# DEVJARVIS_LOCAL_AGENT_OCR_PROVIDER=rapidocr
```

Security policy:

- accepts loopback requests only
- validates data URL / MIME / byte size / magic bytes
- rejects unsupported image types
- does not save screen images to disk
- does not fallback to remote OCR automatically
