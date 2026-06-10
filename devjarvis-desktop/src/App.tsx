import { useEffect, useMemo, useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { AppShell } from './components/AppShell';
import { CommandInput as CommandInputBar } from './components/CommandInput';
import { CommandResultPanel } from './components/CommandResultPanel';
import { ContextStatusPanel } from './components/ContextStatusPanel';
import { JarvisCore } from './components/JarvisCore';
import { VoiceStatusPanel } from './components/VoiceStatusPanel';
import { createProject, registerProjectManifest } from './api/backendClient';
import { notifyCommandResult } from './utils/nativeWindow';
import { captureScreenFrame, isScreenCaptureSupported } from './utils/screenCapture';
import type {
  CommandInput,
  CommandResult,
  ContextMode,
  ContextStatusItem,
  ScreenContextSnapshot,
  SystemStatus,
  VoiceState,
} from './types/jarvisCommand';
import type { ManifestRegisterResponse, ProjectResponse, ProjectScanResult } from './types/projectScanner';

type SelectedProject = {
  rootPath: string;
  name: string;
};

const MAX_RESULT_HISTORY = 8;

const initialScreenContext: ScreenContextSnapshot = {
  state: isScreenCaptureSupported() ? 'ready' : 'unavailable',
  width: null,
  height: null,
  capturedAt: null,
  errorMessage: null,
};

function App() {
  const [selectedProject, setSelectedProject] = useState<SelectedProject | null>(null);
  const [registeredProject, setRegisteredProject] = useState<ProjectResponse | null>(null);
  const [latestSummary, setLatestSummary] = useState<ManifestRegisterResponse | null>(null);
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [micAvailable, setMicAvailable] = useState<boolean | null>(null);
  const [screenContext, setScreenContext] = useState<ScreenContextSnapshot>(initialScreenContext);
  const [isSelectingProject, setIsSelectingProject] = useState(false);
  const [isProcessingCommand, setIsProcessingCommand] = useState(false);
  const [lastCommand, setLastCommand] = useState<CommandInput | null>(null);
  const [commandResults, setCommandResults] = useState<CommandResult[]>([]);
  const [systemMessage, setSystemMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function detectMicrophone() {
      if (!navigator.mediaDevices?.enumerateDevices) {
        if (!cancelled) {
          setMicAvailable(false);
          setVoiceState('unavailable');
        }
        return;
      }

      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const hasMicrophone = devices.some((device) => device.kind === 'audioinput');
        if (!cancelled) {
          setMicAvailable(hasMicrophone);
          setVoiceState(hasMicrophone ? 'listening' : 'unavailable');
        }
      } catch {
        if (!cancelled) {
          setMicAvailable(false);
          setVoiceState('unavailable');
        }
      }
    }

    void detectMicrophone();

    return () => {
      cancelled = true;
    };
  }, []);

  const systemStatus: SystemStatus = useMemo(() => {
    if (isProcessingCommand) {
      return 'Processing';
    }
    if (voiceState === 'unavailable') {
      return 'Mic unavailable';
    }
    if (voiceState === 'listening') {
      return 'Listening';
    }
    return 'Idle';
  }, [isProcessingCommand, voiceState]);

  const contextItems = useMemo<ContextStatusItem[]>(() => ([
    {
      key: 'screen',
      label: 'Screen',
      value: formatScreenContextValue(screenContext),
      tone: screenContext.state === 'captured' ? 'ready' : screenContext.state === 'capturing' ? 'active' : screenContext.state === 'error' || screenContext.state === 'unavailable' ? 'warning' : 'idle',
    },
    {
      key: 'project',
      label: 'Project',
      value: selectedProject ? 'Selected' : 'Not selected',
      tone: selectedProject ? 'ready' : 'idle',
    },
    {
      key: 'voice',
      label: 'Voice',
      value: voiceState === 'unavailable' ? 'Unavailable' : voiceState === 'listening' ? 'Listening' : 'Idle',
      tone: voiceState === 'unavailable' ? 'warning' : voiceState === 'listening' ? 'active' : 'idle',
    },
    {
      key: 'rag',
      label: 'RAG',
      value: selectedProject ? 'Project' : 'None',
      tone: selectedProject ? 'ready' : 'idle',
    },
  ]), [screenContext, selectedProject, voiceState]);

  async function handleSelectProjectFolder() {
    setSystemMessage(null);
    setErrorMessage(null);
    setIsSelectingProject(true);

    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Project context 선택',
      });

      if (typeof selected !== 'string') {
        return;
      }

      setSelectedProject({
        rootPath: selected,
        name: extractProjectName(selected),
      });
      setRegisteredProject(null);
      setLatestSummary(null);
      setSystemMessage('Project context selected.');
    } catch (caught) {
      setErrorMessage(toErrorMessage(caught));
    } finally {
      setIsSelectingProject(false);
    }
  }

  async function handleTextCommandSubmit(text: string) {
    const command: CommandInput = {
      id: createClientId(),
      source: 'text',
      text,
      createdAt: new Date().toISOString(),
      contextMode: inferContextMode(text),
    };

    const startedResult: CommandResult = {
      id: createClientId(),
      commandId: command.id,
      title: 'Command processing',
      summary: summarizeCommandContext(command.contextMode),
      status: 'processing',
      createdAt: new Date().toISOString(),
      displayMode: 'notify',
    };

    setLastCommand(command);
    upsertCommandResult(startedResult);
    setSystemMessage(null);
    setErrorMessage(null);
    setIsProcessingCommand(true);
    setVoiceState((current) => (current === 'unavailable' ? current : 'transcribing'));

    try {
      const messages: string[] = [];

      if (command.contextMode === 'screen' || command.contextMode === 'auto') {
        const snapshot = await refreshScreenContext();
        messages.push(`Screen captured · ${snapshot.width}×${snapshot.height}`);
      }

      if (command.contextMode === 'project' || command.contextMode === 'auto') {
        if (selectedProject) {
          const summary = await refreshProjectManifest(selectedProject);
          messages.push(`Project refreshed · ${summary.targetFileCount.toLocaleString()} files`);
        } else {
          messages.push('Project context not selected');
        }
      }

      if (messages.length === 0) {
        messages.push('Command received locally');
      }

      const completedResult: CommandResult = {
        ...startedResult,
        title: inferResultTitle(command),
        summary: messages.join(' · '),
        detail: command.text,
        status: 'completed',
        completedAt: new Date().toISOString(),
        displayMode: command.contextMode === 'general' ? 'notify' : 'open_app',
      };

      upsertCommandResult(completedResult);
      setSystemMessage(completedResult.summary);
      void notifyCommandResult(completedResult);
    } catch (caught) {
      const message = toErrorMessage(caught);
      const failedResult: CommandResult = {
        ...startedResult,
        title: 'Command failed',
        summary: message,
        detail: command.text,
        status: 'failed',
        completedAt: new Date().toISOString(),
        displayMode: 'open_app',
      };

      upsertCommandResult(failedResult);
      setErrorMessage(message);
      setVoiceState((current) => (current === 'unavailable' ? current : 'error'));
      void notifyCommandResult(failedResult);
      return;
    } finally {
      setIsProcessingCommand(false);
    }

    setVoiceState((current) => (current === 'unavailable' ? current : 'listening'));
  }

  async function refreshScreenContext(): Promise<{ width: number; height: number }> {
    setScreenContext((current) => ({
      ...current,
      state: 'capturing',
      errorMessage: null,
    }));

    try {
      const captured = await captureScreenFrame();
      const snapshot = {
        width: captured.width,
        height: captured.height,
      };

      setScreenContext({
        state: 'captured',
        width: captured.width,
        height: captured.height,
        capturedAt: captured.capturedAt,
        errorMessage: null,
      });

      return snapshot;
    } catch (caught) {
      const message = toErrorMessage(caught);
      setScreenContext({
        state: isScreenCaptureSupported() ? 'error' : 'unavailable',
        width: null,
        height: null,
        capturedAt: null,
        errorMessage: message,
      });
      throw new Error(message);
    }
  }

  async function refreshProjectManifest(projectContext: SelectedProject): Promise<ManifestRegisterResponse> {
    const scanResult = await invoke<ProjectScanResult>('scan_project_manifest', { rootPath: projectContext.rootPath });
    const project = registeredProject ?? await createProject({
      name: scanResult.rootName || projectContext.name,
      rootPathAlias: scanResult.rootPathAlias,
      description: 'Desktop command context source.',
    });

    const summary = await registerProjectManifest(project.id, scanResult.files);
    setRegisteredProject(project);
    setLatestSummary(summary);
    return summary;
  }

  function upsertCommandResult(result: CommandResult) {
    setCommandResults((current) => {
      const next = [result, ...current.filter((item) => item.commandId !== result.commandId)];
      return next.slice(0, MAX_RESULT_HISTORY);
    });
  }

  return (
    <AppShell status={systemStatus}>
      <section className="command-shell-layout">
        <div className="main-command-zone">
          <JarvisCore
            voiceState={voiceState}
            isProcessing={isProcessingCommand}
            lastCommand={lastCommand}
            systemMessage={systemMessage}
            errorMessage={errorMessage}
          />
          <CommandInputBar disabled={isProcessingCommand} onSubmit={handleTextCommandSubmit} />
        </div>

        <div className="side-stack">
          <VoiceStatusPanel voiceState={voiceState} micAvailable={micAvailable} />
          <ContextStatusPanel
            items={contextItems}
            projectName={selectedProject?.name ?? null}
            screenContext={screenContext}
            isSelectingProject={isSelectingProject}
            isProcessing={isProcessingCommand}
            latestSummary={latestSummary}
            onSelectProject={handleSelectProjectFolder}
          />
          <CommandResultPanel results={commandResults} />
        </div>
      </section>
    </AppShell>
  );
}

function inferContextMode(text: string): ContextMode {
  const normalized = text.toLocaleLowerCase();
  const screenMatched = /(화면|스크린|캡처|캡쳐|번역|요약|이미지|window|screen)/i.test(normalized);
  const projectMatched = /(프로젝트|소스|코드|파일|빌드|컴파일|에러|오류|로그|원인|스택트레이스|stack|trace)/i.test(normalized);

  if (screenMatched && projectMatched) {
    return 'auto';
  }

  if (screenMatched) {
    return 'screen';
  }

  if (projectMatched) {
    return 'project';
  }

  return 'general';
}

function formatScreenContextValue(screenContext: ScreenContextSnapshot): string {
  if (screenContext.state === 'capturing') {
    return 'Capturing';
  }

  if (screenContext.state === 'captured') {
    return 'Captured';
  }

  if (screenContext.state === 'unavailable') {
    return 'Unavailable';
  }

  if (screenContext.state === 'error') {
    return 'Failed';
  }

  return 'Ready';
}

function inferResultTitle(command: CommandInput): string {
  if (command.contextMode === 'screen') {
    return 'Screen context ready';
  }

  if (command.contextMode === 'project') {
    return 'Project context ready';
  }

  if (command.contextMode === 'auto') {
    return 'Context bundle ready';
  }

  return 'Command received';
}

function summarizeCommandContext(contextMode: ContextMode): string {
  if (contextMode === 'screen') {
    return 'Preparing screen context';
  }

  if (contextMode === 'project') {
    return 'Refreshing project manifest';
  }

  if (contextMode === 'auto') {
    return 'Preparing screen and project context';
  }

  return 'Routing command locally';
}

function extractProjectName(path: string): string {
  const normalized = path.replaceAll('\\', '/').replace(/\/+$/g, '').trim();
  const name = normalized.split('/').pop();
  return name && name.trim().length > 0 ? name : 'Local Project';
}

function createClientId(): string {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function toErrorMessage(caught: unknown): string {
  return caught instanceof Error ? caught.message : String(caught);
}

export default App;
