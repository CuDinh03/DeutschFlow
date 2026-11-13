'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { AlertTriangle, ArrowRight, X } from 'lucide-react'
import type { ApiProblem } from '@/lib/apiProblem'
import { cn } from '@/lib/utils'

/**
 * Khung lỗi "chuyện gì – ở đâu – làm gì" (owner yêu cầu 13/11/2026): thay cho toast một dòng tự tắt khi lỗi cần
 * admin đi sửa ở chỗ khác. Không tự tắt; mỗi mục chưa đạt nêu nơi xảy ra, lý do, việc cần làm và có nút mở thẳng
 * chỗ sửa. Dựng từ `apiProblem(e)`; lỗi kiểu cũ (không có `issues`) hiện tiêu đề + câu chữ.
 */
export function ProblemNotice({ problem, onDismiss, hideLinks, className }: {
  problem: ApiProblem
  /** Admin đang đứng ngay tại chỗ sửa (vd. trang bản nháp) ⇒ không hiện nút mở. */
  hideLinks?: boolean
  onDismiss?: () => void
  className?: string
}) {
  const t = useTranslations('v2.adminContent.problemNotice')
  const title = problem.title ?? t('fallbackTitle')
  // Các mục liên tiếp cùng một nơi (một bản nháp có nhiều lý do) gộp dưới một nhãn và một nút.
  const groups: { key: string; label: string | null; url: string | null; isDraft: boolean; items: ApiProblem['issues'] }[] = []
  for (const i of problem.issues) {
    const key = `${i.label ?? ''}|${i.url ?? ''}`
    const last = groups[groups.length - 1]
    if (last && last.key === key) last.items.push(i)
    else groups.push({ key, label: i.label, url: i.url, isDraft: i.where.draftId != null, items: [i] })
  }
  return (
    <div role="alert" className={cn('flex items-start gap-2.5 rounded-ga border border-ga-red bg-ga-red-soft px-4 py-3', className)}>
      <AlertTriangle size={16} className="mt-0.5 shrink-0 text-ga-red" aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="ga-ui text-ga-small font-semibold text-ga-ink">{title}</p>
        {groups.length === 0 ? (
          <p className="ga-ui whitespace-pre-wrap break-words text-ga-small text-ga-ink">{problem.message}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {groups.map((g) => (
              <li key={g.key} className="flex flex-wrap items-start gap-x-3 gap-y-1 rounded-ga bg-ga-surface px-3 py-2">
                <div className="min-w-0 flex-1 basis-64">
                  {g.label && <p className="ga-ui text-ga-small font-semibold text-ga-ink">{g.label}</p>}
                  {g.items.map((i) => (
                    <div key={`${i.code}-${i.what}`} className="mt-0.5">
                      <p className="ga-ui break-words text-ga-small text-ga-ink">{i.what}</p>
                      {i.action && (
                        <p className="ga-ui break-words text-ga-caption text-ga-muted">
                          <span className="font-semibold">{t('todo')}</span> {i.action}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
                {g.url && !hideLinks && (
                  <Link href={g.url}
                    className="ga-ui inline-flex shrink-0 items-center gap-1 text-ga-caption font-semibold text-ga-accent hover:underline">
                    {t(g.isDraft ? 'openDraft' : 'open')} <ArrowRight size={13} aria-hidden />
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
        {problem.next && <p className="ga-ui text-ga-caption text-ga-muted">{problem.next}</p>}
      </div>
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label={t('dismiss')}
          className="shrink-0 rounded-ga p-1 text-ga-muted hover:text-ga-ink">
          <X size={14} aria-hidden />
        </button>
      )}
    </div>
  )
}
