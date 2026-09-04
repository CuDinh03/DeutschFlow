'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Clock, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useImmersiveChrome } from '@/components/ui-v2/useImmersiveChrome'

/**
 * ExamShell — vỏ dùng chung cho mọi phiên thi (S-09, UX-07).
 *
 * Thi là một CHẾ ĐỘ NHẬN THỨC khác với học: người thi cần biết còn bao lâu, đang ở phần nào, bài
 * đã lưu chưa — và không cần biết mình được bao nhiêu XP. Vỏ này vì thế là layout SONG SONG với
 * role shell chứ không dựng trên nó (plan §6): không sidebar, không bottom nav, không XP/streak,
 * không animation trang trí.
 *
 * Ba thứ được cân nhắc kỹ, không phải trang trí:
 *
 *  · **Đồng hồ** `aria-live="off"`. Đọc lại từng giây là tra tấn người dùng screen reader; thay
 *    vào đó chỉ thông báo ở mốc 5 phút và 1 phút qua một vùng `role="status"` riêng.
 *  · **Cảnh báo ≤5 phút** đổi màu + đổi chữ, **không nhấp nháy**. Bản cũ dùng `animate-pulse` —
 *    vừa là animation trang trí bị DS §7 cấm trong vỏ thi, vừa gây khó chịu đúng lúc người ta
 *    đang căng thẳng nhất.
 *  · **Trạng thái lưu** là chữ, không phải chấm màu — và chỉ nói "Đã lưu" khi server ĐÃ xác
 *    nhận (V285 autosave server-side, #409). B-13 từng đo server không nhận gì trước `/finish`;
 *    nay autosave server là nguồn sự thật, nhãn đi theo callback onSaved chứ không phỏng đoán
 *    (ràng buộc S-14 — cấm hiển thị "Đã lưu" khi chưa lưu thật).
 */
export type ExamSaveState = 'saved' | 'saving' | 'error'

export interface ExamShellProps {
  /** Nhãn phần đang làm, vd "LESEN — Đọc hiểu". */
  sectionLabel: string
  sectionIndex: number
  sectionCount: number
  answeredCount: number
  totalQuestions: number
  secondsLeft: number
  saveState: ExamSaveState
  /** Epoch ms của lần lưu gần nhất — chỉ hiển thị khi `saveState === 'saved'`. */
  savedAt?: number
  onExit: () => void
  /** Nút nộp bài — do runner sở hữu vì nó biết trạng thái submit. */
  submitSlot?: React.ReactNode
  children: React.ReactNode
}

/** Ngưỡng cảnh báo (giây). Mốc thông báo cho screen reader trùng với ngưỡng đổi màu. */
const WARN_AT = 5 * 60
const URGENT_AT = 60

export function formatClock(seconds: number): string {
  const safe = Math.max(0, seconds)
  const m = Math.floor(safe / 60)
  const s = safe % 60
  return `${m}:${s < 10 ? '0' : ''}${s}`
}

function formatSavedAt(stamp: number): string {
  const d = new Date(stamp)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

export function ExamShell({
  sectionLabel,
  sectionIndex,
  sectionCount,
  answeredCount,
  totalQuestions,
  secondsLeft,
  saveState,
  savedAt,
  onExit,
  submitSlot,
  children,
}: ExamShellProps) {
  const t = useTranslations('v2.student.examShell')

  // Gỡ chrome của role shell trong lúc thi — xem `useImmersiveChrome` cho lý do đầy đủ.
  useImmersiveChrome()

  const warning = secondsLeft <= WARN_AT
  const percent = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0

  // Thông báo theo MỐC, không theo từng giây. `announced` giữ mốc đã đọc để một mốc không bị
  // đọc lại mỗi lần render.
  const [announcement, setAnnouncement] = React.useState('')
  const announced = React.useRef<number | null>(null)
  React.useEffect(() => {
    const mark = secondsLeft <= URGENT_AT ? URGENT_AT : secondsLeft <= WARN_AT ? WARN_AT : null
    if (mark === null || announced.current === mark) return
    announced.current = mark
    setAnnouncement(t('timeLeftAnnounce', { minutes: Math.ceil(mark / 60) }))
  }, [secondsLeft, t])

  const saveLabel =
    saveState === 'saving'
      ? t('saveSaving')
      : saveState === 'error'
        ? t('saveError')
        : savedAt
          ? t('saveSavedAt', { time: formatSavedAt(savedAt) })
          : t('saveSaved')

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-ga-bg">
      {/* ── Dải trên: phần · đồng hồ · trạng thái lưu · thoát ─────────────────
          Dính trên ở mọi khổ màn: ở 390px đây là thứ duy nhất người thi cần thấy thường trực. */}
      <header className="shrink-0 border-b border-ga-line bg-ga-card">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 lg:px-6">
          {/* `basis-full` dưới sm: ở 390px nhãn phần phải chiếm trọn một dòng. Để nó chia hàng với
              đồng hồ và hai nút thì flex ép nó co lại còn vài chục pixel và "LESEN" bị bẻ giữa
              từ thành "LESE / N". Từ sm trở lên mới quay về chia hàng như thiết kế. */}
          <div className="min-w-0 basis-full sm:basis-0 sm:flex-1">
            <p className="ga-ui uppercase text-ga-stat-label text-ga-muted">
              {t('sectionOf', { index: sectionIndex + 1, total: sectionCount })}
            </p>
            <h1 className="min-w-0 font-ga-display text-ga-h3 text-ga-ink lg:text-ga-h2">
              {sectionLabel}
            </h1>
          </div>

          <div
            // Đồng hồ KHÔNG tự đọc: xem `aria-live="off"` ở đầu file.
            aria-live="off"
            className={cn(
              'flex shrink-0 items-center gap-2 font-mono text-[18px] font-bold tabular-nums lg:text-[22px]',
              warning ? 'text-ga-warning' : 'text-ga-ink',
            )}
          >
            <Clock size={20} className="shrink-0" aria-hidden />
            <span>{formatClock(secondsLeft)}</span>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {submitSlot}
            <button
              type="button"
              onClick={onExit}
              className="ga-ui inline-flex min-h-11 items-center gap-1.5 rounded-ga border border-ga-line bg-ga-card px-3 text-ga-small font-semibold text-ga-muted transition-colors hover:bg-ga-surface hover:text-ga-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus focus-visible:ring-inset lg:min-h-0 lg:py-2"
            >
              <LogOut size={16} aria-hidden />
              {t('exit')}
            </button>
          </div>
        </div>

        {/* ── Tiến độ + trạng thái lưu ───────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-ga-line px-4 py-2 lg:px-6">
          <div className="flex min-w-[8rem] flex-1 items-center gap-3">
            <div
              role="progressbar"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={t('progressLabel')}
              className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-ga-pill bg-ga-surface"
            >
              <div className="h-full rounded-ga-pill bg-ga-accent" style={{ width: `${percent}%` }} />
            </div>
            <span className="ga-ui shrink-0 tabular-nums text-ga-caption text-ga-muted">
              {t('answered', { done: answeredCount, total: totalQuestions })}
            </span>
          </div>

          {/* Trạng thái lưu bằng CHỮ. Người thi phải đọc được phạm vi thật, không đoán qua màu. */}
          <p
            className={cn(
              'ga-ui shrink-0 text-ga-caption',
              saveState === 'error' ? 'text-ga-red' : 'text-ga-muted',
            )}
          >
            {saveLabel}
          </p>
        </div>
      </header>

      {/* Vùng đọc giới hạn ~72ch: dòng dài hơn thì mắt mất dấu khi xuống dòng (plan S-09). */}
      <main className="min-h-0 flex-1 overflow-y-auto bg-ga-surface">
        <div className="mx-auto w-full max-w-[72ch] px-4 py-5 lg:max-w-[80ch] lg:px-6 lg:py-7">
          {children}
        </div>
      </main>

      {/* Vùng thông báo mốc thời gian — tách khỏi đồng hồ để không đọc lại từng giây. */}
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  )
}
