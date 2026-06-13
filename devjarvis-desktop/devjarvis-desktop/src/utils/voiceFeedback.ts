const DEFAULT_LANG = 'ko-KR';
const MAX_SPOKEN_CHARS = 120;
const PREFERRED_KO_VOICE_HINTS = [
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
};

let cachedVoice: SpeechSynthesisVoice | null = null;
let voicesWarmed = false;

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

export function getDevJarvisSpeechProfile(): DevJarvisSpeechProfile {
  if (!canUseLocalSpeech()) {
    return { available: false, hasKoreanVoice: false, voiceName: null };
  }
  const voice = cachedVoice ?? selectDevJarvisVoice(window.speechSynthesis.getVoices());
  cachedVoice = voice;
  return {
    available: true,
    hasKoreanVoice: Boolean(voice && isKoreanVoice(voice)),
    voiceName: voice?.name ?? null,
  };
}

export function speakDevJarvis(message: string): Promise<void> {
  const text = normalizeSpeechText(message);
  if (!text || !canUseLocalSpeech()) {
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
    utterance.rate = 0.88;
    utterance.pitch = 0.72;
    utterance.volume = 1;
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    window.speechSynthesis.speak(utterance);
  });
}

export function speakDevJarvisNow(message: string): void {
  void speakDevJarvis(message);
}

export function buildResultSpeech(summary: string): string {
  const normalized = normalizeSpeechText(summary);
  if (!normalized) {
    return '완료했습니다.';
  }

  if (normalized.length <= MAX_SPOKEN_CHARS) {
    return normalized;
  }

  return `${normalized.slice(0, MAX_SPOKEN_CHARS).trim()}… 자세한 내용은 결과 창에서 확인해주세요.`;
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
  return value
    .replace(/[`*_#>|{}\[\]]/g, ' ')
    .replace(/https?:\/\/\S+/g, '링크')
    .replace(/\b[A-Z]:\\[^\s]+/gi, '경로')
    .replace(/\s+/g, ' ')
    .trim();
}
