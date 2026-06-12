# Screen Diagnosis with Project Index

## 문제 정의

화면 OCR만으로는 에러 원인을 안정적으로 찾기 어렵다. 화면에 API path, component name, stack trace 일부만 보이는 경우에도 프로젝트 전체 흐름을 기반으로 관련 파일과 모듈을 추적해야 한다.

## 왜 이 작업이 필요한지

DevJarvis의 핵심 사용 흐름은 “이 화면 왜 그런거야?”이다. 이 기능은 화면 분석과 프로젝트 분석이 분리되어 있으면 품질이 낮다. 화면 OCR 결과와 로컬 프로젝트 인덱스를 결합해야 Frontend→API→Backend→Local Agent→설정 파일 흐름을 따라갈 수 있다.

## 어떤 방향으로 해결했는지

화면 진단 명령에서 선택된 프로젝트가 있으면 manifest뿐 아니라 Project Deep Index도 준비한다. Local LLM context에는 모듈 목록, flow file, endpoint 후보, 화면 OCR signal을 함께 넣는다. 파일 원문 전체가 아니라 redaction 된 excerpt와 구조 정보만 제한된 budget 안에서 사용한다.

## 보안상 고려사항

- 화면 이미지는 Local OCR에만 전달한다.
- OCR 원문과 프로젝트 파일 원문은 NAS/AI Server로 전송하지 않는다.
- Local Agent context에는 absolute path/rootPathAlias를 포함하지 않는다.
- 화면 진단은 사용자가 선택한 화면/창 캡처로만 시작한다.

## 현재 한계

- OCR text가 부정확하면 관련 파일 ranking이 흔들릴 수 있다.
- Project Deep Index는 현재 heuristic 기반이며, 완전한 call graph를 만들지는 않는다.

## 다음 확장 방향

- OCR signal extractor 강화
- endpoint/component/class/function name 기반 ranking 추가
- selected error screen과 index file excerpts를 함께 쓰는 multi-pass local reasoning 추가
