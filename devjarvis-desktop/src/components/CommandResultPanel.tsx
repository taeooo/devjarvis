import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CommandResult } from '../types/jarvisCommand';

const MAX_RENDERED_HISTORY = 2;

type CommandResultPanelProps = {
  results: CommandResult[];
};

type DisplayResult = {
  title: string;
  summary: string;
  detail: string | null;
  actionItems: string[];
};

export function CommandResultPanel({ results }: CommandResultPanelProps) {
  const [selectedResult, setSelectedResult] = useState<CommandResult | null>(null);
  const [currentResult, ...historyResults] = results;

  return (
    <aside className="result-panel" aria-label="Command results">
      <div className="panel-heading">
        <span>RESULTS</span>
        <strong>{results.length > 0 ? 'READY' : 'IDLE'}</strong>
      </div>

      <div className="result-list">
        {!currentResult ? (
          <div className="empty-result">명령 대기 중</div>
        ) : (
          <>
            <section className="result-group" aria-label="Current command result">
              <span className="result-group-label">CURRENT</span>
              <ResultCard result={currentResult} onOpen={() => setSelectedResult(currentResult)} />
            </section>
            {historyResults.length > 0 && (
              <section className="result-group" aria-label="Previous command results">
                <span className="result-group-label">HISTORY</span>
                {historyResults.slice(0, MAX_RENDERED_HISTORY).map((result) => (
                  <ResultCard key={result.id} result={result} compact onOpen={() => setSelectedResult(result)} />
                ))}
              </section>
            )}
          </>
        )}
      </div>

      {selectedResult && <ResultDetailDialog result={selectedResult} onClose={() => setSelectedResult(null)} />}
    </aside>
  );
}

type ResultCardProps = {
  result: CommandResult;
  compact?: boolean;
  onOpen: () => void;
};

function ResultCard({ result, compact = false, onOpen }: ResultCardProps) {
  const display = useMemo(() => buildDisplayResult(result), [result]);
  const relatedFiles = result.metadata?.relatedProjectFiles ?? [];

  return (
    <article className={`result-card result-${result.status} ${compact ? 'result-card-compact' : ''}`}>
      <div className="result-card-topline">
        <span>{formatResultStatus(result.status)}</span>
        <div className="result-card-topline-actions">
          <time dateTime={result.completedAt ?? result.createdAt}>{formatResultTime(result.completedAt ?? result.createdAt)}</time>
          <button type="button" className="result-detail-button" onClick={onOpen}>
            전문 보기
          </button>
        </div>
      </div>
      <strong>{display.title}</strong>
      <p>{display.summary}</p>
      {!compact && relatedFiles.length > 0 && (
        <div className="related-file-preview">
          <span>관련 파일 후보</span>
          <strong>{relatedFiles.length}</strong>
        </div>
      )}
      {!compact && display.actionItems.length > 0 && (
        <ul className="result-action-list">
          {display.actionItems.slice(0, 2).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
      {result.nextStep && result.status === 'failed' && <small>{result.nextStep}</small>}
    </article>
  );
}

type ResultDetailDialogProps = {
  result: CommandResult;
  onClose: () => void;
};

function ResultDetailDialog({ result, onClose }: ResultDetailDialogProps) {
  const display = useMemo(() => buildDisplayResult(result), [result]);
  const relatedFiles = result.metadata?.relatedProjectFiles ?? [];
  const timestamp = result.completedAt ?? result.createdAt;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return createPortal(
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
            <h2 id="result-detail-title">{display.title}</h2>
            <time dateTime={timestamp}>{formatResultTime(timestamp)}</time>
          </div>
          <button type="button" aria-label="Close result detail" onClick={onClose}>
            닫기
          </button>
        </div>

        <div className="result-detail-body">
          <section>
            <h3>요약</h3>
            <p>{display.summary}</p>
          </section>

          {display.detail && display.detail.trim().length > 0 && display.detail.trim() !== display.summary.trim() && (
            <section>
              <h3>상세</h3>
              <pre>{formatDetailText(display.detail)}</pre>
            </section>
          )}

          {relatedFiles.length > 0 && (
            <section>
              <h3>관련 파일 후보</h3>
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

          {display.actionItems.length > 0 && (
            <section>
              <h3>다음 확인 액션</h3>
              <ul>
                {display.actionItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </section>
    </div>,
    document.body,
  );
}

function buildDisplayResult(result: CommandResult): DisplayResult {
  const parsedSummary = parseJsonLikeText(result.metadata?.analysisSummary ?? result.summary);
  const parsedDetail = parseJsonLikeText(result.metadata?.analysisDetail ?? result.detail ?? null);

  return {
    title: localizeTitle(result.metadata?.analysisTitle ?? result.title, result.intent, result.status),
    summary: extractReadableSummary(parsedSummary) ?? extractReadableSummary(parsedDetail) ?? localizeSummary(result.summary),
    detail: extractReadableDetail(parsedDetail) ?? extractReadableDetail(parsedSummary) ?? null,
    actionItems: result.metadata?.analysisActionItems?.length
      ? result.metadata.analysisActionItems
      : extractActionItems(parsedSummary) ?? extractActionItems(parsedDetail) ?? [],
  };
}

function parseJsonLikeText(value: string | null | undefined): unknown {
  if (!value || !value.trim()) return null;
  const normalized = value.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
  if (!normalized.startsWith('{') && !normalized.startsWith('[')) return value;

  try {
    return JSON.parse(normalized);
  } catch {
    return value;
  }
}

function extractReadableSummary(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const candidates = [record.summary, record.overview, record.architecture, record.message];
  for (const candidate of candidates) {
    const text = stringifyReadable(candidate);
    if (text) return text;
  }
  return null;
}

function extractReadableDetail(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const record = value as Record<string, unknown>;
  const sections = [
    ['구조', record.architecture],
    ['모듈 경계', record.module_boundaries ?? record.moduleBoundaries],
    ['관찰 근거', record.evidence],
    ['위험 요소', record.risks],
    ['다음 확인', record.actionItems ?? record.nextActions],
  ]
    .map(([label, content]) => formatSection(label as string, content))
    .filter((section): section is string => Boolean(section));

  return sections.length > 0 ? sections.join('\n\n') : null;
}

function extractActionItems(value: unknown): string[] | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const raw = record.actionItems ?? record.nextActions;
  if (!Array.isArray(raw)) return null;
  const items = raw.map((item) => stringifyReadable(item)).filter((item): item is string => Boolean(item));
  return items.length > 0 ? items : null;
}

function formatSection(label: string, content: unknown): string | null {
  const text = stringifyReadable(content);
  return text ? `[${label}]\n${text}` : null;
}

function stringifyReadable(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    const items = value.map((item) => stringifyReadable(item)).filter((item): item is string => Boolean(item));
    return items.length > 0 ? items.map((item) => `- ${item}`).join('\n') : null;
  }
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => {
        const text = stringifyReadable(item);
        return text ? `${key}: ${text}` : null;
      })
      .filter((item): item is string => Boolean(item))
      .join('\n') || null;
  }
  return null;
}

function localizeTitle(title: string, intent: CommandResult['intent'], status: CommandResult['status']): string {
  if (status === 'failed') return '명령 실패';
  if (intent === 'project_diagnosis') return '프로젝트 분석 완료';
  if (intent === 'screen_math_solver') return '계산 완료';
  if (intent === 'screen_translate') return '번역 완료';
  if (intent === 'screen_summary') return '요약 완료';
  if (intent === 'screen_error_analysis') return '화면 진단 완료';
  if (intent === 'log_analysis') return '로그 분석 완료';
  if (title === 'Command processing') return '명령 처리 중';
  return title;
}

function localizeSummary(summary: string): string {
  if (summary === 'Command failed') return '명령 처리에 실패했습니다.';
  return summary;
}

function formatDetailText(detail: string): string {
  return detail
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .join('\n');
}

function formatResultStatus(status: CommandResult['status']): string {
  if (status === 'processing') return '진행 중';
  if (status === 'failed') return '실패';
  return '완료';
}

function formatResultTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--:--';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
