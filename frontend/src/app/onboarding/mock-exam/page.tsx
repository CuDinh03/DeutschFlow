'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'

export default function MockExamPage() {
  const router = useRouter()
  const [timeLeft, setTimeLeft] = useState(180) // 3 minutes
  const [isRecording, setIsRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  
  // Fake timer for demo
  useEffect(() => {
    if (timeLeft <= 0) {
      finishExam()
      return
    }
    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [timeLeft])

  const finishExam = async () => {
    setIsAnalyzing(true)
    try {
      // In a real app, this would send the actual transcript
      const fakeTranscript = "Hallo, ich bin ein Student. Ich lerne Deutsch seit ein Jahr. Ich habe viele Problem mit die Grammatik, besonders der Akkusativ."
      
      const res = await api.post('/onboarding/mock-exam/evaluate', {
        transcript_de: transcript || fakeTranscript
      })
      
      // Save report to localStorage to pass to next page
      localStorage.setItem('mockExamReport', JSON.stringify(res.data))
      router.push('/onboarding/error-report')
    } catch (e) {
      console.error(e)
      setIsAnalyzing(false)
      alert("Ein Fehler ist aufgetreten.")
    }
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s < 10 ? '0' : ''}${s}`
  }

  if (isAnalyzing) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-6"></div>
        <h2 className="text-2xl font-bold text-gray-800">Kiểm tra lỗi ngữ pháp...</h2>
        <p className="text-gray-500 mt-2">AI đang phân tích độ trôi chảy và lỗi sai của bạn.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-gray-900">Bài Test Trình Độ Nói</h1>
          <p className="text-gray-500 mt-2">Nói tiếng Đức trong 3 phút để AI đánh giá trình độ và chỉ ra điểm yếu của bạn.</p>
        </div>

        <Card className="shadow-xl border-0 overflow-hidden relative">
          <div className="absolute top-0 left-0 w-full h-2 bg-gray-200">
            <div 
              className="h-full bg-primary transition-all duration-1000" 
              style={{ width: `${(180 - timeLeft) / 180 * 100}%` }}
            ></div>
          </div>
          
          <CardContent className="p-8 flex flex-col items-center">
            <div className="w-32 h-32 bg-gray-100 rounded-full mb-6 overflow-hidden border-4 border-white shadow-lg">
              {/* Avatar placeholder */}
              <img src="/avatars/goethe.png" alt="Goethe Prüfer" className="w-full h-full object-cover" 
                   onError={(e) => { e.currentTarget.src = 'https://ui-avatars.com/api/?name=Examiner&background=random' }} />
            </div>
            
            <div className="text-4xl font-mono font-bold text-gray-800 mb-8">
              {formatTime(timeLeft)}
            </div>

            <button 
              onClick={() => setIsRecording(!isRecording)}
              className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
                isRecording 
                  ? 'bg-red-100 text-red-500 shadow-[0_0_0_8px_rgba(239,68,68,0.2)] animate-pulse' 
                  : 'bg-primary text-white shadow-lg hover:scale-105'
              }`}
            >
              {isRecording ? (
                <div className="w-6 h-6 bg-red-500 rounded-sm"></div>
              ) : (
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              )}
            </button>
            <p className="mt-4 text-sm font-medium text-gray-500">
              {isRecording ? 'Đang ghi âm... Hãy tự giới thiệu về bản thân' : 'Bấm để bắt đầu nói'}
            </p>

            <button 
              onClick={finishExam}
              className="mt-8 text-primary hover:underline text-sm font-medium"
            >
              Nộp bài sớm
            </button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
