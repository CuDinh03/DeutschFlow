'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { apiMessage } from '@/lib/api'
import { joinClassByInviteCode } from '@/lib/studentClassesApi'

interface Props {
  open: boolean
  onClose: () => void
  onJoined: () => void
}

export function JoinClassDialog({ open, onClose, onJoined }: Props) {
  const [code, setCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  if (!open) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = code.trim()
    if (!trimmed) {
      setError('Vui lòng nhập mã mời')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await joinClassByInviteCode(trimmed)
      setSuccess(true)
      setCode('')
      onJoined()
      setTimeout(() => {
        setSuccess(false)
        onClose()
      }, 1600)
    } catch (e) {
      setError(apiMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4"
         role="dialog" aria-modal="true" aria-labelledby="join-class-title">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 id="join-class-title" className="text-xl font-bold text-slate-800">Tham gia lớp</h2>
            <p className="text-sm text-slate-500 mt-1">
              Nhập mã mời mà giáo viên đã gửi cho bạn. Yêu cầu sẽ được giáo viên duyệt trước khi bạn vào lớp.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 -mt-1 -mr-1 p-1"
            aria-label="Đóng"
          >
            <X size={20} />
          </button>
        </div>

        {success ? (
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 text-sm">
            Đã gửi yêu cầu! Vui lòng chờ giáo viên duyệt.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="invite-code" className="block text-sm font-semibold text-slate-700 mb-1">
                Mã mời
              </label>
              <input
                id="invite-code"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                disabled={submitting}
                placeholder="VD: ABC123"
                className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-slate-800 font-mono tracking-wider uppercase focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50"
                autoFocus
                maxLength={32}
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Huỷ
              </button>
              <button
                type="submit"
                disabled={submitting || !code.trim()}
                className="flex-1 rounded-xl bg-indigo-600 text-white px-4 py-2.5 text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
              >
                {submitting ? 'Đang gửi…' : 'Gửi yêu cầu'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
