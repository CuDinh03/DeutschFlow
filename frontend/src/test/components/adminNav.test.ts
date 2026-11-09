/**
 * Menu admin 6 nhóm (đợt 1 "Nền móng + Người dùng", 09/11/2026 — AC-ADMIN-18).
 * Khoá cấu trúc + bắt thiếu bản dịch: sidebar rơi về nhãn tiếng Việt khi thiếu khoá, nên lỗi
 * này không tự lộ ra ở UI tiếng Anh/Đức.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import chromeVi from '../../../messages/v2/chrome.vi.json'
import chromeEn from '../../../messages/v2/chrome.en.json'
import chromeDe from '../../../messages/v2/chrome.de.json'

const ENV = 'NEXT_PUBLIC_POSTHOG_SHARED_DASHBOARD_URL'

async function loadNav(analyticsUrl = '') {
  vi.resetModules()
  vi.stubEnv(ENV, analyticsUrl)
  return (await import('@/components/ui-v2/nav')).adminNav
}

afterEach(() => vi.unstubAllEnvs())

describe('Menu admin — 6 nhóm có tiêu đề', () => {
  it('đúng thứ tự nhóm, mỗi nhóm có tiêu đề, cuối cùng là Tài khoản', async () => {
    const nav = await loadNav()
    expect(nav.sections.map((s) => s.labelKey)).toEqual([
      'adminInsights',
      'adminPeople',
      'adminB2b',
      'adminContent',
      'ops',
      'adminControl',
      'account',
    ])
  })

  it('trang đã gộp hoặc chỉ có vỏ không còn trên menu; Chi phí AI và Thư viện ảnh vẫn có', async () => {
    const hrefs = (await loadNav()).sections.flatMap((s) => s.items.map((i) => i.href))
    for (const gone of ['/v2/admin/tokens', '/v2/admin/settings', '/v2/admin/plans']) {
      expect(hrefs).not.toContain(gone)
    }
    expect(hrefs).toContain('/v2/admin/ai-usage')
    expect(hrefs).toContain('/v2/admin/media')
  })

  it('mục Phân tích chỉ hiện khi đã đặt URL dashboard PostHog', async () => {
    const without = (await loadNav()).sections.flatMap((s) => s.items.map((i) => i.id))
    expect(without).not.toContain('admin-analytics')
    const withUrl = (await loadNav('https://us.posthog.com/shared/abc')).sections.flatMap((s) =>
      s.items.map((i) => i.id),
    )
    expect(withUrl).toContain('admin-analytics')
  })

  it.each([
    ['vi', chromeVi],
    ['en', chromeEn],
    ['de', chromeDe],
  ])('mọi tiêu đề nhóm và mọi mục admin có bản dịch %s', async (_loc, catalog) => {
    const nav = await loadNav('https://us.posthog.com/shared/abc')
    const c = catalog as unknown as { nav: { sections: Record<string, string>; items: Record<string, string> } }
    for (const s of nav.sections) expect(c.nav.sections[s.labelKey as string], s.labelKey).toBeTruthy()
    for (const id of nav.sections.flatMap((s) => s.items.map((i) => i.id))) {
      expect(c.nav.items[id], id).toBeTruthy()
    }
  })
})
