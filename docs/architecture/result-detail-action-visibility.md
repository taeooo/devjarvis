# Result Detail Action Visibility

## 문제 정의

Result card의 상세 버튼이 카드 하단에 배치되어 긴 요약이나 좁은 패널에서는 버튼이 사라진 것처럼 보일 수 있었다.

## 왜 이 작업이 필요한지

DevJarvis는 card에는 요약만 표시하고 전문은 modal에서 확인하는 UX를 전제로 한다. 상세 버튼 접근성이 불안정하면 결과 전문을 확인할 수 없고, 분석 결과가 짧게 잘린 것처럼 보인다.

## 어떤 방향으로 해결했는지

`전문 보기` action을 result card top line으로 이동했다. 버튼은 시간 정보 옆에 항상 표시되며, 현재 결과와 history 결과 모두 동일하게 접근할 수 있다. 상세 modal은 `document.body` portal을 사용해 Result panel 내부 scroll/height에 갇히지 않도록 한다.

## 보안상 고려사항

이번 변경은 UI 렌더링 경계만 수정한다. 화면 이미지, OCR 원문, 음성 원문, 파일 원문 전송 경로는 변경하지 않는다.

## 현재 한계

Result panel 자체가 매우 좁은 경우 버튼 텍스트가 시각적으로 압축될 수 있다. 그래도 버튼 접근성은 유지된다.

## 다음 확장 방향

- keyboard focus trap 적용
- result detail modal section navigation 추가
- 결과 type별 detail renderer 분리
