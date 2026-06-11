import { useEffect, useMemo, useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { AppShell } from './components/AppShell';
import { AssistantGuideDialog } from './components/AssistantGuideDialog';
import { CommandInput as CommandInputBar } from './components/CommandInput';
import { CommandResultPanel } from './components/CommandResultPanel';
import { ContextStatusPanel } from './components/ContextStatusPanel';
import { JarvisCore } from './components/JarvisCore';
import { VoiceStatusPanel } from './components/VoiceStatusPanel';
import { createProject, registerProjectManifest } from './api/backendClient';
import {
  analyzeWithLocalAgent,
  extractScreenOcrWithLocalAgent,
  getLocalAgentAppHealth,
  getLocalAgentHealth,
  getLocalOcrHealth,
} from './api/localAgentClient';
import { notifyCommandResult } from './utils/nativeWindow';
import { createClientId, createCommandInput, createCommandPlan } from './utils/commandRouter';
import { captureScreenFrame, isScreenCaptureSupported } from './utils/screenCapture';
import type {
  CommandInput,
  CommandPipelineStage,
  ContextMode,
  CommandResult,
  ContextStatusItem,
  LocalAgentConnectionState,
  LocalAgentHealthSnapshot,
  LocalLlmAnalyzeResponse,
  ScreenAnalysisResponse,
  ScreenCaptureResult,
  ScreenContextSnapshot,
  ScreenOcrResponse,
  ScreenTargetSnapshot,
  SystemStatus,
} from './types/jarvisCommand';
import type { ManifestFile, ManifestRegisterResponse, ProjectResponse, ProjectScanResult, ScanSummary } from './types/projectScanner';

type SelectedProject = {
  rootPath: string;
  name: string;
};

type PipelineExecutionSummary = {
  messages: string[];
  metadata: NonNullable<CommandResult['metadata']>;
  stage: CommandPipelineStage;
};

type ProjectManifestRefresh = {
  registration: ManifestRegisterResponse;
  scanResult: ProjectScanResult;
  project: ProjectResponse;
};

type LocalAssistantReadiness = {
  ready: boolean;
  appReady: boolean;
  ocrReady: boolean;
  llmReady: boolean;
  message: string | null;
  checkedAt: string;
};

const MAX_RESULT_HISTORY = 8;

const initialScreenTarget: ScreenTargetSnapshot = {
  kind: 'not_selected',
  label: 'Not selected',
  policy: 'manual_picker_required',
  source: null,
  updatedAt: null,
};

const initialScreenContext: ScreenContextSnapshot = {
  state: isScreenCaptureSupported() ? 'ready' : 'unavailable',
  target: initialScreenTarget,
  width: null,
  height: null,
  capturedAt: null,
  errorMessage: null,
  lastIntent: null,
  ocrState: 'not_requested',
  ocrProvider: null,
  ocrTextLength: null,
  ocrErrorMessage: null,
  analysisState: 'not_requested',
  analysisProvider: null,
  analysisErrorMessage: null,
};

const initialLocalAgentHealth: LocalAgentHealthSnapshot = {
  state: 'checking',
  warning: null,
  checkedAt: null,
  errorMessage: null,
};

function App() {
  const [selectedProject, setSelectedProject] = useState<SelectedProject | null>(null);
  const [registeredProject, setRegisteredProject] = useState<ProjectResponse | null>(null);
  const [latestSummary, setLatestSummary] = useState<ManifestRegisterResponse | null>(null);
  const [micAvailable, setMicAvailable] = useState<boolean | null>(null);
  const [screenContext, setScreenContext] = useState<ScreenContextSnapshot>(initialScreenContext);
  const [localAgentHealth, setLocalAgentHealth] = useState<LocalAgentHealthSnapshot>(initialLocalAgentHealth);
  const [isSelectingProject, setIsSelectingProject] = useState(false);
  const [isProcessingCommand, setIsProcessingCommand] = useState(false);
  const [lastCommand, setLastCommand] = useState<CommandInput | null>(null);
  const [commandResults, setCommandResults] = useState<CommandResult[]>([]);
  const [systemMessage, setSystemMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function detectMicrophone() {
      if (!navigator.mediaDevices?.enumerateDevices) {
        if (!cancelled) {
          setMicAvailable(false);
        }
        return;
      }

      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const hasMicrophone = devices.some((device) => device.kind === 'audioinput');
        if (!cancelled) {
          setMicAvailable(hasMicrophone);
        }
      } catch {
        if (!cancelled) {
          setMicAvailable(false);
        }
      }
    }

    void detectMicrophone();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function pollLocalAssistant() {
      if (!cancelled) {
        setLocalAgentHealth((current) => ({
          ...current,
          state: 'checking',
          errorMessage: null,
        }));
      }

      const readiness = await checkLocalAssistantReadiness();
      if (cancelled) {
        return;
      }

      applyLocalAssistantReadiness(readiness);
    }

    void pollLocalAssistant();

    const intervalId = window.setInterval(() => {
      void pollLocalAssistant();
    }, 30000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  const systemStatus: SystemStatus = useMemo(() => {
    if (isProcessingCommand) {
      return 'Processing';
    }

    if (localAgentHealth.state === 'checking') {
      return 'Checking';
    }

    if (localAgentHealth.state === 'ready') {
      return 'Ready';
    }

    return 'Setup needed';
  }, [isProcessingCommand, localAgentHealth.state]);

  const activeCommandResult = useMemo(() => (
    isProcessingCommand
      ? commandResults.find((result) => result.status === 'processing' && result.commandId === lastCommand?.id) ?? null
      : null
  ), [commandResults, isProcessingCommand, lastCommand?.id]);

  const activeStageLabel = activeCommandResult
    ? formatPipelineStageLabel(activeCommandResult.pipelineStage, activeCommandResult.intent, activeCommandResult.contextMode)
    : null;

  const activeContextMode = activeCommandResult?.contextMode ?? null;

  const contextItems = useMemo<ContextStatusItem[]>(() => ([
    {
      key: 'screen',
      label: 'Screen',
      value: formatScreenContextValue(screenContext, isScreenContextActive(activeContextMode)),
      tone: resolveScreenContextTone(screenContext, activeContextMode),
    },
    {
      key: 'project',
      label: 'Project',
      value: selectedProject ? 'Selected' : 'Not selected',
      tone: selectedProject ? 'ready' : 'idle',
    },
    {
      key: 'localAgent',
      label: 'Assistant',
      value: formatLocalAssistantContextValue(localAgentHealth.state),
      tone: localAgentHealth.state === 'ready'
        ? 'ready'
        : localAgentHealth.state === 'checking'
          ? 'active'
          : 'warning',
    },
    {
      key: 'voice',
      label: 'Voice',
      value: 'Coming soon',
      tone: 'idle',
    },
    {
      key: 'rag',
      label: 'RAG',
      value: selectedProject ? formatProjectRagStatus(activeContextMode) : 'None',
      tone: selectedProject ? (isProjectContextActive(activeContextMode) ? 'active' : 'ready') : 'idle',
    },
  ]), [screenContext, selectedProject, localAgentHealth.state, activeContextMode]);

  async function refreshLocalAssistantReadiness(): Promise<LocalAssistantReadiness> {
    setLocalAgentHealth((current) => ({
      ...current,
      state: 'checking',
      errorMessage: null,
    }));

    const readiness = await checkLocalAssistantReadiness();
    applyLocalAssistantReadiness(readiness);
    return readiness;
  }

  function applyLocalAssistantReadiness(readiness: LocalAssistantReadiness) {
    setLocalAgentHealth({
      state: readiness.ready ? 'ready' : 'unavailable',
      warning: readiness.message,
      checkedAt: readiness.checkedAt,
      errorMessage: readiness.ready ? null : readiness.message,
    });
  }

  async function ensureLocalAssistantReady(): Promise<void> {
    const readiness = await refreshLocalAssistantReadiness();
    if (!readiness.ready) {
      throw new Error(readiness.message ?? getDefaultLocalAssistantSetupMessage());
    }
  }

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

    if (!plan.needsScreenCapture) {
      resetScreenActivityForNonScreenCommand();
    }

    setLastCommand(command);
    upsertCommandResult(startedResult);
    setSystemMessage(null);
    setErrorMessage(null);
    setIsProcessingCommand(true);

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
        nextStep: buildFailureNextStep(message),
        status: 'failed',
        pipelineStage: 'failed',
        completedAt: new Date().toISOString(),
        displayMode: 'open_app',
      };

      upsertCommandResult(failedResult);
      setErrorMessage(message);
      void notifyCommandResult(failedResult);
      return;
    } finally {
      setIsProcessingCommand(false);
    }

  }

  async function executePipeline(plan: ReturnType<typeof createCommandPlan>): Promise<PipelineExecutionSummary> {
    const messages: string[] = [];
    const metadata: NonNullable<CommandResult['metadata']> = {
      resultSource: resolveResultSource(plan.command.contextMode, plan.command.intent),
    };
    let stage: CommandPipelineStage = 'completed';

    if (plan.needsScreenCapture) {
      updateProcessingStage(plan.command.id, 'waiting_for_screen_selection');
      await ensureLocalAssistantReady();

      updateProcessingStage(plan.command.id, 'capturing_screen');
      const captured = await refreshScreenContext(plan.command);
      const screenSize = `${captured.width}×${captured.height}`;
      messages.push(`Screen captured · ${screenSize}`);
      metadata.screenSize = screenSize;
      const resolvedTarget = resolveScreenTargetAfterCapture(plan.command);
      metadata.screenTarget = screenContextLabel(resolvedTarget);
      metadata.screenTargetPolicy = resolvedTarget.policy;

      updateProcessingStage(plan.command.id, 'extracting_ocr');
      const ocrResult = await requestScreenOcr(plan.command, captured);
      messages.push(formatOcrPipelineMessage(ocrResult));
      metadata.ocrTextFound = ocrResult.textFound;
      metadata.ocrTextLength = ocrResult.textLength;

      updateProcessingStage(
        plan.command.id,
        plan.command.intent === 'screen_math_solver' ? 'solving_math' : 'analyzing_screen',
      );
      const analysisResult = await requestScreenAnalysis(plan.command, captured, ocrResult);
      messages.push(formatAnalysisPipelineMessage(analysisResult));
      metadata.analysisTitle = analysisResult.title;
      metadata.analysisSummary = analysisResult.summary;
      metadata.analysisDetail = analysisResult.detail;
      metadata.analysisPreview = analysisResult.preview;
      metadata.analysisActionItems = analysisResult.actionItems;
      metadata.analysisSource = 'local_agent';
      stage = 'analysis_ready';
    }

    if (plan.needsProjectManifest) {
      updateProcessingStage(plan.command.id, 'refreshing_manifest');
      if (selectedProject) {
        const refresh = await refreshProjectManifest(selectedProject);
        const { registration, scanResult } = refresh;
        messages.push(`Project refreshed · ${registration.targetFileCount.toLocaleString()} files`);
        metadata.manifestTargetFileCount = registration.targetFileCount;
        metadata.manifestExcludedFileCount = registration.excludedFileCount;
        metadata.projectContext = 'selected';
        metadata.projectLanguageSummary = formatProjectLanguageSummary(scanResult.files);
        metadata.projectDirectorySummary = formatTopLevelDirectorySummary(scanResult.files);

        updateProcessingStage(plan.command.id, 'analyzing_project');
        const projectAnalysis = await requestProjectAnalysis(plan.command, refresh);
        metadata.analysisTitle = formatLocalAgentTitle(plan.command.intent);
        metadata.analysisSummary = projectAnalysis.summary;
        metadata.analysisDetail = projectAnalysis.detail ?? projectAnalysis.summary;
        metadata.analysisPreview = summarizePreview(projectAnalysis.summary, projectAnalysis.detail);
        metadata.analysisActionItems = projectAnalysis.actionItems;
        metadata.analysisSource = 'local_agent';
        messages.push(projectAnalysis.summary || 'Project analysis ready');
      } else {
        messages.push('Project context not selected');
        metadata.projectContext = 'not_selected';
        metadata.analysisTitle = 'Project not selected';
        metadata.analysisSummary = 'Project를 먼저 선택한 뒤 프로젝트 분석 명령을 다시 실행해주세요.';
        metadata.analysisDetail = '프로젝트 전용 명령은 이전 화면 캡처나 계산 결과를 재사용하지 않습니다. Project 선택 후 다시 실행하면 manifest refresh와 local project analysis를 진행합니다.';
        metadata.analysisPreview = metadata.analysisSummary;
        metadata.analysisActionItems = ['Project 영역에서 분석할 폴더를 선택해주세요.'];
      }
      stage = 'analysis_ready';
    }

    if (!plan.needsScreenCapture && !plan.needsProjectManifest) {
      updateProcessingStage(
        plan.command.id,
        plan.command.intent === 'screen_math_solver' ? 'solving_math' : 'thinking',
      );
      const textAnalysis = await requestTextAnalysis(plan.command);
      metadata.analysisTitle = formatLocalAgentTitle(plan.command.intent);
      metadata.analysisSummary = textAnalysis.summary;
      metadata.analysisDetail = textAnalysis.detail ?? textAnalysis.summary;
      metadata.analysisPreview = summarizePreview(textAnalysis.summary, textAnalysis.detail);
      metadata.analysisActionItems = textAnalysis.actionItems;
      metadata.analysisSource = 'local_agent';
      messages.push(textAnalysis.summary || 'Response ready');
      stage = 'analysis_ready';
    }

    return {
      messages,
      metadata,
      stage,
    };
  }

  function resetScreenActivityForNonScreenCommand() {
    setScreenContext({
      ...initialScreenContext,
      state: isScreenCaptureSupported() ? 'ready' : 'unavailable',
    });
  }

  function updateProcessingStage(commandId: string, stage: CommandPipelineStage, summary?: string) {
    setCommandResults((current) => current.map((result) => (
      result.commandId === commandId
        ? {
          ...result,
          pipelineStage: stage,
          summary: summary ?? formatPipelineStageLabel(stage, result.intent, result.contextMode),
        }
        : result
    )));
  }

  async function refreshScreenContext(command: CommandInput): Promise<ScreenCaptureResult> {
    setScreenContext((current) => ({
      ...current,
      state: 'capturing',
      errorMessage: null,
      lastIntent: command.intent,
      target: resolveScreenTargetBeforeCapture(command, current.target),
    }));

    try {
      const captured = await captureScreenFrame();
      const capturedTarget = resolveScreenTargetAfterCapture(command);
      setScreenContext({
        state: 'captured',
        target: capturedTarget,
        width: captured.width,
        height: captured.height,
        capturedAt: captured.capturedAt,
        errorMessage: null,
        lastIntent: command.intent,
        ocrState: 'not_requested',
        ocrProvider: null,
        ocrTextLength: null,
        ocrErrorMessage: null,
        analysisState: 'not_requested',
        analysisProvider: null,
        analysisErrorMessage: null,
      });

      return captured;
    } catch (caught) {
      const message = toErrorMessage(caught);
      setScreenContext({
        state: isScreenCaptureSupported() ? 'error' : 'unavailable',
        target: resolveScreenTargetBeforeCapture(command, screenContext.target),
        width: null,
        height: null,
        capturedAt: null,
        errorMessage: message,
        lastIntent: command.intent,
        ocrState: 'not_requested',
        ocrProvider: null,
        ocrTextLength: null,
        ocrErrorMessage: null,
        analysisState: 'not_requested',
        analysisProvider: null,
        analysisErrorMessage: null,
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
      const response = await extractScreenOcrWithLocalAgent({
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

      if (response.status === 'failed') {
        throw new Error('Screen text extraction is not ready. Check the local assistant setup and retry.');
      }

      setScreenContext((current) => ({
        ...current,
        ocrState: 'completed',
        ocrProvider: null,
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

  async function requestScreenAnalysis(
    command: CommandInput,
    captured: ScreenCaptureResult,
    ocrResult: ScreenOcrResponse,
  ): Promise<ScreenAnalysisResponse> {
    setScreenContext((current) => ({
      ...current,
      analysisState: 'analyzing',
      analysisProvider: null,
      analysisErrorMessage: null,
    }));

    try {
      const response = await requestLocalScreenAnalysis(command, captured, ocrResult);

      setScreenContext((current) => ({
        ...current,
        analysisState: 'completed',
        analysisProvider: response.provider,
        analysisErrorMessage: null,
      }));

      return response;
    } catch (caught) {
      const message = toErrorMessage(caught);
      setScreenContext((current) => ({
        ...current,
        analysisState: 'failed',
        analysisProvider: null,
        analysisErrorMessage: message,
      }));
      throw new Error(message);
    }
  }

  async function requestLocalScreenAnalysis(
    command: CommandInput,
    captured: ScreenCaptureResult,
    ocrResult: ScreenOcrResponse,
  ): Promise<ScreenAnalysisResponse> {
    if (!ocrResult.textFound || ocrResult.text.trim().length === 0) {
      return {
        requestId: command.id,
        provider: 'local-agent',
        status: 'no_text',
        intent: command.intent,
        title: 'No readable text',
        summary: 'No readable text was extracted from the selected screen.',
        detail: '',
        preview: 'No readable text was extracted.',
        actionItems: ['Try selecting a clearer screen or window.'],
        textUsedLength: 0,
        warnings: ['ocr_text_empty'],
        analyzedAt: new Date().toISOString(),
      };
    }

    const localResponse = await analyzeWithLocalAgent({
      commandId: command.id,
      intent: command.intent,
      text: ocrResult.text,
      context: buildLocalAnalysisContext(command, captured, ocrResult),
    });

    return mapLocalAgentAnalysisResponse(command, ocrResult, localResponse);
  }

  async function refreshProjectManifest(projectContext: SelectedProject): Promise<ProjectManifestRefresh> {
    const scanResult = await invoke<ProjectScanResult>('scan_project_manifest', { rootPath: projectContext.rootPath });
    const project = registeredProject ?? await createProject({
      name: scanResult.rootName || projectContext.name,
      rootPathAlias: scanResult.rootPathAlias,
      description: 'Desktop command context source.',
    });

    const registration = await registerProjectManifest(project.id, scanResult.files);
    setRegisteredProject(project);
    setLatestSummary(registration);
    return { registration, scanResult, project };
  }

  async function requestTextAnalysis(command: CommandInput): Promise<LocalLlmAnalyzeResponse> {
    const response = await analyzeWithLocalAgent({
      commandId: command.id,
      intent: command.intent,
      text: command.text,
      context: null,
    });

    if (response.status === 'failed') {
      throw new Error(response.summary || 'Local text analysis failed.');
    }

    return response;
  }

  async function requestProjectAnalysis(
    command: CommandInput,
    refresh: ProjectManifestRefresh,
  ): Promise<LocalLlmAnalyzeResponse> {
    const response = await analyzeWithLocalAgent({
      commandId: command.id,
      intent: command.intent,
      text: command.text,
      context: buildProjectAnalysisContext(refresh.scanResult, refresh.registration),
    });

    if (response.status === 'failed') {
      throw new Error(response.summary || 'Local project analysis failed.');
    }

    return response;
  }

  function upsertCommandResult(result: CommandResult) {
    setCommandResults((current) => {
      const next = [result, ...current.filter((item) => item.commandId !== result.commandId)];
      return next.slice(0, MAX_RESULT_HISTORY);
    });
  }

  return (
    <AppShell status={systemStatus} onOpenGuide={() => setIsGuideOpen(true)}>
      <section className="command-shell-layout">
        <div className="main-command-zone">
          <JarvisCore
            assistantState={localAgentHealth.state}
            isProcessing={isProcessingCommand}
            lastCommand={lastCommand}
            systemMessage={systemMessage}
            errorMessage={errorMessage}
            activityLabel={activeStageLabel}
          />
          <CommandInputBar disabled={isProcessingCommand} onSubmit={handleTextCommandSubmit} />
        </div>

        <div className="side-stack">
          <VoiceStatusPanel micAvailable={micAvailable} />
          <ContextStatusPanel
            items={contextItems}
            projectName={selectedProject?.name ?? null}
            isSelectingProject={isSelectingProject}
            isProcessing={isProcessingCommand}
            onSelectProject={handleSelectProjectFolder}
          />
          <CommandResultPanel results={commandResults} />
        </div>
      </section>
      {isGuideOpen && <AssistantGuideDialog onClose={() => setIsGuideOpen(false)} />}
    </AppShell>
  );
}




function isScreenContextActive(contextMode: ContextMode | null): boolean {
  return contextMode === 'screen' || contextMode === 'auto';
}

function isProjectContextActive(contextMode: ContextMode | null): boolean {
  return contextMode === 'project' || contextMode === 'auto';
}

function resolveScreenContextTone(screenContext: ScreenContextSnapshot, activeContextMode: ContextMode | null): ContextStatusItem['tone'] {
  if (!isScreenContextActive(activeContextMode)) {
    return screenContext.state === 'unavailable' || screenContext.state === 'error' ? 'warning' : 'idle';
  }

  if (screenContext.state === 'capturing') {
    return 'active';
  }

  if (screenContext.state === 'captured') {
    return 'ready';
  }

  if (screenContext.state === 'error' || screenContext.state === 'unavailable') {
    return 'warning';
  }

  return 'idle';
}

function formatProjectRagStatus(activeContextMode: ContextMode | null): string {
  return isProjectContextActive(activeContextMode) ? 'Project active' : 'Project ready';
}

function resolveResultSource(contextMode: ContextMode, intent: CommandInput['intent']): NonNullable<CommandResult['metadata']>['resultSource'] {
  if (contextMode === 'project') {
    return 'project';
  }

  if (contextMode === 'screen' && intent === 'screen_math_solver') {
    return 'screen_math';
  }

  if (contextMode === 'screen') {
    return 'screen';
  }

  if (contextMode === 'auto') {
    return 'auto';
  }

  return 'text';
}

function formatPipelineStageLabel(stage: CommandPipelineStage, intent: CommandInput['intent'], contextMode: ContextMode): string {
  switch (stage) {
    case 'received':
      return 'Preparing command';
    case 'waiting_for_screen_selection':
      return 'Waiting for screen selection';
    case 'capturing_screen':
      return 'Capturing selected screen';
    case 'extracting_ocr':
      return 'Reading screen text';
    case 'solving_math':
      return 'Solving math';
    case 'analyzing_screen':
      return 'Analyzing screen';
    case 'refreshing_manifest':
      return 'Refreshing project context';
    case 'analyzing_project':
      return 'Analyzing project';
    case 'thinking':
      return 'Thinking';
    case 'analysis_ready':
    case 'completed':
      return contextMode === 'project'
        ? 'Done · Project'
        : intent === 'screen_math_solver'
          ? 'Done · Math'
          : 'Done';
    case 'failed':
      return 'Failed';
  }
}

async function checkLocalAssistantReadiness(): Promise<LocalAssistantReadiness> {
  const checkedAt = new Date().toISOString();
  const [appResult, ocrResult, llmResult] = await Promise.allSettled([
    getLocalAgentAppHealth(),
    getLocalOcrHealth(),
    getLocalAgentHealth(),
  ]);

  const appReady = appResult.status === 'fulfilled'
    && appResult.value.status === 'UP'
    && appResult.value.loopbackOnly === true;
  const ocrReady = ocrResult.status === 'fulfilled' && ocrResult.value.available === true;
  const llmReady = llmResult.status === 'fulfilled' && llmResult.value.available === true;
  const ready = appReady && ocrReady && llmReady;

  return {
    ready,
    appReady,
    ocrReady,
    llmReady,
    message: ready ? null : buildLocalAssistantSetupMessage(appReady, ocrReady, llmReady),
    checkedAt,
  };
}

function buildLocalAssistantSetupMessage(appReady: boolean, ocrReady: boolean, llmReady: boolean): string {
  if (!appReady) {
    return 'Local Assistant is not running. Start DevJarvis Local Agent, then retry.';
  }

  if (!ocrReady) {
    return 'Local screen reading is not ready. Check the Local Agent OCR setup, then retry.';
  }

  if (!llmReady) {
    return 'Local reasoning is not ready. Start Ollama and install the configured local models, then retry.';
  }

  return getDefaultLocalAssistantSetupMessage();
}

function getDefaultLocalAssistantSetupMessage(): string {
  return 'Local Assistant is not ready. Start the local services, then retry.';
}

function buildFailureNextStep(message: string): string {
  if (message.toLowerCase().includes('local')) {
    return 'Start Local Agent and Ollama, then retry';
  }

  return 'Check permission or command context';
}


function buildProjectAnalysisContext(scanResult: ProjectScanResult, registration: ManifestRegisterResponse): string {
  const targetFiles = scanResult.files.filter((file) => !file.excluded);
  const languageSummary = formatProjectLanguageSummary(scanResult.files);
  const directorySummary = formatTopLevelDirectorySummary(scanResult.files);
  const extensionSummary = formatProjectExtensionSummary(targetFiles);
  const representativeFiles = targetFiles
    .slice(0, 36)
    .map((file) => file.relativePath)
    .join('\n');

  const context = [
    `projectName=${scanResult.rootName}`,
    `registeredTargetFiles=${registration.targetFileCount}`,
    `registeredExcludedFiles=${registration.excludedFileCount}`,
    formatScanSummary(scanResult.summary),
    `languages=${languageSummary}`,
    `extensions=${extensionSummary}`,
    `topLevelDirectories=${directorySummary}`,
    representativeFiles ? `[Representative relative paths]\n${representativeFiles}` : '',
    'Do not infer unseen file contents. Use only manifest-level structure, relative paths, language counts, and the user command.',
  ].filter(Boolean).join('\n');

  return context.length > 3800 ? `${context.slice(0, 3790)}\n...` : context;
}

function formatScanSummary(summary: ScanSummary): string {
  return [
    `requestedFiles=${summary.requestedFileCount}`,
    `targetFiles=${summary.targetFileCount}`,
    `excludedFiles=${summary.excludedFileCount}`,
    `sensitiveFiles=${summary.sensitiveFileCount}`,
    `largeFiles=${summary.largeFileCount}`,
    `generatedOrToolingFiles=${summary.generatedOrToolingFileCount}`,
  ].join('\n');
}

function formatProjectLanguageSummary(files: ManifestFile[]): string {
  return formatCountMap(countBy(files.filter((file) => !file.excluded), (file) => file.language || 'unknown'), 8);
}

function formatProjectExtensionSummary(files: ManifestFile[]): string {
  return formatCountMap(countBy(files, (file) => file.extension || '(none)'), 8);
}

function formatTopLevelDirectorySummary(files: ManifestFile[]): string {
  return formatCountMap(
    countBy(files.filter((file) => !file.excluded), (file) => file.relativePath.split('/')[0] || '(root)'),
    10,
  );
}

function countBy<T>(items: T[], selector: (item: T) => string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = selector(item).trim() || 'unknown';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function formatCountMap(counts: Map<string, number>, limit: number): string {
  const entries = [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit);

  return entries.length > 0
    ? entries.map(([key, count]) => `${key}:${count}`).join(', ')
    : 'none';
}

function buildLocalAnalysisContext(command: CommandInput, captured: ScreenCaptureResult, ocrResult: ScreenOcrResponse): string {
  const userRequest = command.text.length > 240 ? `${command.text.slice(0, 237)}...` : command.text;

  return [
    `selectedScreenSize=${captured.width}x${captured.height}`,
    `readableTextLength=${ocrResult.textLength}`,
    `requestType=${formatLocalAgentTitle(command.intent)}`,
    `userRequest=${userRequest}`,
  ].join('\n');
}

function mapLocalAgentAnalysisResponse(
  command: CommandInput,
  ocrResult: ScreenOcrResponse,
  response: LocalLlmAnalyzeResponse,
): ScreenAnalysisResponse {
  const title = response.status === 'completed' ? formatLocalAgentTitle(command.intent) : 'Local analysis failed';
  const summary = response.summary || 'Local Agent returned an empty summary.';

  return {
    requestId: command.id,
    provider: 'local-agent',
    status: response.status,
    intent: command.intent,
    title,
    summary,
    detail: response.detail ?? summary,
    preview: summarizePreview(summary, response.detail),
    actionItems: response.actionItems ?? [],
    textUsedLength: ocrResult.textLength,
    warnings: response.warnings ?? [],
    analyzedAt: new Date().toISOString(),
  };
}

function formatLocalAgentTitle(intent: CommandInput['intent']): string {
  switch (intent) {
    case 'screen_translate':
      return 'Translation ready';
    case 'screen_summary':
      return 'Summary ready';
    case 'screen_error_analysis':
      return 'Diagnosis ready';
    case 'screen_math_solver':
      return 'Calculation ready';
    case 'project_diagnosis':
      return 'Project diagnosis ready';
    case 'log_analysis':
      return 'Log analysis ready';
    case 'general_chat':
      return 'Response ready';
  }
}

function summarizePreview(summary: string, detail: string | null): string {
  const text = (detail && detail.trim().length > summary.trim().length ? detail : summary).trim();
  return text.length > 240 ? `${text.slice(0, 237)}...` : text;
}

function resolveScreenTargetBeforeCapture(command: CommandInput, current: ScreenTargetSnapshot): ScreenTargetSnapshot {
  if (command.source === 'voice') {
    return {
      kind: 'foreground_window',
      label: 'Foreground window',
      policy: 'voice_foreground_first',
      source: command.source,
      updatedAt: new Date().toISOString(),
    };
  }

  if (current.kind !== 'not_selected' && current.kind !== 'manual_picker') {
    return {
      ...current,
      policy: 'text_last_target_first',
      source: command.source,
      updatedAt: new Date().toISOString(),
    };
  }

  return {
    kind: 'manual_picker',
    label: 'Select screen/window',
    policy: 'manual_picker_required',
    source: command.source,
    updatedAt: new Date().toISOString(),
  };
}

function resolveScreenTargetAfterCapture(command: CommandInput): ScreenTargetSnapshot {
  return {
    kind: 'user_selected',
    label: command.source === 'voice' ? 'Selected after voice command' : 'Selected for text command',
    policy: command.source === 'voice' ? 'voice_foreground_first' : 'text_last_target_first',
    source: command.source,
    updatedAt: new Date().toISOString(),
  };
}

function screenContextLabel(target: ScreenTargetSnapshot): string {
  return target.label;
}

function formatAnalysisPipelineMessage(result: ScreenAnalysisResponse): string {
  if (result.status === 'no_text') {
    return 'Analysis waiting for readable text';
  }

  return result.title || 'Analysis ready';
}

function formatOcrPipelineMessage(result: ScreenOcrResponse): string {
  if (result.textFound) {
    return `Screen text extracted · ${result.textLength.toLocaleString()} chars`;
  }

  return 'No readable text found';
}

function formatLocalAssistantContextValue(state: LocalAgentConnectionState): string {
  if (state === 'ready') {
    return 'Ready';
  }

  if (state === 'checking') {
    return 'Checking';
  }

  return 'Setup needed';
}

function formatScreenContextValue(screenContext: ScreenContextSnapshot, active: boolean): string {
  if (!active) {
    return screenContext.state === 'unavailable' ? 'Unavailable' : 'Ready';
  }

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
