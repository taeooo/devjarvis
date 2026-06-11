export type VoiceState = 'unavailable' | 'idle' | 'listening' | 'transcribing' | 'ready' | 'error';

export type SystemStatus = 'Listening' | 'Mic unavailable' | 'Idle' | 'Processing';

export type CommandSource = 'voice' | 'text';

export type ScreenTargetKind =
  | 'not_selected'
  | 'manual_picker'
  | 'user_selected'
  | 'last_captured'
  | 'last_active_window'
  | 'foreground_window'
  | 'cursor_monitor';

export type ScreenTargetPolicy =
  | 'voice_foreground_first'
  | 'text_last_target_first'
  | 'manual_picker_required';

export type ContextMode = 'screen' | 'project' | 'general' | 'auto';

export type CommandIntent =
  | 'screen_translate'
  | 'screen_summary'
  | 'screen_error_analysis'
  | 'project_diagnosis'
  | 'log_analysis'
  | 'general_chat';

export type CommandPipelineStage =
  | 'received'
  | 'capturing_screen'
  | 'extracting_ocr'
  | 'analyzing_screen'
  | 'refreshing_manifest'
  | 'analyzing_project'
  | 'analysis_ready'
  | 'completed'
  | 'failed';

export type CommandInput = {
  id: string;
  source: CommandSource;
  text: string;
  createdAt: string;
  contextMode: ContextMode;
  intent: CommandIntent;
};

export type CommandResultStatus = 'processing' | 'completed' | 'failed';

export type CommandResultDisplayMode = 'notify' | 'open_app' | 'overlay';

export type OcrExtractionState = 'not_requested' | 'uploading' | 'extracting' | 'completed' | 'failed';

export type ScreenAnalysisState = 'not_requested' | 'analyzing' | 'completed' | 'failed';

export type CommandResultMetadata = {
  localAgentState?: LocalAgentConnectionState;
  screenSize?: string;
  manifestTargetFileCount?: number;
  manifestExcludedFileCount?: number;
  projectContext?: 'selected' | 'not_selected';
  ocrTextLength?: number;
  ocrTextFound?: boolean;
  analysisTitle?: string;
  analysisPreview?: string;
  analysisActionItems?: string[];
  screenTarget?: string;
  screenTargetPolicy?: ScreenTargetPolicy;
};

export type CommandResult = {
  id: string;
  commandId: string;
  source: CommandSource;
  contextMode: ContextMode;
  intent: CommandIntent;
  pipelineStage: CommandPipelineStage;
  title: string;
  summary: string;
  detail?: string;
  nextStep?: string;
  metadata?: CommandResultMetadata;
  status: CommandResultStatus;
  createdAt: string;
  completedAt?: string;
  displayMode: CommandResultDisplayMode;
};

export type ContextStatusTone = 'ready' | 'idle' | 'warning' | 'active';

export type ContextStatusItem = {
  key: 'screen' | 'project' | 'voice' | 'rag' | 'localAgent';
  label: string;
  value: string;
  tone: ContextStatusTone;
};

export type ScreenCaptureState = 'ready' | 'capturing' | 'captured' | 'unavailable' | 'error';

export type ScreenCaptureResult = {
  imageDataUrl: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  width: number;
  height: number;
  byteSize: number;
  capturedAt: string;
};

export type ScreenTargetSnapshot = {
  kind: ScreenTargetKind;
  label: string;
  policy: ScreenTargetPolicy;
  source: CommandSource | null;
  updatedAt: string | null;
};

export type ScreenContextSnapshot = {
  state: ScreenCaptureState;
  target: ScreenTargetSnapshot;
  width: number | null;
  height: number | null;
  capturedAt: string | null;
  errorMessage: string | null;
  lastIntent: CommandIntent | null;
  ocrState: OcrExtractionState;
  ocrTextLength: number | null;
  ocrErrorMessage: string | null;
  analysisState: ScreenAnalysisState;
  analysisErrorMessage: string | null;
};


export type LocalAgentConnectionState = 'checking' | 'ready' | 'unavailable' | 'error';

export type LocalAgentHealthSnapshot = {
  state: LocalAgentConnectionState;
  warning: string | null;
  checkedAt: string | null;
  errorMessage: string | null;
};

export type LocalAgentAppHealthResponse = {
  status: string;
  loopbackOnly: boolean;
};

export type LocalOcrHealthResponse = {
  available: boolean;
  maxImageBytes: number;
  maxWidth: number;
  maxHeight: number;
  warning: string | null;
};

export type LocalAgentHealthResponse = {
  available: boolean;
  warning: string | null;
};

export type LocalLlmAnalyzeRequest = {
  commandId?: string;
  intent: CommandIntent;
  text: string;
  context?: string | null;
};

export type LocalLlmAnalyzeResponse = {
  status: 'completed' | 'failed';
  summary: string;
  detail: string | null;
  actionItems: string[];
  warnings: string[];
};

export type ScreenOcrRequest = {
  commandId: string;
  intent: CommandIntent;
  contextMode: ContextMode;
  image: {
    dataUrl: string;
    mimeType: ScreenCaptureResult['mimeType'];
    width: number;
    height: number;
    byteSize: number;
    capturedAt: string;
  };
};

export type ScreenOcrResponse = {
  requestId: string;
  status: string;
  text: string;
  textFound: boolean;
  textLength: number;
  preview: string;
  width: number;
  height: number;
  mimeType: string;
  byteSize: number;
  warnings: string[];
  extractedAt: string;
};



export type LocalOcrTextBlock = {
  text: string;
  confidence?: number | null;
  x?: number | null;
  y?: number | null;
  width?: number | null;
  height?: number | null;
};

export type LocalOcrExtractRequest = ScreenOcrRequest;

export type LocalOcrExtractResponse = ScreenOcrResponse & {
  blocks?: LocalOcrTextBlock[];
};

export type ScreenAnalysisResponse = {
  requestId: string;
  status: string;
  title: string;
  summary: string;
  detail: string;
  preview: string;
  actionItems: string[];
  textUsedLength: number;
  warnings: string[];
  analyzedAt: string;
};
