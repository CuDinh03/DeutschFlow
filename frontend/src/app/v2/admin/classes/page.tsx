'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import api, { apiMessage } from '@/lib/api'
import { GaPageHdr, GaCap, GaBtn, TkSearch, TkStatStrip } from '@/components/ui-v2'

// ─────────────────────────────────────────────────────────────────────────────
// Quản lý lớp học toàn hệ thống (admin) — navy, LIST (W1.7 migrate admin/classes).
// Plumbing reused 1:1: GET /api/admin/classes → AdminClass { id, name, teacherName, studentCount }.
// ─────────────────────────────────────────────────────────────────────────────

interface AdminClass {
  id: number
  name: string
  teacherName: string
  studentCount: number
}

export default function V2AdminClassesPage() {
  const [items, setItems] = useState<AdminClass[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get<AdminClass[]>('/admin/classes')
      setItems(res.data ?? [])
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
    if (!q) return items
    return items.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.teacherName ?? '').toLowerCase().includes(q) || String(c.id).includes(q),
    )
  }, [items, query])

  const totalStudents = items.reduce((sum, c) => sum + (c.studentCount || 0), 0)
  const unassigned = items.filter((c) => !c.teacherName).length
  const GRID = '64px 1.6fr 1fr 110px'

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr accent title="Quản lý lớp học" subtitle="Tất cả lớp trên hệ thống — đồng bộ realtime với database" />

      <div className="flex-1 overflow-auto px-10 py-6">
        <TkStatStrip
          items={[
            { label: 'Tổng lớp', value: items.length, sub: 'toàn hệ thống' },
            { label: 'Tổng học viên', value: totalStudents.toLocaleString(), sub: 'đã ghi danh', color: '#2F6FC9' },
            { label: 'Chưa có GV', value: unassigned, sub: 'cần phân công', color: unassigned ? 'var(--ga-red)' : undefined },
          ]}
        />

        <div className="mb-3.5 mt-[22px] flex items-center justify-between gap-3">
          <GaCap>{rows.length} lớp</GaCap>
          <TkSearch value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm lớp / giáo viên / ID…" containerClassName="w-[260px]" />
        </div>

        {loading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="ga-shimmer h-[54px] border border-ga-line" aria-hidden />)}
          </div>
        ) : error ? (
          <div className="border border-ga-line bg-ga-card px-10 py-[52px] text-center">
            <h2 className="font-ga-display text-[24px] font-medium text-ga-red">Không tải được lớp học</h2>
            <p className="ga-ui mx-auto mb-5 mt-3 max-w-sm text-[14px] text-ga-muted">{error} <code className="font-mono text-[12px] text-ga-accent">GET /api/admin/classes</code></p>
            <GaBtn variant="primary" onClick={load}>Thử lại</GaBtn>
          </div>
        ) : rows.length === 0 ? (
          <div className="border border-dashed border-ga-line px-10 py-[40px] text-center text-[14px] text-ga-muted">
            {items.length === 0 ? 'Hệ thống chưa có lớp nào.' : 'Không tìm thấy lớp.'}
          </div>
        ) : (
          <div className="border border-ga-line bg-ga-card">
            <div className="grid items-center gap-2 border-b border-ga-line bg-ga-bg px-5 py-[11px]" style={{ gridTemplateColumns: GRID }}>
              {['ID', 'Lớp', 'Giáo viên', 'Học viên'].map((h, i) => (
                <span key={h} className={`ga-ui text-[10px] font-bold uppercase tracking-[0.1em] text-ga-muted ${i === 3 ? 'text-right' : ''}`}>{h}</span>
              ))}
            </div>
            {rows.map((c, i) => (
              <div key={c.id} className="grid items-center gap-2 px-5 py-3.5 transition-colors hover:bg-ga-surface" style={{ gridTemplateColumns: GRID, borderTop: i ? '1px solid var(--ga-line)' : 'none' }}>
                <span className="font-mono text-[12px] text-ga-muted">#{c.id}</span>
                <span className="truncate text-[14px] font-semibold text-ga-ink">{c.name}</span>
                <span className="min-w-0 truncate text-[13px] text-ga-muted">
                  {c.teacherName || <span className="px-2 py-0.5 text-[11px] font-bold" style={{ color: 'var(--ga-red)', background: 'var(--ga-red-soft)' }}>Chưa phân công</span>}
                </span>
                <span className="text-right text-[13.5px] font-semibold text-ga-ink">{(c.studentCount || 0).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
