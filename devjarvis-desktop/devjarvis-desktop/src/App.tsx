import { useEffect, useMemo, useRef, useState } from 'react';
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
import { recordShortLocalAudio } from './utils/localAudioCapture';
import { buildResultSpeech, getDevJarvisSpeechProfile, speakDevJarvis, speakDevJarvisNow, warmupDevJarvisVoices } from './utils/voiceFeedback';
import { createClientId, createCommandInput, createCommandPlan, isWakePhraseText, stripWakePhrase, trySolveInlineMathCommand } from './utils/commandRouter';
import {
  buildProjectAwareScreenDiagnosis,
  formatProjectDiagnosisContext,
  type ProjectAwareScreenDiagnosis,
} from './utils/projectScreenDiagnosis';
import { captureScreenFrame, isScreenCaptureSupported } from './utils/screenCapture';
import type {
  CommandInput,
  CommandPipelineStage,
  CommandSource,
  CommandResult,
  ContextStatusItem,
  LocalAgentConnectionState,
  LocalAgentHealthSnapshot,
  LocalLlmAnalyzeResponse,
  RelatedProjectFileCandidate,
  ScreenAnalysisResponse,
  ScreenCaptureResult,
  ScreenContextSnapshot,
  ScreenOcrResponse,
  ScreenTargetSnapshot,
  SystemStatus,
  VoiceState,
} from './types/jarvisCommand';
import type { ManifestFile, ManifestRegisterResponse, ProjectFileReadResult, ProjectResponse, ProjectScanResult } from './types/projectScanner';

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

const MAX_RESULT_HISTORY = 12;
const WAKE_LISTEN_CHUNK_MILLIS = 2600;
const WAKE_LISTEN_RETRY_MILLIS = 800;
const VOICE_COMMAND_RECORDING_MILLIS = 7600;

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
  const [wakeStatusMessage, setWakeStatusMessage] = useState('헤이 자비스 대기');
  const [pendingVoiceScreenCommand, setPendingVoiceScreenCommand] = useState<string | null>(null);
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
  const voiceStateRef = useRef<VoiceState>('idle');
  const isProcessingCommandRef = useRef(false);
  const pendingVoiceScreenCommandRef = useRef<string | null>(null);
  const micAvailableRef = useRef<boolean | null>(null);
  const localAgentStateRef = useRef<LocalAgentConnectionState>('checking');
  const wakeLoopBusyRef = useRef(false);


  useEffect(() => {
    voiceStateRef.current = voiceState;
  }, [voiceState]);

  useEffect(() => {
    isProcessingCommandRef.current = isProcessingCommand;
  }, [isProcessingCommand]);

  useEffect(() => {
    pendingVoiceScreenCommandRef.current = pendingVoiceScreenCommand;
  }, [pendingVoiceScreenCommand]);

  useEffect(() => {
    micAvailableRef.current = micAvailable;
  }, [micAvailable]);

  useEffect(() => {
    localAgentStateRef.current = localAgentHealth.state;
  }, [localAgentHealth.state]);

  useEffect(() => {
    warmupDevJarvisVoices();
  }, []);

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
      tone: voiceState === 'processing' || voiceState === 'recording' || voiceState === 'speaking'
        ? 'active'
        : voiceState === 'error' || voiceState === 'unavailable'
          ? 'warning'
          : 'idle',
    },
  ]), [screenContext, localAgentHealth.state, isProcessingCommand, lastCommand, voiceState]);

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

  async function handleManualVoiceInput() {
    setSystemMessage(null);
    setErrorMessage(null);
    setPendingVoiceScreenCommand(null);

    if (micAvailable === false) {
      setVoiceState('unavailable');
      setErrorMessage('마이크를 사용할 수 없습니다. 헤드셋/마이크 권한을 확인해주세요.');
      speakDevJarvisNow('마이크를 사용할 수 없습니다.');
      return;
    }

    try {
      await ensureVoiceInputReady();
      setVoiceState('speaking');
      await speakDevJarvis('네, 말씀하세요.');
      await captureAndSubmitVoiceCommand('manual');
    } catch (caught) {
      setVoiceState('error');
      const message = toErrorMessage(caught);
      setErrorMessage(message);
      speakDevJarvisNow('음성 명령을 처리하지 못했습니다.');
    }
  }

  async function ensureVoiceInputReady(): Promise<void> {
    await ensureLocalAssistantReady();
    const health = await getLocalSttHealth();
    if (!health.available) {
      const message = health.warning ?? '로컬 음성 인식 설정이 필요합니다.';
      setVoiceState('idle');
      setSystemMessage(message);
      speakDevJarvisNow('로컬 음성 인식 설정이 필요합니다.');
      throw new Error(message);
    }
  }

  async function captureAndSubmitVoiceCommand(mode: 'manual' | 'wake'): Promise<void> {
    setVoiceState('recording');
    const audio = await recordShortLocalAudio(VOICE_COMMAND_RECORDING_MILLIS);

    setVoiceState('processing');
    const response = await transcribeWithLocalAgent({ commandId: createClientId(), audio });
    const recognizedText = stripWakePhrase(response.text ?? '');
    if (response.textReady && recognizedText.length > 0) {
      setVoiceState('text_ready');
      setSystemMessage(`인식된 명령: ${recognizedText}`);
      await handleTextCommandSubmit(recognizedText, 'voice');
      return;
    }

    setVoiceState('idle');
    const message = mode === 'wake'
      ? '명령을 듣지 못했습니다. 다시 헤이 자비스라고 불러주세요.'
      : response.warnings[0] ?? '음성을 인식하지 못했습니다. 다시 말씀해주세요.';
    setSystemMessage(message);
    speakDevJarvisNow(message);
  }

  useEffect(() => {
    let cancelled = false;
    let timerId: number | null = null;

    async function scheduleNext(delay = WAKE_LISTEN_RETRY_MILLIS) {
      if (cancelled) return;
      timerId = window.setTimeout(() => {
        void runWakeListenLoop();
      }, delay);
    }

    async function runWakeListenLoop() {
      if (cancelled) return;

      if (!canRunWakeListenLoop()) {
        await scheduleNext(1400);
        return;
      }

      if (wakeLoopBusyRef.current) {
        await scheduleNext(1200);
        return;
      }

      wakeLoopBusyRef.current = true;
      try {
        const health = await getLocalSttHealth();
        if (!health.available) {
          setWakeStatusMessage('음성 호출 준비 필요');
          await scheduleNext(5000);
          return;
        }

        setWakeStatusMessage('헤이 자비스 대기');
        const audio = await recordShortLocalAudio(WAKE_LISTEN_CHUNK_MILLIS);
        if (!canRunWakeListenLoop()) {
          await scheduleNext();
          return;
        }

        const response = await transcribeWithLocalAgent({ commandId: createClientId(), audio });
        const transcript = response.text ?? '';
        if (response.textReady && isWakePhraseText(transcript)) {
          setWakeStatusMessage('호출 감지됨');
          setVoiceState('speaking');
          await speakDevJarvis('네, 말씀하세요.');
          if (!cancelled) {
            await captureAndSubmitVoiceCommand('wake');
          }
          await scheduleNext(1800);
          return;
        }

        await scheduleNext();
      } catch {
        setWakeStatusMessage('음성 호출 확인 중');
        await scheduleNext(2500);
      } finally {
        wakeLoopBusyRef.current = false;
      }
    }

    function canRunWakeListenLoop(): boolean {
      return micAvailableRef.current === true
        && localAgentStateRef.current === 'ready'
        && voiceStateRef.current === 'idle'
        && !isProcessingCommandRef.current
        && pendingVoiceScreenCommandRef.current === null;
    }

    void scheduleNext(900);

    return () => {
      cancelled = true;
      if (timerId !== null) {
        window.clearTimeout(timerId);
      }
    };
  }, []);

  async function handleSelectPendingVoiceScreen() {
    if (!pendingVoiceScreenCommand || isProcessingCommand) {
      return;
    }

    const commandText = pendingVoiceScreenCommand;
    setPendingVoiceScreenCommand(null);
    await handleTextCommandSubmit(commandText, 'voice', { forceScreenSelection: true });
  }

  async function handleTextCommandSubmit(text: string, source: CommandSource = 'text', options: { forceScreenSelection?: boolean } = {}) {
    const command = createCommandInput(text, source, { hasSelectedProject: selectedProject !== null });
    const plan = createCommandPlan(command);

    if (source === 'voice' && plan.needsScreenCapture && !options.forceScreenSelection) {
      setPendingVoiceScreenCommand(text);
      setVoiceState('idle');
      const pendingResult: CommandResult = {
        id: createClientId(),
        commandId: command.id,
        source: command.source,
        contextMode: command.contextMode,
        intent: command.intent,
        pipelineStage: 'waiting_for_screen_selection',
        title: '화면 선택 필요',
        summary: '음성 명령을 인식했습니다. 화면 선택 버튼을 눌러 공유 창을 열어주세요.',
        detail: command.text,
        nextStep: '오른쪽 Voice 영역의 화면 선택 버튼을 눌러주세요.',
        status: 'completed',
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        displayMode: 'open_app',
      };
      setLastCommand(command);
      upsertCommandResult(pendingResult);
      setSystemMessage(pendingResult.summary);
      speakDevJarvisNow('화면을 선택해주세요. 오른쪽의 화면 선택 버튼을 눌러주세요.');
      void notifyCommandResult(pendingResult);
      return;
    }

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
      if (command.source === 'voice') {
        setVoiceState('speaking');
        speakDevJarvis(buildResultSpeech(completedResult.metadata?.analysisSummary ?? completedResult.summary))
          .finally(() => setVoiceState('idle'));
      }
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
      if (command.source === 'voice') {
        setVoiceState('speaking');
        speakDevJarvis('요청을 처리하지 못했습니다. 결과 창을 확인해주세요.')
          .finally(() => setVoiceState('error'));
      }
      return;
    } finally {
      setIsProcessingCommand(false);
    }

  }

  async function handleAnalyzeProjectFiles(relativePaths: string[]) {
    if (!selectedProject || relativePaths.length === 0) {
      setErrorMessage('프로젝트 파일 선택이 필요합니다.');
      return;
    }

    const command: CommandInput = {
      id: createClientId(),
      source: 'text',
      text: '/project-files',
      createdAt: new Date().toISOString(),
      contextMode: 'project',
      intent: 'project_diagnosis',
    };
    const startedResult: CommandResult = {
      id: createClientId(),
      commandId: command.id,
      source: command.source,
      contextMode: command.contextMode,
      intent: command.intent,
      pipelineStage: 'analyzing_project',
      title: '프로젝트 파일 분석',
      summary: '승인된 로컬 파일을 읽는 중',
      status: 'processing',
      createdAt: new Date().toISOString(),
      displayMode: 'open_app',
    };

    setLastCommand(command);
    upsertCommandResult(startedResult);
    setSystemMessage(null);
    setErrorMessage(null);
    setIsProcessingCommand(true);
    setCommandPhaseLabel('승인된 파일 읽는 중');

    try {
      await ensureLocalAssistantReady();
      const readResult = await invoke<ProjectFileReadResult>('read_project_file_selection', {
        rootPath: selectedProject.rootPath,
        relativePaths,
      });

      if (readResult.files.length === 0) {
        throw new Error('읽을 수 있는 승인 파일이 없습니다.');
      }

      setCommandPhaseLabel('승인된 파일 분석 중');
      const context = buildApprovedFileAnalysisContext(readResult);
      const text = buildApprovedFileAnalysisText(readResult);
      const response = await analyzeWithLocalAgent({
        commandId: command.id,
        intent: command.intent,
        text,
        context,
      });
      const analysis = mapLocalAgentAnalysisResponse(command, { textLength: text.length } as ScreenOcrResponse, response);
      const completedResult: CommandResult = {
        ...startedResult,
        title: '프로젝트 파일 분석 ready',
        summary: analysis.summary,
        detail: '/project-files',
        nextStep: '전문 보기에서 승인 파일 분석 결과를 확인하세요',
        metadata: {
          analysisTitle: analysis.title,
          analysisSummary: analysis.summary,
          analysisDetail: analysis.detail,
          analysisPreview: analysis.preview,
          analysisActionItems: analysis.actionItems,
          analysisSource: 'local_agent',
          projectFileReadMode: 'approved_selection',
          projectSelectedFiles: readResult.files.map((file) => file.relativePath),
          projectRejectedFiles: readResult.rejected.map((file) => `${file.relativePath}:${file.reason}`),
        },
        status: 'completed',
        pipelineStage: 'analysis_ready',
        completedAt: new Date().toISOString(),
        displayMode: 'open_app',
      };

      upsertCommandResult(completedResult);
      setCommandPhaseLabel('Done');
      setSystemMessage(completedResult.summary);
      void notifyCommandResult(completedResult);
    } catch (caught) {
      const message = toErrorMessage(caught);
      const failedResult: CommandResult = {
        ...startedResult,
        title: '프로젝트 파일 분석 failed',
        summary: message,
        detail: '/project-files',
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
      if (plan.command.source === 'voice') {
        speakDevJarvisNow('화면 공유 창이 열리면 분석할 화면을 선택해주세요.');
      }
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
        if (shouldUseProjectForScreenDiagnosis) {
          messages.push('Project context ready');
        }
        metadata.manifestTargetFileCount = summary.registration.targetFileCount;
        metadata.manifestExcludedFileCount = summary.registration.excludedFileCount;
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
      const projectFileCandidates = buildProjectFileCandidates(projectScan.files);
      messages.push(analysis.summary);
      metadata.relatedProjectFiles = projectFileCandidates;
      metadata.projectAwareFileCandidateCount = projectFileCandidates.length;
      metadata.projectFileReadMode = 'candidate_only';
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

  async function refreshProjectManifest(projectContext: SelectedProject): Promise<{ registration: ManifestRegisterResponse; scan: ProjectScanResult }> {
    const scanResult = await invoke<ProjectScanResult>('scan_project_manifest', { rootPath: projectContext.rootPath });
    const fallbackRegistration: ManifestRegisterResponse = {
      projectId: registeredProject?.id ?? 0,
      requestedFileCount: scanResult.summary.requestedFileCount,
      targetFileCount: scanResult.summary.targetFileCount,
      excludedFileCount: scanResult.summary.excludedFileCount,
    };

    setLatestProjectScan(scanResult);

    try {
      const project = registeredProject ?? await createProject({
        name: scanResult.rootName || projectContext.name,
        rootPathAlias: scanResult.rootPathAlias,
        description: 'Desktop command context source.',
      });

      const summary = await registerProjectManifest(project.id, scanResult.files);
      setRegisteredProject(project);
      setLatestSummary(summary);
      return { registration: summary, scan: scanResult };
    } catch {
      setLatestSummary(fallbackRegistration);
      return { registration: fallbackRegistration, scan: scanResult };
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
    const candidates = buildProjectFileCandidates(scanResult.files);
    const summary = buildProjectArchitectureSummary(scanResult, candidates);
    const detail = buildProjectArchitectureDetail(scanResult, candidates);

    return {
      requestId: command.id,
      provider: 'local-agent',
      status: 'completed',
      intent: command.intent,
      title: '프로젝트 파일 검토 준비 완료',
      summary,
      detail,
      preview: summary,
      actionItems: [
        '전문 보기에서 후보 파일을 선택해 2차 분석을 실행하세요.',
        '민감 파일은 제외되며 선택 파일만 로컬에서 읽습니다.',
      ],
      textUsedLength: 0,
      warnings: [],
      analyzedAt: new Date().toISOString(),
    };
  }

  async function requestTextAnalysis(command: CommandInput): Promise<ScreenAnalysisResponse> {
    if (command.intent === 'screen_math_solver') {
      const solution = trySolveInlineMathCommand(command.text);
      if (solution) {
        return {
          requestId: command.id,
          provider: 'local-agent',
          status: 'completed',
          intent: command.intent,
          title: '계산 결과',
          summary: `${solution.expression}은 ${solution.answer}입니다.`,
          detail: solution.detail,
          preview: `${solution.expression} = ${solution.answer}`,
          actionItems: ['계산식이 다르면 다시 짧게 말씀해주세요.'],
          textUsedLength: command.text.length,
          warnings: [],
          analyzedAt: new Date().toISOString(),
        };
      }
    }

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
            pendingScreenCommand={pendingVoiceScreenCommand !== null}
            wakeStatusMessage={wakeStatusMessage}
            hasKoreanVoice={getDevJarvisSpeechProfile().hasKoreanVoice}
            onManualVoiceInput={handleManualVoiceInput}
            onSelectPendingScreen={handleSelectPendingVoiceScreen}
          />
          <ContextStatusPanel
            items={contextItems}
            projectName={selectedProject?.name ?? null}
            isSelectingProject={isSelectingProject}
            isProcessing={isProcessingCommand}
            onSelectProject={handleSelectProjectFolder}
          />
          <CommandResultPanel results={commandResults} onAnalyzeProjectFiles={handleAnalyzeProjectFiles} />
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

function buildProjectFileCandidates(files: ManifestFile[]): RelatedProjectFileCandidate[] {
  const activeFiles = files.filter((file) => !file.excluded);
  const scored = activeFiles.map((file) => ({ file, score: scoreProjectFileCandidate(file) }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.file.relativePath.localeCompare(right.file.relativePath))
    .slice(0, 12);

  return scored.map(({ file, score }) => ({
    relativePath: file.relativePath,
    fileName: file.fileName,
    extension: file.extension,
    language: file.language,
    matchReasons: buildProjectFileCandidateReasons(file),
    score,
  }));
}

function scoreProjectFileCandidate(file: ManifestFile): number {
  const path = file.relativePath.toLowerCase();
  const name = file.fileName.toLowerCase();
  let score = 0;

  if (isRuntimeBoundaryFile(name)) score += 60;
  if (isEntrypointFile(name, path)) score += 48;
  if (isConfigFile(name, file.extension)) score += 36;
  if (isSourceFile(file.extension, file.language)) score += 16;
  if (path.includes('/src/')) score += 12;
  if (path.split('/').length <= 3) score += 8;
  if (file.sizeBytes > 0 && file.sizeBytes <= 32 * 1024) score += 4;

  return score;
}

function buildProjectFileCandidateReasons(file: ManifestFile): string[] {
  const path = file.relativePath.toLowerCase();
  const name = file.fileName.toLowerCase();
  const reasons: string[] = [];
  if (isRuntimeBoundaryFile(name)) reasons.push('runtime-boundary');
  if (isEntrypointFile(name, path)) reasons.push('entrypoint');
  if (isConfigFile(name, file.extension)) reasons.push('config');
  if (isSourceFile(file.extension, file.language)) reasons.push('source');
  if (path.includes('/src/')) reasons.push('src-tree');
  return reasons.length > 0 ? reasons : ['manifest-candidate'];
}

function isRuntimeBoundaryFile(name: string): boolean {
  return [
    'package.json',
    'cargo.toml',
    'pyproject.toml',
    'requirements.txt',
    'build.gradle',
    'settings.gradle',
    'pom.xml',
    'dockerfile',
    'docker-compose.yml',
    'tauri.conf.json',
  ].includes(name);
}

function isEntrypointFile(name: string, path: string): boolean {
  return [
    'main.tsx',
    'main.ts',
    'app.tsx',
    'app.ts',
    'main.rs',
    'main.py',
    'application.java',
  ].includes(name) || path.endsWith('application.java');
}

function isConfigFile(name: string, extension: string): boolean {
  return name.startsWith('vite.config.')
    || name.startsWith('tsconfig')
    || name.startsWith('application.')
    || ['json', 'yaml', 'yml', 'toml', 'xml'].includes(extension);
}

function isSourceFile(extension: string, language: string): boolean {
  return ['ts', 'tsx', 'js', 'jsx', 'java', 'py', 'rs', 'sql'].includes(extension)
    || ['typescript', 'javascript', 'java', 'python', 'rust', 'sql'].includes(language);
}

function buildProjectArchitectureSummary(scanResult: ProjectScanResult, candidates: RelatedProjectFileCandidate[]): string {
  const moduleNames = topLevelDistribution(scanResult.files)
    .slice(0, 4)
    .map(([name]) => name)
    .join(', ');
  return `로컬 manifest 기준으로 런타임 경계와 진입점 후보를 추렸습니다. ${moduleNames || scanResult.rootName} 영역을 먼저 확인하는 흐름이 적합합니다. 실제 소스 분석은 전문 보기에서 후보 파일을 승인한 뒤 로컬에서만 진행합니다.`;
}

function buildProjectArchitectureDetail(scanResult: ProjectScanResult, candidates: RelatedProjectFileCandidate[]): string {
  const lines = [
    '[1차 구조 판단]',
    ...topLevelDistribution(scanResult.files).slice(0, 8).map(([name, count]) => `- ${name}: ${count}`),
    '',
    '[런타임/설정 후보]',
    ...candidates.filter((file) => file.matchReasons.some((reason) => reason === 'runtime-boundary' || reason === 'config')).slice(0, 8).map((file) => `- ${file.relativePath}`),
    '',
    '[진입점 후보]',
    ...candidates.filter((file) => file.matchReasons.includes('entrypoint')).slice(0, 8).map((file) => `- ${file.relativePath}`),
    '',
    '[다음 단계]',
    '- 전문 보기에서 후보 파일을 선택하면 선택 파일만 로컬에서 읽습니다.',
    '- 민감 패턴 라인은 분석 전에 redaction 처리됩니다.',
    '- NAS/AI Server로 파일 원문을 보내지 않습니다.',
  ];

  return lines.filter(Boolean).join('\n');
}

function topLevelDistribution(files: ManifestFile[]): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const file of files.filter((item) => !item.excluded)) {
    const topLevel = file.relativePath.split('/')[0] || file.fileName;
    incrementCount(counts, topLevel);
  }
  return Array.from(counts.entries()).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
}

function buildApprovedFileAnalysisContext(readResult: ProjectFileReadResult): string {
  return [
    'analysisMode=approvedProjectFiles',
    `approvedFileCount=${readResult.files.length}`,
    `rejectedFileCount=${readResult.rejected.length}`,
    `totalReadBytes=${readResult.totalBytes}`,
    '[approvedRelativePaths]',
    ...readResult.files.map((file) => file.relativePath),
    '[rejectedRelativePaths]',
    ...readResult.rejected.map((file) => `${file.relativePath}:${file.reason}`),
  ].join('\n').slice(0, 3800);
}

function buildApprovedFileAnalysisText(readResult: ProjectFileReadResult): string {
  const sections = readResult.files.map((file) => [
    `--- FILE ${file.relativePath}`,
    `language=${file.language || 'unknown'} extension=${file.extension || 'none'} truncated=${file.truncated}`,
    file.content,
  ].join('\n'));

  return sections.join('\n\n').slice(0, 11000);
}

function incrementCount(counts: Map<string, number>, key: string) {
  counts.set(key, (counts.get(key) ?? 0) + 1);
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
  if (state === 'processing') return '명령 인식 중';
  if (state === 'recording') return '듣는 중';
  if (state === 'speaking') return '응답 중';
  if (state === 'text_ready') return '명령 인식됨';
  if (state === 'error') return '확인 필요';
  if (state === 'unavailable') return '마이크 없음';
  return '호출 대기';
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
