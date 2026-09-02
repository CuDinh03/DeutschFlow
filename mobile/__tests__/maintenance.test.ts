import {
  isMaintenanceError,
  isMaintenanceBody,
  maintenanceInfoFromProblem,
  probeSystemStatus,
} from '@/lib/maintenance'

// Nhận diện + probe bảo trì (thiết kế §8, tầng C mobile). Probe là NGUỒN SỰ THẬT:
// phải hiểu cả 200 status=MAINTENANCE (app sống) lẫn 503 problem+json (nginx khi app
// chết), và KHÔNG coi mất-mạng-phía-user là bảo trì.

function fetchResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (k: string) => headers[k.toLowerCase()] ?? null },
    json: async () => body,
  }
}

const originalFetch = global.fetch
afterEach(() => {
  global.fetch = originalFetch
})

describe('isMaintenanceError', () => {
  it('503 + extensions.code=MAINTENANCE → true', () => {
    expect(isMaintenanceError(503, { extensions: { code: 'MAINTENANCE' } })).toBe(true)
  })
  it('503 + header x-df-maintenance → true dù body rác', () => {
    expect(isMaintenanceError(503, 'gateway junk', { 'x-df-maintenance': '1' })).toBe(true)
  })
  it('503 thường (DB_UNAVAILABLE) / 500 / 429 → false', () => {
    expect(isMaintenanceError(503, { extensions: { code: 'DB_UNAVAILABLE' } })).toBe(false)
    expect(isMaintenanceError(500, { extensions: { code: 'MAINTENANCE' } })).toBe(false)
    expect(isMaintenanceError(429, { extensions: { code: 'MAINTENANCE' } })).toBe(false)
    expect(isMaintenanceError(undefined, null)).toBe(false)
  })
})

describe('maintenanceInfoFromProblem', () => {
  it('rút windowId/title/endsAtUtc, bỏ giá trị rác', () => {
    const info = maintenanceInfoFromProblem({
      extensions: { code: 'MAINTENANCE', windowId: 7, title: 'Nâng cấp', note: '', endsAtUtc: '2026-09-10T16:30:00Z' },
    })
    expect(info).toEqual({
      windowId: 7,
      title: 'Nâng cấp',
      note: undefined,
      startsAtUtc: undefined,
      endsAtUtc: '2026-09-10T16:30:00Z',
    })
    expect(isMaintenanceBody(null)).toBe(false)
  })
})

describe('probeSystemStatus', () => {
  it('200 status=OK → kind ok (kèm upcoming)', async () => {
    global.fetch = jest.fn(async () =>
      fetchResponse(200, {
        status: 'OK',
        serverTimeUtc: '2026-09-03T10:00:00Z',
        active: null,
        upcoming: { id: 9, title: 'Bảo trì tối', mode: 'FULL', startsAtUtc: '2026-09-10T16:00:00Z', endsAtUtc: null },
      }),
    ) as unknown as typeof fetch
    const r = await probeSystemStatus()
    expect(r.kind).toBe('ok')
    if (r.kind === 'ok') expect(r.payload.upcoming?.id).toBe(9)
  })

  it('200 status=MAINTENANCE → kind maintenance với info + serverTime', async () => {
    global.fetch = jest.fn(async () =>
      fetchResponse(200, {
        status: 'MAINTENANCE',
        serverTimeUtc: '2026-09-10T16:05:00Z',
        active: { id: 12, title: 'Nâng cấp CSDL', note: 'Dự kiến 30 phút.', mode: 'FULL', startsAtUtc: '2026-09-10T16:00:00Z', endsAtUtc: '2026-09-10T16:30:00Z' },
        upcoming: null,
      }),
    ) as unknown as typeof fetch
    const r = await probeSystemStatus()
    expect(r.kind).toBe('maintenance')
    if (r.kind === 'maintenance') {
      expect(r.info.windowId).toBe(12)
      expect(r.info.endsAtUtc).toBe('2026-09-10T16:30:00Z')
      expect(r.info.serverTimeUtc).toBe('2026-09-10T16:05:00Z')
    }
  })

  it('503 nginx (app chết): header hoặc body đều ra maintenance', async () => {
    global.fetch = jest.fn(async () =>
      fetchResponse(503, { extensions: { code: 'MAINTENANCE' } }, { 'x-df-maintenance': '1' }),
    ) as unknown as typeof fetch
    expect((await probeSystemStatus()).kind).toBe('maintenance')
  })

  it('mạng chết phía user / 502 lạ → unknown (KHÔNG phải bảo trì)', async () => {
    global.fetch = jest.fn(async () => {
      throw new TypeError('Network request failed')
    }) as unknown as typeof fetch
    expect((await probeSystemStatus()).kind).toBe('unknown')

    global.fetch = jest.fn(async () => fetchResponse(502, 'Bad Gateway')) as unknown as typeof fetch
    expect((await probeSystemStatus()).kind).toBe('unknown')
  })

  it('single-flight: nhiều caller cùng lúc chỉ MỘT request', async () => {
    const spy = jest.fn(async () =>
      fetchResponse(200, { status: 'OK', serverTimeUtc: '2026-09-03T10:00:00Z', active: null, upcoming: null }),
    )
    global.fetch = spy as unknown as typeof fetch
    await Promise.all([probeSystemStatus(), probeSystemStatus(), probeSystemStatus()])
    expect(spy).toHaveBeenCalledTimes(1)
  })
})
