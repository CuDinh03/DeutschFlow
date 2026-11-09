import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import axios, { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios'

/**
 * 2FA ADMIN (09/11/2026): 401 `extensions.code=MFA_REQUIRED` nghĩa là phiên quản trị chưa qua 2FA (hoặc đã
 * quá hạn) — refresh không cứu được. lib/api.ts phải xoá token và về /v2/login?reason=mfa&next=…, KHÔNG
 * POST /auth/refresh (không vòng lặp refresh).
 */

const mocks = vi.hoisted(() => ({ clearTokens: vi.fn(), setTokens: vi.fn() }))
vi.mock('@/lib/authSession', () => ({
  getAccessToken: () => 'old-admin-token',
  getRefreshToken: () => null,
  setTokens: mocks.setTokens,
  recordTokenRefresh: vi.fn(),
  isNative: () => false,
  isSupportMode: () => false,
  markSupportSessionEnded: vi.fn(),
  getPlatform: () => 'web',
  clearTokens: mocks.clearTokens,
}))

import api, { isMfaRequired, problemCode } from '@/lib/api'

function rejectWith(status: number, data: unknown) {
  return async (config: InternalAxiosRequestConfig) => {
    const response = { status, statusText: '', headers: {}, config, data }
    throw new AxiosError('Request failed', 'ERR_BAD_REQUEST', config, {}, response as never)
  }
}

const originalLocation = window.location
let assign: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
  assign = vi.fn()
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...originalLocation, pathname: '/v2/admin/users', search: '?tab=audit', assign },
  })
})

afterEach(() => {
  Object.defineProperty(window, 'location', { configurable: true, value: originalLocation })
  vi.restoreAllMocks()
})

describe('lib/api — 401 MFA_REQUIRED', () => {
  it('nhận diện mã từ body problem+json', () => {
    const err = { isAxiosError: true, response: { status: 401, data: { extensions: { code: 'MFA_REQUIRED' } } } }
    expect(problemCode(err)).toBe('MFA_REQUIRED')
    expect(isMfaRequired(err)).toBe(true)
    expect(isMfaRequired({ isAxiosError: true, response: { status: 401, data: {} } })).toBe(false)
    expect(isMfaRequired({ isAxiosError: true, response: { status: 400, data: { extensions: { code: 'MFA_REQUIRED' } } } })).toBe(false)
  })

  it('xoá token, về /v2/login?reason=mfa&next=…, KHÔNG gọi refresh', async () => {
    const refreshSpy = vi.spyOn(axios, 'post')
    const problem = { status: 401, extensions: { code: 'MFA_REQUIRED' } }

    await expect(
      api.get('/admin/users', { adapter: rejectWith(401, problem), headers: new AxiosHeaders() }),
    ).rejects.toBeTruthy()

    expect(mocks.clearTokens).toHaveBeenCalled()
    expect(assign).toHaveBeenCalledWith(`/v2/login?reason=mfa&next=${encodeURIComponent('/v2/admin/users?tab=audit')}`)
    expect(refreshSpy).not.toHaveBeenCalled()
  })

  it('401 thường (không mã MFA) vẫn đi đường refresh như cũ', async () => {
    const refreshSpy = vi.spyOn(axios, 'post').mockRejectedValue(
      new AxiosError('no cookie', 'ERR_BAD_REQUEST', undefined, {}, { status: 400, data: {}, headers: {}, statusText: '', config: {} } as never),
    )

    await expect(
      api.get('/admin/users', { adapter: rejectWith(401, {}), headers: new AxiosHeaders() }),
    ).rejects.toBeTruthy()

    expect(refreshSpy).toHaveBeenCalledTimes(1)
    expect(assign).not.toHaveBeenCalled()
  })
})
