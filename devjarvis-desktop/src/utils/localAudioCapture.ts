import type { LocalSttAudioPayload } from '../types/jarvisCommand';

const DEFAULT_RECORDING_MILLIS = 6_000;
const MAX_AUDIO_BYTES = 12_000_000;
const AUDIO_MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/ogg',
] as const;

export type MicrophonePermissionState = 'granted' | 'prompt' | 'denied' | 'unsupported' | 'unknown';

export type MicrophonePermissionSnapshot = {
  state: MicrophonePermissionState;
  hasAudioInput: boolean | null;
  message: string;
};

export async function getMicrophonePermissionSnapshot(): Promise<MicrophonePermissionSnapshot> {
  if (!navigator.mediaDevices?.getUserMedia) {
    return {
      state: 'unsupported',
      hasAudioInput: false,
      message: '이 WebView에서는 마이크 입력을 사용할 수 없습니다.',
    };
  }

  const hasAudioInput = await detectAudioInputDevice();

  try {
    const permissions = navigator.permissions;
    if (!permissions?.query) {
      return {
        state: hasAudioInput === false ? 'unknown' : 'prompt',
        hasAudioInput,
        message: hasAudioInput === false ? '마이크 장치를 찾지 못했습니다.' : '마이크 권한 확인이 필요합니다.',
      };
    }

    const result = await permissions.query({ name: 'microphone' as PermissionName });
    return {
      state: result.state as MicrophonePermissionState,
      hasAudioInput,
      message: formatMicrophonePermissionMessage(result.state as MicrophonePermissionState, hasAudioInput),
    };
  } catch {
    return {
      state: hasAudioInput === false ? 'unknown' : 'prompt',
      hasAudioInput,
      message: hasAudioInput === false ? '마이크 장치를 찾지 못했습니다.' : '마이크 권한 확인이 필요합니다.',
    };
  }
}

export async function requestMicrophonePermission(): Promise<MicrophonePermissionSnapshot> {
  if (!navigator.mediaDevices?.getUserMedia) {
    return {
      state: 'unsupported',
      hasAudioInput: false,
      message: '이 WebView에서는 마이크 입력을 사용할 수 없습니다.',
    };
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: buildAudioConstraints(),
      video: false,
    });
    stream.getTracks().forEach((track) => track.stop());
    const snapshot = await getMicrophonePermissionSnapshot();
    return {
      ...snapshot,
      state: snapshot.state === 'denied' ? snapshot.state : 'granted',
      message: snapshot.state === 'denied' ? snapshot.message : '마이크 권한이 확인되었습니다.',
    };
  } catch {
    const snapshot = await getMicrophonePermissionSnapshot();
    return {
      ...snapshot,
      state: snapshot.state === 'prompt' ? 'denied' : snapshot.state,
      message: snapshot.state === 'denied'
        ? '마이크 권한이 차단되어 있습니다. Windows 앱 권한 또는 WebView 사이트 권한에서 허용해주세요.'
        : '마이크 권한을 확인하지 못했습니다.',
    };
  }
}

export async function recordShortLocalAudio(durationMillis = DEFAULT_RECORDING_MILLIS): Promise<LocalSttAudioPayload> {
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
    throw new Error('마이크 녹음을 사용할 수 없습니다. 브라우저/웹뷰 권한을 확인해주세요.');
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: buildAudioConstraints(),
    video: false,
  });

  try {
    const mimeType = resolveSupportedAudioMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType, audioBitsPerSecond: 64_000 } : undefined);
    const chunks: BlobPart[] = [];
    const startedAt = Date.now();

    recorder.addEventListener('dataavailable', (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    });

    const stopped = new Promise<void>((resolve, reject) => {
      recorder.addEventListener('stop', () => resolve(), { once: true });
      recorder.addEventListener('error', () => reject(new Error('마이크 녹음 중 오류가 발생했습니다.')), { once: true });
    });

    recorder.start(250);
    window.setTimeout(() => {
      if (recorder.state !== 'inactive') {
        recorder.stop();
      }
    }, durationMillis);

    await stopped;
    const blob = new Blob(chunks, { type: normalizeAudioMimeType(recorder.mimeType || mimeType || 'audio/webm') });
    if (blob.size <= 0) {
      throw new Error('녹음된 음성이 없습니다. 다시 말씀해주세요.');
    }
    if (blob.size > MAX_AUDIO_BYTES) {
      throw new Error('녹음 길이가 너무 깁니다. 짧게 다시 말씀해주세요.');
    }

    return {
      blob,
      mimeType: normalizeAudioMimeType(blob.type || 'audio/webm'),
      byteSize: blob.size,
      durationMillis: Date.now() - startedAt,
      recordedAt: new Date().toISOString(),
    };
  } finally {
    stream.getTracks().forEach((track) => track.stop());
  }
}

async function detectAudioInputDevice(): Promise<boolean | null> {
  if (!navigator.mediaDevices?.enumerateDevices) return null;
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.some((device) => device.kind === 'audioinput');
  } catch {
    return null;
  }
}

function buildAudioConstraints(): MediaTrackConstraints {
  return {
    channelCount: 1,
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  };
}

function resolveSupportedAudioMimeType(): string {
  return AUDIO_MIME_CANDIDATES.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) ?? '';
}

function normalizeAudioMimeType(value: string): LocalSttAudioPayload['mimeType'] {
  if (value.includes('ogg')) return 'audio/ogg';
  if (value.includes('mpeg') || value.includes('mp3')) return 'audio/mpeg';
  if (value.includes('wav')) return 'audio/wav';
  return 'audio/webm';
}

function formatMicrophonePermissionMessage(state: MicrophonePermissionState, hasAudioInput: boolean | null): string {
  if (hasAudioInput === false) return '마이크 장치를 찾지 못했습니다.';
  if (state === 'granted') return '마이크 권한이 허용되어 있습니다.';
  if (state === 'denied') return '마이크 권한이 차단되어 있습니다. Windows 앱 권한 또는 WebView 사이트 권한에서 허용해주세요.';
  if (state === 'unsupported') return '이 WebView에서는 마이크 권한 상태를 확인할 수 없습니다.';
  return '마이크 권한 확인이 필요합니다.';
}
