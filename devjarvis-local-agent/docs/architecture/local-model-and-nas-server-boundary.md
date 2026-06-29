# Local Model and NAS Server Boundary

## 문제 정의
DevJarvis는 Desktop, Local Agent, Backend, FastAPI 서버, NAS 배포 서버가 함께 쓰이는 구조입니다. 이때 `FastAPI 서버`라는 이름만 보고 모든 서버를 NAS에 올리면 화면 이미지, OCR 원문, 음성 원문, 프로젝트 파일 원문이 외부 서버로 이동할 위험이 있습니다.

## 왜 이 작업이 필요한지
- 실제 모델 추론과 민감 원문 처리는 사용자 PC에서 끝나야 합니다.
- NAS는 배포와 운영 편의성을 위한 서버 경계이지, 사용자 화면/음성/프로젝트 원문을 수집하는 위치가 아닙니다.
- Local Agent도 FastAPI 기반이지만 NAS 배포 대상이 아니라 사용자 PC loopback runtime입니다.

## 어떤 방향으로 해결하는지

### 사용자 PC에서 처리
- DevJarvis Desktop
- DevJarvis Local Agent
- Ollama
- Local OCR
- Local STT
- Wake word detector
- 화면 이미지
- OCR 원문
- 음성 원문
- 프로젝트 파일 원문 분석

### NAS에 배포 가능
- Backend
- PostgreSQL
- Infra
- 비민감 FastAPI 서버
- 설정/히스토리/manifest metadata 저장

## 보안 기준
- Local Agent는 `127.0.0.1` loopback only를 유지합니다.
- 화면 이미지, OCR 원문, 음성 원문, 프로젝트 파일 원문은 NAS/Backend/AI Server로 보내지 않습니다.
- NAS는 민감 원문이 제거된 metadata, 설정, 동기화, 운영 API만 담당합니다.

## 현재 한계
- 설치형 배포에서는 Local Agent를 sidecar 또는 local service로 자동 실행하는 작업이 필요합니다.
- NAS 배포용 FastAPI 서버와 Local Agent의 역할을 코드/문서에서 계속 분리해야 합니다.
