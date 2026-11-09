'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * GaChoiceGroup — nhóm nút chọn MỘT đáp án, dùng chung cho các trang làm bài (A7, 09/11/2026).
 *
 * Trước A7 mỗi trang tự vẽ nút đáp án và chỉ báo "đã chọn / đúng / sai" bằng MÀU viền: người mù màu
 * không phân biệt được, trình đọc màn hình chỉ nghe "nút, der" — không biết nút nào đang chọn, câu
 * nào đúng. Component này theo mẫu `components/exam/practice/ObjectiveTeilView.tsx` (kho lựa chọn
 * `role="radiogroup"` / `role="radio"` + `aria-checked` + chữ "Đang chọn") và bổ sung:
 *
 * - **Roving tabindex**: Tab vào nhóm chỉ dừng ở MỘT nút (nút đang chọn, nếu chưa chọn thì nút đầu).
 * - **Phím mũi tên** (↑↓←→, Home, End) chỉ DI CHUYỂN tiêu điểm, có vòng lại; **Space/Enter** mới chọn.
 *   Cố ý không "chọn theo tiêu điểm" như radio gốc của trình duyệt: ở trang luyện theo nhánh, chọn là
 *   gửi đáp án lên server chấm ngay (POST …/check) — lướt mũi tên không được nộp đáp án hộ.
 * - **Không chỉ dựa vào màu**: mỗi trạng thái có hình (ô chữ cái ↔ ô đặc, ✓, ✕) và CHỮ nhìn thấy được
 *   ("Đã chọn", "Bạn chọn · đúng", "Bạn chọn · sai", "Đáp án đúng") — chữ nằm trong tên truy cập của nút
 *   nên trình đọc màn hình đọc luôn.
 * - **Khoá sau khi trả lời** (`locked`): nút vẫn nhận tiêu điểm và đi được bằng mũi tên để nghe lại
 *   (`aria-disabled`, không dùng `disabled` — `disabled` rút nút khỏi thứ tự Tab), nhưng bấm không đổi.
 *
 * Component KHÔNG tự chấm: đáp án đúng (`correctValue`) và phán quyết (`verdict`) do trang truyền vào,
 * và chỉ nên truyền SAU khi server chấm (A3 — đề không mang đáp án xuống trình duyệt).
 *
 * ObjectiveTeilView giữ nguyên kho lựa chọn riêng: nó có trạng thái "đã dùng ở câu N" của kho dùng chung
 * và phím tắt chữ cái cấp cửa sổ — tách ra sẽ đổi hành vi luyện đề telc.
 */
export interface GaChoiceOption<V extends string | number> {
  value: V
  label: React.ReactNode
}

export type GaChoiceState = 'idle' | 'selected' | 'correct' | 'wrong' | 'answer'

export interface GaChoiceGroupProps<V extends string | number> {
  options: GaChoiceOption<V>[]
  /** Phương án đang chọn (null/undefined = chưa chọn). */
  value: V | null | undefined
  onChange: (value: V) => void
  /** Đã trả lời / đang chờ chấm / đã nộp: không đổi lựa chọn được nữa. */
  locked?: boolean
  /** Phương án đúng — CHỈ truyền sau khi server chấm. */
  correctValue?: V | null
  /** Phán quyết cho phương án đang chọn khi server chỉ báo đúng/sai (ưu tiên hơn so `correctValue`). */
  verdict?: boolean | null
  /** Ô chữ cái A, B, C… đầu mỗi phương án (mặc định có). */
  letters?: boolean
  layout?: 'stack' | 'grid' | 'wrap'
  /** Ngôn ngữ của nội dung phương án (vd. 'de' cho đề tiếng Đức) — để trình đọc màn hình đọc đúng giọng. */
  lang?: string
  'aria-label'?: string
  'aria-labelledby'?: string
  className?: string
}

/** Trạng thái hiển thị của một phương án — export cho test và cho trang cần đọc lại cùng luật. */
export function choiceState<V extends string | number>(
  optionValue: V,
  value: V | null | undefined,
  correctValue: V | null | undefined,
  verdict: boolean | null | undefined,
): GaChoiceState {
  const picked = value != null && optionValue === value
  const isKey = correctValue != null && optionValue === correctValue
  const revealed = correctValue != null || verdict != null
  if (picked && revealed) return (verdict ?? isKey) ? 'correct' : 'wrong'
  if (isKey) return 'answer'
  if (picked) return 'selected'
  return 'idle'
}

const LAYOUT: Record<NonNullable<GaChoiceGroupProps<string>['layout']>, string> = {
  stack: 'flex flex-col gap-2',
  grid: 'grid grid-cols-1 gap-2 sm:grid-cols-2',
  wrap: 'flex flex-wrap gap-2.5',
}

export function GaChoiceGroup<V extends string | number>({
  options,
  value,
  onChange,
  locked = false,
  correctValue,
  verdict,
  letters = true,
  layout = 'stack',
  lang,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledby,
  className,
}: GaChoiceGroupProps<V>) {
  const t = useTranslations('v2.ui')
  const refs = React.useRef<Array<HTMLButtonElement | null>>([])
  // Nút đang giữ tiêu điểm trong nhóm (null = tiêu điểm ở ngoài) — quyết định nút nào tabIndex=0.
  const [focused, setFocused] = React.useState<number | null>(null)

  const selectedIdx = options.findIndex((o) => value != null && o.value === value)
  const tabStop = focused ?? (selectedIdx >= 0 ? selectedIdx : 0)
  const revealed = correctValue != null || verdict != null

  const move = (from: number, to: number) => {
    const n = options.length
    if (n === 0) return
    const idx = ((to % n) + n) % n
    if (idx === from) return
    refs.current[idx]?.focus()
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, idx: number) => {
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        e.preventDefault()
        move(idx, idx + 1)
        break
      case 'ArrowUp':
      case 'ArrowLeft':
        e.preventDefault()
        move(idx, idx - 1)
        break
      case 'Home':
        e.preventDefault()
        move(idx, 0)
        break
      case 'End':
        e.preventDefault()
        move(idx, options.length - 1)
        break
      default:
        break
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledby}
      className={cn(LAYOUT[layout], className)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(null)
      }}
    >
      {options.map((o, idx) => {
        const state = choiceState(o.value, value, correctValue, verdict)
        const status =
          state === 'selected'
            ? t('choiceSelected')
            : state === 'correct'
              ? t('choiceCorrectPicked')
              : state === 'wrong'
                ? t('choiceWrongPicked')
                : state === 'answer'
                  ? t('choiceCorrectAnswer')
                  : null
        const checked = state === 'selected' || state === 'correct' || state === 'wrong'
        return (
          <button
            key={idx}
            ref={(el) => {
              refs.current[idx] = el
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-disabled={locked || undefined}
            tabIndex={idx === tabStop ? 0 : -1}
            data-state={state}
            onFocus={() => setFocused(idx)}
            onKeyDown={(e) => onKeyDown(e, idx)}
            onClick={() => {
              if (locked) return
              onChange(o.value)
            }}
            className={cn(
              'ga-ui flex min-h-11 items-center gap-3 rounded-ga-touch border-[1.5px] px-3 py-2 text-left text-ga-body font-medium transition-colors duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus focus-visible:ring-offset-1',
              layout === 'wrap' ? 'max-w-full' : 'w-full',
              locked ? 'cursor-default' : 'active:scale-[0.995]',
              state === 'idle' && 'border-ga-line-strong bg-ga-card',
              state === 'idle' && (revealed ? 'text-ga-muted' : 'text-ga-ink'),
              state === 'idle' && !locked && 'hover:bg-ga-navy-soft',
              state === 'selected' && 'border-ga-navy bg-ga-navy text-ga-card',
              state === 'correct' && 'border-ga-green bg-ga-green-soft text-ga-ink',
              state === 'answer' && 'border-dashed border-ga-green bg-ga-card text-ga-ink',
              state === 'wrong' && 'border-ga-red bg-ga-red-soft text-ga-ink',
            )}
          >
            <Marker state={state} letter={letters ? String.fromCharCode(65 + idx) : null} />
            <span lang={lang} className="min-w-0 flex-1 break-words">
              {o.label}
            </span>
            {status && (
              <span
                className={cn(
                  'shrink-0 text-ga-caption font-semibold',
                  state === 'selected' && 'text-ga-card',
                  (state === 'correct' || state === 'answer') && 'text-ga-green',
                  state === 'wrong' && 'text-ga-red',
                )}
              >
                {status}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/** Ô đầu phương án: chữ cái (chưa chọn) · chữ cái trên nền đặc (đang chọn) · ✓ (đúng) · ✕ (sai). */
function Marker({ state, letter }: { state: GaChoiceState; letter: string | null }) {
  if (state === 'correct' || state === 'answer' || state === 'wrong') {
    const Icon = state === 'wrong' ? X : Check
    return (
      <span
        aria-hidden
        className={cn(
          'grid h-7 w-7 shrink-0 place-items-center rounded-ga-pill border-[1.5px] text-ga-card',
          state === 'wrong' ? 'border-ga-red bg-ga-red' : 'border-ga-green bg-ga-green',
        )}
      >
        <Icon size={14} strokeWidth={2.5} />
      </span>
    )
  }
  if (letter == null) {
    // Không có chữ cái: vòng tròn rỗng ↔ vòng có chấm — hình khác nhau, không chỉ khác màu.
    return (
      <span
        aria-hidden
        className={cn(
          'grid h-5 w-5 shrink-0 place-items-center rounded-ga-pill border-[1.5px]',
          state === 'selected' ? 'border-ga-card' : 'border-ga-line-strong',
        )}
      >
        {state === 'selected' && <span className="h-2.5 w-2.5 rounded-ga-pill bg-ga-card" />}
      </span>
    )
  }
  return (
    <span
      aria-hidden
      className={cn(
        'ga-ui grid h-7 w-7 shrink-0 place-items-center rounded-ga-pill border-[1.5px] text-ga-small font-semibold',
        state === 'selected' ? 'border-ga-card bg-ga-card text-ga-navy' : 'border-ga-navy bg-ga-card text-ga-navy',
      )}
    >
      {letter}
    </span>
  )
}
