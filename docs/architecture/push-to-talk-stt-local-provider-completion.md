# Push-to-talk STT Local Provider Completion

## 문제 정의
이전 STT 흐름은 실제 음성 파일을 Local Agent에 전달하는 구조가 불명확했고, 준비되지 않은 STT가 동작하는 것처럼 보일 수 있었습니다.

## 해결 방향
- Desktop은 MediaRecorder로 로컬 음성을 녹음합니다.
- STT 요청은 multipart/form-data로 Local Agent에 전달합니다.
- Local Agent는 placeholder/faster_whisper provider 경계를 제공합니다.
- provider가 준비되지 않으면 명확히 unavailable을 반환합니다.

## 보안 기준
- 음성 원문은 NAS/Backend/AI Server로 전송하지 않습니다.
- provider/model명은 사용자 UI와 health 응답에 노출하지 않습니다.
- STT는 wake word 후 짧은 session 또는 수동 fallback에서만 실행합니다.
