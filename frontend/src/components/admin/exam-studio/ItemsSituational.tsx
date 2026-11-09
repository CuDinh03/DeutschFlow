'use client'

import { useTranslations } from 'next-intl'
import type { StudioDraft } from '@/lib/adminExamStudioApi'
import {
  AD_X_EXPECTED, adIssues, adRoles, buildGappedText, wordBankIssues, wordBankRows,
} from '@/lib/examStudioLogic'
import { GaCap, GaCard } from '@/components/ui-v2'
import { cn } from '@/lib/utils'
import { TeilPreview } from './TeilPreview'
import { Note } from './ui'

// Bảng phụ ở bước Câu hỏi cho các Teil soạn theo tình huống (đợt 3).

/** Nhảy tới thẻ câu (id `item-card-<itemId>`), đặt focus để bàn phím/đọc màn hình theo được. */
export function jumpToItem(itemId: string) {
  const el = typeof document !== 'undefined' ? document.getElementById(`item-card-${itemId}`) : null
  if (!el) return
  el.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
  el.focus?.({ preventScroll: true })
}

/** Lesen T3: 12 mẩu a–l với vai trò (đáp án của câu nào, ví dụ, thừa) + lỗi số câu x / mẩu dùng hai lần. */
export function AdRoleTable({ draft }: { draft: StudioDraft }) {
  const t = useTranslations('v2.adminContent.examStudio')
  const rows = adRoles(draft.text?.ads, draft.items, draft.text?.examples)
  const issues = adIssues(draft.items)
  const dup = new Set(issues.duplicateAnswers)

  return (
    <GaCard className="flex flex-col gap-2 p-4 sm:p-5">
      <h3><GaCap>{t('items.adTable')}</GaCap></h3>
      {issues.xCount !== AD_X_EXPECTED && <Note tone="red">{t('items.xCount', { n: issues.xCount, expected: AD_X_EXPECTED })}</Note>}
      {issues.duplicateAnswers.length > 0 && <Note tone="red">{t('items.adDuplicate', { list: issues.duplicateAnswers.join(', ') })}</Note>}
      <div className="overflow-x-auto">
        <table className="ga-ui w-full min-w-[480px] text-ga-small">
          <caption className="sr-only">{t('items.adTable')}</caption>
          <thead>
            <tr className="text-left text-ga-caption text-ga-muted">
              <th scope="col" className="w-8 py-1 pr-2 font-semibold">{t('items.colLetter')}</th>
              <th scope="col" className="py-1 pr-2 font-semibold">{t('items.colAd')}</th>
              <th scope="col" className="py-1 font-semibold">{t('items.colRole')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const bad = dup.has(r.letter)
              const roles = [
                ...r.answerFor.map((n) => t('items.adRoleAnswer', { n })),
                ...r.exampleFor.map((label) => t('items.adRoleExample', { label })),
              ]
              return (
                <tr key={r.letter} className={cn('border-t border-ga-line align-top', bad && 'bg-ga-red-soft')}>
                  <td className={cn('py-1.5 pr-2 font-semibold', bad ? 'text-ga-red' : 'text-ga-ink')}>{r.letter}</td>
                  <td className="py-1.5 pr-2 text-ga-ink" lang="de">{r.text || '—'}</td>
                  <td className="py-1.5 text-ga-muted">
                    {roles.length > 0 ? roles.join(' · ') : t('items.adRoleSpare')}
                    {r.distractorFor.length > 0 && (
                      <span className="block text-ga-caption">{t('items.adRoleDistractor', { list: r.distractorFor.join(', ') })}</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </GaCard>
  )
}

/** Sprachbausteine: thư có ô (bấm ô → nhảy tới thẻ câu) + ô không định vị được. */
export function GapLetterPanel({ draft }: { draft: StudioDraft }) {
  const t = useTranslations('v2.adminContent.examStudio')
  const { missing } = buildGappedText(draft.text?.context ?? '', draft.items)
  if (!draft.text) return null
  return (
    <section aria-labelledby="gap-letter-h" className="flex flex-col gap-2">
      <h3 id="gap-letter-h"><GaCap>{t('items.gapLetter')}</GaCap></h3>
      <p className="ga-ui text-ga-caption text-ga-muted">{t('items.gapLetterHint')}</p>
      {missing.length > 0 && <Note tone="red">{t('items.gapMissing', { list: missing.join(', ') })}</Note>}
      <TeilPreview layout={draft.teilType === 'GAP_WORDBANK' ? 'GAP_WORDBANK' : 'GAP_MC'} text={draft.text}
        items={draft.items} showAnswers onGapClick={jumpToItem} />
    </section>
  )
}

/** Sprachbausteine T2: hộp 15 từ a–o, từ đúng của ô nào, từ thừa. */
export function WordBankTable({ draft }: { draft: StudioDraft }) {
  const t = useTranslations('v2.adminContent.examStudio')
  const rows = wordBankRows(draft.text?.wordBank, draft.items)
  const issues = wordBankIssues(rows)
  const dup = new Set(issues.duplicateAnswers)

  return (
    <GaCard className="flex flex-col gap-2 p-4 sm:p-5">
      <h3><GaCap>{t('items.bankTable')}</GaCap></h3>
      {rows.length === 0 && <p className="ga-ui text-ga-small text-ga-muted">{t('items.bankEmpty')}</p>}
      {rows.length > 0 && issues.size !== 15 && <Note tone="red">{t('items.bankSize', { n: issues.size })}</Note>}
      {issues.duplicateAnswers.length > 0 && <Note tone="red">{t('items.bankDuplicate', { list: issues.duplicateAnswers.join(', ') })}</Note>}
      {rows.length > 0 && (
        <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
          {rows.map((r) => (
            <li key={r.letter} className={cn('flex items-baseline gap-2 rounded-ga border px-2.5 py-1.5 text-ga-small',
              dup.has(r.letter) ? 'border-ga-red bg-ga-red-soft' : r.answerFor.length ? 'border-ga-green bg-ga-green-soft' : 'border-ga-line')}>
              <span className="font-semibold text-ga-muted">{r.letter}</span>
              <span className="min-w-0 flex-1 font-semibold text-ga-ink" lang="de">{r.word || '—'}</span>
              <span className="ga-ui text-ga-caption text-ga-muted">
                {r.answerFor.length ? t('items.bankFor', { list: r.answerFor.join(', ') }) : t('items.bankSpare')}
              </span>
            </li>
          ))}
        </ul>
      )}
    </GaCard>
  )
}
