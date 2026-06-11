import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CommandResult } from '../types/jarvisCommand';

const MAX_RENDERED_HISTORY = 2;

type CommandResultPanelProps = {
  results: CommandResult[];
};

export function CommandResultPanel({ results }: CommandResultPanelProps) {
  const [selectedResult, setSelectedResult] = useState<CommandResult | null>(null);
  const [currentResult, ...historyResults] = results;

  return (
    <aside className="result-panel" aria-label="Command results">
      <div className="panel-heading">
        <span>Results</span>
        <strong>{results.length > 0 ? 'Ready' : 'Idle'}</strong>
      </div>

      <div className="result-list">
        {!currentResult ? (
          <div className="empty-result">Waiting for command</div>
        ) : (
          <>
            <section className="result-group" aria-label="Current command result">
              <span className="result-group-label">Current</span>
              <ResultCard result={currentResult} onOpen={() => setSelectedResult(currentResult)} />
            </section>
            {historyResults.length > 0 && (
              <section className="result-group" aria-label="Previous command results">
                <span className="result-group-label">History</span>
                {historyResults.slice(0, MAX_RENDERED_HISTORY).map((result) => (
                  <ResultCard key={result.id} result={result} compact onOpen={() => setSelectedResult(result)} />
                ))}
              </section>
            )}
          </>
        )}
      </div>

      {selectedResult && createPortal(
        <ResultDetailDialog result={selectedResult} onClose={() => setSelectedResult(null)} />,
        document.body,
      )}
    </aside>
  );
}

type ResultCardProps = {
  result: CommandResult;
  compact?: boolean;
  onOpen: () => void;
};

function ResultCard({ result, compact = false, onOpen }: ResultCardProps) {
  const relatedFiles = result.metadata?.relatedProjectFiles ?? [];

  return (
    <article className={`result-card result-${result.status} ${compact ? 'result-card-compact' : ''}`}>
      <div className="result-card-topline">
        <span>{formatResultStatus(result.status)}</span>
        <time dateTime={result.completedAt ?? result.createdAt}>
          {formatResultTime(result.completedAt ?? result.createdAt)}
        </time>
      </div>
      <strong>{result.metadata?.analysisTitle ?? result.title}</strong>
      <p>{result.metadata?.analysisPreview ?? result.summary}</p>
      {!compact && relatedFiles.length > 0 && (
        <div className="related-file-preview">
          <span>Related files</span>
          <strong>{relatedFiles.length}</strong>
        </div>
      )}
      {!compact && result.metadata?.analysisActionItems && result.metadata.analysisActionItems.length > 0 && (
        <ul className="result-action-list">
          {result.metadata.analysisActionItems.slice(0, 2).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
      <div className="result-card-actions">
        <button type="button" onClick={onOpen}>
          View detail
        </button>
      </div>
      {result.nextStep && result.status === 'failed' && <small>{result.nextStep}</small>}
    </article>
  );
}

type ResultDetailDialogProps = {
  result: CommandResult;
  onClose: () => void;
};

function ResultDetailDialog({ result, onClose }: ResultDetailDialogProps) {
  const title = result.metadata?.analysisTitle ?? result.title;
  const summary = result.metadata?.analysisSummary ?? result.summary;
  const detail = result.metadata?.analysisDetail ?? result.detail ?? null;
  const actionItems = result.metadata?.analysisActionItems ?? [];
  const relatedFiles = result.metadata?.relatedProjectFiles ?? [];
  const timestamp = result.completedAt ?? result.createdAt;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="result-detail-overlay" role="presentation" onClick={onClose}>
      <section
        className="result-detail-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="result-detail-title"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="result-detail-header">
          <div>
            <span>{formatResultStatus(result.status)}</span>
            <h2 id="result-detail-title">{title}</h2>
            <time dateTime={timestamp}>{formatResultTime(timestamp)}</time>
          </div>
          <button type="button" aria-label="Close result detail" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="result-detail-body">
          <section>
            <h3>Summary</h3>
            <p>{summary}</p>
          </section>

          {detail && detail.trim().length > 0 && detail.trim() !== summary.trim() && (
            <section>
              <h3>Detail</h3>
              <pre>{formatDetailText(detail)}</pre>
            </section>
          )}

          {relatedFiles.length > 0 && (
            <section>
              <h3>Related file candidates</h3>
              <div className="related-file-list">
                {relatedFiles.map((file) => (
                  <div className="related-file-row" key={file.relativePath}>
                    <code>{file.relativePath}</code>
                    <span>{file.language || file.extension || 'file'}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {actionItems.length > 0 && (
            <section>
              <h3>Next actions</h3>
              <ul>
                {actionItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          )}

          {result.detail && result.detail.trim().length > 0 && result.detail !== detail && (
            <section>
              <h3>Request</h3>
              <pre>{result.detail}</pre>
            </section>
          )}
        </div>
      </section>
    </div>
  );
}

function formatDetailText(detail: string): string {
  return detail
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .join('\n');
}

function formatResultStatus(status: CommandResult['status']): string {
  if (status === 'processing') return 'Processing';
  if (status === 'failed') return 'Failed';
  return 'Completed';
}

function formatResultTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--:--';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
