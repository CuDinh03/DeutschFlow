'use client'

import { useTranslations } from 'next-intl'
import * as React from 'react'
import { CircleHelp, Eye, EyeOff, Highlighter, Undo2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MARK_COLORS } from './marksModel'
import { SWATCH } from './PassageMarker'
import type { PassageMarks } from './usePassageMarks'

/**
 * Dải "Bút đánh dấu" trên bài đọc: chú thích ba màu (owner chốt 09/11/2026: ý nghĩa màu phải có
 * trong hướng dẫn), gợi ý thao tác, Hoàn tác, Ẩn/hiện đánh dấu, và báo lưu lỗi / đề vừa sửa.
 * `full = false` (đang thi thử): gợi ý không nhắc gắn số câu / ghi chú. `touch` (màn hẹp / cảm ứng, đợt 2b):
 * gợi ý nhấn giữ để chọn chữ, thanh công cụ ở đáy màn.
 * `data-tour="marks"` cho bước hướng dẫn lần đầu.
 */
const HINT_SEEN_KEY = 'df.marks.touchHintSeen'

export function MarksBar({ marks, touch = false, full = true }: { marks: PassageMarks; touch?: boolean; full?: boolean }) {
  const t = useTranslations('v2.student.practice.marks')
  // Cảm ứng: gợi ý dài chỉ tự mở lần đầu trên máy này, sau đó nằm sau nút "?" — bài đọc lên gần đầu màn.
  const [hintOpen, setHintOpen] = React.useState(!touch)
  React.useEffect(() => {
    if (!touch) {
      setHintOpen(true)
      return
    }
    let seen = false
    try {
      seen = window.localStorage.getItem(HINT_SEEN_KEY) === '1'
      window.localStorage.setItem(HINT_SEEN_KEY, '1')
    } catch {
      /* chế độ riêng tư: coi như chưa xem */
    }
    setHintOpen(!seen)
  }, [touch])
  const icon = 'inline-flex h-9 w-9 items-center justify-center rounded-ga-touch text-ga-ink hover:bg-ga-side-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus disabled:opacity-35 disabled:hover:bg-transparent'
  return (
    <div data-tour="marks" className="ga-ui mb-4 border border-ga-line bg-ga-card px-3 py-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="inline-flex items-center gap-1.5 text-ga-eyebrow uppercase text-ga-muted">
          <Highlighter size={14} aria-hidden /> <span className={touch ? 'sr-only' : undefined}>{t('bar.title')}</span>
        </span>
        <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-ga-caption text-ga-ink" aria-label={t('bar.legend')}>
          {MARK_COLORS.map((c) => (
            <li key={c} className="inline-flex items-center gap-1.5">
              <span aria-hidden className={cn('h-3 w-5 rounded-ga border border-ga-line-strong', SWATCH[c])} />
              {touch ? t(c === 'y' ? 'shortY' : c === 'g' ? 'shortG' : 'shortP') : t(c === 'y' ? 'colorY' : c === 'g' ? 'colorG' : 'colorP')}
            </li>
          ))}
        </ul>
        <span className="ml-auto inline-flex items-center gap-0.5">
          {touch && (
            <button
              type="button"
              className={icon}
              onClick={() => setHintOpen((v) => !v)}
              aria-expanded={hintOpen}
              aria-label={t('bar.howTo')}
              title={t('bar.howTo')}
            >
              <CircleHelp size={17} aria-hidden />
            </button>
          )}
          <button
            type="button"
            className={icon}
            onClick={marks.undo}
            disabled={!marks.canUndo}
            aria-label={t('bar.undo')}
            title={t('bar.undo')}
          >
            <Undo2 size={17} aria-hidden />
          </button>
          <button
            type="button"
            className={cn(icon, marks.hidden && 'bg-ga-ink text-ga-card hover:bg-ga-ink')}
            onClick={() => marks.setHidden(!marks.hidden)}
            aria-pressed={marks.hidden}
            aria-label={marks.hidden ? t('bar.show') : t('bar.hide')}
            title={marks.hidden ? t('bar.show') : t('bar.hide')}
          >
            {marks.hidden ? <EyeOff size={17} aria-hidden /> : <Eye size={17} aria-hidden />}
          </button>
        </span>
      </div>
      {hintOpen && <p className="mt-1 text-ga-caption text-ga-muted">{touch ? t('bar.hintTouch') : t(full ? 'bar.hint' : 'bar.hintExam')}</p>}
      {marks.staleDropped && <p className="mt-1 text-ga-caption font-semibold text-ga-warning">{t('bar.stale')}</p>}
      {marks.saveState === 'error' && (
        <p role="status" className="mt-1 text-ga-caption font-semibold text-ga-red">
          {t('bar.saveError')}
        </p>
      )}
    </div>
  )
}
