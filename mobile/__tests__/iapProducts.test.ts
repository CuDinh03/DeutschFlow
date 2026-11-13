import {
  APPLE_PRODUCT_IDS,
  APPLE_PRODUCT_META,
  collectJwsTokens,
  extractJws,
  metaForProductId,
  periodLabel,
  planDisplayName,
  sortByCatalogOrder,
} from '@/lib/iapProducts'

describe('iapProducts catalog', () => {
  it('has metadata for every catalog id, and every meta id is in the catalog', () => {
    for (const id of APPLE_PRODUCT_IDS) {
      expect(APPLE_PRODUCT_META[id]).toBeDefined()
      expect(APPLE_PRODUCT_META[id].productId).toBe(id)
    }
    expect(Object.keys(APPLE_PRODUCT_META).sort()).toEqual([...APPLE_PRODUCT_IDS].sort())
  })

  it('bán đúng bộ gói owner chốt 14/11/2026: Pro tháng, Pro 2 tháng (gói chính, ở giữa), Tăng tốc 2 tháng', () => {
    expect([...APPLE_PRODUCT_IDS]).toEqual([
      'com.cudinh.mydeutschflow.pro.monthly',
      'com.cudinh.mydeutschflow.pro.twomonths',
      'com.cudinh.mydeutschflow.boost.twomonths',
    ])
    expect(metaForProductId('com.cudinh.mydeutschflow.pro.monthly')).toMatchObject({ planCode: 'PRO', durationMonths: 1 })
    expect(metaForProductId('com.cudinh.mydeutschflow.pro.twomonths')).toMatchObject({
      planCode: 'PRO',
      durationMonths: 2,
      badge: 'Gói chính',
    })
    expect(metaForProductId('com.cudinh.mydeutschflow.boost.twomonths')).toMatchObject({
      planCode: 'ULTRA',
      durationMonths: 2,
      label: 'Tăng tốc 2 tháng',
    })
    // Chỉ một gói mang nhãn — gói chính.
    expect(APPLE_PRODUCT_IDS.filter((id) => APPLE_PRODUCT_META[id].badge)).toEqual(['com.cudinh.mydeutschflow.pro.twomonths'])
  })

  it('ID cũ com.deutschflow.app.* đã ngừng bán — paywall không còn tải', () => {
    expect(metaForProductId('com.deutschflow.app.pro.monthly')).toBeNull()
    expect(metaForProductId('com.deutschflow.app.ultra.yearly')).toBeNull()
  })

  it('không ghi số tiền (giá lấy từ StoreKit), không ghi số token (owner 14/11/2026), không hứa "không giới hạn"', () => {
    for (const id of APPLE_PRODUCT_IDS) {
      const { note = '', label } = APPLE_PRODUCT_META[id]
      expect(`${label} ${note}`).not.toMatch(/₫|VND|\d\s*đồng|token|không giới hạn|phổ biến nhất/i)
    }
  })

  it('returns null metadata for an unknown product id', () => {
    expect(metaForProductId('com.deutschflow.app.bogus')).toBeNull()
  })
})

describe('periodLabel / planDisplayName', () => {
  it('nhãn kỳ: 1 → /tháng, 2 → /2 tháng, 12 → /năm, thiếu → rỗng', () => {
    expect(periodLabel(1)).toBe('/tháng')
    expect(periodLabel(2)).toBe('/2 tháng')
    expect(periodLabel(12)).toBe('/năm')
    expect(periodLabel(undefined)).toBe('')
    expect(periodLabel(0)).toBe('')
  })

  it('ULTRA hiển thị là Tăng tốc, PRO là Pro, chưa trả phí là Miễn phí', () => {
    expect(planDisplayName('ULTRA')).toBe('Tăng tốc')
    expect(planDisplayName('PRO')).toBe('Pro')
    expect(planDisplayName('FREE')).toBe('Miễn phí')
    expect(planDisplayName(undefined)).toBe('Miễn phí')
  })
})

describe('extractJws', () => {
  it('returns the token when present and non-empty', () => {
    expect(extractJws({ purchaseToken: 'signed.jws.payload' })).toBe('signed.jws.payload')
  })

  it('returns null for missing, empty, or nullish tokens', () => {
    expect(extractJws({ purchaseToken: '' })).toBeNull()
    expect(extractJws({ purchaseToken: null })).toBeNull()
    expect(extractJws({})).toBeNull()
    expect(extractJws(null)).toBeNull()
    expect(extractJws(undefined)).toBeNull()
  })
})

describe('collectJwsTokens', () => {
  it('collects tokens, drops blanks, and de-duplicates preserving order', () => {
    const purchases = [
      { purchaseToken: 'a' },
      { purchaseToken: '' },
      { purchaseToken: 'b' },
      { purchaseToken: 'a' }, // duplicate
      { purchaseToken: null },
    ]
    expect(collectJwsTokens(purchases)).toEqual(['a', 'b'])
  })

  it('returns an empty array for empty/nullish input', () => {
    expect(collectJwsTokens([])).toEqual([])
    expect(collectJwsTokens(null)).toEqual([])
    expect(collectJwsTokens(undefined)).toEqual([])
  })
})

describe('sortByCatalogOrder', () => {
  it('orders products by the catalog order regardless of input order', () => {
    const scrambled = [
      { id: 'com.cudinh.mydeutschflow.boost.twomonths' },
      { id: 'com.cudinh.mydeutschflow.pro.monthly' },
      { id: 'com.cudinh.mydeutschflow.pro.twomonths' },
    ]
    expect(sortByCatalogOrder(scrambled).map((p) => p.id)).toEqual([...APPLE_PRODUCT_IDS])
  })

  it('keeps unknown ids at the end without dropping them', () => {
    const withUnknown = [
      { id: 'com.cudinh.mydeutschflow.mystery' },
      { id: 'com.cudinh.mydeutschflow.pro.monthly' },
    ]
    expect(sortByCatalogOrder(withUnknown).map((p) => p.id)).toEqual([
      'com.cudinh.mydeutschflow.pro.monthly',
      'com.cudinh.mydeutschflow.mystery',
    ])
  })
})
