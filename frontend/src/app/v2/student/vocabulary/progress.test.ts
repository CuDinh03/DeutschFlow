import { afterEach, describe, expect, it, vi } from 'vitest'

import api from '@/lib/api'

import { EMPTY_TALLY, hasUnsaved, markWordLearned, tally } from './progress'

describe('tally', () => {
  it('đếm riêng lần lưu được và lần lưu hỏng', () => {
    let state = EMPTY_TALLY
    state = tally(state, true)
    state = tally(state, false)
    state = tally(state, true)

    expect(state).toEqual({ saved: 2, failed: 1 })
  })

  it('không sửa đối tượng cũ', () => {
    const before = EMPTY_TALLY
    const after = tally(before, true)

    expect(before).toEqual({ saved: 0, failed: 0 })
    expect(after).not.toBe(before)
  })
})

describe('hasUnsaved', () => {
  it('chỉ đúng khi có lần lưu hỏng — lượt toàn thành công không được doạ người học', () => {
    expect(hasUnsaved(EMPTY_TALLY)).toBe(false)
    expect(hasUnsaved({ saved: 20, failed: 0 })).toBe(false)
    expect(hasUnsaved({ saved: 0, failed: 1 })).toBe(true)
  })
})

describe('markWordLearned', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('gọi đúng endpoint đánh dấu đã học', async () => {
    const post = vi.spyOn(api, 'post').mockResolvedValue({ status: 202 } as never)

    await expect(markWordLearned(42)).resolves.toBe(true)
    expect(post).toHaveBeenCalledWith('/vocabulary/42/learn')
  })

  it('lưu hỏng thì trả false chứ KHÔNG ném — người học đang giữa lượt vuốt', async () => {
    vi.spyOn(api, 'post').mockRejectedValue(new Error('network down'))

    await expect(markWordLearned(7)).resolves.toBe(false)
  })

  it('kết quả hỏng cộng dồn được để màn kết thúc lượt nói ra', async () => {
    vi.spyOn(api, 'post').mockRejectedValue(new Error('500'))

    let state = EMPTY_TALLY
    for (const id of [1, 2, 3]) {
      state = tally(state, await markWordLearned(id))
    }

    expect(state).toEqual({ saved: 0, failed: 3 })
    expect(hasUnsaved(state)).toBe(true)
  })
})
