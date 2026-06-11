import type { ReactNode } from 'react';
import type { SystemStatus } from '../types/jarvisCommand';

type AppShellProps = {
  status: SystemStatus;
  children: ReactNode;
  onOpenGuide: () => void;
};

export function AppShell({ status, children, onOpenGuide }: AppShellProps) {
  return (
    <main className="app-shell">
      <header className="top-bar">
        <div className="brand-lockup" aria-label="DevJarvis">
          <div className="brand-orbit" aria-hidden="true">
            <span />
          </div>
          <div>
            <p className="brand-name">DevJarvis</p>
            <p className="brand-caption">Command Shell</p>
          </div>
        </div>

        <div className="top-status-group">
          <div className={`system-pill system-pill-${status.toLowerCase().replaceAll(' ', '-')}`}>
            <span className="system-dot" />
            {status}
          </div>
          <button className="icon-button" type="button" aria-label="사용법 열기" title="사용법" onClick={onOpenGuide}>
            ?
          </button>
        </div>
      </header>

      {children}
    </main>
  );
}
