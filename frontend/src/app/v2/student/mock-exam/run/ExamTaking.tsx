'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { AlertCircle, ChevronRight, Clock, Loader2, Send } from 'lucide-react'
import { AudioPlayer } from '@/components/exam/AudioPlayer'
import { ExamProgressBar } from '@/components/exam/ExamProgressBar'
import { SprechenTeil2Simulator } from '@/components/exam/SprechenTeil2Simulator'

// Taking view of the mock-exam runner, ported 1:1 from the legacy /student/mock-exam page
// (same exam JSON shape, same answer keys, same widget-selection rule) with a Galerie shell.
// The exam-domain widgets (AudioPlayer · ExamProgressBar · SprechenTeil2Simulator) are the
// SHARED components the legacy page already used — reused, not copied.

// ─── Exam data types (shape of mock_exams.sections_json) ─────────────────────

export interface ExamQuestionItem {
  id: string
  question?: string
  text?: string
  person?: string
  audio_script?: string
  options?: Record<string, string>
  /**
   * Non-revealing question type sent by the backend so we can pick the answer widget
   * without the correct answer. Preferred over `correct` (see answerWidget).
   */
  type?: 'MULTIPLE_CHOICE' | 'RICHTIG_FALSCH' | 'MATCHING' | 'UNKNOWN' | string
  /**
   * Legacy correct answer. The backend no longer sends this for in-progress exams
   * (it was an answer leak); kept only as a fallback for older API responses.
   */
  correct?: string
}

export interface ExamTeil {
  teil: number
  instruction_vi?: string
  instruction_de?: string
  context?: string
  audio_script?: string
  items?: ExamQuestionItem[]
  form_fields?: Array<{ field: string; instruction_vi: string }>
  input_email?: string
  writing_points?: string[]
  prompt_words?: string[]
  topic_cards?: string[]
}

export interface ExamSection {
  name: string
  label_vi: string
  time_minutes: number
  max_points: number
  teile?: ExamTeil[]
}

export interface ActiveExamData {
  sections: ExamSection[]
}

/** Section accent — Galerie palette (legacy used its own indigo/sky/emerald/amber set). */
export const SECTION_COLOR: Record<string, string> = {
  LESEN: 'var(--ga-violet)',
  HOEREN: 'var(--ga-blue)',
  SCHREIBEN: 'var(--ga-green)',
  SPRECHEN: 'var(--ga-orange)',
}

export const MATCHING_OPTIONS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const

/**
 * Which answer widget to render for a question. Prefers the backend-provided `type`
 * (which carries no answer key); falls back to the legacy `correct`-based detection so
 * the runner still works against an older API response that hasn't dropped `correct` yet.
 */
export function answerWidget(item: ExamQuestionItem): 'MULTIPLE_CHOICE' | 'RICHTIG_FALSCH' | 'MATCHING' | null {
  if (item.options && Object.keys(item.options).length > 0) return 'MULTIPLE_CHOICE'
  if (item.type === 'MULTIPLE_CHOICE') return 'MULTIPLE_CHOICE'
  if (item.type === 'RICHTIG_FALSCH') return 'RICHTIG_FALSCH'
  if (item.type === 'MATCHING') return 'MATCHING'
  if (!item.type && item.correct) {
    const c = String(item.correct).toLowerCase()
    if (c === 'richtig' || c === 'falsch') return 'RICHTIG_FALSCH'
    if (String(item.correct).length === 1) return 'MATCHING'
  }
  return null
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s < 10 ? '0' : ''}${s}`
}

/**
 * Always-clickable recovery UI shown inside the full-screen exam shell whenever the
 * taking view cannot render its content — so the `fixed inset-0` overlay can never
 * become a blank, unclickable screen.
 */
export function ExamRecoveryPanel({
  title,
  message,
  onRetry,
  onSubmit,
  onExit,
  submitting,
}: {
  title: string
  message: string
  onRetry?: () => void
  onSubmit?: () => void
  onExit: () => void
  submitting?: boolean
}) {
  const t = useTranslations('v2.student.mockExamRun')
  return (
    <div className="flex h-full min-h-screen items-center justify-center bg-ga-surface p-4">
      <div className="w-full max-w-md space-y-4 rounded-ga border border-ga-line bg-ga-card p-6 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-ga-pill bg-ga-red-soft" aria-hidden>
          <AlertCircle size={24} className="text-ga-red" />
        </div>
        <h2 className="font-ga-display text-[20px] font-medium text-ga-ink">{title}</h2>
        <p className="ga-ui text-[13px] text-ga-muted">{message}</p>
        <div className="flex flex-col gap-2 pt-1">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="ga-ui w-full rounded-ga bg-ga-accent py-2.5 text-[13px] font-semibold text-ga-accent-ink transition-opacity hover:opacity-90"
            >
              {t('retry')}
            </button>
          )}
          {onSubmit && (
            <button
              type="button"
              onClick={onSubmit}
              disabled={submitting}
              className="ga-ui w-full rounded-ga py-2.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{ background: 'var(--ga-green)' }}
            >
              {submitting ? t('submitting') : t('submitNow')}
            </button>
          )}
          <button
            type="button"
            onClick={onExit}
            className="ga-ui w-full rounded-ga border border-ga-line bg-ga-card py-2.5 text-[13px] font-semibold text-ga-muted transition-colors hover:bg-ga-surface"
          >
            {t('exitToList')}
          </button>
        </div>
      </div>
    </div>
  )
}

export interface ExamTakingProps {
  data: ActiveExamData | null
  currentSectionIdx: number
  onSectionChange: (idx: number) => void
  answers: Record<string, string>
  onAnswerChange: (questionId: string, value: string) => void
  timeLeft: number
  submitting: boolean
  /** `auto = true` skips the confirm dialog (timer expiry / recovery panel). */
  onSubmit: (auto: boolean) => void
  onExit: () => void
  answeredCount: number
  totalQuestions: number
}

export function ExamTaking({
  data,
  currentSectionIdx,
  onSectionChange,
  answers,
  onAnswerChange,
  timeLeft,
  submitting,
  onSubmit,
  onExit,
  answeredCount,
  totalQuestions,
}: ExamTakingProps) {
  const t = useTranslations('v2.student.mockExamRun')

  if (!data?.sections || data.sections.length === 0) {
    return <ExamRecoveryPanel title={t('recoveryNoContentTitle')} message={t('recoveryNoContentDesc')} onExit={onExit} />
  }

  // Guard against an out-of-range section index (e.g. a stale/raced nav state) so we
  // never throw on `currentSection.name` and blank the whole exam.
  const currentSection = data.sections[currentSectionIdx]
  if (!currentSection) {
    return (
      <ExamRecoveryPanel
        title={t('recoverySectionTitle')}
        message={t('recoverySectionDesc')}
        onRetry={() => onSectionChange(0)}
        onSubmit={() => onSubmit(true)}
        onExit={onExit}
        submitting={submitting}
      />
    )
  }

  const accent = SECTION_COLOR[currentSection.name] ?? 'var(--ga-accent)'
  const isLastSection = currentSectionIdx >= data.sections.length - 1

  return (
    <div className="flex h-full flex-col bg-ga-bg">
      {/* Top bar — timer + submit */}
      <div className="z-10 flex items-center justify-between border-b border-ga-line bg-ga-card px-6 py-4">
        <div className="flex items-center gap-4">
          <h2 className="font-ga-display text-[20px] font-medium text-ga-ink">
            <span style={{ color: accent }}>{currentSection.name}</span> — {currentSection.label_vi}
          </h2>
          <div className="hidden gap-2 sm:flex">
            {data.sections.map((s, idx) => (
              <span
                key={s.name ?? idx}
                title={s.label_vi}
                aria-hidden
                className={`h-2.5 w-2.5 rounded-full transition-all ${
                  idx === currentSectionIdx
                    ? 'scale-125 bg-ga-accent'
                    : idx < currentSectionIdx
                      ? 'bg-ga-muted'
                      : 'bg-ga-border'
                }`}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* < 5 min left = the visual warning the legacy runner had */}
          <div
            className={`flex items-center gap-2 font-mono text-[20px] font-bold ${
              timeLeft < 300 ? 'animate-pulse text-ga-red' : 'text-ga-ink'
            }`}
          >
            <Clock size={20} aria-hidden />
            {formatTime(timeLeft)}
          </div>
          <button
            type="button"
            onClick={() => onSubmit(false)}
            disabled={submitting}
            className="ga-ui inline-flex items-center gap-2 rounded-ga px-4 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ background: 'var(--ga-green)' }}
          >
            {submitting ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Send size={16} aria-hidden />}
            {t('submit')}
          </button>
        </div>
      </div>

      <ExamProgressBar
        sections={data.sections.map((s) => ({ name: s.name, label_vi: s.label_vi }))}
        currentSectionIdx={currentSectionIdx}
        answeredCount={answeredCount}
        totalQuestions={totalQuestions}
      />

      {/* min-h-0 is REQUIRED: without it a flex child defaults to min-height:auto and refuses to
          shrink below its content height, so the exam content overflows the `fixed inset-0` shell
          instead of scrolling here. The shell's overflow-hidden only clips visually — focusing a
          below-the-fold answer (the Richtig/Falsch & Matching inputs are `sr-only`) then makes the
          browser scroll the shell to reveal the input, pushing all content off-screen and leaving a
          blank overlay. */}
      <div className="min-h-0 flex-1 overflow-y-auto bg-ga-surface p-6">
        <div className="mx-auto max-w-4xl space-y-8 pb-20">
          <div className="rounded-ga border border-ga-line bg-ga-card p-6">
            <h3 className="font-ga-display text-[22px] font-medium text-ga-ink">
              {currentSection.name} — {currentSection.label_vi}
            </h3>
            <p className="ga-ui mt-1 text-[13px] text-ga-muted">
              {t('sectionMeta', { minutes: currentSection.time_minutes, points: currentSection.max_points })}
            </p>
          </div>

          {currentSection.teile?.map((teil, tIdx) => (
            <div key={teil.teil ?? tIdx} className="overflow-hidden rounded-ga border border-ga-line bg-ga-card">
              <div className="border-b border-ga-border bg-ga-surface px-6 py-3">
                <h4 className="ga-ui text-[14px] font-semibold text-ga-ink">{t('teil', { n: teil.teil })}</h4>
                <p className="ga-ui mt-1 text-[13px] text-ga-muted">{teil.instruction_vi || teil.instruction_de}</p>
              </div>

              <div className="p-6">
                {teil.context && (
                  <div className="ga-ui mb-6 whitespace-pre-wrap rounded-ga border border-ga-line bg-ga-surface p-4 text-[13.5px] text-ga-ink">
                    {teil.context}
                  </div>
                )}
                {teil.audio_script && (
                  <AudioPlayer script={teil.audio_script} label={t('hoertext', { n: teil.teil })} />
                )}

                <div className="space-y-6">
                  {teil.items?.map((item, qIdx) => {
                    const widget = answerWidget(item)
                    return (
                      <div
                        key={item.id ?? `${tIdx}-${qIdx}`}
                        className="border-b border-ga-border pb-6 last:border-0 last:pb-0"
                      >
                        {item.audio_script && (
                          <AudioPlayer
                            script={item.audio_script}
                            compact
                            label={item.person ? t('listenPerson', { person: item.person }) : t('listenDialog')}
                          />
                        )}
                        {item.text && <p className="ga-ui mb-3 text-[13.5px] italic text-ga-muted">“{item.text}”</p>}
                        {item.person && <p className="ga-ui mb-3 text-[13.5px] text-ga-muted">👤 {item.person}</p>}

                        <p className="ga-ui mb-3 text-[14.5px] font-semibold text-ga-ink">
                          {qIdx + 1}. {item.question || t('questionFallback')}
                        </p>

                        {item.options && (
                          <div className="space-y-2">
                            {Object.entries(item.options).map(([optKey, optVal]) => {
                              const picked = answers[item.id] === optKey
                              return (
                                <label
                                  key={optKey}
                                  className={`flex cursor-pointer items-center gap-3 rounded-ga border px-3 py-3 transition-colors ${
                                    picked ? 'border-ga-accent bg-ga-accent-soft' : 'border-ga-line bg-ga-card hover:bg-ga-surface'
                                  }`}
                                >
                                  <input
                                    type="radio"
                                    name={item.id}
                                    value={optKey}
                                    checked={picked}
                                    onChange={() => onAnswerChange(item.id, optKey)}
                                    className="h-4 w-4 accent-[var(--ga-accent)]"
                                  />
                                  <span className="ga-ui w-6 text-[13px] font-bold text-ga-subtle">{optKey}</span>
                                  <span className="ga-ui text-[14px] text-ga-ink">{optVal}</span>
                                </label>
                              )
                            })}
                          </div>
                        )}

                        {widget === 'RICHTIG_FALSCH' && (
                          <div className="flex gap-4">
                            {['richtig', 'falsch'].map((opt) => {
                              const picked = answers[item.id] === opt
                              return (
                                <label
                                  key={opt}
                                  className={`ga-ui flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-ga border py-3 text-[13px] font-semibold transition-colors ${
                                    picked
                                      ? 'border-ga-accent bg-ga-accent-soft text-ga-accent'
                                      : 'border-ga-line bg-ga-card text-ga-muted hover:bg-ga-surface'
                                  }`}
                                >
                                  <input
                                    type="radio"
                                    name={item.id}
                                    value={opt}
                                    checked={picked}
                                    onChange={() => onAnswerChange(item.id, opt)}
                                    className="sr-only"
                                  />
                                  {opt.toUpperCase()}
                                </label>
                              )
                            })}
                          </div>
                        )}

                        {widget === 'MATCHING' && (
                          <div className="flex flex-wrap gap-2">
                            {MATCHING_OPTIONS.map((opt) => {
                              const picked = answers[item.id] === opt
                              return (
                                <label
                                  key={opt}
                                  className={`ga-ui grid h-12 w-12 cursor-pointer place-items-center rounded-ga border text-[14px] font-bold transition-colors ${
                                    picked
                                      ? 'border-ga-accent bg-ga-accent text-ga-accent-ink'
                                      : 'border-ga-line bg-ga-card text-ga-muted hover:bg-ga-surface'
                                  }`}
                                >
                                  <input
                                    type="radio"
                                    name={item.id}
                                    value={opt}
                                    checked={picked}
                                    onChange={() => onAnswerChange(item.id, opt)}
                                    className="sr-only"
                                  />
                                  {opt}
                                </label>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {/* Schreiben Teil 1 — form fields. Answer keys stay `form_<index>` (server contract). */}
                  {teil.form_fields && (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      {teil.form_fields.map((field, fIdx) => (
                        <div key={field.field ?? fIdx}>
                          <label className="ga-ui mb-1 block text-[12px] font-bold text-ga-muted">
                            {field.field}{' '}
                            <span className="font-normal text-ga-subtle">({field.instruction_vi})</span>
                          </label>
                          <input
                            type="text"
                            value={answers[`form_${fIdx}`] || ''}
                            onChange={(e) => onAnswerChange(`form_${fIdx}`, e.target.value)}
                            placeholder={t('formPlaceholder')}
                            className="ga-ui w-full rounded-ga border border-ga-line bg-ga-card px-3 py-2 text-[14px] text-ga-ink outline-none focus:border-ga-accent"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Schreiben Teil 2 — email. Answer key stays `email_<teil>` (server contract). */}
                  {teil.input_email && (
                    <div className="space-y-4">
                      <div className="ga-ui whitespace-pre-wrap rounded-ga border border-ga-line bg-ga-surface p-4 text-[13.5px] text-ga-ink">
                        {teil.input_email}
                      </div>
                      <ul className="ga-ui mb-4 list-disc space-y-1 pl-5 text-[13.5px] text-ga-muted">
                        {teil.writing_points?.map((pt, idx) => <li key={idx}>{pt}</li>)}
                      </ul>
                      <textarea
                        value={answers[`email_${teil.teil}`] || ''}
                        onChange={(e) => onAnswerChange(`email_${teil.teil}`, e.target.value)}
                        placeholder={t('emailPlaceholder')}
                        className="ga-ui h-40 w-full resize-none rounded-ga border border-ga-line bg-ga-card px-4 py-3 text-[14px] text-ga-ink outline-none focus:border-ga-accent"
                      />
                    </div>
                  )}

                  {/* Sprechen — answer key stays `sprechen_score_<teil>` (server contract). */}
                  {teil.prompt_words && (
                    <div className="space-y-4">
                      <div className="mb-4 flex flex-wrap gap-2">
                        {teil.prompt_words.map((word, wIdx) => (
                          <span
                            key={wIdx}
                            className="ga-ui rounded-ga px-3 py-1.5 text-[13px] font-bold"
                            style={{ background: 'var(--ga-orange-soft)', color: 'var(--ga-orange)' }}
                          >
                            {word}
                          </span>
                        ))}
                      </div>
                      <SprechenTeil2Simulator
                        onFinish={(score) => onAnswerChange(`sprechen_score_${teil.teil}`, String(score))}
                      />
                    </div>
                  )}

                  {teil.topic_cards && (
                    <div className="space-y-4">
                      <SprechenTeil2Simulator
                        onFinish={(score) => onAnswerChange(`sprechen_score_${teil.teil}`, String(score))}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          <div className="flex items-center justify-between pt-4">
            <button
              type="button"
              onClick={() => onSectionChange(Math.max(0, currentSectionIdx - 1))}
              disabled={currentSectionIdx === 0}
              className="ga-ui rounded-ga border border-ga-line bg-ga-card px-6 py-3 text-[13px] font-semibold text-ga-muted transition-colors hover:bg-ga-surface disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t('prevSection')}
            </button>

            {!isLastSection ? (
              <button
                type="button"
                onClick={() => onSectionChange(Math.min(data.sections.length - 1, currentSectionIdx + 1))}
                className="ga-ui inline-flex items-center gap-2 rounded-ga bg-ga-accent px-6 py-3 text-[13px] font-semibold text-ga-accent-ink transition-opacity hover:opacity-90"
              >
                {t('nextSection')} <ChevronRight size={18} aria-hidden />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onSubmit(false)}
                disabled={submitting}
                className="ga-ui inline-flex items-center gap-2 rounded-ga px-8 py-3 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                style={{ background: 'var(--ga-green)' }}
              >
                {submitting ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <Send size={18} aria-hidden />}
                {t('submitAll')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
