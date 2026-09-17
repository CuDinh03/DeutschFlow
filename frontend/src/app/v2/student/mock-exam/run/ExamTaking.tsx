'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { AlertCircle, ChevronRight, Loader2, Send, User } from 'lucide-react'
import { AudioPlayer } from '@/components/exam/AudioPlayer'
import { SprechenTeil2Simulator } from '@/components/exam/SprechenTeil2Simulator'
import { TelcTeilBody } from '@/components/exam/telc/TelcTeilBody'
import { telcTeilType } from '@/components/exam/telc/telcTeil'
import { DialogueAudioPlayer } from '@/components/exam/DialogueAudioPlayer'
import { HoerenGate } from '@/components/exam/HoerenGate'
import { ReadingPassage, isRichPassage } from '@/components/exam/telc/ReadingPassage'
import {
  isDialogueScript,
  isHoerenUnlocked,
  itemTurns,
  needsPersonaVoice,
  parseHoerenGate,
  scriptToPlainText,
  type AudioScript,
  type HoerenGatePhase,
} from '@/components/exam/audioScript'

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
  audio_script?: AudioScript
  /** Câu dẫn tình huống đọc trước bài (HV Teil 3 telc): „Im Radio hören Sie folgenden Hinweis." */
  lead_in_de?: string
  /** Giọng của người nói bài này (HV Teil 1 telc: năm người, nam nữ xen kẽ). */
  speaker?: string
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
  /**
   * Bài đọc dài kiểu đề thật (LV Teil 2 telc, 17/09/2026): tiêu đề, Vorspann in đậm, thân bài
   * đánh số dòng mỗi 5 dòng, chú thích từ khó cuối bài. Đề không khai ⇒ `context` dựng như cũ.
   */
  title_de?: string
  vorspann_de?: string
  context_lines?: boolean
  glossary?: Array<{ term: string; explanation_de: string }>
  audio_script?: AudioScript
  /** Số lần được phép nghe (telc: 1 ở HV Teil 1, 2 ở Teil 2–3). Bỏ trống = không giới hạn. */
  max_plays?: number
  /**
   * Nghi thức bài nghe telc (17/09/2026): Ansage nguyên văn, giây đọc câu hỏi trước khi phát
   * (30 / 60 / 0), câu khung của Teil 1. Đề không khai ⇒ không có cổng, phát ngay như trước.
   */
  ansage_de?: string
  reading_seconds?: number
  framing_de?: string
  items?: ExamQuestionItem[]
  form_fields?: Array<{ field: string; instruction_vi: string }>
  /** Đề bài phần Viết/Nói của các đề B1+ (seed dùng `prompt` thay cho `input_email`). */
  prompt?: string
  input_email?: string
  writing_points?: string[]
  prompt_words?: string[]
  /** Thẻ chủ đề phần Nói (seed A1/A2): trước đây chỉ dùng để bật simulator, nội dung không hiện. */
  topic_cards?: Array<{ card?: string; question_to_ask?: string }>
  /** Thẻ tình huống phần Nói Teil 3 của seed A1 — không có nhánh render nên Teil 3 ra ô trống. */
  scenario_cards?: Array<{ situation?: string; request?: string }>
  /**
   * Dạng bài ở cấp Teil. Đề telc khai bốn dạng riêng (`MATCH_HEADLINE`, `MATCH_AD_X`, `GAP_MC`,
   * `GAP_WORDBANK`) mà `answerWidget` KHÔNG suy ra được từ hình dạng câu hỏi — xem
   * `components/exam/telc/telcTeil.ts`.
   */
  type?: string
  headlines?: Record<string, string>
  ads?: Record<string, string>
  word_bank?: Record<string, string>
  gapped_text?: string
  single_use?: boolean
  allow_none?: boolean
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
  // Phần riêng của telc; thiếu màu ở đây là dải trên của phần này ra màu mặc định không tên.
  SPRACHBAUSTEINE: 'var(--ga-teal)',
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
  submitting: boolean
  /** `auto = true` skips the confirm dialog (timer expiry / recovery panel). */
  onSubmit: (auto: boolean) => void
  onExit: () => void
}

/**
 * Nội dung câu hỏi của phiên thi. Từ S-09 đây CHỈ còn nội dung: đồng hồ, tiến độ, trạng thái lưu
 * và nút thoát đã chuyển hết lên `ExamShell` — hai nơi cùng vẽ chrome thì chúng sẽ trôi khỏi nhau,
 * và vỏ mới là chỗ duy nhất chịu trách nhiệm về hợp đồng "không XP/streak/nav/animation".
 */
export function ExamTaking({
  data,
  currentSectionIdx,
  onSectionChange,
  answers,
  onAnswerChange,
  submitting,
  onSubmit,
  onExit,
}: ExamTakingProps) {
  const t = useTranslations('v2.student.mockExamRun')
  // Pha của cổng nghi thức từng Teil nghe — khoá theo phần + số Teil, sống suốt bài thi để đổi
  // phần rồi quay lại không được "mở đề lần nữa" (đề thật không có nút quay lại).
  const [gatePhases, setGatePhases] = React.useState<Record<string, HoerenGatePhase>>({})

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

  const isLastSection = currentSectionIdx >= data.sections.length - 1

  return (
    <div className="space-y-7">
      {/* Vỏ đã in tên phần ở dải trên — ở đây chỉ còn phần thông tin vỏ không mang: thời lượng
          và điểm tối đa của phần này. */}
      <p className="ga-ui text-ga-caption text-ga-muted">
        {t('sectionMeta', { minutes: currentSection.time_minutes, points: currentSection.max_points })}
      </p>

      {currentSection.teile?.map((teil, tIdx) => {
        // Đề bài của một Teil viết: seed A1/A2 dùng `input_email`, seed B1+ dùng `prompt`.
        // Thiếu nhánh `prompt` là phần Viết của đề B1/B2 không có ô nhập nào để gõ.
        const writingStimulus =
          currentSection.name === 'SCHREIBEN' && !teil.form_fields
            ? teil.input_email ?? teil.prompt
            : teil.input_email
        const speakingPrompt =
          currentSection.name === 'SPRECHEN' && !teil.prompt_words && !teil.topic_cards
            ? teil.prompt
            : undefined
        // Cổng nghi thức (đề telc): Ansage → đọc câu hỏi → nghe được. Đề Goethe không khai ⇒ null.
        const gate = parseHoerenGate(teil)
        const gateKey = `${currentSection.name}-${teil.teil ?? tIdx}`
        const gatePhase: HoerenGatePhase | undefined = gate ? (gatePhases[gateKey] ?? 'idle') : undefined
        const audioLocked = !isHoerenUnlocked(gatePhase)
        // Chưa bấm bắt đầu thì câu hỏi còn ẩn — cho đọc trước là vô hiệu hoá thời gian đọc của đề thật.
        const hideBody = gatePhase === 'idle'
        return (
        <div key={teil.teil ?? tIdx} className="overflow-hidden rounded-ga border border-ga-line bg-ga-card">
          <div className="border-b border-ga-line bg-ga-surface px-4 py-3 lg:px-6">
            <h2 className="ga-ui text-ga-h3 text-ga-ink">{t('teil', { n: teil.teil })}</h2>
            <p className="ga-ui mt-1 break-words text-ga-small text-ga-muted">{teil.instruction_vi || teil.instruction_de}</p>
          </div>

          <div className="p-4 lg:p-6">
            {teil.context && (isRichPassage(teil) ? (
              <ReadingPassage teil={teil} />
            ) : (
              <div className="ga-ui mb-6 whitespace-pre-wrap break-words rounded-ga border border-ga-line bg-ga-surface p-4 text-ga-body text-ga-ink">
                {teil.context}
              </div>
            ))}
            {gate && (
              <HoerenGate
                teilNo={teil.teil}
                spec={gate}
                phase={gatePhase ?? 'idle'}
                onPhaseChange={(phase) => setGatePhases((prev) => ({ ...prev, [gateKey]: phase }))}
              />
            )}
            {!hideBody && teil.audio_script &&
              (isDialogueScript(teil.audio_script) ? (
                <DialogueAudioPlayer
                  turns={teil.audio_script}
                  label={t('hoertext', { n: teil.teil })}
                  maxPlays={teil.max_plays}
                  locked={audioLocked}
                />
              ) : (
                <AudioPlayer
                  script={scriptToPlainText(teil.audio_script)}
                  label={t('hoertext', { n: teil.teil })}
                  maxPlays={teil.max_plays}
                  locked={audioLocked}
                />
              ))}

            {/* Bốn dạng bài telc có kho lựa chọn dùng chung cả Teil và văn bản có ô trống —
                `answerWidget` suy theo từng câu nên không dựng được. Dựng bằng nhánh riêng. */}
            {!hideBody && telcTeilType(teil) && (
              <TelcTeilBody teil={teil} answers={answers} onAnswerChange={onAnswerChange} />
            )}

            <div className="space-y-6">
              {!hideBody && !telcTeilType(teil) && teil.items?.map((item, qIdx) => {
                const widget = answerWidget(item)
                // Câu có giọng người nói / câu dẫn (đề telc) đọc bằng giọng persona, câu dẫn trước bài.
                const personaTurns = needsPersonaVoice(item) ? itemTurns(item) : null
                return (
                  <div
                    key={item.id ?? `${tIdx}-${qIdx}`}
                    className="border-b border-ga-line pb-6 last:border-0 last:pb-0"
                  >
                    {personaTurns ? (
                      <DialogueAudioPlayer
                        turns={personaTurns}
                        compact
                        label={item.person ? t('listenPerson', { person: item.person }) : t('listenItem', { n: qIdx + 1 })}
                        maxPlays={teil.max_plays}
                        locked={audioLocked}
                      />
                    ) : item.audio_script &&
                      (isDialogueScript(item.audio_script) ? (
                        <DialogueAudioPlayer
                          turns={item.audio_script}
                          label={item.person ? t('listenPerson', { person: item.person }) : t('listenDialog')}
                          maxPlays={teil.max_plays}
                          locked={audioLocked}
                        />
                      ) : (
                        <AudioPlayer
                          script={scriptToPlainText(item.audio_script)}
                          compact
                          label={item.person ? t('listenPerson', { person: item.person }) : t('listenDialog')}
                          maxPlays={teil.max_plays}
                          locked={audioLocked}
                        />
                      ))}
                    {item.text && <p className="ga-ui mb-3 break-words text-ga-body italic text-ga-muted">“{item.text}”</p>}
                    {item.person && <p className="ga-ui mb-3 flex items-center gap-1.5 break-words text-ga-body text-ga-muted"><User size={13} className="shrink-0" aria-hidden /> {item.person}</p>}

                    <p className="ga-ui mb-3 break-words text-ga-body-lg font-semibold text-ga-ink">
                      {qIdx + 1}. {item.question || t('questionFallback')}
                    </p>

                    {item.options && (
                      <div className="space-y-2">
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
                    )}

                    {widget === 'RICHTIG_FALSCH' && (
                      <div className="flex gap-4">
                        {['richtig', 'falsch'].map((opt) => {
                          const picked = answers[item.id] === opt
                          return (
                            <label
                              key={opt}
                              className={`ga-ui flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-ga border py-3 text-ga-small font-semibold transition-colors ${
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
                              className={`ga-ui grid h-12 w-12 cursor-pointer place-items-center rounded-ga border text-ga-body font-bold transition-colors ${
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
                      <label className="ga-ui mb-1 block text-ga-caption font-bold text-ga-muted">
                        {field.field}{' '}
                        <span className="font-normal text-ga-subtle">({field.instruction_vi})</span>
                      </label>
                      <input
                        type="text"
                        value={answers[`form_${fIdx}`] || ''}
                        onChange={(e) => onAnswerChange(`form_${fIdx}`, e.target.value)}
                        placeholder={t('formPlaceholder')}
                        className="ga-ui min-h-11 w-full rounded-ga border border-ga-line bg-ga-card px-3 py-2 text-ga-body text-ga-ink outline-none focus:border-ga-accent"
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Schreiben Teil 2 — email. Answer key stays `email_<teil>` (server contract). */}
              {writingStimulus && (
                <div className="space-y-4">
                  <div className="ga-ui whitespace-pre-wrap break-words rounded-ga border border-ga-line bg-ga-surface p-4 text-ga-body text-ga-ink">
                    {writingStimulus}
                  </div>
                  <ul className="ga-ui mb-4 list-disc space-y-1 break-words pl-5 text-ga-body text-ga-muted">
                    {teil.writing_points?.map((pt, idx) => <li key={idx}>{pt}</li>)}
                  </ul>
                  <textarea
                    value={answers[`email_${teil.teil}`] || ''}
                    onChange={(e) => onAnswerChange(`email_${teil.teil}`, e.target.value)}
                    placeholder={t('emailPlaceholder')}
                    className="ga-ui h-40 w-full resize-none rounded-ga border border-ga-line bg-ga-card px-4 py-3 text-ga-body text-ga-ink outline-none focus:border-ga-accent"
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
                        className="ga-ui rounded-ga bg-ga-orange-soft px-3 py-1.5 text-ga-small font-bold text-ga-orange"
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
                  <ul className="ga-ui space-y-2 rounded-ga border border-ga-line bg-ga-surface p-4 text-ga-body text-ga-ink">
                    {teil.topic_cards.map((card, cIdx) => (
                      <li key={card.card ?? cIdx} className="break-words">
                        <span className="font-semibold">{card.card}</span>
                        {card.question_to_ask ? ` — ${card.question_to_ask}` : null}
                      </li>
                    ))}
                  </ul>
                  <SprechenTeil2Simulator
                    onFinish={(score) => onAnswerChange(`sprechen_score_${teil.teil}`, String(score))}
                  />
                </div>
              )}

              {teil.scenario_cards && (
                <ul className="ga-ui space-y-2 rounded-ga border border-ga-line bg-ga-surface p-4 text-ga-body text-ga-ink">
                  {teil.scenario_cards.map((card, cIdx) => (
                    <li key={card.situation ?? cIdx} className="break-words">
                      <span className="font-semibold">{card.situation}</span>
                      {card.request ? ` — ${card.request}` : null}
                    </li>
                  ))}
                </ul>
              )}

              {speakingPrompt && (
                <div className="ga-ui whitespace-pre-wrap break-words rounded-ga border border-ga-line bg-ga-surface p-4 text-ga-body text-ga-ink">
                  {speakingPrompt}
                </div>
              )}
            </div>
          </div>
        </div>
        )
      })}

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <button
          type="button"
          onClick={() => onSectionChange(Math.max(0, currentSectionIdx - 1))}
          disabled={currentSectionIdx === 0}
          className="ga-ui min-h-11 rounded-ga border border-ga-line bg-ga-card px-4 text-ga-small font-semibold text-ga-muted transition-colors hover:bg-ga-surface disabled:cursor-not-allowed disabled:opacity-50 lg:px-6"
        >
          {t('prevSection')}
        </button>

        {!isLastSection ? (
          <button
            type="button"
            onClick={() => onSectionChange(Math.min(data.sections.length - 1, currentSectionIdx + 1))}
            className="ga-ui inline-flex min-h-11 items-center gap-2 rounded-ga bg-ga-accent px-4 text-ga-small font-semibold text-ga-accent-ink transition-opacity hover:opacity-90 lg:px-6"
          >
            {t('nextSection')} <ChevronRight size={18} aria-hidden />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onSubmit(false)}
            disabled={submitting}
            className="ga-ui inline-flex min-h-11 items-center gap-2 rounded-ga bg-ga-green px-4 text-ga-small font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60 lg:px-8"
          >
            {submitting ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <Send size={18} aria-hidden />}
            {t('submitAll')}
          </button>
        )}
      </div>
    </div>
  )
}
