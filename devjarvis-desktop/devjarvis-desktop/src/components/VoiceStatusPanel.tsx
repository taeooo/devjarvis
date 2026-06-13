import type { VoiceState } from '../types/jarvisCommand';

type VoiceStatusPanelProps = {
  micAvailable: boolean | null;
  voiceState: VoiceState;
  disabled?: boolean;
  pendingScreenCommand?: boolean;
  wakeStatusMessage?: string;
  hasKoreanVoice?: boolean;
  onManualVoiceInput: () => void;
  onSelectPendingScreen?: () => void;
};

export function VoiceStatusPanel({
  micAvailable,
  voiceState,
  disabled = false,
  pendingScreenCommand = false,
  wakeStatusMessage = '헤이 자비스 대기',
  hasKoreanVoice = true,
  onManualVoiceInput,
  onSelectPendingScreen,
}: VoiceStatusPanelProps) {
  const isUnavailable = micAvailable === false || voiceState === 'unavailable';
  const buttonDisabled = disabled || isUnavailable || voiceState === 'processing' || voiceState === 'recording' || voiceState === 'speaking';
  const canSelectPendingScreen = pendingScreenCommand && Boolean(onSelectPendingScreen) && !disabled;

  return (
    <section className={`glass-card voice-card voice-${voiceState}`} aria-label="Voice status">
      <div className="card-heading-row">
        <span className="panel-kicker">Voice</span>
        <span className={`state-chip ${resolveVoiceChipClass(voiceState, pendingScreenCommand)}`}>{formatVoiceState(voiceState, pendingScreenCommand)}</span>
      </div>
      <div className="voice-meter voice-meter-disabled" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
      {pendingScreenCommand ? (
        <button className="voice-push-button voice-screen-select-button" type="button" disabled={!canSelectPendingScreen} onClick={onSelectPendingScreen}>
          화면 선택
        </button>
      ) : (
        <button className="voice-push-button" type="button" disabled={buttonDisabled} onClick={onManualVoiceInput}>
          수동 음성 입력
        </button>
      )}
      <p className="voice-note">
        {pendingScreenCommand
          ? '음성 명령을 인식했습니다. 화면 선택 버튼을 눌러 공유 창을 열어주세요.'
          : '마이크는 로컬에서만 사용됩니다. “헤이 자비스” 호출을 감지하면 짧은 음성 명령만 인식합니다.'}
      </p>
      {!hasKoreanVoice && (
        <p className="voice-note voice-note-warning">
          Windows 한국어 음성이 없어 음성 응답 품질이 낮을 수 있습니다. Windows 언어/음성에서 한국어 음성을 설치해주세요.
        </p>
      )}
      <div className="compact-stat-row">
        <span>Input</span>
        <strong>{formatInputState(micAvailable, voiceState, pendingScreenCommand, wakeStatusMessage)}</strong>
      </div>
    </section>
  );
}

function resolveVoiceChipClass(state: VoiceState, pendingScreenCommand: boolean): string {
  if (pendingScreenCommand) return 'state-active';
  if (state === 'processing' || state === 'recording' || state === 'speaking') return 'state-active';
  if (state === 'error' || state === 'unavailable') return 'state-warning';
  return 'state-idle';
}

function formatVoiceState(state: VoiceState, pendingScreenCommand: boolean): string {
  if (pendingScreenCommand) return '화면 선택 필요';

  switch (state) {
    case 'recording':
      return '듣는 중';
    case 'processing':
      return '명령 인식 중';
    case 'speaking':
      return '응답 중';
    case 'text_ready':
      return '명령 인식됨';
    case 'error':
      return '확인 필요';
    case 'unavailable':
      return '마이크 없음';
    case 'idle':
      return '호출 대기';
  }
}

function formatInputState(
  micAvailable: boolean | null,
  state: VoiceState,
  pendingScreenCommand: boolean,
  wakeStatusMessage: string,
): string {
  if (pendingScreenCommand) return '화면 선택 대기';
  if (micAvailable === null) return '장치 확인 중';
  if (micAvailable === false || state === 'unavailable') return '텍스트 입력';
  if (state === 'recording') return '말씀해주세요';
  if (state === 'processing') return '음성 인식 중';
  if (state === 'speaking') return '음성 응답 중';
  return wakeStatusMessage;
}
