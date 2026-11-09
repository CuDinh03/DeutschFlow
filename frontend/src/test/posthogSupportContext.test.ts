/**
 * Review #805: PostHog khởi động lúc tab rảnh — trên trang /v2/support-session đó thường là lúc đang chờ
 * đổi mã, khi isSupportMode() còn false. Trang này phải được coi là ngữ cảnh hỗ trợ ngay từ đầu.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { loadPostHog, withPostHog } from '@/lib/posthogClient'

describe('posthogClient — ngữ cảnh phiên hỗ trợ', () => {
  afterEach(() => window.history.replaceState(null, '', '/'))

  it('trên /v2/support-session: không init PostHog, không xếp hàng tác vụ', async () => {
    window.history.replaceState(null, '', '/v2/support-session/')
    const init = vi.fn()
    await expect(loadPostHog(init)).resolves.toBeNull()
    expect(init).not.toHaveBeenCalled()
    const task = vi.fn()
    withPostHog(task)
    expect(task).not.toHaveBeenCalled()
  })
})
