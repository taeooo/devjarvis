import type {
  ApiResponse,
  ManifestFile,
  ManifestRegisterResponse,
  ProjectResponse,
} from '../types/projectScanner';
import type { ScreenAnalysisRequest, ScreenAnalysisResponse, ScreenOcrRequest, ScreenOcrResponse } from '../types/jarvisCommand';
import { getOrCreateClientSessionId } from '../utils/clientSession';

const DEFAULT_BACKEND_BASE_URL = 'http://localhost:8080';

export const backendBaseUrl = import.meta.env.VITE_DEVJARVIS_BACKEND_BASE_URL ?? DEFAULT_BACKEND_BASE_URL;

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${backendBaseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-DevJarvis-Client-Session-Id': getOrCreateClientSessionId(),
      ...(init?.headers ?? {}),
    },
  });

  const payload = (await response.json()) as ApiResponse<T>;
  if (!response.ok || !payload.success || payload.data === null) {
    throw new Error(payload.error?.message ?? `Backend request failed. status=${response.status}`);
  }

  return payload.data;
}

export async function createProject(input: {
  name: string;
  rootPathAlias: string;
  description?: string;
}): Promise<ProjectResponse> {
  return requestJson<ProjectResponse>('/api/projects', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function registerProjectManifest(projectId: number, files: ManifestFile[]): Promise<ManifestRegisterResponse> {
  return requestJson<ManifestRegisterResponse>(`/api/projects/${projectId}/files/manifest`, {
    method: 'POST',
    body: JSON.stringify({ files }),
  });
}

export async function extractScreenOcr(input: ScreenOcrRequest): Promise<ScreenOcrResponse> {
  return requestJson<ScreenOcrResponse>('/api/screen/ocr', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}


export async function analyzeScreen(input: ScreenAnalysisRequest): Promise<ScreenAnalysisResponse> {
  return requestJson<ScreenAnalysisResponse>('/api/screen/analyze', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
