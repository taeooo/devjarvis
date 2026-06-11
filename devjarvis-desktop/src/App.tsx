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
  getLocalSttHealth,
  transcribeWithLocalAgent,
} from './api/localAgentClient';
import { notifyCommandResult } from './utils/nativeWindow';
import { createClientId, createCommandInput, createCommandPlan } from './utils/commandRouter';
import {
  buildProjectAwareScreenDiagnosis,
  formatProjectDiagnosisContext,
  type ProjectAwareScreenDiagnosis,
} from './utils/projectScreenDiagnosis';
import { captureScreenFrame, isScreenCaptureSupported } from './utils/screenCapture';
import type {
  CommandInput,
  CommandPipelineStage,
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

type LocalAssistantReadiness = {
  ready: boolean;
  appReady: boolean;
  ocrReady: boolean;
  llmReady: boolean;
  message: string | null;
  checkedAt: string;
};

const MAX_RESULT_HISTORY = 8;
const PROJECT_ANALYSIS_CONTEXT_MAX_CHARS = 3600;
const PROJECT_ANALYSIS_SAMPLE_LIMIT = 48;

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
  const [latestProjectScan, setLatestProjectScan] = useState<ProjectScanResult | null>(null);
  const [micAvailable, setMicAvailable] = useState<boolean | null>(null);
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [screenContext, setScreenContext] = useState<ScreenContextSnapshot>(initialScreenContext);
  const [localAgentHealth, setLocalAgentHealth] = useState<LocalAgentHealthSnapshot>(initialLocalAgentHealth);
  const [isSelectingProject, setIsSelectingProject] = useState(false);
  const [isProcessingCommand, setIsProcessingCommand] = useState(false);
  const [lastCommand, setLastCommand] = useState<CommandInput | null>(null);
  const [commandResults, setCommandResults] = useState<CommandResult[]>([]);
  const [systemMessage, setSystemMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [commandPhaseLabel, setCommandPhaseLabel] = useState('Ready for text');
  const [isGuideOpen, setIsGuideOpen] = useState(false);

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
          setVoiceState((current) => (hasMicrophone ? current : 'unavailable'));
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

  const contextItems = useMemo<ContextStatusItem[]>(() => ([
    {
      key: 'screen',
      label: 'Screen',
      value: formatScreenContextValue(screenContext, isProcessingCommand, lastCommand),
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
      value: formatVoiceContextValue(voiceState),
      tone: voiceState === 'processing' || voiceState === 'recording'
        ? 'active'
        : voiceState === 'error' || voiceState === 'unavailable'
          ? 'warning'
          : 'idle',
    },
    {
      key: 'rag',
      label: 'RAG',
      value: selectedProject ? 'Project' : 'None',
      tone: selectedProject ? 'ready' : 'idle',
    },
  ]), [screenContext, selectedProject, localAgentHealth.state, isProcessingCommand, lastCommand, voiceState]);

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
      setLatestProjectScan(null);
      setSystemMessage('Project context selected.');
    } catch (caught) {
      setErrorMessage(toErrorMessage(caught));
    } finally {
      setIsSelectingProject(false);
    }
  }

  async function handlePushToTalk() {
    setSystemMessage(null);
    setErrorMessage(null);

    if (micAvailable === false) {
      setVoiceState('unavailable');
      setErrorMessage('Voice input requires a local microphone.');
      return;
    }

    setVoiceState('processing');
    try {
      await ensureLocalAssistantReady();
      const health = await getLocalSttHealth();
      if (!health.available) {
        setVoiceState('idle');
        setSystemMessage(health.warning ?? 'Local STT is not configured yet.');
        return;
      }

      const response = await transcribeWithLocalAgent({ commandId: createClientId(), audio: null });
      if (response.textReady && response.text.trim().length > 0) {
        setVoiceState('text_ready');
        await handleTextCommandSubmit(response.text);
        return;
      }

      setVoiceState('idle');
      setSystemMessage(response.warnings[0] ?? 'Local STT did not return text.');
    } catch (caught) {
      setVoiceState('error');
      setErrorMessage(toErrorMessage(caught));
    }
  }

  async function handleTextCommandSubmit(text: string) {
    const command = createCommandInput(text, 'text', { projectSelected: selectedProject !== null });
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
    setCommandPhaseLabel('Thinking');
    resetStaleContextForCommand(command);

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
      setCommandPhaseLabel('Done');
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
      setCommandPhaseLabel('Failed');
      setErrorMessage(message);
      void notifyCommandResult(failedResult);
      return;
    } finally {
      setIsProcessingCommand(false);
    }

  }

  async function executePipeline(plan: ReturnType<typeof createCommandPlan>): Promise<PipelineExecutionSummary> {
    const messages: string[] = [];
    const metadata: NonNullable<CommandResult['metadata']> = {};
    let stage: CommandPipelineStage = 'completed';
    let captured: ScreenCaptureResult | null = null;
    let ocrResult: ScreenOcrResponse | null = null;
    let projectScan: ProjectScanResult | null = null;
    let projectDiagnosis: ProjectAwareScreenDiagnosis | null = null;
    const shouldUseProjectForScreenDiagnosis = plan.command.intent === 'screen_error_analysis' && selectedProject !== null;

    if (plan.needsScreenCapture) {
      updateProcessingStage(plan.command.id, 'received', 'Checking local assistant');
      await ensureLocalAssistantReady();

      updateProcessingStage(plan.command.id, 'waiting_for_screen_selection', 'Waiting for screen selection');
      updateProcessingStage(plan.command.id, 'capturing_screen', 'Capturing selected screen');
      captured = await refreshScreenContext(plan.command);
      const screenSize = `${captured.width}×${captured.height}`;
      messages.push(`Screen captured · ${screenSize}`);
      metadata.screenSize = screenSize;
      const resolvedTarget = resolveScreenTargetAfterCapture(plan.command);
      metadata.screenTarget = screenContextLabel(resolvedTarget);
      metadata.screenTargetPolicy = resolvedTarget.policy;

      updateProcessingStage(plan.command.id, 'extracting_ocr', 'Reading screen text');
      ocrResult = await requestScreenOcr(plan.command, captured);
      messages.push(formatOcrPipelineMessage(ocrResult));
      metadata.ocrTextFound = ocrResult.textFound;
      metadata.ocrTextLength = ocrResult.textLength;
    }

    if (plan.needsProjectManifest || shouldUseProjectForScreenDiagnosis) {
      updateProcessingStage(plan.command.id, 'refreshing_manifest', shouldUseProjectForScreenDiagnosis ? 'Preparing project context' : 'Refreshing project manifest');
      if (selectedProject) {
        const summary = await refreshProjectManifest(selectedProject);
        projectScan = summary.scan;
        const targetFileCount = summary.registration?.targetFileCount ?? summary.scan.summary.targetFileCount;
        const excludedFileCount = summary.registration?.excludedFileCount ?? summary.scan.summary.excludedFileCount;
        messages.push(`Project manifest ready · ${targetFileCount.toLocaleString()} files`);
        metadata.manifestTargetFileCount = targetFileCount;
        metadata.manifestExcludedFileCount = excludedFileCount;
        metadata.projectContext = 'selected';
      } else {
        messages.push('Project context not selected');
        metadata.projectContext = 'not_selected';
      }
      stage = 'analysis_ready';
    }

    if (captured && ocrResult) {
      if (plan.command.intent === 'screen_math_solver') {
        updateProcessingStage(plan.command.id, 'solving_math', 'Solving math');
      } else {
        updateProcessingStage(plan.command.id, 'analyzing_screen', shouldUseProjectForScreenDiagnosis ? 'Analyzing screen with project context' : 'Analyzing screen text');
      }

      if (shouldUseProjectForScreenDiagnosis && projectScan && ocrResult.textFound) {
        projectDiagnosis = buildProjectAwareScreenDiagnosis(ocrResult.text, projectScan.files);
        metadata.relatedProjectFiles = projectDiagnosis.relatedFiles;
        metadata.projectAwareSignalCount = projectDiagnosis.signals.length;
        metadata.projectAwareFileCandidateCount = projectDiagnosis.relatedFiles.length;
      }

      const analysisResult = await requestScreenAnalysis(plan.command, captured, ocrResult, projectDiagnosis);
      messages.push(formatAnalysisPipelineMessage(analysisResult));
      metadata.analysisTitle = analysisResult.title;
      metadata.analysisSummary = analysisResult.summary;
      metadata.analysisDetail = analysisResult.detail;
      metadata.analysisPreview = analysisResult.preview;
      metadata.analysisActionItems = analysisResult.actionItems;
      metadata.analysisSource = 'local_agent';
      stage = 'analysis_ready';
    }

    if (!plan.needsScreenCapture && plan.needsProjectManifest && selectedProject && projectScan) {
      updateProcessingStage(plan.command.id, 'analyzing_project', 'Analyzing project');
      await ensureLocalAssistantReady();
      const analysis = await requestProjectAnalysis(plan.command, projectScan);
      messages.push(analysis.summary);
      metadata.analysisTitle = analysis.title;
      metadata.analysisSummary = analysis.summary;
      metadata.analysisDetail = analysis.detail;
      metadata.analysisPreview = analysis.preview;
      metadata.analysisActionItems = analysis.actionItems;
      metadata.analysisSource = 'local_agent';
      stage = 'analysis_ready';
    }

    if (!plan.needsScreenCapture && !plan.needsProjectManifest) {
      updateProcessingStage(plan.command.id, 'thinking', 'Thinking');
      await ensureLocalAssistantReady();
      const analysis = await requestTextAnalysis(plan.command);
      messages.push(analysis.summary);
      metadata.analysisTitle = analysis.title;
      metadata.analysisSummary = analysis.summary;
      metadata.analysisDetail = analysis.detail;
      metadata.analysisPreview = analysis.preview;
      metadata.analysisActionItems = analysis.actionItems;
      metadata.analysisSource = 'local_agent';
      stage = 'analysis_ready';
    }

    return { messages, metadata, stage };
  }

  function updateProcessingStage(commandId: string, stage: CommandPipelineStage, summary: string) {
    setCommandPhaseLabel(summary);
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
    projectDiagnosis: ProjectAwareScreenDiagnosis | null = null,
  ): Promise<ScreenAnalysisResponse> {
    setScreenContext((current) => ({
      ...current,
      analysisState: 'analyzing',
      analysisProvider: null,
      analysisErrorMessage: null,
    }));

    try {
      const response = await requestLocalScreenAnalysis(command, captured, ocrResult, projectDiagnosis);

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
    projectDiagnosis: ProjectAwareScreenDiagnosis | null,
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
      context: buildLocalAnalysisContext(command, captured, ocrResult, projectDiagnosis),
    });

    return mapLocalAgentAnalysisResponse(command, ocrResult, localResponse);
  }

  async function refreshProjectManifest(
    projectContext: SelectedProject,
  ): Promise<{ registration: ManifestRegisterResponse | null; scan: ProjectScanResult }> {
    const scanResult = await invoke<ProjectScanResult>('scan_project_manifest', { rootPath: projectContext.rootPath });
    setLatestProjectScan(scanResult);

    try {
      const project = registeredProject?.rootPathAlias === scanResult.rootPathAlias
        ? registeredProject
        : await createProject({
          name: scanResult.rootName || projectContext.name,
          rootPathAlias: scanResult.rootPathAlias,
          description: 'Desktop command context source.',
        });

      const summary = await registerProjectManifest(project.id, scanResult.files);
      setRegisteredProject(project);
      setLatestSummary(summary);
      return { registration: summary, scan: scanResult };
    } catch {
      setLatestSummary(null);
      return { registration: null, scan: scanResult };
    }
  }

  function resetStaleContextForCommand(command: CommandInput) {
    if (command.contextMode === 'screen' || command.contextMode === 'auto') return;

    setScreenContext((current) => ({
      ...initialScreenContext,
      state: current.state === 'unavailable' ? 'unavailable' : initialScreenContext.state,
      target: initialScreenTarget,
    }));
  }

  async function requestProjectAnalysis(command: CommandInput, scanResult: ProjectScanResult): Promise<ScreenAnalysisResponse> {
    const summary = summarizeProjectManifestForLocalAnalysis(scanResult);
    const response = await analyzeWithLocalAgent({
      commandId: command.id,
      intent: command.intent,
      text: command.text,
      context: summary,
    });

    return mapLocalAgentAnalysisResponse(command, { textLength: summary.length } as ScreenOcrResponse, response);
  }

  async function requestTextAnalysis(command: CommandInput): Promise<ScreenAnalysisResponse> {
    const response = await analyzeWithLocalAgent({
      commandId: command.id,
      intent: command.intent,
      text: command.text,
      context: null,
    });

    return mapLocalAgentAnalysisResponse(command, { textLength: command.text.length } as ScreenOcrResponse, response);
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
            commandPhaseLabel={commandPhaseLabel}
          />
          <CommandInputBar disabled={isProcessingCommand} onSubmit={handleTextCommandSubmit} />
        </div>

        <div className="side-stack">
          <VoiceStatusPanel
            micAvailable={micAvailable}
            voiceState={voiceState}
            disabled={isProcessingCommand}
            onPushToTalk={handlePushToTalk}
          />
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

function summarizeProjectManifestForLocalAnalysis(scanResult: ProjectScanResult): string {
  const activeFiles = scanResult.files.filter((file) => !file.excluded);
  const languageCounts = new Map<string, number>();
  const extensionCounts = new Map<string, number>();

  for (const file of activeFiles) {
    incrementCount(languageCounts, file.language || 'unknown');
    incrementCount(extensionCounts, file.extension || 'none');
  }

  const baseLines = [
    `projectRootName=${scanResult.rootName}`,
    `requestedFileCount=${scanResult.summary.requestedFileCount}`,
    `targetFileCount=${scanResult.summary.targetFileCount}`,
    `excludedFileCount=${scanResult.summary.excludedFileCount}`,
    `sensitiveFileCount=${scanResult.summary.sensitiveFileCount}`,
    '[languageCounts]',
    ...formatCountMapLines(languageCounts),
    '[extensionCounts]',
    ...formatCountMapLines(extensionCounts),
    '[sampleRelativePaths]',
  ];

  const sampleLines = activeFiles
    .slice(0, PROJECT_ANALYSIS_SAMPLE_LIMIT)
    .map((file) => `${file.relativePath}	${file.language}	${file.extension}`);

  return clampLinesToBudget([...baseLines, ...sampleLines], PROJECT_ANALYSIS_CONTEXT_MAX_CHARS);
}

function incrementCount(counts: Map<string, number>, key: string) {
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

function formatCountMapLines(counts: Map<string, number>): string[] {
  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 20)
    .map(([key, count]) => `${key}=${count}`);
}

function clampLinesToBudget(lines: string[], maxChars: number): string {
  const accepted: string[] = [];
  let used = 0;

  for (const line of lines) {
    const nextLength = used + line.length + (accepted.length > 0 ? 1 : 0);
    if (nextLength > maxChars) {
      break;
    }

    accepted.push(line);
    used = nextLength;
  }

  return accepted.join('\n');
}

function buildLocalAnalysisContext(
  command: CommandInput,
  captured: ScreenCaptureResult,
  ocrResult: ScreenOcrResponse,
  projectDiagnosis: ProjectAwareScreenDiagnosis | null = null,
): string {
  const userRequest = command.text.length > 240 ? `${command.text.slice(0, 237)}...` : command.text;
  const baseContext = [
    `selectedScreenSize=${captured.width}x${captured.height}`,
    `readableTextLength=${ocrResult.textLength}`,
    `requestType=${formatLocalAgentTitle(command.intent)}`,
    `userRequest=${userRequest}`,
  ];

  if (projectDiagnosis) {
    baseContext.push(formatProjectDiagnosisContext(projectDiagnosis));
  }

  return baseContext.join('\n');
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

function formatVoiceContextValue(state: VoiceState): string {
  if (state === 'processing') return 'Processing';
  if (state === 'recording') return 'Recording';
  if (state === 'text_ready') return 'Text ready';
  if (state === 'error') return 'Failed';
  if (state === 'unavailable') return 'Unavailable';
  return 'Push to talk';
}

function formatScreenContextValue(
  screenContext: ScreenContextSnapshot,
  isProcessing: boolean,
  lastCommand: CommandInput | null,
): string {
  if (isProcessing && lastCommand && lastCommand.contextMode !== 'screen' && lastCommand.contextMode !== 'auto') {
    return 'Idle';
  }

  if (screenContext.state === 'capturing') {
    return 'Capturing';
  }

  if (screenContext.state === 'captured') {
    return 'Last captured';
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
