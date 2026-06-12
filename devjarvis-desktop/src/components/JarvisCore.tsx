import type { LocalAgentConnectionState } from '../types/jarvisCommand';

type JarvisCoreProps = {
  assistantState: LocalAgentConnectionState;
  isProcessing: boolean;
  systemMessage: string | null;
  errorMessage: string | null;
  commandPhaseLabel: string;
};

export function JarvisCore({
  assistantState,
  isProcessing,
  systemMessage,
  errorMessage,
  commandPhaseLabel,
}: JarvisCoreProps) {
  const coreLabel = resolveCoreLabel(assistantState, isProcessing, Boolean(errorMessage), commandPhaseLabel);
  const helperMessage = errorMessage ?? systemMessage;

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
          {helperMessage && (
            <p className={errorMessage ? 'core-helper core-helper-error' : 'core-helper'}>{helperMessage}</p>
          )}
        </div>
      </div>
    </section>
  );
}

function resolveCoreLabel(
  assistantState: LocalAgentConnectionState,
  isProcessing: boolean,
  hasError: boolean,
  commandPhaseLabel: string,
): string {
  if (isProcessing) {
    return commandPhaseLabel || 'Thinking';
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
