import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MinorAudioBlockedModal, MinorAudioBlockedNotice, MINOR_AUDIO_CONTACT_HREF } from './MinorAudioBlockedNotice'

// Khoá i18n trả nguyên tên khoá → test khẳng định ĐÚNG khoá được chọn theo reason, và detail của
// server thắng câu dự phòng. TkModal cũng gọi useTranslations('v2.ui') — mock chung là đủ.
vi.mock('next-intl', () => ({ useLocale: () => 'vi', useTranslations: () => (k: string) => k }))

describe('MinorAudioBlockedNotice — 403 MINOR_AUDIO_BLOCKED (D8)', () => {
  it('GUARDIAN_CONSENT_REQUIRED: tiêu đề phiếu đồng ý, nội dung = detail server, ghi chú nâng gói, lối liên hệ', () => {
    const onDismiss = vi.fn()
    render(
      <MinorAudioBlockedNotice
        info={{ reason: 'GUARDIAN_CONSENT_REQUIRED', detail: 'Server: cần phiếu đồng ý.' }}
        onDismiss={onDismiss}
      />,
    )
    const alert = screen.getByRole('alert')
    expect(alert.getAttribute('data-reason')).toBe('GUARDIAN_CONSENT_REQUIRED')
    expect(screen.getByText('eyebrow')).toBeTruthy()
    expect(screen.getByText('titleConsentRequired')).toBeTruthy()
    expect(screen.getByText('Server: cần phiếu đồng ý.')).toBeTruthy()
    expect(screen.queryByText('bodyConsentRequired')).toBeNull()
    expect(screen.getByText('note')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'contact' }).getAttribute('href')).toBe(MINOR_AUDIO_CONTACT_HREF)

    fireEvent.click(screen.getByRole('button', { name: 'dismiss' }))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('BIRTH_DATE_REQUIRED không có detail → câu dự phòng về ngày sinh', () => {
    render(<MinorAudioBlockedNotice info={{ reason: 'BIRTH_DATE_REQUIRED', detail: null }} />)
    expect(screen.getByText('titleBirthDate')).toBeTruthy()
    expect(screen.getByText('bodyBirthDate')).toBeTruthy()
    // Không có onDismiss → không có nút "Đã hiểu"; lối liên hệ vẫn còn.
    expect(screen.queryByRole('button', { name: 'dismiss' })).toBeNull()
    expect(screen.getByRole('link', { name: 'contact' })).toBeTruthy()
  })

  it('GUARDIAN_CONSENT_REVOKED → khoá "thu hồi" (không phải lời mời đồng ý lại)', () => {
    render(<MinorAudioBlockedNotice info={{ reason: 'GUARDIAN_CONSENT_REVOKED', detail: null }} variant="page" />)
    expect(screen.getByText('titleConsentRevoked')).toBeTruthy()
    expect(screen.getByText('bodyConsentRevoked')).toBeTruthy()
  })

  it('contactHref tuỳ ngữ cảnh', () => {
    render(<MinorAudioBlockedNotice info={{ reason: 'GUARDIAN_CONSENT_REQUIRED', detail: null }} contactHref="/v2/student/messages" />)
    expect(screen.getByRole('link', { name: 'contact' }).getAttribute('href')).toBe('/v2/student/messages')
  })
})

describe('MinorAudioBlockedModal', () => {
  it('info=null → không render gì', () => {
    const { container } = render(<MinorAudioBlockedModal info={null} onClose={() => {}} />)
    expect(container.innerHTML).toBe('')
  })

  it('mở với tiêu đề theo reason + detail server; đóng gọi onClose', () => {
    const onClose = vi.fn()
    render(<MinorAudioBlockedModal info={{ reason: 'BIRTH_DATE_REQUIRED', detail: 'Server nói.' }} onClose={onClose} />)
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByText('titleBirthDate')).toBeTruthy()
    expect(screen.getByText('Server nói.')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'contact' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'dismiss' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
