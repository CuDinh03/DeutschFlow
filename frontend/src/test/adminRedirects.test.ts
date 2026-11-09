/** Trang admin đã gộp: route cũ chuyển hướng tạm thời (307) tới trang đích — AC-ADMIN-19. */
import { describe, expect, it } from 'vitest'
import { ADMIN_MERGED_PAGES, adminMergeRedirects } from '../../admin-redirects.mjs'
import { legacyV1Redirects } from '../../legacy-redirects.mjs'

type Redirect = { source: string; destination: string; permanent?: boolean }

describe('Chuyển hướng trang admin đã gộp', () => {
  it('/v2/admin/tokens → tab Tổng quan của Chi phí AI', () => {
    const r = (adminMergeRedirects as Redirect[]).find((x) => x.source === '/v2/admin/tokens')
    expect(r?.destination).toBe('/v2/admin/ai-usage?tab=overview')
  })

  it('mọi entry đều 307 (permanent:false) — 308 bị trình duyệt cache vĩnh viễn', () => {
    expect((adminMergeRedirects as Redirect[]).length).toBe((ADMIN_MERGED_PAGES as unknown[]).length)
    for (const r of adminMergeRedirects as Redirect[]) expect(r.permanent).toBe(false)
  })

  it('redirect v1 cũ không trỏ vào trang đã gộp (tránh chuỗi hai bước)', () => {
    const merged = new Set((adminMergeRedirects as Redirect[]).map((r) => r.source))
    for (const r of legacyV1Redirects as Redirect[]) {
      expect(merged.has(r.destination.split('?')[0]), r.source).toBe(false)
    }
  })
})
