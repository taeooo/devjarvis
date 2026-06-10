# Local OCR First Pipeline

## 문제 정의

DevJarvis Desktop은 사용자가 선택한 화면/창을 캡처해 화면 번역, 요약, 오류 분석 같은 명령을 처리한다. 화면 이미지와 OCR 원문은 메신저 내용, 이메일, 토큰, 파일 경로, 서버 주소, 브라우저 탭, 내부 오류 로그 같은 민감정보를 포함할 수 있다.

기존 foundation에는 NAS Backend와 AI Server OCR API를 사용할 수 있는 경로가 남아 있었고, 이 경로가 기본 화면 명령 흐름에 섞이면 사용자가 인지하지 못한 상태로 화면 이미지가 원격 서비스로 이동할 수 있다.

```text
Desktop
→ Backend /api/screen/ocr
→ AI Server /internal/ocr/extract
```

## 왜 이 작업이 필요한지

DevJarvis는 사용자 PC에서 동작하는 Jarvis형 Assistant 앱을 목표로 한다. 화면 캡처 데이터는 사용자의 현재 작업 맥락 그 자체이므로, 기본값은 NAS 전송이 아니라 로컬 처리여야 한다.

특히 OCR 실패 시 remote OCR로 자동 fallback하면 보안 경계가 사용자의 명시적 선택 없이 바뀐다. 따라서 Local Agent가 준비되지 않았거나 OCR에 실패하면 원격 fallback을 하지 않고, 사용자가 로컬 설정을 확인하도록 안내하는 것이 더 안전하다.

## 어떤 방향으로 해결했는지

Desktop 화면 명령의 OCR 흐름을 Local Agent 우선 구조로 정리했다.

```text
Desktop
→ Local Agent /internal/local-ocr/extract
→ Local Agent OCR provider
→ Desktop
```

구현 방향은 다음과 같다.

- Desktop은 화면 OCR 단계에서 Backend OCR API를 호출하지 않는다.
- Desktop은 `http://127.0.0.1:17997/internal/local-ocr/extract`만 호출한다.
- Local Agent에 Local OCR API를 둔다.
  - `GET /internal/local-ocr/health`
  - `POST /internal/local-ocr/extract`
- Local Agent OCR provider는 `rapidocr`, `placeholder`를 지원한다.
- OCR provider 설정은 아래 환경변수로 관리한다.

```env
DEVJARVIS_LOCAL_AGENT_OCR_PROVIDER=rapidocr
DEVJARVIS_LOCAL_AGENT_OCR_MAX_IMAGE_BYTES=1500000
DEVJARVIS_LOCAL_AGENT_OCR_MAX_WIDTH=4096
DEVJARVIS_LOCAL_AGENT_OCR_MAX_HEIGHT=4096
```

## 보안상 고려사항

- Local Agent는 loopback 요청만 허용한다.
- Desktop은 Local Agent를 `127.0.0.1`로만 호출한다.
- 화면 이미지는 NAS Backend/AI Server로 자동 전송하지 않는다.
- 화면 이미지는 Desktop 또는 Local Agent에서 파일로 저장하지 않는다.
- OCR 실패 시 remote OCR로 자동 fallback하지 않는다.
- OCR 요청 payload는 Local Agent에서 다시 검증한다.
  - data URL 형식 검증
  - MIME type allow-list 검증
  - base64 검증
  - decoded byte size 검증
  - Desktop 선언 byte size와 decoded byte size 일치 검증
  - JPEG/PNG/WebP magic bytes 검증
  - width/height 제한 검증
- SVG/GIF 등 지원하지 않는 이미지 형식은 거부한다.
- OCR 원문과 화면 이미지/base64는 로그에 남기지 않는다.
- OCR preview는 redaction 후 짧은 문자열만 응답에 포함한다.
- LLM 호출 전 Local Agent text sanitizer를 통해 secret, token, email, IP, home path 등을 다시 redaction한다.
- Desktop 사용자 화면에는 provider, model, intent, OCR provider, analysis provider, internal status, absolute path, rootPathAlias를 표시하지 않는다.

## 현재 한계

- Local OCR은 텍스트 추출 중심이다. 버튼, 아이콘, 레이아웃 의미까지 이해하는 멀티모달 vision 분석은 아직 별도 단계다.
- `placeholder` provider는 파이프라인 검증용이며 실제 OCR text를 만들지 않는다.
- RapidOCR dependency가 준비되지 않으면 Local OCR health는 준비되지 않은 상태가 될 수 있다.
- Desktop 화면 선택은 현재 브라우저/Tauri capture picker 흐름에 의존한다.
- Local Agent 자동 시작, 설치 패키징, Windows service/tray registration은 아직 별도 설계가 필요하다.

## 다음 확장 방향

- Windows 설치 패키지에서 Local Agent 자동 시작 옵션 제공
- Desktop에서 Local Agent/OCR/LLM 상태를 사용자 친화적인 “Local Assistant 준비됨/설정 필요” 상태로 통합
- OCR 결과 기반 UI element grouping, error box extraction, code block extraction 추가
- 로컬 vision model 또는 screenshot layout parser 도입 검토
- STT foundation과 wake word 전 단계 권한 흐름 정리
- Project Context/RAG와 화면 OCR 결과를 결합하되 원문 파일과 absolute path를 보내지 않는 payload 정책 유지

## 실행 메모

```bash
cd /c/projects/devjarvis/devjarvis-local-agent
py -3.11 -m venv .venv
source .venv/Scripts/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
python -m pytest -q
uvicorn app.main:app --reload --host 127.0.0.1 --port 17997
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
