'use client'

import { useCallback, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ImageUp, Loader2, ScanText, Sparkles, X } from 'lucide-react'
import { TeacherShell } from '@/components/layouts/TeacherShell'
import { logout } from '@/lib/authSession'
import { httpStatus } from '@/lib/api'
import { useUserStore } from '@/stores/useUserStore'
import { gradeHandwritingImage, type GradeImageResult } from '@/lib/teacherGradingApi'

const MAX_BYTES = 10 * 1024 * 1024

function errorMessage(e: unknown, fallback: string): string {
  const data = (e as { response?: { data?: { detail?: string; message?: string } } })?.response?.data
  return data?.detail || data?.message || fallback
}

export default function TeacherGradeImageClientPage() {
  const user = useUserStore((s) => s.user)
  const userName = user?.displayName || user?.email?.split('@')[0] || 'Giáo viên'
  const fileRef = useRef<HTMLInputElement>(null)

  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [topic, setTopic] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<GradeImageResult | null>(null)

  const pickFile = useCallback((f: File | null) => {
    setError(null)
    setResult(null)
    if (!f) return
    if (!f.type.startsWith('image/')) {
      setError('Vui lòng chọn tệp ảnh (JPEG/PNG).')
      return
    }
    if (f.size > MAX_BYTES) {
      setError('Ảnh quá lớn. Tối đa 10MB.')
      return
    }
    setFile(f)
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return URL.createObjectURL(f)
    })
  }, [])

  const clearFile = useCallback(() => {
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
    setFile(null)
    setResult(null)
    setError(null)
    if (fileRef.current) fileRef.current.value = ''
  }, [])

  async function onSubmit() {
    if (!file || submitting) return
    setSubmitting(true)
    setError(null)
    setResult(null)
    try {
      setResult(await gradeHandwritingImage(file, topic))
    } catch (e) {
      const status = httpStatus(e)
      if (status === 429) setError(errorMessage(e, 'Tổ chức đã dùng hết ngân sách token AI tháng này.'))
      else if (status === 503) setError(errorMessage(e, 'AI đang bận. Vui lòng thử lại sau ít phút.'))
      else if (status === 400) setError(errorMessage(e, 'Không tìm thấy chữ tiếng Đức trong ảnh. Chụp rõ hơn rồi thử lại.'))
      else setError('Có lỗi xảy ra. Vui lòng thử lại.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <TeacherShell
      activeMenu="grading"
      userName={userName}
      onLogout={() => void logout()}
      headerTitle="Chấm ảnh bài viết tay"
      headerSubtitle="Chụp bài viết tay của học viên — AI đọc chữ và chấm điểm"
    >
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
        <Link href="/teacher/grading" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-700">
          <ArrowLeft size={16} /> Về Trung tâm Chấm bài
        </Link>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <label className="mb-1.5 block text-sm font-bold text-slate-700">
            Chủ đề bài viết <span className="font-normal text-slate-400">(tùy chọn)</span>
          </label>
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="VD: Eine E-Mail an einen Freund schreiben"
            className="mb-5 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          />

          {!previewUrl ? (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 py-12 text-slate-500 transition hover:border-indigo-400 hover:bg-indigo-50/40"
            >
              <ImageUp size={36} className="text-indigo-500" />
              <span className="text-sm font-semibold">Chọn ảnh bài viết tay</span>
              <span className="text-xs text-slate-400">JPEG / PNG · tối đa 10MB</span>
            </button>
          ) : (
            <div className="relative overflow-hidden rounded-2xl border border-slate-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt="Xem trước bài viết" className="max-h-80 w-full object-contain bg-slate-50" />
              <button
                type="button"
                onClick={clearFile}
                className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-slate-900/70 text-white hover:bg-slate-900"
                aria-label="Bỏ ảnh"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={onSubmit}
            disabled={!file || submitting}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
          >
            {submitting ? (
              <><Loader2 size={18} className="animate-spin" /> Đang đọc & chấm…</>
            ) : (
              <><Sparkles size={18} /> Đọc chữ & chấm điểm</>
            )}
          </button>
        </div>

        {result && <ResultCard result={result} />}
      </div>
    </TeacherShell>
  )
}

function ResultCard({ result }: { result: GradeImageResult }) {
  const tone =
    result.score >= 80 ? 'from-emerald-500 to-teal-600' :
    result.score >= 60 ? 'from-indigo-500 to-violet-600' :
    'from-amber-500 to-orange-600'
  return (
    <div className="space-y-4">
      <div className={`flex items-center justify-between rounded-2xl bg-gradient-to-br ${tone} p-6 text-white shadow-lg`}>
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-white/80">Điểm AI chấm</p>
          <p className="mt-1 text-5xl font-black leading-none">{result.score}<span className="text-xl font-bold text-white/70">/100</span></p>
        </div>
        <Sparkles size={40} className="text-white/40" />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-2 flex items-center gap-2 text-slate-700">
          <ScanText size={18} className="text-indigo-600" />
          <span className="text-sm font-bold">Chữ đọc được (OCR)</span>
        </div>
        <p className="mb-3 text-xs text-slate-400">OCR chữ viết tay không phải lúc nào cũng đúng 100% — rà lại trước khi chốt điểm.</p>
        <pre className="max-h-60 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-4 font-sans text-sm leading-relaxed text-slate-700">{result.transcription}</pre>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-bold uppercase tracking-wider text-slate-500">Nhận xét</p>
        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700">{result.feedback}</p>
      </div>
    </div>
  )
}
