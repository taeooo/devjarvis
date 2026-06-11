import type {
  CommandInput,
  CommandIntent,
  CommandResultDisplayMode,
  ContextMode,
  CommandSource,
  ScreenTargetPolicy,
} from '../types/jarvisCommand';

export type CommandExecutionPlan = {
  command: CommandInput;
  needsScreenCapture: boolean;
  needsProjectManifest: boolean;
  title: string;
  pendingSummary: string;
  readySummary: string;
  nextStep: string;
  displayMode: CommandResultDisplayMode;
  screenTargetPolicy: ScreenTargetPolicy;
};

export function createCommandInput(text: string, source: CommandSource): CommandInput {
  const normalized = text.trim();
  const intent = inferCommandIntent(normalized);

  return {
    id: createClientId(),
    source,
    text: normalized,
    createdAt: new Date().toISOString(),
    contextMode: inferContextMode(normalized, intent),
    intent,
  };
}

export function createCommandPlan(command: CommandInput): CommandExecutionPlan {
  const needsScreenCapture = command.contextMode === 'screen' || command.contextMode === 'auto';
  const needsProjectManifest = command.contextMode === 'project' || command.contextMode === 'auto';
  const title = resolveCommandTitle(command.intent);

  return {
    command,
    needsScreenCapture,
    needsProjectManifest,
    title,
    pendingSummary: resolvePendingSummary(command.contextMode),
    readySummary: resolveReadySummary(command.contextMode),
    nextStep: resolveNextStep(command.intent, command.contextMode),
    displayMode: command.contextMode === 'general' ? 'notify' : 'open_app',
    screenTargetPolicy: resolveScreenTargetPolicy(command),
  };
}


export function resolveScreenTargetPolicy(command: CommandInput): ScreenTargetPolicy {
  const needsScreen = command.contextMode === 'screen' || command.contextMode === 'auto';
  if (!needsScreen) {
    return 'manual_picker_required';
  }

  if (command.source === 'voice') {
    return 'voice_foreground_first';
  }

  return 'text_last_target_first';
}

export function formatScreenTargetPolicy(policy: ScreenTargetPolicy): string {
  switch (policy) {
    case 'voice_foreground_first':
      return 'Voice foreground';
    case 'text_last_target_first':
      return 'Last target';
    case 'manual_picker_required':
      return 'Manual picker';
  }
}

export function inferContextMode(text: string, intent: CommandIntent = inferCommandIntent(text)): ContextMode {
  const normalized = normalize(text);
  const screenMatched = hasAny(normalized, [
    '화면',
    '스크린',
    '캡처',
    '캡쳐',
    '번역',
    '요약',
    '이미지',
    'window',
    'screen',
  ]);
  const projectMatched = hasAny(normalized, [
    '프로젝트',
    '소스',
    '코드',
    '파일',
    '빌드',
    '컴파일',
    '에러',
    '오류',
    '로그',
    '원인',
    '스택트레이스',
    'stack',
    'trace',
  ]);

  if (intent === 'screen_error_analysis') {
    return projectMatched ? 'auto' : 'screen';
  }

  if (intent === 'project_diagnosis' || intent === 'log_analysis') {
    return screenMatched ? 'auto' : 'project';
  }

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

export function inferCommandIntent(text: string): CommandIntent {
  const normalized = normalize(text);
  const isScreen = hasAny(normalized, ['화면', '스크린', '캡처', '캡쳐', '이미지', 'screen', 'window']);

  if (isScreen && hasAny(normalized, ['번역', 'translate', 'translation'])) {
    return 'screen_translate';
  }

  if (isScreen && hasAny(normalized, ['요약', '정리', 'summary', 'summarize'])) {
    return 'screen_summary';
  }

  if (isScreen && hasAny(normalized, ['에러', '오류', '왜', '원인', '문제', 'error', 'exception', 'failed'])) {
    return 'screen_error_analysis';
  }

  if (hasAny(normalized, ['로그', 'log'])) {
    return 'log_analysis';
  }

  if (hasAny(normalized, ['프로젝트', '소스', '코드', '빌드', '컴파일', '원인', 'stack', 'trace'])) {
    return 'project_diagnosis';
  }

  return 'general_chat';
}

export function formatIntent(intent: CommandIntent): string {
  switch (intent) {
    case 'screen_translate':
      return 'Screen Translate';
    case 'screen_summary':
      return 'Screen Summary';
    case 'screen_error_analysis':
      return 'Screen Error';
    case 'project_diagnosis':
      return 'Project Diagnosis';
    case 'log_analysis':
      return 'Log Analysis';
    case 'general_chat':
      return 'General';
  }
}

export function createClientId(): string {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function resolveCommandTitle(intent: CommandIntent): string {
  switch (intent) {
    case 'screen_translate':
      return 'Screen translation ready';
    case 'screen_summary':
      return 'Screen summary ready';
    case 'screen_error_analysis':
      return 'Screen diagnosis ready';
    case 'project_diagnosis':
      return 'Project context ready';
    case 'log_analysis':
      return 'Log context ready';
    case 'general_chat':
      return 'Command received';
  }
}

function resolvePendingSummary(contextMode: ContextMode): string {
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

function resolveReadySummary(contextMode: ContextMode): string {
  if (contextMode === 'screen') {
    return 'Screen context captured';
  }

  if (contextMode === 'project') {
    return 'Project manifest refreshed';
  }

  if (contextMode === 'auto') {
    return 'Context bundle prepared';
  }

  return 'Local command queued';
}

function resolveNextStep(intent: CommandIntent, contextMode: ContextMode): string {
  if (intent === 'screen_translate') {
    return 'Translation / vision analysis pending';
  }

  if (intent === 'screen_summary') {
    return 'Screen summary analysis pending';
  }

  if (intent === 'screen_error_analysis') {
    return contextMode === 'auto' ? 'Project RAG + diagnosis pending' : 'Screen diagnosis pending';
  }

  if (intent === 'project_diagnosis') {
    return 'Project context analysis pending';
  }

  if (intent === 'log_analysis') {
    return 'Log parser pending';
  }

  return 'LLM routing pending';
}

function normalize(text: string): string {
  return text.toLocaleLowerCase().replace(/\s+/g, ' ').trim();
}

function hasAny(text: string, tokens: string[]): boolean {
  return tokens.some((token) => text.includes(token));
}
