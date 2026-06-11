'use client'

import { useCallback, useEffect, useState } from 'react'
import { Gift, Building2, FileText, ScanLine } from 'lucide-react'
import { getFreeTierStatus, type FreeTierStatus } from '@/lib/teacherFreeTierApi'

/**
 * Shows the teacher their plan (D6²): the official free tier (non-org) with today's expensive-AI
 * allowance, or the org plan. Self-contained — loads its own status. The caps are enforced by the
 * backend FreeTierGuard; this just makes the plan visible.
 */
export function FreeTierStatusCard() {
  const [status, setStatus] = useState<FreeTierStatus | null>(null)

  const load = useCallback(async () => {
    try {
      setStatus(await getFreeTierStatus())
    } catch {
      // Non-fatal — simply don't show the card.
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (!status) return null

  if (!status.freeTier) {
    return (
      <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-6">
        <div className="flex items-center gap-2">
          <Building2 size={18} className="text-indigo-600" />
          <h2 className="font-bold text-slate-800">Gói tổ chức</h2>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Bạn thuộc một tổ chức — hạn mức AI dùng chung token-pool của tổ chức, không giới hạn theo ngày.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-6">
      <div className="mb-1 flex items-center gap-2">
        <Gift size={18} className="text-emerald-600" />
        <h2 className="font-bold text-slate-800">Gói miễn phí</h2>
      </div>
      <p className="mb-4 text-sm text-slate-600">
        Chấm bài viết (text) <span className="font-semibold">không giới hạn</span>. Các tính năng AI nặng có hạn mức/ngày:
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <UsageBar icon={<FileText size={15} />} label="Tạo PPTX" used={status.pptxUsedToday} limit={status.pptxDaily} />
        <UsageBar icon={<ScanLine size={15} />} label="Chấm ảnh (OCR)" used={status.ocrUsedToday} limit={status.ocrDaily} />
      </div>
      <p className="mt-3 text-xs text-slate-400">Hạn mức đặt lại mỗi ngày (giờ UTC). Tham gia tổ chức để dùng nhiều hơn.</p>
    </div>
  )
}

function UsageBar({ icon, label, used, limit }: { icon: React.ReactNode; label: string; used: number; limit: number }) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0
  const atLimit = used >= limit
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">{icon} {label}</span>
        <span className={`text-sm font-bold ${atLimit ? 'text-rose-600' : 'text-slate-800'}`}>{used}/{limit}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${atLimit ? 'bg-rose-500' : 'bg-emerald-500'} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
