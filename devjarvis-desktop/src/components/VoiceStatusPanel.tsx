type VoiceStatusPanelProps = {
  micAvailable: boolean | null;
};

export function VoiceStatusPanel({ micAvailable }: VoiceStatusPanelProps) {
  return (
    <section className="glass-card voice-card voice-card-disabled" aria-label="Voice status">
      <div className="card-heading-row">
        <span className="panel-kicker">Voice</span>
        <span className="state-chip state-idle">Coming soon</span>
      </div>
      <div className="voice-meter voice-meter-disabled" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
      <p className="voice-note">
        지금은 채팅 입력으로 명령할 수 있습니다. 음성 명령은 이후 버전에서 지원 예정입니다.
      </p>
      <div className="compact-stat-row">
        <span>Input</span>
        <strong>{micAvailable === null ? 'Checking device' : 'Text command'}</strong>
      </div>
    </section>
  );
}
