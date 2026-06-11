'use client'

import { useCallback, useEffect, useState } from 'react'
import { Building2, Loader2, Save, CheckCircle, AlertCircle } from 'lucide-react'
import { getTeacherCenter, setTeacherCenter } from '@/lib/teacherCenterApi'
import { apiMessage } from '@/lib/api'

/**
 * Lets a teacher record the center they teach at (D11). Self-contained: loads + saves its own
 * state. For non-org (free) teachers this becomes the org-sales cluster signal in the admin
 * growth dashboard. Backend trims/clears and caps the value.
 */
export function TeacherCenterCard() {
  const [center, setCenter] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await getTeacherCenter()
      setCenter(res.centerName ?? '')
    } catch {
      // Non-fatal: leave the field empty so the teacher can still set it.
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function save() {
    setSaving(true)
    setMessage(null)
    try {
      const res = await setTeacherCenter(center.trim() || null)
      setCenter(res.centerName ?? '')
      setMessage({ type: 'ok', text: 'Đã lưu trung tâm.' })
      setTimeout(() => setMessage(null), 3000)
    } catch (e: unknown) {
      setMessage({ type: 'err', text: apiMessage(e) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      <div className="flex items-center gap-2 mb-2">
        <Building2 size={18} className="text-emerald-600" />
        <h2 className="font-bold text-slate-800">Trung tâm bạn đang dạy</h2>
      </div>
      <p className="text-sm text-slate-500 mb-4">
        Giúp DeutschFlow kết nối bạn với đồng nghiệp cùng trung tâm và mở gói tổ chức phù hợp.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          value={center}
          onChange={(e) => setCenter(e.target.value)}
          placeholder="VD: Trung tâm tiếng Đức ABC, Hà Nội"
          maxLength={255}
          disabled={!loaded}
          className="flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none text-sm disabled:opacity-60"
        />
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || !loaded}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Lưu
        </button>
      </div>
      {message && (
        <p className={`mt-3 flex items-center gap-1.5 text-sm font-medium ${message.type === 'ok' ? 'text-emerald-600' : 'text-rose-600'}`}>
          {message.type === 'ok' ? <CheckCircle size={15} /> : <AlertCircle size={15} />} {message.text}
        </p>
      )}
    </div>
  )
}
