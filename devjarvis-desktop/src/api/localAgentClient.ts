import type {
  LocalAgentHealthResponse,
  LocalLlmAnalyzeRequest,
  LocalLlmAnalyzeResponse,
  ScreenOcrRequest,
  ScreenOcrResponse,
} from '../types/jarvisCommand';
import type { ApiResponse } from '../types/projectScanner';

const DEFAULT_LOCAL_AGENT_BASE_URL = 'http://127.0.0.1:17997';
const DEFAULT_REQUEST_TIMEOUT_MS = 2500;

export const localAgentBaseUrl = import.meta.env.VITE_DEVJARVIS_LOCAL_AGENT_BASE_URL ?? DEFAULT_LOCAL_AGENT_BASE_URL;

async function requestLocalAgentJson<T>(path: string, init?: RequestInit, timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${localAgentBaseUrl}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });

    const payload = (await response.json()) as ApiResponse<T>;
    if (!response.ok || !payload.success || payload.data === null) {
      throw new Error(payload.error?.message ?? `Local Agent request failed. status=${response.status}`);
    }

    return payload.data;
  } catch (caught) {
    if (caught instanceof DOMException && caught.name === 'AbortError') {
      throw new Error('Local Agent request timed out.');
    }
    throw caught;
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function getLocalAgentHealth(): Promise<LocalAgentHealthResponse> {
  return requestLocalAgentJson<LocalAgentHealthResponse>('/internal/local-llm/health', {
    method: 'GET',
  });
}

export async function extractScreenOcrWithLocalAgent(input: ScreenOcrRequest): Promise<ScreenOcrResponse> {
  return requestLocalAgentJson<ScreenOcrResponse>('/internal/local-ocr/extract', {
    method: 'POST',
    body: JSON.stringify({
      commandId: input.commandId,
      intent: input.intent,
      image: input.image,
    }),
  }, 30000);
}

export async function analyzeWithLocalAgent(input: LocalLlmAnalyzeRequest): Promise<LocalLlmAnalyzeResponse> {
  return requestLocalAgentJson<LocalLlmAnalyzeResponse>('/internal/local-llm/analyze', {
    method: 'POST',
    body: JSON.stringify(input),
  }, 30000);
}
