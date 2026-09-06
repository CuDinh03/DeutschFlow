import { describe, expect, it } from 'vitest'
import { catalogMessages, catalogT } from '@/test/intlCatalog'

describe('intlCatalog — translator đọc catalog thật cho test', () => {
  it('resolve khoá base và v2 theo namespace, thiếu thì trả đường dẫn đầy đủ', () => {
    const tc = catalogT('v2.common')
    expect(tc('save')).toBe('Lưu')
    expect(tc.has('save')).toBe(true)
    expect(tc('khongCo')).toBe('v2.common.khongCo')
    expect(catalogT('v2.common', 'de')('save')).toBe('Speichern')
  })

  it('nội suy {name} và t.rich gọi hàm thẻ', () => {
    const t = catalogT('v2.notif')
    expect(t('hoursAgo', { n: 3 })).toBe('3 giờ trước')
    const rich = catalogT()
    expect(rich.rich('v2.notif.hoursAgo', { b: (c) => `[${String(c)}]` }, { n: 2 })).toBe('2 giờ trước')
  })

  it('gộp đủ mọi area như request.ts', () => {
    const v2 = catalogMessages('vi').v2 as Record<string, unknown>
    for (const area of ['student', 'teacher', 'org', 'adminOps', 'adminContent', 'account', 'auth', 'onboarding', 'landing', 'common', 'nav']) {
      expect(v2, `thiếu area ${area}`).toHaveProperty(area)
    }
  })
})
