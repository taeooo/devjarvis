import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CommandResult } from '../types/jarvisCommand';

const MAX_RENDERED_HISTORY = 2;

type CommandResultPanelProps = {
  results: CommandResult[];
  onAnalyzeProjectFiles?: (relativePaths: string[]) => void | Promise<void>;
};

export function CommandResultPanel({ results, onAnalyzeProjectFiles }: CommandResultPanelProps) {
  const [selectedResult, setSelectedResult] = useState<CommandResult | null>(null);
  const [currentResult, ...historyResults] = results;

  return (
    <aside className="result-panel" aria-label="Command results">
      <div className="panel-heading">
        <span>결과</span>
        <strong>{results.length > 0 ? '준비됨' : '대기'}</strong>
      </div>

      <div className="result-list">
        {!currentResult ? (
          <div className="empty-result">명령 대기 중</div>
        ) : (
          <>
            <section className="result-group" aria-label="현재 command result">
              <span className="result-group-label">현재</span>
              <ResultCard result={currentResult} onOpen={() => setSelectedResult(currentResult)} />
            </section>
            {historyResults.length > 0 && (
              <section className="result-group" aria-label="Previous command results">
                <span className="result-group-label">히스토리</span>
                {historyResults.slice(0, MAX_RENDERED_HISTORY).map((result) => (
                  <ResultCard key={result.id} result={result} compact onOpen={() => setSelectedResult(result)} />
                ))}
              </section>
            )}
          </>
        )}
      </div>

      {selectedResult && createPortal(
        <ResultDetailDialog
          result={selectedResult}
          onClose={() => setSelectedResult(null)}
          onAnalyzeProjectFiles={onAnalyzeProjectFiles}
        />,
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
        <div className="result-card-actions result-card-actions-inline">
          <time dateTime={result.completedAt ?? result.createdAt}>
            {formatResultTime(result.completedAt ?? result.createdAt)}
          </time>
          <button type="button" onClick={onOpen}>
            전문 보기
          </button>
        </div>
      </div>
      <strong>{result.metadata?.analysisTitle ?? result.title}</strong>
      <p>{formatInlineResultText(result.metadata?.analysisPreview ?? result.summary)}</p>
      {!compact && relatedFiles.length > 0 && (
        <div className="related-file-preview">
          <span>후보 파일</span>
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
      {result.nextStep && result.status === 'failed' && <small>{result.nextStep}</small>}
    </article>
  );
}

type ResultDetailDialogProps = {
  result: CommandResult;
  onClose: () => void;
  onAnalyzeProjectFiles?: (relativePaths: string[]) => void | Promise<void>;
};

function ResultDetailDialog({ result, onClose, onAnalyzeProjectFiles }: ResultDetailDialogProps) {
  const title = result.metadata?.analysisTitle ?? result.title;
  const summary = formatUserFacingDetailText(result.metadata?.analysisSummary ?? result.summary);
  const detail = result.metadata?.analysisDetail ?? result.detail ?? null;
  const actionItems = result.metadata?.analysisActionItems ?? [];
  const relatedFiles = result.metadata?.relatedProjectFiles ?? [];
  const timestamp = result.completedAt ?? result.createdAt;
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  const canAnalyzeSelection = Boolean(onAnalyzeProjectFiles) && selectedPaths.length > 0;
  const selectedSet = useMemo(() => new Set(selectedPaths), [selectedPaths]);

  function togglePath(relativePath: string) {
    setSelectedPaths((current) => {
      if (current.includes(relativePath)) {
        return current.filter((item) => item !== relativePath);
      }

      if (current.length >= 8) {
        return current;
      }

      return [...current, relativePath];
    });
  }

  function submitSelection() {
    if (!onAnalyzeProjectFiles || selectedPaths.length === 0) return;
    void onAnalyzeProjectFiles(selectedPaths);
    onClose();
  }

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
          <button type="button" aria-label="전문 보기 닫기" onClick={onClose}>
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
              <h3>상세</h3>
              <pre>{formatUserFacingDetailText(detail)}</pre>
            </section>
          )}

          {relatedFiles.length > 0 && (
            <section>
              <details className="detail-advanced-section">
                <summary>고급: 특정 파일 추가 분석</summary>
                <p className="detail-helper-text">
                  Project Deep Index 결과가 부족할 때만 추가로 확인할 파일을 선택하세요. 민감 파일은 정책상 차단됩니다.
                </p>
                <div className="related-file-list related-file-list-selectable">
                  {relatedFiles.map((file) => (
                    <label className="related-file-row related-file-row-selectable" key={file.relativePath}>
                      <input
                        type="checkbox"
                        checked={selectedSet.has(file.relativePath)}
                        onChange={() => togglePath(file.relativePath)}
                      />
                      <code>{file.relativePath}</code>
                      <span>{file.matchReasons.join(', ') || file.language || file.extension || 'file'}</span>
                    </label>
                  ))}
                </div>
                {onAnalyzeProjectFiles && (
                  <div className="detail-action-row">
                    <button type="button" disabled={!canAnalyzeSelection} onClick={submitSelection}>
                      선택 파일 로컬 분석
                    </button>
                  </div>
                )}
              </details>
            </section>
          )}

          {result.metadata?.projectSelectedFiles && result.metadata.projectSelectedFiles.length > 0 && (
            <section>
              <h3>승인된 파일</h3>
              <div className="related-file-list">
                {result.metadata.projectSelectedFiles.map((relativePath) => (
                  <div className="related-file-row" key={relativePath}>
                    <code>{relativePath}</code>
                    <span>approved</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {actionItems.length > 0 && (
            <section>
              <h3>다음 확인 액션</h3>
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
              <pre>{formatUserFacingDetailText(result.detail)}</pre>
            </section>
          )}
        </div>
      </section>
    </div>
  );
}

function formatInlineResultText(value: string): string {
  const formatted = formatUserFacingDetailText(value).replace(/\s+/g, ' ').trim();
  return formatted.length > 220 ? `${formatted.slice(0, 217)}...` : formatted;
}

function formatUserFacingDetailText(value: string): string {
  const normalized = stripMarkdownJsonFence(value).trim();
  if (!normalized) return '';

  const parsed = parseJsonValue(normalized);
  if (parsed !== null) {
    return formatJsonValueForUser(parsed);
  }

  return normalized
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .join('\n');
}

function stripMarkdownJsonFence(value: string): string {
  return value
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```$/i, '')
    .trim();
}

function parseJsonValue(value: string): unknown | null {
  const trimmed = value.trim();
  if (!(trimmed.startsWith('{') && trimmed.endsWith('}')) && !(trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    return null;
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return null;
  }
}

function formatJsonValueForUser(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map((item) => formatJsonListItem(item)).filter(Boolean).join('\n');
  }

  if (isRecord(value)) {
    const lines: string[] = [];
    for (const [key, entry] of Object.entries(value)) {
      if (entry === null || entry === undefined || entry === '') continue;
      const label = formatJsonLabel(key);
      if (Array.isArray(entry)) {
        const items = entry.map((item) => formatJsonListItem(item)).filter(Boolean);
        if (items.length > 0) lines.push(`[${label}]`, ...items);
        continue;
      }
      if (isRecord(entry)) {
        const nested = formatJsonValueForUser(entry);
        if (nested) lines.push(`[${label}]`, nested);
        continue;
      }
      lines.push(`[${label}]`, `- ${String(entry)}`);
    }
    return lines.join('\n');
  }

  return String(value);
}

function formatJsonListItem(value: unknown): string {
  if (Array.isArray(value)) {
    const nested = formatJsonValueForUser(value);
    return nested ? `- ${nested.replace(/\n/g, '\n  ')}` : '';
  }

  if (isRecord(value)) {
    const pairs = Object.entries(value)
      .filter(([, entry]) => entry !== null && entry !== undefined && entry !== '')
      .map(([key, entry]) => `${formatJsonLabel(key)}: ${formatJsonScalar(entry)}`);
    return pairs.length > 0 ? `- ${pairs.join(' / ')}` : '';
  }

  return `- ${String(value)}`;
}

function formatJsonScalar(value: unknown): string {
  if (Array.isArray(value)) return value.map((item) => formatJsonScalar(item)).join(', ');
  if (isRecord(value)) {
    return Object.entries(value)
      .map(([key, entry]) => `${formatJsonLabel(key)} ${formatJsonScalar(entry)}`)
      .join(', ');
  }
  return String(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function formatJsonLabel(key: string): string {
  const normalized = key.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
  switch (normalized) {
    case 'summary': return '요약';
    case 'detail': return '상세';
    case 'action_items': return '다음 확인 액션';
    case 'runtime_flow': return '실행 흐름';
    case 'module_boundaries': return '모듈 경계';
    case 'ui_api_service_links': return 'UI/API/서비스 연결';
    case 'likely_risk_points': return '잠재 위험 지점';
    case 'next_checks': return '다음 확인 항목';
    case 'root_cause_candidates': return '원인 후보';
    case 'related_files': return '관련 파일';
    case 'evidence': return '근거';
    default:
      return key.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  }
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
