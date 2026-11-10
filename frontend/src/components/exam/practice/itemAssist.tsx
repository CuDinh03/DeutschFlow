'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Flag, Loader2, NotebookPen, RotateCw, Sparkles } from 'lucide-react'
import { apiMessage } from '@/lib/api'
import type { ItemAiAnswer } from '@/lib/telcPracticeApi'
import { cn } from '@/lib/utils'

/**
 * Phụ trợ từng câu của phòng thi (B3 "Nâng phòng thi", 09/11/2026), truyền xuống `ObjectiveTeilView` /
 * `ItemAnalysis` qua context để `HoerenTeilView` (bọc `ObjectiveTeilView`) không phải đổi props:
 *
 * - `askAi` — "Hỏi AI về câu này" ở màn xem lại SAU khi nộp (câu đúng lẫn sai). Server giữ bộ nhớ đệm.
 * - `notes` / `onNote` — "Vì sao tôi chọn" khi luyện Teil (không bắt buộc); sau khi nộp hiện cạnh giải thích.
 * - `flags` / `onToggleFlag` — câu đánh dấu xem lại do trang giữ (thi thử lưu cùng nháp). Không truyền thì
 *   `ObjectiveTeilView` tự giữ trong state như trước.
 * - `jump` — trang yêu cầu nhảy tới một câu (danh sách câu đánh dấu của cả chặng thi).
 */
export interface ItemAssistValue {
  askAi?: (itemId: string) => Promise<ItemAiAnswer>
  notes?: Record<string, string>
  onNote?: (itemId: string, text: string) => void
  flags?: ReadonlySet<string>
  onToggleFlag?: (itemId: string) => void
  jump?: { id: string; n: number } | null
}

export const ItemAssist = React.createContext<ItemAssistValue>({})

/** Ghi chú dài nhất (khớp `MockExamPracticeService.MAX_NOTE_CHARS`). */
export const NOTE_MAX = 300

/** Bọc `askAi` bằng bộ nhớ trong trang: mở lại câu đã hỏi không gọi lại server. */
export function useCachedAsk(ask: ((itemId: string) => Promise<ItemAiAnswer>) | null, scope: string) {
  const cache = React.useRef(new Map<string, ItemAiAnswer>())
  return React.useMemo(() => {
    if (!ask) return undefined
    return async (itemId: string) => {
      const key = `${scope}|${itemId}`
      const hit = cache.current.get(key)
      if (hit) return hit
      const res = await ask(itemId)
      cache.current.set(key, res)
      return res
    }
  }, [ask, scope])
}

/** Nút + khung trả lời "Hỏi AI về câu này". Gắn `key={itemId}` ở chỗ dùng để đổi câu là về trạng thái đầu. */
export function AskAiPanel({ itemId, ask }: { itemId: string; ask: (itemId: string) => Promise<ItemAiAnswer> }) {
  const ta = useTranslations('v2.student.practice.assist')
  const [state, setState] = React.useState<
    { kind: 'idle' } | { kind: 'loading' } | { kind: 'done'; res: ItemAiAnswer } | { kind: 'error'; message: string }
  >({ kind: 'idle' })

  const run = async () => {
    setState({ kind: 'loading' })
    try {
      setState({ kind: 'done', res: await ask(itemId) })
    } catch (e) {
      setState({ kind: 'error', message: apiMessage(e) || ta('error') })
    }
  }

  return (
    <section className="mt-3 rounded-ga-touch border border-ga-line bg-ga-card px-3.5 py-3" aria-label={ta('title')}>
      {state.kind === 'idle' && (
        <button
          type="button"
          onClick={() => void run()}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-ga-touch border-[1.5px] border-ga-navy px-3 text-ga-small font-semibold text-ga-navy hover:bg-ga-navy-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus"
        >
          <Sparkles size={15} aria-hidden />
          {ta('ask')}
        </button>
      )}
      <div aria-live="polite">
        {state.kind === 'loading' && (
          <p className="inline-flex min-h-10 items-center gap-2 text-ga-small text-ga-muted">
            <Loader2 size={15} className="ga-spin" aria-hidden />
            {ta('loading')}
          </p>
        )}
        {state.kind === 'done' && (
          <>
            <p className="flex items-center gap-1.5 text-ga-caption font-semibold uppercase tracking-wide text-ga-muted">
              <Sparkles size={13} aria-hidden />
              {ta('title')}
            </p>
            <p className="mt-1 whitespace-pre-line text-ga-body text-ga-ink" data-testid="ask-ai-answer">
              {state.res.answer}
            </p>
            <p className="mt-2 text-ga-caption text-ga-muted">
              {state.res.cached ? `${ta('cached')} · ` : ''}
              {ta('disclaimer')}
            </p>
          </>
        )}
        {state.kind === 'error' && (
          <div className="flex flex-wrap items-center gap-2">
            <p role="alert" className="min-w-0 flex-1 text-ga-small text-ga-red">{state.message}</p>
            <button
              type="button"
              onClick={() => void run()}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-ga-touch px-3 text-ga-small font-semibold text-ga-navy hover:bg-ga-side-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus"
            >
              <RotateCw size={14} aria-hidden />
              {ta('retry')}
            </button>
          </div>
        )}
      </div>
    </section>
  )
}

/**
 * Ô "Vì sao tôi chọn" của câu đang làm. Thu gọn thành một nút nhỏ; đã có chữ thì mở sẵn.
 * Phím tắt của khung làm bài bỏ qua khi đang gõ trong ô này (`closest('textarea')`).
 */
export function NoteField({ itemId, label, value, onChange }: { itemId: string; label: string; value: string; onChange: (text: string) => void }) {
  const ta = useTranslations('v2.student.practice.assist')
  const [open, setOpen] = React.useState(value !== '')
  const id = `note-${itemId}`
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={false}
        className="ga-ui inline-flex min-h-10 items-center gap-1.5 rounded-ga-touch px-2 text-ga-small font-semibold text-ga-muted hover:bg-ga-side-active hover:text-ga-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus"
      >
        <NotebookPen size={15} aria-hidden />
        {ta('noteOpen')}
      </button>
    )
  }
  return (
    <div className="ga-ui">
      <label htmlFor={id} className="mb-1 flex items-center gap-1.5 text-ga-caption font-semibold text-ga-muted">
        <NotebookPen size={14} aria-hidden />
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        maxLength={NOTE_MAX}
        rows={2}
        onChange={(e) => onChange(e.target.value)}
        placeholder={ta('notePlaceholder')}
        className="w-full resize-y rounded-ga-touch border-[1.5px] border-ga-line-strong bg-ga-card px-3 py-2 text-ga-body text-ga-ink placeholder:text-ga-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus"
      />
      <p className="mt-0.5 text-right text-ga-caption tabular-nums text-ga-subtle">{value.length}/{NOTE_MAX}</p>
    </div>
  )
}

/** Nút cờ "đánh dấu xem lại" cho câu đang chọn (dạng nối / chỗ trống / rao vặt — trắc nghiệm có nút trong thẻ câu). */
export function FlagToggle({ label, flagged, onToggle, className }: { label: string; flagged: boolean; onToggle: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={flagged}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-ga-touch transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus',
        flagged ? 'text-ga-ink' : 'text-ga-subtle hover:bg-ga-side-active hover:text-ga-ink',
        className,
      )}
    >
      <Flag size={17} aria-hidden fill={flagged ? 'var(--ga-yellow)' : 'none'} />
    </button>
  )
}

/** Hàng "Câu đã đánh dấu" trong một Teil: mỗi câu một nút nhảy tới. Không có câu nào thì không hiện. */
export function FlaggedList({ items, onJump }: { items: { id: string; label: string }[]; onJump: (id: string) => void }) {
  const ta = useTranslations('v2.student.practice.assist')
  if (items.length === 0) return null
  return (
    <div role="group" aria-label={ta('flaggedTitle')} className="ga-ui mb-3 flex flex-wrap items-center gap-1.5 rounded-ga-touch bg-ga-yellow-soft px-3 py-2">
      <span className="mr-1 inline-flex items-center gap-1 text-ga-caption font-semibold text-ga-ink">
        <Flag size={13} aria-hidden fill="var(--ga-yellow)" />
        {ta('flaggedTitle')}
      </span>
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          onClick={() => onJump(it.id)}
          aria-label={ta('flaggedJump', { n: it.label })}
          className="inline-flex h-8 min-w-8 items-center justify-center rounded-ga-touch border-[1.5px] border-ga-line-strong bg-ga-card px-1.5 text-ga-small font-semibold tabular-nums text-ga-ink hover:bg-ga-side-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus"
        >
          {it.label}
        </button>
      ))}
    </div>
  )
}
