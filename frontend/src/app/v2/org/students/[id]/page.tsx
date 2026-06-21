'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'
import { apiMessage } from '@/lib/api'
import { getOrgStudentDetail, type OrgStudentDetail } from '@/lib/orgApi'
import { GaPageHdr, GaBtn, GaCap, TkStatStrip } from '@/components/ui-v2'

// ─────────────────────────────────────────────────────────────────────────────
// Chi tiết học viên của tổ chức (GaOrgStudentDetail) — teal, read-only org-admin (W1.4).
// orgApi.getOrgStudentDetail → GET /api/org/students/{id} (B1.2):
//   { userId, email, displayName, role, status, joinedAt, classes[] (lọc theo org) }.
// 404 nếu user không phải thành viên org người gọi (IDOR-safe ở backend OrgService).
// ─────────────────────────────────────────────────────────────────────────────

const TEAL = '#11888A'
const fmtDate = (d: string | null) => (d ? format(new Date(d), 'dd/MM/yyyy') : '—')
const initial = (n: string | null) => (n?.trim()[0] ?? '?').toUpperCase()
const ROLE_LABEL: Record<string, string> = {
  OWNER: 'Chủ sở hữu', ADMIN: 'Quản trị', TEACHER: 'Giáo viên', STUDENT: 'Học viên',
}

export default function V2OrgStudentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = Number(params.id)

  const [detail, setDetail] = useState<OrgStudentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setDetail(await getOrgStudentDetail(id))
      setError('')
    } catch (e: unknown) {
      setError(apiMessage(e))
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { void load() }, [load])

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr
        accent
        title={detail?.displayName || 'Chi tiết học viên'}
        subtitle={detail ? detail.email || '—' : 'Đang tải…'}
        right={
          <GaBtn variant="ghost" size="sm" onClick={() => router.push('/v2/org/students')}>
            <ArrowLeft size={15} /> Học viên
          </GaBtn>
        }
      />

      <div className="flex-1 overflow-auto px-10 py-6">
        {loading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="ga-shimmer h-[54px] border border-ga-line" aria-hidden />)}
          </div>
        ) : error ? (
          <div className="border border-ga-line bg-ga-card px-10 py-[52px] text-center">
            <h2 className="font-ga-display text-[24px] font-medium text-ga-red">Không tải được học viên</h2>
            <p className="ga-ui mx-auto mb-5 mt-3 max-w-sm text-[14px] text-ga-muted">
              {error} <code className="font-mono text-[12px] text-ga-accent">{`GET /api/org/students/${id}`}</code>
            </p>
            <GaBtn variant="primary" onClick={load}>Thử lại</GaBtn>
          </div>
        ) : detail ? (
          <>
            <div className="mb-6 flex items-center gap-4">
              <span className="grid h-14 w-14 shrink-0 place-items-center font-ga-display text-[22px] font-medium" style={{ color: TEAL, background: 'var(--ga-teal-soft)' }}>{initial(detail.displayName)}</span>
              <div className="min-w-0">
                <div className="truncate font-ga-display text-[22px] font-medium text-ga-ink">{detail.displayName || '—'}</div>
                <div className="truncate text-[13.5px] text-ga-muted">{detail.email || '—'}</div>
              </div>
            </div>

            <TkStatStrip
              items={[
                { label: 'Vai trò', value: ROLE_LABEL[detail.role] ?? detail.role, color: TEAL },
                { label: 'Trạng thái', value: detail.status === 'ACTIVE' ? 'Đang hoạt động' : 'Đã gỡ', color: detail.status === 'ACTIVE' ? '#1E9E61' : undefined },
                { label: 'Tham gia', value: fmtDate(detail.joinedAt), sub: 'vào tổ chức' },
                { label: 'Số lớp', value: detail.classes.length, sub: 'đang theo học' },
              ]}
            />

            <div className="mb-3.5 mt-[22px]"><GaCap>Lớp đang theo học</GaCap></div>
            {detail.classes.length === 0 ? (
              <div className="border border-dashed border-ga-line px-10 py-[40px] text-center text-[14px] text-ga-muted">
                Học viên chưa tham gia lớp nào trong tổ chức.
              </div>
            ) : (
              <div className="border border-ga-line bg-ga-card">
                {detail.classes.map((c, i) => (
                  <button
                    key={c.classId}
                    type="button"
                    onClick={() => router.push(`/v2/org/classes/${c.classId}`)}
                    className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-ga-surface"
                    style={{ borderTop: i ? '1px solid var(--ga-line)' : 'none' }}
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center font-ga-display text-[14px] font-medium" style={{ color: TEAL, background: 'var(--ga-teal-soft)' }}>{(c.name[0] ?? 'L').toUpperCase()}</span>
                    <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-ga-ink">{c.name}</span>
                    <ChevronRight size={16} className="shrink-0 text-ga-muted" />
                  </button>
                ))}
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  )
}
