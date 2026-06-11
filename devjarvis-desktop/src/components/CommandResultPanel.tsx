import { useState } from 'react';
import type { CommandResult } from '../types/jarvisCommand';

const MAX_HISTORY_RESULTS = 4;

type CommandResultPanelProps = {
  results: CommandResult[];
};

export function CommandResultPanel({ results }: CommandResultPanelProps) {
  const [selectedResult, setSelectedResult] = useState<CommandResult | null>(null);
  const [currentResult, ...historyResults] = results;
  const visibleHistory = historyResults.slice(0, MAX_HISTORY_RESULTS);

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
            <section className="result-section" aria-label="Current command result">
              <span className="result-section-label">Current</span>
              <ResultCard result={currentResult} onOpen={() => setSelectedResult(currentResult)} />
            </section>

            {visibleHistory.length > 0 && (
              <section className="result-section result-history-section" aria-label="Previous command results">
                <span className="result-section-label">History</span>
                {visibleHistory.map((result) => (
                  <ResultCard key={result.id} result={result} onOpen={() => setSelectedResult(result)} compact />
                ))}
              </section>
            )}
          </>
        )}
      </div>

      {selectedResult && (
        <ResultDetailDialog result={selectedResult} onClose={() => setSelectedResult(null)} />
      )}
    </aside>
  );
}

type ResultCardProps = {
  result: CommandResult;
  onOpen: () => void;
  compact?: boolean;
};

function ResultCard({ result, onOpen, compact = false }: ResultCardProps) {
  const title = getResultTitle(result);
  const preview = getResultPreview(result);
  const actionItems = getResultActionItems(result);

  return (
    <article className={`result-card result-${result.status} ${compact ? 'result-card-compact' : ''}`}>
      <div className="result-card-topline">
        <span>{formatResultStatus(result.status)}</span>
        <time dateTime={result.completedAt ?? result.createdAt}>
          {formatResultTime(result.completedAt ?? result.createdAt)}
        </time>
      </div>
      <strong>{title}</strong>
      <p>{preview}</p>
      {!compact && actionItems.length > 0 && (
        <ul className="result-action-list">
          {actionItems.slice(0, 2).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
      <div className="result-card-actions">
        <button type="button" onClick={onOpen}>
          전문 보기
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
  const title = getResultTitle(result);
  const summary = getResultSummary(result);
  const detail = getResultDetail(result);
  const actionItems = getResultActionItems(result);
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
              <h3>{result.intent === 'screen_math_solver' ? '계산 풀이' : '상세 내용'}</h3>
              {result.intent === 'screen_math_solver' ? (
                <div className="math-solution-list">
                  {detail.split('\n').filter(Boolean).map((line) => (
                    <div className="math-solution-row" key={line}>{line}</div>
                  ))}
                </div>
              ) : (
                <pre>{detail}</pre>
              )}
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

function getResultTitle(result: CommandResult): string {
  return result.metadata?.analysisTitle ?? result.title;
}

function getResultSummary(result: CommandResult): string {
  return result.metadata?.projectAnalysisSummary
    ?? result.metadata?.analysisSummary
    ?? result.summary;
}

function getResultDetail(result: CommandResult): string | null {
  return result.metadata?.projectAnalysisDetail
    ?? result.metadata?.analysisDetail
    ?? result.detail
    ?? null;
}

function getResultPreview(result: CommandResult): string {
  return result.metadata?.analysisPreview
    ?? result.metadata?.projectAnalysisSummary
    ?? result.metadata?.analysisSummary
    ?? result.summary;
}

function getResultActionItems(result: CommandResult): string[] {
  return result.metadata?.projectAnalysisActionItems
    ?? result.metadata?.analysisActionItems
    ?? [];
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
