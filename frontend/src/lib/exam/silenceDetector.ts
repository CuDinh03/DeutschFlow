/**
 * Tự dừng ghi âm khi im (Đợt 5 phòng thi nói, owner chốt 07/11/2026: có công tắc tắt).
 *
 * Chỉ dừng khi ĐÃ nghe thấy người nói rồi mới im liền `silenceMs` — bấm micro rồi nghĩ vài giây
 * trước khi nói thì không bị cắt. Trình duyệt trả mức âm phẳng (AudioContext bị treo, Safari/iOS
 * chặn) thì không bao giờ "nghe thấy" → không tự dừng, người học bấm tay như cũ (hỏng an toàn).
 */
export interface SilenceDetectorOptions {
  /** Im liền bao lâu thì dừng (ms). */
  silenceMs?: number
  /** Mức đỉnh (0–1) coi là có tiếng nói. */
  threshold?: number
  /** Phải có tiếng nói tổng cộng ít nhất bấy lâu mới tính là đã bắt đầu nói (ms) — chống tiếng gõ/ho. */
  minSpeechMs?: number
}

export const AUTO_STOP_SILENCE_MS = 2000

export function createSilenceDetector({ silenceMs = AUTO_STOP_SILENCE_MS, threshold = 0.06, minSpeechMs = 300 }: SilenceDetectorOptions = {}) {
  let speechMs = 0
  let lastAt: number | null = null
  let lastLoudAt: number | null = null
  return {
    /** Cập nhật một mẫu mức âm; trả `true` khi nên dừng ghi. */
    update(peak: number, now: number): boolean {
      const dt = lastAt == null ? 0 : Math.max(0, now - lastAt)
      lastAt = now
      if (peak >= threshold) {
        speechMs += dt
        lastLoudAt = now
        return false
      }
      return speechMs >= minSpeechMs && lastLoudAt != null && now - lastLoudAt >= silenceMs
    },
  }
}

/** Mức đỉnh 0–1 của một khung dạng sóng 8-bit (128 = im). */
export function peakOf(data: Uint8Array): number {
  let peak = 0
  for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i] - 128) / 128)
  return peak
}

const AUTO_STOP_KEY = 'df.oral.autoStop'

/** Công tắc theo máy người học (mặc định bật); bộ nhớ trình duyệt hỏng thì coi như bật. */
export function readAutoStop(): boolean {
  try {
    return window.localStorage.getItem(AUTO_STOP_KEY) !== '0'
  } catch {
    return true
  }
}

export function writeAutoStop(on: boolean): void {
  try {
    window.localStorage.setItem(AUTO_STOP_KEY, on ? '1' : '0')
  } catch {
    /* chế độ riêng tư: chỉ nhớ trong phiên */
  }
}
