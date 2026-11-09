import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  SUPPORT_SESSION_ENDED_EVENT,
  clearTokens,
  getAccessToken,
  getAuthRole,
  getKnownAuthRole,
  getOrgRole,
  getSupportSession,
  isSupportMode,
  logout,
  markSupportSessionEnded,
  setTokens,
  startSupportSession,
} from '@/lib/authSession'

/**
 * Chế độ phiên hỗ trợ chỉ-đọc (V370) của authSession: tab hỗ trợ và tab admin DÙNG CHUNG cookie. Ở chế độ hỗ trợ
 * getter đọc phiên hỗ trợ TRƯỚC, setTokens bị chặn, clearTokens chỉ bỏ token support và KHÔNG đụng cookie nào,
 * logout() gọi /api/support-session/end chứ không /auth/logout.
 */

function memoryStorage() {
  const store = new Map<string, string>()
  return {
    get length() {
      return store.size
    },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    getItem: (k: string) => (store.has(k) ? (store.get(k) as string) : null),
    setItem: (k: string, v: string) => {
      store.set(k, String(v))
    },
    removeItem: (k: string) => {
      store.delete(k)
    },
    clear: () => store.clear(),
  }
}

/** Ghi lại mọi lần gán document.cookie (jsdom không cho đọc lại cookie có max-age=0 dễ dàng). */
let cookieWrites: string[] = []
let cookieJar = ''

const INFO = {
  id: 77,
  expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
  role: 'TEACHER',
  orgRole: 'MANAGER',
  targetName: 'Gia Vien',
  targetEmail: 'gv@df.test',
}

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage())
  vi.stubGlobal('sessionStorage', memoryStorage())
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
  cookieWrites = []
  // Cookie phiên của tab admin (dùng chung trình duyệt).
  cookieJar = 'auth_access=admin.jwt; auth_role=ADMIN; auth_org_role=; auth_logged_in=1'
  Object.defineProperty(document, 'cookie', {
    configurable: true,
    get: () => cookieJar,
    set: (v: string) => {
      cookieWrites.push(v)
    },
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('authSession — chế độ phiên hỗ trợ', () => {
  it('ngoài chế độ hỗ trợ: getter đọc cookie/token như cũ', () => {
    sessionStorage.setItem('accessToken', 'admin.jwt')
    expect(isSupportMode()).toBe(false)
    expect(getAccessToken()).toBe('admin.jwt')
    expect(getKnownAuthRole()).toBe('ADMIN')
  })

  it('startSupportSession: bỏ access token kế thừa, getter trả token + vai trò của người dùng đích, đặt cookie auth_support SameSite=Strict', () => {
    sessionStorage.setItem('accessToken', 'admin.jwt')
    startSupportSession('support.jwt', INFO)

    expect(isSupportMode()).toBe(true)
    expect(sessionStorage.getItem('accessToken')).toBeNull()
    expect(getAccessToken()).toBe('support.jwt')
    // Cookie auth_role=ADMIN của tab admin bị bỏ qua.
    expect(getKnownAuthRole()).toBe('TEACHER')
    expect(getAuthRole()).toBe('TEACHER')
    expect(getOrgRole()).toBe('MANAGER')
    const support = cookieWrites.find((c) => c.startsWith('auth_support='))
    expect(support).toBeDefined()
    expect(support).toContain('SameSite=Strict')
    expect(support).toMatch(/max-age=(17\d\d|1800)/)
    expect(cookieWrites.some((c) => c.startsWith('auth_access=') || c.startsWith('auth_role='))).toBe(false)
  })

  it('setTokens bị chặn trong tab hỗ trợ', () => {
    startSupportSession('support.jwt', INFO)
    expect(() => setTokens({ accessToken: 'x.y.z', role: 'ADMIN' })).toThrow()
    expect(getAccessToken()).toBe('support.jwt')
  })

  it('clearTokens trong tab hỗ trợ: chỉ bỏ token support, KHÔNG đụng cookie nào, không rơi về token khác', () => {
    startSupportSession('support.jwt', INFO)
    localStorage.setItem('accessToken', 'legacy.admin.jwt')
    cookieWrites = []

    clearTokens()

    expect(cookieWrites).toEqual([])
    expect(getAccessToken()).toBeNull()
    expect(isSupportMode()).toBe(true)
    expect(getKnownAuthRole()).toBe('TEACHER')
  })

  it('markSupportSessionEnded: bỏ token + cookie auth_support (max-age=0), giữ thông tin phiên, phát sự kiện', () => {
    startSupportSession('support.jwt', INFO)
    cookieWrites = []
    const listener = vi.fn()
    window.addEventListener(SUPPORT_SESSION_ENDED_EVENT, listener)

    markSupportSessionEnded()
    markSupportSessionEnded()

    expect(getAccessToken()).toBeNull()
    expect(getSupportSession()?.ended).toBe(true)
    expect(cookieWrites).toHaveLength(2)
    expect(cookieWrites.every((c) => c.startsWith('auth_support=;') && c.includes('max-age=0'))).toBe(true)
    expect(listener).toHaveBeenCalledTimes(1)
    window.removeEventListener(SUPPORT_SESSION_ENDED_EVENT, listener)
  })

  it('logout() trong tab hỗ trợ: POST /api/support-session/end bằng token support, KHÔNG /auth/logout, không xoá cookie admin', async () => {
    vi.useFakeTimers()
    const close = vi.fn()
    vi.stubGlobal('close', close)
    startSupportSession('support.jwt', INFO)
    cookieWrites = []

    await logout()

    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toMatch(/\/api\/support-session\/end$/)
    expect(init).toMatchObject({ method: 'POST', headers: { Authorization: 'Bearer support.jwt' } })
    expect(String(url)).not.toContain('/auth/logout')
    expect(cookieWrites.every((c) => c.startsWith('auth_support='))).toBe(true)
    expect(close).toHaveBeenCalled()
    vi.useRealTimers()
  })
})
