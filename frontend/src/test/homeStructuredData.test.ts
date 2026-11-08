/**
 * A1 (kế hoạch cải thiện trang chủ 08/11/2026): trang chủ khai Organization + SoftwareApplication
 * nối nhau bằng @id, link App Store và Facebook gốc, không có điểm/đánh giá bịa.
 */
import { describe, expect, it } from 'vitest'
import { FACEBOOK_URL, homeStructuredData, toJsonLd } from '@/lib/homeStructuredData'
import { APP_STORE_URL } from '@/components/landing-v2/links'

describe('homeStructuredData', () => {
  const data = homeStructuredData('en', 'Practise German job interviews', 'https://mydeutschflow.com/en/')
  const [org, app] = data['@graph'] as Array<Record<string, unknown>>

  it('Organization có logo, sameAs App Store + Facebook gốc (không phải link chia sẻ)', () => {
    expect(org['@type']).toBe('Organization')
    expect(org.sameAs).toEqual([APP_STORE_URL, FACEBOOK_URL])
    expect(FACEBOOK_URL).not.toContain('/share/')
    expect((org.logo as { url: string }).url).toMatch(/^https:\/\/.+\/icon-512\.png$/)
  })

  it('SoftwareApplication: iOS + Web, giá 0, trỏ về tổ chức, theo ngôn ngữ trang', () => {
    expect(app['@type']).toBe('SoftwareApplication')
    expect(app.applicationCategory).toBe('EducationalApplication')
    expect(app.operatingSystem).toBe('iOS, Web')
    expect(app.downloadUrl).toBe(APP_STORE_URL)
    expect(app.offers).toMatchObject({ '@type': 'Offer', price: 0 })
    expect(app.publisher).toEqual({ '@id': org['@id'] })
    expect(app.inLanguage).toBe('en')
    expect(app.url).toBe('https://mydeutschflow.com/en/')
  })

  it('không khai điểm hay đánh giá khi chưa có số thật', () => {
    expect(app).not.toHaveProperty('aggregateRating')
    expect(app).not.toHaveProperty('review')
  })

  it('toJsonLd thoát "<" để chuỗi không đóng nhầm thẻ script', () => {
    expect(toJsonLd({ a: '</script>' })).toBe('{"a":"\\u003c/script>"}')
  })
})
