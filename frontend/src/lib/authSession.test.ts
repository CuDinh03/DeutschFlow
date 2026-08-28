import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { logout, clearTokens } from '@/lib/authSession'
import { saveOnboardingDraft, readOnboardingDraft, type OnboardingDraft } from '@/lib/onboardingDraft'

const DRAFT: OnboardingDraft = {
  motivation: 'JOB',
  goalType: 'WORK',
  currentLevel: 'A1',
  targetLevel: 'B1',
  industry: 'IT',
  examType: 'GOETHE',
  weeklyTarget: 5,
}

/** localStorage/sessionStorage in-memory — jsdom ở repo này chỉ dựng một phần. */
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
    clear: () => {
      store.clear()
    },
  }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage())
  vi.stubGlobal('sessionStorage', memoryStorage())
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
  // Phải có access token thật: logout() chỉ gọi /auth/logout khi getAccessToken()
  // trả về giá trị. Storage rỗng thì cả hai ca dưới đi tắt qua nhánh không-fetch
  // và ca "hỏng mạng" hoá ra chỉ là bản sao của ca trước.
  sessionStorage.setItem('accessToken', 'test-token')
  // logout() điều hướng bằng window.location.href; jsdom không cài navigation
  // nên thay bằng một object trơ để test không phụ thuộc chuyện đó.
  vi.stubGlobal('location', { href: '' })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('logout', () => {
  it('xoá draft onboarding để tài khoản sau không bị ghi đè hồ sơ', async () => {
    saveOnboardingDraft(DRAFT)
    expect(readOnboardingDraft()).toEqual(DRAFT)

    await logout()

    // Không chỉ là "người sau nhìn thấy": effect resume ở /v2/onboarding sẽ POST
    // draft này đè lên hồ sơ học của tài khoản kế tiếp trên cùng máy.
    expect(readOnboardingDraft()).toBeNull()
    expect(localStorage.getItem('df_onboarding_draft')).toBeNull()
  })

  it('vẫn xoá draft khi gọi API logout hỏng mạng', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('offline'))
    saveOnboardingDraft(DRAFT)

    await logout()

    // Khẳng định đã THẬT SỰ đi qua nhánh mạng, nếu không ca này chỉ lặp lại ca trên.
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(readOnboardingDraft()).toBeNull()
  })
})

describe('clearTokens', () => {
  it('KHÔNG đụng draft — hai trang đăng nhập gọi nó ngay trước POST /auth/login', () => {
    // Nếu clearTokens xoá draft thì khách điền xong phễu rồi bấm "đã có tài
    // khoản → đăng nhập" sẽ mất sạch câu trả lời. Ca này khoá lại ranh giới đó.
    saveOnboardingDraft(DRAFT)

    clearTokens()

    expect(readOnboardingDraft()).toEqual(DRAFT)
  })
})
