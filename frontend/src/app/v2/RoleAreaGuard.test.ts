import { describe, it, expect, beforeEach, vi } from 'vitest'
import { isAllowedInArea } from './RoleAreaGuard'
import { getKnownAuthRole } from '@/lib/authSession'

// jsdom trong repo này không dựng sẵn Web Storage (xem chatStreamError.test.ts) — stub tối thiểu.
function stubStorage(): Storage {
  const store = new Map<string, string>()
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size
    },
  } as Storage
}

function clearAuthState() {
  vi.stubGlobal('sessionStorage', stubStorage())
  vi.stubGlobal('localStorage', stubStorage())
  // jsdom giữ cookie giữa các test — xoá bằng cách hết hạn từng cái.
  for (const part of document.cookie.split(';')) {
    const name = part.split('=')[0]?.trim()
    if (name) document.cookie = `${name}=;path=/;max-age=0`
  }
}

describe('isAllowedInArea — phản chiếu cổng vai trò của middleware', () => {
  it('admin: chỉ ADMIN được vào', () => {
    expect(isAllowedInArea('admin', 'ADMIN', '', '/v2/admin/users/')).toBe(true)
    for (const role of ['STUDENT', 'TEACHER', 'MANAGER', 'OWNER']) {
      expect(isAllowedInArea('admin', role, '', '/v2/admin/users/')).toBe(false)
    }
  })

  it('teacher: chỉ TEACHER được vào', () => {
    expect(isAllowedInArea('teacher', 'TEACHER', '', '/v2/teacher/')).toBe(true)
    for (const role of ['STUDENT', 'ADMIN', 'MANAGER', 'OWNER']) {
      expect(isAllowedInArea('teacher', role, '', '/v2/teacher/')).toBe(false)
    }
  })

  it('org: OWNER/MANAGER hạng nhất, hoặc TEACHER legacy còn orgRole điều hành', () => {
    expect(isAllowedInArea('org', 'OWNER', '', '/v2/org/')).toBe(true)
    expect(isAllowedInArea('org', 'MANAGER', '', '/v2/org/')).toBe(true)
    expect(isAllowedInArea('org', 'TEACHER', 'OWNER', '/v2/org/')).toBe(true)
    expect(isAllowedInArea('org', 'TEACHER', 'MANAGER', '/v2/org/')).toBe(true)
    // 'ADMIN' là bí danh legacy của MANAGER trong claim orgRole (token trước V225).
    expect(isAllowedInArea('org', 'TEACHER', 'ADMIN', '/v2/org/')).toBe(true)
    expect(isAllowedInArea('org', 'TEACHER', '', '/v2/org/')).toBe(false)
    expect(isAllowedInArea('org', 'STUDENT', '', '/v2/org/')).toBe(false)
    // Vai trò nền tảng ADMIN cố tình KHÔNG có quyền org (khớp middleware).
    expect(isAllowedInArea('org', 'ADMIN', '', '/v2/org/')).toBe(false)
  })

  it('student: mặc định chỉ STUDENT', () => {
    expect(isAllowedInArea('student', 'STUDENT', '', '/v2/student/dashboard/')).toBe(true)
    expect(isAllowedInArea('student', 'TEACHER', '', '/v2/student/dashboard/')).toBe(false)
    expect(isAllowedInArea('student', 'ADMIN', '', '/v2/student/dashboard/')).toBe(false)
  })

  it('student: /v2/student/news là trang dùng chung — TEACHER/ADMIN vẫn vào được (V2_LEARNER_SHARED)', () => {
    // Cả hai dạng path: có và không có "/" cuối (trailingSlash: true).
    for (const path of ['/v2/student/news', '/v2/student/news/']) {
      expect(isAllowedInArea('student', 'STUDENT', '', path)).toBe(true)
      expect(isAllowedInArea('student', 'TEACHER', '', path)).toBe(true)
      expect(isAllowedInArea('student', 'ADMIN', '', path)).toBe(true)
      expect(isAllowedInArea('student', 'OWNER', '', path)).toBe(false)
    }
  })
})

describe('getKnownAuthRole — phân biệt "chưa biết" với "là học viên"', () => {
  beforeEach(clearAuthState)

  it('trả null khi không có cookie auth_role lẫn access token (người dùng quay lại, chờ khôi phục token)', () => {
    expect(getKnownAuthRole()).toBeNull()
  })

  it('đọc từ cookie auth_role khi có', () => {
    document.cookie = 'auth_role=ADMIN;path=/'
    expect(getKnownAuthRole()).toBe('ADMIN')
  })

  it('fallback sang claim role trong JWT ở sessionStorage khi thiếu cookie', () => {
    const payload = btoa(JSON.stringify({ role: 'TEACHER', sub: '2' }))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
    sessionStorage.setItem('accessToken', `x.${payload}.y`)
    expect(getKnownAuthRole()).toBe('TEACHER')
  })
})
