import type { VoiceState } from '../types/jarvisCommand';

type VoiceStatusPanelProps = {
  voiceState: VoiceState;
  micAvailable: boolean | null;
};

const voiceStateLabels: Record<VoiceState, string> = {
  unavailable: 'Unavailable',
  idle: 'Idle',
  listening: 'Listening',
  transcribing: 'Transcribing',
  ready: 'Ready',
  error: 'Error',
};

export function VoiceStatusPanel({ voiceState, micAvailable }: VoiceStatusPanelProps) {
  return (
    <section className="glass-card voice-card" aria-label="Voice status">
      <div className="card-heading-row">
        <span className="panel-kicker">Voice</span>
        <span className={`state-chip state-${voiceState}`}>{voiceStateLabels[voiceState]}</span>
      </div>
      <div className="voice-meter" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
      <div className="compact-stat-row">
        <span>Mic</span>
        <strong>{micAvailable === null ? 'Checking' : micAvailable ? 'Available' : 'Unavailable'}</strong>
      </div>
    </section>
  );
}
