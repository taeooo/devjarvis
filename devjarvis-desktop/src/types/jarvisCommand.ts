export type VoiceState = 'unavailable' | 'idle' | 'listening' | 'transcribing' | 'ready' | 'error';

export type SystemStatus = 'Listening' | 'Mic unavailable' | 'Idle' | 'Processing';

export type ContextMode = 'screen' | 'project' | 'general' | 'auto';

export type CommandSource = 'voice' | 'text';

export type CommandInput = {
  id: string;
  source: CommandSource;
  text: string;
  createdAt: string;
  contextMode: ContextMode;
};

export type CommandResultStatus = 'processing' | 'completed' | 'failed';

export type CommandResultDisplayMode = 'notify' | 'open_app' | 'overlay';

export type CommandResult = {
  id: string;
  commandId: string;
  title: string;
  summary: string;
  detail?: string;
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
};
