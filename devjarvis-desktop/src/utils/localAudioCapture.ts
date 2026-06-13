export type LocalAudioCaptureSession = {
  stop: () => Promise<LocalAudioClip>;
};

export type LocalAudioClip = {
  blob: Blob;
  mimeType: string;
  byteSize: number;
  durationMillis: number;
  recordedAt: string;
};

const PREFERRED_AUDIO_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/ogg',
  'audio/wav',
];

export async function startLocalAudioCapture(): Promise<LocalAudioCaptureSession> {
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
    throw new Error('Local audio capture is not available in this WebView.');
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      noiseSuppression: true,
      echoCancellation: true,
    },
    video: false,
  });

  const chunks: BlobPart[] = [];
  const mimeType = resolveSupportedAudioMimeType();
  const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
  const startedAt = performance.now();
  const recordedAt = new Date().toISOString();

  recorder.addEventListener('dataavailable', (event) => {
    if (event.data.size > 0) {
      chunks.push(event.data);
    }
  });

  recorder.start();

  return {
    stop: () => new Promise<LocalAudioClip>((resolve, reject) => {
      const cleanup = () => {
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.addEventListener('stop', () => {
        cleanup();
        const blob = new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/webm' });
        resolve({
          blob,
          mimeType: blob.type || 'audio/webm',
          byteSize: blob.size,
          durationMillis: Math.max(0, Math.round(performance.now() - startedAt)),
          recordedAt,
        });
      }, { once: true });

      recorder.addEventListener('error', () => {
        cleanup();
        reject(new Error('Local audio recording failed.'));
      }, { once: true });

      if (recorder.state === 'inactive') {
        cleanup();
        reject(new Error('Local audio recording is already stopped.'));
        return;
      }

      recorder.stop();
    }),
  };
}

function resolveSupportedAudioMimeType(): string | undefined {
  return PREFERRED_AUDIO_MIME_TYPES.find((candidate) => MediaRecorder.isTypeSupported(candidate));
}
