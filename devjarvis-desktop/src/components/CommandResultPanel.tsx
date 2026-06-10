import type { CommandResult } from '../types/jarvisCommand';

const MAX_RENDERED_RESULTS = 4;

type CommandResultPanelProps = {
  results: CommandResult[];
};

export function CommandResultPanel({ results }: CommandResultPanelProps) {
  return (
    <aside className="result-panel" aria-label="Command results">
      <div className="panel-heading">
        <span>Results</span>
        <strong>{results.length > 0 ? 'Stored' : 'Ready'}</strong>
      </div>

      <div className="result-list">
        {results.length === 0 ? (
          <div className="empty-result">No results yet</div>
        ) : (
          results.slice(0, MAX_RENDERED_RESULTS).map((result) => (
            <article className={`result-card result-${result.status}`} key={result.id}>
              <div className="result-card-topline">
                <span>{formatResultStatus(result.status)}</span>
                <time dateTime={result.completedAt ?? result.createdAt}>
                  {formatResultTime(result.completedAt ?? result.createdAt)}
                </time>
              </div>
              <strong>{result.title}</strong>
              <p>{result.summary}</p>
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
