'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Mic, Loader2, Play, CheckCircle, RefreshCcw, Volume2 } from 'lucide-react'
import { startRecorder, RecorderHandle } from '@/lib/voiceRecorder'
import { aiSpeakingApi } from '@/lib/aiSpeakingApi'
import api from '@/lib/api'

interface SprechenCard {
  thema: string
  wort: string
}

interface TurnEvaluation {
  score?: number
  feedback_vi?: string
  ai_response_de?: string
  next_stage?: string
  next_thema?: string
  next_wort?: string
  next_ai_question?: string
}

type TurnStage = 'START' | 'USER_ASKING' | 'AI_ANSWERING' | 'AI_ASKING' | 'USER_ANSWERING' | 'EVALUATING' | 'FINISHED'

export function SprechenTeil2Simulator({ onFinish }: { onFinish?: (score: number) => void }) {
  const [stage, setStage] = useState<TurnStage>('START')
  const [card, setCard] = useState<SprechenCard | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [aiAudioUrl, setAiAudioUrl] = useState<string | null>(null)
  
  // Evaluation History
  const [evaluations, setEvaluations] = useState<{
    type: 'USER_ASK' | 'USER_ANSWER',
    transcript: string,
    score: number,
    feedback: string,
    aiResponse: string
  }[]>([])

  // AI's generated question
  const [aiQuestion, setAiQuestion] = useState('')

  const recorderRef = useRef<RecorderHandle | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    // Load initial card
    loadNextCard()
  }, [])

  const loadNextCard = async () => {
    try {
      setProcessing(true)
      const res = await api.get('/onboarding/mock-exam/sprechen-teil2/card')
      setCard(res.data)
      setStage('USER_ASKING')
    } catch (e) {
      setErrorMsg('Không thể tải thẻ bài thi.')
    } finally {
      setProcessing(false)
    }
  }

  const startRecording = async () => {
    setErrorMsg('')
    try {
      const handle = await startRecorder((blob) => {
        handleRecordingComplete(blob)
      })
      recorderRef.current = handle
      setIsRecording(true)
    } catch (err: any) {
      setErrorMsg('Không thể truy cập Microphone.')
    }
  }

  const stopRecording = () => {
    if (recorderRef.current) {
      recorderRef.current.stop()
      recorderRef.current = null
      setIsRecording(false)
    }
  }

  const handleRecordingComplete = async (blob: Blob) => {
    setProcessing(true)
    try {
      // 1. STT
      const { data: sttResult } = await aiSpeakingApi.transcribe(blob)
      const transcript = sttResult.transcript

      if (!transcript || transcript.trim().length < 2) {
        setErrorMsg('Không nhận diện được giọng nói. Hãy thử lại.')
        setProcessing(false)
        return
      }

      // 2. Evaluate Turn
      const currentPayload = {
        stage: stage === 'USER_ASKING' ? 'USER_ASKING' : 'USER_ANSWERING',
        thema: card?.thema,
        wort: card?.wort,
        transcript: transcript,
        ai_question_asked: stage === 'USER_ANSWERING' ? aiQuestion : undefined
      }

      const res = await api.post<TurnEvaluation>('/onboarding/mock-exam/sprechen-teil2/turn', currentPayload)
      const evalData = res.data

      // Save evaluation
      setEvaluations(prev => [...prev, {
        type: currentPayload.stage as 'USER_ASK' | 'USER_ANSWER',
        transcript,
        score: evalData.score || 0,
        feedback: evalData.feedback_vi || '',
        aiResponse: evalData.ai_response_de || ''
      }])

      // Play AI Voice
      if (evalData.ai_response_de) {
        await playTTS(evalData.ai_response_de)
      }

      // Transition Stage
      if (evalData.next_stage === 'USER_ANSWERING') {
        setStage('AI_ASKING')
        setCard({ thema: evalData.next_thema || '', wort: evalData.next_wort || '' })
        setAiQuestion(evalData.next_ai_question || '')
        
        // Let the AI speak its new question after its previous response finishes.
        // For simplicity, we just play it immediately.
        setTimeout(() => {
           playTTS(evalData.next_ai_question || '')
           setStage('USER_ANSWERING')
        }, 4000) // Rough delay for previous TTS
      } else {
        setStage('FINISHED')
        if (onFinish) {
          const totalScore = evaluations.reduce((acc, curr) => acc + curr.score, evalData.score || 0)
          onFinish(totalScore)
        }
      }

    } catch (err) {
      setErrorMsg('Lỗi phân tích. Hãy thử lại.')
    } finally {
      setProcessing(false)
    }
  }

  const playTTS = async (text: string) => {
    try {
      // Ensure we hit the correct backend Edge TTS endpoint.
      const res = await api.post('/ai-speaking/tts', { text, persona: 'DEFAULT' }, { responseType: 'blob' })
      const audioUrl = URL.createObjectURL(res.data)
      setAiAudioUrl(audioUrl)
      
      if (audioRef.current) {
        audioRef.current.src = audioUrl
        audioRef.current.play()
      }
    } catch (e) {
      console.error("TTS failed", e)
    }
  }

  if (stage === 'START') {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-slate-200 shadow-sm">
        <Loader2 className="animate-spin text-indigo-500 mb-4" size={32} />
        <p className="text-slate-500 font-medium">Đang chuẩn bị thẻ bài...</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-4">
        <h3 className="font-bold text-white text-lg flex items-center gap-2">
          <Mic size={20} />
          Mock Exam: Sprechen Teil 2
        </h3>
        <p className="text-white/80 text-sm">Um Informationen bitten und Informationen geben</p>
      </div>

      <div className="p-6">
        {/* The Card */}
        {card && stage !== 'FINISHED' && (
          <div className="flex flex-col items-center mb-8">
            <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Thẻ bài của bạn</p>
            <div className="w-64 aspect-[3/2] bg-[#FDFDEA] border-2 border-slate-300 shadow-md flex flex-col relative transform transition-transform hover:scale-105">
              <div className="bg-sky-700 text-white text-center py-2 font-bold text-sm">
                Thema: {card.thema}
              </div>
              <div className="flex-1 flex items-center justify-center">
                <span className="font-black text-3xl text-slate-800">{card.wort}</span>
              </div>
            </div>
          </div>
        )}

        {/* Instructions */}
        {stage === 'USER_ASKING' && (
          <div className="text-center mb-8">
            <p className="font-medium text-slate-700">Hãy đặt <span className="font-bold text-indigo-600">một câu hỏi</span> liên quan đến thẻ này.</p>
          </div>
        )}

        {stage === 'AI_ASKING' && (
          <div className="text-center mb-8">
            <Loader2 className="animate-spin mx-auto text-indigo-500 mb-2" />
            <p className="font-medium text-slate-700">AI Partner đang đặt câu hỏi...</p>
          </div>
        )}

        {stage === 'USER_ANSWERING' && (
          <div className="text-center mb-8">
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 mb-4 text-indigo-800 font-medium">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Volume2 size={18} /> <span className="text-xs uppercase font-bold">Câu hỏi của AI</span>
              </div>
              "{aiQuestion}"
            </div>
            <p className="font-medium text-slate-700">Hãy đưa ra <span className="font-bold text-emerald-600">câu trả lời</span> của bạn.</p>
          </div>
        )}

        {/* Interaction Area */}
        {stage !== 'FINISHED' && stage !== 'AI_ASKING' && (
          <div className="flex flex-col items-center">
            <button
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onTouchStart={startRecording}
              onTouchEnd={stopRecording}
              disabled={processing}
              className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
                isRecording 
                  ? 'bg-red-500 text-white scale-110 shadow-[0_0_20px_rgba(239,68,68,0.5)]' 
                  : processing 
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200 hover:scale-105 cursor-pointer'
              }`}
            >
              {processing ? <Loader2 className="animate-spin" size={32} /> : <Mic size={32} />}
            </button>
            <p className="mt-4 text-sm font-medium text-slate-500">
              {isRecording ? 'Đang thu âm... Thả ra để nộp' : processing ? 'Đang chấm điểm...' : 'Nhấn giữ để nói'}
            </p>
            {errorMsg && <p className="mt-2 text-sm text-red-500 font-medium">{errorMsg}</p>}
          </div>
        )}

        {/* Feedback History */}
        {evaluations.length > 0 && (
          <div className="mt-8 space-y-4 border-t border-slate-100 pt-6">
            <h4 className="font-bold text-slate-800">Kết quả đánh giá AI</h4>
            {evaluations.map((ev, idx) => (
              <div key={idx} className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-bold uppercase text-slate-500 bg-white px-2 py-1 rounded shadow-sm border border-slate-100">
                    {ev.type === 'USER_ASK' ? 'Lượt 1: Bạn đặt câu hỏi' : 'Lượt 2: Bạn trả lời'}
                  </span>
                  <span className="font-black text-lg text-emerald-600">{ev.score}/10 điểm</span>
                </div>
                <p className="text-sm font-medium text-slate-700 italic mb-2">"{ev.transcript}"</p>
                <div className="bg-white border-l-4 border-amber-400 p-3 text-sm text-slate-600">
                  <span className="font-bold text-amber-600">Phản hồi:</span> {ev.feedback}
                </div>
                {ev.aiResponse && (
                   <p className="text-sm mt-3 text-indigo-700 font-medium bg-indigo-50 p-2 rounded">
                     <Volume2 size={14} className="inline mr-1" /> AI: "{ev.aiResponse}"
                   </p>
                )}
              </div>
            ))}
          </div>
        )}

        {stage === 'FINISHED' && (
          <div className="text-center py-8">
            <CheckCircle size={64} className="text-emerald-500 mx-auto mb-4" />
            <h3 className="font-bold text-2xl text-slate-800 mb-2">Hoàn thành Teil 2!</h3>
            <p className="text-slate-600 mb-6">Bạn đã hoàn thành tốt cả 2 lượt tương tác. Hãy xem lại phản hồi chi tiết của AI ở trên.</p>
            <button onClick={() => {
              setEvaluations([])
              loadNextCard()
            }} className="font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-6 py-3 rounded-xl transition-colors flex items-center gap-2 mx-auto">
              <RefreshCcw size={18} /> Thi lại phần này
            </button>
          </div>
        )}

        {/* Hidden Audio Player */}
        <audio ref={audioRef} className="hidden" />
      </div>
    </div>
  )
}
