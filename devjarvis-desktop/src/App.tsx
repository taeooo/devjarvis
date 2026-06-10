import { useEffect, useMemo, useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { AppShell } from './components/AppShell';
import { CommandInput as CommandInputBar } from './components/CommandInput';
import { ContextStatusPanel } from './components/ContextStatusPanel';
import { JarvisCore } from './components/JarvisCore';
import { VoiceStatusPanel } from './components/VoiceStatusPanel';
import { createProject, registerProjectManifest } from './api/backendClient';
import type {
  CommandInput,
  ContextMode,
  ContextStatusItem,
  SystemStatus,
  VoiceState,
} from './types/jarvisCommand';
import type { ManifestRegisterResponse, ProjectResponse, ProjectScanResult } from './types/projectScanner';

type SelectedProject = {
  rootPath: string;
  name: string;
};

function App() {
  const [selectedProject, setSelectedProject] = useState<SelectedProject | null>(null);
  const [registeredProject, setRegisteredProject] = useState<ProjectResponse | null>(null);
  const [latestSummary, setLatestSummary] = useState<ManifestRegisterResponse | null>(null);
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [micAvailable, setMicAvailable] = useState<boolean | null>(null);
  const [isSelectingProject, setIsSelectingProject] = useState(false);
  const [isProcessingCommand, setIsProcessingCommand] = useState(false);
  const [lastCommand, setLastCommand] = useState<CommandInput | null>(null);
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
      value: 'Ready',
      tone: 'ready',
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
  ]), [selectedProject, voiceState]);

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
      source: 'text',
      text,
      createdAt: new Date().toISOString(),
      contextMode: inferContextMode(text),
    };

    setLastCommand(command);
    setSystemMessage(null);
    setErrorMessage(null);
    setIsProcessingCommand(true);
    setVoiceState((current) => (current === 'unavailable' ? current : 'transcribing'));

    try {
      if (selectedProject && command.contextMode === 'project') {
        const summary = await refreshProjectManifest(selectedProject);
        setSystemMessage(`Project context refreshed · ${summary.targetFileCount.toLocaleString()} files`);
      } else if (!selectedProject && command.contextMode === 'project') {
        setSystemMessage('Project context not selected.');
      } else {
        setSystemMessage('Command received locally.');
      }
    } catch (caught) {
      setErrorMessage(toErrorMessage(caught));
      setVoiceState((current) => (current === 'unavailable' ? current : 'error'));
      return;
    } finally {
      setIsProcessingCommand(false);
    }

    setVoiceState((current) => (current === 'unavailable' ? current : 'listening'));
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
            isSelectingProject={isSelectingProject}
            isProcessing={isProcessingCommand}
            latestSummary={latestSummary}
            onSelectProject={handleSelectProjectFolder}
          />
        </div>
      </section>
    </AppShell>
  );
}

function inferContextMode(text: string): ContextMode {
  const normalized = text.toLocaleLowerCase();

  if (/(프로젝트|소스|코드|파일|빌드|컴파일|에러|오류|로그|원인|스택트레이스|stack|trace)/i.test(normalized)) {
    return 'project';
  }

  if (/(화면|스크린|캡처|캡쳐|번역|요약|이미지|window|screen)/i.test(normalized)) {
    return 'screen';
  }

  return 'general';
}

function extractProjectName(path: string): string {
  const normalized = path.replaceAll('\\', '/').replace(/\/+$|\s+$/g, '');
  const name = normalized.split('/').pop();
  return name && name.trim().length > 0 ? name : 'Local Project';
}

function toErrorMessage(caught: unknown): string {
  return caught instanceof Error ? caught.message : String(caught);
}

export default App;
