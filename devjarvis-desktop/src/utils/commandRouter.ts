import type {
  CommandInput,
  CommandIntent,
  CommandResultDisplayMode,
  ContextMode,
  CommandSource,
  ScreenTargetPolicy,
} from '../types/jarvisCommand';

export type CommandRoutingHint = {
  hasSelectedProject?: boolean;
};

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

export function createCommandInput(text: string, source: CommandSource, hint: CommandRoutingHint = {}): CommandInput {
  const normalized = text.trim();
  const intent = inferCommandIntent(normalized, hint);

  return {
    id: createClientId(),
    source,
    text: normalized,
    createdAt: new Date().toISOString(),
    contextMode: inferContextMode(normalized, intent, hint),
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
    pendingSummary: resolvePendingSummary(command.contextMode, command.intent),
    readySummary: resolveReadySummary(command.contextMode, command.intent),
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

export function inferContextMode(
  text: string,
  intent: CommandIntent = inferCommandIntent(text),
  hint: CommandRoutingHint = {},
): ContextMode {
  const token = getCommandToken(text);
  const inlineMathMatched = hasInlineArithmeticExpression(text);

  if (token === '/screen') return 'screen';
  if (token === '/project') return 'project';
  if (token === '/log') return 'project';
  if (token === '/chat') return 'general';
  if (token === '/math') return inlineMathMatched ? 'general' : 'screen';
  if (token === '/translate' || token === '/summary') return 'screen';

  if (intent === 'screen_math_solver') {
    return inlineMathMatched ? 'general' : 'screen';
  }

  if (hint.hasSelectedProject) {
    return 'project';
  }

  return 'general';
}

export function inferCommandIntent(text: string, hint: CommandRoutingHint = {}): CommandIntent {
  const token = getCommandToken(text);
  const inlineMathMatched = hasInlineArithmeticExpression(text);

  if (token === '/translate') return 'screen_translate';
  if (token === '/summary') return 'screen_summary';
  if (token === '/project') return 'project_diagnosis';
  if (token === '/log') return 'log_analysis';
  if (token === '/chat') return 'general_chat';
  if (token === '/math') return 'screen_math_solver';
  if (token === '/screen') return inlineMathMatched ? 'screen_math_solver' : 'screen_error_analysis';

  if (inlineMathMatched) return 'screen_math_solver';
  if (hint.hasSelectedProject) return 'project_diagnosis';

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
    case 'screen_math_solver':
      return 'Screen Math';
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
    case 'screen_math_solver':
      return 'Math result ready';
    case 'project_diagnosis':
      return 'Project analysis ready';
    case 'log_analysis':
      return 'Log context ready';
    case 'general_chat':
      return 'Command received';
  }
}

function resolvePendingSummary(contextMode: ContextMode, intent: CommandIntent): string {
  if (contextMode === 'screen') {
    return intent === 'screen_math_solver' ? 'Waiting for screen selection' : 'Preparing screen context';
  }

  if (contextMode === 'project') {
    return 'Analyzing project';
  }

  if (contextMode === 'auto') {
    return 'Preparing screen and project context';
  }

  return intent === 'screen_math_solver' ? 'Solving math' : 'Thinking';
}

function resolveReadySummary(contextMode: ContextMode, intent: CommandIntent): string {
  if (contextMode === 'screen') {
    return intent === 'screen_math_solver' ? 'Math result ready' : 'Screen context captured';
  }

  if (contextMode === 'project') {
    return 'Project analysis ready';
  }

  if (contextMode === 'auto') {
    return 'Context bundle prepared';
  }

  return 'Done';
}

function resolveNextStep(intent: CommandIntent, contextMode: ContextMode): string {
  if (intent === 'screen_translate') {
    return 'Review the translated screen text in detail view';
  }

  if (intent === 'screen_summary') {
    return 'Review the screen summary in detail view';
  }

  if (intent === 'screen_error_analysis') {
    return contextMode === 'auto' ? 'Review screen and project diagnosis' : 'Review screen diagnosis';
  }

  if (intent === 'screen_math_solver') {
    return contextMode === 'general' ? 'Review the calculated result' : 'Review the full solution in detail view';
  }

  if (intent === 'project_diagnosis') {
    return 'Review project file candidates in detail view';
  }

  if (intent === 'log_analysis') {
    return 'Review log analysis in detail view';
  }

  return 'Review the response';
}

function getCommandToken(text: string): string | null {
  const trimmed = text.trim().toLowerCase();
  const first = trimmed.split(/\s+/, 1)[0] ?? '';
  if (['/screen', '/project', '/math', '/translate', '/summary', '/log', '/chat'].includes(first)) {
    return first;
  }
  return null;
}

function hasInlineArithmeticExpression(text: string): boolean {
  return /\d+\s*[+\-−–*/×÷xX]\s*\d+/.test(text);
}
