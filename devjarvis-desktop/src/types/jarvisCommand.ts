export type VoiceState = 'unavailable' | 'idle' | 'listening' | 'transcribing' | 'ready' | 'error';

export type SystemStatus = 'Listening' | 'Mic unavailable' | 'Idle' | 'Processing';

export type ContextMode = 'screen' | 'project' | 'general' | 'auto';

export type CommandSource = 'voice' | 'text';

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
  | 'refreshing_manifest'
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

export type CommandResultMetadata = {
  screenSize?: string;
  manifestTargetFileCount?: number;
  manifestExcludedFileCount?: number;
  projectContext?: 'selected' | 'not_selected';
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
  key: 'screen' | 'project' | 'voice' | 'rag';
  label: string;
  value: string;
  tone: ContextStatusTone;
};

export type ScreenCaptureState = 'ready' | 'capturing' | 'captured' | 'unavailable' | 'error';

export type ScreenCaptureResult = {
  imageDataUrl: string;
  width: number;
  height: number;
  capturedAt: string;
};

export type ScreenContextSnapshot = {
  state: ScreenCaptureState;
  width: number | null;
  height: number | null;
  capturedAt: string | null;
  errorMessage: string | null;
  lastIntent: CommandIntent | null;
};
