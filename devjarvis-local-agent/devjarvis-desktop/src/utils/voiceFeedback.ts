const DEFAULT_LANG = 'ko-KR';
const MAX_SPOKEN_CHARS = 180;
const LOCAL_TTS_PLAYBACK_PREROLL_MS = 180;
const DEFAULT_LOCAL_AGENT_BASE_URL = 'http://127.0.0.1:17997';
const PREFERRED_KO_VOICE_HINTS = [
  'injoon',
  'jinho',
  'woong',
  'male',
  'heami',
  'sunhi',
  'yuna',
  'hyeri',
  'korean',
  'ko-kr',
  '한국',
  '대한민국',
];

export type DevJarvisSpeechProfile = {
  available: boolean;
  hasKoreanVoice: boolean;
  voiceName: string | null;
  localTtsAvailable: boolean;
  localTtsWarning: string | null;
};

const localAgentBaseUrl = import.meta.env.VITE_DEVJARVIS_LOCAL_AGENT_BASE_URL ?? DEFAULT_LOCAL_AGENT_BASE_URL;

let cachedVoice: SpeechSynthesisVoice | null = null;
let voicesWarmed = false;
let localTtsStatus: { available: boolean; warning: string | null; checkedAt: number } | null = null;
let currentAudio: HTMLAudioElement | null = null;

export function canUseLocalSpeech(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
}

export function warmupDevJarvisVoices(): void {
  if (!canUseLocalSpeech() || voicesWarmed) return;
  voicesWarmed = true;
  const load = () => {
    cachedVoice = selectDevJarvisVoice(window.speechSynthesis.getVoices());
  };
  load();
  window.speechSynthesis.addEventListener?.('voiceschanged', load, { once: true });
}

export async function getDevJarvisSpeechProfile(): Promise<DevJarvisSpeechProfile> {
  const localStatus = await getLocalTtsStatus();
  if (!canUseLocalSpeech()) {
    return {
      available: localStatus.available,
      hasKoreanVoice: false,
      voiceName: null,
      localTtsAvailable: localStatus.available,
      localTtsWarning: localStatus.warning,
    };
  }

  const voice = cachedVoice ?? selectDevJarvisVoice(window.speechSynthesis.getVoices());
  cachedVoice = voice;
  return {
    available: localStatus.available || true,
    hasKoreanVoice: Boolean(voice && isKoreanVoice(voice)),
    voiceName: voice?.name ?? null,
    localTtsAvailable: localStatus.available,
    localTtsWarning: localStatus.warning,
  };
}

export async function speakDevJarvis(message: string): Promise<void> {
  const text = normalizeSpeechText(message);
  if (!text) return;

  const localSpoken = await trySpeakWithLocalTts(text);
  if (localSpoken) return;

  await speakWithBrowserSpeech(text);
}

export function speakDevJarvisNow(message: string): void {
  void speakDevJarvis(message);
}

export function buildResultSpeech(summary: string): string {
  const normalized = normalizeSpeechText(summary);
  if (!normalized) {
    return '처리했습니다. 결과를 확인해 주세요.';
  }

  if (normalized.length <= MAX_SPOKEN_CHARS) {
    return normalized;
  }

  return `${normalized.slice(0, MAX_SPOKEN_CHARS).trim()}… 자세한 내용은 결과 창에서 확인해주세요.`;
}

async function trySpeakWithLocalTts(text: string): Promise<boolean> {
  const status = await getLocalTtsStatus();
  if (!status.available) return false;

  try {
    stopCurrentAudio();
    if (canUseLocalSpeech()) {
      window.speechSynthesis.cancel();
    }

    const response = await fetch(`${localAgentBaseUrl}/internal/local-tts/synthesize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!response.ok) return false;

    const blob = await response.blob();
    if (blob.size <= 0) return false;

    const url = URL.createObjectURL(blob);
    try {
      await playAudioUrl(url);
    } finally {
      URL.revokeObjectURL(url);
    }
    return true;
  } catch {
    return false;
  }
}

async function getLocalTtsStatus(): Promise<{ available: boolean; warning: string | null }> {
  const now = Date.now();
  if (localTtsStatus && now - localTtsStatus.checkedAt < 10_000) {
    return localTtsStatus;
  }

  try {
    const response = await fetch(`${localAgentBaseUrl}/internal/local-tts/health`, { method: 'GET' });
    const payload = await response.json() as { success?: boolean; data?: { available?: boolean; warning?: string | null } | null };
    const next = {
      available: Boolean(response.ok && payload.success && payload.data?.available),
      warning: payload.data?.warning ?? null,
      checkedAt: now,
    };
    localTtsStatus = next;
    return next;
  } catch {
    const next = { available: false, warning: 'Local TTS is not ready.', checkedAt: now };
    localTtsStatus = next;
    return next;
  }
}

function playAudioUrl(url: string): Promise<void> {
  return new Promise((resolve) => {
    const audio = new Audio(url);
    currentAudio = audio;
    audio.preload = 'auto';
    audio.volume = 1;

    let resolved = false;
    const finish = () => {
      if (resolved) return;
      resolved = true;
      if (currentAudio === audio) currentAudio = null;
      resolve();
    };

    const startPlayback = () => {
      window.setTimeout(() => {
        if (currentAudio !== audio) {
          finish();
          return;
        }
        void audio.play().catch(() => finish());
      }, LOCAL_TTS_PLAYBACK_PREROLL_MS);
    };

    audio.onended = finish;
    audio.onerror = finish;
    audio.oncanplaythrough = startPlayback;
    audio.load();
  });
}

function stopCurrentAudio(): void {
  if (!currentAudio) return;
  try {
    currentAudio.pause();
    currentAudio.currentTime = 0;
  } catch {
    // ignore playback cleanup errors
  }
  currentAudio = null;
}

function speakWithBrowserSpeech(text: string): Promise<void> {
  if (!canUseLocalSpeech()) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = cachedVoice ?? selectDevJarvisVoice(window.speechSynthesis.getVoices());
    cachedVoice = voice;
    if (voice) {
      utterance.voice = voice;
    }
    utterance.lang = voice?.lang || DEFAULT_LANG;
    utterance.rate = 0.86;
    utterance.pitch = 0.84;
    utterance.volume = 1;
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    window.speechSynthesis.speak(utterance);
  });
}

function selectDevJarvisVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (voices.length === 0) return null;

  const koreanVoices = voices.filter(isKoreanVoice);
  const preferred = koreanVoices.find((voice) => {
    const haystack = `${voice.name} ${voice.lang} ${voice.voiceURI}`.toLowerCase();
    return PREFERRED_KO_VOICE_HINTS.some((hint) => haystack.includes(hint));
  });
  if (preferred) return preferred;
  if (koreanVoices.length > 0) return koreanVoices[0];

  const nonEnglish = voices.find((voice) => !voice.lang.toLowerCase().startsWith('en'));
  return nonEnglish ?? voices[0];
}

function isKoreanVoice(voice: SpeechSynthesisVoice): boolean {
  const haystack = `${voice.lang} ${voice.name} ${voice.voiceURI}`.toLowerCase();
  return haystack.includes('ko') || haystack.includes('korean') || haystack.includes('한국');
}

function normalizeSpeechText(value: string): string {
  return stabilizeShortKoreanUtterance(value)
    .replace(/[`*_#>|{}\[\]]/g, ' ')
    .replace(/https?:\/\/\S+/g, '링크')
    .replace(/\b[A-Z]:\\[^\s]+/gi, '경로')
    .replace(/\s+/g, ' ')
    .trim();
}

function stabilizeShortKoreanUtterance(value: string): string {
  const normalized = value.trim();
  if (normalized === '네, 말씀하세요.' || normalized === '네. 말씀하세요.') {
    return '네. 듣고 있습니다.';
  }
  if (normalized.includes('화면을 선택')) {
    return '좋습니다. 화면을 보여주세요.';
  }
  if (normalized === '완료했습니다.') {
    return '처리했습니다. 결과를 확인해 주세요.';
  }
  if (normalized.startsWith('네, ')) {
    return normalized.replace('네, ', '네. ');
  }
  return value;
}
