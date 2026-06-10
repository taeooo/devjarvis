# Local OCR First Pipeline

## 문제 정의

DevJarvis Desktop의 화면 명령 파이프라인은 화면 캡처 이후 OCR 단계를 Backend `/api/screen/ocr`로 먼저 전송하는 구조가 남아 있었다. 이 구조에서는 사용자가 선택한 화면 이미지와 OCR 대상 데이터가 NAS AI Server 방향으로 이동할 수 있어, 로컬 Assistant 앱이라는 제품 방향과 보안 원칙에 맞지 않는다.

또한 Desktop 결과 메시지에 provider, model, OCR provider, analysis provider 같은 개발자용 내부 정보가 섞일 수 있는 표현이 일부 남아 있었다.

## 왜 이 작업이 필요한지

DevJarvis는 사용자 PC에서 화면을 보고 도와주는 Jarvis형 Assistant를 목표로 한다. 화면 이미지와 OCR 원문은 사용자 화면의 민감정보를 포함할 수 있으므로 원격 서버로 보내지 않는 local-first 원칙이 기본값이어야 한다.

OCR 실패 시 remote OCR로 자동 fallback하면 사용자가 인지하지 못한 상태로 화면 데이터가 외부 경로로 이동할 수 있으므로, Local Agent가 준비되지 않았을 때는 사용자에게 자연스럽게 안내하고 중단하는 것이 더 안전하다.

## 어떤 방향으로 해결했는지

- `devjarvis-local-agent`에 Local OCR API를 추가했다.
  - `GET /internal/local-ocr/health`
  - `POST /internal/local-ocr/extract`
- Desktop의 화면 OCR 호출을 Backend OCR 대신 Local Agent OCR로 변경했다.
- Local OCR 실패 시 Backend/AI Server OCR로 자동 fallback하지 않는다.
- Local Agent OCR 요청은 기존 loopback-only middleware와 같은 보안 경계 안에서 처리된다.
- Local OCR provider는 `rapidocr`와 `placeholder`를 지원한다.
- OCR 이미지 validation은 Local Agent에서 다시 수행한다.
  - MIME type allow-list
  - width/height 제한
  - byte size 제한
  - data URL prefix 검증
  - base64 검증
  - JPEG/PNG/WebP magic bytes 검증
- Desktop 화면 메시지는 provider/model/intent/internal status 중심이 아니라 사용자가 이해할 수 있는 상태로 축약했다.
  - `Screen text extracted`
  - `No readable text found`
  - `Analysis ready`

## 보안상 고려사항

- 화면 이미지는 Local Agent OCR로 전송되며 NAS Backend/AI Server로 자동 전송하지 않는다.
- Local Agent는 기본적으로 `127.0.0.1:17997` loopback 요청만 허용한다.
- Local OCR 실패 시 remote OCR fallback은 금지한다.
- OCR 이미지 원문/base64와 OCR 원문은 로그에 남기지 않는다.
- OCR preview는 redaction을 거친 짧은 문자열만 응답에 포함한다.
- LLM 호출 전 `text_sanitizer`를 통해 secret/token/email/IP/home path를 다시 redaction한다.
- Desktop 사용자 화면에는 provider/model/intent/OCR provider/analysis provider/absolute path/rootPathAlias를 표시하지 않는다.
- Backend project payload에는 실제 OS absolute path가 아니라 alias와 relative file manifest만 전송하는 기존 정책을 유지한다.

## 현재 한계

- Local OCR은 RapidOCR 기반 텍스트 OCR이다. UI 요소의 시각적 구조 이해나 아이콘/버튼 의미 해석은 아직 멀티모달 vision model 단계가 아니다.
- `placeholder` provider는 파이프라인 검증용이며 실제 OCR text를 만들지 않는다.
- Desktop의 화면 선택은 브라우저/Tauri `getDisplayMedia` 선택 UI에 의존한다.
- Local Agent 자동 시작, 설치 패키징, tray/service registration은 아직 설계 단계다.
- Local Agent OCR health와 Local LLM health가 UI에서 하나의 자연스러운 상태로 통합되는 UX는 추가 개선이 필요하다.

## 다음 확장 방향

- Windows 설치 패키지에서 Local Agent 자동 시작 옵션 제공
- Local Agent 상태를 Desktop에서 사용자 친화적인 “Local Assistant 준비됨/설정 필요” 상태로 통합
- OCR result를 기반으로 UI element grouping, error box extraction, code block extraction 추가
- 로컬 vision model 또는 screenshot layout parser 도입 검토
- STT foundation 추가 전, 화면 선택 정책과 wake word 전 단계 권한 흐름 정리
- Project Context/RAG와 화면 OCR 결과를 결합하되 원문 파일과 absolute path를 보내지 않는 payload 정책 유지

## 실행/설정 메모

Local Agent 기본 실행:

```bash
cd /c/projects/devjarvis/devjarvis-local-agent
py -3.11 -m venv .venv
source .venv/Scripts/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
python -m pytest -q
uvicorn app.main:app --reload --host 127.0.0.1 --port 17997
```

OCR provider 설정:

```env
DEVJARVIS_LOCAL_AGENT_LOCAL_OCR_PROVIDER=rapidocr
DEVJARVIS_LOCAL_AGENT_LOCAL_OCR_MAX_IMAGE_BYTES=1500000
DEVJARVIS_LOCAL_AGENT_LOCAL_OCR_MAX_WIDTH=4096
DEVJARVIS_LOCAL_AGENT_LOCAL_OCR_MAX_HEIGHT=4096
```

Ollama 모델 pull 예시:

```bash
ollama pull qwen3:8b
ollama pull qwen2.5-coder:7b
```

권장 model routing 설정:

```env
DEVJARVIS_LOCAL_AGENT_DEFAULT_MODEL=qwen3:8b
DEVJARVIS_LOCAL_AGENT_CODE_MODEL=qwen2.5-coder:7b
DEVJARVIS_LOCAL_AGENT_TRANSLATION_MODEL=qwen3:8b
DEVJARVIS_LOCAL_AGENT_REASONING_MODEL=qwen3:8b
DEVJARVIS_LOCAL_AGENT_FALLBACK_MODEL=qwen3:8b
```
