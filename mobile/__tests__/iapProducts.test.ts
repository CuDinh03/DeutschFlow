import {
  APPLE_PRODUCT_IDS,
  APPLE_PRODUCT_META,
  collectJwsTokens,
  extractJws,
  metaForProductId,
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

  it('maps each product to the correct plan and duration', () => {
    expect(metaForProductId('com.deutschflow.app.pro.monthly')).toEqual({
      productId: 'com.deutschflow.app.pro.monthly',
      planCode: 'PRO',
      durationMonths: 1,
    })
    expect(metaForProductId('com.deutschflow.app.ultra.yearly')).toEqual({
      productId: 'com.deutschflow.app.ultra.yearly',
      planCode: 'ULTRA',
      durationMonths: 12,
    })
  })

  it('returns null metadata for an unknown product id', () => {
    expect(metaForProductId('com.deutschflow.app.bogus')).toBeNull()
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
      { id: 'com.deutschflow.app.ultra.yearly' },
      { id: 'com.deutschflow.app.pro.monthly' },
      { id: 'com.deutschflow.app.ultra.monthly' },
      { id: 'com.deutschflow.app.pro.yearly' },
    ]
    expect(sortByCatalogOrder(scrambled).map((p) => p.id)).toEqual([...APPLE_PRODUCT_IDS])
  })

  it('keeps unknown ids at the end without dropping them', () => {
    const withUnknown = [
      { id: 'com.deutschflow.app.mystery' },
      { id: 'com.deutschflow.app.pro.monthly' },
    ]
    expect(sortByCatalogOrder(withUnknown).map((p) => p.id)).toEqual([
      'com.deutschflow.app.pro.monthly',
      'com.deutschflow.app.mystery',
    ])
  })
})
