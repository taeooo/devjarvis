import type {
  CommandInput,
  CommandIntent,
  CommandResultDisplayMode,
  ContextMode,
  CommandSource,
  ScreenTargetPolicy,
} from '../types/jarvisCommand';

export type CommandRoutingHint = {
  projectSelected?: boolean;
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

type CommandToken =
  | 'screen'
  | 'project'
  | 'math'
  | 'translate'
  | 'summary'
  | 'log'
  | 'chat';

export function createCommandInput(
  text: string,
  source: CommandSource,
  hint: CommandRoutingHint = {},
): CommandInput {
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

  switch (token) {
    case 'screen':
    case 'translate':
    case 'summary':
      return 'screen';
    case 'project':
      return 'project';
    case 'math':
      return inlineMathMatched ? 'general' : 'screen';
    case 'log':
      return hint.projectSelected ? 'project' : 'general';
    case 'chat':
      return 'general';
  }

  if (intent === 'screen_math_solver') {
    return inlineMathMatched ? 'general' : 'screen';
  }

  if (intent === 'project_diagnosis') {
    return 'project';
  }

  if (intent === 'log_analysis') {
    return hint.projectSelected ? 'project' : 'general';
  }

  return 'general';
}

export function inferCommandIntent(text: string, hint: CommandRoutingHint = {}): CommandIntent {
  const token = getCommandToken(text);
  const inlineMathMatched = hasInlineArithmeticExpression(text);

  switch (token) {
    case 'screen':
      return 'screen_error_analysis';
    case 'translate':
      return 'screen_translate';
    case 'summary':
      return 'screen_summary';
    case 'math':
      return 'screen_math_solver';
    case 'project':
      return 'project_diagnosis';
    case 'log':
      return 'log_analysis';
    case 'chat':
      return 'general_chat';
  }

  if (inlineMathMatched) {
    return 'screen_math_solver';
  }

  if (looksLikeRuntimeLog(text)) {
    return 'log_analysis';
  }

  if (hint.projectSelected) {
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
    return 'Review project structure notes in detail view';
  }

  if (intent === 'log_analysis') {
    return 'Review log analysis in detail view';
  }

  return 'Review the response';
}

function getCommandToken(text: string): CommandToken | null {
  const token = text.trim().match(/^\/([a-z][a-z0-9_-]*)(?:\s+|$)/i)?.[1]?.toLowerCase();
  switch (token) {
    case 'screen':
    case 'project':
    case 'math':
    case 'translate':
    case 'summary':
    case 'log':
    case 'chat':
      return token;
    default:
      return null;
  }
}

function hasInlineArithmeticExpression(text: string): boolean {
  return /\d+\s*[+\-−–*/×÷xX]\s*\d+/.test(text);
}

function looksLikeRuntimeLog(text: string): boolean {
  return /\b(error|exception|traceback|stack\s*trace|failed|fatal|warn(?:ing)?|\bat\s+[\w.$]+\(|\d{3}\s+\w+\s+Error)\b/i.test(text);
}
