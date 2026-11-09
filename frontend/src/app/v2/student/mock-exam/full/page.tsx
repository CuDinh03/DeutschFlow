'use client'

import * as React from 'react'
import { Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight, Headphones, PenLine, Send } from 'lucide-react'
import { apiMessage } from '@/lib/api'
import { sendKeepalive } from '@/lib/exam/keepalive'
import {
  createDraftAutosaver,
  parseDraftAnswers,
  resyncCountdown,
  type DraftAutosaver,
} from '@/lib/exam/examDraftSync'
import {
  askAttemptItemAi,
  finishAttempt,
  getAttemptAnalysis,
  getAttemptResult,
  listMyAttempts,
  PARTIAL,
  partialInfo,
  saveAttemptDraft,
  startAttempt,
  stopAttempt,
  type AttemptAnalysis,
  type AttemptResult,
} from '@/lib/exam/mockAttemptApi'
import { getPracticeOverview } from '@/lib/telcPracticeApi'
import { examSpeakingApi } from '@/lib/examSpeakingApi'
import { useTracking } from '@/hooks/useTracking'
import { ConfirmDialog, ErrorBanner, LoadingState } from '@/components/ui-v2'
import { PracticeShell, type PracticeSaveState } from '@/components/exam/practice/PracticeShell'
import { ObjectiveTeilView } from '@/components/exam/practice/ObjectiveTeilView'
import { HoerenTeilView } from '@/components/exam/practice/HoerenTeilView'
import { WritingTeilView } from '@/components/exam/practice/WritingTeilView'
import { WritingResultView } from '@/components/exam/practice/WritingResultView'
import { displayedPoints, itemLabel, kindOf } from '@/components/exam/practice/practiceModel'
import { ItemAssist, useCachedAsk, type ItemAssistValue } from '@/components/exam/practice/itemAssist'
import { FlaggedNav, type FlaggedEntry } from '@/components/exam/mock/FlaggedNav'
import {
  fullTeile,
  resumeIndex,
  teilProgress,
  unansweredCount,
  writingKey,
  type FullTeil,
} from '@/components/exam/practice/fullExamModel'
import { SPLIT_MIN_WIDTH, useWide } from '@/components/exam/practice/useWide'
import { MockStart } from '@/components/exam/mock/MockStart'
import { GradingSteps, HoerenRitual } from '@/components/exam/mock/HoerenRitual'
import { ResultSummary } from '@/components/exam/mock/ResultSummary'
import { PartialSummary } from '@/components/exam/mock/PartialSummary'
import { REWRITE_KEY, firstIdxOf, lastIdxOf, nextStage, resumeStage, stageOf } from '@/components/exam/mock/mockModel'
import { oralHref } from '@/components/exam/today/todayModel'

const HUB = '/v2/student/exam'

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
    return <MockEntry examId={examId} autoStart={params.get('start') === '1'} onFinished={(id) => router.replace(`/v2/student/mock-exam/full?attemptId=${id}`)} />
  }
  return (
    <div className="p-6">
      <ErrorBanner message={t('badLink')} />
    </div>
  )
}

// ─── trước khi thi ───────────────────────────────────────────────────────────

/**
 * Màn chọn kiểu lượt trước khi đồng hồ chạy (đợt (d)). Đồng hồ của server chỉ bắt đầu khi bấm
 * "Bắt đầu" (gọi /start). Lượt đang dở thì nút là "Làm tiếp phần viết".
 */
function MockEntry({ examId, autoStart, onFinished }: { examId: number; autoStart: boolean; onFinished: (attemptId: number) => void }) {
  const t = useTranslations('v2.student.fullExam')
  const [started, setStarted] = React.useState(autoStart)
  const [info, setInfo] = React.useState<{ title: string; points: Record<string, number>; running: boolean; oralTaken: boolean } | null>(null)
  const fallbackTitle = t('examCap')

  React.useEffect(() => {
    if (started) return
    let alive = true
    Promise.all([
      getPracticeOverview(examId).catch(() => null),
      listMyAttempts().catch(() => []),
      examSpeakingApi
        .listResults()
        .then((r) => r.data ?? [])
        .catch(() => null),
    ]).then(([o, mine, orals]) => {
      if (!alive) return
      const points: Record<string, number> = {}
      for (const x of o?.teile ?? []) {
        const id = x.section === 'SPRACHBAUSTEINE' ? 'LESEN' : x.section
        points[id] = (points[id] ?? 0) + x.maxPoints
      }
      const own = mine.filter((a) => a.exam_id === examId)
      setInfo({
        title: o?.title ?? own[0]?.exam_title ?? fallbackTitle,
        points,
        running: own.some((a) => a.status === 'IN_PROGRESS'),
        // không đọc được thì coi như đã thi, để không gợi ý sai
        oralTaken: orals == null || orals.some((r) => r.total != null),
      })
    })
    return () => {
      alive = false
    }
  }, [examId, started, fallbackTitle])

  if (started) return <AttemptTaking examId={examId} onFinished={onFinished} />
  if (!info) return <div className="p-6"><LoadingState label={t('loading')} /></div>
  return (
    <MockStart
      examTitle={info.title}
      points={info.points}
      running={info.running}
      oralTaken={info.oralTaken}
      backHref={`/v2/student/mock-exam/practice?examId=${examId}`}
      oralHref={oralHref(null)}
      onStart={() => setStarted(true)}
    />
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
  // B3: câu "đánh dấu xem lại" — lưu cùng nháp trên server (V373), tải lại trang vẫn còn.
  const [flags, setFlags] = React.useState<string[]>([])
  const [jump, setJump] = React.useState<{ id: string; n: number; teilIdx: number } | null>(null)
  // Chặng đang làm: 0 Lesen + Sprachbausteine · 1 Hören · 2 Schreiben. Sang chặng sau thì khoá chặng trước.
  const [stage, setStage] = React.useState(0)
  const [ritual, setRitual] = React.useState(false)
  const [stageConfirm, setStageConfirm] = React.useState(false)
  const [timedOut, setTimedOut] = React.useState(false)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const router = useRouter()
  // Dừng giữa chừng (07/11/2026): hộp xác nhận liệt kê Teil sẽ tính / không tính.
  const [stopOpen, setStopOpen] = React.useState(false)
  const [stopping, setStopping] = React.useState(false)
  const [stopFailed, setStopFailed] = React.useState(false)

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
        setFlags(s.flags ?? [])
        const at = resumeIndex(list, s.sectionIndex)
        let saved: number | null = null
        try {
          const raw = window.localStorage.getItem(`df.fullExam.stage.${s.attemptId}`)
          saved = raw != null && Number.isFinite(Number(raw)) ? Number(raw) : null
        } catch {
          /* bỏ qua */
        }
        const st = resumeStage(list, at, saved)
        setStage(st)
        setIdx(stageOf(list[at].section) === st ? at : firstIdxOf(list, st))
        setTimeLeft(s.remainingSeconds)
        const restored = Object.keys(s.answers).length
        if (s.closedAttemptId) toast.info(t('closedPrevious'))
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
      setTimedOut(true)
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
        if (draft?.flags) setFlags(draft.flags)
        setSaveState('saved')
        toast.info(t('draftConflict'))
      },
      onExpired: () => {
        if (submittedRef.current) return
        submittedRef.current = true
        setTimedOut(true)
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
    autosaverRef.current?.notifyChange({ answers, sectionIndex, flags })
  }, [attemptId, answers, sectionIndex, flags])

  // Rời trang: đẩy nháp chưa lưu bằng fetch keepalive (axios không sống quá document).
  React.useEffect(() => {
    if (!attemptId) return
    const flush = () => {
      // Đã nộp/đã dừng: lượt đóng, không gửi nháp nữa (server cũng trả 409).
      if (submittingRef.current) return
      const snap = autosaverRef.current?.getSnapshot()
      if (!snap) return
      sendKeepalive('PATCH', `/mock-exams/attempts/${attemptId}/draft`, {
        answers: snap.payload.answers,
        sectionIndex: snap.payload.sectionIndex,
        ...(snap.payload.flags ? { flags: snap.payload.flags } : {}),
        baseVersion: snap.baseVersion,
      })
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

  const enterStage = React.useCallback(
    (next: number) => {
      setRitual(false)
      setStageConfirm(false)
      setStage(next)
      setIdx(firstIdxOf(teile, next))
      try {
        if (attemptId) window.localStorage.setItem(`df.fullExam.stage.${attemptId}`, String(next))
      } catch {
        /* bỏ qua */
      }
    },
    [attemptId, teile],
  )

  const onAnswer = React.useCallback((id: string, value: string | null) => {
    dirty.current = true
    setAnswers((prev) => {
      const next = { ...prev }
      if (value == null) delete next[id]
      else next[id] = value
      return next
    })
  }, [])

  const toggleFlag = React.useCallback((id: string) => {
    dirty.current = true
    setFlags((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }, [])
  const flagSet = React.useMemo(() => new Set(flags), [flags])
  // Rời Teil của lần nhảy (tự chuyển Teil) ⇒ bỏ yêu cầu nhảy, quay lại Teil đó không bị kéo tới câu cũ.
  React.useEffect(() => {
    setJump((j) => (j && j.teilIdx !== idx ? null : j))
  }, [idx])
  const assist = React.useMemo<ItemAssistValue>(() => ({ flags: flagSet, onToggleFlag: toggleFlag, jump }), [flagSet, toggleFlag, jump])

  // ── dừng giữa chừng ─────────────────────────────────────────────────────────
  // Bấm dừng: chặn autosave + keepalive, gửi /stop (server chấm theo Teil, dừng đồng hồ tại finished_at),
  // rồi tắt hẳn autosaver. Lỗi mạng ⇒ mở lại lượt như cũ, hộp báo chưa dừng được.
  const touchedAny = Object.values(answers).some((v) => !!v && v.trim() !== '')
  const stopNow = async () => {
    if (!attemptId || submittingRef.current) return
    submittingRef.current = true
    setStopping(true)
    setStopFailed(false)
    try {
      const r = await stopAttempt(attemptId, answersRef.current)
      autosaverRef.current?.dispose()
      autosaverRef.current = null
      setStopOpen(false)
      trackFeatureAction('mock_exam', 'quit', { examId, attemptId, status: r.status })
      if (r.status === PARTIAL || (r.alreadyClosed && r.status === 'COMPLETED')) onFinished(attemptId)
      else router.push(HUB)
    } catch {
      submittingRef.current = false
      setStopping(false)
      setStopFailed(true)
      setStopOpen(true)
    }
  }
  const requestExit = () => {
    if (phase !== 'taking' || !attemptId) {
      router.push(HUB)
      return
    }
    if (!touchedAny) {
      // Chưa chạm câu nào: huỷ lượt (không vào lịch sử) rồi rời, không hỏi. Huỷ lỗi thì vẫn rời —
      // lượt rỗng sẽ được chốt CANCELLED khi quá giờ.
      submittingRef.current = true
      void stopAttempt(attemptId, {})
        .catch(() => undefined)
        .finally(() => router.push(HUB))
      return
    }
    setStopFailed(false)
    setStopOpen(true)
  }

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
        <GradingSteps
          title={timedOut ? t('timeUpTitle') : t('gradingTitle')}
          steps={[
            { label: t('stepObjective'), state: 'done' },
            { label: t('stepWriting'), state: 'run' },
            { label: t('stepPlan'), state: 'wait' },
          ]}
        />
      </PracticeShell>
    )
  }

  const cur = teile[idx]
  const kind = kindOf(cur.data, cur.key)
  const progress = teilProgress(cur, answers)
  const left = unansweredCount(teile, answers)
  const title = tp(`teilTitle.${cur.data.type ?? cur.section}`)
  const subtitle = t('subtitle', { section: tp(`section.${cur.section}`), n: cur.no })

  const teilName = (x: FullTeil) => (x.section === 'SCHREIBEN' ? 'Schreiben' : `${tp(`sectionDe.${x.section}`)} Teil ${x.no}`)
  const stopDetails: React.ReactNode[] = []
  const counted: string[] = []
  const skipped: string[] = []
  for (const x of teile) {
    const p = teilProgress(x, answers)
    if (x.section === 'SCHREIBEN') {
      if (p.done > 0) stopDetails.push(t('stopWriting'))
      else skipped.push(teilName(x))
      continue
    }
    if (p.done === 0) skipped.push(teilName(x))
    else counted.push(p.done < p.total ? t('stopTeilBlank', { teil: teilName(x), done: p.done, total: p.total, blank: p.total - p.done }) : t('stopTeilFull', { teil: teilName(x), done: p.done, total: p.total }))
  }
  if (counted.length > 0) stopDetails.unshift(t('stopCounted', { list: counted.join('; ') }))
  if (skipped.length > 0) stopDetails.push(t('stopSkipped', { list: skipped.join(', ') }))

  const after = nextStage(teile, stage)
  const firstOfStage = firstIdxOf(teile, stage)
  const lastOfStage = lastIdxOf(teile, stage)
  const goNextStage = () => {
    if (after == null) return
    if (after === 1) setRitual(true)
    else setStageConfirm(true)
  }

  let body: React.ReactNode
  if (ritual) {
    body = <HoerenRitual onStart={() => enterStage(1)} onBack={() => { setRitual(false); setIdx(lastOfStage) }} />
  } else if (cur.section === 'SCHREIBEN') {
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
    body = (
      <ItemAssist.Provider value={assist}>
        <HoerenTeilView key={cur.key} teil={cur.data} answers={answers} onAnswer={onAnswer} result={null} wide={wide} tips={null} />
      </ItemAssist.Provider>
    )
  } else if (kind !== 'unknown' && kind !== 'writing') {
    body = (
      <ItemAssist.Provider value={assist}>
        <ObjectiveTeilView key={cur.key} teil={cur.data} kind={kind} answers={answers} onAnswer={onAnswer} result={null} wide={wide} tips={null} />
      </ItemAssist.Provider>
    )
  } else {
    body = <div className="p-6"><ErrorBanner message={tp('teilMissing')} /></div>
  }

  // Câu đánh dấu của chặng đang thi (chặng trước đã khoá, không nhảy về được).
  const flagged: FlaggedEntry[] = []
  teile.forEach((x, i) => {
    if (stageOf(x.section) !== stage) return
    for (const it of x.data.items ?? []) {
      if (flagSet.has(it.id)) flagged.push({ id: it.id, teilIdx: i, teil: teilName(x), label: itemLabel(it) })
    }
  })
  const jumpToFlag = (e: FlaggedEntry) => {
    setRitual(false)
    setIdx(e.teilIdx)
    setJump((prev) => ({ id: e.id, n: (prev?.n ?? 0) + 1, teilIdx: e.teilIdx }))
  }

  const footer = (
    <>
      {error && <div className="w-full"><ErrorBanner message={error} /></div>}
      {stage !== 2 && <FlaggedNav entries={flagged} onJump={jumpToFlag} />}
      <NavBtn disabled={idx <= firstOfStage} onClick={() => setIdx((i) => Math.max(firstOfStage, i - 1))} label={t('prevTeil')}>
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
            const locked = stageOf(x.section) !== stage
            return (
              <option key={x.key} value={i} disabled={locked}>
                {t(locked ? 'jumpOptionLocked' : 'jumpOption', { section: tp(`sectionDe.${x.section}`), n: x.no, done: p.done, total: p.total })}
              </option>
            )
          })}
        </select>
      </label>
      <NavBtn disabled={idx >= lastOfStage} onClick={() => setIdx((i) => Math.min(lastOfStage, i + 1))} label={t('nextTeil')}>
        <ChevronRight size={16} aria-hidden />
      </NavBtn>
      {after != null && !ritual && (
        <button
          type="button"
          onClick={goNextStage}
          className="ga-ui inline-flex min-h-11 items-center justify-center gap-1.5 rounded-ga-touch border-[1.5px] border-ga-line-strong bg-ga-card px-4 text-ga-body font-semibold text-ga-ink hover:bg-ga-side-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus"
        >
          {after === 1 ? <Headphones size={15} aria-hidden /> : <PenLine size={15} aria-hidden />}
          {after === 1 ? t('toHoeren') : t('toSchreiben')}
        </button>
      )}
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
        onExit={requestExit}
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
      <ConfirmDialog
        open={stageConfirm}
        onOpenChange={setStageConfirm}
        title={t('toSchreibenTitle')}
        description={t('toSchreibenBody')}
        confirmLabel={t('toSchreiben')}
        cancelLabel={tc('cancel')}
        destructive={false}
        onConfirm={() => after != null && enterStage(after)}
      />
      <ConfirmDialog
        open={stopOpen}
        onOpenChange={setStopOpen}
        title={t('stopTitle')}
        description={stopFailed ? t('stopFailed') : t('stopBody')}
        details={stopFailed ? undefined : stopDetails}
        confirmLabel={stopFailed ? t('stopRetry') : t('stopConfirm')}
        cancelLabel={t('keepGoing')}
        destructive={false}
        loading={stopping}
        onConfirm={() => void stopNow()}
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
  const locale = useLocale()
  const router = useRouter()
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
  const partial = result?.status === PARTIAL ? partialInfo(result.detailed_scores_json) : null

  const teile = React.useMemo(() => fullTeile(analysis?.sectionsJson), [analysis])
  const byKey = React.useMemo(() => new Map(analysis?.teile.map((r) => [r.teilKey, r]) ?? []), [analysis])
  // B3: "Hỏi AI về câu này" ở màn xem lại từng Teil (Lesen, Sprachbausteine, Hören).
  const askRaw = React.useCallback(
    (itemId: string) => askAttemptItemAi(attemptId, open ?? '', itemId, locale),
    [attemptId, open, locale],
  )
  const askAi = useCachedAsk(open && !open.startsWith('SCHREIBEN') ? askRaw : null, `${attemptId}|${open ?? ''}`)
  const reviewAssist = React.useMemo<ItemAssistValue>(() => ({ askAi }), [askAi])

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
    const canRewrite = openTeil.section === 'SCHREIBEN' && analysis.examId > 0 && !!analysis.writingText
    const back = (
      <>
        <button
          type="button"
          onClick={() => setOpen(null)}
          className="ga-ui inline-flex min-h-11 items-center gap-1.5 rounded-ga-touch border-[1.5px] border-ga-line-strong bg-ga-card px-4 text-ga-body font-semibold text-ga-ink hover:bg-ga-side-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus"
        >
          <ChevronLeft size={16} aria-hidden /> {t('backToResult')}
        </button>
        {canRewrite && (
          <button
            type="button"
            onClick={() => {
              try {
                window.sessionStorage.setItem(REWRITE_KEY(analysis.examId), analysis.writingText ?? '')
              } catch {
                /* không lưu được thì mở bài luyện như thường */
              }
              router.push(`/v2/student/mock-exam/practice/teil?examId=${analysis.examId}&teil=${openTeil.key}&rewrite=1`)
            }}
            className="ga-ui inline-flex min-h-11 items-center gap-1.5 rounded-ga-touch bg-ga-yellow px-4 text-ga-body font-semibold text-ga-ink hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus"
          >
            <PenLine size={16} aria-hidden /> {tp('rewrite')}
          </button>
        )}
      </>
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
        <ItemAssist.Provider value={reviewAssist}>
          <HoerenTeilView key={openTeil.key} teil={openTeil.data} answers={given} onAnswer={() => undefined} result={r} wide={split} tips={null} />
        </ItemAssist.Provider>
      ) : kind !== 'unknown' && kind !== 'writing' ? (
        <ItemAssist.Provider value={reviewAssist}>
          <ObjectiveTeilView key={openTeil.key} teil={openTeil.data} kind={kind} answers={given} onAnswer={() => undefined} result={r} wide={split} tips={null} />
        </ItemAssist.Provider>
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
  if (partial) {
    return (
      <PracticeShell backHref={HUB} backLabel={t('backToHub')} subtitle={result.exam_title ?? result.title ?? ''} title={t('resultTitle')}>
        <PartialSummary
          result={result}
          info={partial}
          teile={teile}
          onOpen={setOpen}
          examHref={result.exam_id ? `/v2/student/mock-exam/full?examId=${result.exam_id}` : null}
          hubHref={HUB}
        />
      </PracticeShell>
    )
  }
  return (
    <PracticeShell backHref={HUB} backLabel={t('backToHub')} subtitle={result.exam_title ?? result.title ?? ''} title={t('resultTitle')}>
      <ResultSummary
        attemptId={attemptId}
        result={result}
        analysis={analysis}
        teile={teile}
        byKey={byKey}
        onOpen={setOpen}
        oralHref={oralHref(null)}
        hubHref={HUB}
      />
    </PracticeShell>
  )
}
