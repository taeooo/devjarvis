import { useEffect, useMemo, useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { AppShell } from './components/AppShell';
import { CommandInput as CommandInputBar } from './components/CommandInput';
import { CommandResultPanel } from './components/CommandResultPanel';
import { ContextStatusPanel } from './components/ContextStatusPanel';
import { JarvisCore } from './components/JarvisCore';
import { VoiceStatusPanel } from './components/VoiceStatusPanel';
import { createProject, extractScreenOcr, registerProjectManifest } from './api/backendClient';
import { notifyCommandResult } from './utils/nativeWindow';
import { createClientId, createCommandInput, createCommandPlan } from './utils/commandRouter';
import { captureScreenFrame, isScreenCaptureSupported } from './utils/screenCapture';
import type {
  CommandInput,
  CommandPipelineStage,
  CommandResult,
  ContextStatusItem,
  ScreenCaptureResult,
  ScreenContextSnapshot,
  ScreenOcrResponse,
  SystemStatus,
  VoiceState,
} from './types/jarvisCommand';
import type { ManifestRegisterResponse, ProjectResponse, ProjectScanResult } from './types/projectScanner';

type SelectedProject = {
  rootPath: string;
  name: string;
};

type PipelineExecutionSummary = {
  messages: string[];
  metadata: NonNullable<CommandResult['metadata']>;
  stage: CommandPipelineStage;
};

const MAX_RESULT_HISTORY = 8;

const initialScreenContext: ScreenContextSnapshot = {
  state: isScreenCaptureSupported() ? 'ready' : 'unavailable',
  width: null,
  height: null,
  capturedAt: null,
  errorMessage: null,
  lastIntent: null,
  ocrState: 'not_requested',
  ocrProvider: null,
  ocrTextLength: null,
  ocrErrorMessage: null,
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
      tone: screenContext.state === 'captured'
        ? 'ready'
        : screenContext.state === 'capturing'
          ? 'active'
          : screenContext.state === 'error' || screenContext.state === 'unavailable'
            ? 'warning'
            : 'idle',
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
    const command = createCommandInput(text, 'text');
    const plan = createCommandPlan(command);
    const startedResult: CommandResult = {
      id: createClientId(),
      commandId: command.id,
      source: command.source,
      contextMode: command.contextMode,
      intent: command.intent,
      pipelineStage: 'received',
      title: 'Command processing',
      summary: plan.pendingSummary,
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
      const execution = await executePipeline(plan);
      const completedResult: CommandResult = {
        ...startedResult,
        title: plan.title,
        summary: execution.messages.length > 0 ? execution.messages.join(' · ') : plan.readySummary,
        detail: command.text,
        nextStep: plan.nextStep,
        metadata: execution.metadata,
        status: 'completed',
        pipelineStage: execution.stage,
        completedAt: new Date().toISOString(),
        displayMode: plan.displayMode,
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
        nextStep: 'Check permission or command context',
        status: 'failed',
        pipelineStage: 'failed',
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

  async function executePipeline(plan: ReturnType<typeof createCommandPlan>): Promise<PipelineExecutionSummary> {
    const messages: string[] = [];
    const metadata: NonNullable<CommandResult['metadata']> = {};
    let stage: CommandPipelineStage = 'completed';

    if (plan.needsScreenCapture) {
      updateProcessingStage(plan.command.id, 'capturing_screen', 'Capturing selected screen');
      const captured = await refreshScreenContext(plan.command);
      const screenSize = `${captured.width}×${captured.height}`;
      messages.push(`Screen captured · ${screenSize}`);
      metadata.screenSize = screenSize;

      updateProcessingStage(plan.command.id, 'extracting_ocr', 'Extracting screen text');
      const ocrResult = await requestScreenOcr(plan.command, captured);
      messages.push(formatOcrPipelineMessage(ocrResult));
      metadata.ocrProvider = ocrResult.provider;
      metadata.ocrStatus = ocrResult.status;
      metadata.ocrTextFound = ocrResult.textFound;
      metadata.ocrTextLength = ocrResult.textLength;
      metadata.ocrPreview = ocrResult.preview;
      stage = 'analysis_ready';
    }

    if (plan.needsProjectManifest) {
      updateProcessingStage(plan.command.id, 'refreshing_manifest', 'Refreshing project manifest');
      if (selectedProject) {
        const summary = await refreshProjectManifest(selectedProject);
        messages.push(`Project refreshed · ${summary.targetFileCount.toLocaleString()} files`);
        metadata.manifestTargetFileCount = summary.targetFileCount;
        metadata.manifestExcludedFileCount = summary.excludedFileCount;
        metadata.projectContext = 'selected';
      } else {
        messages.push('Project context not selected');
        metadata.projectContext = 'not_selected';
      }
      stage = 'analysis_ready';
    }

    if (!plan.needsScreenCapture && !plan.needsProjectManifest) {
      messages.push('Command queued');
    }

    return {
      messages,
      metadata,
      stage,
    };
  }

  function updateProcessingStage(commandId: string, stage: CommandPipelineStage, summary: string) {
    setCommandResults((current) => current.map((result) => (
      result.commandId === commandId
        ? { ...result, pipelineStage: stage, summary }
        : result
    )));
  }

  async function refreshScreenContext(command: CommandInput): Promise<ScreenCaptureResult> {
    setScreenContext((current) => ({
      ...current,
      state: 'capturing',
      errorMessage: null,
      lastIntent: command.intent,
    }));

    try {
      const captured = await captureScreenFrame();
      setScreenContext({
        state: 'captured',
        width: captured.width,
        height: captured.height,
        capturedAt: captured.capturedAt,
        errorMessage: null,
        lastIntent: command.intent,
        ocrState: 'not_requested',
        ocrProvider: null,
        ocrTextLength: null,
        ocrErrorMessage: null,
      });

      return captured;
    } catch (caught) {
      const message = toErrorMessage(caught);
      setScreenContext({
        state: isScreenCaptureSupported() ? 'error' : 'unavailable',
        width: null,
        height: null,
        capturedAt: null,
        errorMessage: message,
        lastIntent: command.intent,
        ocrState: 'not_requested',
        ocrProvider: null,
        ocrTextLength: null,
        ocrErrorMessage: null,
      });
      throw new Error(message);
    }
  }

  async function requestScreenOcr(command: CommandInput, captured: ScreenCaptureResult): Promise<ScreenOcrResponse> {
    setScreenContext((current) => ({
      ...current,
      ocrState: 'extracting',
      ocrProvider: null,
      ocrTextLength: null,
      ocrErrorMessage: null,
    }));

    try {
      const response = await extractScreenOcr({
        commandId: command.id,
        intent: command.intent,
        contextMode: command.contextMode,
        image: {
          dataUrl: captured.imageDataUrl,
          mimeType: captured.mimeType,
          width: captured.width,
          height: captured.height,
          byteSize: captured.byteSize,
          capturedAt: captured.capturedAt,
        },
      });

      setScreenContext((current) => ({
        ...current,
        ocrState: 'completed',
        ocrProvider: response.provider,
        ocrTextLength: response.textLength,
        ocrErrorMessage: null,
      }));

      return response;
    } catch (caught) {
      const message = toErrorMessage(caught);
      setScreenContext((current) => ({
        ...current,
        ocrState: 'failed',
        ocrProvider: null,
        ocrTextLength: null,
        ocrErrorMessage: message,
      }));
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

function formatOcrPipelineMessage(result: ScreenOcrResponse): string {
  if (result.textFound) {
    return `OCR extracted · ${result.textLength.toLocaleString()} chars`;
  }

  return `OCR ready · ${result.provider}`;
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

function extractProjectName(path: string): string {
  const normalized = path.replaceAll('\\', '/').replace(/\/+$/g, '').trim();
  const name = normalized.split('/').pop();
  return name && name.trim().length > 0 ? name : 'Local Project';
}

function toErrorMessage(caught: unknown): string {
  return caught instanceof Error ? caught.message : String(caught);
}

export default App;
