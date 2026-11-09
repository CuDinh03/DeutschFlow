'use client'

import type { SyntheticEvent } from 'react'
import { useTranslations } from 'next-intl'
import type { OptionKey, StudioText } from '@/lib/adminExamStudioApi'
import {
  AD_LETTERS, AD_WORD_RANGE, EMAIL_WORD_RANGE, WRITING_POINT_COUNT, countWords, inWordRange,
} from '@/lib/examStudioLogic'
import { GaCap } from '@/components/ui-v2'
import { cn } from '@/lib/utils'
import { studioField } from './ui'

// Ô sửa bài cho các Teil soạn theo tình huống (đợt 3). Mọi ô sửa thẳng một khoá của `StudioText`;
// StepText lưu cả object để không mất khoá khác (backend ghi đè nguyên `text`).

type Edit = (patch: Partial<StudioText>) => void
type OnSelect = (e: SyntheticEvent<HTMLTextAreaElement>) => void

const areaCls = cn(studioField, 'whitespace-pre-wrap font-mono text-ga-small leading-relaxed')

/** Nhãn số từ: xanh khi trong khoảng, vàng khi ngoài. */
export function WordCount({ id, text, range }: { id: string; text: string; range: [number, number] }) {
  const t = useTranslations('v2.adminContent.examStudio')
  const ok = inWordRange(text, range)
  return (
    <span id={id} className={cn('ga-ui rounded-ga px-1.5 text-ga-caption font-semibold',
      ok ? 'text-ga-green' : 'bg-ga-yellow-soft text-ga-gold')}>
      {t('text.matchWords', { n: countWords(text), lo: range[0], hi: range[1] })}
    </span>
  )
}

/** Lesen T3: 12 mẩu rao vặt a–l (15–45 từ mỗi mẩu) + 2 ví dụ (01 ghép được một mẩu, 02 = x). */
export function AdsEditor({ text, locked, edit, onSelect }: { text: StudioText; locked: boolean; edit: Edit; onSelect: OnSelect }) {
  const t = useTranslations('v2.adminContent.examStudio')
  const ads = text.ads ?? {}
  const examples = text.examples ?? []
  const setAd = (k: string, v: string) => edit({ ads: { ...ads, [k]: v } })
  const setEx = (i: number, patch: Partial<{ situation: string; answer: string }>) =>
    edit({ examples: examples.map((e, j) => (j === i ? { ...e, ...patch } : e)) })

  return (
    <div className="flex flex-col gap-4">
      <p className="ga-ui text-ga-caption text-ga-muted">{t('text.adsHint', { lo: AD_WORD_RANGE[0], hi: AD_WORD_RANGE[1] })}</p>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {AD_LETTERS.map((k) => {
          const id = `ad-${k}`
          const value = ads[k as OptionKey] ?? ''
          return (
            <div key={k}>
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <label htmlFor={id}><GaCap>{t('text.adN', { k })}</GaCap></label>
                <WordCount id={`${id}-count`} text={value} range={AD_WORD_RANGE} />
              </div>
              <textarea id={id} lang="de" rows={3} className={areaCls} value={value} disabled={locked}
                aria-describedby={`${id}-count`} onChange={(e) => setAd(k, e.target.value)}
                onSelect={onSelect} onKeyUp={onSelect} onMouseUp={onSelect} />
            </div>
          )
        })}
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1"><GaCap>{t('text.examples')}</GaCap></legend>
        {examples.length === 0 && <p className="ga-ui text-ga-small text-ga-muted">{t('text.noExamples')}</p>}
        {examples.map((e, i) => (
          <div key={e.label || i} className="grid grid-cols-1 gap-2 sm:grid-cols-[48px_minmax(0,1fr)_96px] sm:items-center">
            <span className="ga-ui text-ga-small font-semibold text-ga-ink">{e.label}</span>
            <input lang="de" className={studioField} value={e.situation} disabled={locked}
              aria-label={t('text.exampleSituation', { label: e.label })}
              onChange={(ev) => setEx(i, { situation: ev.target.value })} />
            <select className={studioField} value={e.answer} disabled={locked}
              aria-label={t('text.exampleAnswer', { label: e.label })}
              onChange={(ev) => setEx(i, { answer: ev.target.value })}>
              {[...AD_LETTERS, 'x'].map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
        ))}
      </fieldset>
    </div>
  )
}

/** Sprachbausteine: bức thư NGUYÊN VẸN (SB2 thêm mẩu tin mà thư trả lời). */
export function LetterEditor({
  text, locked, edit, onSelect, withAd, hasItems,
}: { text: StudioText; locked: boolean; edit: Edit; onSelect: OnSelect; withAd: boolean; hasItems: boolean }) {
  const t = useTranslations('v2.adminContent.examStudio')
  return (
    <div className="flex flex-col gap-3">
      {withAd && (
        <div>
          <label htmlFor="text-stimulus-ad" className="mb-1.5 block"><GaCap>{t('text.stimulusAd')}</GaCap></label>
          <textarea id="text-stimulus-ad" lang="de" rows={4} className={areaCls} value={text.stimulusAd ?? ''}
            disabled={locked} onChange={(e) => edit({ stimulusAd: e.target.value })}
            onSelect={onSelect} onKeyUp={onSelect} onMouseUp={onSelect} />
        </div>
      )}
      <div>
        <label htmlFor="text-letter" className="mb-1.5 block"><GaCap>{t('text.letter')}</GaCap></label>
        <textarea id="text-letter" lang="de" rows={16} className={areaCls} value={text.context} disabled={locked}
          aria-describedby="text-letter-hint" onChange={(e) => edit({ context: e.target.value })}
          onSelect={onSelect} onKeyUp={onSelect} onMouseUp={onSelect} />
        <p id="text-letter-hint" className="ga-ui mt-1 text-ga-caption text-ga-muted">{t('text.letterHint')}</p>
      </div>
      {hasItems && (
        <p role="note" className="ga-ui rounded-ga bg-ga-yellow-soft px-3 py-2 text-ga-caption font-semibold text-ga-gold">
          {t('text.letterEditWarning')}
        </p>
      )}
    </div>
  )
}

/** Schreiben: E-Mail của bạn (from, subject, body 70–130 từ) + đúng 4 Leitpunkte. */
export function EmailEditor({ text, locked, edit, onSelect }: { text: StudioText; locked: boolean; edit: Edit; onSelect: OnSelect }) {
  const t = useTranslations('v2.adminContent.examStudio')
  const st = text.stimulus ?? { type: 'EMAIL', from: '', subject: '', body: '' }
  const points = Array.from({ length: WRITING_POINT_COUNT }, (_, i) => text.writingPoints?.[i] ?? '')
  const setSt = (patch: Partial<typeof st>) => edit({ stimulus: { ...st, ...patch } })

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="mail-from" className="mb-1.5 block"><GaCap>{t('text.mailFrom')}</GaCap></label>
          <input id="mail-from" lang="de" className={studioField} value={st.from} disabled={locked}
            onChange={(e) => setSt({ from: e.target.value })} />
        </div>
        <div>
          <label htmlFor="mail-subject" className="mb-1.5 block"><GaCap>{t('text.mailSubject')}</GaCap></label>
          <input id="mail-subject" lang="de" className={studioField} value={st.subject} disabled={locked}
            onChange={(e) => setSt({ subject: e.target.value })} />
        </div>
      </div>
      <div>
        <div className="mb-1.5 flex items-baseline justify-between gap-2">
          <label htmlFor="mail-body"><GaCap>{t('text.mailBody')}</GaCap></label>
          <WordCount id="mail-body-count" text={st.body} range={EMAIL_WORD_RANGE} />
        </div>
        <textarea id="mail-body" lang="de" rows={10} className={areaCls} value={st.body} disabled={locked}
          aria-describedby="mail-body-count" onChange={(e) => setSt({ body: e.target.value })}
          onSelect={onSelect} onKeyUp={onSelect} onMouseUp={onSelect} />
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1"><GaCap>{t('text.writingPoints')}</GaCap></legend>
        {points.map((p, i) => (
          <input key={i} lang="de" className={studioField} value={p} disabled={locked}
            aria-label={t('text.writingPointN', { n: i + 1 })}
            onChange={(e) => edit({ writingPoints: points.map((x, j) => (j === i ? e.target.value : x)) })} />
        ))}
      </fieldset>
    </div>
  )
}
