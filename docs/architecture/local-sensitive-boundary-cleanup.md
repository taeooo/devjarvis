# Local Sensitive Boundary Cleanup

## 문제 정의

DevJarvis Desktop은 화면 캡처, OCR, 로컬 LLM 분석처럼 사용자 PC의 민감한 실행 컨텍스트를 다룬다. Local OCR First 구조와 Local Assistant readiness gate는 적용되어 있었지만, 일부 Desktop 타입과 클라이언트 함수에는 이전 Backend screen OCR/analysis 경로와 provider/model/intent 계열 내부 필드가 남아 있었다.

또한 Tauri project scan 응답에는 UI에서 사용하지 않는 실제 OS absolute path 표시용 필드가 포함되어 있었다. 이 값은 화면에 렌더링되거나 Backend payload로 전달되지는 않았지만, renderer boundary로 넘어오는 데이터 자체를 최소화하는 것이 더 안전하다.

## 왜 이 작업이 필요한지

사용자 화면 이미지, OCR text, 로컬 모델 구성, 실제 파일 경로는 민감도가 높다. 현재 UI에서 노출되지 않더라도 사용하지 않는 remote OCR 함수나 absolute path 필드가 남아 있으면 향후 수정 중 실수로 다시 사용될 수 있다.

따라서 Desktop boundary에서는 다음 원칙을 강화해야 한다.

- 화면 OCR/analysis는 Local Agent 경로만 사용한다.
- Desktop Backend client는 project manifest 등록 등 서버에 필요한 기능만 담당한다.
- renderer로 전달되는 project scan 결과에는 실제 OS absolute path를 포함하지 않는다.
- provider/model/router/analysis provider 같은 내부 정보는 Desktop state/type에서 최소화한다.
- 로컬 테스트 캐시와 tooling cache는 git 추적 대상에서 제외한다.

## 어떤 방향으로 해결했는지

- `devjarvis-desktop/src/api/backendClient.ts`에서 Backend screen OCR/analysis 호출 함수를 제거했다.
- `ScreenAnalysisRequest` 타입을 제거하고, Local Agent 분석 결과를 표현하는 `ScreenAnalysisResponse`에서 provider/intent 필드를 제거했다.
- `CommandResultMetadata`와 `ScreenContextSnapshot`에서 provider/model/OCR provider/analysis provider 계열 잔여 필드를 제거했다.
- `devjarvis-desktop/src-tauri/src/main.rs`의 `ProjectScanResult`에서 `root_path_display`를 제거했다.
- `devjarvis-desktop/src/types/projectScanner.ts`의 `rootPathDisplay`를 제거했다.
- `.gitignore`에 `.pytest_cache/`, `.mypy_cache/`, `.ruff_cache/`를 추가했다.

## 보안상 고려사항

- Local OCR 실패 시 remote OCR로 자동 fallback하는 경로를 Desktop 코드에서 되살리지 않는다.
- Backend project API에는 `rootPathAlias`와 manifest 상대 경로만 전달하고, 실제 OS absolute path는 전달하지 않는다.
- Desktop UI에는 provider, model, intent, OCR provider, analysis provider, internal status, absolute path, rootPathAlias를 표시하지 않는다.
- Local Agent API 요청에는 intent가 남아 있지만, 이는 로컬 모델 라우팅을 위한 loopback-only 내부 입력이다. 사용자 화면이나 Backend payload로 노출하지 않는다.
- OCR 원문과 LLM 입력은 로그에 남기지 않는 기존 정책을 유지한다.

## 현재 한계

- Desktop은 사용자가 선택한 project root 자체를 로컬 state에는 보유한다. 이는 Tauri file dialog와 local scan 실행을 위해 필요하지만, 서버 payload에는 포함하지 않는다.
- Local Agent diagnostic endpoint는 아직 별도로 분리하지 않았다.
- Backend와 AI Server에는 과거 screen OCR/analysis foundation이 남아 있을 수 있다. Desktop에서 호출하지 않는 상태지만, 서버 측 API 정리는 별도 작업으로 다루는 것이 안전하다.

## 다음 확장 방향

- Backend/AI Server의 remote screen OCR/analysis endpoint를 운영 정책에 맞게 비활성화하거나 관리자/개발 전용으로 격리한다.
- Local Agent diagnostic endpoint를 별도 opt-in debug 모드로 분리한다.
- Desktop project scan 결과와 Backend manifest payload에 대한 contract test를 추가한다.
- 파일 스캔 제외 정책을 문서화하고, secret pattern과 generated/tooling pattern을 테스트로 고정한다.
