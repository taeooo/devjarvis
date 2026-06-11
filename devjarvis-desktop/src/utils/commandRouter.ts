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

export type CommandRoutingContext = {
  projectSelected?: boolean;
};

type ExplicitCommand = 'screen' | 'project' | 'math' | 'translate' | 'summary' | 'log' | null;

export function createCommandInput(
  text: string,
  source: CommandSource,
  routingContext: CommandRoutingContext = {},
): CommandInput {
  const normalized = text.trim();
  const intent = inferCommandIntent(normalized, routingContext);

  return {
    id: createClientId(),
    source,
    text: normalized,
    createdAt: new Date().toISOString(),
    contextMode: inferContextMode(normalized, intent, routingContext),
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
  routingContext: CommandRoutingContext = {},
): ContextMode {
  const normalized = normalize(text);
  const explicit = getExplicitCommand(normalized);
  const screenMatched = hasScreenReference(normalized) || explicit === 'screen';
  const projectMatched = hasProjectReference(normalized) || explicit === 'project';
  const inlineMathMatched = hasInlineArithmeticExpression(normalized);

  if (explicit === 'project') {
    return 'project';
  }

  if (explicit === 'screen' || explicit === 'translate' || explicit === 'summary') {
    return 'screen';
  }

  if (intent === 'screen_math_solver') {
    if (screenMatched) {
      return 'screen';
    }
    if (projectMatched && !inlineMathMatched) {
      return 'project';
    }
    return inlineMathMatched ? 'general' : 'screen';
  }

  if (intent === 'screen_error_analysis') {
    return projectMatched && routingContext.projectSelected ? 'auto' : 'screen';
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

export function inferCommandIntent(text: string, routingContext: CommandRoutingContext = {}): CommandIntent {
  const normalized = normalize(text);
  const explicit = getExplicitCommand(normalized);
  const screenMatched = hasScreenReference(normalized) || explicit === 'screen';
  const projectMatched = hasProjectReference(normalized) || explicit === 'project';
  const mathMatched = hasMathSignal(normalized) || explicit === 'math';

  if (explicit === 'project') {
    return 'project_diagnosis';
  }

  if (explicit === 'log') {
    return 'log_analysis';
  }

  if (mathMatched && (screenMatched || hasInlineArithmeticExpression(normalized) || !projectMatched)) {
    return 'screen_math_solver';
  }

  if (explicit === 'translate' || (screenMatched && hasTranslationSignal(normalized))) {
    return 'screen_translate';
  }

  if (explicit === 'summary' || (screenMatched && hasSummarySignal(normalized))) {
    return 'screen_summary';
  }

  if (screenMatched) {
    return 'screen_error_analysis';
  }

  if (projectMatched) {
    return 'project_diagnosis';
  }

  if (routingContext.projectSelected && hasProjectFileReference(normalized)) {
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

function normalize(text: string): string {
  return text.toLocaleLowerCase().replace(/\s+/g, ' ').trim();
}

function getExplicitCommand(text: string): ExplicitCommand {
  const match = text.match(/^\/(screen|project|math|translate|summary|log)(?=\s|$)/);
  return match ? (match[1] as Exclude<ExplicitCommand, null>) : null;
}

function hasScreenReference(text: string): boolean {
  return /(^|\s)(screen|window)(\s|$)/.test(text) || text.includes('화면');
}

function hasProjectReference(text: string): boolean {
  return /(^|\s)(project|repo|repository)(\s|$)/.test(text) || text.includes('프로젝트');
}

function hasMathSignal(text: string): boolean {
  return hasInlineArithmeticExpression(text)
    || /(^|\s)(math|calculate|solve)(\s|$)/.test(text)
    || text.includes('계산')
    || text.includes('수식');
}

function hasTranslationSignal(text: string): boolean {
  return /(^|\s)(translate|translation)(\s|$)/.test(text) || text.includes('번역');
}

function hasSummarySignal(text: string): boolean {
  return /(^|\s)(summary|summarize)(\s|$)/.test(text) || text.includes('요약');
}

function hasProjectFileReference(text: string): boolean {
  return /(^|[\s/\\])([\w.-]+\.(tsx?|jsx?|py|java|kt|rs|go|yml|yaml|json|toml|gradle|md))(\s|$)/.test(text);
}

function hasInlineArithmeticExpression(text: string): boolean {
  return /\d+\s*[+\-−–*/×÷xX]\s*\d+/.test(text);
}
