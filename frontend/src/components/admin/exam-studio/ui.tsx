'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { AlertTriangle, Loader2 } from 'lucide-react'
import type { BusyOp, Light, StudioDraft } from '@/lib/adminExamStudioApi'
import { cn } from '@/lib/utils'

// Mảnh giao diện dùng chung của Xưởng đề.

export const studioField =
  'ga-ui block w-full rounded-ga border border-ga-line bg-ga-bg px-3 py-2 text-ga-body text-ga-ink outline-none focus:border-ga-accent disabled:opacity-60'

export const studioMiniBtn =
  'ga-ui inline-flex min-h-9 items-center gap-1 rounded-ga border border-ga-line bg-ga-card px-2.5 py-1 text-ga-caption font-semibold text-ga-muted transition-colors hover:border-ga-accent hover:text-ga-accent disabled:pointer-events-none disabled:opacity-50'

const LIGHT_BG: Record<Light, string> = { GREEN: 'bg-ga-green', YELLOW: 'bg-ga-gold', RED: 'bg-ga-red' }

/** Đèn xanh/vàng/đỏ — chấm màu kèm nhãn cho trình đọc màn hình. */
export function LightDot({ light, className }: { light: Light | null; className?: string }) {
  const t = useTranslations('v2.adminContent.examStudio')
  const label = light ? t(`light.${light}`) : t('light.NONE')
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn(
        'inline-block h-2.5 w-2.5 shrink-0 rounded-full',
        light ? LIGHT_BG[light] : 'border border-ga-line bg-ga-card',
        className,
      )}
    />
  )
}

/** Dải trạng thái khi một thao tác AI đang chạy nền (busyOp != null). */
export function BusyBanner({ op }: { op: BusyOp }) {
  const t = useTranslations('v2.adminContent.examStudio')
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-2.5 rounded-ga border border-ga-line bg-ga-navy-soft px-4 py-3 text-ga-small text-ga-navy"
    >
      <Loader2 size={16} className="ga-spin" aria-hidden />
      <span className="font-semibold">{t(`busy.${op}`)}</span>
      <span className="text-ga-muted">{t('busyHint')}</span>
    </div>
  )
}

/** Lỗi của job AI gần nhất — hiện nguyên văn, xuống dòng được (ErrorBanner chung cắt một dòng). */
export function LastErrorBanner({ message }: { message: string }) {
  const t = useTranslations('v2.adminContent.examStudio')
  return (
    <div role="alert" className="flex items-start gap-2.5 rounded-ga border border-ga-red bg-ga-red-soft px-4 py-3">
      <AlertTriangle size={16} className="mt-0.5 shrink-0 text-ga-red" aria-hidden />
      <div className="min-w-0">
        <p className="ga-ui text-ga-small font-semibold text-ga-ink">{t('lastErrorTitle')}</p>
        <p className="ga-ui whitespace-pre-wrap break-words text-ga-caption text-ga-muted">{message}</p>
      </div>
    </div>
  )
}

/** Ô cảnh báo nhỏ (vàng = lưu ý, đỏ = chặn). */
export function Note({ tone, children, className }: { tone: 'yellow' | 'red'; children: React.ReactNode; className?: string }) {
  return (
    <p
      role={tone === 'red' ? 'alert' : undefined}
      className={cn(
        'ga-ui flex items-start gap-1.5 rounded-ga px-3 py-2 text-ga-caption font-semibold',
        tone === 'red' ? 'bg-ga-red-soft text-ga-red' : 'bg-ga-yellow-soft text-ga-gold',
        className,
      )}
    >
      <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  )
}

/** Props chung của mỗi bước trình hướng dẫn. */
export interface StudioStepProps {
  draft: StudioDraft
  /** true khi đang có job AI, đang gửi yêu cầu, hoặc bản nháp đã duyệt/huỷ. */
  locked: boolean
  /** Gọi một thao tác trả Draft; tự cập nhật state, báo lỗi bằng toast. Trả true nếu thành công. */
  run: (fn: () => Promise<StudioDraft>, okMessage?: string) => Promise<boolean>
}

/** Cảnh báo chống trùng không chặn (`draft.warnings`) — mỗi dòng một banner vàng. */
export function WarningsBanner({ warnings }: { warnings: string[] | null | undefined }) {
  if (!warnings || warnings.length === 0) return null
  return (
    <ul className="flex flex-col gap-1.5">
      {warnings.map((w, i) => <li key={i}><Note tone="yellow">{w}</Note></li>)}
    </ul>
  )
}
