# Command Context State Isolation

## 문제 정의

화면 분석/계산 명령 이후 프로젝트 분석 명령을 실행하면 마지막 화면 캡처 상태와 계산 결과가 현재 프로젝트 분석 흐름처럼 보일 수 있었다. 특히 Screen 상태가 `Captured`로 남고, Results 영역에서 이전 screen/math 결과와 현재 project 결과가 명확히 분리되지 않아 사용자가 현재 명령의 실제 컨텍스트를 오해할 가능성이 있었다.

## 왜 이 작업이 필요한지

DevJarvis는 화면 이미지, OCR 텍스트, 프로젝트 manifest, 텍스트 명령을 서로 다른 보안 경계와 UX 흐름으로 다룬다. 프로젝트 분석 명령이 이전 screen/math context를 재사용하는 것처럼 보이면 사용자가 의도하지 않은 화면 정보가 분석에 쓰였다고 오해할 수 있고, 실제 명령 라우팅 문제를 발견하기도 어려워진다.

## 어떤 방향으로 해결했는지

- command router에서 project-only 명령을 screen/math 명령보다 우선 분리하도록 정리했다.
- project-only/text-only 명령 시작 시 화면 캡처 진행 상태를 초기화하여 마지막 `Captured` 상태가 현재 명령 상태처럼 보이지 않게 했다.
- 현재 결과와 이전 결과 history를 Result panel에서 시각적으로 분리했다.
- 프로젝트 분석 명령은 manifest refresh 이후 Local Agent LLM으로 manifest-level 구조 요약을 분석하도록 연결했다.
- 수식/계산 결과는 카드에는 요약만 표시하고, 전문 보기 modal에서 줄 단위로 확인할 수 있게 정리했다.
- Jarvis Core의 큰 상태 문구가 하단 command readout과 겹치지 않도록 위치와 크기를 조정했다.

## 보안상 고려사항

- project analysis context에는 실제 OS absolute path를 포함하지 않는다.
- rootPathAlias를 UI나 Local LLM context에 노출하지 않는다.
- 파일 원문은 Local LLM으로 전달하지 않고 manifest-level 정보만 사용한다.
- 화면 명령이 아닌 경우 screen capture/OCR pipeline을 실행하지 않는다.
- Local OCR/LLM 실패 시 remote 자동 fallback은 추가하지 않았다.

## 현재 한계

- 프로젝트 분석은 아직 manifest-level 구조 분석이다. 실제 파일 내용 기반 RAG나 코드 심층 분석은 별도 설계가 필요하다.
- Result history는 최근 일부만 표시한다. 장기 검색/필터링 가능한 history 저장소는 아직 없다.
- 화면 캡처의 마지막 대상 자체를 별도 history로 관리하는 기능은 아직 없다.

## 다음 확장 방향

- project-only RAG에서 사용자가 승인한 파일만 로컬 인덱싱하는 구조를 추가한다.
- current command context와 result history를 store 단위로 분리해 명령별 상세 추적을 강화한다.
- SymPy 기반 engineering math solver를 Local Agent에 단계적으로 추가한다.
- Local STT/push-to-talk 도입 시 voice command도 동일한 context isolation 규칙을 적용한다.
