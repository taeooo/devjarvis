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

export type InlineMathSolution = {
  expression: string;
  answer: string;
  detail: string;
};

export function createCommandInput(text: string, source: CommandSource, hint: CommandRoutingHint = {}): CommandInput {
  const normalized = normalizeVoiceCommandText(text.trim());
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

  if (isScreenIntent(intent)) {
    return intent === 'screen_math_solver' && inlineMathMatched ? 'general' : 'screen';
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

  const spokenScreenIntent = inferSpokenScreenIntent(text);
  if (spokenScreenIntent) return spokenScreenIntent;

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

export function isWakePhraseText(text: string): boolean {
  const normalized = normalizeWakePhraseText(text);
  return normalized.includes('헤이자비스')
    || normalized.includes('heyjarvis')
    || normalized.includes('하이자비스')
    || normalized.includes('자비스야')
    || normalized.includes('자비스');
}

export function stripWakePhrase(text: string): string {
  return normalizeVoiceCommandText(text)
    .replace(/헤이\s*자비스/gi, ' ')
    .replace(/하이\s*자비스/gi, ' ')
    .replace(/hey\s*jarvis/gi, ' ')
    .replace(/자비스야/gi, ' ')
    .replace(/자비스/gi, ' ')
    .replace(/[,，.。!！?？]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeVoiceCommandText(text: string): string {
  return text
    .replace(/[，]/g, ',')
    .replace(/[。]/g, '.')
    .replace(/\s+/g, ' ')
    .trim();
}

export function trySolveInlineMathCommand(text: string): InlineMathSolution | null {
  const normalized = normalizeMathText(text);
  const match = normalized.match(/(-?\d+(?:\.\d+)?)\s*(\+|-|\*|\/|%|몫)\s*(-?\d+(?:\.\d+)?)/);
  if (!match) return null;

  const left = Number(match[1]);
  const operator = match[2];
  const right = Number(match[3]);
  if (!Number.isFinite(left) || !Number.isFinite(right)) return null;

  let answer: number;
  let operatorLabel: string;
  switch (operator) {
    case '+':
      answer = left + right;
      operatorLabel = '더하기';
      break;
    case '-':
      answer = left - right;
      operatorLabel = '빼기';
      break;
    case '*':
      answer = left * right;
      operatorLabel = '곱하기';
      break;
    case '/':
      if (right === 0) return { expression: `${left} ÷ ${right}`, answer: '계산할 수 없습니다', detail: '0으로 나눌 수 없습니다.' };
      answer = left / right;
      operatorLabel = '나누기';
      break;
    case '%':
      if (right === 0) return { expression: `${left} % ${right}`, answer: '계산할 수 없습니다', detail: '0으로 나눌 수 없습니다.' };
      answer = left % right;
      operatorLabel = '나머지';
      break;
    case '몫':
      if (right === 0) return { expression: `${left} 몫 ${right}`, answer: '계산할 수 없습니다', detail: '0으로 나눌 수 없습니다.' };
      answer = Math.trunc(left / right);
      operatorLabel = '몫';
      break;
    default:
      return null;
  }

  const formattedAnswer = formatNumber(answer);
  const expression = `${formatNumber(left)} ${operatorLabel} ${formatNumber(right)}`;
  return {
    expression,
    answer: formattedAnswer,
    detail: `${expression}의 결과는 ${formattedAnswer}입니다.`,
  };
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

function isScreenIntent(intent: CommandIntent): boolean {
  return intent === 'screen_translate'
    || intent === 'screen_summary'
    || intent === 'screen_error_analysis'
    || intent === 'screen_math_solver';
}

function inferSpokenScreenIntent(text: string): CommandIntent | null {
  const normalized = text.trim().toLowerCase();
  if (!hasScreenReference(normalized)) {
    return null;
  }

  if (/(번역|translate|translation)/.test(normalized)) return 'screen_translate';
  if (/(요약|정리|summary|summarize)/.test(normalized)) return 'screen_summary';
  if (/(계산|수식|math|calculate|풀어)/.test(normalized)) return 'screen_math_solver';
  if (/(왜|오류|에러|문제|안됨|안돼|이상|고장|diagnos|error|issue|problem)/.test(normalized)) {
    return 'screen_error_analysis';
  }

  return 'screen_error_analysis';
}

function hasScreenReference(text: string): boolean {
  return /(화면|스크린|창|현재 화면|보고 있는|캡처|캡쳐|screen|window|display)/.test(text);
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
  return /\d+\s*[+\-−–*/×÷xX]\s*\d+/.test(text) || trySolveInlineMathCommand(text) !== null;
}

function normalizeWakePhraseText(text: string): string {
  return text.toLowerCase().replace(/[\s,，.。!！?？]/g, '');
}

function normalizeMathText(text: string): string {
  let normalized = text.toLowerCase();
  const replacements: Array<[RegExp, string]> = [
    [/\bzero\b|영|공/g, '0'],
    [/\bone\b|하나|일/g, '1'],
    [/\btwo\b|둘|이/g, '2'],
    [/\bthree\b|셋|삼/g, '3'],
    [/\bfour\b|넷|사/g, '4'],
    [/\bfive\b|다섯|오/g, '5'],
    [/\bsix\b|여섯|육/g, '6'],
    [/\bseven\b|일곱|칠/g, '7'],
    [/\beight\b|여덟|팔/g, '8'],
    [/\bnine\b|아홉|구/g, '9'],
    [/\bten\b|열|십/g, '10'],
    [/더하기|플러스|더해|\bplus\b/g, '+'],
    [/빼기|마이너스|빼|\bminus\b/g, '-'],
    [/곱하기|곱해|곱|\btimes\b|\bmultiply\b|×|x/g, '*'],
    [/나누기|나눠|나누어|나눔|\bdivide\b|÷/g, '/'],
    [/나머지|remainder/g, '%'],
    [/몫|quotient/g, '몫'],
  ];

  for (const [pattern, replacement] of replacements) {
    normalized = normalized.replace(pattern, replacement);
  }

  return normalized.replace(/[^0-9+\-*/%.몫\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function formatNumber(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return String(Number(value.toFixed(6)));
}
