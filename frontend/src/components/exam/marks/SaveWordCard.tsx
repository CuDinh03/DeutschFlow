'use client'

import * as React from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { myWordsApi, type SaveWordRequest, type SavedWord } from '@/lib/myWordsApi'

/** Lần lưu đang hiện: yêu cầu gửi đi + chỗ neo (hộp của thanh công cụ lúc bấm). */
export interface SaveWordJob {
  key: number
  request: SaveWordRequest
  anchor: { left: number; top: number; bottom: number }
}

type State =
  | { kind: 'saving' }
  | { kind: 'saved'; word: SavedWord }
  | { kind: 'removed'; word: SavedWord }
  | { kind: 'error'; message: string }

function errorKey(e: unknown): 'wordErrorCap' | 'wordErrorBad' | 'wordErrorAi' | 'wordErrorExam' | 'wordError' {
  const status = (e as { response?: { status?: number } })?.response?.status
  if (status === 429) return 'wordErrorCap'
  if (status === 400) return 'wordErrorBad'
  if (status === 503) return 'wordErrorAi'
  if (status === 409) return 'wordErrorExam'
  return 'wordError'
}

const CARD_W = 300

/**
 * Thẻ kết quả "Lưu từ" (13/11/2026): đang tra nghĩa → dạng gốc + nghĩa + chủ đề + đã vào lịch ôn, có
 * "Bỏ lưu". Neo dưới (hoặc trên) chỗ thanh công cụ vừa đứng; màn hẹp / cảm ứng thì neo đầu màn như ô ghi chú.
 */
export function SaveWordCard({
  job,
  docked,
  onClose,
  onAnnounce,
}: {
  job: SaveWordJob
  docked: boolean
  onClose: () => void
  onAnnounce: (msg: string) => void
}) {
  const t = useTranslations('v2.student.practice.marks')
  const locale = useLocale()
  const [state, setState] = React.useState<State>({ kind: 'saving' })
  const [busy, setBusy] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)
  const tRef = React.useRef(t)
  tRef.current = t
  const announceRef = React.useRef(onAnnounce)
  announceRef.current = onAnnounce

  // Một lần gửi / lượt lưu: StrictMode chạy effect hai lần — gửi lại sẽ nhận "đã có trong sổ" sai.
  const inflight = React.useRef<{ key: number; promise: Promise<SavedWord> } | null>(null)

  React.useEffect(() => {
    let cancelled = false
    setState({ kind: 'saving' })
    if (inflight.current?.key !== job.key) {
      inflight.current = { key: job.key, promise: myWordsApi.save(job.request, locale) }
    }
    inflight.current.promise
      .then((word) => {
        if (cancelled) return
        setState({ kind: 'saved', word })
        announceRef.current(
          word.alreadySaved ? tRef.current('wordAlready') : tRef.current('announceWordSaved', { word: display(word) }),
        )
      })
      .catch((e) => !cancelled && setState({ kind: 'error', message: tRef.current(errorKey(e)) }))
    return () => {
      cancelled = true
    }
  }, [job.key, job.request, locale])

  // Esc / bấm ra ngoài ⇒ đóng (lưu vẫn chạy tiếp nếu đang tra).
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown, true)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown, true)
    }
  }, [onClose])

  const unsave = async (word: SavedWord) => {
    setBusy(true)
    try {
      await myWordsApi.remove(word.id)
      setState({ kind: 'removed', word })
      onAnnounce(t('wordRemoved'))
    } catch (e) {
      setState({ kind: 'error', message: t(errorKey(e) === 'wordErrorBad' ? 'wordError' : errorKey(e)) })
    } finally {
      setBusy(false)
    }
  }

  const style: React.CSSProperties = docked
    ? { left: 8, right: 8, top: 'calc(8px + env(safe-area-inset-top))' }
    : (() => {
        const vw = typeof window === 'undefined' ? 1024 : window.innerWidth
        const vh = typeof window === 'undefined' ? 768 : window.innerHeight
        const left = Math.min(Math.max(8, job.anchor.left), vw - CARD_W - 8)
        const below = job.anchor.bottom + 8
        const top = below + 190 > vh ? Math.max(8, job.anchor.top - 198) : below
        return { left, top, width: CARD_W }
      })()

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={t('saveWord')}
      data-testid="save-word-card"
      style={style}
      className="ga-ui fixed z-50 rounded-ga-touch border border-ga-line bg-ga-card p-3 text-ga-ink shadow-ga-panel"
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1" aria-live="polite">
          {state.kind === 'saving' && <p className="text-ga-small text-ga-muted">{t('wordSaving')}</p>}
          {state.kind === 'error' && <p className="text-ga-small text-ga-ink">{state.message}</p>}
          {(state.kind === 'saved' || state.kind === 'removed') && (
            <>
              <p className="text-ga-caption font-semibold text-ga-muted">
                {state.kind === 'removed' ? t('wordRemoved') : state.word.alreadySaved ? t('wordAlready') : t('wordSaved')}
              </p>
              <p className={cn('mt-1 text-ga-body font-semibold', state.kind === 'removed' && 'text-ga-muted line-through')} lang="de">
                {display(state.word)}
              </p>
              {state.word.meaning && <p className="text-ga-body text-ga-ink">{state.word.meaning}</p>}
              {state.kind === 'saved' && (
                <>
                  <p className="mt-1.5 text-ga-caption text-ga-muted">
                    {state.word.topicLabel ? t('wordTopic', { topic: state.word.topicLabel }) : t('wordTopicNone')}
                  </p>
                  {!state.word.alreadySaved && <p className="text-ga-caption text-ga-muted">{t('wordInReview')}</p>}
                </>
              )}
            </>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('wordClose')}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-ga-touch text-ga-muted hover:bg-ga-side-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus"
        >
          <X size={16} aria-hidden />
        </button>
      </div>
      {state.kind === 'saved' && !state.word.alreadySaved && (
        <div className="mt-2.5 flex justify-end">
          <button
            type="button"
            disabled={busy}
            onClick={() => unsave(state.word)}
            className="h-9 rounded-ga-touch border border-ga-line px-3 text-ga-small font-semibold text-ga-ink hover:bg-ga-side-active disabled:opacity-60"
          >
            {t('wordUndo')}
          </button>
        </div>
      )}
    </div>
  )
}

function display(w: SavedWord): string {
  return w.article ? `${w.article} ${w.lemma}` : w.lemma
}
