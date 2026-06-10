import type { ContextStatusItem } from '../types/jarvisCommand';
import { ProjectContextControl } from './ProjectContextControl';

type ContextStatusPanelProps = {
  items: ContextStatusItem[];
  projectName: string | null;
  isSelectingProject: boolean;
  isProcessing: boolean;
  onSelectProject: () => void;
};

export function ContextStatusPanel({
  items,
  projectName,
  isSelectingProject,
  isProcessing,
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

      <div className="context-grid context-grid-compact">
        {items.map((item) => (
          <div className={`context-tile tone-${item.tone}`} key={item.key}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>
    </aside>
  );
}
