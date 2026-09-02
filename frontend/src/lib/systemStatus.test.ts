import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  isMaintenanceError,
  isMaintenanceBody,
  maintenanceInfoFromProblem,
  probeSystemStatus,
} from './systemStatus'

// Probe là nguồn sự thật của trạng thái bảo trì phía client (thiết kế §3): phải hiểu
// CẢ HAI nhánh (200 status=MAINTENANCE từ app sống, 503 problem+json từ nginx khi app
// chết) và tuyệt đối KHÔNG coi mất-mạng-phía-user là bảo trì.

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (k: string) => headers[k.toLowerCase()] ?? null },
    json: async () => body,
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('isMaintenanceError — nhận diện tín hiệu trên response lỗi', () => {
  it('503 + extensions.code=MAINTENANCE → true', () => {
    expect(isMaintenanceError(503, { extensions: { code: 'MAINTENANCE' } })).toBe(true)
  })
  it('503 + header X-DF-Maintenance → true kể cả body rác', () => {
    expect(isMaintenanceError(503, 'gateway junk', { 'x-df-maintenance': '1' })).toBe(true)
  })
  it('503 thường (DB_UNAVAILABLE) → false; 500/429 → false dù body có code', () => {
    expect(isMaintenanceError(503, { extensions: { code: 'DB_UNAVAILABLE' } })).toBe(false)
    expect(isMaintenanceError(500, { extensions: { code: 'MAINTENANCE' } })).toBe(false)
    expect(isMaintenanceError(undefined, null)).toBe(false)
  })
})

describe('maintenanceInfoFromProblem', () => {
  it('rút đúng các trường từ extensions, bỏ qua giá trị rác', () => {
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

describe('probeSystemStatus — hai nhánh + mất mạng', () => {
  it('200 status=OK → kind ok (kèm upcoming cho banner)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      jsonResponse(200, {
        status: 'OK',
        serverTimeUtc: '2026-09-03T10:00:00Z',
        active: null,
        upcoming: { id: 9, title: 'Bảo trì tối', mode: 'FULL', startsAtUtc: '2026-09-10T16:00:00Z', endsAtUtc: null },
      }),
    ))
    const r = await probeSystemStatus()
    expect(r.kind).toBe('ok')
    if (r.kind === 'ok') expect(r.payload.upcoming?.id).toBe(9)
  })

  it('200 status=MAINTENANCE (tầng app chặn) → kind maintenance với info đầy đủ + serverTime', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      jsonResponse(200, {
        status: 'MAINTENANCE',
        serverTimeUtc: '2026-09-10T16:05:00Z',
        active: { id: 12, title: 'Nâng cấp CSDL', note: 'Dự kiến 30 phút.', mode: 'FULL', startsAtUtc: '2026-09-10T16:00:00Z', endsAtUtc: '2026-09-10T16:30:00Z' },
        upcoming: null,
      }),
    ))
    const r = await probeSystemStatus()
    expect(r.kind).toBe('maintenance')
    if (r.kind === 'maintenance') {
      expect(r.info.windowId).toBe(12)
      expect(r.info.endsAtUtc).toBe('2026-09-10T16:30:00Z')
      expect(r.info.serverTimeUtc).toBe('2026-09-10T16:05:00Z')
    }
  })

  it('503 từ nginx (app chết): JSON tĩnh hoặc chỉ header đều ra maintenance', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      jsonResponse(503, { extensions: { code: 'MAINTENANCE' } }, { 'x-df-maintenance': '1' }),
    ))
    expect((await probeSystemStatus()).kind).toBe('maintenance')

    // body không parse được — header cứu
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 503,
      headers: { get: (k: string) => (k.toLowerCase() === 'x-df-maintenance' ? '1' : null) },
      json: async () => {
        throw new Error('not json')
      },
    })))
    expect((await probeSystemStatus()).kind).toBe('maintenance')
  })

  it('mạng chết phía user / 502 lạ → unknown (KHÔNG phải bảo trì)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    }))
    expect((await probeSystemStatus()).kind).toBe('unknown')

    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(502, 'Bad Gateway')))
    expect((await probeSystemStatus()).kind).toBe('unknown')
  })

  it('single-flight: nhiều caller cùng lúc chỉ sinh MỘT request', async () => {
    const fetchSpy = vi.fn(async () =>
      jsonResponse(200, { status: 'OK', serverTimeUtc: '2026-09-03T10:00:00Z', active: null, upcoming: null }),
    )
    vi.stubGlobal('fetch', fetchSpy)
    await Promise.all([probeSystemStatus(), probeSystemStatus(), probeSystemStatus()])
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })
})
