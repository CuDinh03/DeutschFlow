import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  clearDraft,
  pruneStaleDrafts,
  readDraft,
  remainingSeconds,
  writeDraft,
  type ExamDraft,
} from './examDraft'

/**
 * Hợp đồng của bản nháp bài thi (S-09 / B-14).
 *
 * Đây là thứ đứng giữa người thi và việc mất bài, nên bộ test này bám vào hai điều: khôi phục
 * ĐÚNG những gì đã lưu, và **không bao giờ ném** — storage có thể chết ở bất kỳ bước nào (chế độ
 * riêng tư, site data bị chặn, hết quota) và một exception ở đây sẽ giết cả màn thi.
 */

/**
 * jsdom trong repo này KHÔNG cấp `localStorage` (global có tồn tại nhưng là object rỗng, không có
 * `setItem`). Nên spec tự dựng một Storage trong bộ nhớ đúng hợp đồng Web Storage thay vì sửa
 * `vitest.config` toàn repo — thứ đang được kiểm là hành vi của module, không phải của jsdom.
 */
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

function draft(over: Partial<ExamDraft> = {}): ExamDraft {
  return {
    attemptId: 77,
    answers: { q1: 'A', q2: 'richtig' },
    deadlineAt: NOW + 30 * 60_000,
    sectionIdx: 1,
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
  it('vòng tròn write → read giữ nguyên đáp án, mốc hết giờ và phần đang làm', () => {
    expect(writeDraft(draft())).toBe(true)
    expect(readDraft(77)).toEqual(draft())
  })

  it('chưa có nháp thì trả null chứ không phải nháp rỗng', () => {
    expect(readDraft(77)).toBeNull()
  })

  it('clearDraft xoá đúng attempt, không đụng attempt khác', () => {
    writeDraft(draft())
    writeDraft(draft({ attemptId: 78 }))
    clearDraft(77)
    expect(readDraft(77)).toBeNull()
    expect(readDraft(78)).not.toBeNull()
  })
})

describe('dữ liệu trong storage là dữ liệu KHÔNG tin được', () => {
  it('JSON hỏng → null, không ném', () => {
    store.setItem('df.exam.draft.v1.77', '{ hỏng')
    expect(() => readDraft(77)).not.toThrow()
    expect(readDraft(77)).toBeNull()
  })

  it('nháp của attempt khác bị nhét vào đúng khoá → null (không trộn bài của hai lần thi)', () => {
    store.setItem('df.exam.draft.v1.77', JSON.stringify(draft({ attemptId: 999 })))
    expect(readDraft(77)).toBeNull()
  })

  it('thiếu deadlineAt → null, vì không có mốc hết giờ thì đồng hồ không dựng lại được', () => {
    const bad = { ...draft(), deadlineAt: undefined }
    store.setItem('df.exam.draft.v1.77', JSON.stringify(bad))
    expect(readDraft(77)).toBeNull()
  })

  it('giá trị đáp án không phải chuỗi bị loại, phần còn lại vẫn dùng được', () => {
    const messy = { ...draft(), answers: { q1: 'A', q2: 42, q3: null, q4: 'B' } }
    store.setItem('df.exam.draft.v1.77', JSON.stringify(messy))
    expect(readDraft(77)?.answers).toEqual({ q1: 'A', q4: 'B' })
  })

  it('sectionIdx rác → về 0 thay vì để NaN lọt vào chỉ số mảng', () => {
    store.setItem('df.exam.draft.v1.77', JSON.stringify({ ...draft(), sectionIdx: 'hai' }))
    expect(readDraft(77)?.sectionIdx).toBe(0)
  })
})

describe('storage chết thì phải im lặng thất bại, không được ném', () => {
  it('setItem ném (hết quota / chế độ riêng tư) → writeDraft trả false', () => {
    vi.spyOn(store, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError')
    })
    expect(() => writeDraft(draft())).not.toThrow()
    expect(writeDraft(draft())).toBe(false)
  })

  it('getItem ném → readDraft trả null', () => {
    vi.spyOn(store, 'getItem').mockImplementation(() => {
      throw new DOMException('SecurityError')
    })
    expect(readDraft(77)).toBeNull()
  })

  it('removeItem ném → clearDraft vẫn không ném', () => {
    vi.spyOn(store, 'removeItem').mockImplementation(() => {
      throw new DOMException('SecurityError')
    })
    expect(() => clearDraft(77)).not.toThrow()
  })
})

describe('dọn nháp quá hạn', () => {
  it('xoá nháp cũ hơn 24 giờ, giữ nháp mới', () => {
    writeDraft(draft({ attemptId: 1, savedAt: NOW - 25 * 60 * 60 * 1000 }))
    writeDraft(draft({ attemptId: 2, savedAt: NOW - 60 * 1000 }))
    expect(pruneStaleDrafts(NOW)).toBe(1)
    expect(readDraft(1)).toBeNull()
    expect(readDraft(2)).not.toBeNull()
  })

  it('nháp hỏng cũng là rác — dọn luôn', () => {
    store.setItem('df.exam.draft.v1.9', 'không phải json')
    expect(pruneStaleDrafts(NOW)).toBe(1)
    expect(store.getItem('df.exam.draft.v1.9')).toBeNull()
  })

  it('không đụng khoá của phần khác trong localStorage', () => {
    store.setItem('accessToken', 'giữ nguyên')
    writeDraft(draft({ savedAt: NOW - 48 * 60 * 60 * 1000 }))
    pruneStaleDrafts(NOW)
    expect(store.getItem('accessToken')).toBe('giữ nguyên')
  })
})

describe('remainingSeconds — chỗ B-13 đo ra lỗi cấp thêm giờ', () => {
  it('tính theo mốc tuyệt đối, nên tải lại KHÔNG làm đồng hồ đầy lại', () => {
    const deadline = NOW + 30 * 60_000
    expect(remainingSeconds(deadline, NOW)).toBe(1800)
    // 12 phút sau — đúng kịch bản attempt IN_PROGRESS trong probe B-13.
    expect(remainingSeconds(deadline, NOW + 12 * 60_000)).toBe(1080)
  })

  it('quá hạn thì kẹp về 0, không trả số âm', () => {
    expect(remainingSeconds(NOW, NOW + 5000)).toBe(0)
  })

  it('làm tròn LÊN để không mất một giây ngay khi vào bài', () => {
    expect(remainingSeconds(NOW + 1500, NOW)).toBe(2)
  })
})
