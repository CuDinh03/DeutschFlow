/** Tự dừng ghi âm khi im (Đợt 5 phòng thi nói). */
import { describe, it, expect } from 'vitest'
import { createSilenceDetector, peakOf } from '@/lib/exam/silenceDetector'

/** Chạy một chuỗi mẫu cách nhau 100ms; trả mốc (ms) đầu tiên detector đòi dừng, hoặc null. */
function run(levels: number[], opts = {}) {
  const d = createSilenceDetector(opts)
  for (let i = 0; i < levels.length; i++) {
    if (d.update(levels[i], i * 100)) return i * 100
  }
  return null
}

describe('createSilenceDetector', () => {
  it('đã nói rồi im liền 2 giây → dừng đúng mốc', () => {
    const speech = Array(10).fill(0.3) // 0–900ms nói
    const silence = Array(30).fill(0.01)
    expect(run([...speech, ...silence])).toBe(900 + 2000)
  })

  it('chưa nói gì (bấm rồi nghĩ) → không bao giờ dừng', () => {
    expect(run(Array(100).fill(0.01))).toBeNull()
  })

  it('tiếng động ngắn dưới 300ms (ho, gõ) không tính là đã nói', () => {
    expect(run([0.01, 0.5, 0.5, 0.01, ...Array(40).fill(0.01)])).toBeNull()
  })

  it('ngừng giữa câu dưới 2 giây rồi nói tiếp → không cắt', () => {
    const levels = [...Array(5).fill(0.3), ...Array(15).fill(0.01), ...Array(5).fill(0.3), ...Array(10).fill(0.01)]
    expect(run(levels)).toBeNull()
  })

  it('mức âm phẳng (AudioContext bị treo) → hỏng an toàn, không tự dừng', () => {
    const flat = new Uint8Array(128).fill(128)
    expect(peakOf(flat)).toBe(0)
    expect(run(Array(100).fill(peakOf(flat)))).toBeNull()
  })

  it('peakOf đo đỉnh lệch khỏi 128', () => {
    expect(peakOf(new Uint8Array([128, 192, 64, 128]))).toBe(0.5)
  })
})
