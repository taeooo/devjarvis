# DevJarvis AI Server

FastAPI 기반 DevJarvis AI 분석 서버입니다.

현재 단계에서는 AI Server 기본 기동, Health API, 설정 구조만 포함합니다. 이후 OCR, STT, RAG, Local LLM, LangGraph Agent 기능을 단계적으로 추가합니다.

## 요구 환경

- Python 3.11 권장
- VSCode Git Bash 기준 실행

## 가상환경 생성

```bash
cd /c/projects/devjarvis/devjarvis-ai-server

py -3.11 -m venv .venv
source .venv/Scripts/activate

python -m pip install --upgrade pip
pip install -r requirements.txt
```

## 서버 실행

```bash
cd /c/projects/devjarvis/devjarvis-ai-server
source .venv/Scripts/activate

uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

## 확인

```bash
curl http://localhost:8000/health
curl http://localhost:8000/internal/health
```

## 테스트

```bash
cd /c/projects/devjarvis/devjarvis-ai-server
source .venv/Scripts/activate

pytest
```

## 현재 제공 API

| Method | Path | 설명 |
|---|---|---|
| GET | `/health` | 외부/개발 확인용 health check |
| GET | `/internal/health` | Backend 등 내부 서비스 확인용 health check |

## 환경변수

`.env.example`을 참고합니다. 실제 `.env`는 Git에 커밋하지 않습니다.
