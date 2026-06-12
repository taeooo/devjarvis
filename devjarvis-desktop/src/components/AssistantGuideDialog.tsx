type AssistantGuideDialogProps = {
  onClose: () => void;
};

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
            <h2 id="assistant-guide-title">DevJarvis Guide</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close guide">
            Close
          </button>
        </div>

        <div className="guide-body">
          <GuideSection
            title="Command tokens"
            description="Use explicit command tokens so routing does not depend on growing natural-language keyword lists."
            tokens={['/screen', '/project', '/math', '/translate', '/summary', '/log', '/chat']}
          />

          <GuideSection
            title="Project files"
            description="Project analysis starts from manifest metadata. Open detail view and approve only the files that may be read locally."
            tokens={['/project']}
          />

          <GuideSection
            title="Screen flow"
            description="Screen commands require manual window or screen selection. DevJarvis does not auto-capture all monitors."
            tokens={['/screen', '/translate', '/summary', '/math']}
          />

          <section className="guide-section guide-section-muted">
            <h3>Voice</h3>
            <p>Push-to-talk is the only planned capture mode. Wake-word listening is not enabled.</p>
          </section>

          <section className="guide-section guide-section-safe">
            <h3>Security</h3>
            <p>Screen, voice, and approved project file content stay on this PC. Remote fallback is not part of the local MVP.</p>
          </section>
        </div>
      </section>
    </div>
  );
}

type GuideSectionProps = {
  title: string;
  description: string;
  tokens: string[];
};

function GuideSection({ title, description, tokens }: GuideSectionProps) {
  return (
    <section className="guide-section">
      <h3>{title}</h3>
      <p>{description}</p>
      <ul>
        {tokens.map((token) => (
          <li key={token}><code>{token}</code></li>
        ))}
      </ul>
    </section>
  );
}
