import type { ManifestFile } from '../types/projectScanner';

const MAX_TEXT_CHARS = 12000;
const MAX_HINTS = 24;
const MAX_RELATED_FILES = 8;

const TECHNICAL_FILE_EXTENSIONS = new Set([
  'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'java', 'kt', 'py', 'rs', 'go', 'cs',
  'cpp', 'c', 'h', 'hpp', 'html', 'css', 'scss', 'json', 'yaml', 'yml', 'toml',
  'xml', 'sql', 'gradle',
]);

export type ScreenProjectSignal = {
  value: string;
  kind: 'file' | 'path' | 'apiPath' | 'component' | 'identifier';
};

export type RelatedProjectFileCandidate = {
  relativePath: string;
  fileName: string;
  extension: string;
  language: string;
  matchReasons: string[];
  score: number;
};

export type ProjectAwareScreenDiagnosis = {
  signals: ScreenProjectSignal[];
  relatedFiles: RelatedProjectFileCandidate[];
};

export function buildProjectAwareScreenDiagnosis(
  observedText: string,
  manifestFiles: ManifestFile[],
): ProjectAwareScreenDiagnosis {
  const signals = extractScreenProjectSignals(observedText);
  return {
    signals,
    relatedFiles: findRelatedProjectFiles(signals, manifestFiles),
  };
}

export function extractScreenProjectSignals(observedText: string): ScreenProjectSignal[] {
  const source = observedText.slice(0, MAX_TEXT_CHARS);
  const signals = new Map<string, ScreenProjectSignal>();

  collectMatches(source, /(?:^|[\s'"`(])([A-Za-z0-9_.@/-]+\.[A-Za-z0-9]{1,12})(?=$|[\s'"`),:;])/g, 'file', signals);
  collectMatches(source, /(?:^|[\s'"`(])((?:\.?\.?\/?|[A-Za-z]:\\)?[A-Za-z0-9_.@-]+(?:[\\/][A-Za-z0-9_.@-]+)+)(?=$|[\s'"`),:;])/g, 'path', signals);
  collectMatches(source, /(?:^|[\s'"`(])(\/[A-Za-z0-9._~:@!$&'()*+,;=%-]+(?:\/[A-Za-z0-9._~:@!$&'()*+,;=%-]+)+)(?=$|[\s'"`),;])/g, 'apiPath', signals);
  collectMatches(source, /\b([A-Z][A-Za-z0-9]+(?:Page|View|Panel|Dialog|Modal|Form|Card|List|Item|Controller|Service|Repository|Handler|Route|Screen|Component))\b/g, 'component', signals);
  collectMatches(source, /\b([A-Za-z_][A-Za-z0-9_]*(?:Error|Exception|Failure|Failed|Timeout|Denied|Unauthorized|Forbidden|NotFound|Stack|Trace))\b/g, 'identifier', signals);

  return Array.from(signals.values()).slice(0, MAX_HINTS);
}

export function findRelatedProjectFiles(
  signals: ScreenProjectSignal[],
  manifestFiles: ManifestFile[],
): RelatedProjectFileCandidate[] {
  if (signals.length === 0) return [];

  const candidates = new Map<string, RelatedProjectFileCandidate>();
  const activeFiles = manifestFiles.filter((file) => !file.excluded);

  for (const file of activeFiles) {
    const relativePath = normalizePath(file.relativePath);
    const fileName = normalizeFileName(file.fileName);
    const fileBaseName = normalizeFileName(stripExtension(file.fileName));
    const pathSegments = relativePath.split('/').filter(Boolean);
    const reasons = new Set<string>();
    let score = 0;

    for (const signal of signals) {
      const normalizedSignal = normalizePath(signal.value);
      const normalizedFileSignal = normalizeFileName(signal.value);
      const signalBaseName = normalizeFileName(stripExtension(signal.value.split('/').pop() ?? signal.value));
      if (!normalizedSignal || !normalizedFileSignal) continue;

      if (signal.kind === 'file' && fileName === normalizedFileSignal) {
        score += 100;
        reasons.add('file-name');
      }
      if (signal.kind === 'path' && relativePath.endsWith(normalizedSignal)) {
        score += 95;
        reasons.add('relative-path');
      }
      if (signal.kind === 'apiPath' && matchesApiPath(relativePath, normalizedSignal)) {
        score += 60;
        reasons.add('api-path');
      }
      if (signal.kind === 'component' && fileBaseName === normalizeFileName(signal.value)) {
        score += 80;
        reasons.add('component-name');
      }
      if (signalBaseName.length >= 4 && fileBaseName.includes(signalBaseName)) {
        score += 35;
        reasons.add('name-fragment');
      }
      if (pathSegments.some((segment) => normalizeFileName(segment) === signalBaseName && signalBaseName.length >= 4)) {
        score += 20;
        reasons.add('path-segment');
      }
    }

    if (score > 0) {
      candidates.set(file.relativePath, {
        relativePath: file.relativePath,
        fileName: file.fileName,
        extension: file.extension,
        language: file.language,
        matchReasons: Array.from(reasons).sort(),
        score,
      });
    }
  }

  return Array.from(candidates.values())
    .filter((candidate) => TECHNICAL_FILE_EXTENSIONS.has(candidate.extension) || candidate.extension.length === 0)
    .sort((left, right) => right.score - left.score || left.relativePath.localeCompare(right.relativePath))
    .slice(0, MAX_RELATED_FILES);
}

export function formatProjectDiagnosisContext(diagnosis: ProjectAwareScreenDiagnosis): string {
  const signals = diagnosis.signals.map((signal) => `${signal.kind}:${signal.value}`).join('\n');
  const files = diagnosis.relatedFiles
    .map((file) => `${file.relativePath}\t${file.language}\t${file.matchReasons.join(',')}`)
    .join('\n');

  return [
    'projectAwareScreenDiagnosis=enabled',
    signals ? `[detectedSignals]\n${signals}` : '[detectedSignals]\n',
    files ? `[relatedFiles]\n${files}` : '[relatedFiles]\n',
  ].join('\n');
}

function collectMatches(source: string, pattern: RegExp, kind: ScreenProjectSignal['kind'], signals: Map<string, ScreenProjectSignal>) {
  for (const match of source.matchAll(pattern)) {
    const value = sanitizeSignal(match[1] ?? '');
    if (!value) continue;
    const key = `${kind}:${value.toLocaleLowerCase()}`;
    if (!signals.has(key)) signals.set(key, { value, kind });
  }
}

function sanitizeSignal(value: string): string {
  const normalized = value.trim().replaceAll('\\', '/').replace(/[.,;:]+$/g, '');
  if (normalized.length < 3 || normalized.length > 180) return '';
  if (normalized.includes('..') || normalized.startsWith('file:')) return '';
  return normalized;
}

function normalizePath(value: string): string {
  return value.trim().replaceAll('\\', '/').replace(/^\.\//, '').toLocaleLowerCase();
}

function normalizeFileName(value: string): string {
  return value.trim().replaceAll('\\', '/').split('/').pop()?.toLocaleLowerCase() ?? '';
}

function stripExtension(value: string): string {
  const normalized = value.trim();
  const index = normalized.lastIndexOf('.');
  return index > 0 ? normalized.slice(0, index) : normalized;
}

function matchesApiPath(relativePath: string, apiPath: string): boolean {
  const apiSegments = apiPath
    .split('/')
    .map((segment) => segment.trim().toLocaleLowerCase())
    .filter((segment) => segment.length >= 2 && !segment.startsWith(':') && !segment.startsWith('{'));
  if (apiSegments.length === 0) return false;
  const normalizedPath = relativePath.toLocaleLowerCase();
  return apiSegments.some((segment) => normalizedPath.includes(segment));
}
