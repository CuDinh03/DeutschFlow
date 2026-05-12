'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import { aiSpeakingApi } from '@/lib/aiSpeakingApi'
import { startRecorder, RecorderHandle } from '@/lib/voiceRecorder'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

type ExamPhase = 'INTRO' | 'RECORDING' | 'TRANSCRIBING' | 'ANALYZING' | 'ERROR'

export default function MockExamPage() {
  const router = useRouter()
  const [phase, setPhase] = useState<ExamPhase>('INTRO')
  const [timeLeft, setTimeLeft] = useState(180) // 3 phút
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

      // Gradient stroke
      const gradient = ctx.createLinearGradient(0, 0, w, 0)
      gradient.addColorStop(0, '#3b82f6')
      gradient.addColorStop(0.5, '#8b5cf6')
      gradient.addColorStop(1, '#ec4899')

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
        setTimeLeft(prev => {
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
    } catch (err: any) {
      console.error('Microphone error:', err)
      setErrorMsg(
        err?.name === 'NotAllowedError'
          ? 'Bạn cần cho phép truy cập microphone để làm bài test.'
          : 'Không thể kết nối microphone. Hãy thử lại.'
      )
      setPhase('ERROR')
    }
  }, [drawWaveform])

  // ─── Stop Recording Early ─────────────────────────────────
  const stopEarly = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    if (recorderRef.current) {
      recorderRef.current.stop()
      recorderRef.current = null
    }
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
        transcript_de: realTranscript
      })

      // Step 3: Navigate to report page with report ID
      if (res.data?.id) {
        router.push(`/onboarding/error-report?id=${res.data.id}`)
      } else {
        // Fallback: use localStorage if backend doesn't return ID
        localStorage.setItem('mockExamReport', JSON.stringify(res.data))
        router.push('/onboarding/error-report')
      }
    } catch (err: any) {
      console.error('Mock exam evaluation failed:', err)
      setErrorMsg(
        err?.response?.status === 429
          ? 'Bạn đã vượt giới hạn sử dụng AI hôm nay. Hãy thử lại vào ngày mai.'
          : 'Có lỗi xảy ra khi phân tích. Hãy thử lại.'
      )
      setPhase('ERROR')
    }
  }, [router])

  // ─── Cleanup on unmount ───────────────────────────────────
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      if (recorderRef.current) {
        recorderRef.current.stream.getTracks().forEach(t => t.stop())
      }
    }
  }, [])

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s < 10 ? '0' : ''}${s}`
  }

  const progressPercent = ((180 - timeLeft) / 180) * 100

  // ─── TRANSCRIBING / ANALYZING states ──────────────────────
  if (phase === 'TRANSCRIBING' || phase === 'ANALYZING') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6">
        <div className="w-20 h-20 relative mb-8">
          <div className="absolute inset-0 rounded-full border-4 border-blue-100"></div>
          <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
        </div>
        <h2 className="text-2xl font-bold text-gray-800 text-center">
          {phase === 'TRANSCRIBING' ? 'Đang nhận diện giọng nói...' : 'AI đang phân tích trình độ...'}
        </h2>
        <p className="text-gray-500 mt-3 text-center max-w-md">
          {phase === 'TRANSCRIBING'
            ? 'Whisper AI đang chuyển âm thanh thành văn bản.'
            : 'Đang đánh giá ngữ pháp, từ vựng, phát âm và độ trôi chảy của bạn.'}
        </p>
        {transcript && phase === 'ANALYZING' && (
          <div className="mt-6 max-w-lg bg-white rounded-xl p-4 border border-gray-200 text-sm text-gray-600 italic">
            &ldquo;{transcript.substring(0, 200)}{transcript.length > 200 ? '...' : ''}&rdquo;
          </div>
        )}
      </div>
    )
  }

  // ─── ERROR state ──────────────────────────────────────────
  if (phase === 'ERROR') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6">
          <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-800 text-center mb-2">Có lỗi xảy ra</h2>
        <p className="text-gray-500 text-center max-w-md mb-8">{errorMsg}</p>
        <div className="flex gap-4">
          <button
            onClick={() => { setPhase('INTRO'); setTimeLeft(180); setErrorMsg(''); }}
            className="bg-primary text-white font-bold px-6 py-3 rounded-full hover:bg-blue-700 transition-colors"
          >
            Thử lại
          </button>
          <Link
            href="/dashboard"
            className="border-2 border-gray-200 text-gray-600 font-bold px-6 py-3 rounded-full hover:bg-gray-50 transition-colors"
          >
            Về Dashboard
          </Link>
        </div>
      </div>
    )
  }

  // ─── INTRO state ──────────────────────────────────────────
  if (phase === 'INTRO') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 transition-colors">
            <ArrowLeft size={16} /> Quay lại Dashboard
          </Link>

          <div className="w-24 h-24 mx-auto bg-blue-100 rounded-full flex items-center justify-center">
            <svg className="w-12 h-12 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </div>

          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
            Bài Test Nói 3 Phút
          </h1>
          <p className="text-gray-500 leading-relaxed">
            Hãy nói tiếng Đức tự do trong 3 phút. AI sẽ phân tích <strong>ngữ pháp</strong>,{' '}
            <strong>từ vựng</strong>, <strong>phát âm</strong> và <strong>độ trôi chảy</strong> để
            xác định trình độ CEFR và lập hồ sơ điểm yếu của bạn.
          </p>

          <div className="bg-white border border-gray-200 rounded-xl p-4 text-left space-y-3">
            <h3 className="font-bold text-gray-800 text-sm uppercase tracking-wider">💡 Gợi ý nội dung</h3>
            <ul className="text-sm text-gray-600 space-y-2">
              <li>• Giới thiệu bản thân (tên, tuổi, quê quán)</li>
              <li>• Kể về công việc hoặc ngành học</li>
              <li>• Mô tả sở thích, thói quen hàng ngày</li>
              <li>• Lý do bạn muốn học tiếng Đức</li>
            </ul>
          </div>

          <button
            onClick={startExam}
            className="w-full bg-primary hover:bg-blue-700 text-white text-lg font-bold py-4 rounded-full shadow-[0_8px_30px_rgb(37,99,235,0.3)] hover:shadow-[0_8px_30px_rgb(37,99,235,0.5)] transition-all hover:-translate-y-0.5"
          >
            Bắt đầu ghi âm
          </button>

          <p className="text-xs text-gray-400">
            Cần cho phép truy cập microphone. Dữ liệu âm thanh chỉ được xử lý để đánh giá và không được lưu lại.
          </p>
        </div>
      </div>
    )
  }

  // ─── RECORDING state ──────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6">
      <div className="max-w-md w-full">
        <Card className="shadow-2xl border-0 overflow-hidden relative">
          {/* Progress Bar */}
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gray-100">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-1000 ease-linear"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <CardContent className="p-8 flex flex-col items-center">
            {/* Timer */}
            <div className={`text-5xl font-mono font-bold mb-6 tracking-wider ${
              timeLeft <= 30 ? 'text-red-500 animate-pulse' : 'text-gray-800'
            }`}>
              {formatTime(timeLeft)}
            </div>

            {/* Waveform Canvas */}
            <div className="w-full h-24 mb-6 bg-gray-50 rounded-xl overflow-hidden border border-gray-100">
              <canvas
                ref={canvasRef}
                width={400}
                height={96}
                className="w-full h-full"
              />
            </div>

            {/* Recording Indicator */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
              <span className="text-sm font-semibold text-red-600">Đang ghi âm...</span>
            </div>

            <p className="text-sm text-gray-500 text-center mb-6 leading-relaxed">
              Hãy nói tự do bằng tiếng Đức. AI đang lắng nghe và sẽ phân tích sau khi bạn hoàn thành.
            </p>

            {/* Stop Button */}
            <button
              onClick={stopEarly}
              className="w-full bg-gray-900 hover:bg-gray-800 text-white font-bold py-3.5 px-6 rounded-full transition-all flex items-center justify-center gap-2 shadow-lg"
            >
              <div className="w-4 h-4 bg-white rounded-sm" />
              Nộp bài
            </button>

            {timeLeft <= 30 && (
              <p className="mt-3 text-xs text-red-400 font-medium animate-pulse">
                ⏰ Còn {timeLeft} giây — bài sẽ tự động nộp khi hết giờ!
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
