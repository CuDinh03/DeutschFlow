/**
 * G1.1 (F01–F04) + D08 — trang doanh thu admin từng nói sai điều nó đang tính.
 *
 * Bốn sai lệch được test ở đây đều là "số hiển thị đúng, nghĩa hiểu sai" — kiểu lỗi không bao giờ
 * làm trang vỡ, nên không có gì tự bắt được ngoài test:
 *   F01 nhãn MRR/ARR cho một giá trị thực chất là gross − phí cửa hàng giả định − chi phí AI ước tính;
 *   F02 nhãn "Thuê bao" cho COUNT(id) trên giao dịch SUCCESS;
 *   F03 StatusDot so với 'COMPLETED' — giá trị KHÔNG tồn tại trong backend, nên mọi SUCCESS hiện màu chờ;
 *   F04 donut kẹp Math.max(0, …) rồi lọc > 0, làm một kỳ LỖ biến mất khỏi hình.
 *   D08 lần tải đầu thất bại vẫn dựng bộ KPI từ dữ liệu rỗng → "0 ₫" đọc như số thật.
 *
 * Dùng catalog vi THẬT nên test canh luôn thiếu khoá i18n.
 */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextIntlClientProvider } from 'next-intl'
import adminOpsVi from '../../../messages/v2/adminOps.vi.json'
import RevenuePage from '@/app/v2/admin/revenue/page'

// recharts (qua GaBars) gọi ResizeObserver trong effect; jsdom không có ⇒ uncaught exception làm
// hỏng cả file test dù component render đúng. Stub tối thiểu, không cần hành vi thật.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
;(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub

const mocks = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<object>()
  return { ...actual, default: { get: mocks.get } }
})

/** Một kỳ LỖ: chi phí AI vượt phần còn lại sau phí cửa hàng. */
const LOSS_PERIOD = {
  period: '2026-08',
  grossVnd: 10_000_000,
  storeFeeVnd: 1_500_000,
  apiCostVnd: 12_000_000,
  netVnd: -3_500_000,
  marginPct: -35,
  subscribers: 2, // hai GIAO DỊCH — có thể của cùng một người
}

function okResponse(row = LOSS_PERIOD, txStatus = 'SUCCESS') {
  return {
    data: {
      totals: { grossVnd: row.grossVnd, netVnd: row.netVnd, marginPct: row.marginPct },
      chartData: [row],
      transactions: {
        content: [
          {
            id: 1, email: 'a@example.com', planCode: 'PRO', amount: 5_000_000,
            status: txStatus, providerTransactionId: 'tx-1', createdAt: '2026-08-01T00:00:00Z',
          },
        ],
        totalPages: 1,
        totalElements: 1,
      },
    },
  }
}

function renderPage() {
  return render(
    <NextIntlClientProvider locale="vi" messages={{ v2: { ...adminOpsVi } }}>
      <RevenuePage />
    </NextIntlClientProvider>,
  )
}

beforeEach(() => vi.clearAllMocks())
afterEach(() => vi.restoreAllMocks())

describe('Admin Revenue — nhãn phải khớp phép tính (G1.1)', () => {
  it('F01: không còn gọi là MRR/ARR; nhãn nói rõ đây là phần còn lại sau phí và AI', async () => {
    mocks.get.mockResolvedValue(okResponse())
    renderPage()

    await waitFor(() => expect(screen.getByText('Còn lại sau phí & AI')).toBeInTheDocument())
    // ARR cũ = giá trị này × 12, một phép ngoại suy không có cơ sở → đã bỏ hẳn.
    expect(screen.queryByText(/ARR/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/^MRR/i)).not.toBeInTheDocument()
  })

  it('D01/F02: đếm giao dịch, không đếm thuê bao', async () => {
    mocks.get.mockResolvedValue(okResponse())
    renderPage()

    await waitFor(() => expect(screen.getByText('Giao dịch thành công')).toBeInTheDocument())
    // Hai giao dịch của cùng một người vẫn là 2 giao dịch — nhưng không được gọi là 2 thuê bao.
    expect(screen.queryByText('Thuê bao')).not.toBeInTheDocument()
  })

  it('D02/F04: kỳ LỖ giữ nguyên dấu âm và không biến mất khỏi cơ cấu', async () => {
    mocks.get.mockResolvedValue(okResponse())
    renderPage()

    await waitFor(() => expect(screen.getByText('Doanh thu gộp')).toBeInTheDocument())

    // Bản cũ: Math.max(0, netVnd) → 0, rồi .filter(v > 0) loại luôn ⇒ khoản lỗ vô hình.
    // Bản mới: bảng có dấu, -3.5tr₫ phải đọc được.
    expect(screen.getAllByText(/-3\.5tr₫/).length).toBeGreaterThan(0)
    // Phí và chi phí hiện ra là khoản TRỪ, không phải hai lát bánh dương.
    expect(screen.getByText(/-1\.5tr₫/)).toBeInTheDocument()
    expect(screen.getByText(/-12\.0tr₫/)).toBeInTheDocument()
    // Có ghi chú nói rõ đây không phải lợi nhuận kế toán (15% là giả định, AI là ước tính).
    expect(screen.getByText(/không phải lợi nhuận kế toán/i)).toBeInTheDocument()
  })

  it('D03/F03: SUCCESS hiện là thành công, không mang màu/nhãn đang chờ', async () => {
    mocks.get.mockResolvedValue(okResponse(LOSS_PERIOD, 'SUCCESS'))
    renderPage()

    await waitFor(() => expect(screen.getByText('THÀNH CÔNG')).toBeInTheDocument())
    expect(screen.queryByText('SUCCESS')).not.toBeInTheDocument()
  })

  it('D03: trạng thái ngoài tập hỗ trợ được gọi thẳng là không xác định', async () => {
    mocks.get.mockResolvedValue(okResponse(LOSS_PERIOD, 'REFUNDED'))
    renderPage()

    await waitFor(() => expect(screen.getByText('KHÔNG XÁC ĐỊNH')).toBeInTheDocument())
    // Không được im lặng xếp vào nhóm "đang chờ" như bản cũ.
    expect(screen.queryByText('ĐANG CHỜ')).not.toBeInTheDocument()
  })
})

describe('Admin Revenue — lỗi tải không được giả làm dữ liệu (D08)', () => {
  it('tải đầu thất bại: hiện lỗi, KHÔNG dựng bộ KPI 0', async () => {
    mocks.get.mockRejectedValue(new Error('network'))
    renderPage()

    await waitFor(() =>
      expect(screen.getByText('Không thể tải dữ liệu doanh thu.')).toBeInTheDocument(),
    )
    // Bản cũ rơi xuống nhánh dựng KPI từ dữ liệu rỗng: "0₫" nằm ngay dưới banner lỗi.
    expect(screen.queryByText('Còn lại sau phí & AI')).not.toBeInTheDocument()
    expect(screen.queryByText(/^0₫$/)).not.toBeInTheDocument()
  })
})
