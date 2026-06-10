# DevJarvis Desktop

Tauri + React + TypeScript 기반 Desktop App foundation입니다.

이번 단계의 범위는 프로젝트 폴더 선택, 로컬 파일 manifest 생성, Backend API 등록입니다.
실제 파일 내용과 OS 절대경로는 Backend로 전송하지 않습니다.

## Local development

```bash
cd /c/projects/devjarvis/devjarvis-desktop
cp .env.example .env
npm install
npm run tauri:dev
```

## Backend URL

기본 Backend URL은 아래 값입니다.

```text
http://localhost:8080
```

변경이 필요하면 `.env`에 아래 값을 설정합니다.

```text
VITE_DEVJARVIS_BACKEND_BASE_URL=http://localhost:8080
```

## Security notes

- Desktop은 DB에 직접 접근하지 않고 Backend API만 호출합니다.
- Backend로 전송하는 값은 파일 metadata와 project-root-relative path입니다.
- 실제 OS absolute path는 화면 표시용으로만 사용하고 Backend payload에는 넣지 않습니다.
- `.env`, `.env.*`, `*.pem`, `*.key`, `*.jks`, `*.p12`, `secret`, `password`, `token` 포함 파일은 기본 제외합니다.
- 제외 파일은 SHA-256 계산을 하지 않아 민감 파일 내용을 읽지 않습니다.
- 디렉터리 선택은 Tauri dialog plugin 권한만 허용합니다.

## Build

Windows와 macOS 모두 Tauri native bundle 대상입니다.
일반적으로 Windows bundle은 Windows에서, macOS bundle은 macOS에서 빌드합니다.

```bash
npm run tauri:build
```
