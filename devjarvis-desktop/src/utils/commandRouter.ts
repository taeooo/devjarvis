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

export function inferContextMode(text: string, intent: CommandIntent = inferCommandIntent(text)): ContextMode {
  const normalized = normalize(text);
  const inlineMathMatched = hasInlineArithmeticExpression(normalized);
  const screenMatched = hasScreenReference(normalized);
  const projectMatched = hasProjectReference(normalized);

  if (intent === 'screen_math_solver') {
    if (projectMatched && !screenMatched && !inlineMathMatched) {
      return 'project';
    }

    return screenMatched || !inlineMathMatched ? 'screen' : 'general';
  }

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
  const screenMatched = hasScreenReference(normalized);
  const projectMatched = hasProjectReference(normalized);
  const inlineMathMatched = hasInlineArithmeticExpression(normalized);

  if (screenMatched && hasMathIntent(normalized)) {
    return 'screen_math_solver';
  }

  if (projectMatched && hasProjectDiagnosisIntent(normalized) && !screenMatched) {
    return 'project_diagnosis';
  }

  if (hasMathIntent(normalized) && (screenMatched || inlineMathMatched || !projectMatched)) {
    return 'screen_math_solver';
  }

  if (screenMatched && hasAny(normalized, ['번역', 'translate', 'translation'])) {
    return 'screen_translate';
  }

  if (screenMatched && hasAny(normalized, ['요약', '정리', 'summary', 'summarize'])) {
    return 'screen_summary';
  }

  if (screenMatched && hasAny(normalized, ['에러', '오류', '왜', '원인', '문제', 'error', 'exception', 'failed'])) {
    return 'screen_error_analysis';
  }

  if (hasAny(normalized, ['로그', 'log'])) {
    return 'log_analysis';
  }

  if (projectMatched) {
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

function hasAny(text: string, tokens: string[]): boolean {
  return tokens.some((token) => text.includes(token));
}

function hasScreenReference(text: string): boolean {
  return hasAny(text, [
    '화면',
    '스크린',
    '캡처',
    '캡쳐',
    '이미지',
    'window',
    'screen',
  ]);
}

function hasProjectReference(text: string): boolean {
  return hasAny(text, [
    '프로젝트',
    '소스',
    '코드',
    '파일',
    '폴더',
    '구조',
    '빌드',
    '컴파일',
    '에러',
    '오류',
    '로그',
    '원인',
    '스택트레이스',
    'stack',
    'trace',
    'repository',
    'repo',
  ]);
}

function hasProjectDiagnosisIntent(text: string): boolean {
  return hasAny(text, [
    '분석',
    '진단',
    '확인',
    '파악',
    '봐줘',
    '알려줘',
    '구조',
    '왜',
    '원인',
    'analysis',
    'diagnose',
    'review',
  ]);
}

function hasMathIntent(text: string): boolean {
  return hasAny(text, [
    '계산',
    '수계산',
    '산수',
    '수식',
    '빈칸',
    '답',
    '풀어',
    'solve',
    'calculate',
    'arithmetic',
    'math',
    '곱하기',
    '곱셈',
    '나누기',
    '나눗셈',
    '몫',
    '나머지',
    'remainder',
    'quotient',
  ]);
}

function hasInlineArithmeticExpression(text: string): boolean {
  return /\d+\s*[+\-−–*/×÷xX]\s*\d+/.test(text);
}
