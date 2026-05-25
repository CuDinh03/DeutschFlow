'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Upload, FileText, Presentation, Loader2, CheckCircle2,
  AlertCircle, Download, Sparkles, X, Info
} from 'lucide-react'
import { TeacherShell } from '@/components/layouts/TeacherShell'
import { usePendingGradingCount } from '@/hooks/usePendingGradingCount'
import api from '@/lib/api'
import { getAccessToken, logout } from '@/lib/authSession'

type JobStatus = 'idle' | 'uploading' | 'processing' | 'done' | 'error'

export default function TeacherMaterialsPage() {
  const router = useRouter()
  const [userName, setUserName] = useState('Giáo viên')
  const { count: pendingGradingCount } = usePendingGradingCount()
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState<JobStatus>('idle')
  const [progress, setProgress] = useState('')
  const [progressPct, setProgressPct] = useState(0)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [downloadName, setDownloadName] = useState('BaiGiang.pptx')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const esRef = useRef<EventSource | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    api.get('/auth/me').then((res) => {
      if (res.data.role !== 'TEACHER') {
        router.push(`/${String(res.data.role).toLowerCase()}`)
        return
      }
      if (res.data.name) setUserName(res.data.name)
      else if (res.data.email) setUserName(res.data.email.split('@')[0])
    }).catch(() => router.push('/login'))

    return () => { esRef.current?.close() }
  }, [router])

  const reset = () => {
    esRef.current?.close()
    setFile(null)
    setStatus('idle')
    setProgress('')
    setProgressPct(0)
    setDownloadUrl(null)
    setErrorMsg(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) { setFile(f); setErrorMsg(null) }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const f = e.dataTransfer.files?.[0]
    if (f && (f.name.endsWith('.pdf') || f.name.endsWith('.docx'))) {
      setFile(f)
      setErrorMsg(null)
    } else if (f) {
      setErrorMsg('Chỉ hỗ trợ định dạng PDF và DOCX.')
    }
  }

  const handleUpload = async () => {
    if (!file) return
    setStatus('uploading')
    setProgress('Đang tải tài liệu lên server...')
    setProgressPct(15)
    setErrorMsg(null)
    setDownloadUrl(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const token = getAccessToken() ?? ''
      // Use NEXT_PUBLIC_BACKEND_URL (e.g. https://api.mydeutschflow.com)
      // consistent with src/lib/api.ts — fallback to localhost for dev
      const apiBase = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080'
      const res = await fetch(`${apiBase}/api/v2/teacher/materials/generate-pptx`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? 'Lỗi tải lên tài liệu')
      }

      const data = await res.json()
      const jobId: string = data.jobId

      setStatus('processing')
      setProgress('AI đang đọc và phân tích nội dung tài liệu...')
      setProgressPct(35)

      // Helper: xử lý khi job hoàn thành (dùng chung cho SSE và polling)
      const handleCompleted = async (payloadStr: string) => {
        try {
          const payload = JSON.parse(payloadStr)
          const fname = payload.fileName
            ? `BaiGiang_${payload.fileName}`
            : `BaiGiang_${file.name.replace(/\.[^.]+$/, '')}.pptx`
          setDownloadName(fname)

          if (payload.ready) {
            // Fetch file từ one-time download endpoint
            const dlRes = await fetch(
              `${apiBase}/api/v2/teacher/materials/jobs/${jobId}/download`,
              { headers: { Authorization: `Bearer ${token}` } }
            )
            if (!dlRes.ok) throw new Error('Không thể tải file PPTX')
            const blob = await dlRes.blob()
            const url = URL.createObjectURL(blob)
            setDownloadUrl(url)
          } else if (payload.fileData) {
            // Fallback: base64 inline (legacy)
            const blob = b64toBlob(
              payload.fileData,
              'application/vnd.openxmlformats-officedocument.presentationml.presentation'
            )
            setDownloadUrl(URL.createObjectURL(blob))
          } else if (payload.downloadUrl) {
            setDownloadUrl(payload.downloadUrl)
          }
        } catch { /* ignore parse error, still show done */ }
        setProgressPct(100)
        setStatus('done')
        setProgress('Hoàn tất! Bài giảng đã sẵn sàng.')
      }

      // Polling fallback: nếu job đã xong trước khi SSE kết nối (race condition)
      // hoặc SSE bị lỗi, ta poll GET /jobs/{jobId} mỗi 3 giây tối đa 3 phút
      let pollTimer: ReturnType<typeof setInterval> | null = null
      let sseConnected = false

      const startPolling = () => {
        if (pollTimer) return
        pollTimer = setInterval(async () => {
          try {
            const r = await fetch(`${apiBase}/api/v2/teacher/materials/jobs/${jobId}`, {
              headers: { Authorization: `Bearer ${token}` },
            })
            if (!r.ok) return
            const j = await r.json()
            if (j.status === 'COMPLETED') {
              clearInterval(pollTimer!)
              pollTimer = null
              esRef.current?.close()
              void handleCompleted(j.resultPayload ?? '{}')
            } else if (j.status === 'FAILED') {
              clearInterval(pollTimer!)
              pollTimer = null
              esRef.current?.close()
              setStatus('error')
              setErrorMsg(j.errorMessage ?? 'Xử lý thất bại. Vui lòng thử lại.')
            }
          } catch { /* ignore network errors during polling */ }
        }, 3000)
        // Dừng polling sau 3 phút
        setTimeout(() => {
          if (pollTimer) {
            clearInterval(pollTimer)
            pollTimer = null
          }
        }, 180_000)
      }

      // SSE stream for real-time updates
      const sseUrl = `${apiBase}/api/v2/teacher/materials/jobs/${jobId}/sse`
      const es = new EventSource(sseUrl + `?access_token=${encodeURIComponent(token)}`)
      esRef.current = es

      // Simulate progress steps
      const steps = [
        { pct: 50, msg: 'Đang trích xuất cấu trúc bài học...' },
        { pct: 65, msg: 'AI đang thiết kế nội dung từng slide...' },
        { pct: 80, msg: 'Đang định dạng và bố cục slide PowerPoint...' },
        { pct: 92, msg: 'Hoàn thiện file PPTX...' },
      ]
      let stepIdx = 0
      const stepTimer = setInterval(() => {
        if (stepIdx < steps.length) {
          setProgress(steps[stepIdx].msg)
          setProgressPct(steps[stepIdx].pct)
          stepIdx++
        } else {
          clearInterval(stepTimer)
        }
      }, 8000)

      es.addEventListener('connected', () => {
        sseConnected = true
        // SSE kết nối thành công, không cần polling nữa
        if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
      })

      es.addEventListener('COMPLETED', (e: any) => {
        clearInterval(stepTimer)
        if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
        es.close()
        void handleCompleted(e.data ?? '{}')
      })

      es.addEventListener('FAILED', (e: any) => {
        clearInterval(stepTimer)
        if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
        es.close()
        setStatus('error')
        setErrorMsg(e.data ?? 'Xử lý thất bại. Vui lòng thử lại.')
      })

      es.onerror = () => {
        clearInterval(stepTimer)
        es.close()
        // Nếu SSE chưa kết nối được (race condition hoặc lỗi mạng), chuyển sang polling
        if (!sseConnected) {
          startPolling()
        } else {
          setStatus('error')
          setErrorMsg('Mất kết nối với server. Vui lòng thử lại.')
        }
      }

      // Khởi động polling ngay sau 1 giây để bắt race condition
      // (job xong trước khi SSE kịp đăng ký)
      // NOTE: không dùng `status` state ở đây vì là stale closure — dùng flag sseConnected
      setTimeout(() => {
        if (!sseConnected) {
          startPolling()
        }
      }, 1000)

    } catch (err: any) {
      setStatus('error')
      setErrorMsg(err.message ?? 'Đã xảy ra lỗi không mong muốn.')
    }
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`
  }

  return (
    <TeacherShell
      activeMenu="materials"
      userName={userName}
      pendingGradingCount={pendingGradingCount}
      onLogout={() => void logout()}
      headerTitle="Tạo Tài liệu AI"
      headerSubtitle="Upload PDF/DOCX để AI tự động sinh slide bài giảng PowerPoint"
    >
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">

        {/* Hero Section */}
        <div className="relative bg-gradient-to-br from-indigo-600 via-purple-600 to-violet-700 rounded-3xl p-8 mb-8 overflow-hidden shadow-2xl">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-4 right-8 w-40 h-40 rounded-full bg-white blur-3xl" />
            <div className="absolute bottom-4 left-20 w-24 h-24 rounded-full bg-indigo-300 blur-2xl" />
          </div>
          <div className="relative z-10 flex items-start gap-6">
            <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0 shadow-lg">
              <Sparkles size={28} className="text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-black text-white mb-2">Tạo bài giảng PowerPoint bằng AI</h1>
              <p className="text-indigo-100 leading-relaxed max-w-xl">
                Upload tài liệu PDF hoặc DOCX — AI sẽ tự động phân tích nội dung, tổ chức thành cấu trúc bài học rõ ràng và tạo ra bộ slide chuyên nghiệp.
              </p>
              <div className="flex items-center gap-4 mt-4">
                {[
                  { label: 'Hỗ trợ PDF & DOCX', emoji: '📄' },
                  { label: 'Tạo trong ~60 giây', emoji: '⚡' },
                  { label: 'Slide chuẩn PowerPoint', emoji: '🎯' },
                ].map(({ label, emoji }) => (
                  <div key={label} className="flex items-center gap-1.5 text-white/80 text-xs font-medium">
                    <span>{emoji}</span>
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Upload Card */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100">
                <h2 className="font-bold text-slate-800 flex items-center gap-2">
                  <Upload size={18} className="text-indigo-600" />
                  Upload tài liệu
                </h2>
              </div>

              <div className="p-6">
                <AnimatePresence mode="wait">
                  {status === 'idle' && (
                    <motion.div key="upload" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                      {/* Drop Zone */}
                      <label
                        htmlFor="material-file-global"
                        onDrop={handleDrop}
                        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                        onDragLeave={() => setIsDragging(false)}
                        className={`flex flex-col items-center justify-center gap-4 border-2 border-dashed rounded-2xl p-10 cursor-pointer transition-all ${
                          isDragging
                            ? 'border-indigo-400 bg-indigo-50/80 scale-[1.01]'
                            : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors ${isDragging ? 'bg-indigo-100' : 'bg-slate-100'}`}>
                          <Upload size={28} className={isDragging ? 'text-indigo-600' : 'text-slate-400'} />
                        </div>
                        <div className="text-center">
                          <p className="font-bold text-slate-800 mb-1">Kéo thả file vào đây</p>
                          <p className="text-sm text-slate-500">hoặc <span className="text-indigo-600 font-semibold">bấm để chọn file</span></p>
                          <p className="text-xs text-slate-400 mt-2">Hỗ trợ PDF và DOCX · Tối đa 20MB</p>
                        </div>
                        <input
                          ref={fileRef}
                          id="material-file-global"
                          type="file"
                          accept=".pdf,.docx"
                          className="sr-only"
                          onChange={handleFileChange}
                        />
                      </label>

                      {/* Selected file preview */}
                      {file && (
                        <motion.div
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mt-4 flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl"
                        >
                          <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                            <FileText size={18} className="text-emerald-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-slate-800 truncate text-sm">{file.name}</p>
                            <p className="text-xs text-slate-500">{formatSize(file.size)}</p>
                          </div>
                          <button
                            onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = '' }}
                            className="p-1.5 rounded-lg hover:bg-emerald-100 transition-colors"
                          >
                            <X size={16} className="text-slate-400" />
                          </button>
                        </motion.div>
                      )}

                      {errorMsg && (
                        <div className="mt-4 flex items-start gap-2 p-4 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700">
                          <AlertCircle size={16} className="mt-0.5 shrink-0" />
                          <span>{errorMsg}</span>
                        </div>
                      )}

                      <button
                        onClick={handleUpload}
                        disabled={!file}
                        className="mt-5 w-full py-3.5 rounded-xl font-bold text-white text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg hover:shadow-xl hover:scale-[1.01] active:scale-[0.99]"
                        style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}
                      >
                        <Sparkles size={16} className="inline mr-2" />
                        Tạo bài giảng PowerPoint
                      </button>
                    </motion.div>
                  )}

                  {(status === 'uploading' || status === 'processing') && (
                    <motion.div
                      key="processing"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="py-10 flex flex-col items-center gap-6"
                    >
                      <div className="relative">
                        <div className="w-24 h-24 rounded-full border-4 border-indigo-100 flex items-center justify-center">
                          <Loader2 size={36} className="text-indigo-600 animate-spin" />
                        </div>
                        <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center">
                          <Sparkles size={12} className="text-white" />
                        </div>
                      </div>
                      <div className="text-center">
                        <p className="font-bold text-slate-800 text-lg mb-1">{progress}</p>
                        <p className="text-sm text-slate-500">Quá trình này có thể mất 30–90 giây</p>
                      </div>
                      <div className="w-full space-y-2">
                        <div className="flex justify-between text-xs text-slate-500 font-medium">
                          <span>Đang xử lý...</span>
                          <span>{progressPct}%</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                          <motion.div
                            className="h-full rounded-full"
                            style={{ background: 'linear-gradient(90deg, #6366F1, #8B5CF6, #A855F7)' }}
                            animate={{ width: `${progressPct}%` }}
                            transition={{ duration: 1.5, ease: 'easeOut' }}
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {status === 'done' && (
                    <motion.div
                      key="done"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="py-10 flex flex-col items-center gap-6"
                    >
                      <div className="w-24 h-24 rounded-full bg-emerald-50 flex items-center justify-center">
                        <CheckCircle2 size={44} className="text-emerald-500" />
                      </div>
                      <div className="text-center">
                        <p className="font-black text-2xl text-slate-800 mb-1">Bài giảng đã sẵn sàng! 🎉</p>
                        <p className="text-slate-500 text-sm">File PowerPoint đã được tạo từ tài liệu của bạn</p>
                      </div>
                      {downloadUrl ? (
                        <a
                          href={downloadUrl}
                          download={downloadName}
                          className="flex items-center gap-2 px-8 py-3.5 rounded-xl font-bold text-white shadow-lg hover:shadow-xl hover:scale-[1.01] transition-all"
                          style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}
                        >
                          <Download size={18} />
                          Tải xuống {downloadName}
                        </a>
                      ) : (
                        <p className="text-sm text-slate-500">File đang được chuẩn bị...</p>
                      )}
                      <button onClick={reset} className="text-sm text-indigo-600 hover:underline font-medium">
                        Tạo bài giảng khác
                      </button>
                    </motion.div>
                  )}

                  {status === 'error' && (
                    <motion.div
                      key="error"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="py-10 flex flex-col items-center gap-5"
                    >
                      <div className="w-24 h-24 rounded-full bg-rose-50 flex items-center justify-center">
                        <AlertCircle size={44} className="text-rose-500" />
                      </div>
                      <div className="text-center">
                        <p className="font-bold text-slate-800 text-lg mb-1">Đã xảy ra lỗi</p>
                        <p className="text-sm text-slate-500 max-w-sm">{errorMsg}</p>
                      </div>
                      <button
                        onClick={reset}
                        className="px-6 py-2.5 rounded-xl border border-slate-200 font-semibold text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        Thử lại
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Info Panel */}
          <div className="space-y-4">
            {/* How it works */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2 text-sm">
                <Info size={16} className="text-indigo-600" />
                Cách thức hoạt động
              </h3>
              <div className="space-y-4">
                {[
                  { step: '01', title: 'Upload tài liệu', desc: 'Upload file PDF hoặc DOCX của bạn', color: 'bg-indigo-500' },
                  { step: '02', title: 'AI phân tích', desc: 'AI đọc, hiểu và tổ chức nội dung', color: 'bg-purple-500' },
                  { step: '03', title: 'Sinh slide', desc: 'Tạo bộ slide PowerPoint chuyên nghiệp', color: 'bg-violet-500' },
                  { step: '04', title: 'Tải xuống', desc: 'Tải file PPTX về và dùng ngay', color: 'bg-emerald-500' },
                ].map(({ step, title, desc, color }) => (
                  <div key={step} className="flex items-start gap-3">
                    <div className={`w-7 h-7 rounded-lg ${color} flex items-center justify-center text-white text-[10px] font-black shrink-0`}>
                      {step}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800 text-xs">{title}</p>
                      <p className="text-slate-500 text-xs leading-relaxed">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Supported Formats */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <h3 className="font-bold text-slate-800 mb-3 text-sm">Định dạng hỗ trợ</h3>
              <div className="space-y-2">
                {[
                  { icon: '📄', label: 'PDF', desc: 'Giáo trình, đề cương' },
                  { icon: '📝', label: 'DOCX', desc: 'Word document' },
                  { icon: '📊', label: 'Output: PPTX', desc: 'Mở bằng PowerPoint / Google Slides' },
                ].map(({ icon, label, desc }) => (
                  <div key={label} className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-50">
                    <span className="text-lg">{icon}</span>
                    <div>
                      <p className="text-xs font-bold text-slate-700">{label}</p>
                      <p className="text-[10px] text-slate-400">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tips */}
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-5">
              <h3 className="font-bold text-amber-800 mb-2 text-sm flex items-center gap-1.5">
                💡 Mẹo sử dụng
              </h3>
              <ul className="space-y-1.5">
                {[
                  'Tài liệu có cấu trúc rõ ràng cho kết quả tốt hơn',
                  'Nên dùng file dưới 10MB để xử lý nhanh hơn',
                  'Có thể tạo nhiều bài giảng từ các tài liệu khác nhau',
                ].map((tip) => (
                  <li key={tip} className="text-xs text-amber-700 flex items-start gap-1.5">
                    <span className="text-amber-500 mt-0.5">•</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </TeacherShell>
  )
}

function b64toBlob(b64Data: string, contentType = '', sliceSize = 512): Blob {
  const byteCharacters = atob(b64Data)
  const byteArrays: Uint8Array[] = []
  for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
    const slice = byteCharacters.slice(offset, offset + sliceSize)
    const byteNumbers = new Array(slice.length)
    for (let i = 0; i < slice.length; i++) byteNumbers[i] = slice.charCodeAt(i)
    byteArrays.push(new Uint8Array(byteNumbers))
  }
  return new Blob(byteArrays as any, { type: contentType })
}
