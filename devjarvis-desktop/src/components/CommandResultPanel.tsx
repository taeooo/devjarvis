import { useState } from 'react';
import type { CommandResult } from '../types/jarvisCommand';

const MAX_HISTORY_RESULTS = 3;

type CommandResultPanelProps = {
  results: CommandResult[];
};

export function CommandResultPanel({ results }: CommandResultPanelProps) {
  const [selectedResult, setSelectedResult] = useState<CommandResult | null>(null);
  const currentResult = results[0] ?? null;
  const historyResults = results.slice(1, MAX_HISTORY_RESULTS + 1);

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
            <ResultGroupLabel label="Current" />
            <ResultCard result={currentResult} variant="current" onOpen={() => setSelectedResult(currentResult)} />

            {historyResults.length > 0 && (
              <>
                <ResultGroupLabel label="History" />
                {historyResults.map((result) => (
                  <ResultCard result={result} variant="history" key={result.id} onOpen={() => setSelectedResult(result)} />
                ))}
              </>
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
  variant: 'current' | 'history';
  onOpen: () => void;
};

function ResultCard({ result, variant, onOpen }: ResultCardProps) {
  return (
    <article className={`result-card result-${result.status} result-card-${variant}`}>
      <div className="result-card-topline">
        <span>{formatResultStatus(result.status)}</span>
        <time dateTime={result.completedAt ?? result.createdAt}>
          {formatResultTime(result.completedAt ?? result.createdAt)}
        </time>
      </div>
      <div className="result-card-title-row">
        <strong>{result.metadata?.analysisTitle ?? result.title}</strong>
        <em>{formatResultSource(result)}</em>
      </div>
      <p>{getResultPreview(result)}</p>
      {variant === 'current' && result.metadata?.analysisActionItems && result.metadata.analysisActionItems.length > 0 && (
        <ul className="result-action-list">
          {result.metadata.analysisActionItems.slice(0, 2).map((item) => (
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

function ResultGroupLabel({ label }: { label: string }) {
  return <div className="result-group-label">{label}</div>;
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
  const isMathResult = result.intent === 'screen_math_solver';

  return (
    <div className="result-detail-overlay" role="presentation" onClick={onClose}>
      <section
        className={`result-detail-dialog ${isMathResult ? 'result-detail-math' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="result-detail-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="result-detail-header">
          <div>
            <span>{formatResultStatus(result.status)} · {formatResultSource(result)}</span>
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
              <h3>{isMathResult ? '계산 / 풀이 전체' : '상세 내용'}</h3>
              {isMathResult ? <MathDetailTable detail={detail} /> : <pre>{detail}</pre>}
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

          {result.metadata?.projectLanguageSummary && (
            <section>
              <h3>프로젝트 구조 힌트</h3>
              <dl className="result-project-summary">
                <div>
                  <dt>Languages</dt>
                  <dd>{result.metadata.projectLanguageSummary}</dd>
                </div>
                {result.metadata.projectDirectorySummary && (
                  <div>
                    <dt>Top-level</dt>
                    <dd>{result.metadata.projectDirectorySummary}</dd>
                  </div>
                )}
              </dl>
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

function MathDetailTable({ detail }: { detail: string }) {
  const rows = detail.split('\n').map((line) => line.trim()).filter(Boolean);

  return (
    <div className="math-detail-table">
      {rows.map((line, index) => {
        const [expression, ...resultParts] = line.split('=');
        const result = resultParts.join('=').trim();
        return (
          <div className="math-detail-row" key={`${line}-${index}`}>
            <span>{index + 1}</span>
            <code>{result ? expression.trim() : line}</code>
            {result && <strong>{result}</strong>}
          </div>
        );
      })}
    </div>
  );
}

function getResultPreview(result: CommandResult): string {
  if (result.status === 'processing') {
    return result.summary;
  }

  return result.metadata?.analysisPreview
    ?? result.metadata?.analysisSummary
    ?? result.summary;
}

function formatResultSource(result: CommandResult): string {
  switch (result.metadata?.resultSource) {
    case 'project':
      return 'Project';
    case 'screen_math':
      return 'Math';
    case 'screen':
      return 'Screen';
    case 'auto':
      return 'Mixed';
    case 'text':
      return 'Text';
    default:
      return result.contextMode === 'project'
        ? 'Project'
        : result.intent === 'screen_math_solver'
          ? 'Math'
          : 'Command';
  }
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
