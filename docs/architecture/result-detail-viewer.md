# Result Detail Viewer

## 문제 정의

결과 카드가 compact UI 안에서 3줄 preview만 보여주기 때문에 화면 번역, 요약, 분석 결과의 전문을 확인할 수 없었다. 특히 Local LLM이 긴 번역문이나 상세 분석을 반환하는 경우 사용자는 성공 여부를 확인하기 어렵고, 결과 카드에 축약된 preview만 남아 실제 작업 결과를 재사용하기 어려웠다.

## 왜 이 작업이 필요한지

DevJarvis Desktop은 불필요한 스크롤 없이 compact하게 유지해야 하지만, 결과 전문 확인은 사용성 측면에서 필수다. 결과 패널 자체를 길게 늘리면 Desktop 화면이 복잡해지므로, compact preview와 전문 확인 UX를 분리해야 한다.

## 어떤 방향으로 해결했는지

결과 카드는 기존처럼 짧은 preview를 유지하고, 각 결과 카드에 `전문 보기` 버튼을 추가했다. 버튼을 누르면 modal dialog로 결과의 요약, 상세 내용, 조치 항목, 원 요청을 확인할 수 있다. 화면 번역/분석 결과는 `analysisSummary`, `analysisDetail`, `analysisActionItems` metadata로 보관해 카드 preview와 전문 표시를 분리했다.

Local Agent의 Ollama 응답 parser도 보강했다. 모델이 `<think>...</think>` 블록이나 설명 문장과 함께 JSON을 반환해도 첫 번째 JSON object를 추출해 `summary`, `detail`, `actionItems`로 매핑한다. 이를 통해 결과 카드에 JSON 원문이 노출되는 상황을 줄였다.

## 보안상 고려사항

- 결과 상세 modal은 provider, model, router, intent 같은 내부 구현 정보를 표시하지 않는다.
- absolute path, rootPathAlias, Local Agent endpoint 같은 내부 정보는 표시하지 않는다.
- modal은 이미 Desktop state에 있는 결과만 보여주며, 전문 확인을 위해 remote API를 다시 호출하지 않는다.
- 화면 이미지나 OCR 원문 전체를 modal에 직접 표시하지 않는다.

## 현재 한계

- 결과 전문은 현재 세션의 Desktop memory에 있는 결과만 확인할 수 있다.
- 앱을 재시작하면 이전 결과 전문은 복구되지 않는다.
- 긴 결과를 파일로 저장하거나 복사하는 기능은 아직 없다.
- LLM이 JSON 형식을 크게 벗어나면 parser는 일반 텍스트 fallback을 사용한다.

## 다음 확장 방향

- 결과 전문 복사 버튼 추가
- 결과를 markdown 또는 txt로 내보내기
- 결과 history persistence 추가
- screen translation / project analysis / log analysis 별 전용 상세 layout 추가
- Local Agent 응답 format contract 강화
