# Wake 호출 안정화와 CosyVoice2 reference 진단

## 문제 정의

`헤이 자비스` 호출 대기 상태에서 Local Agent 로그에 `/internal/local-stt/transcribe` 요청이 과도하게 반복되고, 실제 호출어는 감지되지 않는 문제가 있었다. 또한 CosyVoice2 setup script를 실행하면 repo와 모델 디렉터리는 준비되지만 남성 reference WAV와 transcript TXT가 없으면 Local TTS가 ready가 될 수 없는데, UI와 health 메시지가 이 상태를 충분히 구분하지 못했다.

## 왜 필요한가

DevJarvis는 사용자 PC에서만 음성 입력과 음성 출력을 처리해야 한다. wake detector가 아직 전용 모델로 분리되지 않은 현재 단계에서는 Local STT를 wake 감지에 임시로 사용하므로, 무음 상태에서도 STT 요청이 반복되면 CPU 사용량과 로그량이 불필요하게 증가한다. 또한 고품질 TTS는 reference 음성 파일이 있어야 동작하므로, repo/model 설치 완료와 voice ready 상태를 분리해 안내해야 한다.

## 해결 방향

- Desktop wake monitor를 continuous microphone stream 기반으로 유지하되, 호출어 STT 요청 간격을 늘렸다.
- 마이크 activity meter를 추가해 무음 또는 입력이 작은 구간에서는 STT 요청을 건너뛴다.
- 이전 wake STT 요청이 끝나기 전에는 다음 요청을 보내지 않는다.
- Voice 패널에 wake 진단 메시지를 표시한다.
- wake phrase matching을 완화해 흔한 STT 오인식을 더 넓게 흡수한다.
- CosyVoice2 runtime/model만 준비되고 reference WAV/TXT가 없을 때 generic placeholder가 아니라 reference 누락 상태를 알 수 있게 했다.
- setup script는 reference voice가 수동 준비 대상임을 명확히 안내하고 transcript template을 생성한다.

## 런타임 정책

현재 wake는 임시로 Local STT를 사용한다. 최종 구조에서는 wake word detector를 별도 provider로 분리하고, wake가 감지된 뒤에만 STT command session을 열어야 한다.

```text
현재 보완 구조:
마이크 stream → activity gate → 4~5초 간격 wake STT → 호출어 감지 → command STT

목표 구조:
마이크 stream → 전용 wake word detector → 호출어 감지 → command STT
```

## CosyVoice2 reference 파일

CosyVoice2 고품질 남성 음성은 아래 파일이 모두 있어야 ready가 된다.

```text
C:\devjarvis-runtime\tts\cosyvoice2\CosyVoice
C:\devjarvis-runtime\tts\cosyvoice2\models\CosyVoice2-0.5B
C:\devjarvis-runtime\tts\cosyvoice2\voices\jarvis-male-reference.wav
C:\devjarvis-runtime\tts\cosyvoice2\voices\jarvis-male-reference.txt
```

`jarvis-male-reference.wav`는 사용 권리가 명확한 남성 음성 파일이어야 하며, `jarvis-male-reference.txt`에는 WAV에서 실제로 말한 문장을 그대로 적어야 한다.

## 보안 고려사항

- wake audio는 Local Agent loopback으로만 전달한다.
- wake audio 원문은 저장하지 않는다.
- wake audio 원문은 로그에 남기지 않는다.
- TTS 텍스트와 reference path는 NAS Backend, NAS FastAPI, 외부 API로 전송하지 않는다.
- provider/model/path는 사용자 UI에 직접 노출하지 않고 상태만 일반화해 표시한다.
