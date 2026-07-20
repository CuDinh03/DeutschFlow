'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Mic, AlertTriangle } from 'lucide-react'
import api from '@/lib/api'
import { aiSpeakingApi } from '@/lib/aiSpeakingApi'
import { startRecorder, RecorderHandle } from '@/lib/voiceRecorder'
import { GaCard, GaBtn, GaCap } from '@/components/ui-v2'
import { GaAuthShell } from '../../authShared'

// ─────────────────────────────────────────────────────────────────────────────
// /v2/onboarding/mock-exam — Galerie 2.0 port of /onboarding/mock-exam.
// LOGIC IS 1:1: startRecorder → aiSpeakingApi.transcribe (Whisper) → POST
// /onboarding/mock-exam/evaluate → error report. Only the shell/tokens and the
// outbound routes change (/onboarding/error-report → /v2/onboarding/error-report,
// /dashboard → /v2/student/dashboard).
// ─────────────────────────────────────────────────────────────────────────────

type ExamPhase = 'INTRO' | 'RECORDING' | 'TRANSCRIBING' | 'ANALYZING' | 'ERROR'

const EXAM_SECONDS = 180 // 3 phút
const REPORT_ROUTE = '/v2/onboarding/error-report'
const DASHBOARD_ROUTE = '/v2/student/dashboard'

export default function V2OnboardingMockExamPage() {
  const router = useRouter()
  const [phase, setPhase] = useState<ExamPhase>('INTRO')
  const [timeLeft, setTimeLeft] = useState(EXAM_SECONDS)
  const [transcript, setTranscript] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  // Audio recording refs
  const recorderRef = useRef<RecorderHandle | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const animFrameRef = useRef<number>(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ─── Waveform Visualization ───────────────────────────────
  const drawWaveform = useCallback(() => {
    const analyser = recorderRef.current?.analyser
    const canvas = canvasRef.current
    if (!analyser || !canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const bufLen = analyser.frequencyBinCount
    const dataArr = new Uint8Array(bufLen)

    const draw = () => {
      animFrameRef.current = requestAnimationFrame(draw)
      analyser.getByteTimeDomainData(dataArr)

      const w = canvas.width
      const h = canvas.height
      ctx.clearRect(0, 0, w, h)

      // Canvas 2D cannot resolve CSS custom properties, so the ga-* palette has to be
      // inlined here as literals: --ga-blue → --ga-violet → --ga-red.
      const gradient = ctx.createLinearGradient(0, 0, w, 0)
      gradient.addColorStop(0, '#2F6FC9')
      gradient.addColorStop(0.5, '#7C56C8')
      gradient.addColorStop(1, '#DA291C')

      ctx.lineWidth = 3
      ctx.strokeStyle = gradient
      ctx.beginPath()

      const sliceWidth = w / bufLen
      let x = 0
      for (let i = 0; i < bufLen; i++) {
        const v = dataArr[i] / 128.0
        const y = (v * h) / 2
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
        x += sliceWidth
      }
      ctx.lineTo(w, h / 2)
      ctx.stroke()
    }
    draw()
  }, [])

  // ─── Handle Recording Complete (Transcribe + Analyze) ─────
  const handleRecordingComplete = useCallback(async (blob: Blob) => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    setPhase('TRANSCRIBING')

    try {
      // Step 1: Transcribe audio via existing Whisper API
      const { data: sttResult } = await aiSpeakingApi.transcribe(blob)
      const realTranscript = sttResult.transcript

      if (!realTranscript || realTranscript.trim().length < 5) {
        setErrorMsg('Không nhận diện được giọng nói. Hãy thử lại và nói rõ ràng hơn.')
        setPhase('ERROR')
        return
      }

      setTranscript(realTranscript)
      setPhase('ANALYZING')

      // Step 2: Send transcript to mock-exam evaluate API
      const res = await api.post('/onboarding/mock-exam/evaluate', {
        transcript_de: realTranscript,
      })

      // Step 3: Navigate to report page with report ID
      if (res.data?.id) {
        router.push(`${REPORT_ROUTE}?id=${res.data.id}`)
      } else {
        // Fallback: use localStorage if backend doesn't return ID
        localStorage.setItem('mockExamReport', JSON.stringify(res.data))
        router.push(REPORT_ROUTE)
      }
    } catch (err: unknown) {
      console.error('Mock exam evaluation failed:', err)
      const status = (err as { response?: { status?: number } })?.response?.status
      setErrorMsg(
        status === 429
          ? 'Bạn đã vượt giới hạn sử dụng AI hôm nay. Hãy thử lại vào ngày mai.'
          : 'Có lỗi xảy ra khi phân tích. Hãy thử lại.',
      )
      setPhase('ERROR')
    }
  }, [router])

  // ─── Start Recording ──────────────────────────────────────
  const startExam = useCallback(async () => {
    try {
      const handle = await startRecorder((blob) => {
        // Called when recorder.stop() is invoked
        handleRecordingComplete(blob)
      })
      recorderRef.current = handle
      setPhase('RECORDING')

      // Start countdown
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            // Time's up — stop recording
            if (recorderRef.current) {
              recorderRef.current.stop()
              recorderRef.current = null
            }
            if (timerRef.current) clearInterval(timerRef.current)
            return 0
          }
          return prev - 1
        })
      }, 1000)

      // Start waveform
      drawWaveform()
    } catch (err: unknown) {
      console.error('Microphone error:', err)
      setErrorMsg(
        (err as { name?: string })?.name === 'NotAllowedError'
          ? 'Bạn cần cho phép truy cập microphone để làm bài test.'
          : 'Không thể kết nối microphone. Hãy thử lại.',
      )
      setPhase('ERROR')
    }
  }, [drawWaveform, handleRecordingComplete])

  // ─── Stop Recording Early ─────────────────────────────────
  const stopEarly = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    if (recorderRef.current) {
      recorderRef.current.stop()
      recorderRef.current = null
    }
  }, [])

  // ─── Cleanup on unmount ───────────────────────────────────
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      if (recorderRef.current) {
        recorderRef.current.stream.getTracks().forEach((t) => t.stop())
      }
    }
  }, [])

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s < 10 ? '0' : ''}${s}`
  }

  const progressPercent = ((EXAM_SECONDS - timeLeft) / EXAM_SECONDS) * 100

  // ─── TRANSCRIBING / ANALYZING states ──────────────────────
  if (phase === 'TRANSCRIBING' || phase === 'ANALYZING') {
    return (
      <GaAuthShell showBackToLanding={false}>
        <div className="flex flex-col items-center text-center">
          <div className="mb-7 h-16 w-16 animate-spin rounded-ga-pill border-4 border-ga-line border-t-ga-accent" />
          <h2 className="font-ga-display text-[26px] font-medium text-ga-ink">
            {phase === 'TRANSCRIBING' ? 'Đang nhận diện giọng nói...' : 'AI đang phân tích trình độ...'}
          </h2>
          <p className="mt-3 text-[14px] text-ga-muted">
            {phase === 'TRANSCRIBING'
              ? 'AI đang chuyển âm thanh thành văn bản...'
              : 'Đang đánh giá ngữ pháp, từ vựng, phát âm và độ trôi chảy của bạn.'}
          </p>
          {transcript && phase === 'ANALYZING' && (
            <GaCard className="mt-6 p-4 text-[13.5px] italic text-ga-muted">
              &ldquo;{transcript.substring(0, 200)}{transcript.length > 200 ? '...' : ''}&rdquo;
            </GaCard>
          )}
        </div>
      </GaAuthShell>
    )
  }

  // ─── ERROR state ──────────────────────────────────────────
  if (phase === 'ERROR') {
    return (
      <GaAuthShell showBackToLanding={false}>
        <div className="flex flex-col items-center text-center">
          <div className="mb-6 grid h-16 w-16 place-items-center rounded-ga-pill bg-ga-red-soft">
            <AlertTriangle size={30} className="text-ga-red" />
          </div>
          <h2 className="mb-2 font-ga-display text-[26px] font-medium text-ga-ink">Có lỗi xảy ra</h2>
          <p className="mb-8 text-[14px] text-ga-muted">{errorMsg}</p>
          <div className="flex gap-3">
            <GaBtn
              variant="ink"
              size="lg"
              onClick={() => { setPhase('INTRO'); setTimeLeft(EXAM_SECONDS); setErrorMsg('') }}
            >
              Thử lại
            </GaBtn>
            <GaBtn variant="ghost" size="lg" asChild>
              <Link href={DASHBOARD_ROUTE}>Về Dashboard</Link>
            </GaBtn>
          </div>
        </div>
      </GaAuthShell>
    )
  }

  // ─── INTRO state ──────────────────────────────────────────
  if (phase === 'INTRO') {
    return (
      <GaAuthShell showBackToLanding={false}>
        <div className="space-y-6 text-center">
          <Link href={DASHBOARD_ROUTE} className="ga-ui inline-flex items-center gap-2 text-[13px] text-ga-muted transition-colors hover:text-ga-ink">
            <ArrowLeft size={16} /> Quay lại Dashboard
          </Link>

          <div className="mx-auto grid h-20 w-20 place-items-center rounded-ga-pill bg-ga-yellow-soft">
            <Mic size={36} className="text-ga-gold" />
          </div>

          <GaCap>Bài kiểm tra nói</GaCap>
          <h1 className="m-0 font-ga-display text-[38px] font-medium tracking-[-0.015em] text-ga-ink">
            Bài Test Nói 3 Phút
          </h1>
          <p className="text-[15px] leading-relaxed text-ga-muted">
            Hãy nói tiếng Đức tự do trong 3 phút. AI sẽ phân tích <strong>ngữ pháp</strong>,{' '}
            <strong>từ vựng</strong>, <strong>phát âm</strong> và <strong>độ trôi chảy</strong> để
            xác định trình độ CEFR và lập hồ sơ điểm yếu của bạn.
          </p>

          <GaCard className="space-y-3 p-5 text-left">
            <GaCap>💡 Gợi ý nội dung</GaCap>
            <ul className="space-y-2 text-[13.5px] text-ga-muted">
              <li>• Giới thiệu bản thân (tên, tuổi, quê quán)</li>
              <li>• Kể về công việc hoặc ngành học</li>
              <li>• Mô tả sở thích, thói quen hàng ngày</li>
              <li>• Lý do bạn muốn học tiếng Đức</li>
            </ul>
          </GaCard>

          <GaBtn variant="yellow" size="lg" className="w-full" onClick={startExam}>
            Bắt đầu ghi âm
          </GaBtn>

          <p className="text-[12px] text-ga-subtle">
            Cần cho phép truy cập microphone. Dữ liệu âm thanh chỉ được xử lý để đánh giá và không được lưu lại.
          </p>
        </div>
      </GaAuthShell>
    )
  }

  // ─── RECORDING state ──────────────────────────────────────
  return (
    <GaAuthShell showBackToLanding={false}>
      <GaCard className="relative overflow-hidden shadow-ga-panel">
        {/* Progress Bar */}
        <div className="absolute left-0 top-0 h-1.5 w-full bg-ga-surface">
          <div
            className="h-full bg-ga-accent transition-all duration-1000 ease-linear"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="flex flex-col items-center p-8">
          {/* Timer */}
          <div className={`mb-6 font-mono text-5xl font-bold tracking-wider ${timeLeft <= 30 ? 'animate-pulse text-ga-red' : 'text-ga-ink'}`}>
            {formatTime(timeLeft)}
          </div>

          {/* Waveform Canvas */}
          <div className="mb-6 h-24 w-full overflow-hidden rounded-ga border border-ga-line bg-ga-surface">
            <canvas ref={canvasRef} width={400} height={96} className="h-full w-full" />
          </div>

          {/* Recording Indicator */}
          <div className="mb-6 flex items-center gap-3">
            <div className="h-3 w-3 animate-pulse rounded-ga-pill bg-ga-red" />
            <span className="ga-ui text-[13px] font-semibold text-ga-red">Đang ghi âm...</span>
          </div>

          <p className="mb-6 text-center text-[13.5px] leading-relaxed text-ga-muted">
            Hãy nói tự do bằng tiếng Đức. AI đang lắng nghe và sẽ phân tích sau khi bạn hoàn thành.
          </p>

          {/* Stop Button */}
          <GaBtn variant="ink" size="lg" className="w-full" onClick={stopEarly}>
            <span aria-hidden className="h-3.5 w-3.5 bg-current" />
            Nộp bài
          </GaBtn>

          {timeLeft <= 30 && (
            <p className="mt-3 animate-pulse text-[12px] font-medium text-ga-red">
              ⏰ Còn {timeLeft} giây — bài sẽ tự động nộp khi hết giờ!
            </p>
          )}
        </div>
      </GaCard>
    </GaAuthShell>
  )
}
