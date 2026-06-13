import type { VoiceState } from '../types/jarvisCommand';

type VoiceStatusPanelProps = {
  micAvailable: boolean | null;
  voiceState: VoiceState;
  disabled?: boolean;
  onPushToTalkStart: () => void;
  onPushToTalkEnd: () => void;
};

export function VoiceStatusPanel({
  micAvailable,
  voiceState,
  disabled = false,
  onPushToTalkStart,
  onPushToTalkEnd,
}: VoiceStatusPanelProps) {
  const isUnavailable = micAvailable === false || voiceState === 'unavailable';
  const isRecording = voiceState === 'recording' || voiceState === 'listening';
  const isPaused = voiceState === 'mic_paused';
  const buttonDisabled = disabled || isUnavailable || isPaused || voiceState === 'processing';

  return (
    <section className={`glass-card voice-card voice-${voiceState}`} aria-label="Voice status">
      <div className="card-heading-row">
        <span className="panel-kicker">Voice</span>
        <span className={`state-chip ${resolveVoiceChipClass(voiceState)}`}>{formatVoiceState(voiceState, micAvailable)}</span>
      </div>
      <div className="voice-meter voice-meter-disabled" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
      <p className="voice-note">
        마이크는 로컬 호출어 감지와 짧은 음성 명령에만 사용됩니다. 일시 중지는 트레이 메뉴에서 제어합니다.
      </p>
      <button
        className="voice-push-button"
        type="button"
        disabled={buttonDisabled}
        aria-pressed={isRecording}
        onPointerDown={(event) => {
          event.preventDefault();
          onPushToTalkStart();
        }}
        onPointerUp={(event) => {
          event.preventDefault();
          onPushToTalkEnd();
        }}
        onPointerCancel={onPushToTalkEnd}
        onPointerLeave={() => {
          if (isRecording) onPushToTalkEnd();
        }}
      >
        {isRecording ? '말 끝내기' : '수동 음성 입력'}
      </button>
      <div className="compact-stat-row">
        <span>Input</span>
        <strong>{formatInputState(micAvailable, voiceState)}</strong>
      </div>
    </section>
  );
}

function resolveVoiceChipClass(state: VoiceState): string {
  if (state === 'processing' || state === 'recording' || state === 'listening') return 'state-active';
  if (state === 'error' || state === 'unavailable' || state === 'mic_paused') return 'state-warning';
  return 'state-idle';
}

function formatVoiceState(state: VoiceState, micAvailable: boolean | null): string {
  if (micAvailable === null) return '마이크 확인 중';
  switch (state) {
    case 'wake_ready':
    case 'idle':
      return '호출 대기 중';
    case 'recording':
    case 'listening':
      return '듣는 중';
    case 'processing':
      return '처리 중';
    case 'text_ready':
      return '명령 인식됨';
    case 'mic_paused':
      return '마이크 일시 중지';
    case 'error':
      return '확인 필요';
    case 'unavailable':
      return '마이크 없음';
  }
}

function formatInputState(micAvailable: boolean | null, state: VoiceState): string {
  if (micAvailable === null) return '장치 확인 중';
  if (micAvailable === false || state === 'unavailable') return '텍스트 입력';
  if (state === 'mic_paused') return '트레이에서 재개';
  if (state === 'recording' || state === 'listening') return '로컬 녹음 중';
  if (state === 'processing') return '로컬 STT';
  return '헤이 자비스 대기';
}
