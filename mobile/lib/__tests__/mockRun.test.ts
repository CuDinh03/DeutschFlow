import {
  anchorFromServer,
  classifyDraftSaveError,
  clockSpoken,
  clockTone,
  createDraftAutosaver,
  formatExamClock,
  mergeConflict,
  nextStage,
  parseDraftSaved,
  rawSectionNames,
  resumeStage,
  secondsLeft,
  sectionIndexForStage,
  shouldAutoSubmit,
  stagesIn,
  teilChipLabel,
  unansweredCount,
  type DraftSaveResult,
  type SaveState,
} from '../mockRun'
import { attemptStartFrom, rememberAttemptStart, takeAttemptStart } from '../attemptDraft'

const T0 = Date.parse('2026-11-19T10:00:00Z')

describe('đồng hồ theo giờ server', () => {
  it('tính từ deadline − server_now, không phụ thuộc giờ máy', () => {
    // Máy lệch 1 giờ so với server: vẫn còn đúng 90 phút.
    const clientAt = T0 + 3_600_000
    const a = anchorFromServer({ deadline_at: '2026-11-19T11:30:00Z', server_now: '2026-11-19T10:00:00Z', remaining_seconds: 5400 }, clientAt)
    expect(secondsLeft(a, clientAt)).toBe(5400)
    expect(secondsLeft(a, clientAt + 61_000)).toBe(5339)
    expect(secondsLeft(a, clientAt + 6_000_000)).toBe(0)
  })

  it('không đọc được mốc ISO thì lấy remaining_seconds trừ thời gian đã trôi', () => {
    const a = anchorFromServer({ deadline_at: 'hỏng', server_now: null, remaining_seconds: 120 }, T0)
    expect(secondsLeft(a, T0 + 30_500)).toBe(90)
    expect(secondsLeft(a, T0 + 999_000)).toBe(0)
  })

  it('đề không giới hạn giờ ⇒ không có đồng hồ', () => {
    expect(anchorFromServer({ server_now: '2026-11-19T10:00:00Z' }, T0)).toBeNull()
    expect(anchorFromServer(null, T0)).toBeNull()
    expect(secondsLeft(null, T0)).toBeNull()
  })

  it('định dạng giờ, nhãn đọc và màu cảnh báo', () => {
    expect(formatExamClock(4340)).toBe('1:12:20')
    expect(formatExamClock(3600)).toBe('1:00:00')
    expect(formatExamClock(245)).toBe('4:05')
    expect(formatExamClock(-3)).toBe('0:00')
    expect(clockSpoken(4340)).toBe('còn 1 giờ 12 phút')
    expect(clockSpoken(245)).toBe('còn 4 phút')
    expect(clockSpoken(30)).toBe('còn 30 giây')
    expect(clockTone(301)).toBe('normal')
    expect(clockTone(300)).toBe('warn')
    expect(clockTone(60)).toBe('danger')
  })

  it('tự nộp đúng một lần, chỉ khi đang ở màn thi', () => {
    const base = { secondsLeft: 0, focused: true, finished: false, submitting: false, fired: false }
    expect(shouldAutoSubmit(base)).toBe(true)
    expect(shouldAutoSubmit({ ...base, secondsLeft: 1 })).toBe(false)
    expect(shouldAutoSubmit({ ...base, secondsLeft: null })).toBe(false)
    expect(shouldAutoSubmit({ ...base, focused: false })).toBe(false)
    expect(shouldAutoSubmit({ ...base, fired: true })).toBe(false)
    expect(shouldAutoSubmit({ ...base, submitting: true })).toBe(false)
    expect(shouldAutoSubmit({ ...base, finished: true })).toBe(false)
  })
})

describe('phản hồi lưu nháp', () => {
  it('200: lấy version mới và mốc giờ để đồng bộ lại đồng hồ', () => {
    expect(parseDraftSaved({ version: 8, server_now: 's', deadline_at: 'd', remaining_seconds: 60 }, 7)).toEqual({
      kind: 'saved',
      version: 8,
      clock: { server_now: 's', deadline_at: 'd', remaining_seconds: 60 },
    })
    expect(parseDraftSaved({}, 7)).toMatchObject({ kind: 'saved', version: 8 })
  })

  it('409 lệch phiên bản trả bản nháp server; 409 lượt đã đóng; 410 hết giờ; mất mạng = lỗi', () => {
    expect(
      classifyDraftSaveError(409, {
        error: 'DRAFT_VERSION_CONFLICT',
        server_version: 5,
        draft: { answers_json: '{"a":"b"}', section_index: 2, version: 5 },
      }),
    ).toEqual({ kind: 'conflict', serverVersion: 5, draft: { answersJson: '{"a":"b"}', sectionIndex: 2, version: 5 } })
    expect(classifyDraftSaveError(409, { error: 'DRAFT_VERSION_CONFLICT', server_version: 3 })).toEqual({ kind: 'conflict', serverVersion: 3, draft: null })
    expect(classifyDraftSaveError(409, { error: 'ATTEMPT_NOT_IN_PROGRESS', server_version: 3 })).toEqual({ kind: 'closed' })
    expect(classifyDraftSaveError(410, { error: 'ATTEMPT_EXPIRED' })).toEqual({ kind: 'expired' })
    expect(classifyDraftSaveError(undefined, undefined)).toEqual({ kind: 'error' })
    expect(classifyDraftSaveError(500, {})).toEqual({ kind: 'error' })
  })

  it('gộp khi lệch: câu trên máy thắng, câu chỉ có trên server được giữ', () => {
    expect(mergeConflict({ a: 'x', c: 'z' }, { a: 'y', b: 'w' })).toEqual({ a: 'x', b: 'w', c: 'z' })
  })
})

describe('bộ tự lưu nháp', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  function setup(results: (DraftSaveResult | Error)[]) {
    const calls: { answers: Record<string, string>; base: number }[] = []
    const states: SaveState[] = []
    const resolvers: ((v: DraftSaveResult) => void)[] = []
    const save = jest.fn((payload: { answers: Record<string, string> }, base: number) => {
      calls.push({ answers: payload.answers, base })
      const next = results.shift()
      if (next instanceof Error) return Promise.reject(next)
      if (next) return Promise.resolve(next)
      return new Promise<DraftSaveResult>((r) => resolvers.push(r))
    })
    const onConflict = jest.fn()
    const onExpired = jest.fn()
    const onClosed = jest.fn()
    let clock = 0
    const saver = createDraftAutosaver({ save, onConflict, onExpired, onClosed, onState: (s) => states.push(s), now: () => clock })
    return { saver, save, calls, states, resolvers, onConflict, onExpired, onClosed, tick: (ms: number) => { clock += ms; jest.advanceTimersByTime(ms) } }
  }
  const flushPromises = async () => {
    for (let i = 0; i < 6; i++) await Promise.resolve()
  }

  it('chờ 2,5 giây im rồi mới lưu, gộp nhiều thay đổi thành một lần', async () => {
    const { saver, calls, tick } = setup([{ kind: 'saved', version: 1, clock: null }])
    saver.notifyChange({ answers: { a: '1' }, sectionIndex: 0 })
    tick(1000)
    saver.notifyChange({ answers: { a: '2' }, sectionIndex: 0 })
    tick(2400)
    expect(calls).toHaveLength(0)
    tick(200)
    await flushPromises()
    expect(calls).toEqual([{ answers: { a: '2' }, base: 0 }])
    await flushPromises()
    expect(saver.getBaseVersion()).toBe(1)
  })

  it('gõ liên tục vẫn lưu ít nhất 10 giây một lần', async () => {
    const { saver, calls, tick } = setup([{ kind: 'saved', version: 1, clock: null }])
    for (let i = 0; i < 12; i++) {
      saver.notifyChange({ answers: { t: String(i) }, sectionIndex: 0 })
      tick(1000)
    }
    expect(calls.length).toBeGreaterThanOrEqual(1)
    expect(calls[0].answers.t).toBe('9')
  })

  it('mất mạng: giữ chưa lưu, thử lại sau 10 giây, flush báo chưa lưu được', async () => {
    const { saver, calls, states, tick } = setup([new Error('offline'), { kind: 'error' }, { kind: 'saved', version: 4, clock: null }])
    saver.notifyChange({ answers: { a: '1' }, sectionIndex: 0 })
    tick(2500)
    await flushPromises()
    expect(states).toContain('retrying')
    expect(saver.isDirty()).toBe(true)
    expect(await saver.flush()).toBe(false)
    expect(calls).toHaveLength(2)
    expect(await saver.flush()).toBe(true)
    expect(calls).toHaveLength(3)
    expect(calls[2]).toEqual({ answers: { a: '1' }, base: 0 })
    expect(saver.getBaseVersion()).toBe(4)
    expect(states[states.length - 1]).toBe('saved')
  })

  it('flush chờ lần lưu đang bay rồi lưu nốt thay đổi mới — không có hai PATCH cùng lúc', async () => {
    const { saver, calls, resolvers, tick } = setup([])
    saver.notifyChange({ answers: { a: '1' }, sectionIndex: 0 })
    tick(2500)
    expect(calls).toHaveLength(1)
    saver.notifyChange({ answers: { a: '1', b: '2' }, sectionIndex: 0 })
    const done = saver.flush()
    expect(calls).toHaveLength(1)
    resolvers[0]({ kind: 'saved', version: 1, clock: null })
    await flushPromises()
    expect(calls).toHaveLength(2)
    expect(calls[1]).toEqual({ answers: { a: '1', b: '2' }, base: 1 })
    resolvers[1]({ kind: 'saved', version: 2, clock: null })
    expect(await done).toBe(true)
    expect(saver.isDirty()).toBe(false)
  })

  it('lệch phiên bản: báo người gọi, không tự lưu lại bản cũ', async () => {
    const { saver, calls, onConflict, tick } = setup([{ kind: 'conflict', serverVersion: 9, draft: null }])
    saver.notifyChange({ answers: { a: '1' }, sectionIndex: 0 })
    tick(2500)
    await flushPromises()
    expect(onConflict).toHaveBeenCalledWith({ serverVersion: 9, draft: null })
    tick(30_000)
    expect(calls).toHaveLength(1)
  })

  it('hết giờ (410) hoặc lượt đã đóng: báo một lần rồi ngừng hẳn', async () => {
    const a = setup([{ kind: 'expired' }])
    a.saver.notifyChange({ answers: { a: '1' }, sectionIndex: 0 })
    a.tick(2500)
    await flushPromises()
    expect(a.onExpired).toHaveBeenCalledTimes(1)
    a.saver.notifyChange({ answers: { a: '2' }, sectionIndex: 0 })
    a.tick(30_000)
    expect(a.calls).toHaveLength(1)

    const b = setup([{ kind: 'closed' }])
    b.saver.notifyChange({ answers: { a: '1' }, sectionIndex: 0 })
    b.tick(2500)
    await flushPromises()
    expect(b.onClosed).toHaveBeenCalledTimes(1)
  })

  it('dispose (đã nộp): thay đổi sau đó không lưu nữa', () => {
    const { saver, calls, tick } = setup([])
    saver.notifyChange({ answers: { a: '1' }, sectionIndex: 0 })
    saver.dispose()
    tick(30_000)
    expect(calls).toHaveLength(0)
  })
})

describe('chặng thi telc', () => {
  const raw = ['LESEN', 'SPRACHBAUSTEINE', 'HOEREN', 'SCHREIBEN', 'SPRECHEN']

  it('đọc thứ tự phần trong đề', () => {
    expect(rawSectionNames(JSON.stringify({ sections: [{ name: 'LESEN' }, { name: 'HOEREN' }] }))).toEqual(['LESEN', 'HOEREN'])
    expect(rawSectionNames('{hỏng')).toEqual([])
    expect(rawSectionNames(null)).toEqual([])
  })

  it('các chặng có trong đề và chặng kế tiếp', () => {
    expect(stagesIn(['LESEN', 'SPRACHBAUSTEINE', 'HOEREN', 'SCHREIBEN'])).toEqual([0, 1, 2])
    expect(stagesIn(['LESEN', 'SCHREIBEN'])).toEqual([0, 2])
    expect(nextStage([0, 1, 2], 0)).toBe(1)
    expect(nextStage([0, 2], 0)).toBe(2)
    expect(nextStage([0, 1, 2], 2)).toBeNull()
  })

  it('mở lại lượt dở: chặng theo phần server nhớ, không lùi về chặng đã khoá', () => {
    expect(resumeStage(raw, null, [0, 1, 2])).toBe(0)
    expect(resumeStage(raw, 1, [0, 1, 2])).toBe(0)
    expect(resumeStage(raw, 2, [0, 1, 2])).toBe(1)
    expect(resumeStage(raw, 3, [0, 1, 2])).toBe(2)
    // Hören app không dựng được ⇒ sang Schreiben, không về Lesen.
    expect(resumeStage(raw, 2, [0, 2])).toBe(2)
    expect(resumeStage(raw, 99, [0, 1, 2])).toBe(0)
    expect(resumeStage(raw, 0, [])).toBe(0)
  })

  it('sectionIndex gửi cùng nháp: giữ chỉ số server nếu cùng chặng, không thì phần đầu chặng', () => {
    expect(sectionIndexForStage(raw, 0, 1)).toBe(1)
    expect(sectionIndexForStage(raw, 0, null)).toBe(0)
    expect(sectionIndexForStage(raw, 1, 1)).toBe(2)
    expect(sectionIndexForStage(raw, 2, 0)).toBe(3)
    expect(sectionIndexForStage(raw, 0, 4)).toBe(0)
  })

  it('nhãn chip Teil và số câu chưa làm', () => {
    expect(teilChipLabel('LESEN', 3, 7, 10)).toBe('L3 · 7/10')
    expect(teilChipLabel('SPRACHBAUSTEINE', 1, 0, 10)).toBe('SB1 · 0/10')
    expect(teilChipLabel('SCHREIBEN', 1, 1, 1)).toBe('Schreiben · đã viết')
    expect(unansweredCount(['a', 'b', 'c'], { a: 'x', b: '  ' })).toBe(2)
  })
})

describe('chuyển trạng thái lượt từ /start', () => {
  it('bóc nháp, phiên bản, phần đang làm, đồng hồ, lượt trước bị chốt', () => {
    const s = attemptStartFrom(
      {
        id: 5,
        server_now: '2026-11-19T10:00:00Z',
        deadline_at: '2026-11-19T12:30:00Z',
        remaining_seconds: 9000,
        draft: { answers_json: '{"LV1-1":"c"}', section_index: 2, version: 6 },
        closed_attempt_id: 4,
      },
      T0,
    )
    expect(s.answers).toEqual({ 'LV1-1': 'c' })
    expect(s.version).toBe(6)
    expect(s.sectionIndex).toBe(2)
    expect(s.closedPrevious).toBe(true)
    expect(secondsLeft(s.clock, T0)).toBe(9000)
  })

  it('lượt mới chưa có nháp: phiên bản 0, không có phần nhớ', () => {
    const s = attemptStartFrom({ id: 5, server_now: '2026-11-19T10:00:00Z', deadline_at: '2026-11-19T12:30:00Z' }, T0)
    expect(s).toMatchObject({ answers: {}, version: 0, sectionIndex: null, closedPrevious: false })
  })

  it('chuyển đúng một lần', () => {
    rememberAttemptStart({ id: 11, remaining_seconds: 60 }, T0)
    expect(takeAttemptStart(11)).not.toBeNull()
    expect(takeAttemptStart(11)).toBeNull()
  })
})
