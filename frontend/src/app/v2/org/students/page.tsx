'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Download, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { apiMessage } from '@/lib/api'
import { listMembers, getAnalytics, type OrgMember, type OrgAnalytics } from '@/lib/orgApi'
import { GaPageHdr, GaBtn, GaCap, TkStatStrip, TkSearch } from '@/components/ui-v2'

// ─────────────────────────────────────────────────────────────────────────────
// Học viên của tổ chức (GaOrgStudents) — teal, roster LIST.
// Plumbing reused 1:1 (zero backend): orgApi.listMembers('STUDENT') + getAnalytics.
// Option-1: OrgMember carries name/email/status/joinedAt only — the proto's per-student
// CLASS / LEVEL / PROGRESS bar / lastActive have no backing → dropped (roster columns +
// real org-wide stats from /org/analytics instead). org-student-detail not built → "Hồ sơ" toasts.
// ─────────────────────────────────────────────────────────────────────────────

const TEAL = '#11888A'
const fmtDate = (d: string | null | undefined) => (d ? format(new Date(d), 'dd/MM/yyyy') : '—')
const initial = (n: string | null) => ((n ?? '?').trim()[0] ?? '?').toUpperCase()

export default function V2OrgStudentsPage() {
  const router = useRouter()
  const [members, setMembers] = useState<OrgMember[]>([])
  const [analytics, setAnalytics] = useState<OrgAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [ms, an] = await Promise.all([listMembers('STUDENT'), getAnalytics().catch(() => null)])
      setMembers(ms)
      setAnalytics(an)
      setError('')
    } catch (e: unknown) {
      setError(apiMessage(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return members.filter((m) => (m.displayName ?? '').toLowerCase().includes(q) || m.email.toLowerCase().includes(q))
  }, [members, query])

  const activeN = members.filter((m) => m.status === 'ACTIVE').length

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr
        accent
        title="Học viên của tổ chức"
        subtitle="Danh sách học viên đang dùng ghế của trung tâm"
        right={
          <GaBtn variant="ghost" size="sm" onClick={() => toast('Xuất danh sách học viên (sắp ra mắt)')}>
            <Download size={15} /> Xuất danh sách
          </GaBtn>
        }
      />

      <div className="flex-1 overflow-auto px-10 py-6">
        <TkStatStrip
          items={[
            { label: 'Tổng học viên', value: analytics?.studentCount ?? members.length, sub: 'đang dùng ghế' },
            { label: 'Đang hoạt động', value: activeN, sub: 'thành viên ACTIVE', color: '#1E9E61' },
            { label: 'Hoạt động 7 ngày', value: analytics?.activeStudents7d ?? 0, sub: 'có học gần đây', color: '#2F6FC9' },
            { label: 'Lớp đang học', value: analytics?.classCount ?? 0, sub: 'của trung tâm', color: TEAL },
          ]}
        />

        <div className="mb-3.5 mt-[22px] flex items-center justify-between gap-3">
          <GaCap>{rows.length} học viên</GaCap>
          <TkSearch value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm học viên / email…" containerClassName="w-[240px]" />
        </div>

        {loading ? (
          <div className="flex flex-col gap-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="ga-shimmer h-[54px] border border-ga-line" aria-hidden />)}</div>
        ) : error ? (
          <div className="border border-ga-line bg-ga-card px-10 py-[52px] text-center">
            <h2 className="font-ga-display text-[24px] font-medium text-ga-red">Không tải được học viên</h2>
            <p className="ga-ui mx-auto mb-5 mt-3 max-w-sm text-[14px] text-ga-muted">{error} <code className="font-mono text-[12px] text-ga-accent">GET /api/org/members</code></p>
            <GaBtn variant="primary" onClick={load}>Thử lại</GaBtn>
          </div>
        ) : rows.length === 0 ? (
          <div className="border border-dashed border-ga-line px-10 py-[40px] text-center text-[14px] text-ga-muted">
            {members.length === 0 ? 'Tổ chức chưa có học viên nào.' : 'Không tìm thấy học viên.'}
          </div>
        ) : (
          <div className="border border-ga-line bg-ga-card">
            <div className="grid items-center gap-2 border-b border-ga-line bg-ga-bg px-5 py-[11px]" style={{ gridTemplateColumns: '1fr 130px 120px 84px' }}>
              {['Học viên', 'Trạng thái', 'Tham gia', ''].map((h, i) => (
                <span key={i} className="ga-ui text-[10px] font-bold uppercase tracking-[0.1em] text-ga-muted">{h}</span>
              ))}
            </div>
            {rows.map((m, i) => (
              <div key={m.userId} className="grid items-center gap-2 px-5 py-3.5 transition-colors hover:bg-ga-surface" style={{ gridTemplateColumns: '1fr 130px 120px 84px', borderTop: i ? '1px solid var(--ga-line)' : 'none' }}>
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="grid h-8 w-8 shrink-0 place-items-center font-ga-display text-[13px] font-medium" style={{ color: TEAL, background: 'var(--ga-teal-soft)' }}>{initial(m.displayName)}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-semibold text-ga-ink">{m.displayName || '—'}</span>
                    <span className="block truncate text-[11.5px] text-ga-muted">{m.email}</span>
                  </span>
                </div>
                <span>
                  <span className="px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.04em]" style={m.status === 'ACTIVE' ? { color: 'var(--ga-green)', background: 'var(--ga-green-soft)' } : { color: 'var(--ga-muted)', background: 'var(--ga-side-active)' }}>
                    {m.status === 'ACTIVE' ? 'Hoạt động' : 'Đã rời'}
                  </span>
                </span>
                <span className="flex items-center gap-1 text-[12.5px] text-ga-muted"><Clock size={12} /> {fmtDate(m.joinedAt)}</span>
                <button type="button" onClick={() => router.push(`/v2/org/students/${m.userId}`)} className="ga-ui justify-self-end border border-ga-line px-2.5 py-1.5 text-[11px] font-semibold text-ga-muted transition-colors hover:border-ga-accent hover:text-ga-accent">
                  Hồ sơ
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
