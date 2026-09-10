import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const apiGet = vi.hoisted(() => vi.fn())

vi.mock('@/lib/api', () => ({ default: { get: (...a: unknown[]) => apiGet(...a) } }))
vi.mock('next-intl', () => ({
  useLocale: () => 'vi',
  useTranslations: (ns: string) => {
    const t = (key: string, values?: Record<string, unknown>) =>
      values ? `${ns}.${key}:${JSON.stringify(values)}` : `${ns}.${key}`
    return t as unknown as ReturnType<typeof import('next-intl').useTranslations>
  },
}))

import AdminAuditPage from '@/app/v2/admin/audit/page'

const row = (id: number, over: Record<string, unknown> = {}) => ({
  id,
  eventName: `admin.org.updated.${id}`,
  category: 'ORG',
  actorEmail: 'admin@deutschflow.de',
  actorRole: 'ADMIN',
  targetType: 'ORG',
  targetId: String(id),
  createdAt: '2026-09-09T10:00:00Z',
  orgId: 7,
  ...over,
})

beforeEach(() => {
  apiGet.mockReset()
})

/**
 * DEC-13 — admin nền tảng không thuộc trung tâm nào, nên trước khi `AuditLogDto` mang `orgId` màn
 * nhật ký toàn nền tảng không có cách nào cho biết một thao tác đã chạm dữ liệu của trung tâm nào:
 * mọi dòng admin trông như nhau. Cột "Trung tâm" là câu trả lời đó.
 */
describe('AdminAuditPage — cột trung tâm', () => {
  it('dòng có orgId hiện nhãn trung tâm, dòng không có hiện nhãn nền tảng', async () => {
    apiGet.mockResolvedValueOnce({
      data: { items: [row(1, { orgId: 7 }), row(2, { orgId: null })], total: 2, page: 0, size: 30 },
    })

    render(<AdminAuditPage />)

    // 🪤 Chờ trên tiêu đề cột là chờ hụt: tiêu đề đã có sẵn ngay ở trạng thái "đang tải", nên
    // waitFor trả về TRƯỚC khi dòng dữ liệu kịp render — ca này từng đỏ ngẫu nhiên vì thế.
    await waitFor(() =>
      expect(screen.getByText('v2.adminContent.audit.orgTag:{"id":"7"}')).toBeTruthy(),
    )
    expect(screen.getByText('v2.adminContent.audit.colOrg')).toBeTruthy()
    expect(screen.getByText('v2.adminContent.audit.orgNone')).toBeTruthy()
  })

  /**
   * 🪤 `orgId` là mã, KHÔNG phải số lượng. Truyền dạng number thì next-intl nhóm hàng nghìn theo
   * locale và trung tâm 1234 hiện thành "1.234" ở de — đọc ra một mã khác.
   */
  it('mã trung tâm truyền dạng chuỗi để không bị định dạng số theo locale', async () => {
    apiGet.mockResolvedValueOnce({
      data: { items: [row(1, { orgId: 1234 })], total: 1, page: 0, size: 30 },
    })

    render(<AdminAuditPage />)

    await waitFor(() =>
      expect(screen.getByText('v2.adminContent.audit.orgTag:{"id":"1234"}')).toBeTruthy(),
    )
  })
})
