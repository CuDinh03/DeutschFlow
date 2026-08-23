'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Volume2, VolumeX, Flag, ChevronRight, RotateCcw, ArrowLeft } from 'lucide-react'
import { examSpeakingApi } from '@/lib/examSpeakingApi'
import { apiMessage } from '@/lib/api'
import type { BlueprintSummary, ExamResultView, ExamSessionView, RoomLine, TurnResponse } from '@/types/exam-speaking'
import { GaBtn, GaCap, ErrorBanner, LoadingState } from '@/components/ui-v2'
import { StimulusCard } from './StimulusCard'
import { ExamTimer } from './ExamTimer'
import { TeilStepper } from './TeilStepper'
import { ExamTranscript } from './ExamTranscript'
import { MicBar } from './MicBar'
import { Ergebnisbogen } from './Ergebnisbogen'
import { DrillSummary } from './DrillSummary'
import { isExamTtsMuted, setExamTtsMuted, speakExamLine, stopExamTts } from './examTts'

interface Props {
  sessionId: number
  catalogHref: string
}

const GRADING_POLL_MS = 3000
let lineSeq = 0
const nextId = () => `l${Date.now()}-${lineSeq++}`

/**
 * Phòng thi cá nhân (Đợt 1): prep → live (Prüfer/Partner AI + thẻ đề + đồng hồ server) → drill: tổng kết;
 * mock: chấm nền → Ergebnisbogen. Mock chỉ nhận AUDIO (server phiên âm); drill có fallback bàn phím.
 */
export function ExamRoom({ sessionId, catalogHref }: Props) {
  const t = useTranslations('v2.student.examSpeaking.room')
  const [session, setSession] = useState<ExamSessionView | null>(null)
  const [blueprint, setBlueprint] = useState<BlueprintSummary | null>(null)
  const [lines, setLines] = useState<RoomLine[]>([])
  const [result, setResult] = useState<ExamResultView | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [muted, setMuted] = useState(isExamTtsMuted())
  const [notes, setNotes] = useState('')
  const spokenRef = useRef<string | null>(null)

  // ── nạp phiên + blueprint (để vẽ stepper có tên Teil) ───────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await examSpeakingApi.getSession(sessionId)
      setSession(data)
      setNotes(data.notesText ?? '')
      const bps = await examSpeakingApi.listBlueprints({ provider: data.provider, level: data.level })
      setBlueprint(bps.data[0] ?? null)
      if (data.state === 'RESULTS') {
        const r = await examSpeakingApi.getResult(sessionId)
        setResult(r.data)
      }
      if (data.directive?.prueferText) {
        setLines((prev) =>
          prev.length ? prev : [{ id: nextId(), role: 'PRUEFER', text: data.directive!.prueferText!, teilNo: data.directive!.teilNo }],
        )
      }
    } catch (e) {
      setError(apiMessage(e))
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    void load()
    return () => stopExamTts()
  }, [load])

  // ── đọc lời Prüfer mới (dedupe theo nội dung + Teil) ────────────────────────────────────
  useEffect(() => {
    const d = session?.directive
    if (!d?.prueferText || session?.state !== 'IN_PART') return
    const key = `${d.teilNo}:${d.prueferText}`
    if (spokenRef.current === key) return
    spokenRef.current = key
    void speakExamLine('PRUEFER', d.prueferText)
  }, [session])

  // ── poll khi đang chấm ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (session?.state !== 'GRADING') return
    const id = window.setInterval(async () => {
      try {
        const { data } = await examSpeakingApi.getSession(sessionId)
        if (data.state !== 'GRADING') {
          setSession(data)
          if (data.state === 'RESULTS') {
            const r = await examSpeakingApi.getResult(sessionId)
            setResult(r.data)
          }
        }
      } catch (e) {
        setError(apiMessage(e))
      }
    }, GRADING_POLL_MS)
    return () => window.clearInterval(id)
  }, [session?.state, sessionId])

  const applyTurn = useCallback(
    (res: TurnResponse, transcriptFallback: string, startedAt: number) => {
      const prevTeil = session?.directive?.teilNo ?? res.session.currentPart
      const added: RoomLine[] = [
        { id: nextId(), role: 'CANDIDATE', text: res.transcript || transcriptFallback, teilNo: prevTeil, eval: res.turnEval },
      ]
      // B1 T3: partner trả lời + giám khảo hỏi = 2 lượt AI; backend cũ chỉ có aiRole/aiText.
      const aiTurns = res.aiTurns && res.aiTurns.length > 0
        ? res.aiTurns
        : res.aiText && res.aiRole ? [{ role: res.aiRole, text: res.aiText }] : []
      aiTurns.forEach((t, i) => {
        added.push({ id: nextId(), role: t.role as RoomLine['role'], text: t.text, teilNo: prevTeil, latencyMs: i === 0 ? performance.now() - startedAt : undefined })
      })
      const d = res.session.directive
      const movedToNewPart = d && d.teilNo !== prevTeil && d.prueferText
      if (movedToNewPart) {
        added.push({ id: nextId(), role: 'PRUEFER', text: d!.prueferText!, teilNo: d!.teilNo })
      }
      setLines((prev) => [...prev, ...added])
      setSession(res.session)
      // Nói lời AI theo thứ tự: partner/prüfer trả lời → (nếu sang Teil mới) lời giới thiệu Teil.
      void (async () => {
        for (const t of aiTurns) await speakExamLine(t.role, t.text)
        if (movedToNewPart) {
          spokenRef.current = `${d!.teilNo}:${d!.prueferText}`
          await speakExamLine('PRUEFER', d!.prueferText!)
        }
      })()
    },
    [session],
  )

  const submitAudio = useCallback(
    async (blob: Blob) => {
      setBusy(true)
      setError(null)
      const startedAt = performance.now()
      try {
        stopExamTts()
        const ext = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm'
        const { data } = await examSpeakingApi.audioTurn(sessionId, blob, `turn.${ext}`)
        applyTurn(data, '', startedAt)
      } catch (e) {
        setError(apiMessage(e))
      } finally {
        setBusy(false)
      }
    },
    [applyTurn, sessionId],
  )

  const submitText = useCallback(
    async (text: string) => {
      setBusy(true)
      setError(null)
      const startedAt = performance.now()
      try {
        stopExamTts()
        const { data } = await examSpeakingApi.textTurn(sessionId, text)
        applyTurn(data, text, startedAt)
      } catch (e) {
        setError(apiMessage(e))
      } finally {
        setBusy(false)
      }
    },
    [applyTurn, sessionId],
  )

  const advance = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      stopExamTts()
      const { data } = await examSpeakingApi.advance(sessionId)
      if (data.directive?.prueferText && data.directive.teilNo !== session?.directive?.teilNo) {
        setLines((prev) => [...prev, { id: nextId(), role: 'PRUEFER', text: data.directive!.prueferText!, teilNo: data.directive!.teilNo }])
      }
      setSession(data)
    } catch (e) {
      setError(apiMessage(e))
    } finally {
      setBusy(false)
    }
  }, [session, sessionId])

  const finish = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      stopExamTts()
      const { data } = await examSpeakingApi.finish(sessionId)
      setSession(data)
    } catch (e) {
      setError(apiMessage(e))
    } finally {
      setBusy(false)
    }
  }, [sessionId])

  const choose = useCallback(
    async (teilNo: number, index: number) => {
      setBusy(true)
      setError(null)
      try {
        const { data } = await examSpeakingApi.choose(sessionId, teilNo, index)
        setSession(data)
      } catch (e) {
        setError(apiMessage(e))
      } finally {
        setBusy(false)
      }
    },
    [sessionId],
  )

  const saveNotes = useCallback(async () => {
    try {
      const { data } = await examSpeakingApi.saveNotes(sessionId, notes)
      setSession(data)
    } catch (e) {
      setError(apiMessage(e))
    }
  }, [notes, sessionId])

  const toggleMute = () => {
    const next = !muted
    setExamTtsMuted(next)
    setMuted(next)
  }

  const currentPartSummary = useMemo(
    () => blueprint?.parts.find((p) => p.teilNo === session?.currentPart) ?? null,
    [blueprint, session?.currentPart],
  )

  if (loading) return <LoadingState label={t('loading')} />
  if (!session) return <ErrorBanner variant="page" message={error ?? t('notFound')} onRetry={load} retryLabel={t('retry')} />

  const isMock = session.mode === 'MOCK'
  const providerName = session.provider === 'GOETHE' ? 'Goethe' : 'telc'

  return (
    <div className="flex min-h-full flex-col">
      <div className="border-b border-ga-line bg-ga-card px-4 py-3 sm:px-6 lg:px-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <GaCap className="block">{providerName} {session.level} · {isMock ? t('modeMock') : t('modeDrill')}</GaCap>
            {blueprint && <TeilStepper parts={blueprint.parts} currentTeil={session.currentPart} state={session.state} mode={session.mode} />}
          </div>
          <div className="flex items-center gap-2">
            {session.state === 'IN_PART' && (
              <ExamTimer
                deadlineAt={session.partDeadlineAt}
                serverNow={session.serverNow}
                totalSec={currentPartSummary?.durationSec ?? 0}
                onExpire={isMock ? () => void advance() : undefined}
                label={t('timeLeft')}
              />
            )}
            <button
              type="button"
              onClick={toggleMute}
              className="grid h-10 w-10 place-items-center rounded-ga border border-ga-line bg-ga-card text-ga-ink"
              aria-pressed={muted}
              aria-label={muted ? t('unmute') : t('mute')}
              data-testid="tts-mute"
            >
              {muted ? <VolumeX size={16} aria-hidden /> : <Volume2 size={16} aria-hidden />}
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 py-5 sm:px-6 lg:px-10">
        {error && (
          <div className="mb-4">
            <ErrorBanner message={error} onRetry={() => setError(null)} retryLabel={t('dismiss')} />
          </div>
        )}

        {session.state === 'PREP' && (
          <section className="mx-auto max-w-3xl space-y-4" data-testid="exam-prep">
            <GaCap className="block">{t('prepCap')}</GaCap>
            <p className="ga-ui text-[14.5px] text-ga-ink">{t('prepDesc')}</p>
            {session.prepDeadlineAt && (
              <ExamTimer deadlineAt={session.prepDeadlineAt} serverNow={session.serverNow} totalSec={session.prepSec ?? blueprint?.prepSec ?? 0} label={t('prepLeft')} onExpire={() => void advance()} />
            )}
            {session.prepMaterials && session.prepMaterials.length > 0 && (
              <div className="space-y-4" data-testid="prep-materials">
                {session.prepMaterials.map((m) => (
                  <div key={m.teilNo} className="rounded-ga border border-ga-line bg-ga-card p-4">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="font-ga-display text-[18px] font-medium text-ga-ink">
                        {t('teilCap', { n: m.teilNo })} · {m.title}
                      </p>
                      {m.choiceRequired && (
                        <span className={`ga-ui text-[12px] font-semibold ${m.chosenIndex === null ? 'text-ga-red' : 'text-ga-green'}`}>
                          {m.chosenIndex === null ? t('chooseOne') : t('chosen', { n: (m.chosenIndex ?? 0) + 1 })}
                        </span>
                      )}
                    </div>
                    <div className={m.choiceRequired ? 'grid gap-3 md:grid-cols-2' : ''}>
                      {m.stimuli.map((stim, idx) => (
                        <div key={idx} className="relative">
                          {m.choiceRequired && (
                            <button
                              type="button"
                              onClick={() => void choose(m.teilNo, idx)}
                              disabled={busy}
                              aria-pressed={m.chosenIndex === idx}
                              className={`ga-ui mb-2 w-full rounded-ga border px-3 py-2 text-left text-[13px] font-semibold ${
                                m.chosenIndex === idx ? 'border-ga-ink bg-ga-ink text-ga-bg' : 'border-ga-line bg-ga-card text-ga-ink hover:bg-ga-surface'
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
                  </div>
                ))}
              </div>
            )}
            <textarea
              className="ga-ui min-h-[160px] w-full rounded-ga border border-ga-line bg-ga-bg p-3 text-[14.5px] text-ga-ink"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => void saveNotes()}
              placeholder={t('notesPlaceholder')}
              aria-label={t('notesPlaceholder')}
            />
            <GaBtn
              variant="ink"
              size="lg"
              onClick={() => void advance()}
              disabled={busy || (session.prepMaterials ?? []).some((m) => m.choiceRequired && m.chosenIndex === null)}
              data-testid="prep-enter"
            >
              {t('enterExam')} <ChevronRight size={16} aria-hidden className="ml-1" />
            </GaBtn>
          </section>
        )}

        {session.state === 'IN_PART' && session.directive && (
          <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
            <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
              <div>
                <GaCap className="mb-1 block">{t('teilCap', { n: session.directive.teilNo })}</GaCap>
                <p className="font-ga-display text-[20px] font-medium text-ga-ink">{session.directive.title}</p>
                <p className="ga-ui mt-1 text-[13px] text-ga-muted">
                  {t('step', { i: session.directive.stepIndex + 1, n: session.directive.stepCount })}
                </p>
              </div>
              <StimulusCard stimulus={session.directive.stimulus} stepIndex={session.directive.stepIndex} candidateAction={session.directive.candidateAction} />
              <div className="rounded-ga bg-ga-yellow-soft p-3">
                <p className="ga-ui text-[13px] text-ga-ink" data-testid="directive-hint">{session.directive.hintVi}</p>
              </div>
              {session.notesText && (
                <details className="rounded-ga border border-ga-line bg-ga-card p-3">
                  <summary className="ga-ui cursor-pointer text-[13px] font-semibold text-ga-ink">{t('myNotes')}</summary>
                  <p className="ga-ui mt-2 whitespace-pre-wrap text-[13px] text-ga-muted">{session.notesText}</p>
                </details>
              )}
              <div className="flex flex-wrap gap-2">
                <GaBtn variant="ghost" size="sm" onClick={() => void advance()} disabled={busy} data-testid="advance-part">
                  {t('skipPart')} <ChevronRight size={14} aria-hidden className="ml-1" />
                </GaBtn>
                <GaBtn variant="ghost" size="sm" onClick={() => void finish()} disabled={busy} data-testid="finish-session">
                  <Flag size={14} aria-hidden className="mr-1" /> {isMock ? t('finishMock') : t('finishDrill')}
                </GaBtn>
              </div>
            </aside>
            <section className="flex min-h-[420px] flex-col">
              <div className="max-h-[52vh] flex-1 overflow-y-auto rounded-ga border border-ga-line bg-ga-surface p-4 lg:max-h-none">
                <ExamTranscript lines={lines} mode={session.mode} />
              </div>
              {/* Mobile: mic dính đáy để không phải cuộn qua transcript mỗi lượt; desktop: nằm dưới transcript. */}
              <div className="sticky bottom-2 z-10 mt-3 lg:static">
                <MicBar
                  disabled={busy}
                  busy={busy}
                  allowText={!isMock}
                  onAudio={submitAudio}
                  onText={submitText}
                  hint={t(`action.${session.directive.candidateAction}`)}
                />
              </div>
            </section>
          </div>
        )}

        {session.state === 'GRADING' && (
          <section className="mx-auto max-w-xl py-10 text-center" data-testid="exam-grading">
            <LoadingState label={t('grading')} />
            <p className="ga-ui mt-3 text-[13px] text-ga-muted">{t('gradingDesc')}</p>
          </section>
        )}

        {session.state === 'RESULTS' && result && (
          <div className="mx-auto max-w-3xl">
            <Ergebnisbogen sheet={result.scoreSheet} />
            <RoomFooter catalogHref={catalogHref} />
          </div>
        )}

        {session.state === 'DONE' && (
          <div className="mx-auto max-w-3xl">
            <DrillSummary lines={lines} />
            <RoomFooter catalogHref={catalogHref} />
          </div>
        )}

        {session.state === 'ABORTED' && (
          <div className="mx-auto max-w-xl">
            <ErrorBanner variant="page" message={t('aborted')} />
            <RoomFooter catalogHref={catalogHref} />
          </div>
        )}
      </div>
    </div>
  )
}

function RoomFooter({ catalogHref }: { catalogHref: string }) {
  const t = useTranslations('v2.student.examSpeaking.room')
  return (
    <div className="mt-5 flex flex-wrap gap-2">
      <a href={catalogHref} className="ga-ui inline-flex items-center gap-1.5 rounded-ga bg-ga-ink px-4 py-2.5 text-[13px] font-semibold text-ga-bg">
        <RotateCcw size={14} aria-hidden /> {t('again')}
      </a>
      <a href={catalogHref} className="ga-ui inline-flex items-center gap-1.5 rounded-ga border border-ga-line bg-ga-card px-4 py-2.5 text-[13px] font-semibold text-ga-ink">
        <ArrowLeft size={14} aria-hidden /> {t('backToCatalog')}
      </a>
    </div>
  )
}
