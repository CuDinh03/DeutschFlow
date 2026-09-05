import { canAutoStartHomeTour, canAutoStartSrsIntro, canAutoStartSpeakingIntro, probeStatus } from '../tourEligibility'

const ok = { status: 'success' as const }
const fresh = {
  hydrated: true,
  doneHome: false,
  tourBusy: false,
  dashboardLoading: false,
  xp: { ...ok, totalXp: 0 },
  roadmap: { ...ok, completedCount: 0 },
}

describe('canAutoStartHomeTour — chỉ tài khoản mới đăng ký', () => {
  test('tài khoản mới: 0 XP, 0 chặng, dò xong → tự nổ', () => {
    expect(canAutoStartHomeTour(fresh)).toBe(true)
  })

  test('tài khoản cũ có XP (đăng nhập lại / máy mới, cờ máy đã bị xoá) → KHÔNG nổ', () => {
    expect(canAutoStartHomeTour({ ...fresh, xp: { ...ok, totalXp: 1378 } })).toBe(false)
  })

  test('đã hoàn thành chặng dù XP 0 → không nổ', () => {
    expect(canAutoStartHomeTour({ ...fresh, roadmap: { ...ok, completedCount: 1 } })).toBe(false)
  })

  test('phép dò chưa về hoặc lỗi → không nổ (chưa biết thì thôi, cờ chưa đặt nên lần sau còn cơ hội)', () => {
    expect(canAutoStartHomeTour({ ...fresh, xp: { status: 'pending', totalXp: 0 } })).toBe(false)
    expect(canAutoStartHomeTour({ ...fresh, xp: { status: 'error', totalXp: 0 } })).toBe(false)
    expect(canAutoStartHomeTour({ ...fresh, roadmap: { status: 'pending', completedCount: 0 } })).toBe(false)
    expect(canAutoStartHomeTour({ ...fresh, roadmap: { status: 'error', completedCount: 0 } })).toBe(false)
  })

  test('đã xem trên máy này / tour khác đang chạy / dashboard đang tải / chưa hydrate → không nổ', () => {
    expect(canAutoStartHomeTour({ ...fresh, doneHome: true })).toBe(false)
    expect(canAutoStartHomeTour({ ...fresh, tourBusy: true })).toBe(false)
    expect(canAutoStartHomeTour({ ...fresh, dashboardLoading: true })).toBe(false)
    expect(canAutoStartHomeTour({ ...fresh, hydrated: false })).toBe(false)
  })

  test('đang kéo-làm-mới → chưa nổ (RefreshControl đè cuộn/đo neo); làm mới xong → nổ', () => {
    expect(canAutoStartHomeTour({ ...fresh, refreshing: true })).toBe(false)
    expect(canAutoStartHomeTour({ ...fresh, refreshing: false })).toBe(true)
  })
})

describe('canAutoStartSrsIntro — sau tour chính trên máy này, có thẻ đến hạn', () => {
  const base = { hydrated: true, doneHome: true, doneSrs: false, tourBusy: false, sheetOpen: false, dueCount: 5 }
  test('đủ điều kiện → nổ', () => {
    expect(canAutoStartSrsIntro(base)).toBe(true)
  })
  test('tour chính chưa xem trên máy này (tài khoản cũ không được tự nổ tour chính) → không', () => {
    expect(canAutoStartSrsIntro({ ...base, doneHome: false })).toBe(false)
  })
  test('đã xem / không có thẻ đến hạn / sheet nhắc đang mở / tour khác chạy → không', () => {
    expect(canAutoStartSrsIntro({ ...base, doneSrs: true })).toBe(false)
    expect(canAutoStartSrsIntro({ ...base, dueCount: 0 })).toBe(false)
    expect(canAutoStartSrsIntro({ ...base, sheetOpen: true })).toBe(false)
    expect(canAutoStartSrsIntro({ ...base, tourBusy: true })).toBe(false)
  })

  describe('có tín hiệu server reviewedCards (backend mới)', () => {
    test('chưa từng ôn thẻ nào (0) → nổ, kể cả tài khoản cũ chưa xem tour chính trên máy này', () => {
      expect(canAutoStartSrsIntro({ ...base, doneHome: false, reviewed: { status: 'success', count: 0 } })).toBe(true)
    })
    test('đã ôn ≥ 1 thẻ → không nổ dù tour chính đã xem', () => {
      expect(canAutoStartSrsIntro({ ...base, doneHome: true, reviewed: { status: 'success', count: 3 } })).toBe(false)
    })
    test('dò chưa về / lỗi → không nổ', () => {
      expect(canAutoStartSrsIntro({ ...base, reviewed: { status: 'pending', count: null } })).toBe(false)
      expect(canAutoStartSrsIntro({ ...base, reviewed: { status: 'error', count: null } })).toBe(false)
    })
    test('backend cũ không có trường (count null) → rơi về gate tour chính đã xem', () => {
      expect(canAutoStartSrsIntro({ ...base, doneHome: true, reviewed: { status: 'success', count: null } })).toBe(true)
      expect(canAutoStartSrsIntro({ ...base, doneHome: false, reviewed: { status: 'success', count: null } })).toBe(false)
    })
    test('đang kéo-làm-mới → chưa nổ dù chưa từng ôn; làm mới xong → nổ (F-SRS-COACH-01)', () => {
      const neverReviewed = { status: 'success' as const, count: 0 }
      expect(canAutoStartSrsIntro({ ...base, refreshing: true, reviewed: neverReviewed })).toBe(false)
      expect(canAutoStartSrsIntro({ ...base, refreshing: false, reviewed: neverReviewed })).toBe(true)
    })
    test('vẫn cần thẻ đến hạn và cờ máy chưa đặt', () => {
      expect(canAutoStartSrsIntro({ ...base, dueCount: 0, reviewed: { status: 'success', count: 0 } })).toBe(false)
      expect(canAutoStartSrsIntro({ ...base, doneSrs: true, reviewed: { status: 'success', count: 0 } })).toBe(false)
    })
  })
})

describe('canAutoStartSpeakingIntro — chỉ khi chưa từng có phiên nói', () => {
  const base = {
    hydrated: true,
    doneSpeaking: false,
    tourBusy: false,
    onSelectView: true,
    sessions: { ...ok, count: 0 },
  }
  test('0 phiên, đang ở màn chọn, cờ chưa đặt → nổ (kể cả tài khoản cũ chưa từng dùng Speaking)', () => {
    expect(canAutoStartSpeakingIntro(base)).toBe(true)
  })
  test('đã có phiên → không nổ', () => {
    expect(canAutoStartSpeakingIntro({ ...base, sessions: { ...ok, count: 1 } })).toBe(false)
  })
  test('dò chưa về / lỗi → không nổ', () => {
    expect(canAutoStartSpeakingIntro({ ...base, sessions: { status: 'pending', count: 0 } })).toBe(false)
    expect(canAutoStartSpeakingIntro({ ...base, sessions: { status: 'error', count: 0 } })).toBe(false)
  })
  test('không ở màn chọn / cờ đã đặt / tour khác chạy / chưa hydrate → không', () => {
    expect(canAutoStartSpeakingIntro({ ...base, onSelectView: false })).toBe(false)
    expect(canAutoStartSpeakingIntro({ ...base, doneSpeaking: true })).toBe(false)
    expect(canAutoStartSpeakingIntro({ ...base, tourBusy: true })).toBe(false)
    expect(canAutoStartSpeakingIntro({ ...base, hydrated: false })).toBe(false)
  })
})

describe('probeStatus', () => {
  test('success thắng error, còn lại là pending', () => {
    expect(probeStatus(true, false)).toBe('success')
    expect(probeStatus(false, true)).toBe('error')
    expect(probeStatus(false, false)).toBe('pending')
  })
})
