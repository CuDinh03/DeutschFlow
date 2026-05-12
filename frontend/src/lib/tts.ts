/**
 * TTS Utility — DeutschFlow
 * Shared helper để phát âm tiếng Đức qua Edge TTS backend.
 * Dùng chung cho AudioButton, VocabCard auto-play, v.v.
 */

let _currentAudio: HTMLAudioElement | null = null;

/** Dừng âm thanh đang phát (nếu có) */
export function stopTTS(): void {
  if (_currentAudio) {
    _currentAudio.pause();
    _currentAudio = null;
  }
}

/**
 * Phát TTS cho văn bản tiếng Đức.
 * @param text  Văn bản cần đọc
 * @param speed Tốc độ phát (1.0 = bình thường, 0.75 = chậm)
 */
export async function playTTS(text: string, speed: number = 1.0): Promise<void> {
  if (!text?.trim()) return;

  // Dừng audio đang phát
  stopTTS();

  try {
    const params = new URLSearchParams({ text });
    if (speed !== 1.0) params.set('speed', String(speed));

    const token = document.cookie
      .split('; ')
      .find(row => row.startsWith('auth_access='))
      ?.split('=')[1];

    const headers: HeadersInit = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const resp = await fetch(`/api/tts/speak?${params.toString()}`, { headers });
    if (!resp.ok) return;

    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);

    _currentAudio = audio;

    audio.onended = () => {
      URL.revokeObjectURL(url);
      if (_currentAudio === audio) _currentAudio = null;
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      if (_currentAudio === audio) _currentAudio = null;
    };

    await audio.play();
  } catch {
    _currentAudio = null;
  }
}
