import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  clearLessonDraft,
  practiceScope,
  pruneStaleLessonDrafts,
  readLessonDraft,
  writeLessonDraft,
  type LessonDraft,
} from './lessonDraft'

/**
 * Hợp đồng nháp bài luyện (S-04 AC-2 / B-17).
 *
 * Đo được trước khi viết module này: trả lời 2/3 câu rồi tải lại → còn **0**. `answers` chỉ nằm
 * trong `useState`, không storage, không `beforeunload` — cùng họ mất-trắng với engine thi ở B-13.
 *
 * Hai điều bộ test bám vào: khôi phục đúng thứ đã lưu, và **không bao giờ ném** (storage chết ở
 * chế độ riêng tư / site data bị chặn / hết quota sẽ giết cả màn luyện nếu module này ném).
 */

/** jsdom repo này KHÔNG cấp `localStorage` — dựng Storage trong bộ nhớ (xem examDraft.test.ts). */
class MemoryStorage implements Storage {
  private map = new Map<string, string>()
  get length() {
    return this.map.size
  }
  key(i: number): string | null {
    return Array.from(this.map.keys())[i] ?? null
  }
  getItem(k: string): string | null {
    return this.map.has(k) ? (this.map.get(k) as string) : null
  }
  setItem(k: string, v: string): void {
    this.map.set(k, String(v))
  }
  removeItem(k: string): void {
    this.map.delete(k)
  }
  clear(): void {
    this.map.clear()
  }
}

let store: MemoryStorage
const NOW = 1_756_000_000_000
const SCOPE = practiceScope(4321, 'lesen', 999)

function draft(over: Partial<LessonDraft> = {}): LessonDraft {
  return {
    scope: SCOPE,
    generation: 1,
    answers: { '0': { answer: 2, correct: true }, '1': { answer: 'Haus', correct: false } },
    savedAt: NOW,
    ...over,
  }
}

beforeEach(() => {
  store = new MemoryStorage()
  Object.defineProperty(window, 'localStorage', { value: store, configurable: true, writable: true })
})
afterEach(() => vi.restoreAllMocks())

describe('ghi và đọc lại', () => {
  it('vòng tròn write → read giữ nguyên đáp án số lẫn đáp án chữ', () => {
    expect(writeLessonDraft(draft())).toBe(true)
    expect(readLessonDraft(SCOPE, 1)).toEqual(draft())
  })

  it('chưa có nháp thì trả null chứ không phải nháp rỗng', () => {
    expect(readLessonDraft(SCOPE, 1)).toBeNull()
  })

  it('scope tách bạch từng kỹ năng của cùng một node', () => {
    writeLessonDraft(draft())
    writeLessonDraft(draft({ scope: practiceScope(4321, 'hoeren', 1000) }))
    clearLessonDraft(SCOPE)
    expect(readLessonDraft(SCOPE, 1)).toBeNull()
    expect(readLessonDraft(practiceScope(4321, 'hoeren', 1000), 1)).not.toBeNull()
  })
})

describe('đề đổi thì nháp cũ phải bị bỏ', () => {
  it('lệch generation → trả null, KHÔNG dán đáp án cũ lên đề mới', () => {
    writeLessonDraft(draft({ generation: 1 }))
    expect(readLessonDraft(SCOPE, 2)).toBeNull()
  })

  it('đúng generation thì vẫn khôi phục', () => {
    writeLessonDraft(draft({ generation: 3 }))
    expect(readLessonDraft(SCOPE, 3)?.answers).toEqual(draft().answers)
  })
})

describe('dữ liệu trong storage là thứ ngoài tầm kiểm soát', () => {
  it('JSON hỏng → null, không ném', () => {
    store.setItem(`df.lesson.draft.v1.${SCOPE}`, '{khong-phai-json')
    expect(() => readLessonDraft(SCOPE, 1)).not.toThrow()
    expect(readLessonDraft(SCOPE, 1)).toBeNull()
  })

  it('thiếu trường bắt buộc → null', () => {
    store.setItem(`df.lesson.draft.v1.${SCOPE}`, JSON.stringify({ scope: SCOPE }))
    expect(readLessonDraft(SCOPE, 1)).toBeNull()
  })

  it('bỏ qua từng đáp án sai hình dạng thay vì vứt cả bản nháp', () => {
    store.setItem(
      `df.lesson.draft.v1.${SCOPE}`,
      JSON.stringify({
        scope: SCOPE,
        generation: 1,
        savedAt: NOW,
        answers: {
          '0': { answer: 2, correct: true },
          '1': { answer: null, correct: true },
          '2': 'rác',
          '3': { answer: 'ok', correct: 'không phải boolean' },
        },
      }),
    )
    expect(readLessonDraft(SCOPE, 1)?.answers).toEqual({ '0': { answer: 2, correct: true } })
  })

  it('scope trong nháp lệch scope đang hỏi → null', () => {
    store.setItem(
      `df.lesson.draft.v1.${SCOPE}`,
      JSON.stringify({ ...draft(), scope: 'scope-khac' }),
    )
    expect(readLessonDraft(SCOPE, 1)).toBeNull()
  })
})

describe('storage chết thì degrade, tuyệt đối không ném', () => {
  it('không có window.localStorage → read null, write false, clear im lặng', () => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new Error('site data bị chặn')
      },
      configurable: true,
    })
    expect(readLessonDraft(SCOPE, 1)).toBeNull()
    expect(writeLessonDraft(draft())).toBe(false)
    expect(() => clearLessonDraft(SCOPE)).not.toThrow()
    expect(pruneStaleLessonDrafts(NOW)).toBe(0)
  })

  it('setItem ném (hết quota) → trả false để caller nói thật với người học', () => {
    vi.spyOn(store, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    expect(writeLessonDraft(draft())).toBe(false)
  })
})

describe('dọn nháp quá hạn', () => {
  it('xoá nháp cũ hơn 24 giờ, giữ nháp mới', () => {
    writeLessonDraft(draft({ savedAt: NOW - 25 * 60 * 60 * 1000 }))
    writeLessonDraft(draft({ scope: practiceScope(1, 'lesen', 2), savedAt: NOW }))
    expect(pruneStaleLessonDrafts(NOW)).toBe(1)
    expect(readLessonDraft(SCOPE, 1)).toBeNull()
    expect(readLessonDraft(practiceScope(1, 'lesen', 2), 1)).not.toBeNull()
  })

  it('không đụng khoá của module khác trong cùng storage', () => {
    store.setItem('df.exam.draft.v1.77', JSON.stringify({ savedAt: 0 }))
    pruneStaleLessonDrafts(NOW)
    expect(store.getItem('df.exam.draft.v1.77')).not.toBeNull()
  })
})
