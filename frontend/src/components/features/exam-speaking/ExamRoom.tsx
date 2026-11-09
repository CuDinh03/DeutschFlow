'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { Volume2, VolumeX, RotateCcw, ArrowLeft, Loader2, X, CircleAlert, ClipboardList, Layers, Mic } from 'lucide-react'
import { examSpeakingApi } from '@/lib/examSpeakingApi'
import { newClientTurnId } from '@/lib/exam/clientTurnId'
import { apiMessage, httpStatus } from '@/lib/api'
import { parseMinorAudioBlocked, type MinorAudioBlocked } from '@/lib/minorAudio'
import { MAX_TRANSCRIBE_BYTES } from '@/lib/voiceRecorder'
import type { BlueprintSummary, ExamResultView, ExamSessionView, RoomLine, TurnResponse } from '@/types/exam-speaking'
import { ConfirmDialog, ErrorBanner, GaBtn, LoadingState, useImmersiveChrome } from '@/components/ui-v2'
import { MinorAudioBlockedNotice } from '@/components/ui-v2/MinorAudioBlockedNotice'
import { GaGlyph, type GaGlyphIcon } from '@/components/ui-v2/GaGlyph'
import { ExamTimer } from './ExamTimer'
import { TeilStepper } from './TeilStepper'
import { ExamTranscript } from './ExamTranscript'
import { MicBar } from './MicBar'
import { OralPeople, type OralSpeaker } from './OralPeople'
import { OralTaskCard } from './OralTaskCard'
import { OralPrep } from './OralPrep'
import { oralEntryHref } from '@/lib/exam/oralRoutes'
import { readAutoStop, writeAutoStop } from '@/lib/exam/silenceDetector'
import { MicDeniedGuide } from '@/components/speaking/MicDeniedGuide'
import { useMicPermission } from '@/hooks/useMicPermission'
import { OralResult } from './OralResult'
import { TourHelpButton, useScreenTour } from '@/components/exam/tour/ScreenTour'
import { cn } from '@/lib/utils'
import { DrillSummary } from './DrillSummary'
import { isExamTtsMuted, setExamTtsMuted, speakExamLine, stopExamTts, unlockExamAudio } from './examTts'

interface Props {
  sessionId: number
  /** Nơi về khi rời phòng / thi xong (mặc định màn Hôm nay của Luyện thi). */
  returnHref: string
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
 * Phòng thi cá nhân: chuẩn bị (toàn màn hình) → đang thi (Prüfer/Partner AI + thẻ đề + đồng hồ server) → drill: tổng kết;
 * mock: chấm nền → Ergebnisbogen. Mock chỉ nhận AUDIO (server phiên âm); drill có fallback bàn phím.
 */
export function ExamRoom({ sessionId, returnHref }: Props) {
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
  // 403 MINOR_AUDIO_BLOCKED (DEC-22/D8): lượt nói audio bị chặn tới khi trung tâm ghi nhận đồng ý
  // của người giám hộ — không phải lỗi lượt, không giữ pendingTurn ("Gửi lại" không mở được cổng).
  const [minorBlocked, setMinorBlocked] = useState<MinorAudioBlocked | null>(null)
  const [loading, setLoading] = useState(true)
  const [muted, setMuted] = useState(isExamTtsMuted())
  const [notes, setNotes] = useState('')
  const spokenRef = useRef<string | null>(null)
  // ── cơ chế lượt: AI đang nói → khoá mic/text, xong → báo "đến lượt bạn" ────────────────
  const [aiSpeaking, setAiSpeaking] = useState<'PRUEFER' | 'PARTNER' | null>(null)
  const [recording, setRecording] = useState(false)
  // Tự dừng khi im 2 giây (Đợt 5): mặc định bật, nhớ theo máy; đọc sau khi mount để khớp lúc dựng trang.
  const [autoStop, setAutoStop] = useState(true)
  useEffect(() => setAutoStop(readAutoStop()), [])
  const toggleAutoStop = () => {
    setAutoStop((v) => {
      writeAutoStop(!v)
      return !v
    })
  }
  const speakGenRef = useRef(0)
  // Lời AI bị trình duyệt chặn phát (outcome 'blocked') → chờ học viên chạm "nghe" hoặc "bỏ qua".
  const [ttsBlocked, setTtsBlocked] = useState(false)
  const blockedResolveRef = useRef<((choice: 'play' | 'skip') => void) | null>(null)
  const [pendingTurn, setPendingTurn] = useState<PendingTurn | null>(null)
  // Hỏi trước khi kết thúc / sang Teil (thi thử không quay lại được) — luật thoát giữa chừng 07/11.
  const [confirm, setConfirm] = useState<'finish' | 'advance' | 'leave' | null>(null)
  // Chuẩn bị + Đang thi = toàn màn hình, ẩn thanh điều hướng để không bấm nhầm thoát; màn kết quả lấy lại nav.
  useImmersiveChrome(session?.state === 'IN_PART' || session?.state === 'PREP')
  // Hướng dẫn lần đầu (Đợt 4, owner chốt 07/11/2026): tự mở khi lần đầu vào Đang thi, cả luyện lẫn thi
  // thử. Đồng hồ thi do server giữ nên không dừng được; giám khảo chờ tới khi đóng hướng dẫn mới nói.
  const tt = useTranslations('v2.student.tour')
  const tour = useScreenTour({
    key: 'exam.oral',
    ready: !loading && session?.state === 'IN_PART' && !!session?.directive,
    steps: [
      { target: 'oral-steps', icon: Layers, title: tt('oral.steps.t'), body: tt('oral.steps.p') },
      { target: 'oral-mic', icon: Mic, title: tt('oral.mic.t'), body: tt('oral.mic.p') },
      { target: 'oral-task', icon: ClipboardList, title: tt('oral.task.t'), body: tt('oral.task.p') },
    ],
  })

  /**
   * Đọc lần lượt các lời AI và giữ trạng thái lượt trong suốt chuỗi. Generation guard: mỗi hành động
   * của người dùng (gửi lượt, advance, finish) bump gen + stopExamTts() → chuỗi cũ tự thoát,
   * không ghi đè state của hành động mới.
   */
  const speakSequence = useCallback(async (turns: { role: string; text: string }[]) => {
    const gen = ++speakGenRef.current
    for (const turn of turns) {
      setAiSpeaking(turn.role === 'PARTNER' ? 'PARTNER' : 'PRUEFER')
      let outcome = await speakExamLine(turn.role, turn.text)
      // iOS chặn phát ngoài cú chạm (plan đường âm thanh §2.1): giữ micro khoá, hiện "Chạm để nghe".
      // KHÔNG tự phát lại ở cú chạm sau — cú chạm đó có thể là nút micro, giọng AI sẽ lọt vào bản ghi.
      while (outcome === 'blocked' && speakGenRef.current === gen) {
        const choice = await new Promise<'play' | 'skip'>((resolve) => {
          blockedResolveRef.current = resolve
          setTtsBlocked(true)
        })
        blockedResolveRef.current = null
        setTtsBlocked(false)
        if (speakGenRef.current !== gen || choice === 'skip') break
        outcome = await speakExamLine(turn.role, turn.text)
      }
      if (speakGenRef.current !== gen) return
    }
    setAiSpeaking(null)
  }, [])

  /** Người dùng chủ động hành động → cắt mọi lời AI đang phát và mở khoá ngay. */
  const interruptSpeech = useCallback(() => {
    speakGenRef.current += 1
    stopExamTts()
    blockedResolveRef.current?.('skip')
    setAiSpeaking(null)
  }, [])

  /** Nút "Chạm để nghe": mở khoá audio ĐỒNG BỘ trong cú chạm rồi mới cho chuỗi phát lại. */
  const playBlocked = useCallback(() => {
    unlockExamAudio()
    blockedResolveRef.current?.('play')
  }, [])

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
      // Drill đã xong mà mở lại trang (tải lại, mở từ lịch sử): tổng kết dựng từ hội thoại đã lưu.
      if (data.state === 'DONE') {
        const tr = await examSpeakingApi.getTranscript(sessionId).catch(() => null)
        if (tr?.data?.length) {
          setLines(tr.data.map((l) => ({ id: `t${l.seq}`, role: l.role, text: l.text, teilNo: l.teilNo, eval: l.eval })))
          return
        }
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
    // Hướng dẫn lần đầu chưa xong (đang chờ biết đã xem chưa, hoặc đang mở) → giám khảo chờ.
    if (!tour.settled) return
    const key = `${d.teilNo}:${d.prueferText}`
    if (spokenRef.current === key) return
    spokenRef.current = key
    void speakSequence([{ role: 'PRUEFER', text: d.prueferText }])
  }, [session, speakSequence, tour.settled])

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
        const blocked = parseMinorAudioBlocked(e)
        if (blocked) {
          setMinorBlocked(blocked)
          setPendingTurn(null)
        } else {
          setError(httpStatus(e) === 413 ? t('audioTooLarge') : apiMessage(e))
          setPendingTurn(isRetryableTurnError(e) ? { kind: 'audio', blob, filename, clientTurnId } : null)
        }
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
  const partCount = blueprint?.parts.length ?? session.totalParts
  const isLastPart = session.currentPart >= partCount
  const againHref = oralEntryHref({
    provider: session.provider,
    level: session.level,
    mode: session.mode,
    teil: session.mode === 'DRILL' ? session.currentPart : null,
    ret: returnHref,
  })
  const teilTitles = blueprint ? Object.fromEntries(blueprint.parts.map((p) => [p.teilNo, p.title])) : undefined

  const notices = (
    <>
      {minorBlocked && (
        <div className="mb-4">
          <MinorAudioBlockedNotice info={minorBlocked} onDismiss={() => setMinorBlocked(null)} />
        </div>
      )}

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
          className="ga-ui mb-4 rounded-ga border border-ga-line bg-ga-surface px-3 py-2 text-ga-small text-ga-muted"
          role="note"
          data-testid="audio-retention-notice"
        >
          {t('audioRetained')}
        </p>
      )}
    </>
  )

  const muteButton = (
    <button
      type="button"
      onClick={toggleMute}
      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-ga-line bg-ga-card text-ga-muted hover:bg-ga-side-active hover:text-ga-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus"
      aria-pressed={muted}
      aria-label={muted ? t('unmute') : t('mute')}
      title={muted ? t('unmute') : t('mute')}
      data-testid="tts-mute"
    >
      {muted ? <VolumeX size={17} aria-hidden /> : <Volume2 size={17} aria-hidden />}
    </button>
  )

  const eyebrow = (
    <p className="ga-ui mb-0.5 truncate text-ga-caption text-ga-muted">
      <span lang="de">{t('oral.eyebrow')}</span> · {providerName} {session.level} · {isMock ? t('modeMock') : t('modeDrill')} ·{' '}
      <span data-testid="beta-label">{t('beta')}</span>
    </p>
  )
  const leaveDialog = (
    <ConfirmDialog
      open={confirm === 'leave'}
      onOpenChange={(o) => !o && setConfirm(null)}
      title={t('oral.prep.leaveTitle')}
      description={isMock ? t('oral.prep.leaveBodyMock') : t('oral.prep.leaveBodyDrill')}
      confirmLabel={t('oral.prep.leaveGo')}
      cancelLabel={t('oral.confirm.stay')}
      destructive={false}
      onConfirm={() => {
        setConfirm(null)
        window.location.assign(returnHref)
      }}
    />
  )

  // ── Chuẩn bị: phòng toàn màn hình theo mẫu 07/11/2026 ─────────────────────────────────────
  if (session.state === 'PREP') {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-ga-bg" data-testid="oral-prep-room">
        <header className="shrink-0 border-b border-ga-line bg-ga-card">
          <div className="flex min-h-14 items-center gap-2 px-2 py-1.5 lg:gap-3 lg:px-4">
            <button
              type="button"
              onClick={() => setConfirm('leave')}
              aria-label={t('oral.prep.leave')}
              title={t('oral.prep.leave')}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-ga-line bg-ga-card text-ga-muted hover:bg-ga-side-active hover:text-ga-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus"
              data-testid="prep-leave"
            >
              <X size={18} aria-hidden />
            </button>
            <div className="min-w-0 flex-1">
              {eyebrow}
              <h1 className="font-ga-display text-ga-h3 text-ga-ink">{t('oral.prep.title')}</h1>
            </div>
            {session.prepDeadlineAt && (
              <ExamTimer
                variant="pill"
                tone="prep"
                deadlineAt={session.prepDeadlineAt}
                serverNow={session.serverNow}
                totalSec={session.prepSec ?? blueprint?.prepSec ?? 0}
                label={t('prepLeft')}
                onExpire={() => void advance()}
              />
            )}
          </div>
        </header>
        <div className="ga-autoscroll min-h-0 flex-1 overflow-y-auto px-3 py-5 sm:px-6">
          <div className="mx-auto w-full max-w-6xl">{notices}</div>
          <OralPrep
            session={session}
            blueprint={blueprint}
            notes={notes}
            onNotesChange={setNotes}
            onSaveNotes={() => void saveNotes()}
            onChoose={(teilNo, idx) => void choose(teilNo, idx)}
            onEnter={() => void advance()}
            busy={busy}
            micGate={isMock && micPermission !== 'granted' && !micCheckPassed}
            onMicPassed={() => setMicCheckPassed(true)}
          />
        </div>
        {leaveDialog}
      </div>
    )
  }

  // ── Đang thi: phòng toàn màn hình theo mẫu 07/11/2026 ─────────────────────────────────────
  if (session.state === 'IN_PART' && session.directive) {
    const d = session.directive
    const speaker: OralSpeaker = aiSpeaking ?? (recording ? 'ME' : null)
    const yourTurn = !aiSpeaking && !busy && !recording
    const hasPartner = currentPartSummary?.hasPartner ?? lines.some((l) => l.role === 'PARTNER')
    const hint = d.hintKey && t.has(`hints.${d.hintKey}`) ? t(`hints.${d.hintKey}`) : d.hintVi
    const action = t.has(`oral.action.${d.candidateAction}`) ? t(`oral.action.${d.candidateAction}`) : ''
    const meSub = aiSpeaking ? t('oral.me.listen') : busy ? t('oral.me.sending') : recording ? t('oral.me.recording') : t('oral.me.turn')
    const [statusTitle, statusSub] = aiSpeaking
      ? [aiSpeaking === 'PARTNER' ? t('oral.status.partnerTalking') : t('oral.status.prueferTalking'), t('oral.status.listen')]
      : busy
        ? [t('oral.status.processing'), t('oral.status.processingSub')]
        : recording
          ? [t('oral.status.recording'), autoStop ? t('oral.status.recordingAutoSub') : t('oral.status.recordingSub')]
          : [t('oral.status.yourTurn'), action ? t('oral.status.tapWithAction', { action }) : t('oral.status.tap')]
    const nextTeil = session.currentPart + 1
    const advanceLabel = isMock ? (isLastPart ? null : t('oral.nextTeil', { n: nextTeil })) : t('skipPart')

    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-ga-bg" data-testid="oral-room">
        <header className="shrink-0 border-b border-ga-line bg-ga-card">
          <div className="flex min-h-14 items-center gap-2 px-2 py-1.5 lg:gap-3 lg:px-4">
            <button
              type="button"
              onClick={() => setConfirm('finish')}
              disabled={busy}
              aria-label={isMock ? t('finishMock') : t('finishDrill')}
              title={isMock ? t('finishMock') : t('finishDrill')}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-ga-line bg-ga-card text-ga-muted hover:bg-ga-side-active hover:text-ga-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus disabled:opacity-50"
              data-testid="finish-session"
            >
              <X size={18} aria-hidden />
            </button>
            <div className="min-w-0 flex-1">
              {eyebrow}
              {blueprint ? (
                <div data-tour="oral-steps" className="w-fit">
                  <TeilStepper parts={blueprint.parts} currentTeil={session.currentPart} state={session.state} mode={session.mode} />
                </div>
              ) : (
                <p data-tour="oral-steps" className="font-ga-display text-ga-h3 text-ga-ink">
                  {t('teilCap', { n: d.teilNo })}
                </p>
              )}
            </div>
            <TourHelpButton onClick={tour.start} />
            {muteButton}
            <ExamTimer
              variant="pill"
              deadlineAt={session.partDeadlineAt}
              serverNow={session.serverNow}
              totalSec={currentPartSummary?.durationSec ?? 0}
              onExpire={isMock ? () => void advance() : () => setDrillTimeUp(true)}
              label={t('timeLeft')}
            />
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className="flex min-h-0 flex-1 flex-col" aria-label={t('oral.conversation')}>
            <OralPeople speaker={speaker} hasPartner={hasPartner} meSub={meSub} />
            <div className="ga-autoscroll min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-4">
              {notices}
              <ExamTranscript lines={lines} mode={session.mode} teilTitles={teilTitles} />
            </div>
            {ttsBlocked && (
              <div
                role="alert"
                className="ga-ui mx-3 mb-2 flex flex-col gap-2 rounded-ga-lg border border-ga-line bg-ga-card p-3 sm:mx-4 sm:flex-row sm:items-center"
                data-testid="tts-blocked"
              >
                <div className="min-w-0 flex-1 text-ga-small text-ga-muted">
                  <b className="block text-ga-body font-semibold text-ga-ink">{t('oral.blocked.title')}</b>
                  {t('oral.blocked.sub')}
                </div>
                <div className="flex shrink-0 gap-2">
                  <GaBtn variant="ink" size="lg" onClick={playBlocked} data-testid="tts-blocked-play">
                    <Volume2 size={16} aria-hidden />
                    {t('oral.blocked.play')}
                  </GaBtn>
                  <GaBtn variant="ghost" size="lg" onClick={() => blockedResolveRef.current?.('skip')} data-testid="tts-blocked-skip">
                    {t('oral.blocked.skip')}
                  </GaBtn>
                </div>
              </div>
            )}
            <MicBar
              disabled={busy || aiSpeaking !== null}
              busy={busy}
              allowText={!isMock}
              onAudio={submitAudio}
              onText={submitText}
              hint={statusSub}
              yourTurn={yourTurn}
              onRecordingChange={setRecording}
              autoStop={autoStop}
              status={
                <>
                  <div role="status" aria-live="polite" data-testid="turn-status" className="ga-ui min-w-0 text-ga-small text-ga-muted">
                    <b className="flex items-center gap-1.5 text-ga-body font-semibold text-ga-ink">
                      {busy && <Loader2 size={15} aria-hidden className="shrink-0 animate-spin" />}
                      <span className="min-w-0">{statusTitle}</span>
                    </b>
                    <span className="mt-0.5 block">{statusSub}</span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={autoStop}
                    onClick={toggleAutoStop}
                    title={t('oral.autoStopHint')}
                    className="ga-ui mt-1.5 inline-flex min-h-8 items-center gap-1.5 rounded-ga-pill text-ga-caption font-semibold text-ga-muted hover:text-ga-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus"
                    data-testid="auto-stop-toggle"
                  >
                    <span aria-hidden className={`relative h-3.5 w-6 shrink-0 rounded-ga-pill transition-colors duration-150 ${autoStop ? 'bg-ga-navy' : 'bg-ga-line-strong'}`}>
                      <span className={`absolute top-0.5 h-2.5 w-2.5 rounded-full bg-ga-card transition-[left] duration-150 ${autoStop ? 'left-3' : 'left-0.5'}`} />
                    </span>
                    {t('oral.autoStop')}
                  </button>
                </>
              }
              meta={
                <div className="ga-ui text-right text-ga-small text-ga-muted" data-testid="turn-count">
                  <b className="block text-ga-body font-semibold tabular-nums text-ga-ink">
                    {d.stepIndex + 1}/{d.stepCount}
                  </b>
                  {t('oral.turns')}
                </div>
              }
            />
          </section>
          <OralTaskCard
            directive={d}
            provider={session.provider}
            level={session.level}
            hint={hint}
            notesText={session.notesText}
            drillTimeUp={drillTimeUp && !isMock}
            advanceLabel={advanceLabel}
            onAdvance={() => (isMock ? setConfirm('advance') : void advance())}
            busy={busy}
          />
        </div>

        {tour.overlay}
        <ConfirmDialog
          open={confirm === 'finish'}
          onOpenChange={(o) => !o && setConfirm(null)}
          title={isMock ? t('oral.confirm.finishMockTitle') : t('oral.confirm.finishDrillTitle')}
          description={isMock ? t('oral.confirm.finishMockBody') : t('oral.confirm.finishDrillBody')}
          confirmLabel={isMock ? t('oral.confirm.finishMockGo') : t('oral.confirm.finishDrillGo')}
          cancelLabel={isMock ? t('oral.confirm.keepGoing') : t('oral.confirm.keepPractising')}
          destructive={false}
          onConfirm={() => {
            setConfirm(null)
            void finish()
          }}
        />
        <ConfirmDialog
          open={confirm === 'advance'}
          onOpenChange={(o) => !o && setConfirm(null)}
          title={t('oral.confirm.nextTitle', { n: nextTeil })}
          description={t('oral.confirm.nextBody', { cur: session.currentPart })}
          confirmLabel={t('oral.confirm.nextGo', { n: nextTeil })}
          cancelLabel={t('oral.confirm.stay')}
          destructive={false}
          onConfirm={() => {
            setConfirm(null)
            void advance()
          }}
        />
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col px-4 py-6 sm:px-6 lg:py-8">
      {notices}

      {session.state === 'GRADING' && (
        <StateCard testId="exam-grading" icon={Loader2} title={t('grading')} body={t('gradingDesc')}>
          <p className="ga-ui text-ga-small text-ga-muted">{t('oral.result.gradingLeave')}</p>
          <Link href={returnHref} className={ghostBtn}>
            <ArrowLeft size={16} aria-hidden /> {t('backToCatalog')}
          </Link>
        </StateCard>
      )}

      {session.state === 'GRADING_FAILED' && (
        <StateCard
          testId="exam-grading-failed"
          data={{ 'data-grading-error': session.gradingError ?? '' }}
          icon={CircleAlert}
          tone="red"
          // F-08: hết quota ≠ job chết — người học cần nạp/chờ kỳ mới rồi bấm Chấm lại, không phải "thử lại sau".
          title={session.gradingError === 'QUOTA_EXCEEDED' ? t('gradingFailedQuota') : t('gradingFailed')}
          body={session.gradingError === 'QUOTA_EXCEEDED' ? t('gradingFailedQuotaDesc') : t('gradingFailedDesc')}
        >
          <div className="flex flex-wrap justify-center gap-2">
            {session.gradingError === 'QUOTA_EXCEEDED' && (
              <Link href="/v2/student/tuition" data-testid="quota-upgrade-link" className={cn(primaryBtn, 'bg-ga-yellow text-ga-ink')}>
                {t('upgradeCta')}
              </Link>
            )}
            <button type="button" onClick={regrade} disabled={busy} data-testid="regrade-btn" className={primaryBtn}>
              <RotateCcw size={16} aria-hidden /> {t('regradeCta')}
            </button>
            <Link href={returnHref} className={ghostBtn}>
              <ArrowLeft size={16} aria-hidden /> {t('backToCatalog')}
            </Link>
          </div>
        </StateCard>
      )}

      {session.state === 'RESULTS' && !result && (
        <section className="mx-auto w-full max-w-xl py-10" data-testid="result-load-failed">
          <ErrorBanner variant="page" message={t('resultLoadFailed')} onRetry={retryResult} retryLabel={t('retryResult')} />
        </section>
      )}

      {session.state === 'RESULTS' && result && (
        <OralResult result={result} blueprint={blueprint} sessionId={sessionId} againHref={againHref} returnHref={returnHref} />
      )}

      {session.state === 'DONE' && (
        <div className="flex flex-col gap-6" data-testid="oral-drill-done">
          <header>
            <p className="ga-ui text-ga-caption font-semibold uppercase tracking-wide text-ga-muted">
              <span lang="de">{t('oral.eyebrow')}</span> · {providerName} {session.level} · {t('modeDrill')}
            </p>
            <h1 className="mt-1 font-ga-display text-ga-h1 text-ga-ink">{t('oral.result.drillDone', { n: session.currentPart })}</h1>
          </header>
          <DrillSummary lines={lines} />
          <RoomFooter againHref={againHref} returnHref={returnHref} />
        </div>
      )}

      {session.state === 'ABORTED' && (
        <div className="mx-auto w-full max-w-xl">
          <ErrorBanner variant="page" message={t('aborted')} />
          <RoomFooter againHref={againHref} returnHref={returnHref} />
        </div>
      )}
    </div>
  )
}

const primaryBtn =
  'ga-ui inline-flex min-h-11 items-center gap-1.5 rounded-ga-touch bg-ga-ink px-4 text-ga-body font-semibold text-ga-bg hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus focus-visible:ring-offset-2 disabled:opacity-50'
const ghostBtn =
  'ga-ui inline-flex min-h-11 items-center gap-1.5 rounded-ga-touch border border-ga-line bg-ga-card px-4 text-ga-body font-semibold text-ga-ink hover:bg-ga-side-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus'

/** Thẻ trạng thái giữa màn (mẫu "Trạng thái" 07/11/2026): ô icon, tiêu đề, một dòng giải thích, nút. */
function StateCard({
  testId,
  data,
  icon,
  tone = 'plain',
  title,
  body,
  children,
}: {
  testId: string
  data?: Record<string, string>
  icon: GaGlyphIcon
  tone?: 'plain' | 'red'
  title: string
  body: string
  children?: ReactNode
}) {
  return (
    <section className="mx-auto flex w-full max-w-md flex-col items-center gap-3 py-10 text-center" data-testid={testId} {...data}>
      <GaGlyph icon={icon} size="lg" tone={tone} />
      <h1 className="font-ga-display text-ga-h2 text-ga-ink">{title}</h1>
      <p className="ga-ui text-ga-body text-ga-muted">{body}</p>
      {children}
    </section>
  )
}

function RoomFooter({ againHref, returnHref }: { againHref: string; returnHref: string }) {
  const t = useTranslations('v2.student.examSpeaking.room')
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Link href={againHref} className={ghostBtn} data-testid="room-again">
        <RotateCcw size={16} aria-hidden /> {t('again')}
      </Link>
      <Link href={returnHref} className={primaryBtn} data-testid="room-back">
        <ArrowLeft size={16} aria-hidden /> {t('backToCatalog')}
      </Link>
    </div>
  )
}
