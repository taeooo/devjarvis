# Windows App Build Guide

## 개발 환경 전제

Windows에서 DevJarvis Desktop 앱을 빌드하려면 아래 환경이 준비되어 있어야 합니다.

- Windows 10/11
- Node.js LTS
- npm
- Rust toolchain
- Microsoft Visual Studio Build Tools 또는 Visual Studio C++ build tools
- WebView2 Runtime
- Python 3.11 이상 권장
- Local Agent 가상환경
- Ollama는 Local LLM 분석을 실제로 실행할 때 필요

Tauri build는 Rust/MSVC/WebView2 환경 의존성이 있으므로, `npm run build`가 성공해도 Windows native bundle 단계에서 로컬 빌드 도구 문제로 실패할 수 있습니다.

## Local Agent 실행 방법

```bash
cd /c/projects/devjarvis/devjarvis-local-agent
python -m venv .venv
source .venv/Scripts/activate
python -m pip install -U pip
python -m pip install -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 17997
```

상태 확인:

```bash
curl http://127.0.0.1:17997/health
curl http://127.0.0.1:17997/internal/local-llm/health
```

## Desktop 개발 실행 방법

```bash
cd /c/projects/devjarvis/devjarvis-desktop
npm install
npm run tauri:dev
```

Tauri 없이 web UI만 확인할 때는 아래 명령을 사용할 수 있습니다.

```bash
cd /c/projects/devjarvis/devjarvis-desktop
npm install
npm run dev
```

## Windows 앱 빌드 방법

제출용 Windows 앱 생성은 아래 순서로 실행합니다.

```bash
cd /c/projects/devjarvis/devjarvis-desktop
npm install
npm run build
npm run tauri:build
```

현재 `package.json` 기준 주요 script는 다음과 같습니다.

```text
npm run build        → tsc && vite build
npm run tauri:dev    → tauri dev
npm run tauri:build  → tauri build
```

`tauri.conf.json`의 `beforeBuildCommand`도 `npm run build`로 설정되어 있으므로 `npm run tauri:build` 실행 시 frontend build가 먼저 수행됩니다. 다만 제출 전에는 문제 구분을 위해 `npm run build`를 먼저 단독 실행하는 것을 권장합니다.

## 생성 결과물 위치

Tauri Windows bundle 결과물은 일반적으로 아래 경로에 생성됩니다.

```text
devjarvis-desktop/src-tauri/target/release/
devjarvis-desktop/src-tauri/target/release/bundle/
```

확인 명령:

```bash
cd /c/projects/devjarvis/devjarvis-desktop
find src-tauri/target/release -maxdepth 4 -type f \( -name "*.exe" -o -name "*.msi" \) -print
```

## 제출 시 전달할 파일

Windows 설치 파일이 생성되면 아래 우선순위로 전달합니다.

1. `src-tauri/target/release/bundle/nsis/*.exe`가 있으면 NSIS installer exe 전달
2. `src-tauri/target/release/bundle/msi/*.msi`가 있으면 MSI installer 전달
3. installer가 없고 실행 파일만 필요하면 `src-tauri/target/release/DevJarvis.exe` 전달

제출처가 설치형 앱을 요구하면 `bundle/nsis/*.exe` 또는 `bundle/msi/*.msi`를 우선 전달합니다.

## 빌드 실패 시 대표 확인 항목

### `npm run build` 실패

- `npm install`을 먼저 실행했는지 확인
- `node_modules`가 없는 상태인지 확인
- Node.js 버전이 Vite/React 요구사항과 맞는지 확인
- TypeScript 오류가 실제 코드 오류인지, 의존성 미설치 때문인지 구분

### `npm run tauri:build` 실패

- Rust toolchain 설치 여부 확인
- MSVC C++ build tools 설치 여부 확인
- WebView2 Runtime 설치 여부 확인
- `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json` 경로 확인
- Tauri CLI 버전과 `@tauri-apps/cli` 설치 상태 확인

### Local Agent 연결 실패

- Local Agent가 `127.0.0.1:17997`에서 실행 중인지 확인
- Windows 방화벽 또는 보안 프로그램이 loopback 요청을 막는지 확인
- Desktop 환경변수 `VITE_DEVJARVIS_LOCAL_AGENT_BASE_URL`을 바꾼 적이 있는지 확인

## 제출 전 최소 점검 명령

```bash
cd /c/projects/devjarvis/devjarvis-local-agent
source .venv/Scripts/activate
python -m pytest -q
python -m compileall -q app tests
```

```bash
cd /c/projects/devjarvis/devjarvis-desktop
npm run build
npm run tauri:build
```

## 범위 제한

이번 빌드 정리는 STT/TTS/wake word 고도화를 포함하지 않습니다. 음성 기능은 기존 상태를 유지하고, 제출용 핵심 흐름은 수동 입력/텍스트 입력/화면 분석/프로젝트 분석/Windows 앱 생성 가능성에 맞춥니다.
