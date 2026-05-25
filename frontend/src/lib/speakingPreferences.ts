const AUTO_TTS_KEY = "df-speaking-auto-tts";

export function getAutoTtsEnabled(): boolean {
  if (typeof window === "undefined") return true;
  const v = localStorage.getItem(AUTO_TTS_KEY);
  if (v === null) return true;
  return v === "1";
}

export function setAutoTtsEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(AUTO_TTS_KEY, enabled ? "1" : "0");
}
