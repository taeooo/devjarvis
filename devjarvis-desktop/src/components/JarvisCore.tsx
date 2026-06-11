import type { CommandInput, LocalAgentConnectionState } from '../types/jarvisCommand';

type JarvisCoreProps = {
  assistantState: LocalAgentConnectionState;
  isProcessing: boolean;
  lastCommand: CommandInput | null;
  systemMessage: string | null;
  errorMessage: string | null;
};

export function JarvisCore({ assistantState, isProcessing, lastCommand, systemMessage, errorMessage }: JarvisCoreProps) {
  const coreLabel = resolveCoreLabel(assistantState, isProcessing, Boolean(errorMessage));

  return (
    <section className="jarvis-core-panel" aria-label="Jarvis command core">
      <div className="hud-grid" aria-hidden="true" />
      <div className="core-stage">
        <div className="orb-shell" aria-hidden="true">
          <div className="orb-ring orb-ring-outer" />
          <div className="orb-ring orb-ring-middle" />
          <div className="orb-ring orb-ring-inner" />
          <div className="orb-core">
            <span className="orb-glow" />
          </div>
        </div>

        <div className="core-readout">
          <span className="readout-kicker">AI CORE</span>
          <strong>{coreLabel}</strong>
          <div className={`waveform ${isProcessing ? 'waveform-active' : 'waveform-idle'}`} aria-hidden="true">
            {Array.from({ length: 18 }, (_, index) => (
              <span key={index} style={{ animationDelay: `${index * 70}ms` }} />
            ))}
          </div>
        </div>
      </div>

      <div className="command-readout" aria-live="polite">
        <span>Last Command</span>
        <strong>{lastCommand?.text || 'Waiting for text command'}</strong>
        {(systemMessage || errorMessage) && (
          <p className={errorMessage ? 'readout-error' : 'readout-message'}>{errorMessage ?? systemMessage}</p>
        )}
      </div>
    </section>
  );
}

function resolveCoreLabel(
  assistantState: LocalAgentConnectionState,
  isProcessing: boolean,
  hasError: boolean,
): string {
  if (isProcessing) {
    return 'Thinking';
  }

  if (hasError) {
    return 'Needs attention';
  }

  if (assistantState === 'checking') {
    return 'Checking';
  }

  if (assistantState === 'ready') {
    return 'Ready for text';
  }

  return 'Setup needed';
}
