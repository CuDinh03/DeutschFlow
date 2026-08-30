import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  classifyDraftSaveError,
  createDraftAutosaver,
  parseDraftAnswers,
  resyncCountdown,
  type DraftSaveResult,
} from './examDraftSync'

const payload = (n: number) => ({ answers: { q1: `v${n}` }, sectionIndex: 0 })

describe('createDraftAutosaver', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('debounces: many rapid changes collapse into one save with the latest payload', async () => {
    const save = vi.fn(async (): Promise<DraftSaveResult> => ({ kind: 'saved', version: 1, remainingSeconds: 100 }))
    const saver = createDraftAutosaver({ save, debounceMs: 2000, maxIntervalMs: 10000 })

    saver.notifyChange(payload(1))
    vi.advanceTimersByTime(500)
    saver.notifyChange(payload(2))
    vi.advanceTimersByTime(500)
    saver.notifyChange(payload(3))
    expect(save).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(2000)
    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith(payload(3), 0)
  })

  it('adopts the returned version as the next baseVersion', async () => {
    const save = vi
      .fn<(p: unknown, v: number) => Promise<DraftSaveResult>>()
      .mockResolvedValueOnce({ kind: 'saved', version: 1, remainingSeconds: null })
      .mockResolvedValueOnce({ kind: 'saved', version: 2, remainingSeconds: null })
    const saver = createDraftAutosaver({ save, debounceMs: 1000 })

    saver.notifyChange(payload(1))
    await vi.advanceTimersByTimeAsync(1000)
    saver.notifyChange(payload(2))
    await vi.advanceTimersByTimeAsync(1000)

    expect(save).toHaveBeenNthCalledWith(1, payload(1), 0)
    expect(save).toHaveBeenNthCalledWith(2, payload(2), 1)
    expect(saver.getBaseVersion()).toBe(2)
  })

  it('caps the save interval while changes keep streaming in', async () => {
    const save = vi.fn(async (): Promise<DraftSaveResult> => ({ kind: 'saved', version: 1, remainingSeconds: null }))
    const saver = createDraftAutosaver({ save, debounceMs: 2000, maxIntervalMs: 6000 })

    // A change every second keeps resetting the 2s debounce — without the cap this would
    // never save. The cap forces a save once 6s have passed since the last one.
    for (let i = 0; i < 12; i++) {
      saver.notifyChange(payload(i))
      await vi.advanceTimersByTimeAsync(1000)
    }
    expect(save.mock.calls.length).toBeGreaterThanOrEqual(2)
  })

  it('a change arriving during an in-flight save triggers one follow-up save', async () => {
    let resolveSave: ((r: DraftSaveResult) => void) | null = null
    const save = vi.fn(
      (): Promise<DraftSaveResult> =>
        new Promise<DraftSaveResult>((res) => {
          resolveSave = res
        }),
    )
    const saver = createDraftAutosaver({ save, debounceMs: 1000 })

    saver.notifyChange(payload(1))
    await vi.advanceTimersByTimeAsync(1000)
    expect(save).toHaveBeenCalledTimes(1)

    saver.notifyChange(payload(2)) // arrives mid-flight
    resolveSave!({ kind: 'saved', version: 1, remainingSeconds: null })
    await vi.advanceTimersByTimeAsync(1000)

    expect(save).toHaveBeenCalledTimes(2)
    expect(save).toHaveBeenNthCalledWith(2, payload(2), 1)
  })

  it('conflict: reports to the owner, does not auto-retry the stale payload', async () => {
    const onConflict = vi.fn()
    const save = vi.fn(async (): Promise<DraftSaveResult> => ({ kind: 'conflict', serverVersion: 7, draft: null }))
    const saver = createDraftAutosaver({ save, onConflict, debounceMs: 1000 })

    saver.notifyChange(payload(1))
    await vi.advanceTimersByTimeAsync(1000)
    expect(onConflict).toHaveBeenCalledWith({ serverVersion: 7, draft: null })

    await vi.advanceTimersByTimeAsync(60_000)
    expect(save).toHaveBeenCalledTimes(1)

    // Owner reconciles then continues: next change saves against the adopted version.
    saver.adoptVersion(7)
    saver.notifyChange(payload(2))
    await vi.advanceTimersByTimeAsync(1000)
    expect(save).toHaveBeenNthCalledWith(2, payload(2), 7)
  })

  it('expired: notifies the owner and stops for good', async () => {
    const onExpired = vi.fn()
    const save = vi.fn(async (): Promise<DraftSaveResult> => ({ kind: 'expired' }))
    const saver = createDraftAutosaver({ save, onExpired, debounceMs: 1000 })

    saver.notifyChange(payload(1))
    await vi.advanceTimersByTimeAsync(1000)
    expect(onExpired).toHaveBeenCalledTimes(1)

    saver.notifyChange(payload(2))
    await vi.advanceTimersByTimeAsync(60_000)
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('transport error: keeps the draft dirty and retries', async () => {
    const save = vi
      .fn<() => Promise<DraftSaveResult>>()
      .mockResolvedValueOnce({ kind: 'error' })
      .mockResolvedValueOnce({ kind: 'saved', version: 1, remainingSeconds: null })
    const saver = createDraftAutosaver({ save, debounceMs: 1000, retryMs: 5000 })

    saver.notifyChange(payload(1))
    await vi.advanceTimersByTimeAsync(1000)
    expect(save).toHaveBeenCalledTimes(1)
    expect(saver.getSnapshot()).not.toBeNull() // still dirty

    await vi.advanceTimersByTimeAsync(5000)
    expect(save).toHaveBeenCalledTimes(2)
    expect(saver.getSnapshot()).toBeNull() // clean after the retry landed
  })

  it('getSnapshot exposes dirty state for the keepalive flush and null when clean', async () => {
    const save = vi.fn(async (): Promise<DraftSaveResult> => ({ kind: 'saved', version: 1, remainingSeconds: null }))
    const saver = createDraftAutosaver({ save, debounceMs: 1000 })

    expect(saver.getSnapshot()).toBeNull()
    saver.notifyChange(payload(1))
    expect(saver.getSnapshot()).toEqual({ payload: payload(1), baseVersion: 0 })

    await saver.flush()
    expect(saver.getSnapshot()).toBeNull()
  })

  it('dispose stops all scheduled work', async () => {
    const save = vi.fn(async (): Promise<DraftSaveResult> => ({ kind: 'saved', version: 1, remainingSeconds: null }))
    const saver = createDraftAutosaver({ save, debounceMs: 1000 })

    saver.notifyChange(payload(1))
    saver.dispose()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(save).not.toHaveBeenCalled()
  })
})

describe('classifyDraftSaveError', () => {
  it('410 → expired', () => {
    expect(classifyDraftSaveError(410, { error: 'ATTEMPT_EXPIRED' })).toEqual({ kind: 'expired' })
  })

  it('409 with server draft → conflict carrying the draft', () => {
    const result = classifyDraftSaveError(409, {
      error: 'DRAFT_VERSION_CONFLICT',
      server_version: 5,
      draft: { answers_json: '{"q1":"b"}', section_index: 2, question_index: 1, version: 5 },
    })
    expect(result).toEqual({
      kind: 'conflict',
      serverVersion: 5,
      draft: { answersJson: '{"q1":"b"}', sectionIndex: 2, questionIndex: 1, version: 5 },
    })
  })

  it('409 without draft body still classifies as conflict', () => {
    expect(classifyDraftSaveError(409, { error: 'ATTEMPT_NOT_IN_PROGRESS', server_version: 3 })).toEqual({
      kind: 'conflict',
      serverVersion: 3,
      draft: null,
    })
  })

  it('anything else → transient error', () => {
    expect(classifyDraftSaveError(500, null)).toEqual({ kind: 'error' })
    expect(classifyDraftSaveError(0, undefined)).toEqual({ kind: 'error' })
  })
})

describe('resyncCountdown', () => {
  it('keeps the local clock inside the tolerance window', () => {
    expect(resyncCountdown(100, 97)).toBe(100)
  })
  it('snaps to the server when drift is material (reload used to reset the timer)', () => {
    expect(resyncCountdown(3600, 1200)).toBe(1200)
  })
  it('ignores nonsense server values', () => {
    expect(resyncCountdown(100, Number.NaN)).toBe(100)
    expect(resyncCountdown(100, -5)).toBe(100)
  })
})

describe('parseDraftAnswers', () => {
  it('parses a valid answers object and drops non-string values', () => {
    expect(parseDraftAnswers('{"q1":"a","q2":2,"q3":"c"}')).toEqual({ q1: 'a', q3: 'c' })
  })
  it('returns {} for null, malformed JSON, arrays and primitives', () => {
    expect(parseDraftAnswers(null)).toEqual({})
    expect(parseDraftAnswers('not json')).toEqual({})
    expect(parseDraftAnswers('[1,2]')).toEqual({})
    expect(parseDraftAnswers('"str"')).toEqual({})
  })
})
