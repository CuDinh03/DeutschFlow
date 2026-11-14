'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Check, FastForward, Headphones, List, Lock, Megaphone, MessagesSquare, Play, Repeat1, Repeat2, Timer, Volume2 } from 'lucide-react'
import { GaGlyph } from '@/components/ui-v2/GaGlyph'
import { cn } from '@/lib/utils'
import type { PracticeTeilResult } from '@/lib/telcPracticeApi'
import { speakExamLine } from '@/components/features/exam-speaking/examTts'
import {
  NARRATOR_ROLE,
  isDialogueScript,
  itemTurns,
  parseHoerenGate,
  scriptToPlainText,
  type AudioScript,
  type AudioTurn,
} from '@/components/exam/audioScript'
import { assignHoerenVoices } from '@/components/exam/hoerenVoices'
import { HoerenPlayer } from './HoerenPlayer'
import { ObjectiveTeilView } from './ObjectiveTeilView'
import type { PassageMarks } from '@/components/exam/marks/usePassageMarks'
import { useHoerenRitual, type RitualPhase } from './useHoerenRitual'
import { itemLabel, withTrueFalse, type PracticeItem, type PracticeTeilData } from './practiceModel'

interface Props {
  teil: PracticeTeilData
  answers: Record<string, string>
  onAnswer: (itemId: string, value: string | null) => void
  result: PracticeTeilResult | null
  wide: boolean
  tips: React.ReactNode
  /**
   * Chỉ ở luyện từng Teil: cho chọn "Luyện thoải mái" (nghe lại, xem lời thoại, bỏ đồng hồ) và cho
   * bỏ qua hướng dẫn / giờ đọc. Thi thử trọn đề luôn như thi thật.
   */
  allowRelaxed?: boolean
  /** Báo trang khi đổi sang / ra khỏi luyện thoải mái (trang ẩn đồng hồ). */
  onRelaxedChange?: (relaxed: boolean) => void
  /** Bút đánh dấu lời bài (đợt 3b) — chỉ dùng SAU khi kiểm tra (lời thoại lúc làm bài là lộ đáp án). */
  marks?: PassageMarks | null
}

type Mode = 'exam' | 'relaxed'
const MODE_KEY = 'df.practice.hoerenMode'

interface Segment {
  /** Câu ứng với đoạn (Teil 1, 3); `null` = bài cấp Teil (Teil 2). */
  itemId: string | null
  turns: AudioTurn[]
}

function asTurns(script: AudioScript): AudioTurn[] {
  return isDialogueScript(script) ? script : [{ speaker: NARRATOR_ROLE, text: scriptToPlainText(script) }]
}

/**
 * Một Teil Hören (đợt (b), 07/11/2026) — dùng cho luyện từng Teil và thi thử trọn đề.
 *
 * Như thi thật: Chuẩn bị (số đoạn, số lần được nghe theo `max_plays`, giây đọc câu hỏi, nghe thử loa)
 * → Hướng dẫn (Ansage nguyên văn) → Đọc câu hỏi (đếm ngược) → Nghe. Câu hỏi khoá tới khi xong hướng
 * dẫn. Bài theo từng câu (Teil 1, 3) nghe lần lượt từng đoạn ở cột nguồn, không quay lại đoạn trước;
 * đoạn hết lượt thì tự sang đoạn sau, còn lượt thì có nút "Sang đoạn tiếp"; câu ứng với đoạn đang
 * nghe được đưa lên làm câu đang làm.
 *
 * Luyện thoải mái (chỉ luyện Teil) và sau khi kiểm tra: không nghi thức, nghe không giới hạn, có lời thoại.
 */
export function HoerenTeilView({ teil: teilProp, answers, onAnswer, result, wide, tips, allowRelaxed = false, onRelaxedChange, marks }: Props) {
  const t = useTranslations('v2.student.practice.hoeren')
  // Trang cha có thể dựng lại object Teil ở mỗi lần render (bài chẩn đoán từng parse lại đề mỗi lần chọn đáp án).
  // Nghi thức và đoạn đang nghe phải bám theo NỘI DUNG Teil, không theo danh tính object — nếu không thì mỗi lần
  // bấm một câu, hướng dẫn chạy lại từ đầu và đoạn nghe quay về đoạn 1.
  const teilSig = JSON.stringify(teilProp)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const teil = React.useMemo(() => teilProp, [teilSig])
  const data = React.useMemo(() => withTrueFalse(teil), [teil])
  const gate = React.useMemo(() => parseHoerenGate(teil), [teil])
  const checked = result != null
  const teilNo = teil.teil ?? 1
  const items = React.useMemo(() => data.items ?? [], [data.items])
  const first = items[0] ? itemLabel(items[0]) : ''
  const last = items.length ? itemLabel(items[items.length - 1]) : ''

  const [mode, setMode] = React.useState<Mode>('exam')
  React.useEffect(() => {
    if (!allowRelaxed) return
    try {
      if (window.localStorage.getItem(MODE_KEY) === 'relaxed') setMode('relaxed')
    } catch {
      /* chế độ riêng tư: giữ thi thật */
    }
  }, [allowRelaxed])
  const chooseMode = (m: Mode) => {
    setMode(m)
    try {
      window.localStorage.setItem(MODE_KEY, m)
    } catch {
      /* bỏ qua */
    }
  }
  const strict = !checked && (mode === 'exam' || !allowRelaxed)
  React.useEffect(() => {
    onRelaxedChange?.(!checked && !strict)
  }, [checked, strict, onRelaxedChange])

  const segments = React.useMemo<Segment[]>(() => {
    if (teil.audio_script) return [{ itemId: null, turns: asTurns(teil.audio_script) }]
    return items.flatMap((it): Segment[] => {
      const turns = itemTurns(it) ?? (it.audio_script ? asTurns(it.audio_script) : null)
      return turns && turns.length > 0 ? [{ itemId: it.id, turns }] : []
    })
  }, [teil.audio_script, items])
  // Chia giọng ở cấp Teil (mỗi nhân vật một giọng; người dẫn một giọng cố định cho cả đề) — tính từ nội dung nên tất định;
  // nghi thức (Ansage, câu khung) và mọi trình phát của Teil dùng chung bảng này.
  const voices = React.useMemo(() => assignHoerenVoices(segments.map((s) => s.turns)), [segments])

  const ritual = useHoerenRitual(gate, strict, voices.narrator)
  const multi = segments.length > 1
  const maxPlays = teil.max_plays && teil.max_plays > 0 ? teil.max_plays : undefined

  // Đoạn đang nghe và lượt đã dùng của nó (chỉ khi như thi thật).
  const [seg, setSeg] = React.useState(0)
  const [segUsed, setSegUsed] = React.useState(0)
  const [segPlaying, setSegPlaying] = React.useState(false)
  React.useEffect(() => {
    setSeg(0)
    setSegUsed(0)
  }, [strict, teil])
  const goNext = () => {
    setSeg((s) => Math.min(segments.length - 1, s + 1))
    setSegUsed(0)
  }

  const locked = strict && (ritual.phase === 'prep' || ritual.phase === 'ansage')
  const listening = strict && ritual.phase === 'listen'
  const focusId = listening && multi ? segments[seg]?.itemId ?? null : null

  // ── cột nguồn ──────────────────────────────────────────────────────────────
  let stage: React.ReactNode
  let listenBox: React.ReactNode = null
  if (!strict) {
    stage = (
      <div className="mb-5 space-y-3">
        {allowRelaxed && !checked && (
          <div className="ga-ui flex flex-wrap items-center gap-x-3 gap-y-2 rounded-ga-touch bg-ga-navy-soft px-3.5 py-2.5 text-ga-small text-ga-ink">
            <Headphones size={16} className="text-ga-navy" aria-hidden />
            <span className="min-w-0 flex-1">{t('relaxedBanner')}</span>
            <button type="button" onClick={() => chooseMode('exam')} className="font-semibold text-ga-navy underline decoration-1 underline-offset-[3px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus">
              {t('toExam')}
            </button>
          </div>
        )}
        {checked && <p className="ga-ui text-ga-small text-ga-muted">{t('replayHint')}</p>}
        {teil.audio_script && <HoerenPlayer turns={asTurns(teil.audio_script)} voices={voices.segments[0]} label={t('teilAudio', { n: teilNo })} transcript markScope="teil" />}
      </div>
    )
  } else if (ritual.phase === 'prep') {
    stage = (
      <PrepCard
        teilNo={teilNo}
        segmentCount={segments.length}
        multi={multi}
        range={`${first}–${last}`}
        maxPlays={maxPlays}
        readingSeconds={gate?.readingSeconds ?? 0}
        steps={ritual.steps}
        allowRelaxed={allowRelaxed}
        mode={mode}
        onMode={chooseMode}
        onStart={ritual.begin}
        narratorPersona={voices.narrator}
      />
    )
  } else if (ritual.phase === 'ansage' || ritual.phase === 'framing') {
    stage = (
      <div className="mb-5 space-y-3">
        <Steps phase={ritual.phase} steps={ritual.steps} />
        <div className="flex gap-3 rounded-ga-touch bg-ga-side-active px-4 py-3.5">
          <Megaphone size={18} className="mt-0.5 shrink-0 text-ga-muted" aria-hidden />
          <p lang="de" className="font-ga-display text-ga-body-lg italic text-ga-ink">
            {ritual.phase === 'ansage' ? gate?.ansage : gate?.framing}
          </p>
        </div>
        <div className="ga-ui flex flex-wrap items-center justify-between gap-3 text-ga-small text-ga-muted" role="status">
          <span>{ritual.phase === 'ansage' ? t('ansageNow') : t('framingNow')}</span>
          {allowRelaxed && (
            <button type="button" onClick={ritual.skip} className="font-semibold text-ga-navy underline decoration-1 underline-offset-[3px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus">
              {t('skip')}
            </button>
          )}
        </div>
      </div>
    )
  } else if (ritual.phase === 'reading') {
    const total = gate?.readingSeconds ?? 1
    const frac = Math.max(0, ritual.secondsLeft) / total
    stage = (
      <div className="mb-5 space-y-4">
        <Steps phase={ritual.phase} steps={ritual.steps} />
        <div className="flex items-center gap-4" role="timer" aria-live="off">
          <svg viewBox="0 0 36 36" className="h-14 w-14 -rotate-90" aria-hidden>
            <circle cx="18" cy="18" r="15" fill="none" strokeWidth="3" className="stroke-ga-line" />
            <circle
              cx="18"
              cy="18"
              r="15"
              fill="none"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray="94.25"
              strokeDashoffset={(94.25 * (1 - frac)).toFixed(2)}
              className="stroke-ga-ink transition-[stroke-dashoffset] duration-1000 ease-linear motion-reduce:transition-none"
            />
          </svg>
          <div className="ga-ui">
            <p className="text-ga-body text-ga-ink">
              <b className="font-ga-display text-ga-h2 tabular-nums">{ritual.secondsLeft}</b> {t('seconds')}
            </p>
            <p className="text-ga-small text-ga-muted">{t('readHint', { range: `${first}–${last}` })}</p>
          </div>
        </div>
        {allowRelaxed && (
          <button type="button" onClick={ritual.skip} className="ga-ui inline-flex min-h-10 items-center gap-1.5 rounded-ga-touch border-[1.5px] border-ga-line-strong bg-ga-card px-3.5 text-ga-small font-semibold text-ga-ink hover:bg-ga-side-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus">
            <Check size={15} aria-hidden /> {t('readDone')}
          </button>
        )}
      </div>
    )
  } else {
    const cur = segments[seg]
    const lastSeg = seg === segments.length - 1
    const exhausted = maxPlays != null && segUsed >= maxPlays
    // Trình phát chỉ có MỘT bản (lượt nghe đếm trong nó): màn rộng ở cột nguồn, màn hẹp ở đầu ngăn
    // câu hỏi — nếu để ở nền thì ngăn che mất, vừa nghe vừa chọn không được.
    listenBox = (
      <div className="space-y-3">
        {cur && (
          <HoerenPlayer
            key={`seg-${seg}`}
            turns={cur.turns}
            voices={voices.segments[seg]}
            compact={!wide}
            label={multi ? t('segmentOf', { n: seg + 1, q: itemLabel(items.find((it) => it.id === cur.itemId) ?? { id: '' }) }) : t('teilAudio', { n: teilNo })}
            maxPlays={maxPlays}
            allowStop={allowRelaxed}
            onPlayStart={() => setSegPlaying(true)}
            onEnded={(used) => {
              setSegPlaying(false)
              setSegUsed(used)
              // Hết lượt của đoạn ⇒ tự sang đoạn sau, như băng đề chạy tiếp.
              if (multi && maxPlays != null && used >= maxPlays && !lastSeg) goNext()
            }}
          />
        )}
        <div className="ga-ui flex flex-wrap items-center gap-3 text-ga-small">
          {multi && !lastSeg && segUsed >= 1 && !segPlaying && !exhausted && (
            <button type="button" onClick={goNext} className="inline-flex min-h-10 items-center gap-1.5 rounded-ga-touch border-[1.5px] border-ga-line-strong bg-ga-card px-3.5 font-semibold text-ga-ink hover:bg-ga-side-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus">
              {t('nextSegment', { n: seg + 2 })} <FastForward size={15} aria-hidden />
            </button>
          )}
          {(!multi || lastSeg) && exhausted && !segPlaying && (
            <span className="inline-flex items-center gap-1.5 font-semibold text-ga-green">
              <Check size={15} aria-hidden /> {t('allDone')}
            </span>
          )}
        </div>
      </div>
    )
    stage = (
      <div className="mb-5 space-y-3">
        <Steps phase="listen" steps={ritual.steps} />
        {multi && (
          <ol className="flex flex-wrap gap-1.5" aria-label={t('segments')}>
            {segments.map((s, i) => (
              <li
                key={s.itemId ?? i}
                aria-current={i === seg ? 'step' : undefined}
                className={cn(
                  'ga-ui inline-flex items-center gap-1 rounded-ga-touch border px-2.5 py-1 text-ga-caption',
                  i < seg && 'border-transparent bg-ga-side-active text-ga-muted',
                  i === seg && 'border-ga-ink font-semibold text-ga-ink',
                  i > seg && 'border-ga-line text-ga-muted',
                )}
              >
                {i < seg && <Check size={12} aria-hidden />}
                {t('segment', { n: i + 1 })}
              </li>
            ))}
          </ol>
        )}
        {wide && listenBox}
      </div>
    )
  }

  // Bài theo từng câu: thoải mái / sau khi kiểm tra thì đặt ngay trong thẻ câu, nghe tuỳ ý.
  const itemExtra = (item: PracticeItem) => {
    if (strict) return null
    const turns = itemTurns(item) ?? (item.audio_script ? asTurns(item.audio_script) : null)
    if (!turns) return null
    const at = segments.findIndex((s) => s.itemId === item.id)
    return <HoerenPlayer turns={turns} voices={at >= 0 ? voices.segments[at] : undefined} compact transcript markScope={item.id} label={t('itemAudio', { n: itemLabel(item) })} />
  }

  const lockedPane = locked ? (
    <div className="ga-ui flex min-h-[16rem] flex-col items-center justify-center gap-2.5 rounded-ga-touch border border-dashed border-ga-line-strong px-6 py-8 text-center text-ga-muted">
      <GaGlyph icon={Lock} tone="plain" size="lg" />
      <b className="text-ga-body text-ga-ink">{t('lockedTitle')}</b>
      <span className="text-ga-small">{t('lockedDesc')}</span>
    </div>
  ) : undefined

  return (
    <ObjectiveTeilView
      teil={data}
      kind="mc"
      answers={answers}
      onAnswer={onAnswer}
      result={result}
      wide={wide}
      tips={tips}
      intro={stage}
      itemExtra={itemExtra}
      answersOverride={lockedPane}
      answersTop={!wide && listenBox ? <div className="sticky top-[60px] z-[5] -mx-3 mb-4 border-b border-ga-line bg-ga-card px-3 pb-3">{listenBox}</div> : undefined}
      focusId={focusId}
      marks={checked ? marks : null}
    />
  )
}

function Steps({ phase, steps }: { phase: RitualPhase; steps: RitualPhase[] }) {
  const t = useTranslations('v2.student.practice.hoeren')
  const all: RitualPhase[] = ['prep', ...steps.filter((s) => s !== 'framing')]
  const at = phase === 'framing' ? all.indexOf('listen') - 1 : all.indexOf(phase)
  return (
    <ol className="flex flex-wrap gap-1.5" aria-label={t('stepsLabel')}>
      {all.map((s, i) => (
        <li
          key={s}
          aria-current={i === at ? 'step' : undefined}
          className={cn(
            'ga-ui inline-flex items-center gap-1 rounded-ga-pill border px-2.5 py-0.5 text-ga-caption',
            i < at && 'border-transparent bg-ga-side-active text-ga-muted',
            i === at && 'border-ga-ink bg-ga-ink text-ga-card',
            i > at && 'border-ga-line text-ga-muted',
          )}
        >
          {i < at && <Check size={12} aria-hidden />}
          {t(`step.${s}`)}
        </li>
      ))}
    </ol>
  )
}

function PrepCard({
  teilNo,
  segmentCount,
  multi,
  range,
  maxPlays,
  readingSeconds,
  steps,
  allowRelaxed,
  mode,
  onMode,
  onStart,
  narratorPersona,
}: {
  teilNo: number
  segmentCount: number
  multi: boolean
  range: string
  maxPlays?: number
  readingSeconds: number
  steps: RitualPhase[]
  allowRelaxed: boolean
  mode: Mode
  onMode: (m: Mode) => void
  onStart: () => void
  /** Giọng người dẫn của Teil — "Nghe thử loa" dùng đúng giọng sẽ đọc hướng dẫn. */
  narratorPersona?: string
}) {
  const t = useTranslations('v2.student.practice.hoeren')
  const PlaysIcon = maxPlays === 1 ? Repeat1 : Repeat2
  const fact = 'flex flex-col gap-1.5 rounded-ga border border-ga-line bg-ga-card p-3'
  return (
    <div className="mb-5 space-y-5" data-tour="hoeren-prep">
      <Steps phase="prep" steps={steps} />
      <div>
        <p className="ga-ui text-ga-eyebrow uppercase text-ga-muted" lang="de">Hörverstehen</p>
        <h2 className="mt-1 font-ga-display text-ga-h2 text-ga-ink">{t('prepTitle', { n: teilNo })}</h2>
      </div>
      <div className="ga-ui grid gap-2 sm:grid-cols-3">
        <div className={fact}>
          <GaGlyph icon={multi ? List : MessagesSquare} size="sm" />
          <b className="text-ga-body-lg text-ga-ink">{multi ? t('factSegments', { n: segmentCount }) : t('factDialogue')}</b>
          <span className="text-ga-small text-ga-muted">{t('factRange', { range })}</span>
        </div>
        <div className={cn(fact, 'border-ga-ink shadow-[inset_0_0_0_1px_var(--ga-ink)]')}>
          <GaGlyph icon={PlaysIcon} size="sm" />
          <b className="text-ga-body-lg text-ga-ink">{maxPlays ? t('factPlays', { n: maxPlays }) : t('factPlaysFree')}</b>
          <span className="text-ga-small text-ga-muted">{multi ? t('factEach') : t('factWhole')}</span>
        </div>
        <div className={fact}>
          <GaGlyph icon={Timer} size="sm" />
          <b className="text-ga-body-lg text-ga-ink">{readingSeconds > 0 ? t('factRead', { s: readingSeconds }) : t('factReadNone')}</b>
          <span className="text-ga-small text-ga-muted">{t('factReadSub')}</span>
        </div>
      </div>
      <ul className="ga-ui space-y-1.5 text-ga-small text-ga-muted">
        <li className="flex items-center gap-2"><Headphones size={15} aria-hidden /> {t('rule1')}</li>
        <li className="flex items-center gap-2"><FastForward size={15} aria-hidden /> {t('rule2')}</li>
        <li className="flex items-center gap-2"><Lock size={15} aria-hidden /> {t('rule3')}</li>
      </ul>
      {allowRelaxed && (
        <fieldset className="ga-ui" data-tour="hoeren-mode">
          <legend className="mb-2 text-ga-small font-semibold text-ga-ink">{t('modeLabel')}</legend>
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup">
            {(['exam', 'relaxed'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={mode === m}
                onClick={() => onMode(m)}
                className={cn(
                  'flex flex-col gap-0.5 rounded-ga-touch border-[1.5px] bg-ga-card px-3.5 py-2.5 text-left transition-[border-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus',
                  mode === m ? 'border-ga-ink shadow-[inset_0_0_0_1px_var(--ga-ink)]' : 'border-ga-line hover:border-ga-line-strong',
                )}
              >
                <b className="text-ga-body text-ga-ink">{m === 'exam' ? t('modeExam') : t('modeRelaxed')}</b>
                <span className="text-ga-small text-ga-muted">{m === 'exam' ? t('modeExamDesc') : t('modeRelaxedDesc')}</span>
              </button>
            ))}
          </div>
        </fieldset>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void speakExamLine(NARRATOR_ROLE, 'Hallo! Können Sie mich gut hören?', narratorPersona)}
          className="ga-ui inline-flex min-h-11 items-center gap-1.5 rounded-ga-touch border-[1.5px] border-ga-line-strong bg-ga-card px-4 text-ga-small font-semibold text-ga-ink hover:bg-ga-side-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus"
        >
          <Volume2 size={16} aria-hidden /> {t('testSpeaker')}
        </button>
        <button
          type="button"
          onClick={onStart}
          className="ga-ui inline-flex min-h-11 items-center gap-1.5 rounded-ga-touch bg-ga-ink px-5 text-ga-body font-semibold text-ga-card transition-transform duration-150 hover:-translate-y-px active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus"
        >
          <Play size={16} aria-hidden fill="currentColor" /> {t('start', { n: teilNo })}
        </button>
      </div>
    </div>
  )
}
