// V-06: gói do TRUNG TÂM cấp thì học viên không mua gì ở Apple. App từng mời họ "Quản lý & huỷ gói"
// và "Yêu cầu hoàn tiền" cho một gói trung tâm đã trả tiền — hoặc dẫn vào ngõ cụt (Apple không có
// đăng ký nào của họ), hoặc tệ hơn là huỷ mất quyền lợi không phải của mình.
//
// Khoá đúng hai quyết định thuần logic đứng sau cụm nút đó, còn phần JSX thì kho này không có
// harness render (jest chạy testEnvironment node, react-native bị mock rỗng).

jest.mock('@/lib/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}))

import { isOrgPlan, orgPlanNotice, type MyPlan } from '@/stores/usePlanStore'

const plan = (over: Partial<MyPlan>): MyPlan => ({ planCode: 'PRO', tier: 'PRO', ...over })

describe('isOrgPlan — ai trả tiền cho gói này', () => {
  test('source = ORG → gói của trung tâm, phải giấu huỷ/hoàn tiền', () => {
    expect(isOrgPlan(plan({ source: 'ORG' }))).toBe(true)
  })

  test.each(['APPLE', 'WEB'] as const)('source = %s → gói của chính học viên, giữ nguyên các nút', (source) => {
    expect(isOrgPlan(plan({ source }))).toBe(false)
  })

  // Fail-safe: backend chưa deploy / phản hồi cũ không có trường source. Khi đó KHÔNG được đoán là
  // ORG — đoán sai theo hướng đó là khoá mất đường huỷ gói của người thật sự tự bỏ tiền mua.
  test('thiếu trường source hoặc chưa có plan → false (giữ hành vi cũ)', () => {
    expect(isOrgPlan(plan({}))).toBe(false)
    expect(isOrgPlan(null)).toBe(false)
    expect(isOrgPlan(undefined)).toBe(false)
  })
})

describe('orgPlanNotice — dòng thay cho cụm nút', () => {
  test('nêu đích danh trung tâm cấp gói', () => {
    expect(orgPlanNotice(plan({ source: 'ORG', orgName: 'Trung tâm Đức Ngữ ABC' })))
      .toBe('Gói học do Trung tâm Đức Ngữ ABC cấp')
  })

  test('thiếu/rỗng tên trung tâm vẫn ra câu đọc được, không "undefined"', () => {
    expect(orgPlanNotice(plan({ source: 'ORG', orgName: null }))).toBe('Gói học do trung tâm của bạn cấp')
    expect(orgPlanNotice(plan({ source: 'ORG', orgName: '   ' }))).toBe('Gói học do trung tâm của bạn cấp')
  })
})
