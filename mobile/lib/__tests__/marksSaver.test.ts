import { classifySaveError, createMarksSaver, createUndoStack, type MarksSaveState } from '@/lib/marksSaver'

const httpError = (status: number) => Object.assign(new Error(`HTTP ${status}`), { response: { status } })

/** Lời hứa điều khiển bằng tay: kiểm thứ tự lưu nối đuôi. */
function deferred() {
  let resolve!: () => void
  let reject!: (e: unknown) => void
  const promise = new Promise<void>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function setup(save: (p: string) => Promise<unknown>) {
  const states: MarksSaveState[] = []
  const saver = createMarksSaver<string>({ save, onState: (s) => states.push(s), delayMs: 800 })
  return { saver, states }
}

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

describe('classifySaveError', () => {
  test('mạng / 5xx / 408 / 429 ⇒ thử lại; 409 ⇒ đóng; 4xx khác ⇒ từ chối', () => {
    expect(classifySaveError(new Error('Network Error'))).toBe('retry')
    expect(classifySaveError(null)).toBe('retry')
    expect(classifySaveError(httpError(503))).toBe('retry')
    expect(classifySaveError(httpError(408))).toBe('retry')
    expect(classifySaveError(httpError(429))).toBe('retry')
    expect(classifySaveError(httpError(409))).toBe('closed')
    expect(classifySaveError(httpError(400))).toBe('rejected')
    expect(classifySaveError(httpError(404))).toBe('rejected')
  })
})

describe('createMarksSaver', () => {
  test('hẹn lưu sau quãng im, chỉ gửi gói cuối', async () => {
    const save = jest.fn().mockResolvedValue(undefined)
    const { saver, states } = setup(save)
    saver.change('a')
    saver.change('b')
    expect(save).not.toHaveBeenCalled()
    await jest.advanceTimersByTimeAsync(800)
    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith('b')
    expect(states).toEqual(['saving', 'saved'])
    expect(saver.isDirty()).toBe(false)
  })

  test('lưu nối đuôi: đổi trong lúc PUT đang bay ⇒ chờ xong rồi mới gửi gói mới, không hai PUT cùng lúc', async () => {
    const first = deferred()
    const save = jest.fn().mockReturnValueOnce(first.promise).mockResolvedValue(undefined)
    const { saver } = setup(save)
    saver.change('a')
    const f1 = saver.flush()
    saver.change('b')
    await jest.advanceTimersByTimeAsync(800)
    expect(save).toHaveBeenCalledTimes(1)
    first.resolve()
    await f1
    await jest.advanceTimersByTimeAsync(0)
    expect(save.mock.calls.map((c) => c[0])).toEqual(['a', 'b'])
  })

  test('flush khi rời màn: lưu ngay, không chờ hẹn giờ; không có gì thì không gửi', async () => {
    const save = jest.fn().mockResolvedValue(undefined)
    const { saver } = setup(save)
    await saver.flush()
    expect(save).not.toHaveBeenCalled()
    saver.change('a')
    await saver.flush()
    expect(save).toHaveBeenCalledWith('a')
    await jest.advanceTimersByTimeAsync(800)
    expect(save).toHaveBeenCalledTimes(1)
  })

  test('lỗi mạng / 5xx ⇒ giữ chưa lưu, lần flush sau gửi lại', async () => {
    const save = jest.fn().mockRejectedValueOnce(httpError(502)).mockResolvedValue(undefined)
    const { saver, states } = setup(save)
    saver.change('a')
    await saver.flush()
    expect(states).toEqual(['saving', 'error'])
    expect(saver.isDirty()).toBe(true)
    await saver.flush()
    expect(save.mock.calls.map((c) => c[0])).toEqual(['a', 'a'])
    expect(states[states.length - 1]).toBe('saved')
  })

  test('400 ⇒ không gửi lại cùng gói; thay đổi mới thì thử gói mới', async () => {
    const save = jest.fn().mockRejectedValueOnce(httpError(400)).mockResolvedValue(undefined)
    const { saver, states } = setup(save)
    saver.change('hong')
    await saver.flush()
    expect(states).toEqual(['saving', 'rejected'])
    expect(saver.isDirty()).toBe(false)
    await saver.flush()
    expect(save).toHaveBeenCalledTimes(1)
    saver.change('moi')
    await saver.flush()
    expect(save.mock.calls.map((c) => c[0])).toEqual(['hong', 'moi'])
  })

  test('409 (lượt đã đóng) ⇒ ngừng hẳn, mọi thay đổi sau bỏ qua', async () => {
    const save = jest.fn().mockRejectedValue(httpError(409))
    const { saver, states } = setup(save)
    saver.change('a')
    await saver.flush()
    expect(states).toEqual(['saving', 'closed'])
    saver.change('b')
    await jest.advanceTimersByTimeAsync(800)
    await saver.flush()
    expect(save).toHaveBeenCalledTimes(1)
  })

  test('đổi nguồn: close() lưu nốt vào nguồn cũ rồi không nhận thay đổi nữa; nguồn mới lưu riêng', async () => {
    const saveA = jest.fn().mockResolvedValue(undefined)
    const saveB = jest.fn().mockResolvedValue(undefined)
    const a = createMarksSaver<string>({ save: saveA })
    const b = createMarksSaver<string>({ save: saveB })
    a.change('cua-A')
    await a.close()
    a.change('muon')
    b.change('cua-B')
    await jest.advanceTimersByTimeAsync(800)
    expect(saveA.mock.calls.map((c) => c[0])).toEqual(['cua-A'])
    expect(saveB.mock.calls.map((c) => c[0])).toEqual(['cua-B'])
  })
})

describe('createUndoStack', () => {
  test('lấy lại bước gần nhất, giới hạn số bước, xoá được', () => {
    const u = createUndoStack<number>(3)
    expect(u.pop()).toBeUndefined()
    ;[1, 2, 3, 4].forEach((n) => u.push(n))
    expect(u.depth()).toBe(3)
    expect(u.pop()).toBe(4)
    expect(u.pop()).toBe(3)
    expect(u.depth()).toBe(1)
    u.clear()
    expect(u.depth()).toBe(0)
  })
})
