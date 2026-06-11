# Command Context State Isolation

## 문제 정의

화면 분석 또는 화면 계산 명령을 실행한 뒤 프로젝트 분석 명령을 실행하면, 이전 화면 캡처 상태와 계산 결과가 현재 프로젝트 분석 흐름처럼 보일 수 있었다. 특히 `Screen: Captured`, 이전 math 결과 카드, project context 표시가 동시에 남아 사용자가 현재 명령에 어떤 context가 사용되는지 판단하기 어려웠다.

## 왜 이 작업이 필요한지

DevJarvis는 screen/OCR, project manifest, text command가 서로 다른 보안 경계와 UX 의미를 가진다. 프로젝트 분석 명령에서 이전 screen/math 상태가 섞여 보이면 사용자는 화면 이미지나 OCR 원문이 프로젝트 분석에 재사용됐다고 오해할 수 있고, 실제 문제 원인을 확인할 때도 현재 결과와 이전 히스토리를 구분하기 어렵다.

## 어떤 방향으로 해결했는지

- command router에서 project-only 명령을 screen/math 명령보다 명확히 분리했다.
- project-only/text-only 명령 시작 시 현재 screen capture/OCR/math 진행 상태를 초기화한다.
- 화면 캡처 결과는 현재 명령 상태가 아니라 이전 결과 히스토리에서 확인하도록 Result panel을 Current/History로 구분했다.
- 프로젝트 분석은 화면 pipeline을 타지 않고 project manifest summary만 Local Agent LLM으로 전달한다.
- 긴 계산 결과는 카드에 모두 밀어 넣지 않고 detail modal에서 줄 단위로 확인하도록 정리했다.
- JarvisCore의 단계 문구가 하단 readout과 겹치지 않도록 위치와 크기를 조정했다.

## 보안상 고려사항

- project analysis용 Local LLM context에는 실제 OS absolute path와 rootPathAlias를 포함하지 않는다.
- 파일 원문은 Local LLM으로 전달하지 않고 manifest count, language, extension, exclusion reason 수준의 요약만 전달한다.
- screen 명령이 아닌 경우 화면 캡처/OCR pipeline을 호출하지 않는다.
- Local OCR/Local LLM 실패 시 remote fallback을 추가하지 않았다.
- provider/model/intent 같은 내부 구현 정보는 UI의 주요 상태 문구로 노출하지 않는다.

## 현재 한계

- project manifest summary 기반 분석이므로 실제 파일 내용 기반 원인 분석은 아직 수행하지 않는다.
- project RAG와 파일 snippet retrieval은 아직 별도 설계가 필요하다.
- general text command는 현재 안정화 범위에서는 queue/notify 수준이며, 전체 chat assistant 응답은 별도 단계에서 확장해야 한다.

## 다음 확장 방향

- 파일 원문을 직접 업로드하지 않는 local-only snippet retrieval 정책 설계
- project manifest cache와 현재 명령 context id 분리
- screen result history를 별도 viewer로 확장
- engineering math solver를 SymPy 기반 local-only pipeline으로 분리
