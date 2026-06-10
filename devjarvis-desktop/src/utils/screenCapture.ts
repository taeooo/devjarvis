import type { ScreenCaptureResult } from '../types/jarvisCommand';

const VIDEO_READY_TIMEOUT_MS = 5_000;

export function isScreenCaptureSupported(): boolean {
  return Boolean(navigator.mediaDevices?.getDisplayMedia);
}

export async function captureScreenFrame(): Promise<ScreenCaptureResult> {
  if (!isScreenCaptureSupported()) {
    throw new Error('Screen capture is not available in this runtime.');
  }

  const stream = await navigator.mediaDevices.getDisplayMedia({
    audio: false,
    video: true,
  });

  try {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;

    await waitForVideoFrame(video);
    await video.play().catch(() => undefined);

    const width = video.videoWidth;
    const height = video.videoHeight;

    if (width <= 0 || height <= 0) {
      throw new Error('Screen capture frame is empty.');
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d', { alpha: false });
    if (!context) {
      throw new Error('Screen capture canvas is not available.');
    }

    context.drawImage(video, 0, 0, width, height);

    return {
      imageDataUrl: canvas.toDataURL('image/png'),
      width,
      height,
      capturedAt: new Date().toISOString(),
    };
  } finally {
    stream.getTracks().forEach((track) => track.stop());
  }
}

function waitForVideoFrame(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0 && video.videoHeight > 0) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error('Screen capture timed out.'));
    }, VIDEO_READY_TIMEOUT_MS);

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      video.removeEventListener('loadedmetadata', handleReady);
      video.removeEventListener('canplay', handleReady);
      video.removeEventListener('error', handleError);
    };

    const handleReady = () => {
      if (video.videoWidth <= 0 || video.videoHeight <= 0) {
        return;
      }
      cleanup();
      resolve();
    };

    const handleError = () => {
      cleanup();
      reject(new Error('Screen capture video stream failed.'));
    };

    video.addEventListener('loadedmetadata', handleReady);
    video.addEventListener('canplay', handleReady);
    video.addEventListener('error', handleError);
  });
}
