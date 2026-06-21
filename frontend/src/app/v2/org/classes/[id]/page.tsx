'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { format } from 'date-fns'
import { apiMessage } from '@/lib/api'
import { getOrgClassDetail, type OrgClassDetail } from '@/lib/orgApi'
import { GaPageHdr, GaBtn, GaCap, TkStatStrip, TkSearch } from '@/components/ui-v2'

// ─────────────────────────────────────────────────────────────────────────────
// Chi tiết lớp của tổ chức (GaOrgClassDetail) — teal, read-only org-admin (W1.4).
// orgApi.getOrgClassDetail → GET /api/org/classes/{id} (B1.1):
//   { id, name, inviteCode, teacherId, teacherName, createdAt, studentCount, students[] }.
//   students[] kèm skill_* (Hören/Lesen/Schreiben/Sprechen — GV chấm trên class_students; null=chưa chấm).
// 404 nếu lớp không thuộc org người gọi (IDOR-safe ở backend OrgService).
// ─────────────────────────────────────────────────────────────────────────────

const TEAL = '#11888A'
const fmtDate = (d: string | null) => (d ? format(new Date(d), 'dd/MM/yyyy') : '—')
const initial = (n: string | null) => (n?.trim()[0] ?? '?').toUpperCase()
const skill = (v: number | null) => (v == null ? '—' : v.toFixed(1))

export default function V2OrgClassDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = Number(params.id)

  const [detail, setDetail] = useState<OrgClassDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setDetail(await getOrgClassDetail(id))
      setError('')
    } catch (e: unknown) {
      setError(apiMessage(e))
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { void load() }, [load])

  const rows = useMemo(() => {
    const students = detail?.students ?? []
    const q = query.trim().toLowerCase()
    if (!q) return students
    return students.filter(
      (s) => (s.displayName ?? '').toLowerCase().includes(q) || (s.email ?? '').toLowerCase().includes(q),
    )
  }, [detail, query])

  const GRID = '1fr 110px 64px 64px 64px 64px'

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr
        accent
        title={detail?.name ?? 'Chi tiết lớp'}
        subtitle={
          detail
            ? `Mã lớp: ${detail.inviteCode || '—'} · GV: ${detail.teacherName || 'Chưa phân công'} · ${detail.studentCount} học viên`
            : 'Đang tải…'
        }
        right={
          <GaBtn variant="ghost" size="sm" onClick={() => router.push('/v2/org/classes')}>
            <ArrowLeft size={15} /> Lớp học
          </GaBtn>
        }
      />

      <div className="flex-1 overflow-auto px-10 py-6">
        {loading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="ga-shimmer h-[54px] border border-ga-line" aria-hidden />)}
          </div>
        ) : error ? (
          <div className="border border-ga-line bg-ga-card px-10 py-[52px] text-center">
            <h2 className="font-ga-display text-[24px] font-medium text-ga-red">Không tải được lớp học</h2>
            <p className="ga-ui mx-auto mb-5 mt-3 max-w-sm text-[14px] text-ga-muted">
              {error} <code className="font-mono text-[12px] text-ga-accent">{`GET /api/org/classes/${id}`}</code>
            </p>
            <GaBtn variant="primary" onClick={load}>Thử lại</GaBtn>
          </div>
        ) : detail ? (
          <>
            <TkStatStrip
              items={[
                { label: 'Sĩ số', value: detail.studentCount, sub: 'học viên' },
                { label: 'Giáo viên', value: detail.teacherName || '—', sub: detail.teacherId ? `#${detail.teacherId}` : 'chưa phân công', color: TEAL },
                { label: 'Mã lớp', value: detail.inviteCode || '—', sub: 'mời tham gia' },
                { label: 'Ngày tạo', value: fmtDate(detail.createdAt), sub: 'khởi tạo lớp' },
              ]}
            />

            <div className="mb-3.5 mt-[22px] flex items-center justify-between gap-4">
              <GaCap>Danh sách học viên</GaCap>
              <TkSearch value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm học viên…" containerClassName="w-[220px]" />
            </div>

            <div className="border border-ga-line bg-ga-card">
              <div className="grid items-center gap-2 border-b border-ga-line bg-ga-bg px-[18px] py-[11px]" style={{ gridTemplateColumns: GRID }}>
                {['Học viên', 'Tham gia', 'Hören', 'Lesen', 'Schr.', 'Spr.'].map((h, i) => (
                  <span key={h} className={`ga-ui text-[10px] font-bold uppercase tracking-[0.1em] text-ga-muted ${i >= 2 ? 'text-right' : ''}`}>{h}</span>
                ))}
              </div>

              {rows.length === 0 ? (
                <div className="px-6 py-[30px] text-center text-[14px] text-ga-muted">
                  {detail.students.length === 0 ? 'Lớp chưa có học viên nào.' : 'Không tìm thấy học viên.'}
                </div>
              ) : (
                rows.map((s, i) => (
                  <div
                    key={s.userId}
                    className="grid items-center gap-2 px-[18px] py-[13px] transition-colors hover:bg-ga-surface"
                    style={{ gridTemplateColumns: GRID, borderTop: i ? '1px solid var(--ga-line)' : 'none' }}
                  >
                    <button type="button" onClick={() => router.push(`/v2/org/students/${s.userId}`)} className="flex min-w-0 items-center gap-2.5 text-left">
                      <span className="grid h-8 w-8 shrink-0 place-items-center font-ga-display text-[13px] font-medium" style={{ color: TEAL, background: 'var(--ga-teal-soft)' }}>{initial(s.displayName)}</span>
                      <span className="min-w-0">
                        <span className="block truncate text-[14px] font-semibold text-ga-ink hover:text-ga-accent">{s.displayName || '—'}</span>
                        <span className="block truncate text-[11.5px] text-ga-muted">{s.email || '—'}</span>
                      </span>
                    </button>
                    <span className="text-[12.5px] text-ga-muted">{fmtDate(s.joinedAt)}</span>
                    {[s.skillHoren, s.skillLesen, s.skillSchreiben, s.skillSprechen].map((v, j) => (
                      <span key={j} className="text-right text-[13px] font-semibold text-ga-ink">{skill(v)}</span>
                    ))}
                  </div>
                ))
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
