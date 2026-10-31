import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { AUSBILDUNG_COPY } from '@/content/ausbildung'
import {
  AUSBILDUNG_COMPANIES,
  AUSBILDUNG_OCCUPATIONS,
  ausbildungDeUrl,
  ausbildungOccupation,
  jobsucheUrl,
} from '@/lib/ausbildung'
import { AUSBILDUNG_CONTENT_REVIEWED, ausbildungVisible, withDraftPreview } from '@/lib/ausbildungGate'
import { publicAlternates, publicHref, slugPageFor } from '@/lib/publicLocale'

const FORBIDDEN = [/chắc chắn/i, /cam kết/i, /tỷ lệ đậu/i, /guaranteed/i, /tư vấn visa/i]

describe('ausbildung — cổng nội dung', () => {
  // Viết theo cờ, không chốt giá trị: đổi cờ sau khi duyệt không được làm đỏ test.
  it('chưa duyệt thì chỉ xem được bằng ?ban-nhap=1, duyệt rồi thì ai cũng xem được', () => {
    expect(ausbildungVisible(undefined)).toBe(AUSBILDUNG_CONTENT_REVIEWED)
    expect(ausbildungVisible('0')).toBe(AUSBILDUNG_CONTENT_REVIEWED)
    expect(ausbildungVisible('1')).toBe(true)
    expect(ausbildungVisible(['1', '0'])).toBe(true)
  })

  it('link nội bộ giữ chế độ xem trước cho tới khi duyệt', () => {
    const href = '/phong-van/koch/'
    expect(withDraftPreview(href)).toBe(AUSBILDUNG_CONTENT_REVIEWED ? href : `${href}?ban-nhap=1`)
  })

  it('header có mặt trên mọi trang công khai không kéo dữ liệu học nghề vào bundle', () => {
    const header = readFileSync(resolve(__dirname, '../components/landing-v2/LandingHeader.tsx'), 'utf8')
    expect(header).toContain('@/lib/ausbildungGate')
    expect(header).not.toMatch(/from '@\/lib\/ausbildung'/)
  })
})

describe('ausbildung — URL theo ngôn ngữ', () => {
  it('vi và en có slug riêng, chưa có bản tiếng Đức', () => {
    expect(publicHref('vi', '/hoc-nghe')).toBe('/hoc-nghe/')
    expect(publicHref('en', '/hoc-nghe')).toBe('/en/vocational-training/')
    expect(publicHref('de', '/hoc-nghe')).toBeNull()
    expect(slugPageFor('en', '/vocational-training/')).toBe('/hoc-nghe')
    expect(publicAlternates('/hoc-nghe')).not.toHaveProperty('de')
  })
})

describe('ausbildung — dữ liệu nghề', () => {
  const migration = readFileSync(
    resolve(__dirname, '../../../backend/src/main/resources/db/migration/V334__occupation_catalog.sql'),
    'utf8',
  )

  it('mọi mã nghề có thật trong danh mục V334', () => {
    const missing = AUSBILDUNG_OCCUPATIONS.filter((o) => !migration.includes(`('${o.code}',`))
    expect(missing).toEqual([])
  })

  it('không trùng mã, số năm và mức tiếng hợp lệ', () => {
    const codes = AUSBILDUNG_OCCUPATIONS.map((o) => o.code)
    expect(new Set(codes).size).toBe(codes.length)
    for (const o of AUSBILDUNG_OCCUPATIONS) {
      expect([2, 3, 3.5]).toContain(o.years)
      expect(['B1', 'B2']).toContain(o.level)
      expect(o.searchDe.trim()).not.toBe('')
    }
  })

  it('tra được nghề có học nghề, trả null với nghề không có', () => {
    expect(ausbildungOccupation('koch')?.years).toBe(3)
    expect(ausbildungOccupation('arzt')).toBeNull()
  })

  it('link tìm kiếm mã hoá từ khoá và lọc đúng loại Ausbildung', () => {
    expect(jobsucheUrl('Bäcker')).toBe('https://www.arbeitsagentur.de/jobsuche/suche?angebotsart=4&was=B%C3%A4cker')
    expect(ausbildungDeUrl('Fachkraft für Lagerlogistik')).toContain('search=Fachkraft%20f%C3%BCr%20Lagerlogistik')
  })
})

describe('ausbildung — danh bạ doanh nghiệp', () => {
  it('link https trên website doanh nghiệp, không trùng, không qua cổng trung gian', () => {
    const urls = AUSBILDUNG_COMPANIES.map((c) => c.url)
    expect(new Set(urls).size).toBe(urls.length)
    expect(new Set(AUSBILDUNG_COMPANIES.map((c) => c.name)).size).toBe(urls.length)
    for (const url of urls) {
      expect(url).toMatch(/^https:\/\//)
      expect(url).not.toMatch(/ausbildung\.de|stepstone|indeed|arbeitsagentur/)
    }
  })

  it('mọi nhóm ngành trong danh bạ đều có nhãn ở cả hai ngôn ngữ', () => {
    for (const c of AUSBILDUNG_COMPANIES) {
      expect(AUSBILDUNG_COPY.vi.companies.groups[c.workplace]).toBeTruthy()
      expect(AUSBILDUNG_COPY.en.companies.groups[c.workplace]).toBeTruthy()
    }
  })

  it('nói rõ không phải đối tác và chưa xác nhận nhận người ở nước ngoài', () => {
    expect(AUSBILDUNG_COPY.vi.companies.note).toMatch(/không phải đối tác/)
    expect(AUSBILDUNG_COPY.en.companies.note).toMatch(/not our partners/)
  })
})

describe('ausbildung — nội dung', () => {
  it('hai ngôn ngữ có cùng các bước, id không trùng', () => {
    const vi = AUSBILDUNG_COPY.vi.steps.items.map((s) => s.id)
    const en = AUSBILDUNG_COPY.en.steps.items.map((s) => s.id)
    expect(en).toEqual(vi)
    expect(new Set(vi).size).toBe(vi.length)
  })

  it('số liệu chính khớp nguồn ở cả hai ngôn ngữ', () => {
    expect(JSON.stringify(AUSBILDUNG_COPY.vi)).toContain('1.048 €')
    expect(JSON.stringify(AUSBILDUNG_COPY.en)).toContain('€1,048')
  })

  it('sổ lời hứa: có câu miễn trừ, không dùng lời cấm', () => {
    for (const copy of Object.values(AUSBILDUNG_COPY)) {
      expect(copy.disclaimer.length).toBeGreaterThan(0)
      const { disclaimer: _disclaimer, ...rest } = copy
      for (const pattern of FORBIDDEN) expect(JSON.stringify(rest)).not.toMatch(pattern)
      // Mức chi trả bảo hiểm được nói "không giới hạn"; lời chào hàng thì không.
      expect(JSON.stringify([copy.meta, copy.hero, copy.practice])).not.toMatch(/không giới hạn|unlimited/i)
    }
  })
})
