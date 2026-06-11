type AssistantGuideDialogProps = {
  onClose: () => void;
};

const commandTokens = [
  { token: '/screen', scope: 'Screen' },
  { token: '/project', scope: 'Project' },
  { token: '/math', scope: 'Math' },
  { token: '/translate', scope: 'Translate' },
  { token: '/summary', scope: 'Summary' },
  { token: '/log', scope: 'Log' },
  { token: '/chat', scope: 'Chat' },
];

export function AssistantGuideDialog({ onClose }: AssistantGuideDialogProps) {
  return (
    <div className="guide-overlay" role="presentation" onClick={onClose}>
      <section
        className="guide-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="assistant-guide-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="guide-header">
          <div>
            <span className="panel-kicker">Guide</span>
            <h2 id="assistant-guide-title">Command guide</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close command guide">
            Close
          </button>
        </div>

        <div className="guide-body">
          <section className="guide-section">
            <h3>Command tokens</h3>
            <p>Use a command token when a request must be routed to a specific local pipeline.</p>
            <ul className="token-list">
              {commandTokens.map((item) => (
                <li key={item.token}>
                  <code>{item.token}</code>
                  <span>{item.scope}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="guide-section guide-section-muted">
            <h3>Voice</h3>
            <p>Push-to-talk is the supported input boundary. Always-on wake word mode is not enabled.</p>
          </section>

          <section className="guide-section guide-section-safe">
            <h3>Security</h3>
            <p>Screen, OCR, project manifest, and audio flows stay on the local runtime boundary by default.</p>
          </section>
        </div>
      </section>
    </div>
  );
}
