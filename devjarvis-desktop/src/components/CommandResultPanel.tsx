import type { CommandResult } from '../types/jarvisCommand';
import { formatIntent } from '../utils/commandRouter';

const MAX_RENDERED_RESULTS = 5;

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
              <div className="result-meta-row">
                <span>{formatIntent(result.intent)}</span>
                <span>{formatContextMode(result.contextMode)}</span>
              </div>
              <p>{result.summary}</p>
              {result.metadata?.ocrPreview && (
                <div className="result-ocr-preview">{result.metadata.ocrPreview}</div>
              )}
              {result.metadata?.ocrProvider && (
                <div className="result-meta-row">
                  <span>OCR {result.metadata.ocrProvider}</span>
                  <span>{result.metadata.ocrTextFound ? `${result.metadata.ocrTextLength ?? 0} chars` : 'No text'}</span>
                </div>
              )}
              {result.nextStep && <small>{result.nextStep}</small>}
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

function formatContextMode(contextMode: CommandResult['contextMode']): string {
  if (contextMode === 'auto') {
    return 'Screen + Project';
  }

  if (contextMode === 'screen') {
    return 'Screen';
  }

  if (contextMode === 'project') {
    return 'Project';
  }

  return 'General';
}

function formatResultTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '--:--';
  }

  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
