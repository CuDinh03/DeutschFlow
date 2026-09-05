'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Volume2, VolumeX, Flag, ChevronRight, RotateCcw, ArrowLeft, Mic, Ear, Loader2 } from 'lucide-react'
import { examSpeakingApi } from '@/lib/examSpeakingApi'
import { newClientTurnId } from '@/lib/exam/clientTurnId'
import { apiMessage, httpStatus } from '@/lib/api'
import { MAX_TRANSCRIBE_BYTES } from '@/lib/voiceRecorder'
import type { BlueprintSummary, ExamResultView, ExamSessionView, RoomLine, TurnResponse } from '@/types/exam-speaking'
import { GaBtn, GaCap, ErrorBanner, LoadingState } from '@/components/ui-v2'
import { StimulusCard } from './StimulusCard'
import { ExamTimer } from './ExamTimer'
import { TeilStepper } from './TeilStepper'
import { ExamTranscript } from './ExamTranscript'
import { MicBar } from './MicBar'
import { MicCheck } from './MicCheck'
import { MicDeniedGuide } from '@/components/speaking/MicDeniedGuide'
import { useMicPermission } from '@/hooks/useMicPermission'
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
 * Lượt nói vừa gửi thất bại mà backend CÓ THỂ đã xử lý (timeout 45s, rớt mạng, 5xx, hoặc 409 "đang xử lý").
 * Giữ nguyên blob/text + clientTurnId để "Gửi lại" đúng lượt đó: backend replay nếu đã xong, xử lý nếu chưa —
 * không bao giờ thành hai lượt (F-06). Lỗi 4xx khác (audio hỏng, 413, hết giờ Teil) không giữ lại.
 */
type PendingTurn =
  | { kind: 'audio'; blob: Blob; filename: string; clientTurnId: string }
  | { kind: 'text'; text: string; clientTurnId: string }

function isRetryableTurnError(e: unknown): boolean {
  const status = httpStatus(e) // 0 = không có response (timeout / mất mạng) — không biết server đã làm gì
  if (!status) return true
  if (status >= 500) return true
  return status === 409 && /đang được xử lý|in progress/i.test(apiMessage(e))
}

/**
 * Phòng thi cá nhân (Đợt 1): prep → live (Prüfer/Partner AI + thẻ đề + đồng hồ server) → drill: tổng kết;
 * mock: chấm nền → Ergebnisbogen. Mock chỉ nhận AUDIO (server phiên âm); drill có fallback bàn phím.
 */
export function ExamRoom({ sessionId, catalogHref }: Props) {
  const t = useTranslations('v2.student.examSpeaking.room')
  const locale = useLocale()
  const micPermission = useMicPermission()
  const [micCheckPassed, setMicCheckPassed] = useState(false)
  const [drillTimeUp, setDrillTimeUp] = useState(false)
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
  // ── cơ chế lượt: AI đang nói → khoá mic/text, xong → báo "đến lượt bạn" ────────────────
  const [aiSpeaking, setAiSpeaking] = useState<'PRUEFER' | 'PARTNER' | null>(null)
  const [yourTurnPulse, setYourTurnPulse] = useState(false)
  const speakGenRef = useRef(0)
  const [pendingTurn, setPendingTurn] = useState<PendingTurn | null>(null)

  /**
   * Đọc lần lượt các lời AI và giữ trạng thái lượt trong suốt chuỗi. Generation guard: mỗi hành động
   * của người dùng (gửi lượt, advance, finish) bump gen + stopExamTts() → chuỗi cũ tự thoát,
   * không ghi đè state của hành động mới.
   */
  const speakSequence = useCallback(async (turns: { role: string; text: string }[]) => {
    const gen = ++speakGenRef.current
    for (const turn of turns) {
      setAiSpeaking(turn.role === 'PARTNER' ? 'PARTNER' : 'PRUEFER')
      await speakExamLine(turn.role, turn.text)
      if (speakGenRef.current !== gen) return
    }
    setAiSpeaking(null)
    setYourTurnPulse(true)
  }, [])

  /** Người dùng chủ động hành động → cắt mọi lời AI đang phát và mở khoá ngay. */
  const interruptSpeech = useCallback(() => {
    speakGenRef.current += 1
    stopExamTts()
    setAiSpeaking(null)
    setYourTurnPulse(false)
  }, [])

  // Hiệu ứng "đến lượt bạn" chỉ nhấp nháy một nhịp ngắn rồi đứng yên.
  useEffect(() => {
    if (!yourTurnPulse) return
    const id = window.setTimeout(() => setYourTurnPulse(false), 2500)
    return () => window.clearTimeout(id)
  }, [yourTurnPulse])

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
    void speakSequence([{ role: 'PRUEFER', text: d.prueferText }])
  }, [session, speakSequence])

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
      // speakSequence giữ khoá mic đến khi lời cuối phát xong rồi mới báo "đến lượt bạn".
      const toSpeak = [...aiTurns]
      if (movedToNewPart) {
        spokenRef.current = `${d!.teilNo}:${d!.prueferText}`
        toSpeak.push({ role: 'PRUEFER', text: d!.prueferText! })
      }
      void speakSequence(toSpeak)
    },
    [session, speakSequence],
  )

  // Chốt chống nộp trùng ở tầng phòng thi. `busy` là state nên hai lượt gửi trong cùng một tick
  // React đều thấy `busy === false` và cùng đi qua — mỗi lượt thừa là một lần trừ quota AI và một
  // dòng transcript ma. Ref cập nhật đồng bộ nên lượt thứ hai bị chặn ngay.
  const inFlightRef = useRef(false)

  const submitAudio = useCallback(
    async (blob: Blob, retryOf?: PendingTurn) => {
      if (inFlightRef.current) return
      // Guard client theo ĐÚNG trần của endpoint phiên âm (8MB), không phải trần multipart 25MB
      // của Spring. Với trần 180s + bitrate hiện tại, một lượt nói chỉ ~1,4MB nên nhánh này gần
      // như không bao giờ chạy; nó tồn tại để trình duyệt nào lờ `audioBitsPerSecond` cũng nhận
      // được câu giải thích đúng việc thay vì lời khuyên "dùng presigned upload" của Materials.
      if (blob.size > MAX_TRANSCRIBE_BYTES) {
        setError(t('audioTooLarge'))
        return
      }
      inFlightRef.current = true
      setBusy(true)
      setError(null)
      const startedAt = performance.now()
      const ext = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm'
      const filename = retryOf?.kind === 'audio' ? retryOf.filename : `turn.${ext}`
      const clientTurnId = retryOf?.clientTurnId ?? newClientTurnId()
      try {
        interruptSpeech()
        const { data } = await examSpeakingApi.audioTurn(sessionId, blob, filename, locale, clientTurnId)
        setPendingTurn(null)
        applyTurn(data, '', startedAt)
      } catch (e) {
        setError(httpStatus(e) === 413 ? t('audioTooLarge') : apiMessage(e))
        setPendingTurn(isRetryableTurnError(e) ? { kind: 'audio', blob, filename, clientTurnId } : null)
      } finally {
        inFlightRef.current = false
        setBusy(false)
      }
    },
    [applyTurn, interruptSpeech, locale, sessionId, t],
  )

  const submitText = useCallback(
    async (text: string, retryOf?: PendingTurn) => {
      if (inFlightRef.current) return
      inFlightRef.current = true
      setBusy(true)
      setError(null)
      const startedAt = performance.now()
      const clientTurnId = retryOf?.clientTurnId ?? newClientTurnId()
      try {
        interruptSpeech()
        const { data } = await examSpeakingApi.textTurn(sessionId, text, locale, clientTurnId)
        setPendingTurn(null)
        applyTurn(data, text, startedAt)
      } catch (e) {
        setError(apiMessage(e))
        setPendingTurn(isRetryableTurnError(e) ? { kind: 'text', text, clientTurnId } : null)
      } finally {
        inFlightRef.current = false
        setBusy(false)
      }
    },
    [applyTurn, interruptSpeech, locale, sessionId],
  )

  /** "Gửi lại" đúng lượt vừa thất bại — cùng clientTurnId nên backend không bao giờ tính thành lượt thứ hai. */
  const retryPendingTurn = useCallback(() => {
    const p = pendingTurn
    if (!p) return
    if (p.kind === 'audio') void submitAudio(p.blob, p)
    else void submitText(p.text, p)
  }, [pendingTurn, submitAudio, submitText])

  const advance = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      interruptSpeech()
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
  }, [interruptSpeech, session, sessionId])

  const finish = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      interruptSpeech()
      const { data } = await examSpeakingApi.finish(sessionId)
      setSession(data)
    } catch (e) {
      setError(apiMessage(e))
    } finally {
      setBusy(false)
    }
  }, [interruptSpeech, sessionId])

  // Gói vá F-01: job chấm chết → server trả GRADING_FAILED; nút này enqueue job MỚI và quay về
  // GRADING — effect poll sẵn có tự nối tiếp, không cần reload trang.
  const regrade = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const { data } = await examSpeakingApi.regrade(sessionId)
      setSession(data)
    } catch (e) {
      setError(apiMessage(e))
    } finally {
      setBusy(false)
    }
  }, [sessionId])

  // Gói vá F-19: phiên đã RESULTS nhưng lượt tải phiếu lỗi (mạng) — thử lại phải REFETCH thật,
  // không phải chỉ đóng banner như trước.
  const retryResult = useCallback(async () => {
    setError(null)
    try {
      const r = await examSpeakingApi.getResult(sessionId)
      setResult(r.data)
    } catch (e) {
      setError(apiMessage(e))
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

  // Sang bước/Teil khác → badge "hết giờ" của drill hết hiệu lực.
  useEffect(() => {
    setDrillTimeUp(false)
  }, [session?.currentPart, session?.currentStep])

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
            <GaCap className="block">{providerName} {session.level} · {isMock ? t('modeMock') : t('modeDrill')} · <span data-testid="beta-label">{t('beta')}</span></GaCap>
            {blueprint && <TeilStepper parts={blueprint.parts} currentTeil={session.currentPart} state={session.state} mode={session.mode} />}
          </div>
          <div className="flex items-center gap-2">
            {session.state === 'IN_PART' && (
              <ExamTimer
                deadlineAt={session.partDeadlineAt}
                serverNow={session.serverNow}
                totalSec={currentPartSummary?.durationSec ?? 0}
                onExpire={isMock ? () => void advance() : () => setDrillTimeUp(true)}
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
          <div className="mb-4" data-testid={pendingTurn ? 'turn-retry-banner' : undefined}>
            <ErrorBanner
              message={pendingTurn ? `${error} ${t('retryTurnHint')}` : error}
              onRetry={pendingTurn ? retryPendingTurn : () => setError(null)}
              retryLabel={pendingTurn ? t('retryTurn') : t('dismiss')}
            />
          </div>
        )}

        {session.state !== 'RESULTS' && session.state !== 'DONE' && <MicDeniedGuide className="mb-4" />}

        {/* Minh bạch: phiên hiệu chuẩn có lưu audio — thí sinh phải biết mình đang được ghi âm,
            kể cả khi đã ký đồng ý trước đó (đồng ý một lần ≠ được im lặng mọi lần sau). */}
        {session.retainAudio && session.state !== 'RESULTS' && (
          <p
            className="ga-ui mb-4 rounded-ga border border-ga-line bg-ga-surface px-3 py-2 text-[12.5px] text-ga-muted"
            role="note"
            data-testid="audio-retention-notice"
          >
            {t('audioRetained')}
          </p>
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
            {isMock && <MicCheck passed={micCheckPassed || micPermission === 'granted'} onPassed={() => setMicCheckPassed(true)} />}
            <GaBtn
              variant="ink"
              size="lg"
              onClick={() => void advance()}
              disabled={
                busy ||
                (session.prepMaterials ?? []).some((m) => m.choiceRequired && m.chosenIndex === null) ||
                (isMock && !micCheckPassed && micPermission !== 'granted')
              }
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
                <p className="ga-ui text-[13px] text-ga-ink" data-testid="directive-hint">
                  {session.directive.hintKey && t.has(`hints.${session.directive.hintKey}`)
                    ? t(`hints.${session.directive.hintKey}`)
                    : session.directive.hintVi}
                </p>
                {drillTimeUp && !isMock && (
                  <p className="ga-ui mt-1.5 text-[12.5px] font-semibold text-ga-red" data-testid="drill-time-up">
                    {t('drillTimeUp')}
                  </p>
                )}
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
                {/* Dải trạng thái lượt: AI đang nói → chờ; xong → "đến lượt bạn". aria-live cho screen reader. */}
                <div
                  role="status"
                  aria-live="polite"
                  data-testid="turn-status"
                  className={`ga-ui mb-2 flex items-center gap-2 rounded-ga border px-3 py-2 text-[13px] font-semibold ${
                    aiSpeaking || busy
                      ? 'border-ga-line bg-ga-card text-ga-muted'
                      : `border-ga-ink bg-ga-yellow-soft text-ga-ink ${yourTurnPulse ? 'motion-safe:animate-pulse' : ''}`
                  }`}
                >
                  {aiSpeaking ? (
                    <>
                      <Ear size={15} aria-hidden className="shrink-0" />
                      <span>{aiSpeaking === 'PARTNER' ? t('turn.partnerSpeaking') : t('turn.prueferSpeaking')}</span>
                      <span className="relative ml-auto flex h-2.5 w-2.5 shrink-0">
                        <span className="absolute inline-flex h-full w-full motion-safe:animate-ping rounded-full bg-ga-red opacity-75" />
                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-ga-red" />
                      </span>
                    </>
                  ) : busy ? (
                    <>
                      <Loader2 size={15} aria-hidden className="shrink-0 animate-spin" />
                      <span>{t('turn.processing')}</span>
                    </>
                  ) : (
                    <>
                      <Mic size={15} aria-hidden className="shrink-0" />
                      <span>{t('turn.yourTurn')}</span>
                    </>
                  )}
                </div>
                <MicBar
                  disabled={busy || aiSpeaking !== null}
                  busy={busy}
                  allowText={!isMock}
                  onAudio={submitAudio}
                  onText={submitText}
                  hint={aiSpeaking ? t('turn.waitHint') : t(`action.${session.directive.candidateAction}`)}
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

        {session.state === 'GRADING_FAILED' && (
          <section className="mx-auto max-w-xl py-10" data-testid="exam-grading-failed" data-grading-error={session.gradingError ?? ''}>
            {/* F-08: hết quota ≠ job chết — người học cần nạp/chờ kỳ mới rồi bấm Chấm lại, không phải "thử lại sau". */}
            <ErrorBanner variant="page" message={session.gradingError === 'QUOTA_EXCEEDED' ? t('gradingFailedQuota') : t('gradingFailed')} />
            <p className="ga-ui mt-3 text-[13px] text-ga-muted">
              {session.gradingError === 'QUOTA_EXCEEDED' ? t('gradingFailedQuotaDesc') : t('gradingFailedDesc')}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {session.gradingError === 'QUOTA_EXCEEDED' && (
                <a href="/v2/student/tuition" data-testid="quota-upgrade-link" className="ga-ui inline-flex items-center gap-1.5 rounded-ga bg-ga-yellow px-4 py-2.5 text-[13px] font-semibold text-ga-ink">
                  {t('upgradeCta')}
                </a>
              )}
              <button
                type="button"
                onClick={regrade}
                disabled={busy}
                data-testid="regrade-btn"
                className="ga-ui inline-flex items-center gap-1.5 rounded-ga bg-ga-ink px-4 py-2.5 text-[13px] font-semibold text-ga-bg disabled:opacity-60"
              >
                <RotateCcw size={14} aria-hidden /> {t('regradeCta')}
              </button>
              <a href={catalogHref} className="ga-ui inline-flex items-center gap-1.5 rounded-ga border border-ga-line bg-ga-card px-4 py-2.5 text-[13px] font-semibold text-ga-ink">
                <ArrowLeft size={14} aria-hidden /> {t('backToCatalog')}
              </a>
            </div>
          </section>
        )}

        {session.state === 'RESULTS' && !result && (
          <section className="mx-auto max-w-xl py-10" data-testid="result-load-failed">
            <ErrorBanner variant="page" message={t('resultLoadFailed')} onRetry={retryResult} retryLabel={t('retryResult')} />
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
