'use client'

import { useTranslations } from 'next-intl'
import { Check, X } from 'lucide-react'
import type { PracticeItemResult } from '@/lib/telcPracticeApi'
import { cn } from '@/lib/utils'

/** Chữ cái đáp án trong vòng tròn — dùng chung cho kho lựa chọn, ô trả lời và phân tích. */
export function LetterBadge({
  value,
  tone = 'outline',
  className,
}: {
  value: string
  tone?: 'outline' | 'filled' | 'ok' | 'bad' | 'empty' | 'muted' | 'inverse'
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'ga-ui grid h-8 w-8 shrink-0 place-items-center rounded-ga-pill border-[1.5px] text-ga-body font-semibold',
        tone === 'outline' && 'border-ga-navy bg-ga-card text-ga-navy',
        tone === 'filled' && 'border-ga-navy bg-ga-navy text-ga-card',
        tone === 'ok' && 'border-ga-green bg-ga-green text-ga-card',
        tone === 'bad' && 'border-ga-red bg-ga-red text-ga-card',
        tone === 'empty' && 'border-dashed border-ga-line-strong text-ga-muted',
        tone === 'muted' && 'border-ga-line text-ga-subtle',
        tone === 'inverse' && 'border-ga-card bg-ga-card text-ga-navy',
        className,
      )}
    >
      {/* Khoá dài (richtig/falsch của Hören) không vừa vòng 32px: hiện chữ đầu, R / F. */}
      {value.length > 2 ? value.charAt(0).toUpperCase() : value}
    </span>
  )
}

/**
 * Phân tích MỘT câu sau khi kiểm tra — luôn trả lời đủ: bạn chọn gì và vì sao sai (kèm loại bẫy),
 * đáp án đúng và vì sao đúng, dấu hiệu trong bài, chỗ này cần gì / quy tắc nào. Câu làm đúng vẫn có
 * "vì sao đúng" để người học biết mình đúng có cơ sở hay đoán trúng.
 */
export function ItemAnalysis({ item, title }: { item: PracticeItemResult; title: string }) {
  const t = useTranslations('v2.student.practice')
  const status = !item.answered ? 'none' : item.isCorrect ? 'ok' : 'bad'

  return (
    <div className="ga-ui text-ga-body">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="font-ga-display text-ga-h2 text-ga-ink">{title}</h3>
        {status === 'ok' && (
          <span className="inline-flex items-center gap-1 rounded-ga-pill bg-ga-green-soft px-2.5 py-0.5 text-ga-caption font-semibold text-ga-ink">
            <Check size={13} aria-hidden /> {t('correct')}
          </span>
        )}
        {status === 'bad' && (
          <span className="inline-flex items-center gap-1 rounded-ga-pill bg-ga-red-soft px-2.5 py-0.5 text-ga-caption font-semibold text-ga-ink">
            <X size={13} aria-hidden /> {t('wrong')}
          </span>
        )}
        {status === 'none' && (
          <span className="rounded-ga-pill bg-ga-side-active px-2.5 py-0.5 text-ga-caption font-semibold text-ga-muted">{t('notAnswered')}</span>
        )}
        {item.rule && (
          <span className="rounded-ga-pill bg-ga-navy-soft px-2.5 py-0.5 text-ga-caption font-semibold text-ga-navy">{item.rule}</span>
        )}
      </div>

      {item.need && (
        <Block tone="neutral" label={t('needLabel')}>
          <p>{item.need}</p>
        </Block>
      )}

      {status === 'bad' && (
        <Block
          tone="bad"
          head={
            <>
              <LetterBadge value={item.given ?? ''} tone="bad" />
              <span lang="de" className="min-w-0 break-words">{item.givenText}</span>
            </>
          }
          label={t('whyWrong')}
        >
          <p>{item.whyWrong ?? t('whyWrongFallback')}</p>
          {item.trap && (
            <p className="mt-2">
              <span className="rounded-ga-pill bg-ga-yellow-soft px-2.5 py-0.5 text-ga-caption font-semibold text-ga-ink">{item.trap}</span>
            </p>
          )}
        </Block>
      )}

      <Block
        tone="ok"
        head={
          <>
            <LetterBadge value={item.correct} tone="ok" />
            <span lang="de" className="min-w-0 break-words">{item.correctText}</span>
          </>
        }
        label={t('whyRight')}
      >
        <p>{item.whyRight ?? t('whyRightFallback')}</p>
        {item.evidence.length > 0 && (
          <>
            <p className="mt-3 text-ga-caption font-semibold uppercase tracking-wide text-ga-muted">{t('evidence')}</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5" lang="de">
              {item.evidence.map((e) => (
                <mark key={e} className="rounded-ga bg-ga-yellow-soft px-1.5 py-0.5 text-ga-small text-ga-ink">
                  {e}
                </mark>
              ))}
            </div>
          </>
        )}
      </Block>
    </div>
  )
}

function Block({
  tone,
  head,
  label,
  children,
}: {
  tone: 'ok' | 'bad' | 'neutral'
  head?: React.ReactNode
  label: string
  children: React.ReactNode
}) {
  return (
    <section
      className={cn(
        'mb-2.5 rounded-ga-touch px-3.5 py-3 leading-relaxed',
        tone === 'ok' && 'bg-ga-green-soft',
        tone === 'bad' && 'bg-ga-red-soft',
        tone === 'neutral' && 'border border-ga-line bg-ga-bg',
      )}
    >
      {head && <div className="mb-2 flex items-center gap-2.5 font-semibold text-ga-ink">{head}</div>}
      <p className="text-ga-caption font-semibold uppercase tracking-wide text-ga-muted">{label}</p>
      <div className="mt-1 text-ga-ink">{children}</div>
    </section>
  )
}
