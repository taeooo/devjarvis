import type { ContextStatusItem } from '../types/jarvisCommand';
import type { ManifestRegisterResponse } from '../types/projectScanner';
import { ProjectContextControl } from './ProjectContextControl';

type ContextStatusPanelProps = {
  items: ContextStatusItem[];
  projectName: string | null;
  isSelectingProject: boolean;
  isProcessing: boolean;
  latestSummary: ManifestRegisterResponse | null;
  onSelectProject: () => void;
};

export function ContextStatusPanel({
  items,
  projectName,
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

      <div className="snapshot-strip">
        <span>Manifest</span>
        <strong>{latestSummary ? `${latestSummary.targetFileCount.toLocaleString()} files` : 'On command'}</strong>
      </div>
    </aside>
  );
}
