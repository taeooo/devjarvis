# Runtime Distribution Plan

## 목표
DevJarvis를 일반 사용자에게 배포하려면 앱 설치만으로 모든 모델이 즉시 동작한다고 가정하면 안 됩니다. Local model runtime과 NAS deployable server를 분리하고, 준비되지 않은 기능은 안전하게 비활성화해야 합니다.

## 배포 분리

### 사용자 PC
- Desktop installer
- Local Agent sidecar 또는 local service
- Ollama 감지/설치 안내
- OCR/STT/Wake word provider 감지
- 모델 다운로드/준비 상태 확인

### NAS
- Backend
- DB
- 비민감 API
- 운영/동기화/히스토리 metadata

## 단계별 배포
1. 개발자용 Beta: 수동 Local Agent/Ollama/STT 실행
2. 비공개 테스터용: installer + readiness wizard
3. 일반 사용자용: Local Agent 자동 실행 + 모델 준비 관리 + 트레이 제어권

## 보안 원칙
- 원문 데이터는 사용자 PC 밖으로 보내지 않습니다.
- remote fallback은 기능별로 명시 허용된 비민감 데이터에만 적용합니다.
- 모델/provider/path 같은 내부 정보는 사용자 UI에 직접 노출하지 않습니다.
