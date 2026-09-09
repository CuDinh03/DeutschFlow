import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const listOrgAuditLogs = vi.hoisted(() => vi.fn())
const getOrgRole = vi.hoisted(() => vi.fn<() => string>())
const routerReplace = vi.hoisted(() => vi.fn())

vi.mock('@/lib/orgApi', () => ({ listOrgAuditLogs: (...a: unknown[]) => listOrgAuditLogs(...a) }))
vi.mock('@/lib/authSession', () => ({ getOrgRole }))
vi.mock('@/lib/api', () => ({ apiMessage: (e: unknown) => (e instanceof Error ? e.message : 'Lỗi không xác định') }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: routerReplace, push: vi.fn() }) }))
vi.mock('next-intl', () => ({
  useLocale: () => 'vi',
  useTranslations: (ns: string) => {
    const t = (key: string, values?: Record<string, unknown>) =>
      values ? `${ns}.${key}:${JSON.stringify(values)}` : `${ns}.${key}`
    return t as unknown as ReturnType<typeof import('next-intl').useTranslations>
  },
}))

import V2OrgAuditPage from '@/app/v2/org/audit/page'
import { ORG_AUDIT_PAGE_SIZE } from '@/app/v2/org/audit/pagination'

const row = (id: number, over: Partial<Record<string, unknown>> = {}) => ({
  id,
  eventName: `ORG_MEMBER_REMOVED_${id}`,
  category: 'ORG_MEMBER',
  actorUserId: 7,
  actorEmail: 'giamdoc@tt.vn',
  actorRole: 'OWNER',
  targetType: 'ORG_MEMBER',
  targetId: String(100 + id),
  metadataJson: null,
  createdAt: '2026-09-08T10:00:00Z',
  orgId: 7,
  ...over,
})

const envelope = (items: ReturnType<typeof row>[], total: number, page = 0) => ({
  items, total, page, size: ORG_AUDIT_PAGE_SIZE,
})

beforeEach(() => {
  listOrgAuditLogs.mockReset()
  routerReplace.mockReset()
  getOrgRole.mockReset()
  getOrgRole.mockReturnValue('OWNER')
})

/**
 * V-03 — sổ hoạt động trung tâm (C6). Endpoint OWNER-only đã chạy production từ 08/09/2026 mà web
 * không có màn nào đọc; các ca dưới đây khoá lại hợp đồng của bề mặt đọc đó.
 */
describe('V2OrgAuditPage — sổ hoạt động trung tâm', () => {
  it('tải trang đầu, hiện cột thời gian · người thực hiện · hành động · đối tượng', async () => {
    listOrgAuditLogs.mockResolvedValueOnce(envelope([row(1), row(2)], 2))

    render(<V2OrgAuditPage />)

    await waitFor(() => expect(screen.getByText('ORG_MEMBER_REMOVED_1')).toBeTruthy())
    expect(listOrgAuditLogs).toHaveBeenCalledWith(0, ORG_AUDIT_PAGE_SIZE, { q: '', cat: undefined })
    expect(screen.getByText('v2.org.audit.colTime')).toBeTruthy()
    expect(screen.getByText('v2.org.audit.colActor')).toBeTruthy()
    expect(screen.getByText('v2.org.audit.colAction')).toBeTruthy()
    expect(screen.getByText('v2.org.audit.colTarget')).toBeTruthy()
    expect(screen.getAllByText('giamdoc@tt.vn').length).toBe(2)
    expect(screen.getByText('ORG_MEMBER · 102')).toBeTruthy()
  })

  /**
   * `metadata_json` là chỗ duy nhất ghi "đã đổi cái gì thành cái gì". Màn đầu tiên bỏ hẳn cột này,
   * nên một dòng `admin.org.updated` chỉ nói "có ai đó sửa trung tâm" mà không nói sửa thành gì.
   */
  it('hiện metadata theo cặp khoá–giá trị chứ không đổ JSON thô', async () => {
    listOrgAuditLogs.mockResolvedValueOnce(
      envelope(
        [row(1, { metadataJson: '{"fromStatus":"ACTIVE","toStatus":"SUSPENDED"}' })],
        1,
      ),
    )

    render(<V2OrgAuditPage />)

    await waitFor(() => expect(screen.getByText('v2.org.audit.colDetails')).toBeTruthy())
    expect(screen.getByText('From status')).toBeTruthy()
    expect(screen.getByText('ACTIVE')).toBeTruthy()
    expect(screen.getByText('To status')).toBeTruthy()
    expect(screen.getByText('SUSPENDED')).toBeTruthy()
    // Nguyên văn JSON không được lọt ra bảng.
    expect(screen.queryByText(/\{"fromStatus"/)).toBeNull()
  })

  /**
   * DEC-13 — lý do tồn tại của cả đợt: admin nền tảng KHÔNG thuộc trung tâm, vết của họ vẫn vào sổ
   * này. Nếu dòng đó trông y hệt dòng của nhân sự nội bộ thì giám đốc không có cách nào biết người
   * ngoài đã động vào dữ liệu của mình.
   */
  it('dòng của ADMIN nền tảng mang huy hiệu người ngoài trung tâm', async () => {
    listOrgAuditLogs.mockResolvedValueOnce(
      envelope(
        [
          row(1, { actorRole: 'ADMIN', actorEmail: 'admin@deutschflow.de' }),
          row(2, { actorRole: 'OWNER' }),
        ],
        2,
      ),
    )

    render(<V2OrgAuditPage />)

    await waitFor(() => expect(screen.getByText('v2.org.audit.outsiderBadge')).toBeTruthy())
    // Đúng MỘT huy hiệu: dòng OWNER vẫn hiện vai trò trần, không bị gắn nhầm.
    expect(screen.getAllByText('v2.org.audit.outsiderBadge')).toHaveLength(1)
    expect(screen.getByText('OWNER')).toBeTruthy()
    expect(screen.queryByText('ADMIN')).toBeNull()
  })

  it('không phải OWNER thì bị đẩy về /v2/org và KHÔNG gọi endpoint', async () => {
    getOrgRole.mockReturnValue('MANAGER')

    render(<V2OrgAuditPage />)

    await waitFor(() => expect(routerReplace).toHaveBeenCalledWith('/v2/org'))
    expect(listOrgAuditLogs).not.toHaveBeenCalled()
  })

  it('tìm kiếm gửi `q` lên máy chủ và quay về trang đầu', async () => {
    listOrgAuditLogs.mockResolvedValue(envelope([row(1)], 1))

    render(<V2OrgAuditPage />)
    await waitFor(() => expect(screen.getByText('ORG_MEMBER_REMOVED_1')).toBeTruthy())

    await userEvent.type(screen.getByLabelText('v2.org.audit.searchPlaceholder'), 'giamdoc')

    await waitFor(() =>
      expect(listOrgAuditLogs).toHaveBeenLastCalledWith(0, ORG_AUDIT_PAGE_SIZE, { q: 'giamdoc', cat: undefined }),
    )
  })

  it('chip danh mục lấy từ chính dữ liệu đã tải và gửi `cat` lên máy chủ', async () => {
    listOrgAuditLogs.mockResolvedValueOnce(
      envelope([row(1, { category: 'ORG_MEMBER' }), row(2, { category: 'CLASS' })], 2),
    )

    render(<V2OrgAuditPage />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'CLASS' })).toBeTruthy())

    listOrgAuditLogs.mockResolvedValueOnce(envelope([row(2, { category: 'CLASS' })], 1))
    await userEvent.click(screen.getByRole('button', { name: 'CLASS' }))

    await waitFor(() =>
      expect(listOrgAuditLogs).toHaveBeenLastCalledWith(0, ORG_AUDIT_PAGE_SIZE, { q: '', cat: 'CLASS' }),
    )
  })

  it('phân trang: "Trang sau" gọi trang kế, trang đầu thì "Trang trước" bị khoá', async () => {
    // 2 trang: total 45 với cỡ trang 30.
    listOrgAuditLogs.mockResolvedValueOnce(envelope([row(1)], 45, 0))

    render(<V2OrgAuditPage />)
    await waitFor(() => expect(screen.getByText('ORG_MEMBER_REMOVED_1')).toBeTruthy())
    expect(screen.getByText('v2.org.audit.pageOf:{"page":1,"pages":2,"total":"45"}')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'v2.org.audit.prevPage' })).toHaveProperty('disabled', true)

    listOrgAuditLogs.mockResolvedValueOnce(envelope([row(9)], 45, 1))
    await userEvent.click(screen.getByRole('button', { name: 'v2.org.audit.nextPage' }))

    await waitFor(() =>
      expect(listOrgAuditLogs).toHaveBeenLastCalledWith(1, ORG_AUDIT_PAGE_SIZE, { q: '', cat: undefined }),
    )
    await waitFor(() => expect(screen.getByText('ORG_MEMBER_REMOVED_9')).toBeTruthy())
  })

  it('lỗi máy chủ (403 khi không đủ quyền) hiện thông báo, không hiện bảng rỗng im lặng', async () => {
    listOrgAuditLogs.mockRejectedValueOnce(new Error('Bạn không có quyền'))

    render(<V2OrgAuditPage />)

    await waitFor(() => expect(screen.getByText('Bạn không có quyền')).toBeTruthy())
    expect(screen.queryByText('v2.org.audit.colTime')).toBeNull()
  })
})
