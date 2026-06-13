const DEFAULT_LANG = 'ko-KR';
const MAX_SPOKEN_CHARS = 120;

export function canUseLocalSpeech(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
}

export function speakDevJarvis(message: string): Promise<void> {
  const text = normalizeSpeechText(message);
  if (!text || !canUseLocalSpeech()) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = DEFAULT_LANG;
    utterance.rate = 0.96;
    utterance.pitch = 0.9;
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

function normalizeSpeechText(value: string): string {
  return value
    .replace(/[`*_#>|{}\[\]]/g, ' ')
    .replace(/https?:\/\/\S+/g, '링크')
    .replace(/\s+/g, ' ')
    .trim();
}
