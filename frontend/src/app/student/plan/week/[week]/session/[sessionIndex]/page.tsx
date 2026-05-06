'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import api, { httpStatus } from '@/lib/api'
import { getAccessToken, clearTokens, logout } from '@/lib/authSession'
import { StudentShell } from '@/components/layouts/StudentShell'
import { primeGermanVoices, speakGerman } from '@/lib/speechDe'
import { genderBgClass, inferGenderFromGermanText } from '@/lib/constants'
import { GripVertical, Lock, Sparkles, Volume2, X } from 'lucide-react'

type TheoryLesson = {
  title: string
  overview: string
  focusBullets: string[]
  vocabulary: Array<{
    german: string
    meaning: string
    exampleDe: string
    exampleTranslation: string
    speakDe: string
    gender?: 'DER' | 'DIE' | 'DAS' | 'PLURAL' | null
    article?: 'der' | 'die' | 'das' | null
  }>
  phrases: Array<{ german: string; meaning: string; speakDe: string }>
  examples: Array<{ german: string; translation: string; note: string; speakDe: string }>
}

type ExerciseItem = {
  id: string
  title: string
  skill: string
  difficulty: number
  minutes: number
  question: string
  options: string[]
  format?: string | null
  correctOptionIndex?: number | null
  expectedAnswerNormalized?: string | null
  audioGerman?: string | null
}

type ItemResult = { exerciseId: string; correct: boolean; explanation: string | null }

type ExplanationRow = {
  index: number
  title: string
  question: string
  explanation: string | null
}

type SubmitResponse = {
  scorePercent: number
  passed60: boolean
  completed: boolean
  mode: string
  requiredExerciseIds: string[]
  mistakes: unknown[]
  reinforcementExercises?: ExerciseItem[]
  itemResults?: ItemResult[]
  nextWeek?: number | null
  nextSessionIndex?: number | null
}

type Detail = {
  week: number
  sessionIndex: number
  type: string
  minutes: number
  difficulty: number
  theory: string[]
  theoryLesson?: TheoryLesson | null
  theoryGateExercises: ExerciseItem[]
  theoryGatePassed: boolean
  exercises: ExerciseItem[]
}

function isTextExerciseFormat(f?: string | null) {
  return f === 'TEXT' || f === 'SPEAK_REPEAT'
}

function isOrderDrag(f?: string | null) {
  return f === 'ORDER_DRAG'
}

function itemResultsToHighlights(itemResults: ItemResult[] | undefined): Record<string, 'correct' | 'wrong'> {
  const out: Record<string, 'correct' | 'wrong'> = {}
  for (const r of itemResults ?? []) {
    out[r.exerciseId] = r.correct ? 'correct' : 'wrong'
  }
  return out
}

function mergeExplanationRows(exercises: ExerciseItem[], itemResults: ItemResult[] | undefined): ExplanationRow[] {
  const byId = new Map((itemResults ?? []).map((r) => [r.exerciseId, r]))
  return exercises.map((ex, i) => ({
    index: i + 1,
    title: ex.title,
    question: ex.question,
    explanation: byId.get(ex.id)?.explanation ?? null,
  }))
}

function shouldShowListenButton(ex: ExerciseItem) {
  return ex.skill === 'LISTENING' || ex.format === 'SPEAK_REPEAT'
}

function HearBtn({ text, children }: { text: string; children?: ReactNode }) {
  const t = useTranslations('session')
  return (
    <button
      type="button"
      className="btn-outline btn-sm inline-flex items-center gap-1.5 shrink-0"
      aria-label={t('hear')}
      onClick={() => speakGerman(text)}
    >
      <Volume2 className="w-4 h-4" />
      {children ?? t('hear')}
    </button>
  )
}

function HoverMeaningSentence({
  german,
  vietnamese,
}: {
  german: string
  vietnamese?: string
}) {
  const meaning = (vietnamese || '').trim()
  return (
    <div className="relative group max-w-xl">
      <p className="text-foreground">{german}</p>
      {meaning ? (
        <div className="pointer-events-none absolute left-0 top-full z-10 mt-2 w-full rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground shadow-lg opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          {meaning}
        </div>
      ) : null}
    </div>
  )
}

function OrderDragRow({
  exerciseId,
  labels,
  onChange,
  disabled,
}: {
  exerciseId: string
  labels: string[]
  onChange: (next: string[]) => void
  disabled?: boolean
}) {
  const t = useTranslations('session')
  const [dragFrom, setDragFrom] = useState<number | null>(null)
  const move = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || from >= labels.length || to >= labels.length) return
    const next = [...labels]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item!)
    onChange(next)
  }
  return (
    <div className="mt-3 flex flex-col gap-2">
      <p className="form-help">{t('orderDragHint')}</p>
      <ul className="space-y-2">
        {labels.map((label, i) => (
          <li
            key={`${exerciseId}-${i}-${label}`}
            draggable={!disabled}
            onDragStart={() => setDragFrom(i)}
            onDragEnd={() => setDragFrom(null)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              if (disabled) return
              if (dragFrom !== null) move(dragFrom, i)
              setDragFrom(null)
            }}
            className={`flex items-center gap-2 rounded-[12px] border-2 border-[#E2E8F0] bg-white px-3 py-2.5 select-none transition-colors shadow-[0_2px_8px_rgba(0,48,94,0.06)] ${
              disabled
                ? 'opacity-60 cursor-not-allowed'
                : 'cursor-grab active:cursor-grabbing hover:bg-[#F8FAFF]'
            }`}
          >
            <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden />
            <span className="flex-1 text-sm text-foreground">{label}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Chỉ khi đạt 100% — lời khen + bảng giải thích + nút tiếp (nếu có) */
function SuccessModal({
  open,
  variant,
  explanations,
  onClose,
  nextWeek,
  nextSessionIndex,
}: {
  open: boolean
  variant: 'gate' | 'main'
  explanations: ExplanationRow[]
  onClose: () => void
  nextWeek: number | null | undefined
  nextSessionIndex: number | null | undefined
}) {
  const t = useTranslations('session')
  if (!open) return null
  const hasNext = nextWeek != null && nextSessionIndex != null
  const title = variant === 'gate' ? t('successGateTitle') : t('successMainTitle')
  const body = variant === 'gate' ? t('successGateBody') : t('successMainBody')
  const explTitle = variant === 'gate' ? t('explanationsGateHeading') : t('explanationsMainHeading')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-[2px]" role="dialog" aria-modal="true">
      <div className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl border border-emerald-500/30 bg-card shadow-2xl ring-2 ring-emerald-500/20 p-6 text-left">
        <button type="button" className="absolute right-3 top-3 p-1.5 rounded-lg hover:bg-muted z-10" aria-label={t('close')} onClick={onClose}>
          <X className="w-5 h-5" />
        </button>
        <div className="text-center pr-8 mb-2">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-500/30">
            <Sparkles className="h-7 w-7 text-emerald-600 dark:text-emerald-400" aria-hidden />
          </div>
          <h3 className="text-xl font-bold text-foreground">{title}</h3>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{body}</p>
          <p className="mt-4 inline-flex rounded-full bg-emerald-500/15 px-4 py-1.5 text-sm font-semibold text-emerald-800 dark:text-emerald-200">
            {t('successScore100')}
          </p>
        </div>

        {explanations.length > 0 ? (
          <div className="mt-6 border-t border-border pt-5">
            <h4 className="text-sm font-semibold text-foreground mb-3">{explTitle}</h4>
            <ul className="space-y-3 max-h-[min(50vh,420px)] overflow-y-auto pr-1">
              {explanations.map((row) => (
                <li key={`${row.index}-${row.title}`} className="rounded-xl border border-border bg-muted/20 px-4 py-3 text-sm">
                  <p className="text-xs font-semibold text-muted-foreground">
                    {t('questionN', { n: row.index })} · {row.title}
                  </p>
                  <p className="mt-1 text-foreground whitespace-pre-wrap leading-relaxed">{row.question}</p>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground border-t border-dashed border-border pt-2">
                    {row.explanation?.trim() ? row.explanation : t('explanationMissing')}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-6 flex flex-col sm:flex-row gap-2 justify-center">
          {hasNext ? (
            <Link href={`/student/plan/week/${nextWeek}/session/${nextSessionIndex}`} className="btn-primary btn-md text-center" onClick={onClose}>
              {t('nextSession')}
            </Link>
          ) : null}
          <button type="button" className="btn-outline btn-md" onClick={onClose}>
            {t('modalClose')}
          </button>
        </div>
        {!hasNext && variant === 'main' ? <p className="text-xs text-muted-foreground mt-4 text-center">{t('planEndHint')}</p> : null}
      </div>
    </div>
  )
}

function exerciseBlock(
  ex: ExerciseItem,
  answers: Record<string, number | string>,
  setAnswers: (fn: (a: Record<string, number | string>) => Record<string, number | string>) => void,
  dragOrders: Record<string, string[]>,
  setDragOrders: (fn: (d: Record<string, string[]>) => Record<string, string[]>) => void,
  t: (k: string, v?: Record<string, string | number>) => string,
  grade?: 'correct' | 'wrong',
  disabled?: boolean
) {
  const frame =
    grade === 'correct'
      ? 'rounded-[16px] border-2 border-emerald-500 p-4 ring-2 ring-emerald-500/35 bg-emerald-500/[0.07] shadow-[0_2px_10px_rgba(0,48,94,0.06)]'
      : grade === 'wrong'
        ? 'rounded-[16px] border-2 border-red-500 p-4 ring-2 ring-red-500/35 bg-red-500/[0.07] shadow-[0_2px_10px_rgba(0,48,94,0.06)]'
        : 'rounded-[16px] border-2 border-[#E2E8F0] bg-white p-4 shadow-[0_2px_10px_rgba(0,48,94,0.06)]'

  return (
    <div key={ex.id} className={frame}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className={grade ? 'font-bold text-[#0F172A]' : 'font-semibold text-[#0F172A]'}>{ex.title}</p>
          <p className={`mt-1 whitespace-pre-wrap ${grade ? 'text-sm font-medium text-foreground' : 'text-sm text-muted-foreground'}`}>{ex.question}</p>
          {disabled ? <p className="mt-2 text-xs text-emerald-700">{t('alreadyCorrect')}</p> : null}
          {shouldShowListenButton(ex) && ex.audioGerman && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <HearBtn text={ex.audioGerman}>{t('exerciseListen')}</HearBtn>
              {ex.format === 'SPEAK_REPEAT' && <span className="text-xs text-muted-foreground">{t('exerciseSpeakHelp')}</span>}
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground shrink-0">{t('exerciseMeta', { minutes: ex.minutes, skill: ex.skill })}</p>
      </div>

      {isTextExerciseFormat(ex.format) ? (
        <div className="mt-3">
          <textarea
            className="input min-h-[110px] text-sm"
            placeholder={t('exerciseDictationPlaceholder')}
            value={String(answers[ex.id] ?? '')}
            disabled={disabled}
            onChange={(e) => setAnswers((a) => ({ ...a, [ex.id]: e.target.value }))}
          />
        </div>
      ) : isOrderDrag(ex.format) ? (
        <OrderDragRow
          exerciseId={ex.id}
          labels={dragOrders[ex.id] ?? [...(ex.options ?? [])]}
          disabled={disabled}
          onChange={(next) => {
            if (disabled) return
            setDragOrders((d) => ({ ...d, [ex.id]: next }))
            setAnswers((a) => ({ ...a, [ex.id]: next.join('|') }))
          }}
        />
      ) : (
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
          {(ex.options ?? []).map((opt: string, idx: number) => {
            const selected = answers[ex.id] === idx
            return (
              <button
                type="button"
                key={`${ex.id}-${idx}-${opt}`}
                className={`text-left rounded-[12px] border-2 px-3 py-2.5 text-sm transition-colors flex items-center gap-2 ${
                  selected ? 'border-[#00305E] bg-[#EEF4FF] text-[#00305E]' : 'border-[#E2E8F0] bg-white hover:bg-[#F8FAFF]'
                }`}
                onClick={() => {
                  if (disabled) return
                  setAnswers((a) => ({ ...a, [ex.id]: idx }))
                }}
                disabled={disabled}
              >
                <span
                  className={`w-6 h-6 rounded-[8px] text-xs font-bold flex items-center justify-center ${
                    selected ? 'bg-[#00305E] text-white' : 'bg-[#F1F4F9] text-[#64748B]'
                  }`}
                >
                  {String.fromCharCode(65 + idx)}
                </span>
                <span className="flex-1">{opt}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function SessionDetailPage() {
  const t = useTranslations('session')
  const router = useRouter()
  const params = useParams<{ week: string; sessionIndex: string }>()
  const week = Number(params.week)
  const sessionIndex = Number(params.sessionIndex)

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [detail, setDetail] = useState<Detail | null>(null)
  const didInitialLoadRef = useRef(false)
  const [answers, setAnswers] = useState<Record<string, number | string>>({})
  const [gateAnswers, setGateAnswers] = useState<Record<string, number | string>>({})
  const [dragOrders, setDragOrders] = useState<Record<string, string[]>>({})
  const [reinforcementIds, setReinforcementIds] = useState<string[] | null>(null)
  const [reinforcementExercises, setReinforcementExercises] = useState<ExerciseItem[] | null>(null)
  /** Sau khi nộp, chưa 100%: tô màu khung theo đúng/sai */
  const [answerHighlights, setAnswerHighlights] = useState<Record<string, 'correct' | 'wrong'>>({})
  const [successModal, setSuccessModal] = useState<{
    open: boolean
    variant: 'gate' | 'main'
    explanations: ExplanationRow[]
    nextWeek?: number | null
    nextSessionIndex?: number | null
  }>({ open: false, variant: 'gate', explanations: [] })
  const [savedExplanations, setSavedExplanations] = useState<{ gate: ExplanationRow[] | null; main: ExplanationRow[] | null }>({
    gate: null,
    main: null,
  })
  const [shellUser, setShellUser] = useState<{ displayName: string; role: string } | null>(null)
  const [targetLevel, setTargetLevel] = useState('A1')
  const [streakDays, setStreakDays] = useState(0)

  const loadDetail = useCallback(() => {
    return api
      .get(`/plan/sessions/${week}/${sessionIndex}`, {
        params: { _: Date.now() },
        headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' },
      })
      .then((res) => {
        setDetail(res.data as Detail)
        setLoadError('')
      })
  }, [week, sessionIndex])

  useEffect(() => {
    if (didInitialLoadRef.current) return
    didInitialLoadRef.current = true

    if (!getAccessToken()) {
      router.push('/login')
      return
    }

    primeGermanVoices()
    ;(async () => {
      try {
        const meRes = await api.get<{ displayName: string; role: string }>('/auth/me')
        if (meRes.data.role !== 'STUDENT') {
          router.push(`/${meRes.data.role.toLowerCase()}`)
          return
        }
        setShellUser(meRes.data)
        const [planRes, dashRes] = await Promise.all([
          api.get<{ plan?: { targetLevel?: string } }>('/plan/me').catch(() => null),
          api.get<{ streakDays?: number }>('/student/dashboard').catch(() => null),
        ])
        setTargetLevel(planRes?.data?.plan?.targetLevel ?? 'A1')
        setStreakDays(Number(dashRes?.data?.streakDays ?? 0))
        await loadDetail()
      } catch (e: unknown) {
        const status = httpStatus(e)
        if (status === 401) {
          router.push('/login')
          return
        }
        if (status === 404) {
          router.push('/student/plan')
          return
        }
        setLoadError('Khong the tai buoi hoc. Vui long thu lai.')
      } finally {
        setLoading(false)
      }
    })()
  }, [router, loadDetail])

  useEffect(() => {
    if (!detail) return
    setDragOrders((prev) => {
      const next = { ...prev }
      const all = [...(detail.theoryGateExercises ?? []), ...(detail.exercises ?? [])]
      for (const e of all) {
        if (isOrderDrag(e.format) && !next[e.id]) {
          next[e.id] = [...(e.options ?? [])]
        }
      }
      return next
    })
  }, [detail])

  const theoryGatePassed = detail?.theoryGatePassed ?? false

  useEffect(() => {
    if (!theoryGatePassed) return
    setAnswerHighlights((prev) => {
      const next = { ...prev }
      for (const k of Object.keys(next)) {
        if (k.startsWith('gt')) delete next[k]
      }
      return next
    })
  }, [theoryGatePassed])

  const canSubmitGate = useMemo(() => {
    if (!detail || theoryGatePassed) return false
    const list = detail.theoryGateExercises ?? []
    return list.every((e: ExerciseItem) => {
      if (isTextExerciseFormat(e.format)) {
        return String(gateAnswers[e.id] ?? '').trim().length > 0
      }
      if (isOrderDrag(e.format)) {
        const ord = dragOrders[e.id] ?? e.options ?? []
        return ord.length > 0
      }
      return gateAnswers[e.id] !== undefined && gateAnswers[e.id] !== ''
    })
  }, [detail, theoryGatePassed, gateAnswers, dragOrders])

  const canSubmitMain = useMemo(() => {
    if (!detail || !theoryGatePassed) return false
    const required = reinforcementIds && reinforcementIds.length > 0
      ? detail.exercises.filter((e) => reinforcementIds.includes(e.id))
      : detail.exercises
    return required.every((e: ExerciseItem) => {
      if (isTextExerciseFormat(e.format)) {
        return String(answers[e.id] ?? '').trim().length > 0
      }
      if (isOrderDrag(e.format)) {
        const ord = dragOrders[e.id] ?? e.options ?? []
        return ord.length > 0
      }
      return answers[e.id] !== undefined && answers[e.id] !== ''
    })
  }, [detail, theoryGatePassed, answers, reinforcementIds, dragOrders])

  const theoryExtras = useMemo(() => {
    if (!detail?.theoryLesson) return detail?.theory ?? []
    const focus = new Set(detail.theoryLesson.focusBullets ?? [])
    return (detail.theory ?? []).filter((x) => !focus.has(x))
  }, [detail])

  const shellInitials = useMemo(
    () =>
      (shellUser?.displayName ?? 'U')
        .split(' ')
        .map((p) => p.charAt(0))
        .join('')
        .toUpperCase()
        .slice(0, 2),
    [shellUser?.displayName],
  )

  const mergeAnswersForSubmit = (list: ExerciseItem[], base: Record<string, number | string>) => {
    const out: Record<string, number | string> = { ...base }
    for (const e of list) {
      if (isOrderDrag(e.format)) {
        const ord = dragOrders[e.id] ?? e.options ?? []
        out[e.id] = ord.join('|')
      }
    }
    return out
  }

  if (loading) {
    return (
      <div className="min-h-screen df-page-mesh flex items-center justify-center">
        <p className="text-muted-foreground">{t('loading')}</p>
      </div>
    )
  }

  if (loadError) {
    const errInner = (
      <div className="df-glass-subtle mx-auto max-w-md rounded-2xl border border-red-200/80 bg-red-50/90 p-6 text-center shadow-lg">
        <p className="text-sm text-red-700">{loadError}</p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            className="btn-primary btn-md"
            onClick={() => {
              setLoading(true)
              loadDetail()
                .catch((e: unknown) => {
                  const status = httpStatus(e)
                  if (status === 401) {
                    router.push('/login')
                    return
                  }
                  if (status === 404) {
                    router.push('/student/plan')
                    return
                  }
                  setLoadError('Khong the tai buoi hoc. Vui long thu lai.')
                })
                .finally(() => setLoading(false))
            }}
          >
            Thu lai
          </button>
          <button type="button" className="btn-outline btn-md" onClick={() => router.push('/student/plan')}>
            Ve ke hoach hoc
          </button>
        </div>
      </div>
    )

    if (shellUser) {
      return (
        <StudentShell
          activeSection="courses"
          user={shellUser}
          targetLevel={targetLevel}
          streakDays={streakDays}
          initials={shellInitials}
          onLogout={() => {
            logout()
          }}
          headerTitle={t('weekSession', { week, session: sessionIndex })}
        >
          {errInner}
        </StudentShell>
      )
    }

    return (
      <div className="df-page-mesh flex min-h-screen items-center justify-center px-4">
        {errInner}
      </div>
    )
  }

  if (!detail) return null

  const sessionBody = (
    <>
      <SuccessModal
        open={successModal.open}
        variant={successModal.variant}
        explanations={successModal.explanations}
        nextWeek={successModal.nextWeek}
        nextSessionIndex={successModal.nextSessionIndex}
        onClose={() => setSuccessModal((m) => ({ ...m, open: false }))}
      />
      <div className="page-container max-w-4xl px-4 sm:px-6 py-4 md:py-6">
        <div className="section-card df-glass-subtle rounded-[20px] p-6 mb-6 border-2 border-[#E2E8F0]/80 shadow-[0_4px_20px_rgba(0,48,94,0.08)]">
          <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
            <h2 className="text-lg font-semibold text-foreground">{t('theoryTitle')}</h2>
            {!theoryGatePassed ? <p className="text-sm text-amber-600 dark:text-amber-400">{t('theoryGateHint')}</p> : null}
          </div>

          {detail.theoryLesson ? (
            <div className="space-y-8">
              <div>
                <h3 className="text-base font-semibold text-foreground mb-2">{detail.theoryLesson.title}</h3>
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{detail.theoryLesson.overview}</p>
              </div>

              {(detail.theoryLesson.focusBullets?.length ?? 0) > 0 && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">{t('focusLabel')}</p>
                  <ul className="space-y-2">
                    {detail.theoryLesson.focusBullets.map((b) => (
                      <li key={b} className="text-sm text-foreground flex gap-2">
                        <span className="mt-1.5 w-2 h-2 rounded-full bg-accent flex-shrink-0" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('vocabNew')}</p>
                </div>
                <ul className="space-y-4">
                  {detail.theoryLesson.vocabulary.map((row) => (
                    <li key={row.german + row.exampleDe} className="rounded-lg border border-border p-4 bg-muted/20">
                      <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex h-7 min-w-7 items-center justify-center rounded-md px-2 text-[11px] font-bold text-white ${genderBgClass(row.gender ?? inferGenderFromGermanText(row.german))}`}>
                            {(row.gender ?? inferGenderFromGermanText(row.german) ?? 'N').slice(0, 3)}
                          </span>
                          <p className="font-semibold text-foreground">{row.german}</p>
                        </div>
                        <HearBtn text={row.speakDe || row.german} />
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{row.meaning}</p>
                      <div className="flex flex-wrap items-start justify-between gap-2 text-sm">
                        <div>
                          <HoverMeaningSentence german={row.exampleDe} vietnamese={row.exampleTranslation} />
                          {row.exampleTranslation ? (
                            <p className="text-muted-foreground text-xs mt-2">Hover để xem nghĩa tiếng Việt.</p>
                          ) : null}
                        </div>
                        <HearBtn text={row.exampleDe}>{t('hearSentence')}</HearBtn>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3">{t('phrasesLabel')}</p>
                <ul className="space-y-3">
                  {detail.theoryLesson.phrases.map((row) => (
                    <li key={row.german} className="rounded-lg border border-border p-3 flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-foreground">{row.german}</p>
                        <p className="text-sm text-muted-foreground mt-1">{row.meaning}</p>
                      </div>
                      <HearBtn text={row.speakDe || row.german} />
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3">{t('examplesLabel')}</p>
                <ul className="space-y-4">
                  {detail.theoryLesson.examples.map((row) => (
                    <li key={row.german} className="rounded-lg border border-border p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                        <p className="text-foreground font-medium">{row.german}</p>
                        <HearBtn text={row.speakDe || row.german} />
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{row.translation}</p>
                      <p className="text-xs text-foreground/90 leading-relaxed border-l-2 border-accent pl-3">{row.note}</p>
                    </li>
                  ))}
                </ul>
              </div>

              {theoryExtras.length > 0 && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">{t('planNotes')}</p>
                  <ul className="space-y-2">
                    {theoryExtras.map((line) => (
                      <li key={line} className="text-sm text-foreground flex gap-2">
                        <span className="mt-1.5 w-2 h-2 rounded-full bg-muted-foreground/40 flex-shrink-0" />
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <ul className="space-y-2">
              {(detail.theory ?? []).map((line) => (
                <li key={line} className="text-sm text-foreground flex gap-2">
                  <span className="mt-1.5 w-2 h-2 rounded-full bg-accent flex-shrink-0" />
                  <span>{line}</span>
                </li>
              ))}
              {(!detail.theory || detail.theory.length === 0) && <li className="text-sm text-muted-foreground">—</li>}
            </ul>
          )}
        </div>

        {!theoryGatePassed ? (
          <div className="section-card rounded-[20px] p-6 mb-6 border-2 border-[#FDE68A] shadow-[0_4px_20px_rgba(0,48,94,0.08)]">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="inline-flex items-center rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-800 dark:text-amber-200">
                {t('theoryGateBadge')}
              </span>
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-1">{t('theoryGateTitle')}</h2>
            <p className="text-sm text-muted-foreground mb-4">{t('theoryGateSubtitle')}</p>
            <div className="space-y-4">
              {(detail.theoryGateExercises ?? []).map((ex) =>
                exerciseBlock(ex, gateAnswers, setGateAnswers, dragOrders, setDragOrders, t, answerHighlights[ex.id])
              )}
            </div>
            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                className="btn-outline btn-md"
                onClick={() => {
                  setGateAnswers({})
                  setDragOrders({})
                  setAnswerHighlights((prev) => {
                    const next = { ...prev }
                    for (const ex of detail.theoryGateExercises ?? []) delete next[ex.id]
                    return next
                  })
                }}
              >
                {t('redo')}
              </button>
              <button
                className="btn-primary btn-md"
                disabled={!canSubmitGate}
                onClick={() => {
                  const payload = mergeAnswersForSubmit(detail.theoryGateExercises ?? [], gateAnswers)
                  api
                    .post('/plan/sessions/submit', {
                      week,
                      sessionIndex,
                      answers: payload,
                      phase: 'THEORY_GATE',
                    })
                    .then((res) => {
                      const data = res.data as SubmitResponse
                      if (data.scorePercent === 100) {
                        setAnswerHighlights((prev) => {
                          const next = { ...prev }
                          for (const ex of detail.theoryGateExercises ?? []) delete next[ex.id]
                          return next
                        })
                        const expl = mergeExplanationRows(detail.theoryGateExercises ?? [], data.itemResults)
                        setSavedExplanations((s) => ({ ...s, gate: expl }))
                        setSuccessModal({ open: true, variant: 'gate', explanations: expl, nextWeek: null, nextSessionIndex: null })
                        loadDetail().then(() => setGateAnswers({}))
                      } else {
                        setAnswerHighlights((prev) => {
                          const next = { ...prev }
                          for (const ex of detail.theoryGateExercises ?? []) delete next[ex.id]
                          return { ...next, ...itemResultsToHighlights(data.itemResults) }
                        })
                      }
                    })
                }}
              >
                {t('submitGate')}
              </button>
            </div>
          </div>
        ) : null}

        {theoryGatePassed && savedExplanations.gate && savedExplanations.gate.length > 0 ? (
          <div className="section-card rounded-[16px] p-5 mb-6 border-2 border-[#FDE68A] shadow-[0_2px_12px_rgba(0,48,94,0.06)]">
            <h3 className="text-base font-semibold text-foreground mb-3">{t('explanationsGateHeading')}</h3>
            <ul className="space-y-2 max-h-64 overflow-y-auto text-sm">
              {savedExplanations.gate.map((row) => (
                <li key={`sg-${row.index}`} className="rounded-lg border border-border px-3 py-2 bg-muted/15">
                  <span className="text-xs font-medium text-muted-foreground">
                    {t('questionN', { n: row.index })} · {row.title}
                  </span>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{row.explanation?.trim() || t('explanationMissing')}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="section-card rounded-[20px] p-6 relative border-2 border-[#E2E8F0] shadow-[0_4px_20px_rgba(0,48,94,0.08)]">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="inline-flex items-center rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-800 dark:text-amber-200">
              {t('mainExercisesBadge')}
            </span>
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-1">{t('exercisesTitle')}</h2>
          {!theoryGatePassed ? <p className="text-sm text-amber-700 dark:text-amber-300 mb-4 font-medium">{t('mainLocked')}</p> : null}
          {reinforcementIds && reinforcementIds.length > 0 ? <p className="text-sm text-muted-foreground mb-4">{t('reinforcement')}</p> : null}
          <div className="relative">
            {!theoryGatePassed ? (
              <div
                className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-background/80 backdrop-blur-[6px] p-4"
                aria-hidden
              >
                <div className="max-w-md rounded-2xl border border-amber-500/35 bg-card/95 px-6 py-5 text-center shadow-xl ring-1 ring-amber-500/20">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15 ring-1 ring-amber-500/25">
                    <Lock className="h-6 w-6 text-amber-600 dark:text-amber-400" aria-hidden />
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">{t('mainLockedCardTitle')}</p>
                  <p className="mt-2 text-sm leading-relaxed text-foreground">{t('mainLockedOverlay')}</p>
                </div>
              </div>
            ) : null}
            <div className={`space-y-4 ${!theoryGatePassed ? 'pointer-events-none select-none min-h-[120px] opacity-40' : ''}`}>
              {(detail.exercises ?? []).map((ex) =>
                exerciseBlock(
                  ex,
                  answers,
                  setAnswers,
                  dragOrders,
                  setDragOrders,
                  t,
                  answerHighlights[ex.id],
                  !!reinforcementIds && reinforcementIds.length > 0 && !reinforcementIds.includes(ex.id)
                )
              )}
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-2">
            <button
              className="btn-outline btn-md"
              onClick={() => {
                setAnswers({})
                setReinforcementIds(null)
                setReinforcementExercises(null)
                setDragOrders({})
                setAnswerHighlights((prev) => {
                  const next = { ...prev }
                  const list = detail.exercises
                  for (const ex of list) delete next[ex.id]
                  return next
                })
              }}
              disabled={!theoryGatePassed}
            >
              {t('redo')}
            </button>
            <button
              className="btn-primary btn-md"
              disabled={!canSubmitMain}
              onClick={() => {
                const requiredIds = reinforcementIds && reinforcementIds.length > 0 ? reinforcementIds : null
                const list = requiredIds ? detail.exercises.filter((e) => requiredIds.includes(e.id)) : detail.exercises
                const payload = mergeAnswersForSubmit(list, answers)
                api
                  .post('/plan/sessions/submit', {
                    week,
                    sessionIndex,
                    answers: payload,
                    exerciseIds: requiredIds ?? undefined,
                    phase: 'MAIN',
                  })
                  .then((res) => {
                    const data = res.data as SubmitResponse
                    if (data.scorePercent === 100) {
                      setAnswerHighlights((prev) => {
                        const next = { ...prev }
                        for (const ex of list) delete next[ex.id]
                        return next
                      })
                      const expl = mergeExplanationRows(list, data.itemResults)
                      setSavedExplanations((s) => ({ ...s, main: expl }))
                      setSuccessModal({
                        open: true,
                        variant: 'main',
                        explanations: expl,
                        nextWeek: data.nextWeek,
                        nextSessionIndex: data.nextSessionIndex,
                      })
                      setReinforcementIds(null)
                      setReinforcementExercises(null)
                      setAnswers({})
                    } else {
                      setAnswerHighlights((prev) => {
                        const next = { ...prev }
                        for (const ex of list) delete next[ex.id]
                        return { ...next, ...itemResultsToHighlights(data.itemResults) }
                      })
                      setReinforcementIds(data.requiredExerciseIds ?? null)
                      setReinforcementExercises((data.reinforcementExercises as ExerciseItem[]) ?? null)
                    }
                  })
              }}
            >
              {t('submit')}
            </button>
          </div>
        </div>

        {savedExplanations.main && savedExplanations.main.length > 0 ? (
          <div className="section-card rounded-[16px] p-5 mt-6 border-2 border-[#E2E8F0] shadow-[0_2px_12px_rgba(0,48,94,0.06)]">
            <h3 className="text-base font-semibold text-foreground mb-3">{t('explanationsMainHeading')}</h3>
            <ul className="space-y-2 max-h-72 overflow-y-auto text-sm">
              {savedExplanations.main.map((row) => (
                <li key={`sm-${row.index}`} className="rounded-lg border border-border px-3 py-2 bg-muted/15">
                  <span className="text-xs font-medium text-muted-foreground">
                    {t('questionN', { n: row.index })} · {row.title}
                  </span>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{row.explanation?.trim() || t('explanationMissing')}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </>
  )

  if (!shellUser) {
    return <div className="df-page-mesh min-h-screen">{sessionBody}</div>
  }

  return (
    <StudentShell
      activeSection="courses"
      user={shellUser}
      targetLevel={targetLevel}
      streakDays={streakDays}
      initials={shellInitials}
      onLogout={() => {
        logout()
      }}
      headerTitle={t('weekSession', { week: detail.week, session: detail.sessionIndex })}
      headerSubtitle={t('meta', { type: detail.type, minutes: detail.minutes, difficulty: detail.difficulty })}
      headerRight={
        <button
          type="button"
          className="btn-outline btn-sm border-[#E2E8F0] bg-white text-[#00305E]"
          onClick={() => router.push('/student/plan')}
        >
          {t('backPlan')}
        </button>
      }
    >
      {sessionBody}
    </StudentShell>
  )
}
