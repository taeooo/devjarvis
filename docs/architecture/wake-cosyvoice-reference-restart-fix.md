# Wake monitor 재시작 및 CosyVoice2 reference 적용 보강

## 문제 정의

`헤이 자비스` 호출 대기 중 STT 요청이 과도하게 반복되고, 한 번 호출한 뒤 다음 wake가 잘 감지되지 않는 문제가 있었다. 또한 CosyVoice2 repo/model과 reference 파일이 준비되어도 실제 합성에서 reference 음성이 적용되지 않아 OS 기본 음성 fallback처럼 들릴 수 있었다.

## 왜 필요한가

DevJarvis의 음성 UX는 사용자가 버튼을 누르지 않고 자연스럽게 호출하는 흐름을 목표로 한다. wake 감지가 불안정하거나 호출 대기 중 API가 과도하게 반복되면 로컬 PC 자원 사용량이 커지고 사용자는 앱이 오작동한다고 느낀다. TTS 또한 reference voice가 실제로 적용되지 않으면 Jarvis형 경험과 멀어진다.

## 해결 방향

- wake STT 호출 간격을 늘리고 입력 activity gate를 강화한다.
- wake 감지 후 monitor를 잠시 정지하고 명령 수집이 끝난 뒤 명시적으로 재시작한다.
- CosyVoice2는 공식 zero-shot 흐름에 맞게 `CosyVoice2` class와 `load_wav(..., 16000)`를 사용한다.
- reference transcript는 CMD 환경변수로 한 줄 주입하지 않고 UTF-8 txt 파일을 Local Agent Python 프로세스에서 직접 읽는다.
- CosyVoice2 reference WAV는 mono/16kHz/적정 길이인지 health 단계에서 진단한다.
- 간단한 인사 응답은 형식적인 분석 문장 대신 대화형 응답으로 처리한다.

## 보안 경계

음성 원문, reference voice, TTS text는 사용자 PC의 Local Agent loopback에서만 처리한다. NAS Backend, NAS FastAPI, 외부 API로 전송하지 않는다. reference voice는 사용 권리와 재배포 권한이 명확한 파일만 사용해야 한다.
