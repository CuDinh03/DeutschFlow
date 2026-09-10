'use client'

import * as React from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { GaIcon } from './GaIcon'
import { GaBtn } from './GaBtn'
import { TkModal } from './TkModal'
import type { MinorAudioBlocked } from '@/lib/minorAudio'

/**
 * MinorAudioBlockedNotice — màn 403 `MINOR_AUDIO_BLOCKED` (DEC-22, D8 10/09): phần ghi âm bị chặn
 * vì chưa xác định tuổi / chưa có (hoặc đã rút) đồng ý của người giám hộ.
 *
 * Khác ErrorBanner ở chỗ đây KHÔNG phải "thử lại": lỗi này chỉ hết khi trung tâm (hoặc người giám
 * hộ) làm một việc ngoài ứng dụng, nên nó phải nói rõ việc cần làm + ai làm, mở lối liên hệ trung
 * tâm, và nói thẳng nâng gói không mở được (kẻo một đứa trẻ đi tìm nút "Nâng cấp" — cùng lý do
 * backend tách mã này khỏi 429 QUOTA_EXCEEDED). Ba `reason` là ba việc khác nhau, không gộp;
 * REVOKED không được biến thành lời mời "đồng ý lại" trong app.
 *
 * Nội dung chính là `detail` của server (tiếng Việt, F-I18N-03); câu i18n vi/en/de là dự phòng.
 * Variants: `inline` (trong luồng, cạnh ô ghi âm) · `page` (khối giữa trang). `MinorAudioBlockedModal`
 * bọc cùng nội dung trong TkModal cho màn nộp bài.
 */
export const MINOR_AUDIO_CONTACT_HREF = '/v2/student/classes'

export interface MinorAudioBlockedNoticeProps {
  info: MinorAudioBlocked
  variant?: 'inline' | 'page'
  /** Có → hiện nút "Đã hiểu" (đóng thông báo). */
  onDismiss?: () => void
  /** Lối "Liên hệ trung tâm" — mặc định màn lớp của học viên. */
  contactHref?: string
  className?: string
}

interface Copy {
  eyebrow: string
  title: string
  body: string
  note: string
  contact: string
  dismiss: string
}

function useMinorAudioCopy(info: MinorAudioBlocked): Copy {
  const t = useTranslations('v2.student.minorAudio')
  let title: string
  let fallbackBody: string
  switch (info.reason) {
    case 'BIRTH_DATE_REQUIRED':
      title = t('titleBirthDate')
      fallbackBody = t('bodyBirthDate')
      break
    case 'GUARDIAN_CONSENT_REVOKED':
      title = t('titleConsentRevoked')
      fallbackBody = t('bodyConsentRevoked')
      break
    default:
      title = t('titleConsentRequired')
      fallbackBody = t('bodyConsentRequired')
  }
  return {
    eyebrow: t('eyebrow'),
    title,
    body: info.detail ?? fallbackBody,
    note: t('note'),
    contact: t('contact'),
    dismiss: t('dismiss'),
  }
}

function Actions({
  copy,
  contactHref,
  onDismiss,
  className,
}: {
  copy: Copy
  contactHref: string
  onDismiss?: () => void
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <GaBtn asChild variant="yellow" size="sm">
        <Link href={contactHref}>{copy.contact}</Link>
      </GaBtn>
      {onDismiss && (
        <GaBtn variant="ghost" size="sm" onClick={onDismiss}>
          {copy.dismiss}
        </GaBtn>
      )}
    </div>
  )
}

export function MinorAudioBlockedNotice({
  info,
  variant = 'inline',
  onDismiss,
  contactHref = MINOR_AUDIO_CONTACT_HREF,
  className,
}: MinorAudioBlockedNoticeProps) {
  const copy = useMinorAudioCopy(info)

  if (variant === 'page') {
    return (
      <div
        role="alert"
        data-testid="minor-audio-blocked"
        data-reason={info.reason}
        className={cn(
          'flex flex-col items-center justify-center gap-3 px-4 py-10 text-center lg:px-6 lg:py-14',
          className,
        )}
      >
        <span className="grid h-12 w-12 place-items-center rounded-ga-pill bg-ga-accent-soft text-ga-accent">
          <GaIcon name="lock" size={24} />
        </span>
        <div className="space-y-1">
          <p className="ga-ui text-ga-eyebrow uppercase text-ga-muted">{copy.eyebrow}</p>
          <p className="font-ga-display text-ga-h2 text-ga-ink">{copy.title}</p>
          <p className="ga-ui mx-auto max-w-md text-ga-small text-ga-muted">{copy.body}</p>
          <p className="ga-ui mx-auto max-w-md pt-1 text-ga-caption text-ga-subtle">{copy.note}</p>
        </div>
        <Actions copy={copy} contactHref={contactHref} onDismiss={onDismiss} className="mt-1 justify-center" />
      </div>
    )
  }

  return (
    <div
      role="alert"
      data-testid="minor-audio-blocked"
      data-reason={info.reason}
      className={cn('rounded-ga border border-ga-line bg-ga-card p-4 lg:p-5', className)}
    >
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-ga bg-ga-accent-soft text-ga-accent">
          <GaIcon name="lock" size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="ga-ui text-ga-eyebrow uppercase text-ga-muted">{copy.eyebrow}</p>
          <p className="mt-1 font-ga-display text-ga-h3 text-ga-ink">{copy.title}</p>
          <p className="ga-ui mt-1.5 text-ga-small text-ga-muted">{copy.body}</p>
          <p className="ga-ui mt-2 border-l-2 border-ga-yellow pl-3 text-ga-caption text-ga-subtle">{copy.note}</p>
          <Actions copy={copy} contactHref={contactHref} onDismiss={onDismiss} className="mt-3" />
        </div>
      </div>
    </div>
  )
}

export interface MinorAudioBlockedModalProps {
  /** null = đóng (render rỗng) — caller giữ state `MinorAudioBlocked | null` là đủ. */
  info: MinorAudioBlocked | null
  onClose: () => void
  contactHref?: string
}

/** Cùng nội dung, bọc TkModal (size sm) — cho luồng nộp bài, nơi lỗi hiện qua toast không đủ chỗ. */
export function MinorAudioBlockedModal({ info, onClose, contactHref = MINOR_AUDIO_CONTACT_HREF }: MinorAudioBlockedModalProps) {
  if (!info) return null
  return <MinorAudioBlockedModalOpen info={info} onClose={onClose} contactHref={contactHref} />
}

function MinorAudioBlockedModalOpen({ info, onClose, contactHref }: { info: MinorAudioBlocked; onClose: () => void; contactHref: string }) {
  const copy = useMinorAudioCopy(info)
  return (
    <TkModal
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      size="sm"
      title={copy.title}
      description={copy.eyebrow}
      footer={<Actions copy={copy} contactHref={contactHref} onDismiss={onClose} />}
    >
      <div data-testid="minor-audio-blocked" data-reason={info.reason} className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-ga bg-ga-accent-soft text-ga-accent">
          <GaIcon name="lock" size={20} />
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="ga-ui text-ga-body text-ga-ink">{copy.body}</p>
          <p className="ga-ui border-l-2 border-ga-yellow pl-3 text-ga-caption text-ga-subtle">{copy.note}</p>
        </div>
      </div>
    </TkModal>
  )
}
