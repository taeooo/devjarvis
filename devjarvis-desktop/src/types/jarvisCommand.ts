export type VoiceState = 'unavailable' | 'idle' | 'listening' | 'transcribing' | 'ready' | 'error';

export type SystemStatus = 'Listening' | 'Mic unavailable' | 'Idle' | 'Processing';

export type ContextMode = 'screen' | 'project' | 'general' | 'auto';

export type CommandSource = 'voice' | 'text';

export type CommandInput = {
  source: CommandSource;
  text: string;
  createdAt: string;
  contextMode: ContextMode;
};

export type ContextStatusTone = 'ready' | 'idle' | 'warning' | 'active';

export type ContextStatusItem = {
  key: 'screen' | 'project' | 'voice' | 'rag';
  label: string;
  value: string;
  tone: ContextStatusTone;
};
