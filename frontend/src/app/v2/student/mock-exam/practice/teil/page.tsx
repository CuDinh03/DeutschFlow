'use client'

import * as React from 'react'
import { Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { BookOpen, ChevronRight, ClipboardList, GripHorizontal, Headphones, Lightbulb, ListChecks, MoveHorizontal, PenLine, Send, SlidersHorizontal, Sparkles } from 'lucide-react'
import { apiMessage } from '@/lib/api'
import {
  WRITING_KEY,
  checkPracticeTeil,
  getPracticeOverview,
  gradePracticeWriting,
  resetPracticeTeil,
  type PracticeOverview,
  type PracticeTeilResult,
  type WritingEvaluation,
} from '@/lib/telcPracticeApi'
import { fetchExamStrategies, findStrategy } from '@/components/exam/strategy/examStrategy'
import { StrategyDrawer } from '@/components/exam/strategy/StrategyDrawer'
import { ConfirmDialog, LoadingState, ErrorBanner } from '@/components/ui-v2'
import { PracticeShell, TipsCard } from '@/components/exam/practice/PracticeShell'
import { usePracticeDraft } from '@/components/exam/practice/usePracticeDraft'
import { ObjectiveTeilView } from '@/components/exam/practice/ObjectiveTeilView'
import { HoerenTeilView } from '@/components/exam/practice/HoerenTeilView'
import { WritingTeilView } from '@/components/exam/practice/WritingTeilView'
import { WritingResultView } from '@/components/exam/practice/WritingResultView'
import { displayedPoints, findTeil, kindOf, wordCount } from '@/components/exam/practice/practiceModel'
import { SPLIT_MIN_WIDTH, useWide } from '@/components/exam/practice/useWide'
import { REWRITE_KEY } from '@/components/exam/mock/mockModel'
import { useScreenTour, type TourStep } from '@/components/exam/tour/ScreenTour'

export default function PracticeTeilRoute() {
  return (
    <Suspense fallback={<LoadingState label="…" />}>
      <PracticeTeilPage />
    </Suspense>
  )
}

function PracticeTeilPage() {
  const t = useTranslations('v2.student.practice')
  const locale = useLocale()
  const router = useRouter()
  const params = useSearchParams()
  const examId = Number(params.get('examId'))
  const teilKey = params.get('teil') ?? ''
  const rewrite = params.get('rewrite') === '1'
  const tf = useTranslations('v2.student.practice.frame')
  // Khung làm bài chia hai cột từ 760px; màn kết quả Viết giữ mốc 1024px như cũ.
  const wide = useWide(SPLIT_MIN_WIDTH)
  const wideResult = useWide()
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  // Hören "luyện thoải mái": nghe lại tuỳ ý, xem lời thoại, không đồng hồ.
  const [relaxed, setRelaxed] = React.useState(false)

  const [overview, setOverview] = React.useState<PracticeOverview | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [answers, setAnswers] = React.useState<Record<string, string>>({})
  const [result, setResult] = React.useState<PracticeTeilResult | null>(null)
  const [seconds, setSeconds] = React.useState(0)
  const [tipsOpen, setTipsOpen] = React.useState(false)
  const [tipSteps, setTipSteps] = React.useState<string[]>([])
  // Nút bóng đèn mở ngăn Chiến thuật (đợt c); thẻ mẹo trong bài chỉ tự hiện lần đầu vào Teil.
  const [drawerOpen, setDrawerOpen] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  // Viết
  const [text, setText] = React.useState('')
  const [evaluation, setEvaluation] = React.useState<WritingEvaluation | null>(null)
  const [writingView, setWritingView] = React.useState<'edit' | 'result'>('edit')
  const [ticks, setTicks] = React.useState<Record<string, boolean>>({})
  const [warn, setWarn] = React.useState(false)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  // Hộp "chắc chắn thoát?" (07/11/2026): lưu nháp ngay rồi mới rời màn.
  const [exitOpen, setExitOpen] = React.useState(false)
  const [leaving, setLeaving] = React.useState(false)
  const [exitFailed, setExitFailed] = React.useState(false)

  const meta = overview?.teile.find((x) => x.key === teilKey) ?? null
  const teil = React.useMemo(() => (overview ? findTeil(overview.sectionsJson, teilKey) : null), [overview, teilKey])
  const kind = kindOf(teil, teilKey)
  const isWriting = kind === 'writing'
  const points = React.useMemo(() => displayedPoints(teil?.writing_points, teil?.shuffle_points), [teil])
  const ticksKey = `df.practice.ticks.${examId}`

  // ── tải đề + tiến độ ───────────────────────────────────────────────────────
  React.useEffect(() => {
    if (!examId || !teilKey) return
    getPracticeOverview(examId)
      .then((o) => {
        setOverview(o)
        const p = o.teile.find((x) => x.key === teilKey)?.progress
        setSeconds(p?.elapsedSeconds ?? 0)
        setTipsOpen(!p)
        if (teilKey === WRITING_KEY) {
          // "Viết lại bài này" từ kết quả thi thử: mở bài của lượt thi để sửa rồi chấm lại (đợt (d)).
          let carried: string | null = null
          if (rewrite) {
            try {
              carried = window.sessionStorage.getItem(REWRITE_KEY(examId))
              window.sessionStorage.removeItem(REWRITE_KEY(examId))
            } catch {
              carried = null
            }
          }
          if (carried) {
            setText(carried)
            markDirtyRef.current()
            if (p?.checked && p.result) setEvaluation(p.result as WritingEvaluation)
          } else {
            setText(p?.answers?.text ?? '')
            if (p?.checked && p.result) {
              setEvaluation(p.result as WritingEvaluation)
              setWritingView('result')
            }
          }
        } else {
          setAnswers(p?.answers ?? {})
          if (p?.checked && p.result) setResult(p.result as PracticeTeilResult)
        }
      })
      .catch((e) => setError(apiMessage(e)))
    try {
      setTicks(JSON.parse(window.localStorage.getItem(ticksKey) ?? '{}'))
    } catch {
      /* bỏ qua */
    }
  }, [examId, teilKey, ticksKey, rewrite])

  // ── mẹo: chiến thuật đã duyệt (LT2), không có thì mẹo chung của Teil ────────
  React.useEffect(() => {
    if (!overview || !meta) return
    const section = ['LESEN', 'SPRACHBAUSTEINE', 'HOEREN', 'SCHREIBEN'].includes(meta.section) ? meta.section : 'LESEN'
    const fallback = (['t1', 't2', 't3'] as const).map((k) => t(`fallbackTips.${section}.${k}`))
    setTipSteps(fallback)
    fetchExamStrategies('TELC', overview.level, locale).then((list) => {
      const s = findStrategy(list, meta.section, meta.teil)
      if (s?.status === 'REVIEWED' && s.content?.steps?.length) setTipSteps(s.content.steps)
    })
  }, [overview, meta, locale, t])

  // ── hướng dẫn lần đầu (đợt (e)): Teil trắc nghiệm, Hören, Viết mỗi dạng một bộ bước ─────
  const tt = useTranslations('v2.student.tour')
  const tourKey = isWriting ? 'exam.writing' : meta?.section === 'HOEREN' ? 'exam.hoeren' : 'exam.teil'
  const strategyStep: TourStep = { target: 'strategy', icon: Lightbulb, title: tt('teil.strategy.t'), body: tt('teil.strategy.p') }
  const tourSteps: TourStep[] =
    tourKey === 'exam.writing'
      ? [
          { target: 'task', icon: ClipboardList, title: tt('writing.task.t'), body: tt('writing.task.p') },
          { target: 'editor', icon: PenLine, title: tt('writing.editor.t'), body: tt('writing.editor.p') },
          strategyStep,
          { target: 'submit', icon: Sparkles, title: tt('writing.grade.t'), body: tt('writing.grade.p') },
        ]
      : tourKey === 'exam.hoeren'
        ? [
            { target: 'hoeren-prep', icon: Headphones, title: tt('hoeren.prep.t'), body: tt('hoeren.prep.p') },
            { target: 'hoeren-mode', icon: SlidersHorizontal, title: tt('hoeren.mode.t'), body: tt('hoeren.mode.p') },
            strategyStep,
            { target: 'submit', icon: Send, title: tt('teil.submit.t'), body: tt('teil.submit.p') },
          ]
        : [
            { target: 'source', icon: BookOpen, title: tt('teil.source.t'), body: tt('teil.source.p') },
            { target: 'divider', icon: MoveHorizontal, title: tt('teil.divider.t'), body: tt('teil.divider.p') },
            { target: 'handle', icon: GripHorizontal, title: tt('teil.handle.t'), body: tt('teil.handle.p') },
            { target: 'dots', icon: ListChecks, title: tt('teil.dots.t'), body: tt('teil.dots.p') },
            strategyStep,
            { target: 'submit', icon: Send, title: tt('teil.submit.t'), body: tt('teil.submit.p') },
          ]
  const tour = useScreenTour({
    key: tourKey,
    steps: tourSteps,
    ready: !!overview && !!meta && kind !== 'unknown' && !result && !(isWriting && writingView === 'result'),
  })

  // ── đồng hồ theo Teil: chỉ chạy khi đang làm, tab đang mở và hướng dẫn đang đóng ──
  const running = !!overview && !result && !relaxed && !tour.active && !(isWriting && writingView === 'result')
  React.useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') setSeconds((s) => s + 1)
    }, 1000)
    return () => window.clearInterval(id)
  }, [running])

  // ── tự lưu nháp (usePracticeDraft: hẹn giờ 1,5 s, lưu ngay khi thoát, keepalive khi đóng tab) ──
  const secondsRef = React.useRef(seconds)
  secondsRef.current = seconds
  const draftPayload = React.useMemo<Record<string, string>>(() => (isWriting ? { text } : answers), [isWriting, text, answers])
  const touched = isWriting ? text.trim() !== '' : Object.keys(answers).length > 0
  const draftOpen = !!overview && !result && !(isWriting && writingView === 'result')
  const draft = usePracticeDraft({
    examId,
    teilKey: overview ? teilKey : null,
    payload: draftPayload,
    elapsed: () => secondsRef.current,
    enabled: draftOpen,
    hasWork: touched || meta?.progress != null,
  })
  const saveState = draft.saveState
  const markDirtyRef = React.useRef(draft.markDirty)
  markDirtyRef.current = draft.markDirty

  const onAnswer = React.useCallback((id: string, value: string | null) => {
    markDirtyRef.current()
    setAnswers((prev) => {
      const next = { ...prev }
      if (value == null) delete next[id]
      else next[id] = value
      return next
    })
  }, [])

  const onText = (v: string) => {
    markDirtyRef.current()
    setText(v)
  }

  const onTick = (label: string, on: boolean) => {
    setTicks((prev) => {
      const next = { ...prev, [label]: on }
      try {
        window.localStorage.setItem(ticksKey, JSON.stringify(next))
      } catch {
        /* bỏ qua */
      }
      return next
    })
    setWarn(false)
  }

  const check = async () => {
    // ConfirmDialog không tự đóng khi xác nhận — đóng ở đây (cả khi còn câu bỏ trống, câu đó tính 0).
    setConfirmOpen(false)
    setBusy(true)
    try {
      const p = await checkPracticeTeil(examId, teilKey, answers, seconds)
      setResult(p.result as PracticeTeilResult)
      setTipsOpen(false)
      draft.reset()
    } catch (e) {
      setError(apiMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const redo = async () => {
    setBusy(true)
    try {
      await resetPracticeTeil(examId, teilKey)
      setResult(null)
      setAnswers({})
      setSeconds(0)
      draft.reset()
    } catch (e) {
      setError(apiMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const grade = async (force = false) => {
    if (!force && points.some((p) => !ticks[p.label])) {
      setWarn(true)
      return
    }
    setWarn(false)
    setBusy(true)
    setError(null)
    try {
      const ev = await gradePracticeWriting(examId, text, seconds)
      setEvaluation(ev)
      setWritingView('result')
      draft.reset()
    } catch (e) {
      setError(apiMessage(e))
    } finally {
      setBusy(false)
    }
  }

  // ── khung ──────────────────────────────────────────────────────────────────
  const mapHref = `/v2/student/mock-exam/practice?examId=${examId}`
  const order = overview?.teile.map((x) => x.key) ?? []
  const nextKey = order[order.indexOf(teilKey) + 1] ?? null
  const goNext = () => router.push(nextKey ? `/v2/student/mock-exam/practice/teil?examId=${examId}&teil=${nextKey}` : mapHref)

  // ── thoát: đã làm gì thì hỏi trước, lưu nháp xong mới rời (nháp không tính vào điểm kỹ năng) ──
  const saveAndLeave = async () => {
    setLeaving(true)
    setExitFailed(false)
    const ok = await draft.flush()
    setLeaving(false)
    if (!ok) {
      setExitFailed(true)
      setExitOpen(true)
      return
    }
    setExitOpen(false)
    router.push(mapHref)
  }
  const requestExit = () => {
    if (draftOpen && touched) {
      setExitFailed(false)
      setExitOpen(true)
    } else router.push(mapHref)
  }

  if (!examId || !teilKey) return <ErrorBanner message={t('badLink')} />
  if (!overview) {
    return (
      <PracticeShell backHref={mapHref} subtitle="" title={t('loading')}>
        <div className="p-6">{error ? <ErrorBanner message={error} /> : <LoadingState label={t('loading')} />}</div>
      </PracticeShell>
    )
  }
  if (!meta || !teil || kind === 'unknown') {
    return (
      <PracticeShell backHref={mapHref} subtitle={overview.title} title={t('teilMissing')}>
        <div className="p-6"><ErrorBanner message={t('teilMissing')} /></div>
      </PracticeShell>
    )
  }

  const subtitle = `${t(`section.${meta.section}`)} · Teil ${meta.teil}`
  const title = t(`teilTitle.${teil.type ?? meta.section}`)
  const tips = tipsOpen ? <TipsCard steps={tipSteps} onClose={() => setTipsOpen(false)} /> : null
  const errorBar = error ? <div className="w-full"><ErrorBanner message={error} /></div> : null
  const drawer = (
    <StrategyDrawer
      open={drawerOpen}
      onOpenChange={setDrawerOpen}
      provider="TELC"
      level={overview.level}
      section={meta.section}
      teil={meta.teil}
      title={subtitle}
      fallbackSteps={tipSteps}
    />
  )

  const exitDialog = (
    <ConfirmDialog
      open={exitOpen}
      onOpenChange={setExitOpen}
      title={tf('exitTitle', { teil: subtitle })}
      description={
        exitFailed
          ? tf('exitFailed')
          : isWriting
            ? tf('exitBodyWriting', { words: wordCount(text) })
            : tf('exitBody', { done: Object.keys(answers).filter((k) => teil.items?.some((it) => it.id === k)).length, total: teil.items?.length ?? 0 })
      }
      confirmLabel={exitFailed ? tf('exitRetry') : t('saveExit')}
      cancelLabel={tf('keepGoing')}
      destructive={false}
      loading={leaving}
      onConfirm={() => void saveAndLeave()}
    />
  )

  if (isWriting) {
    const showResult = writingView === 'result' && evaluation
    const done = points.filter((p) => ticks[p.label]).length
    const missing = points.filter((p) => !ticks[p.label]).map((p) => p.label)
    const footer = showResult ? (
      <>
        <span className="ga-ui min-w-0 flex-1 basis-full text-ga-small text-ga-muted lg:basis-auto">{t('notInHistory')}</span>
        <FootBtn onClick={() => setWritingView('edit')}>
          <PenLine size={15} aria-hidden /> {t('rewrite')}
        </FootBtn>
        <FootLink href={mapHref} primary>{t('backToMap')}</FootLink>
      </>
    ) : warn ? (
      <div className="ga-ui flex w-full flex-wrap items-center gap-2.5 rounded-ga-touch bg-ga-warning-soft px-3 py-2.5 text-ga-small text-ga-warning">
        <span className="min-w-[12rem] flex-1">{t('warnUnticked', { list: missing.join(', ') })}</span>
        <FootBtn onClick={() => { setWarn(false); textareaRef.current?.focus() }}>{t('writeMore')}</FootBtn>
        <FootBtn primary onClick={() => grade(true)}>{t('gradeAnyway')}</FootBtn>
      </div>
    ) : (
      <>
        {errorBar}
        <span className="ga-ui min-w-0 flex-1 basis-full text-ga-small text-ga-muted lg:basis-auto">
          <Sparkles size={14} className="mr-1 inline" aria-hidden />
          {t('aiNote')}
        </span>
        <FootBtn quiet disabled={leaving} onClick={() => void saveAndLeave()}>{t('saveExit')}</FootBtn>
        <FootBtn primary tour="submit" disabled={busy || wordCount(text) === 0} onClick={() => grade(false)}>
          {busy ? t('grading') : t('gradeAi')}
        </FootBtn>
      </>
    )
    return (
      <>
      <PracticeShell
        backHref={mapHref}
        onExit={requestExit}
        section={meta.section}
        subtitle={showResult ? t('writingResultSub') : subtitle}
        title={title}
        progress={showResult ? undefined : t('pointsProgress', { done, total: points.length })}
        seconds={showResult ? null : seconds}
        suggestMinutes={meta.suggestMinutes}
        tipsOpen={drawerOpen}
        onToggleTips={showResult ? undefined : () => setDrawerOpen(true)}
        onHelp={showResult ? undefined : tour.start}
        saveState={showResult ? 'idle' : saveState}
        footer={footer}
      >
        {showResult ? (
          <WritingResultView evaluation={evaluation!} text={text} points={points} wide={wideResult} />
        ) : (
          <WritingTeilView
            teil={teil}
            points={points}
            text={text}
            onText={onText}
            ticks={ticks}
            onTick={onTick}
            wide={wide}
            tips={tips}
            textareaRef={textareaRef}
          />
        )}
      </PracticeShell>
      {drawer}
      {tour.overlay}
      {exitDialog}
      </>
    )
  }

  const total = teil.items?.length ?? 0
  const answered = Object.keys(answers).filter((k) => teil.items?.some((it) => it.id === k)).length
  const footer = result ? (
    <>
      <span className="ga-ui min-w-0 flex-1 basis-full text-ga-small text-ga-muted lg:basis-auto">
        {t('footChecked', { done: result.correctCount, total: result.total })} {t('notInHistory')}
      </span>
      {result.max > 0 && result.score / result.max < 0.6 && (
        <FootBtn onClick={() => setDrawerOpen(true)}>
          <Lightbulb size={15} aria-hidden /> {tf('suggestStrategy')}
        </FootBtn>
      )}
      <FootBtn disabled={busy} onClick={redo}>{t('redo')}</FootBtn>
      <FootBtn primary onClick={goNext}>
        {nextKey ? t('nextTeil') : t('backToMap')} <ChevronRight size={16} aria-hidden />
      </FootBtn>
    </>
  ) : (
    <>
      {errorBar}
      <FootBtn quiet disabled={leaving} onClick={() => void saveAndLeave()}>{t('saveExit')}</FootBtn>
      <FootBtn primary tour="submit" disabled={busy} onClick={() => (answered < total ? setConfirmOpen(true) : void check())}>
        <Send size={15} aria-hidden /> {busy ? t('checking') : t('check')}
      </FootBtn>
    </>
  )

  return (
    <>
    <PracticeShell
      backHref={mapHref}
      onExit={requestExit}
      section={meta.section}
      subtitle={subtitle}
      title={title}
      progress={`${result ? result.correctCount : answered}/${total}`}
      seconds={result || relaxed ? null : seconds}
      suggestMinutes={meta.suggestMinutes}
      tipsOpen={drawerOpen}
      onToggleTips={() => setDrawerOpen(true)}
      onHelp={result ? undefined : tour.start}
      saveState={result ? 'idle' : saveState}
      footer={footer}
    >
      {meta.section === 'HOEREN' ? (
        <HoerenTeilView teil={teil} answers={answers} onAnswer={onAnswer} result={result} wide={wide} tips={tips} allowRelaxed onRelaxedChange={setRelaxed} />
      ) : (
        <ObjectiveTeilView
          teil={teil}
          kind={kind as 'match' | 'mc' | 'gap-mc' | 'gap-bank'}
          answers={answers}
          onAnswer={onAnswer}
          result={result}
          wide={wide}
          tips={tips}
        />
      )}
    </PracticeShell>
    {drawer}
    {tour.overlay}
    <ConfirmDialog
      open={confirmOpen}
      onOpenChange={setConfirmOpen}
      title={tf('confirmTitle', { n: total - answered })}
      description={tf('confirmBody')}
      confirmLabel={tf('confirmGo')}
      cancelLabel={tf('keepGoing')}
      destructive={false}
      onConfirm={() => void check()}
    />
    {exitDialog}
    </>
  )
}

const btnBase =
  'ga-ui inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-ga-touch px-4 text-ga-body font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus disabled:opacity-50 lg:flex-none'

function FootBtn({ primary, quiet, tour, disabled, onClick, children }: { primary?: boolean; quiet?: boolean; tour?: string; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      data-tour={tour}
      disabled={disabled}
      onClick={onClick}
      className={`${btnBase} ${primary ? 'bg-ga-yellow text-ga-ink hover:opacity-90' : quiet ? 'text-ga-muted hover:bg-ga-side-active hover:text-ga-ink' : 'border-[1.5px] border-ga-line-strong bg-ga-card text-ga-ink hover:bg-ga-side-active'}`}
    >
      {children}
    </button>
  )
}

function FootLink({ href, primary, children }: { href: string; primary?: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`${btnBase} ${primary ? 'bg-ga-yellow text-ga-ink hover:opacity-90' : 'text-ga-muted hover:bg-ga-side-active hover:text-ga-ink'}`}
    >
      {children}
    </Link>
  )
}
