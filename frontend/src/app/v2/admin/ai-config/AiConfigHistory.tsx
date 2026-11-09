'use client'

import { useCallback, useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { toast } from 'sonner'
import api, { apiMessage } from '@/lib/api'
import { formatDateTime } from '@/lib/i18n/format'
import { GaBtn, GaCap, ConfirmDialog } from '@/components/ui-v2'

/** Ảnh chụp 4 khoá cấu hình AI trong một dòng lịch sử. */
export interface AiConfigSnapshot {
  prompt: string | null
  temperature: number | null
  maxTokens: number | null
  topP: number | null
}

export interface AiConfigHistoryItem {
  id: number
  changedAt: string
  changedByUserId: number | null
  changedByEmail: string | null
  reason: string
  before: AiConfigSnapshot
  after: AiConfigSnapshot
  restoredFromId: number | null
}

const PAGE_SIZE = 10

/**
 * Lịch sử cấu hình AI + "Quay lại bản này" (đợt 2 admin, 09/11/2026).
 * GET /admin/ai-config/history (mới nhất trước), POST /admin/ai-config/history/{id}/restore {reason}.
 *
 * `refreshKey` đổi ⇒ nạp lại trang đầu (sau mỗi lần Lưu). `onRestored` để trang nạp lại cấu hình.
 */
export function AiConfigHistory({ refreshKey, onRestored }: { refreshKey: number; onRestored: () => void }) {
  const t = useTranslations('v2.adminContent.aiConfig')
  const locale = useLocale()
  const [items, setItems] = useState<AiConfigHistoryItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [target, setTarget] = useState<AiConfigHistoryItem | null>(null)
  const [restoring, setRestoring] = useState(false)

  const load = useCallback(async (nextPage: number) => {
    setLoading(true)
    setFailed(false)
    try {
      const res = await api.get('/admin/ai-config/history', { params: { page: nextPage, size: PAGE_SIZE } })
      const data = res?.data ?? {}
      const got: AiConfigHistoryItem[] = Array.isArray(data.items) ? data.items : []
      setItems((prev) => (nextPage === 0 ? got : [...prev, ...got]))
      setTotal(typeof data.total === 'number' ? data.total : got.length)
      setPage(nextPage)
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(0)
  }, [load, refreshKey])

  const restore = async (reason: string) => {
    if (!target) return
    setRestoring(true)
    try {
      await api.post(`/admin/ai-config/history/${target.id}/restore`, { reason })
      toast.success(t('restored', { id: target.id }))
      setTarget(null)
      onRestored()
      await load(0)
    } catch (e: unknown) {
      toast.error(apiMessage(e))
    } finally {
      setRestoring(false)
    }
  }

  const numericRows = (it: AiConfigHistoryItem): [string, number | null, number | null][] =>
    (
      [
        [t('sliderTemperature'), it.before?.temperature ?? null, it.after?.temperature ?? null],
        [t('sliderTopP'), it.before?.topP ?? null, it.after?.topP ?? null],
        [t('sliderMaxTokens'), it.before?.maxTokens ?? null, it.after?.maxTokens ?? null],
      ] as [string, number | null, number | null][]
    ).filter(([, b, a]) => b !== a)

  return (
    <section
      className="border-t border-ga-line px-4 py-5 sm:px-6 lg:px-9 lg:py-[26px]"
      data-testid="ai-config-history"
    >
      <GaCap className="mb-3 block">{t('historyCap')}</GaCap>

      {failed && <p className="ga-ui text-ga-small text-ga-red">{t('historyLoadError')}</p>}
      {!failed && !loading && items.length === 0 && (
        <p className="ga-ui text-ga-small text-ga-subtle">{t('historyEmpty')}</p>
      )}

      {items.length > 0 && (
        <ul className="divide-y divide-ga-line border-y border-ga-line">
          {items.map((it) => {
            const nums = numericRows(it)
            const promptChanged = (it.before?.prompt ?? '') !== (it.after?.prompt ?? '')
            return (
              <li key={it.id} className="py-3" data-testid="ai-config-history-item">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="ga-ui text-ga-small text-ga-ink">
                      <span className="font-semibold">#{it.id}</span>{' '}
                      <time dateTime={it.changedAt}>{formatDateTime(locale, it.changedAt)}</time>{' '}
                      <span className="text-ga-muted">
                        {t('historyBy', { who: it.changedByEmail ?? t('historyUnknownActor') })}
                      </span>
                    </p>
                    {it.restoredFromId != null && (
                      <p className="ga-ui text-ga-caption text-ga-accent">
                        {t('historyRestoredFrom', { id: it.restoredFromId })}
                      </p>
                    )}
                    <p className="ga-ui break-words text-ga-small text-ga-muted">
                      <span className="font-semibold text-ga-ink">{t('historyReason')}:</span> {it.reason}
                    </p>
                    <ul className="ga-ui space-y-0.5 text-ga-small text-ga-ink">
                      {nums.map(([label, b, a]) => (
                        <li key={label}>
                          {label}: <span className="text-ga-muted">{b ?? '—'}</span> → <span className="font-semibold">{a ?? '—'}</span>
                        </li>
                      ))}
                      {promptChanged && <li>{t('historyPromptChanged')}</li>}
                      {nums.length === 0 && !promptChanged && (
                        <li className="text-ga-subtle">{t('historyNoChange')}</li>
                      )}
                    </ul>
                    {promptChanged && (
                      <details className="mt-1">
                        <summary className="ga-ui cursor-pointer text-ga-caption text-ga-accent">
                          {t('historyShowPrompt')}
                        </summary>
                        <div className="mt-2 grid gap-2 lg:grid-cols-2">
                          <div>
                            <GaCap className="mb-1 block">{t('historyPromptBefore')}</GaCap>
                            <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-ga border border-ga-line bg-ga-bg p-3 font-mono text-ga-caption text-ga-ink">
                              {it.before?.prompt ?? ''}
                            </pre>
                          </div>
                          <div>
                            <GaCap className="mb-1 block">{t('historyPromptAfter')}</GaCap>
                            <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-ga border border-ga-line bg-ga-bg p-3 font-mono text-ga-caption text-ga-ink">
                              {it.after?.prompt ?? ''}
                            </pre>
                          </div>
                        </div>
                      </details>
                    )}
                  </div>
                  <GaBtn variant="ghost" size="sm" onClick={() => setTarget(it)}>
                    {t('restore')}
                  </GaBtn>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {items.length < total && (
        <GaBtn variant="ghost" className="mt-3" disabled={loading} onClick={() => void load(page + 1)}>
          {t('historyMore')}
        </GaBtn>
      )}

      <ConfirmDialog
        open={target !== null}
        onOpenChange={(open) => !open && setTarget(null)}
        tone="caution"
        requireReason
        title={t('restoreTitle')}
        description={
          target ? t('restoreDesc', { id: target.id, time: formatDateTime(locale, target.changedAt) }) : undefined
        }
        details={[t('restoreDetailApply'), t('restoreDetailHistory')]}
        confirmLabel={t('restoreConfirm')}
        cancelLabel={t('cancel')}
        loading={restoring}
        onConfirm={({ reason }) => reason && void restore(reason)}
      />
    </section>
  )
}
