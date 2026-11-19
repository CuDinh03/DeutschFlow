import { selectedPlanId } from '@/lib/paywallSelection'

const ids = ['pro_monthly', 'pro_2m', 'ultra_2m']
const featured = (id: string) => id === 'pro_2m'

describe('selectedPlanId', () => {
  test('chưa chạm gói nào ⇒ gói chính', () => {
    expect(selectedPlanId(ids, null, featured)).toBe('pro_2m')
  })

  test('đã chạm gói còn trong danh sách ⇒ giữ gói đó', () => {
    expect(selectedPlanId(ids, 'ultra_2m', featured)).toBe('ultra_2m')
  })

  test('gói đã chạm không còn (StoreKit trả danh sách khác) ⇒ quay về gói chính', () => {
    expect(selectedPlanId(ids, 'gone', featured)).toBe('pro_2m')
  })

  test('không có gói nổi bật ⇒ gói đầu; danh sách rỗng ⇒ null', () => {
    expect(selectedPlanId(ids, null, () => false)).toBe('pro_monthly')
    expect(selectedPlanId([], 'pro_2m', featured)).toBeNull()
  })
})
