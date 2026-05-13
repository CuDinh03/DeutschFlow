/**
 * TTS Utility — DeutschFlow
 * Shared helper để phát âm tiếng Đức qua Edge TTS backend.
 * Dùng chung cho AudioButton, VocabCard auto-play, v.v.
 */

import api from '@/lib/api';

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
    const payload = { text, persona: "DEFAULT" };
    // Mặc dù API backend chưa parse tham số speed, ta vẫn có thể thiết lập
    // nếu muốn nâng cấp về sau
    const resp = await api.post('/ai-speaking/tts', payload, { responseType: 'blob' });
    const blob = resp.data;
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
