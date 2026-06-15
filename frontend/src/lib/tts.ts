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

function playBrowserTTS(text: string, speed: number = 1.0): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.speechSynthesis || !window.SpeechSynthesisUtterance) {
      reject(new Error('Web Speech API is not available'));
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'de-DE';
    utterance.rate = Math.max(0.5, Math.min(1.5, speed));
    utterance.onend = () => resolve();
    utterance.onerror = () => reject(new Error('Browser TTS failed'));

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  });
}

/**
 * Phát TTS cho văn bản tiếng Đức.
 * @param text  Văn bản cần đọc
 * @param speed Tốc độ phát (1.0 = bình thường, 0.75 = chậm)
 */
export async function playTTS(text: string, speed: number = 1.0): Promise<void> {
  if (!text?.trim()) return;

  stopTTS();

  try {
    const payload = { text, persona: 'DEFAULT' };
    // Backend (/api/ai-speaking/tts) trả raw audio/mpeg bytes, không phải JSON.
    // Đọc body dưới dạng Blob rồi phát qua object URL.
    const resp = await api.post('/ai-speaking/tts', payload, { responseType: 'blob' });
    const blob = resp.data as Blob;

    if (blob && blob.size > 0) {
      const objectUrl = URL.createObjectURL(blob);
      const audio = new Audio(objectUrl);
      _currentAudio = audio;

      const cleanup = () => {
        URL.revokeObjectURL(objectUrl);
        if (_currentAudio === audio) _currentAudio = null;
      };
      audio.onended = cleanup;
      audio.onerror = async () => {
        cleanup();
        try {
          await playBrowserTTS(text, speed);
        } catch {
          // ignore
        }
      };

      await audio.play();
      return;
    }

    await playBrowserTTS(text, speed);
  } catch {
    try {
      await playBrowserTTS(text, speed);
    } catch {
      _currentAudio = null;
    }
  }
}
