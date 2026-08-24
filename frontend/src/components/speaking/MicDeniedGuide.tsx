'use client'

import { useTranslations } from 'next-intl'
import { MicOff } from 'lucide-react'
import { useMicPermission } from '@/hooks/useMicPermission'

interface Props {
  className?: string
}

/**
 * Hướng dẫn mở quyền micro dùng CHUNG cho mọi bề mặt thu âm (N0.7 "fix triệt để"):
 * tự hiện khi Permissions API báo trình duyệt đang CHẶN mic cho site, tự ẩn ngay khi
 * người dùng cấp quyền (subscribe onchange — không cần reload). Trình duyệt không hỗ trợ
 * query('microphone') → không render gì; thông báo lỗi cục bộ của từng bề mặt vẫn lo phần đó.
 */
export function MicDeniedGuide({ className }: Props) {
  const t = useTranslations('v2.student.micGuide')
  const state = useMicPermission()
  if (state !== 'denied') return null
  return (
    <div role="alert" data-testid="mic-denied-banner" className={`rounded-ga border border-ga-red bg-ga-red-soft p-3 ${className ?? ''}`}>
      <p className="ga-ui flex items-center gap-1.5 text-[13.5px] font-semibold text-ga-red">
        <MicOff size={14} aria-hidden /> {t('title')}
      </p>
      <ol className="ga-ui mt-1 list-decimal space-y-0.5 pl-5 text-[12.5px] text-ga-ink">
        <li>{t('site')}</li>
        <li>{t('browser')}</li>
        <li>{t('os')}</li>
      </ol>
    </div>
  )
}
