'use client'

import * as React from 'react'
import { Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight, Mic, Send } from 'lucide-react'
import api, { apiMessage } from '@/lib/api'
import { getAccessToken } from '@/lib/authSession'
import {
  createDraftAutosaver,
  parseDraftAnswers,
  resyncCountdown,
  type DraftAutosaver,
} from '@/lib/exam/examDraftSync'
import {
  finishAttempt,
  getAttemptAnalysis,
  getAttemptResult,
  saveAttemptDraft,
  sectionScores,
  startAttempt,
  type AttemptAnalysis,
  type AttemptResult,
} from '@/lib/exam/mockAttemptApi'
import { useTracking } from '@/hooks/useTracking'
import { ConfirmDialog, ErrorBanner, LoadingState } from '@/components/ui-v2'
import { PracticeShell, type PracticeSaveState } from '@/components/exam/practice/PracticeShell'
import { ObjectiveTeilView } from '@/components/exam/practice/ObjectiveTeilView'
import { HoerenTeilView } from '@/components/exam/practice/HoerenTeilView'
import { WritingTeilView } from '@/components/exam/practice/WritingTeilView'
import { WritingResultView } from '@/components/exam/practice/WritingResultView'
import { displayedPoints, kindOf } from '@/components/exam/practice/practiceModel'
import {
  fullTeile,
  resumeIndex,
  teilProgress,
  unansweredCount,
  writingKey,
  type FullTeil,
} from '@/components/exam/practice/fullExamModel'
import { SPLIT_MIN_WIDTH, useWide } from '@/components/exam/practice/useWide'
import { ExamGatePanel } from '@/components/exam/telc/ExamGatePanel'
import { ExamBudgetPanel } from '@/components/exam/telc/ExamBudgetPanel'
import { gateVerdict } from '@/components/exam/telc/examGates'

const HUB = '/v2/student/exam'
const fmt = (n: number) => n.toLocaleString('de-DE', { maximumFractionDigits: 1 })

/**
 * /v2/student/mock-exam/full — thi thử trọn đề telc trong giao diện luyện đề mới (06/11/2026,
 * thay trình thi cũ `/mock-exam/run`).
 *   ?examId=<id>     → làm bài (bắt đầu hoặc làm tiếp lượt đang dở — /start idempotent).
 *   ?attemptId=<id>  → kết quả: hai ngưỡng đỗ, điểm từng phần, xem lại từng Teil có phân tích.
 *
 * Khác chế độ luyện: một đồng hồ tổng của server, hết giờ thì tự nộp, đúng/sai chỉ hiện sau khi nộp
 * cả đề, lượt thi vào lịch sử. Phần Nói thi ở phòng thi nói AI; điểm tự vào ngưỡng "Nói".
 */
export default function FullExamRoute() {
  return (
    <Suspense fallback={<LoadingState label="…" />}>
      <FullExamPage />
    </Suspense>
  )
}

function FullExamPage() {
  const params = useSearchParams()
  const router = useRouter()
  const t = useTranslations('v2.student.fullExam')
  const examId = Number(params.get('examId')) || null
  const attemptId = Number(params.get('attemptId')) || null

  if (attemptId) return <AttemptResultView attemptId={attemptId} />
  if (examId) {
    return <AttemptTaking examId={examId} onFinished={(id) => router.replace(`/v2/student/mock-exam/full?attemptId=${id}`)} />
  }
  return (
    <div className="p-6">
      <ErrorBanner message={t('badLink')} />
    </div>
  )
}

// ─── làm bài ─────────────────────────────────────────────────────────────────

function AttemptTaking({ examId, onFinished }: { examId: number; onFinished: (attemptId: number) => void }) {
  const t = useTranslations('v2.student.fullExam')
  const tp = useTranslations('v2.student.practice')
  const tc = useTranslations('v2.common')
  const wide = useWide(SPLIT_MIN_WIDTH)
  const { trackFeatureAction } = useTracking()

  const [attemptId, setAttemptId] = React.useState<number | null>(null)
  const [teile, setTeile] = React.useState<FullTeil[]>([])
  const [idx, setIdx] = React.useState(0)
  const [answers, setAnswers] = React.useState<Record<string, string>>({})
  const [timeLeft, setTimeLeft] = React.useState<number | null>(null)
  const [saveState, setSaveState] = React.useState<PracticeSaveState>('idle')
  const [error, setError] = React.useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const [phase, setPhase] = React.useState<'taking' | 'grading'>('taking')
  const [ticks, setTicks] = React.useState<Record<string, boolean>>({})
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  const autosaverRef = React.useRef<DraftAutosaver | null>(null)
  const baseVersionRef = React.useRef(0)
  const submittingRef = React.useRef(false)
  const submittedRef = React.useRef(false)
  const answersRef = React.useRef(answers)
  answersRef.current = answers
  const startedRef = React.useRef(false)

  // ── bắt đầu / làm tiếp ─────────────────────────────────────────────────────
  React.useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    startAttempt(examId)
      .then((s) => {
        const list = fullTeile(s.sectionsJson)
        if (list.length === 0) throw new Error('NO_CONTENT')
        baseVersionRef.current = s.draftVersion
        setAttemptId(s.attemptId)
        setTeile(list)
        setAnswers(s.answers)
        setIdx(resumeIndex(list, s.sectionIndex))
        setTimeLeft(s.remainingSeconds)
        const restored = Object.keys(s.answers).length
        if (restored > 0) toast.success(t('draftRestored', { count: restored }))
        trackFeatureAction('mock_exam', 'started', { examId, ui: 'full', resumedAnswers: restored })
      })
      .catch((e) => setError(e instanceof Error && e.message === 'NO_CONTENT' ? t('noContent') : apiMessage(e) || t('startError')))
  }, [examId, t, trackFeatureAction])

  React.useEffect(() => {
    if (!attemptId) return
    try {
      setTicks(JSON.parse(window.localStorage.getItem(`df.fullExam.ticks.${attemptId}`) ?? '{}'))
    } catch {
      /* bỏ qua */
    }
  }, [attemptId])

  // ── nộp ─────────────────────────────────────────────────────────────────────
  const submit = React.useCallback(async () => {
    if (!attemptId || submittingRef.current) return
    submittingRef.current = true
    setConfirmOpen(false)
    setPhase('grading')
    try {
      await autosaverRef.current?.flush().catch(() => undefined)
      const { alreadyFinished } = await finishAttempt(attemptId, answersRef.current)
      if (alreadyFinished) toast.info(t('alreadySubmitted'))
      trackFeatureAction('mock_exam', 'completed', { examId, attemptId, ui: 'full' })
      onFinished(attemptId)
    } catch (e) {
      submittingRef.current = false
      submittedRef.current = false
      setPhase('taking')
      setError(apiMessage(e) || t('submitError'))
    }
  }, [attemptId, examId, onFinished, t, trackFeatureAction])
  const submitRef = React.useRef(submit)
  submitRef.current = submit

  // ── đồng hồ tổng: server sở hữu hạn giờ, mỗi lần lưu nháp kéo về sự thật của server ──
  const ticking = attemptId != null && phase === 'taking'
  React.useEffect(() => {
    if (!ticking) return
    const id = window.setInterval(() => setTimeLeft((s) => (s == null ? s : Math.max(0, s - 1))), 1000)
    return () => window.clearInterval(id)
  }, [ticking])
  React.useEffect(() => {
    if (timeLeft === 0 && phase === 'taking' && !submittedRef.current) {
      submittedRef.current = true
      toast.info(t('timeUp'))
      void submitRef.current()
    }
  }, [timeLeft, phase, t])

  // ── tự lưu nháp lên server ─────────────────────────────────────────────────
  React.useEffect(() => {
    if (!attemptId) return
    const autosaver = createDraftAutosaver({
      save: async (payload, baseVersion) => {
        if (submittingRef.current) return { kind: 'saved', version: baseVersion, remainingSeconds: null }
        return saveAttemptDraft(attemptId, payload, baseVersion)
      },
      onSaved: ({ version, remainingSeconds }) => {
        baseVersionRef.current = version
        setSaveState('saved')
        if (typeof remainingSeconds === 'number') setTimeLeft((prev) => resyncCountdown(prev ?? remainingSeconds, remainingSeconds))
      },
      onConflict: ({ serverVersion, draft }) => {
        if (submittingRef.current) return
        baseVersionRef.current = serverVersion
        autosaverRef.current?.adoptVersion(serverVersion)
        if (draft?.answersJson) setAnswers(parseDraftAnswers(draft.answersJson))
        setSaveState('saved')
        toast.info(t('draftConflict'))
      },
      onExpired: () => {
        if (submittedRef.current) return
        submittedRef.current = true
        toast.info(t('timeUp'))
        void submitRef.current()
      },
    })
    autosaver.adoptVersion(baseVersionRef.current)
    autosaverRef.current = autosaver
    return () => {
      autosaver.dispose()
      if (autosaverRef.current === autosaver) autosaverRef.current = null
    }
  }, [attemptId, t])

  const sectionIndex = teile[idx]?.sectionIndex ?? 0
  const dirty = React.useRef(false)
  React.useEffect(() => {
    if (!attemptId || !dirty.current) return
    setSaveState('saving')
    autosaverRef.current?.notifyChange({ answers, sectionIndex })
  }, [attemptId, answers, sectionIndex])

  // Rời trang: đẩy nháp chưa lưu bằng fetch keepalive (axios không sống quá document).
  React.useEffect(() => {
    if (!attemptId) return
    const flush = () => {
      const snap = autosaverRef.current?.getSnapshot()
      if (!snap) return
      const token = getAccessToken()
      try {
        void fetch(`${api.defaults.baseURL ?? ''}/mock-exams/attempts/${attemptId}/draft`, {
          method: 'PATCH',
          keepalive: true,
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ answers: snap.payload.answers, sectionIndex: snap.payload.sectionIndex, baseVersion: snap.baseVersion }),
        })
      } catch {
        /* lần mở sau làm tiếp từ bản lưu gần nhất */
      }
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [attemptId])

  const onAnswer = React.useCallback((id: string, value: string | null) => {
    dirty.current = true
    setAnswers((prev) => {
      const next = { ...prev }
      if (value == null) delete next[id]
      else next[id] = value
      return next
    })
  }, [])

  // ── khung ──────────────────────────────────────────────────────────────────
  if (error && teile.length === 0) {
    return (
      <PracticeShell backHref={HUB} subtitle={t('examCap')} title={t('loading')} backLabel={t('backToHub')}>
        <div className="p-6"><ErrorBanner message={error} /></div>
      </PracticeShell>
    )
  }
  if (teile.length === 0 || timeLeft == null) {
    return (
      <PracticeShell backHref={HUB} subtitle={t('examCap')} title={t('loading')} backLabel={t('backToHub')}>
        <div className="p-6"><LoadingState label={t('loading')} /></div>
      </PracticeShell>
    )
  }
  if (phase === 'grading') {
    return (
      <PracticeShell backHref={HUB} subtitle={t('examCap')} title={t('grading')} backLabel={t('backToHub')}>
        <div className="mx-auto max-w-[560px] p-6">
          <LoadingState label={t('grading')} />
          <p className="ga-ui mt-3 text-center text-ga-small text-ga-muted">{t('gradingDesc')}</p>
        </div>
      </PracticeShell>
    )
  }

  const cur = teile[idx]
  const kind = kindOf(cur.data, cur.key)
  const progress = teilProgress(cur, answers)
  const left = unansweredCount(teile, answers)
  const title = tp(`teilTitle.${cur.data.type ?? cur.section}`)
  const subtitle = t('subtitle', { section: tp(`section.${cur.section}`), n: cur.no })

  let body: React.ReactNode
  if (cur.section === 'SCHREIBEN') {
    const points = displayedPoints(cur.data.writing_points, cur.data.shuffle_points)
    const key = writingKey(cur.no)
    body = (
      <WritingTeilView
        teil={cur.data}
        points={points}
        text={answers[key] ?? ''}
        onText={(v) => onAnswer(key, v === '' ? null : v)}
        ticks={ticks}
        onTick={(label, on) =>
          setTicks((prev) => {
            const next = { ...prev, [label]: on }
            try {
              window.localStorage.setItem(`df.fullExam.ticks.${attemptId}`, JSON.stringify(next))
            } catch {
              /* bỏ qua */
            }
            return next
          })
        }
        wide={wide}
        tips={null}
        textareaRef={textareaRef}
      />
    )
  } else if (cur.section === 'HOEREN') {
    body = <HoerenTeilView key={cur.key} teil={cur.data} answers={answers} onAnswer={onAnswer} result={null} wide={wide} tips={null} />
  } else if (kind !== 'unknown' && kind !== 'writing') {
    body = <ObjectiveTeilView key={cur.key} teil={cur.data} kind={kind} answers={answers} onAnswer={onAnswer} result={null} wide={wide} tips={null} />
  } else {
    body = <div className="p-6"><ErrorBanner message={tp('teilMissing')} /></div>
  }

  const footer = (
    <>
      {error && <div className="w-full"><ErrorBanner message={error} /></div>}
      <NavBtn disabled={idx === 0} onClick={() => setIdx((i) => Math.max(0, i - 1))} label={t('prevTeil')}>
        <ChevronLeft size={16} aria-hidden />
      </NavBtn>
      <label className="ga-ui min-w-0 flex-1">
        <span className="sr-only">{t('jumpLabel')}</span>
        <select
          value={idx}
          onChange={(e) => setIdx(Number(e.target.value))}
          className="ga-ui min-h-11 w-full rounded-ga-touch border-[1.5px] border-ga-line-strong bg-ga-card px-3 text-ga-body text-ga-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus"
        >
          {teile.map((x, i) => {
            const p = teilProgress(x, answers)
            return (
              <option key={x.key} value={i}>
                {t('jumpOption', { section: tp(`sectionDe.${x.section}`), n: x.no, done: p.done, total: p.total })}
              </option>
            )
          })}
        </select>
      </label>
      <NavBtn disabled={idx === teile.length - 1} onClick={() => setIdx((i) => Math.min(teile.length - 1, i + 1))} label={t('nextTeil')}>
        <ChevronRight size={16} aria-hidden />
      </NavBtn>
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        className="ga-ui inline-flex min-h-11 items-center justify-center gap-1.5 rounded-ga-touch bg-ga-yellow px-4 text-ga-body font-semibold text-ga-ink hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus"
      >
        <Send size={15} aria-hidden /> {t('submit')}
      </button>
    </>
  )

  return (
    <>
      <PracticeShell
        backHref={HUB}
        backLabel={t('backToHub')}
        section={cur.section}
        subtitle={subtitle}
        title={title}
        progress={t('answeredOf', { done: progress.done, total: progress.total })}
        seconds={timeLeft}
        countdown
        saveState={saveState}
        footer={footer}
      >
        {body}
      </PracticeShell>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t('confirmTitle')}
        description={left > 0 ? t('confirmBodyLeft', { n: left }) : t('confirmBodyAll')}
        confirmLabel={t('submit')}
        cancelLabel={tc('cancel')}
        destructive={false}
        onConfirm={() => void submit()}
      />
    </>
  )
}

function NavBtn({ disabled, onClick, label, children }: { disabled: boolean; onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      className="ga-ui inline-flex min-h-11 min-w-11 items-center justify-center rounded-ga-touch border-[1.5px] border-ga-line-strong bg-ga-card text-ga-ink hover:bg-ga-side-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus disabled:opacity-40"
    >
      {children}
    </button>
  )
}

// ─── kết quả ─────────────────────────────────────────────────────────────────

function AttemptResultView({ attemptId }: { attemptId: number }) {
  const t = useTranslations('v2.student.fullExam')
  const tp = useTranslations('v2.student.practice')
  const wide = useWide()
  const split = useWide(SPLIT_MIN_WIDTH)
  const [result, setResult] = React.useState<AttemptResult | null>(null)
  const [analysis, setAnalysis] = React.useState<AttemptAnalysis | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [open, setOpen] = React.useState<string | null>(null)

  React.useEffect(() => {
    Promise.all([getAttemptResult(attemptId), getAttemptAnalysis(attemptId)])
      .then(([r, a]) => {
        setResult(r)
        setAnalysis(a)
      })
      .catch((e) => setError(apiMessage(e) || t('resultError')))
  }, [attemptId, t])

  const teile = React.useMemo(() => fullTeile(analysis?.sectionsJson), [analysis])
  const byKey = React.useMemo(() => new Map(analysis?.teile.map((r) => [r.teilKey, r]) ?? []), [analysis])

  if (error) {
    return (
      <PracticeShell backHref={HUB} backLabel={t('backToHub')} subtitle={t('resultCap')} title={t('resultTitle')}>
        <div className="p-6"><ErrorBanner message={error} /></div>
      </PracticeShell>
    )
  }
  if (!result || !analysis) {
    return (
      <PracticeShell backHref={HUB} backLabel={t('backToHub')} subtitle={t('resultCap')} title={t('resultTitle')}>
        <div className="p-6"><LoadingState label={t('loading')} /></div>
      </PracticeShell>
    )
  }

  // ── xem lại một Teil ──────────────────────────────────────────────────────
  const openTeil = open ? teile.find((x) => x.key === open) : null
  if (openTeil) {
    const back = (
      <button
        type="button"
        onClick={() => setOpen(null)}
        className="ga-ui inline-flex min-h-11 items-center gap-1.5 rounded-ga-touch border-[1.5px] border-ga-line-strong bg-ga-card px-4 text-ga-body font-semibold text-ga-ink hover:bg-ga-side-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus"
      >
        <ChevronLeft size={16} aria-hidden /> {t('backToResult')}
      </button>
    )
    const subtitle = t('subtitle', { section: tp(`section.${openTeil.section}`), n: openTeil.no })
    const title = tp(`teilTitle.${openTeil.data.type ?? openTeil.section}`)
    let body: React.ReactNode
    if (openTeil.section === 'SCHREIBEN') {
      const points = displayedPoints(openTeil.data.writing_points, openTeil.data.shuffle_points)
      body = analysis.writing && analysis.writing.status !== 'PENDING_AI_EVALUATION' ? (
        <WritingResultView evaluation={analysis.writing} text={analysis.writingText ?? ''} points={points} wide={wide} />
      ) : (
        <div className="mx-auto max-w-[760px] p-6"><p className="ga-ui text-ga-body text-ga-muted">{t('writingPending')}</p></div>
      )
    } else {
      const r = byKey.get(openTeil.key) ?? null
      const given = Object.fromEntries((r?.items ?? []).filter((i) => i.given).map((i) => [i.id, i.given as string]))
      const kind = kindOf(openTeil.data, openTeil.key)
      body = openTeil.section === 'HOEREN' ? (
        <HoerenTeilView key={openTeil.key} teil={openTeil.data} answers={given} onAnswer={() => undefined} result={r} wide={split} tips={null} />
      ) : kind !== 'unknown' && kind !== 'writing' ? (
        <ObjectiveTeilView key={openTeil.key} teil={openTeil.data} kind={kind} answers={given} onAnswer={() => undefined} result={r} wide={split} tips={null} />
      ) : (
        <div className="p-6"><ErrorBanner message={tp('teilMissing')} /></div>
      )
    }
    return (
      <PracticeShell backHref={HUB} backLabel={t('backToHub')} section={openTeil.section} subtitle={subtitle} title={title} footer={back}>
        {body}
      </PracticeShell>
    )
  }

  // ── tổng quan ─────────────────────────────────────────────────────────────
  const scores = sectionScores(result.detailed_scores_json)
  const verdict = gateVerdict(result.gates)
  const totalMax = Object.values(scores).reduce((s, x) => s + x.max, 0)
  const verdictText = verdict === 'PASSED' ? t('passed') : verdict === 'FAILED' ? t('failed') : verdict === 'INCOMPLETE' ? t('pending') : result.passed ? t('passed') : t('failed')
  const examTitle = result.exam_title ?? result.title ?? ''
  const oralPending = (result.gates ?? []).some((g) => g.id === 'oral' && g.status === 'PENDING')

  return (
    <PracticeShell
      backHref={HUB}
      backLabel={t('backToHub')}
      subtitle={examTitle}
      title={t('resultTitle')}
      footer={
        <>
          <Link href={HUB} className="ga-ui inline-flex min-h-11 flex-1 items-center justify-center rounded-ga-touch px-4 text-ga-body font-semibold text-ga-muted hover:bg-ga-side-active hover:text-ga-ink lg:flex-none">
            {t('backToHub')}
          </Link>
          {analysis.examId > 0 && (
            <Link
              href={`/v2/student/mock-exam/practice?examId=${analysis.examId}`}
              className="ga-ui inline-flex min-h-11 flex-1 items-center justify-center rounded-ga-touch bg-ga-yellow px-4 text-ga-body font-semibold text-ga-ink hover:opacity-90 lg:flex-none"
            >
              {t('practiceWeak')}
            </Link>
          )}
        </>
      }
    >
      <div className="mx-auto w-full max-w-[880px] space-y-5 px-3 py-5 lg:px-6">
        <section className="border border-ga-line bg-ga-card p-4 lg:p-5">
          <p className="ga-ui text-ga-eyebrow uppercase text-ga-muted">{t('resultCap')}</p>
          <p className="mt-1 font-ga-display text-ga-stat tabular-nums text-ga-ink">
            {fmt(result.total_score ?? 0)}
            {totalMax > 0 && <span className="text-ga-body text-ga-muted"> / {fmt(totalMax)}</span>}
          </p>
          <p className="ga-ui mt-1 text-ga-body-lg font-semibold text-ga-ink">{verdictText}</p>
        </section>

        {result.gates && result.gates.length > 0 && <ExamGatePanel gates={result.gates} />}

        {oralPending && (
          <Link
            href="/v2/student/speaking/exam"
            className="ga-ui flex min-h-16 items-center gap-3.5 border-[1.5px] border-ga-ink bg-ga-card px-4 py-3 hover:bg-ga-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus"
          >
            <Mic size={18} className="shrink-0 text-ga-ink" aria-hidden />
            <span className="min-w-0 flex-1">
              <b className="block text-ga-body-lg text-ga-ink">{t('oralCta')}</b>
              <span className="block text-ga-small text-ga-muted">{t('oralCtaDesc')}</span>
            </span>
            <ChevronRight size={16} className="shrink-0 text-ga-subtle" aria-hidden />
          </Link>
        )}

        <section className="border border-ga-line bg-ga-card">
          <h2 className="ga-ui border-b border-ga-line px-4 py-3 text-ga-eyebrow uppercase text-ga-muted">{t('reviewCap')}</h2>
          {teile.map((x) => {
            const r = byKey.get(x.key)
            const isWriting = x.section === 'SCHREIBEN'
            const s = scores[x.section]
            const meta = isWriting
              ? analysis.writing && analysis.writing.status !== 'PENDING_AI_EVALUATION'
                ? t('rowWriting', { score: fmt(s?.total ?? analysis.writing.total ?? 0), max: fmt(s?.max ?? 45) })
                : t('writingPendingShort')
              : r
                ? t('rowCorrect', { done: r.correctCount, total: r.total, score: fmt(r.score), max: fmt(r.max) })
                : ''
            return (
              <button
                key={x.key}
                type="button"
                onClick={() => setOpen(x.key)}
                className="ga-ui flex min-h-[4rem] w-full items-center gap-3.5 border-b border-ga-line px-4 py-2.5 text-left last:border-b-0 hover:bg-ga-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ga-focus"
              >
                <span className="w-24 shrink-0 text-ga-small text-ga-muted">{tp(`sectionDe.${x.section}`)} {x.no}</span>
                <span className="min-w-0 flex-1">
                  <b className="block text-ga-body font-semibold text-ga-ink">{tp(`teilTitle.${x.data.type ?? x.section}`)}</b>
                  <span className="block text-ga-small text-ga-muted">{meta}</span>
                </span>
                <ChevronRight size={16} className="shrink-0 text-ga-subtle" aria-hidden />
              </button>
            )
          })}
        </section>

        {result.budget && (
          <ExamBudgetPanel budget={result.budget} strategyExam={{ provider: 'TELC', level: 'B1' }} />
        )}
      </div>
    </PracticeShell>
  )
}
