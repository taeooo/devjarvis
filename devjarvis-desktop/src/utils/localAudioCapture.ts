import type { LocalSttAudioPayload } from '../types/jarvisCommand';

const DEFAULT_RECORDING_MILLIS = 6_000;
const MAX_AUDIO_BYTES = 12_000_000;
const AUDIO_MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/ogg',
] as const;

export async function recordShortLocalAudio(durationMillis = DEFAULT_RECORDING_MILLIS): Promise<LocalSttAudioPayload> {
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
    throw new Error('마이크 녹음을 사용할 수 없습니다. 브라우저/웹뷰 권한을 확인해주세요.');
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
    video: false,
  });

  try {
    const mimeType = resolveSupportedAudioMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
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

    recorder.start();
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

function resolveSupportedAudioMimeType(): string {
  return AUDIO_MIME_CANDIDATES.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) ?? '';
}

function normalizeAudioMimeType(value: string): LocalSttAudioPayload['mimeType'] {
  if (value.includes('ogg')) return 'audio/ogg';
  if (value.includes('mpeg') || value.includes('mp3')) return 'audio/mpeg';
  if (value.includes('wav')) return 'audio/wav';
  return 'audio/webm';
}
