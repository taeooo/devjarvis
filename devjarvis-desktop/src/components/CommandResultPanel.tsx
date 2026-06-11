import { useState } from 'react';
import type { CommandResult } from '../types/jarvisCommand';

const MAX_RENDERED_RESULTS = 3;

type CommandResultPanelProps = {
  results: CommandResult[];
};

export function CommandResultPanel({ results }: CommandResultPanelProps) {
  const [selectedResult, setSelectedResult] = useState<CommandResult | null>(null);

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
              <div className="result-card-actions">
                <button type="button" onClick={() => setSelectedResult(result)}>
                  전문 보기
                </button>
              </div>
              {result.nextStep && result.status === 'failed' && <small>{result.nextStep}</small>}
            </article>
          ))
        )}
      </div>

      {selectedResult && (
        <ResultDetailDialog result={selectedResult} onClose={() => setSelectedResult(null)} />
      )}
    </aside>
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
  const timestamp = result.completedAt ?? result.createdAt;

  return (
    <div className="result-detail-overlay" role="presentation" onClick={onClose}>
      <section
        className="result-detail-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="result-detail-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="result-detail-header">
          <div>
            <span>{formatResultStatus(result.status)}</span>
            <h2 id="result-detail-title">{title}</h2>
            <time dateTime={timestamp}>{formatResultTime(timestamp)}</time>
          </div>
          <button type="button" aria-label="Close result detail" onClick={onClose}>
            닫기
          </button>
        </div>

        <div className="result-detail-body">
          <section>
            <h3>요약</h3>
            <p>{summary}</p>
          </section>

          {detail && detail.trim().length > 0 && detail.trim() !== summary.trim() && (
            <section>
              <h3>상세 내용</h3>
              <pre>{detail}</pre>
            </section>
          )}

          {actionItems.length > 0 && (
            <section>
              <h3>조치 항목</h3>
              <ul>
                {actionItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          )}

          {result.detail && result.detail.trim().length > 0 && result.detail !== detail && (
            <section>
              <h3>요청</h3>
              <pre>{result.detail}</pre>
            </section>
          )}
        </div>
      </section>
    </div>
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
