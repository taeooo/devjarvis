# 2026-06-10 - Backend Project Foundation

## 작업 목적
DevJarvis Backend의 첫 번째 MVP 기능으로 프로젝트 등록/조회 API 기반을 구성한다.

## 포함 범위
- Spring Boot local/k8s profile datasource 설정
- Security 기본 설정
- CORS 기본 설정
- 공통 API 응답 포맷
- 공통 예외 처리
- System health API
- Project Entity/Repository/Service/Controller
- dev_projects DDL

## DB 접속 구조

### 로컬 Windows 실행
```text
jdbc:postgresql://192.168.0.10:31433/devjarvis
```

### NAS k3s 배포 실행
```text
jdbc:postgresql://devjarvis-postgres:5432/devjarvis
```

## 확인 명령어

### Backend 실행
```powershell
cd C:\projects\devjarvis\devjarvis-backend
$env:DEVJARVIS_DB_PASSWORD = '실제_DB_비밀번호'
.\gradlew.bat bootRun --args="--spring.profiles.active=local"
```

### Health 확인
```powershell
curl http://localhost:8080/api/system/health
curl http://localhost:8080/actuator/health
```

### 프로젝트 등록 테스트
```powershell
$body = @{
  name = "devjarvis"
  rootPathAlias = "C:\\projects\\devjarvis"
  description = "Developer troubleshooting assistant MVP"
} | ConvertTo-Json

Invoke-RestMethod `
  -Method Post `
  -Uri http://localhost:8080/api/projects `
  -ContentType "application/json" `
  -Body $body
```

### 프로젝트 목록 조회
```powershell
Invoke-RestMethod -Method Get -Uri http://localhost:8080/api/projects
```

## 적용 전 주의
`dev_projects` 테이블을 먼저 생성해야 Project API가 정상 동작한다.

## 이번 작업 브랜치
```text
feature/backend-project-foundation
```

## 커밋 메시지
```text
feat: add backend project foundation
```
