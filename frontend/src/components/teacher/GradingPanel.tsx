'use client'

import { useState, useEffect } from 'react'
import { X, Sparkles, Save, Loader2, FileText, ExternalLink, CheckCircle2, AlertCircle } from 'lucide-react'
import { format } from 'date-fns'
import api from '@/lib/api'
import { useTracking } from '@/hooks/useTracking'
import { B2B_EVENT } from '@/lib/analytics/b2bEvents'
import type { GradingQueueItem } from './GradingQueueCard'

interface GradingPanelProps {
  item: GradingQueueItem | null
  onClose: () => void
  onSaved: (updatedItem: GradingQueueItem) => void
}

export function GradingPanel({ item, onClose, onSaved }: GradingPanelProps) {
  const [score, setScore] = useState<number | ''>('')
  const [feedback, setFeedback] = useState('')
  const [saving, setSaving] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiSuggested, setAiSuggested] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const { trackEvent } = useTracking()

  // Reset state when item changes
  useEffect(() => {
    if (item) {
      setScore(item.score ?? '')
      setFeedback(item.feedback ?? '')
      setAiSuggested(false)
      setError('')
      setSuccess('')
    }
  }, [item])

  if (!item) return null

  const handleAiGrade = async () => {
    setAiLoading(true)
    setError('')
    try {
      // Trigger AI grading (async on backend)
      await api.post(`/v2/teacher/assignments/${item.id}/ai-grade`)
      // Poll for result after 5 seconds
      setTimeout(async () => {
        try {
          // Re-fetch this specific submission via grading queue
          const queueRes = await api.get(`/v2/teacher/grading/queue`)
          const updated = (queueRes.data as GradingQueueItem[]).find(q => q.id === item.id)
          if (updated && updated.score !== null) {
            setScore(updated.score)
            setFeedback(updated.feedback ?? '')
            setAiSuggested(true)
            trackEvent(B2B_EVENT.ASSIGNMENT_AI_GRADED, {
              assignment_id: item.id,
              class_id: item.classId,
              assignment_type: item.assignmentType,
              ai_score: updated.score,
            })
          } else {
            // Try fetching student assignments directly
            setError('AI đang xử lý, vui lòng đóng và mở lại sau vài giây')
          }
        } catch {
          setError('Không thể lấy kết quả AI')
        } finally {
          setAiLoading(false)
        }
      }, 5000)
    } catch {
      setError('Lỗi khi gọi AI chấm bài')
      setAiLoading(false)
    }
  }

  const handleSave = async () => {
    if (score === '') {
      setError('Vui lòng nhập điểm số')
      return
    }
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await api.post(`/v2/teacher/assignments/${item.id}/evaluate`, {
        teacherScore: Number(score),
        teacherFeedback: feedback,
      })
      setSuccess('Đã lưu điểm thành công!')
      trackEvent(B2B_EVENT.ASSIGNMENT_TEACHER_FINALIZED, {
        assignment_id: item.id,
        class_id: item.classId,
        assignment_type: item.assignmentType,
        score: Number(score),
        ai_assisted: aiSuggested,
      })
      onSaved({ ...item, score: Number(score), feedback, status: 'EVALUATED' })
      setTimeout(() => {
        onClose()
      }, 1200)
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Lỗi khi lưu điểm')
    } finally {
      setSaving(false)
    }
  }

  const canAiGrade = item.assignmentType !== 'SPEAKING_SCENARIO' && !!item.submissionContent

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 w-full max-w-xl bg-white shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <div>
            <h2 className="font-bold text-slate-800 text-lg">Chấm bài</h2>
            <p className="text-sm text-slate-500">{item.studentName} · {item.className}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Assignment info */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
            <h3 className="font-bold text-slate-800 mb-1">{item.topic}</h3>
            {item.description && (
              <p className="text-sm text-slate-600 mb-2">{item.description}</p>
            )}
            <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
              {item.submittedAt && (
                <span>Nộp lúc: {format(new Date(item.submittedAt), 'dd/MM/yyyy HH:mm')}</span>
              )}
              {item.dueDate && (
                <span>Hạn: {format(new Date(item.dueDate), 'dd/MM/yyyy HH:mm')}</span>
              )}
            </div>
          </div>

          {/* Submission content */}
          <div>
            <h4 className="font-bold text-slate-700 text-sm mb-2">Bài làm của học viên</h4>
            {item.submissionContent ? (
              <div className="bg-white border border-slate-200 rounded-xl p-4 text-sm text-slate-700 whitespace-pre-wrap max-h-48 overflow-y-auto">
                {item.submissionContent}
              </div>
            ) : (
              <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-4 text-sm text-slate-400 text-center">
                Không có nội dung văn bản
              </div>
            )}

            {item.submissionFileUrl && (
              <a
                href={item.submissionFileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-2 text-sm text-indigo-600 font-semibold hover:text-indigo-700 hover:underline"
              >
                <FileText size={15} />
                Xem file đính kèm
                <ExternalLink size={13} />
              </a>
            )}

            {item.attachmentUrl && (
              <a
                href={item.attachmentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 ml-4 inline-flex items-center gap-2 text-sm text-slate-500 font-medium hover:text-slate-700 hover:underline"
              >
                <FileText size={15} />
                Tài liệu đề bài
                <ExternalLink size={13} />
              </a>
            )}
          </div>

          {/* AI Grade button */}
          {canAiGrade && (
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-2xl p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-bold text-purple-900 text-sm">Chấm bằng AI</p>
                  <p className="text-xs text-purple-600 mt-0.5">AI sẽ đọc bài làm và đề xuất điểm + nhận xét</p>
                </div>
                <button
                  onClick={handleAiGrade}
                  disabled={aiLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-60 shrink-0"
                >
                  {aiLoading ? (
                    <><Loader2 size={15} className="animate-spin" /> Đang chấm...</>
                  ) : (
                    <><Sparkles size={15} /> Chấm AI</>
                  )}
                </button>
              </div>
              {aiSuggested && (
                <p className="mt-2 text-xs text-purple-700 font-medium flex items-center gap-1">
                  <CheckCircle2 size={13} /> AI đã đề xuất điểm — bạn có thể chỉnh sửa trước khi lưu
                </p>
              )}
            </div>
          )}

          {/* Score input */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              Điểm số (0–100)
              {aiSuggested && (
                <span className="ml-2 text-xs text-purple-600 font-medium bg-purple-50 px-2 py-0.5 rounded-full">
                  Đề xuất từ AI
                </span>
              )}
            </label>
            <input
              type="number"
              min={0}
              max={100}
              value={score}
              onChange={e => setScore(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="Nhập điểm 0–100"
              className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none text-lg font-mono font-bold"
            />
          </div>

          {/* Feedback input */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              Nhận xét
              {aiSuggested && (
                <span className="ml-2 text-xs text-purple-600 font-medium bg-purple-50 px-2 py-0.5 rounded-full">
                  Đề xuất từ AI
                </span>
              )}
            </label>
            <textarea
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              placeholder="Nhận xét về ngữ pháp, từ vựng, cấu trúc câu..."
              rows={5}
              className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none resize-none text-sm"
            />
          </div>

          {/* Error / Success */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700 font-medium">
              <AlertCircle size={16} />
              {error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700 font-medium">
              <CheckCircle2 size={16} />
              {success}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 shrink-0 flex items-center justify-between gap-3 bg-slate-50">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-100 transition-colors"
          >
            Đóng
          </button>
          <button
            onClick={handleSave}
            disabled={saving || score === ''}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition-colors disabled:opacity-50 shadow-md"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Lưu điểm
          </button>
        </div>
      </div>
    </>
  )
}
