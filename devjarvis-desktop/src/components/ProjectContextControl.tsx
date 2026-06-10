type ProjectContextControlProps = {
  projectName: string | null;
  isSelecting: boolean;
  disabled?: boolean;
  onSelectProject: () => void;
};

export function ProjectContextControl({
  projectName,
  isSelecting,
  disabled = false,
  onSelectProject,
}: ProjectContextControlProps) {
  return (
    <div className="project-context-control">
      <div>
        <span className="panel-kicker">Project</span>
        <strong>{projectName ?? 'Not selected'}</strong>
      </div>
      <button type="button" onClick={onSelectProject} disabled={disabled || isSelecting}>
        {isSelecting ? '선택 중' : projectName ? '변경' : '선택'}
      </button>
    </div>
  );
}
