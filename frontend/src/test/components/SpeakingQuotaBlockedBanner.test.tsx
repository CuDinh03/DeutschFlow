/**
 * SpeakingQuotaBlockedBanner — hai giọng của dải "hết hạn mức luyện nói" (quyết định 10/11/2026):
 *
 *   - mặc định (miễn phí / gói hết hạn): giữ lời mời xem gói & nâng cấp như cũ;
 *   - `renewing` (gói trả tiền còn hạn / đang dùng thử): "ngày mai bạn có lượt mới", KHÔNG có
 *     đường dẫn nâng cấp — họ đã mua rồi, ví tự cộng lại hôm sau.
 *
 * Catalog vi THẬT → canh luôn các khoá speaking.quotaBlockedRenewing*.
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { NextIntlClientProvider } from 'next-intl'
import vi from '../../../messages/vi.json'
import { SpeakingQuotaBlockedBanner } from '@/components/features/ai-speaking/SpeakingQuotaBlockedBanner'

function renderBanner(renewing?: boolean) {
  return render(
    <NextIntlClientProvider locale="vi" messages={vi}>
      <SpeakingQuotaBlockedBanner compact upgradeHref="/v2/student/tuition" renewing={renewing} />
    </NextIntlClientProvider>,
  )
}

describe('SpeakingQuotaBlockedBanner', () => {
  it('mặc định → lời mời nâng cấp + link tới trang gói', () => {
    renderBanner()

    expect(screen.getByText('Đã hết hạn mức luyện nói AI')).toBeInTheDocument()
    expect(screen.getByTestId('quota-blocked-upgrade-link')).toHaveAttribute('href', '/v2/student/tuition')
    expect(screen.queryByText(/Ngày mai bạn có lượt mới/)).not.toBeInTheDocument()
  })

  it('renewing → "ngày mai có lượt mới", không có link nâng cấp', () => {
    renderBanner(true)

    expect(screen.getByText('Lượt AI hôm nay đã hết')).toBeInTheDocument()
    expect(screen.getByText(/Ngày mai bạn có lượt mới/)).toBeInTheDocument()
    expect(screen.queryByTestId('quota-blocked-upgrade-link')).not.toBeInTheDocument()
    expect(screen.queryByText(/nâng cấp|nâng gói/i)).not.toBeInTheDocument()
  })
})
