import type { VoiceState } from '../types/jarvisCommand';

type VoiceStatusPanelProps = {
  micAvailable: boolean | null;
  voiceState: VoiceState;
  disabled?: boolean;
  onPushToTalk: () => void;
};

export function VoiceStatusPanel({ micAvailable, voiceState, disabled = false, onPushToTalk }: VoiceStatusPanelProps) {
  const isUnavailable = micAvailable === false || voiceState === 'unavailable';
  const buttonDisabled = disabled || isUnavailable || voiceState === 'processing';

  return (
    <section className={`glass-card voice-card voice-${voiceState}`} aria-label="Voice status">
      <div className="card-heading-row">
        <span className="panel-kicker">Voice</span>
        <span className={`state-chip ${resolveVoiceChipClass(voiceState)}`}>{formatVoiceState(voiceState)}</span>
      </div>
      <div className="voice-meter voice-meter-disabled" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
      <button className="voice-push-button" type="button" disabled={buttonDisabled} onClick={onPushToTalk}>
        Push to talk
      </button>
      <p className="voice-note">
        Push-to-talk foundation only. Audio stays local and remote STT fallback is disabled.
      </p>
      <div className="compact-stat-row">
        <span>Input</span>
        <strong>{formatInputState(micAvailable, voiceState)}</strong>
      </div>
    </section>
  );
}

function resolveVoiceChipClass(state: VoiceState): string {
  if (state === 'processing' || state === 'recording') return 'state-active';
  if (state === 'error' || state === 'unavailable') return 'state-warning';
  return 'state-idle';
}

function formatVoiceState(state: VoiceState): string {
  switch (state) {
    case 'recording':
      return 'Recording';
    case 'processing':
      return 'Processing';
    case 'text_ready':
      return 'Text ready';
    case 'error':
      return 'Failed';
    case 'unavailable':
      return 'Unavailable';
    case 'idle':
      return 'Push to talk';
  }
}

function formatInputState(micAvailable: boolean | null, state: VoiceState): string {
  if (micAvailable === null) return 'Checking device';
  if (micAvailable === false || state === 'unavailable') return 'Text command';
  if (state === 'processing') return 'Local STT check';
  return 'Manual trigger';
}
