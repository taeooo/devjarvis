# DevJarvis 보안 정책 및 화면 분석 파이프라인 정리

## 1. 문서 목적

이 문서는 DevJarvis Desktop, Backend, AI Server, Local Agent, Ollama 기반 Local LLM 구조를 기준으로 현재까지 작업한 보안 정책과 화면 분석 파이프라인을 정리한다.

DevJarvis는 단순 프로젝트 스캐너가 아니라, 사용자의 로컬 PC에서 동작하는 Jarvis형 AI Assistant를 목표로 한다. 따라서 화면 캡처, OCR, 프로젝트 문맥, 로컬 LLM 추론을 다루는 과정에서 보안 정책을 강하게 유지해야 한다.

---

## 2. 현재 모듈 구조

```text
devjarvis/
├─ devjarvis-desktop/       # Tauri + React Desktop 앱
├─ devjarvis-backend/       # NAS Spring Boot API Gateway / 정책 / DB 접근
├─ devjarvis-ai-server/     # NAS FastAPI AI orchestration
├─ devjarvis-local-agent/   # 사용자 PC local-only AI runtime gateway
├─ devjarvis-infra/         # NAS / k8s / 배포 관련 설정
├─ docs/
└─ README.md
```

각 모듈의 책임은 다음과 같다.

| 모듈 | 역할 |
|---|---|
| `devjarvis-desktop` | 사용자 명령 입력, 화면 캡처, Jarvis Command Shell UI, tray background mode |
| `devjarvis-backend` | 외부 진입 API, 공통 보안 정책, rate limit, DB 접근, AI Server 호출 중계 |
| `devjarvis-ai-server` | OCR/분석/RAG/LLM provider orchestration, provider routing |
| `devjarvis-local-agent` | 사용자 PC에서만 실행되는 로컬 AI gateway, Ollama 호출, 민감정보 redaction |
| `Ollama` | 사용자 PC의 로컬 LLM runtime / model server |

---

## 3. 권장 배포 구조

DevJarvis는 NAS와 사용자 PC 역할을 분리한다.

```text
사용자 PC
├─ DevJarvis Desktop
├─ DevJarvis Local Agent      127.0.0.1:17997
└─ Ollama                     127.0.0.1:11434

NAS
├─ Reverse Proxy / HTTPS      443 only
├─ devjarvis-backend          내부망 only
├─ devjarvis-ai-server        내부망 only
├─ PostgreSQL                 내부망 only
└─ Redis 등 내부 인프라        내부망 only
```

### 3.1 NAS 방화벽 원칙

외부 공개는 HTTPS `443`만 허용한다.

```text
외부 공개 허용
- 443 HTTPS

외부 공개 금지
- Backend 실제 서비스 포트
- AI Server 포트
- PostgreSQL 포트
- Redis 포트
- Local Agent 포트
- Ollama 포트
```

### 3.2 사용자 PC 방화벽 원칙

사용자 PC는 외부에서 접속받지 않는다.

```text
허용
- Desktop → Local Agent: 127.0.0.1
- Local Agent → Ollama: 127.0.0.1
- Desktop → NAS Backend: HTTPS outbound

금지
- Local Agent를 0.0.0.0으로 bind
- Ollama를 외부 IP로 bind
- 사용자 PC의 Local Agent/Ollama 포트를 NAS 또는 인터넷에 노출
```

---

## 4. 현재까지 구현된 주요 흐름

### 4.1 Desktop Jarvis Command Shell

기존 Project Scanner 중심 화면을 Jarvis형 Command Shell UI로 재구성했다.

```text
앱 실행
→ Jarvis Command Shell 표시
→ AI Core / HUD UI 표시
→ 음성 대기 상태 표현
→ 마이크 사용 불가 시 Text Command Fallback 사용
```

주요 특징:

```text
- 시작 시 최대화 실행
- 큰 화면 대응 layout
- 중앙 AI Core / Orb / HUD UI
- Context 상태 표시
  - Screen
  - Project
  - Voice
  - RAG
- 프로젝트 선택 기능은 메인 기능이 아니라 Context Source로 이동
- 절대 경로 화면 노출 금지
```

### 4.2 Tray Background Mode

DevJarvis는 사용자가 계속 창을 보고 있는 앱이 아니라, 백그라운드에서 대기하는 assistant 앱에 가깝다.

```text
X 버튼 클릭
→ 앱 종료 아님
→ tray로 숨김
→ 작업표시줄에서 제거
→ tray 메뉴에서 다시 열기 또는 종료
```

주요 메뉴:

```text
- DevJarvis 열기
- 트레이로 숨기기
- 종료
```

완전 종료는 tray 메뉴의 `종료`를 통해 수행한다.

### 4.3 Screen Command Pipeline Foundation

텍스트 명령을 기반으로 화면 명령인지, 프로젝트 명령인지, 일반 명령인지 판단하는 pipeline을 추가했다.

```text
사용자 명령 입력
→ command router
→ intent/context 추론
→ 화면 명령이면 화면/창 캡처
→ 프로젝트 명령이면 최신 manifest 갱신
→ Result Panel에 pipeline 상태 기록
```

지원하는 intent 예시:

```text
- screen_translate
- screen_summary
- screen_error_analysis
- project_diagnosis
- log_analysis
- general_chat
```

### 4.4 Screen OCR Pipeline Foundation

화면 캡처 이미지를 OCR 요청으로 연결했다.

```text
Desktop
→ 선택 화면/창 캡처
→ 이미지 축소/압축
→ Backend /api/screen/ocr
→ AI Server /internal/ocr/extract
→ OCR result 반환
→ Desktop Result Panel 표시
```

보안상 중요한 점:

```text
- 전체 모니터 자동 캡처 금지
- 사용자가 선택한 화면/창만 캡처
- 캡처 이미지는 파일로 저장하지 않음
- OCR 요청 전 Desktop에서 이미지 축소/압축
- Backend와 AI Server 양쪽에서 MIME / magic byte / size / resolution 검증
- OCR 이미지 원문/base64를 로그에 남기지 않음
```

### 4.5 RapidOCR Provider

AI Server에 실제 OCR provider로 RapidOCR provider를 추가했다.

```text
OCR_PROVIDER=rapidocr
→ base64 image decode
→ PIL image decode
→ RGB numpy array 변환
→ RapidOCR engine 실행
→ text / blocks / confidence 반환
```

기존 placeholder provider는 유지한다. RapidOCR 의존성이 없거나 실행 실패 시 서버가 죽지 않고 failed status를 반환한다.

### 4.6 Screen Analysis Pipeline Foundation

OCR 결과를 기반으로 화면 분석 API를 호출하는 구조를 추가했다.

```text
OCR 결과
→ Backend /api/screen/analyze
→ AI Server /internal/screen/analyze
→ screen analysis provider
→ 분석 결과 반환
→ Desktop Result Panel 표시
```

중요 정책:

```text
- 분석 API에는 이미지 원본을 다시 보내지 않음
- OCR text만 전달
- OCR text 길이 제한 적용
- 분석 전 민감정보 redaction 적용
```

### 4.7 Local LLM Provider Foundation

AI Server에 Ollama 기반 local LLM provider foundation을 추가했다.

```text
AI Server screen analysis provider
├─ placeholder
└─ ollama
```

초기 설정 예시:

```env
DEVJARVIS_AI_SCREEN_ANALYSIS_PROVIDER=ollama
DEVJARVIS_AI_OLLAMA_BASE_URL=http://localhost:11434
DEVJARVIS_AI_OLLAMA_MODEL=<local-model-name>
DEVJARVIS_AI_SCREEN_ANALYSIS_MAX_INPUT_CHARS=6000
DEVJARVIS_AI_SCREEN_ANALYSIS_TIMEOUT_SECONDS=20
DEVJARVIS_AI_SCREEN_ANALYSIS_TEMPERATURE=0.1
```

단, 최종 배포 구조에서는 NAS AI Server가 직접 사용자 PC의 Ollama를 호출하는 구조보다, `devjarvis-local-agent`를 통해 로컬 PC에서 처리하는 구조가 더 안전하다.

### 4.8 Local Agent Foundation

사용자 PC 전용 local-only gateway인 `devjarvis-local-agent`를 추가했다.

```text
Desktop
→ Local Agent 127.0.0.1:17997
→ Ollama 127.0.0.1:11434
```

Local Agent의 현재 API:

```text
GET  /health
GET  /internal/local-llm/health
POST /internal/local-llm/analyze
```

Local Agent 보안 정책:

```text
- loopback-only middleware 적용
- 127.0.0.1 / localhost 외 요청 차단
- LLM 호출 전 민감정보 redaction
- 외부/LAN 노출 금지
```

---

## 5. 보안 정책 정리

### 5.1 Secret / Token / 환경변수

```text
금지
- DB password, API key, token, secret을 코드에 저장
- .env, .env.*, *.pem, *.key, *.jks, *.p12를 Git에 포함
- 로그에 secret 출력

권장
- .env.example에는 placeholder만 작성
- 실제 값은 로컬 환경변수 또는 배포 secret으로 관리
```

### 5.2 화면 캡처 / OCR

```text
금지
- 전체 모니터 자동 캡처
- 캡처 이미지를 파일로 저장
- 이미지 원문/base64를 로그에 남김
- 캡처 이미지를 불필요하게 NAS로 전송

권장
- 사용자가 선택한 화면/창만 캡처
- 이미지 전송 전 축소/압축
- MIME / magic byte / size / resolution 검증
- OCR text만 다음 단계로 전달
```

### 5.3 Local Agent / Ollama

```text
필수
- Local Agent는 127.0.0.1에만 bind
- Ollama도 127.0.0.1에만 bind
- 외부/LAN 접근 차단
- NAS에서 사용자 PC Local Agent로 직접 inbound 호출하지 않음

권장
- Desktop 또는 Local Agent가 outbound로 필요한 서버에 요청
- WebSocket이 필요하면 클라이언트가 서버로 연결 시작
```

### 5.4 Project Manifest

```text
금지
- 프로젝트 선택 시점에 바로 manifest 등록
- 실제 OS absolute path를 Backend payload로 전송
- 파일 원문 업로드

권장
- 분석 요청 시점에 최신 파일 상태 재스캔
- 제외 규칙 적용
- metadata manifest만 Backend에 등록
- 화면에는 selected / not selected 수준만 표시
```

기본 제외 대상:

```text
.env
.env.*
*.pem
*.key
*.jks
*.p12
secret
password
token
.git
.venv
venv
node_modules
target
build
dist
.gradle
__pycache__
```

---

## 6. 전체 파이프라인 정리

### 6.1 화면 번역 / 요약 / 에러 분석

```text
사용자 명령
예: 자비스 지금 화면 번역해줘

→ Desktop Command Router
→ screen intent 판단
→ 사용자가 화면/창 선택
→ Desktop capture
→ 이미지 축소/압축
→ OCR pipeline
→ OCR text 생성
→ 민감정보 redaction
→ Screen Analysis pipeline
→ Local Agent 또는 AI Server provider
→ LLM 분석
→ Result Panel / Notification 표시
```

### 6.2 프로젝트 문맥 기반 분석

```text
사용자 명령
예: 자비스 현재 프로젝트 기준으로 원인 찾아줘

→ Desktop Command Router
→ project/auto context 판단
→ 분석 시점에 프로젝트 파일 재스캔
→ 제외 규칙 적용
→ Backend manifest metadata 등록
→ 추후 RAG indexing / retrieval
→ LLM 분석 context에 필요한 파일만 포함
```

### 6.3 권장 최종 구조

```text
민감 화면 처리
Desktop → Local Agent → Ollama → Desktop

프로젝트 metadata / 이력 / 설정
Desktop → Backend(NAS) → DB

NAS 내부 분석 workflow
Backend → AI Server → 내부 provider
```

---

## 7. 트러블슈팅 기록

### 7.1 Git Bash에서 patch zip 해제 시 tar 실패

증상:

```text
tar: This does not look like a tar archive
tar: Skipping to next header
tar: Exiting with failure status due to previous errors
```

원인:

```text
zip 파일을 tar archive로 해석하려 해서 실패
```

해결:

```bash
cd /c/projects/devjarvis
unzip -o /c/Users/xoomm/Downloads/<patch-file>.zip -d /c/projects/devjarvis
```

`unzip`이 없으면 PowerShell 사용:

```bash
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -Force -LiteralPath 'C:\Users\xoomm\Downloads\<patch-file>.zip' -DestinationPath 'C:\projects\devjarvis'"
```

### 7.2 Python venv 활성화 경로

Windows Git Bash:

```bash
cd /c/projects/devjarvis/<python-module>
source .venv/Scripts/activate
```

WSL/Linux/macOS:

```bash
source .venv/bin/activate
```

### 7.3 Local Agent pytest에서 `No module named 'app'`

증상:

```text
ModuleNotFoundError: No module named 'app'
```

원인:

```text
pytest 실행 시 devjarvis-local-agent 루트가 sys.path에 잡히지 않음
```

해결:

```text
- tests/conftest.py에서 프로젝트 루트를 sys.path에 추가
- pytest는 local-agent 루트에서 실행
```

실행:

```bash
cd /c/projects/devjarvis/devjarvis-local-agent
source .venv/Scripts/activate
python -m pytest -q
```

### 7.4 Backend 테스트가 `application-local.yml`을 보지 않는 경우

증상:

```text
./gradlew.bat test 실행 시 local profile 설정 미적용
```

해결:

```bash
cd /c/projects/devjarvis/devjarvis-backend

export SPRING_PROFILES_ACTIVE=local
export DEVJARVIS_DB_PASSWORD='여기에_DB_비밀번호'

./gradlew.bat test
```

패스워드에 `!`, `$`, `@`, `#` 등이 있으면 작은따옴표로 감싼다.

### 7.5 Backend compileJava에서 Jackson 관련 compile error

증상:

```text
cannot find symbol ObjectMapper
package com.fasterxml.jackson.databind does not exist
```

원인:

```text
Spring Boot 4 / Jackson 3 환경에서 Jackson 2 방식 ObjectMapper 의존성/Bean 주입 사용
```

처리 방향:

```text
- OCR client에서 Jackson 2 의존성/Bean 주입 제거
- HttpClient 기반 호출 유지
- 필요한 JSON 생성/파싱은 충돌 없는 방식으로 client 내부 처리
```

### 7.6 Backend contextLoads 실패: InMemoryRateLimiter 기본 생성자 문제

증상:

```text
Caused by: java.lang.NoSuchMethodException: com.taeo.devjarvis.backend.security.ratelimit.InMemoryRateLimiter.<init>()
```

원인:

```text
Spring이 생성자 선택을 명확히 못 잡고 기본 생성자를 찾으려 함
```

해결:

```text
- 주입용 public 생성자에 @Autowired 명시
- 테스트용 Clock 주입 생성자는 package-private 유지
```

### 7.7 Tauri tray 구현 시 Window / WebviewWindow 타입 mismatch

증상:

```text
expected &WebviewWindow, found &Window
expected &Window, found &WebviewWindow
```

원인:

```text
Tauri window close event와 tray command 호출부에서 받는 window 타입이 다름
```

해결:

```text
- WindowEvent용 hide 함수와 WebviewWindow용 hide 함수를 분리
- close event: tauri::Window 기준 처리
- tray menu / command: WebviewWindow 기준 처리
```

### 7.8 Tauri system tray 사용 시 feature 누락

증상:

```text
tray 관련 API 사용 시 compile error
```

해결:

```text
Cargo.toml의 tauri dependency에 tray-icon feature 추가
```

### 7.9 Backend root cause 확인 방법

Gradle 콘솔에는 root cause가 잘리는 경우가 있다. 이때는 JUnit XML 또는 HTML report를 확인한다.

```bash
cd /c/projects/devjarvis/devjarvis-backend

./gradlew.bat test --stacktrace --no-daemon > backend-test.log 2>&1
```

JUnit XML에서 원인 확인:

```bash
python - <<'PY'
from pathlib import Path
import html
import re

xml_files = list(Path("build/test-results/test").glob("TEST-*.xml"))

for xml_file in xml_files:
    text = xml_file.read_text(encoding="utf-8", errors="ignore")
    if "NoSuchMethodException" not in text and "contextLoads" not in text:
        continue

    print(f"\n===== {xml_file} =====\n")

    matches = re.findall(r"<failure[^>]*>(.*?)</failure>", text, flags=re.S)
    for match in matches:
        decoded = html.unescape(match)
        lines = decoded.splitlines()

        for i, line in enumerate(lines):
            if (
                "Error creating bean with name" in line
                or "Failed to instantiate" in line
                or "NoSuchMethodException" in line
                or "UnsatisfiedDependencyException" in line
                or "BeanCreationException" in line
                or "BeanInstantiationException" in line
            ):
                start = max(0, i - 10)
                end = min(len(lines), i + 25)
                print("\n".join(lines[start:end]))
                print("\n---\n")
PY
```

HTML report 경로:

```text
C:\projects\devjarvis\devjarvis-backend\build\reports\tests\test\index.html
```

---

## 8. 다음 작업 후보

현재 구조상 다음 작업은 아래 순서가 적절하다.

```text
1. Desktop → Local Agent 직접 호출 foundation
2. Local Agent OCR provider 추가
3. Local Agent screen analysis provider를 Ollama와 연결
4. NAS AI Server의 local-agent provider routing 정리
5. 프로젝트 RAG indexing pipeline 연결
6. STT / wake word foundation
7. 명령/분석 결과 이력 저장 정책 추가
```

보안 맥시멈 기준으로는 민감한 화면 캡처/OCR/LLM 입력은 가능하면 사용자 PC 내부에서 처리하고, NAS에는 metadata 또는 사용자가 허용한 결과만 저장하는 구조가 바람직하다.
