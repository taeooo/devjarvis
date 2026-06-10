import type { CommandResult } from '../types/jarvisCommand';

const MAX_RENDERED_RESULTS = 3;

type CommandResultPanelProps = {
  results: CommandResult[];
};

export function CommandResultPanel({ results }: CommandResultPanelProps) {
  return (
    <aside className="result-panel" aria-label="Command results">
      <div className="panel-heading">
        <span>Results</span>
        <strong>{results.length > 0 ? 'Ready' : 'Idle'}</strong>
      </div>

      <div className="result-list">
        {results.length === 0 ? (
          <div className="empty-result">Waiting for command</div>
        ) : (
          results.slice(0, MAX_RENDERED_RESULTS).map((result) => (
            <article className={`result-card result-${result.status}`} key={result.id}>
              <div className="result-card-topline">
                <span>{formatResultStatus(result.status)}</span>
                <time dateTime={result.completedAt ?? result.createdAt}>
                  {formatResultTime(result.completedAt ?? result.createdAt)}
                </time>
              </div>
              <strong>{result.metadata?.analysisTitle ?? result.title}</strong>
              <p>{result.metadata?.analysisPreview ?? result.summary}</p>
              {result.metadata?.analysisActionItems && result.metadata.analysisActionItems.length > 0 && (
                <ul className="result-action-list">
                  {result.metadata.analysisActionItems.slice(0, 2).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
              {result.nextStep && result.status === 'failed' && <small>{result.nextStep}</small>}
            </article>
          ))
        )}
      </div>
    </aside>
  );
}

function formatResultStatus(status: CommandResult['status']): string {
  if (status === 'processing') {
    return 'Processing';
  }

  if (status === 'failed') {
    return 'Failed';
  }

  return 'Completed';
}

function formatResultTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '--:--';
  }

  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
