import type {
  LocalAgentAppHealthResponse,
  LocalAgentHealthResponse,
  LocalLlmAnalyzeRequest,
  LocalWakeHealthResponse,
  LocalWakeSessionResponse,
  LocalLlmAnalyzeResponse,
  LocalOcrHealthResponse,
  LocalSttHealthResponse,
  LocalSttTranscribeResponse,
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
      throw new Error(payload.error?.message ?? 'Local assistant request failed.');
    }

    return payload.data;
  } catch (caught) {
    if (caught instanceof DOMException && caught.name === 'AbortError') {
      throw new Error('Local assistant request timed out.');
    }
    throw caught;
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function getLocalAgentAppHealth(): Promise<LocalAgentAppHealthResponse> {
  return requestLocalAgentJson<LocalAgentAppHealthResponse>('/health', {
    method: 'GET',
  });
}

export async function getLocalOcrHealth(): Promise<LocalOcrHealthResponse> {
  return requestLocalAgentJson<LocalOcrHealthResponse>('/internal/local-ocr/health', {
    method: 'GET',
  });
}

export async function getLocalAgentHealth(): Promise<LocalAgentHealthResponse> {
  return requestLocalAgentJson<LocalAgentHealthResponse>('/internal/local-llm/health', {
    method: 'GET',
  });
}

export async function extractScreenOcrWithLocalAgent(input: ScreenOcrRequest): Promise<ScreenOcrResponse> {
  return requestLocalAgentJson<ScreenOcrResponse>('/internal/local-ocr/extract', {
    method: 'POST',
    body: JSON.stringify(input),
  }, 30000);
}

export async function analyzeWithLocalAgent(input: LocalLlmAnalyzeRequest): Promise<LocalLlmAnalyzeResponse> {
  return requestLocalAgentJson<LocalLlmAnalyzeResponse>('/internal/local-llm/analyze', {
    method: 'POST',
    body: JSON.stringify(input),
  }, 30000);
}


export async function getLocalWakeHealth(): Promise<LocalWakeHealthResponse> {
  return requestLocalAgentJson<LocalWakeHealthResponse>('/internal/local-wake/health', {
    method: 'GET',
  });
}

export async function startLocalWakeSession(): Promise<LocalWakeSessionResponse> {
  return requestLocalAgentJson<LocalWakeSessionResponse>('/internal/local-wake/session/start', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function stopLocalWakeSession(): Promise<LocalWakeSessionResponse> {
  return requestLocalAgentJson<LocalWakeSessionResponse>('/internal/local-wake/session/stop', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function getLocalSttHealth(): Promise<LocalSttHealthResponse> {
  return requestLocalAgentJson<LocalSttHealthResponse>('/internal/local-stt/health', {
    method: 'GET',
  });
}

export async function transcribeWithLocalAgent(input: {
  commandId?: string;
  audio: Blob;
  durationMillis?: number | null;
  recordedAt?: string | null;
}): Promise<LocalSttTranscribeResponse> {
  const formData = new FormData();
  formData.append('audio', input.audio, resolveAudioFileName(input.audio.type));

  if (input.commandId) {
    formData.append('commandId', input.commandId);
  }

  if (typeof input.durationMillis === 'number') {
    formData.append('durationMillis', String(input.durationMillis));
  }

  if (input.recordedAt) {
    formData.append('recordedAt', input.recordedAt);
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(`${localAgentBaseUrl}/internal/local-stt/transcribe`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });

    const payload = (await response.json()) as ApiResponse<LocalSttTranscribeResponse>;
    if (!response.ok || !payload.success || payload.data === null) {
      throw new Error(payload.error?.message ?? 'Local voice transcription failed.');
    }

    return payload.data;
  } catch (caught) {
    if (caught instanceof DOMException && caught.name === 'AbortError') {
      throw new Error('Local voice transcription timed out.');
    }
    throw caught;
  } finally {
    window.clearTimeout(timeout);
  }
}

function resolveAudioFileName(mimeType: string): string {
  if (mimeType.includes('ogg')) return 'voice-command.ogg';
  if (mimeType.includes('wav')) return 'voice-command.wav';
  if (mimeType.includes('mpeg')) return 'voice-command.mp3';
  return 'voice-command.webm';
}
