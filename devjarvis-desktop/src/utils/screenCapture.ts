import type { ScreenCaptureResult } from '../types/jarvisCommand';

const VIDEO_READY_TIMEOUT_MS = 5_000;
const OCR_IMAGE_MIME: ScreenCaptureResult['mimeType'] = 'image/jpeg';
const MAX_CAPTURE_WIDTH = 1600;
const MAX_CAPTURE_HEIGHT = 1200;
const MAX_CAPTURE_BYTES = 1_500_000;
const JPEG_QUALITIES = [0.82, 0.74, 0.66, 0.58];

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

    const sourceWidth = video.videoWidth;
    const sourceHeight = video.videoHeight;

    if (sourceWidth <= 0 || sourceHeight <= 0) {
      throw new Error('Screen capture frame is empty.');
    }

    const { width, height } = fitWithinBounds(sourceWidth, sourceHeight, MAX_CAPTURE_WIDTH, MAX_CAPTURE_HEIGHT);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d', { alpha: false });
    if (!context) {
      throw new Error('Screen capture canvas is not available.');
    }

    context.drawImage(video, 0, 0, width, height);
    const { dataUrl, byteSize } = createBoundedDataUrl(canvas);

    return {
      imageDataUrl: dataUrl,
      mimeType: OCR_IMAGE_MIME,
      width,
      height,
      byteSize,
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

function fitWithinBounds(width: number, height: number, maxWidth: number, maxHeight: number): { width: number; height: number } {
  const scale = Math.min(1, maxWidth / width, maxHeight / height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function createBoundedDataUrl(canvas: HTMLCanvasElement): { dataUrl: string; byteSize: number } {
  for (const quality of JPEG_QUALITIES) {
    const dataUrl = canvas.toDataURL(OCR_IMAGE_MIME, quality);
    const byteSize = estimateDataUrlByteSize(dataUrl);
    if (byteSize > 0 && byteSize <= MAX_CAPTURE_BYTES) {
      return { dataUrl, byteSize };
    }
  }

  throw new Error('Screen capture is too large for secure OCR transfer.');
}

function estimateDataUrlByteSize(dataUrl: string): number {
  const commaIndex = dataUrl.indexOf(',');
  if (commaIndex < 0) {
    return 0;
  }

  const base64 = dataUrl.slice(commaIndex + 1);
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}
