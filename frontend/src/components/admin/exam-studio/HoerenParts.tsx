'use client'

import type { SyntheticEvent } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, Trash2 } from 'lucide-react'
import type { StudioAudioTurn, StudioDraft, StudioText } from '@/lib/adminExamStudioApi'
import {
  HOEREN_WORD_RANGE, firstItemNumber, hoerenSegmentIndex, itemNumber, trueFalseBalance, type TeilKind,
} from '@/lib/examStudioLogic'
import { GaCap, GaCard } from '@/components/ui-v2'
import { cn } from '@/lib/utils'
import { WordCount } from './TextEditors'
import { CorrectMark, Explanation, type TeilPreviewProps } from './TeilPreview'
import { Note, studioField, studioMiniBtn } from './ui'

// Phần Nghe telc B1 (đợt 5). Không lưu audio: app đọc lời thoại bằng TTS lúc bấm, nên ở Xưởng đề một Teil Nghe
// là lời thoại (StudioText.audioTurns) + mệnh đề richtig/falsch. Ba dạng:
//   HOEREN_STATEMENTS    — T1: câu khung + 5 đoạn, mỗi đoạn một người, mỗi đoạn một câu (41–45);
//   HOEREN_INTERVIEW     — T2: các lượt lời của một cuộc phỏng vấn, 10 câu theo thứ tự bài (46–55);
//   HOEREN_ANNOUNCEMENTS — T3: 5 đoạn, mỗi đoạn có câu dẫn tình huống, mỗi đoạn một câu (56–60).

type Edit = (patch: Partial<StudioText>) => void
type OnSelect = (e: SyntheticEvent<HTMLTextAreaElement>) => void
type HoerenKind = Extract<TeilKind, 'HOEREN_STATEMENTS' | 'HOEREN_INTERVIEW' | 'HOEREN_ANNOUNCEMENTS'>

const areaCls = cn(studioField, 'whitespace-pre-wrap font-mono text-ga-small leading-relaxed')
const VOICES: StudioAudioTurn['speaker'][] = ['PRUEFER', 'PARTNER']
const LEAD_PREFIX = /^Lesen Sie jetzt die Aufgabe \d+\.\s*/

/** Sửa lời thoại theo lượt. Lưu thì máy chủ ghép lại `context` từ các lượt lời. */
export function HoerenEditor({
  kind, text, locked, edit, onSelect, hasItems,
}: { kind: HoerenKind; text: StudioText; locked: boolean; edit: Edit; onSelect: OnSelect; hasItems: boolean }) {
  const t = useTranslations('v2.adminContent.examStudio')
  const turns = text.audioTurns ?? []
  const interview = kind === 'HOEREN_INTERVIEW'
  const range = HOEREN_WORD_RANGE[kind] ?? [0, 9999]
  const first = firstItemNumber(kind, 0)
  const setTurn = (i: number, patch: Partial<StudioAudioTurn>) =>
    edit({ audioTurns: turns.map((x, j) => (j === i ? { ...x, ...patch } : x)) })
  const addTurn = () => {
    const last = turns[turns.length - 1]
    // Lượt mới thuộc người còn lại của cuộc phỏng vấn (đổi giọng, lấy tên người đó ở lượt gần nhất).
    const speaker: StudioAudioTurn['speaker'] = last?.speaker === 'PRUEFER' ? 'PARTNER' : 'PRUEFER'
    const name = [...turns].reverse().find((x) => x.speaker === speaker)?.name ?? ''
    edit({ audioTurns: [...turns, { speaker, name, text: '', leadInDe: null }] })
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="ga-ui text-ga-caption text-ga-muted">{t(`text.hoerenHint.${kind}`, { lo: range[0], hi: range[1] })}</p>

      {kind === 'HOEREN_STATEMENTS' && (
        <div>
          <label htmlFor="hoeren-framing" className="mb-1.5 block"><GaCap>{t('text.hoerenFraming')}</GaCap></label>
          <textarea id="hoeren-framing" lang="de" rows={2} className={studioField} value={text.framingDe ?? ''} disabled={locked}
            onChange={(e) => edit({ framingDe: e.target.value })} />
        </div>
      )}

      {interview && (
        <div className="flex items-baseline justify-between gap-2">
          <GaCap>{t('text.hoerenInterview')}</GaCap>
          <WordCount id="hoeren-total-count" text={turns.map((x) => x.text).join(' ')} range={range} />
        </div>
      )}

      {turns.length === 0 && <p className="ga-ui text-ga-small text-ga-muted">{t('text.hoerenNoTurns')}</p>}

      <ol className="flex flex-col gap-3">
        {turns.map((turn, i) => {
          const id = `hoeren-turn-${i + 1}`
          return (
            <li key={i} className="flex flex-col gap-2 rounded-ga border border-ga-line p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="ga-ui text-ga-small font-semibold text-ga-ink">
                  {interview ? t('text.hoerenTurnN', { n: i + 1 }) : t('text.hoerenSegmentN', { n: i + 1, no: first + i })}
                </span>
                <label className="ga-ui flex items-center gap-1.5 text-ga-caption text-ga-muted">
                  {t('text.hoerenVoice')}
                  <select className="ga-ui min-h-9 rounded-ga border border-ga-line bg-ga-bg px-2 text-ga-caption text-ga-ink disabled:opacity-50"
                    value={turn.speaker} disabled={locked}
                    onChange={(e) => setTurn(i, { speaker: e.target.value as StudioAudioTurn['speaker'] })}>
                    {VOICES.map((v) => <option key={v} value={v}>{t(`text.hoerenVoiceName.${v}`)}</option>)}
                  </select>
                </label>
                {interview && (
                  <input lang="de" className={cn(studioField, 'w-44')} value={turn.name ?? ''} disabled={locked}
                    aria-label={t('text.hoerenNameN', { n: i + 1 })} placeholder={t('text.hoerenNamePh')}
                    onChange={(e) => setTurn(i, { name: e.target.value })} />
                )}
                {!interview && <span className="ml-auto"><WordCount id={`${id}-count`} text={turn.text} range={range} /></span>}
                {interview && (
                  <button type="button" className={cn(studioMiniBtn, 'ml-auto')} disabled={locked}
                    aria-label={t('text.hoerenRemoveTurn', { n: i + 1 })}
                    onClick={() => edit({ audioTurns: turns.filter((_, j) => j !== i) })}>
                    <Trash2 size={13} aria-hidden />
                  </button>
                )}
              </div>
              {kind === 'HOEREN_ANNOUNCEMENTS' && (
                <div>
                  <label htmlFor={`${id}-lead`} className="mb-1 block"><GaCap>{t('text.hoerenLeadIn')}</GaCap></label>
                  <input id={`${id}-lead`} lang="de" className={studioField} value={turn.leadInDe ?? ''} disabled={locked}
                    aria-describedby={`${id}-lead-hint`} onChange={(e) => setTurn(i, { leadInDe: e.target.value })} />
                  <p id={`${id}-lead-hint`} className="ga-ui mt-1 text-ga-caption text-ga-muted">
                    {t('text.hoerenLeadInHint', { no: first + i })}
                  </p>
                </div>
              )}
              <textarea id={id} lang="de" rows={interview ? 3 : 5} className={areaCls} value={turn.text} disabled={locked}
                aria-label={interview ? t('text.hoerenTurnText', { n: i + 1 }) : t('text.hoerenSegmentText', { n: i + 1 })}
                aria-describedby={interview ? undefined : `${id}-count`}
                onChange={(e) => setTurn(i, { text: e.target.value })}
                onSelect={onSelect} onKeyUp={onSelect} onMouseUp={onSelect} />
            </li>
          )
        })}
      </ol>

      {interview && (
        <div>
          <button type="button" className={studioMiniBtn} disabled={locked} onClick={addTurn}>
            <Plus size={13} aria-hidden /> {t('text.hoerenAddTurn')}
          </button>
        </div>
      )}
      {hasItems && (
        <p role="note" className="ga-ui rounded-ga bg-ga-yellow-soft px-3 py-2 text-ga-caption font-semibold text-ga-gold">
          {t('text.hoerenEditWarning')}
        </p>
      )}
    </div>
  )
}

function VoiceLabel({ turn }: { turn: StudioAudioTurn }) {
  const t = useTranslations('v2.adminContent.examStudio')
  return (
    <span className="ga-ui shrink-0 rounded-ga border border-ga-line px-1.5 text-ga-caption font-semibold text-ga-muted" lang="vi">
      {t(`text.hoerenVoiceName.${turn.speaker === 'PARTNER' ? 'PARTNER' : 'PRUEFER'}`)}
    </span>
  )
}

function Statement({ n, item, showAnswers }: { n: number; item: TeilPreviewProps['items'][number]; showAnswers: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="flex flex-wrap items-start gap-2 text-ga-body font-semibold text-ga-ink">
        <span className="w-6 shrink-0 text-ga-muted">{n}</span>
        <span className="min-w-0 flex-1">{item.question}</span>
        <span className="flex shrink-0 items-center gap-1.5">
          {(['richtig', 'falsch'] as const).map((v) => {
            const right = showAnswers && item.correct === v
            return (
              <span key={v} className={cn('rounded-ga border px-2 py-0.5 text-ga-small font-semibold',
                right ? 'border-ga-green bg-ga-green-soft text-ga-green' : 'border-ga-line text-ga-muted')}>
                {v}
              </span>
            )
          })}
          {showAnswers && item.correct && <CorrectMark />}
        </span>
      </p>
      {showAnswers && item.explanationVi && <Explanation text={item.explanationVi} />}
    </div>
  )
}

/**
 * Xem trước phần Nghe. Học viên KHÔNG thấy lời thoại lúc thi (chỉ nghe TTS và đọc mệnh đề) — lời thoại hiện ở đây
 * cho người duyệt, có ghi chú rõ. T1/T3: mỗi đoạn kèm câu của nó; T2: cả cuộc phỏng vấn rồi 10 câu.
 */
export function HoerenPreview({ text, items, showAnswers = true, layout }: TeilPreviewProps) {
  const t = useTranslations('v2.adminContent.examStudio')
  const kind = (layout ?? 'HOEREN_STATEMENTS') as HoerenKind
  const turns = text.audioTurns ?? []
  const first = firstItemNumber(kind, 0)
  const shell = 'flex flex-col gap-5 rounded-ga border border-ga-line bg-ga-card px-4 py-5 sm:px-6'
  const note = <p className="ga-ui text-ga-caption text-ga-muted" lang="vi">{t('preview.hoerenTts')}</p>

  if (kind === 'HOEREN_INTERVIEW') {
    return (
      <article className={shell} lang="de">
        {note}
        {turns.length === 0 && <p className="text-ga-muted" lang="vi">{t('preview.noText')}</p>}
        <div className="flex flex-col gap-2.5">
          {turns.map((turn, i) => (
            <p key={i} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-ga-body-lg text-ga-ink">
              <VoiceLabel turn={turn} />
              <span className="font-semibold">{turn.name || '—'}:</span>
              <span className="min-w-0 flex-1 basis-64 whitespace-pre-line">{turn.text}</span>
            </p>
          ))}
        </div>
        {items.length > 0 && (
          <ol className="flex flex-col gap-3 border-t border-ga-line pt-4">
            {items.map((it, i) => <li key={it.id}><Statement n={itemNumber(it.id, first + i)} item={it} showAnswers={showAnswers} /></li>)}
          </ol>
        )}
      </article>
    )
  }

  const byIndex = new Map(items.map((it, i) => [hoerenSegmentIndex(it.id, first, i), it] as const))
  return (
    <article className={shell} lang="de">
      {note}
      {kind === 'HOEREN_STATEMENTS' && text.framingDe && <p className="text-ga-body-lg font-semibold text-ga-ink">{text.framingDe}</p>}
      {turns.length === 0 && <p className="text-ga-muted" lang="vi">{t('preview.noText')}</p>}
      <ol className="flex flex-col gap-4">
        {turns.map((turn, i) => {
          const it = byIndex.get(i)
          const lead = turn.leadInDe?.trim()
          return (
            <li key={i} className="flex flex-col gap-1.5 border-t border-ga-line pt-3 first:border-t-0 first:pt-0">
              {kind === 'HOEREN_ANNOUNCEMENTS' && lead && (
                <p className="text-ga-small italic text-ga-muted">
                  {LEAD_PREFIX.test(lead) ? lead : `Lesen Sie jetzt die Aufgabe ${first + i}. ${lead}`}
                </p>
              )}
              <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-ga-body-lg text-ga-ink">
                <VoiceLabel turn={turn} />
                <span className="min-w-0 flex-1 basis-64 whitespace-pre-line">{turn.text}</span>
              </p>
              {it && <Statement n={itemNumber(it.id, first + i)} item={it} showAnswers={showAnswers} />}
            </li>
          )
        })}
      </ol>
    </article>
  )
}

/** Bước Câu hỏi: đếm richtig/falsch của Teil Nghe (mỗi loại 40–60 %; mọi câu cùng một đáp án thì chặn duyệt). */
export function HoerenAnswerSummary({ draft }: { draft: StudioDraft }) {
  const t = useTranslations('v2.adminContent.examStudio')
  const b = trueFalseBalance(draft.items)
  const oneSided = draft.items.length > 1 && (b.richtig === 0 || b.falsch === 0)
  return (
    <GaCard className="flex flex-col gap-2 p-4 sm:p-5">
      <h3><GaCap>{t('items.tfTitle')}</GaCap></h3>
      <p className={cn('ga-ui text-ga-small font-semibold', b.balanced ? 'text-ga-green' : oneSided ? 'text-ga-red' : 'text-ga-gold')}>
        {t('items.tfCount', { richtig: b.richtig, falsch: b.falsch })}
      </p>
      {!b.balanced && <Note tone={oneSided ? 'red' : 'yellow'}>{t(oneSided ? 'items.hoerenOneSided' : 'items.hoerenUnbalanced')}</Note>}
    </GaCard>
  )
}

/** Đoạn lời thoại của một câu Hören T1/T3 (hiện trong thẻ câu ở bước Câu hỏi). */
export function hoerenSegmentOf(draft: Pick<StudioDraft, 'text' | 'teil'>, kind: TeilKind, itemId: string, index: number): StudioAudioTurn | null {
  if (kind !== 'HOEREN_STATEMENTS' && kind !== 'HOEREN_ANNOUNCEMENTS') return null
  return draft.text?.audioTurns?.[hoerenSegmentIndex(itemId, firstItemNumber(kind, draft.teil), index)] ?? null
}
