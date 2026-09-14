'use client'

import { useTranslations } from 'next-intl'
import type { ExamQuestionItem } from '@/app/v2/student/mock-exam/run/ExamTaking'
import {
  NONE_OF_THEM,
  itemGapNumber,
  itemsByGap,
  parseGappedText,
  telcOptionPool,
  telcTeilType,
  telcUsedKeys,
  type TelcTeil,
} from './telcTeil'

interface TelcTeilBodyProps {
  teil: TelcTeil
  answers: Record<string, string>
  onAnswerChange: (id: string, value: string) => void
}

/**
 * Danh sách lựa chọn dùng chung cả Teil — 10 tiêu đề, 12 mẩu rao vặt, hay hộp 15 từ. In một lần ở
 * đầu Teil đúng như đề giấy, để học viên đọc hết kho trước rồi mới ghép.
 */
function TelcOptionList({ pool, caption }: { pool: { key: string; label: string }[]; caption: string }) {
  return (
    <section className="mb-6 rounded-ga border border-ga-line bg-ga-surface p-4">
      <h3 className="ga-ui mb-3 text-ga-caption font-bold uppercase tracking-wide text-ga-muted">{caption}</h3>
      <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {pool.map((option) => (
          <li key={option.key} className="flex min-w-0 items-baseline gap-2">
            <span className="ga-ui w-5 shrink-0 text-ga-small font-black text-ga-accent">{option.key}</span>
            <span className="ga-ui min-w-0 break-words text-ga-body text-ga-ink">{option.label}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * Bộ chọn chữ cái. Lựa chọn đã bị câu khác chiếm thì **khoá nhưng vẫn hiện** — biến mất thì học
 * viên mất dấu thứ tự `a–l` và không đối chiếu được với danh sách ở trên.
 */
function TelcLetterPicker({
  itemId,
  pool,
  used,
  value,
  allowNone,
  onPick,
}: {
  itemId: string
  pool: { key: string; label: string }[]
  used: Set<string>
  value?: string
  allowNone?: boolean
  onPick: (value: string) => void
}) {
  const t = useTranslations('v2.student.mockExamRun')
  const keys = [...pool.map((o) => o.key), ...(allowNone ? [NONE_OF_THEM] : [])]

  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('telcPickLetter')}>
      {keys.map((key) => {
        const picked = value === key
        const locked = used.has(key) && !picked
        return (
          <label
            key={key}
            title={locked ? t('telcAlreadyUsed') : undefined}
            className={`ga-ui grid h-12 min-w-12 place-items-center rounded-ga border px-2 text-ga-body font-bold transition-colors ${
              picked
                ? 'border-ga-accent bg-ga-accent text-ga-accent-ink'
                : locked
                  ? 'cursor-not-allowed border-ga-line bg-ga-surface text-ga-subtle line-through opacity-60'
                  : 'cursor-pointer border-ga-line bg-ga-card text-ga-muted hover:bg-ga-surface'
            }`}
          >
            <input
              type="radio"
              name={itemId}
              value={key}
              checked={picked}
              disabled={locked}
              onChange={() => onPick(key)}
              className="sr-only"
            />
            {key === NONE_OF_THEM ? t('telcNone') : key}
          </label>
        )
      })}
    </div>
  )
}

/**
 * Văn bản có ô trống. Ô trống hiện thành một ô nhỏ mang số của nó và đáp án đang chọn; việc CHỌN
 * làm ở danh sách bên dưới — đúng như đề giấy (văn bản một bên, lựa chọn một bên) và nhờ vậy dùng
 * được bằng bàn phím mà không cần cửa sổ bật lên.
 */
function TelcGappedText({
  text,
  answers,
  items,
  labelFor,
}: {
  text: string
  answers: Record<string, string>
  items: ExamQuestionItem[]
  labelFor: (gap: number, picked: string) => string
}) {
  const t = useTranslations('v2.student.mockExamRun')
  const byGap = itemsByGap(items)

  return (
    <div className="ga-ui mb-6 whitespace-pre-wrap break-words rounded-ga border border-ga-line bg-ga-surface p-4 text-ga-body leading-8 text-ga-ink">
      {parseGappedText(text).map((segment, idx) => {
        if (segment.kind === 'text') return <span key={idx}>{segment.value}</span>
        const item = byGap.get(segment.gap)
        const picked = item?.id ? answers[item.id] : undefined
        return (
          <span
            key={idx}
            className={`ga-ui mx-1 inline-flex items-baseline gap-1 rounded-ga border px-2 py-0.5 align-baseline text-ga-small font-semibold ${
              picked ? 'border-ga-accent bg-ga-accent-soft text-ga-accent' : 'border-dashed border-ga-line text-ga-subtle'
            }`}
          >
            <span className="text-ga-caption font-black">{segment.gap}</span>
            <span>{picked ? labelFor(segment.gap, picked) : t('telcGapEmpty')}</span>
          </span>
        )
      })}
    </div>
  )
}

/** Chỉ hai dạng ghép nối mới in danh sách kho ở đầu Teil. */
const POOL_CAPTION: Record<'MATCH_HEADLINE' | 'MATCH_AD_X', string> = {
  MATCH_HEADLINE: 'telcHeadlines',
  MATCH_AD_X: 'telcAds',
}

/**
 * Thân của một Teil telc. Trả `null` khi Teil không phải dạng telc để nơi gọi đi nhánh cũ.
 */
export function TelcTeilBody({ teil, answers, onAnswerChange }: TelcTeilBodyProps) {
  const t = useTranslations('v2.student.mockExamRun')
  const type = telcTeilType(teil)
  if (!type) return null

  const items = teil.items ?? []
  const pool = telcOptionPool(teil)
  const poolByKey = new Map(pool.map((o) => [o.key, o.label]))

  // Seed thiếu kho lựa chọn: nói thẳng ra thay vì vẽ một Teil không bấm được câu nào.
  if (pool.length === 0 && type !== 'GAP_MC') {
    return <p className="ga-ui rounded-ga border border-ga-line bg-ga-surface p-4 text-ga-body text-ga-muted">{t('telcMissingPool')}</p>
  }

  // ── Hai dạng điền khuyết: văn bản có ô trống + danh sách ô bên dưới ────────
  if (type === 'GAP_MC' || type === 'GAP_WORDBANK') {
    return (
      <div className="space-y-6">
        {teil.gapped_text && (
          <TelcGappedText
            text={teil.gapped_text}
            answers={answers}
            items={items}
            labelFor={(_gap, picked) => (type === 'GAP_WORDBANK' ? (poolByKey.get(picked) ?? picked) : picked)}
          />
        )}
        {type === 'GAP_WORDBANK' && <TelcOptionList pool={pool} caption={t('telcWordBank')} />}
        {type === 'GAP_WORDBANK' && (
          <p className="ga-ui text-ga-caption text-ga-muted">{t('telcSingleUse')}</p>
        )}

        <ol className="space-y-4">
          {items.map((item) => (
            <li key={item.id} className="border-b border-ga-line pb-4 last:border-0 last:pb-0">
              <p className="ga-ui mb-2 text-ga-body-lg font-semibold text-ga-ink">
                {t('telcGapLabel', { n: itemGapNumber(item) ?? '?' })}
              </p>
              {item.options ? (
                <div className="space-y-2" role="radiogroup" aria-label={item.id}>
                  {Object.entries(item.options).map(([optKey, optVal]) => {
                    const picked = answers[item.id] === optKey
                    return (
                      <label
                        key={optKey}
                        className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-ga border px-3 py-3 transition-colors ${
                          picked ? 'border-ga-accent bg-ga-accent-soft' : 'border-ga-line bg-ga-card hover:bg-ga-surface'
                        }`}
                      >
                        <input
                          type="radio"
                          name={item.id}
                          value={optKey}
                          checked={picked}
                          onChange={() => onAnswerChange(item.id, optKey)}
                          className="h-4 w-4 shrink-0 accent-[var(--ga-accent)]"
                        />
                        <span className="ga-ui w-6 shrink-0 text-ga-small font-bold text-ga-subtle">{optKey}</span>
                        <span className="ga-ui min-w-0 break-words text-ga-body text-ga-ink">{optVal}</span>
                      </label>
                    )
                  })}
                </div>
              ) : (
                <TelcLetterPicker
                  itemId={item.id}
                  pool={pool}
                  used={telcUsedKeys(teil, items, answers, item.id)}
                  value={answers[item.id]}
                  onPick={(value) => onAnswerChange(item.id, value)}
                />
              )}
            </li>
          ))}
        </ol>
      </div>
    )
  }

  // ── Hai dạng ghép nối: kho ở trên, từng câu chọn một chữ cái ───────────────
  return (
    <div>
      <TelcOptionList pool={pool} caption={t(POOL_CAPTION[type])} />
      <p className="ga-ui mb-4 text-ga-caption text-ga-muted">
        {t('telcSingleUse')}
        {type === 'MATCH_AD_X' && ` · ${t('telcNoneHint')}`}
      </p>
      <ol className="space-y-6">
        {items.map((item) => (
          <li key={item.id} className="border-b border-ga-line pb-6 last:border-0 last:pb-0">
            {item.text && <p className="ga-ui mb-3 whitespace-pre-wrap break-words text-ga-body text-ga-ink">{item.text}</p>}
            <p className="ga-ui mb-3 break-words text-ga-body-lg font-semibold text-ga-ink">
              {item.question || t('questionFallback')}
            </p>
            <TelcLetterPicker
              itemId={item.id}
              pool={pool}
              used={telcUsedKeys(teil, items, answers, item.id)}
              value={answers[item.id]}
              allowNone={type === 'MATCH_AD_X'}
              onPick={(value) => onAnswerChange(item.id, value)}
            />
          </li>
        ))}
      </ol>
    </div>
  )
}
