'use client'

import { useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronRight, ListOrdered, Play } from 'lucide-react'
import type { BlueprintSummary, ExamSessionView } from '@/types/exam-speaking'
import { TeilStrategy } from '@/components/exam/strategy/TeilStrategy'
import { StimulusCard } from './StimulusCard'
import { MicCheck } from './MicCheck'

interface Props {
  session: ExamSessionView
  blueprint: BlueprintSummary | null
  notes: string
  onNotesChange: (v: string) => void
  onSaveNotes: () => void
  onChoose: (teilNo: number, index: number) => void
  onEnter: () => void
  busy: boolean
  /** Thi thử mà micro chưa được cho phép trên máy này → kiểm tra lại ngay trong phòng chuẩn bị. */
  micGate: boolean
  onMicPassed: () => void
}

/** Lưu nháp ghi chú sau khi ngừng gõ — đóng tab giữa giờ chuẩn bị không mất ghi chú. */
const NOTES_SAVE_MS = 1500

/**
 * Phòng chuẩn bị (mẫu 07/11/2026): trái là đề từng Teil (chọn 1 trong N nếu có, chiến thuật thu gọn)
 * và ô ghi chú nháp; phải là thứ tự thi + nút "Vào thi ngay". Hết giờ chuẩn bị server tự vào thi.
 */
export function OralPrep({ session, blueprint, notes, onNotesChange, onSaveNotes, onChoose, onEnter, busy, micGate, onMicPassed }: Props) {
  const t = useTranslations('v2.student.examSpeaking.room')
  const materials = session.prepMaterials ?? []
  const mustChoose = materials.some((m) => m.choiceRequired && m.chosenIndex === null)

  const saveRef = useRef(onSaveNotes)
  saveRef.current = onSaveNotes
  const firstRef = useRef(true)
  useEffect(() => {
    if (firstRef.current) {
      firstRef.current = false
      return
    }
    const id = window.setTimeout(() => saveRef.current(), NOTES_SAVE_MS)
    return () => window.clearTimeout(id)
  }, [notes])

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-5 pb-28 lg:grid-cols-[minmax(0,1fr)_320px] lg:pb-0" data-testid="exam-prep">
      <div className="flex min-w-0 flex-col gap-4">
        {materials.length > 0 && (
          <div className="flex flex-col gap-4" data-testid="prep-materials">
            {materials.map((m) => (
              <section key={m.teilNo} className="rounded-ga-touch border border-ga-line bg-ga-card p-4 sm:p-5" aria-labelledby={`prep-teil-${m.teilNo}`}>
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                  <h2 id={`prep-teil-${m.teilNo}`} className="font-ga-display text-ga-h3 text-ga-ink">
                    {t('teilCap', { n: m.teilNo })} · <span lang="de">{m.title}</span>
                  </h2>
                  {m.choiceRequired && (
                    <span className={`ga-ui text-ga-small font-semibold ${m.chosenIndex === null ? 'text-ga-red' : 'text-ga-green'}`}>
                      {m.chosenIndex === null ? t('chooseOne') : t('chosen', { n: (m.chosenIndex ?? 0) + 1 })}
                    </span>
                  )}
                </div>
                <div className={m.choiceRequired ? 'grid gap-3 md:grid-cols-2' : 'flex flex-col gap-3'}>
                  {m.stimuli.map((stim, idx) => (
                    <div key={idx} className="min-w-0">
                      {m.choiceRequired && (
                        <button
                          type="button"
                          onClick={() => onChoose(m.teilNo, idx)}
                          disabled={busy}
                          aria-pressed={m.chosenIndex === idx}
                          className={`ga-ui mb-2 min-h-11 w-full rounded-ga-touch border px-3 text-left text-ga-small font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus ${
                            m.chosenIndex === idx ? 'border-ga-ink bg-ga-ink text-ga-bg' : 'border-ga-line bg-ga-card text-ga-ink hover:bg-ga-side-active'
                          }`}
                          data-testid={`choose-${m.teilNo}-${idx}`}
                        >
                          {t('option', { n: idx + 1 })}
                        </button>
                      )}
                      <StimulusCard stimulus={stim} stepIndex={0} candidateAction="SPEAK" />
                    </div>
                  ))}
                </div>
                {/* LT2: chiến thuật Teil — đọc trong giờ chuẩn bị, thu gọn mặc định. */}
                <div className="mt-3">
                  <TeilStrategy provider={session.provider} level={session.level} section="SPRECHEN" teil={m.teilNo} />
                </div>
              </section>
            ))}
          </div>
        )}
        <div>
          <label htmlFor="prep-notes" className="ga-ui mb-1.5 block text-ga-small font-semibold text-ga-ink">
            {t('oral.prep.notesLabel')}
          </label>
          <textarea
            id="prep-notes"
            lang="de"
            className="min-h-[160px] w-full rounded-ga-touch border border-ga-line bg-ga-card p-3 font-ga-display text-[16px] leading-relaxed text-ga-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus"
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            onBlur={onSaveNotes}
            placeholder={t('notesPlaceholder')}
            data-testid="prep-notes"
          />
          <p className="ga-ui mt-1 text-ga-caption text-ga-muted">{t('oral.prep.notesHint')}</p>
        </div>
      </div>

      <aside className="flex flex-col gap-3 lg:sticky lg:top-0 lg:self-start">
        {blueprint && blueprint.parts.length > 0 && (
          <div className="rounded-ga-touch border border-ga-line bg-ga-card p-4" data-testid="prep-order">
            <h2 className="ga-ui mb-2 flex items-center gap-2 text-ga-body font-semibold text-ga-ink">
              <ListOrdered size={16} aria-hidden /> {t('oral.prep.order')}
            </h2>
            <ol className="flex flex-col divide-y divide-ga-line">
              {blueprint.parts.map((p) => (
                <li key={p.teilNo} className="flex items-center gap-3 py-2">
                  <span className="ga-ui grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ga-side-active text-ga-small font-semibold tabular-nums text-ga-ink">
                    {p.teilNo}
                  </span>
                  <span className="min-w-0">
                    <span lang="de" className="ga-ui block truncate text-ga-small font-semibold text-ga-ink">{p.title}</span>
                    <span className="ga-ui block text-ga-caption text-ga-muted">{t('oral.prep.minutes', { n: Math.max(1, Math.round(p.durationSec / 60)) })}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}
        {micGate && <MicCheck passed={false} onPassed={onMicPassed} />}
        {/* Điện thoại: nút vào thi ghim đáy màn (đề và ghi chú dài, không bắt cuộn hết mới thấy nút). */}
        <div className="fixed inset-x-0 bottom-0 z-10 flex flex-col gap-1.5 border-t border-ga-line bg-ga-card px-4 py-3 lg:static lg:z-auto lg:border-0 lg:bg-transparent lg:p-0">
        <button
          type="button"
          onClick={onEnter}
          disabled={busy || mustChoose || micGate}
          className="ga-ui inline-flex min-h-12 items-center justify-center gap-2 rounded-ga-touch bg-ga-ink px-5 text-ga-body font-semibold text-ga-bg hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus focus-visible:ring-offset-2 disabled:opacity-40"
          data-testid="prep-enter"
        >
          <Play size={16} aria-hidden /> {t('oral.prep.enterNow')} <ChevronRight size={16} aria-hidden className="-ml-1" />
        </button>
        <p className="ga-ui text-ga-small text-ga-muted">{mustChoose ? t('oral.prep.chooseFirst') : t('oral.prep.autoEnter')}</p>
        </div>
      </aside>
    </div>
  )
}
