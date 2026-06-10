const SESSION_STORAGE_KEY = 'devjarvis.clientSessionId';

export function getOrCreateClientSessionId(): string {
  const existing = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (existing && /^[A-Za-z0-9._:-]{8,128}$/.test(existing)) {
    return existing;
  }

  const generated = crypto.randomUUID();
  window.localStorage.setItem(SESSION_STORAGE_KEY, generated);
  return generated;
}
