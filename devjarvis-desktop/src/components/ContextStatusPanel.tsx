import type { ContextStatusItem, ScreenContextSnapshot } from '../types/jarvisCommand';
import type { ManifestRegisterResponse } from '../types/projectScanner';
import { ProjectContextControl } from './ProjectContextControl';

type ContextStatusPanelProps = {
  items: ContextStatusItem[];
  projectName: string | null;
  screenContext: ScreenContextSnapshot;
  isSelectingProject: boolean;
  isProcessing: boolean;
  latestSummary: ManifestRegisterResponse | null;
  onSelectProject: () => void;
};

export function ContextStatusPanel({
  items,
  projectName,
  screenContext,
  isSelectingProject,
  isProcessing,
  latestSummary,
  onSelectProject,
}: ContextStatusPanelProps) {
  return (
    <aside className="context-panel" aria-label="Context status">
      <ProjectContextControl
        projectName={projectName}
        isSelecting={isSelectingProject}
        disabled={isProcessing}
        onSelectProject={onSelectProject}
      />

      <div className="context-grid">
        {items.map((item) => (
          <div className={`context-tile tone-${item.tone}`} key={item.key}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>

      <div className="snapshot-stack">
        <div className="snapshot-strip">
          <span>Screen</span>
          <strong>{formatScreenSnapshot(screenContext)}</strong>
        </div>
        <div className="snapshot-strip">
          <span>Intent</span>
          <strong>{formatScreenIntent(screenContext)}</strong>
        </div>
        <div className="snapshot-strip">
          <span>OCR</span>
          <strong>{formatOcrSnapshot(screenContext)}</strong>
        </div>
        <div className="snapshot-strip">
          <span>Manifest</span>
          <strong>{latestSummary ? `${latestSummary.targetFileCount.toLocaleString()} files` : 'On command'}</strong>
        </div>
      </div>
    </aside>
  );
}

function formatScreenSnapshot(screenContext: ScreenContextSnapshot): string {
  if (screenContext.state === 'capturing') {
    return 'Capturing';
  }

  if (screenContext.state === 'captured' && screenContext.width && screenContext.height) {
    return `${screenContext.width}×${screenContext.height}`;
  }

  if (screenContext.state === 'unavailable') {
    return 'Unavailable';
  }

  if (screenContext.state === 'error') {
    return 'Failed';
  }

  return 'On command';
}

function formatScreenIntent(screenContext: ScreenContextSnapshot): string {
  if (!screenContext.lastIntent) {
    return 'Auto';
  }

  switch (screenContext.lastIntent) {
    case 'screen_translate':
      return 'Translate';
    case 'screen_summary':
      return 'Summary';
    case 'screen_error_analysis':
      return 'Diagnosis';
    case 'project_diagnosis':
      return 'Project';
    case 'log_analysis':
      return 'Log';
    case 'general_chat':
      return 'General';
  }
}


function formatOcrSnapshot(screenContext: ScreenContextSnapshot): string {
  if (screenContext.ocrState === 'extracting' || screenContext.ocrState === 'uploading') {
    return 'Extracting';
  }

  if (screenContext.ocrState === 'completed') {
    const count = screenContext.ocrTextLength ?? 0;
    return count > 0 ? `${count.toLocaleString()} chars` : screenContext.ocrProvider ?? 'Ready';
  }

  if (screenContext.ocrState === 'failed') {
    return 'Failed';
  }

  return 'On command';
}
