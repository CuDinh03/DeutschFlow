'use client'

import { useCallback, useEffect, useState } from 'react'
import { UserPlus, Mail, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { apiMessage } from '@/lib/api'
import {
  listMembers, listInvitations, revokeInvitation,
  listClasses, listTeacherClassIds, assignClassTeacher, unassignClassTeacher,
  type OrgMember, type OrgInvitation, type OrgClass,
} from '@/lib/orgApi'
import { GaPageHdr, GaBtn, GaCap, TkModal, LoadingState } from '@/components/ui-v2'

// ─────────────────────────────────────────────────────────────────────────────
// Giáo viên của tổ chức (GaOrgTeachers) — teal, card grid.
// Plumbing reused 1:1 (zero backend): listMembers('TEACHER') (joined teachers) +
//   listInvitations (pending invites) + revokeInvitation.
// Option-1: OrgMember has no per-teacher classes/students/RATING → dropped. The proto's
// "chờ duyệt" teachers map to pending INVITATIONS (members are already ACTIVE once joined).
// "Mời giáo viên" → org-invitations (not built) toasts; "Phân công" → toast.
// ─────────────────────────────────────────────────────────────────────────────

const TEAL = '#11888A'
const VIOLET = '#7C56C8'
const fmtDate = (d: string | null | undefined) => (d ? format(new Date(d), 'dd/MM/yyyy') : '—')
const initial = (n: string | null) => ((n ?? '?').trim()[0] ?? '?').toUpperCase()

export default function V2OrgTeachersPage() {
  const [teachers, setTeachers] = useState<OrgMember[]>([])
  const [invites, setInvites] = useState<OrgInvitation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<number | null>(null)
  const [assignTarget, setAssignTarget] = useState<OrgMember | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [ts, inv] = await Promise.all([listMembers('TEACHER'), listInvitations().catch(() => [] as OrgInvitation[])])
      setTeachers(ts)
      setInvites(inv.filter((i) => i.status === 'PENDING' && i.role === 'TEACHER'))
      setError('')
    } catch (e: unknown) {
      setError(apiMessage(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const revoke = async (id: number) => {
    setBusy(id)
    try {
      await revokeInvitation(id)
      toast.success('Đã thu hồi lời mời')
      await load()
    } catch (e: unknown) {
      toast.error(apiMessage(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr
        accent
        title="Giáo viên của tổ chức"
        subtitle="Quản lý giáo viên, phân công lớp và lời mời"
        right={
          <GaBtn variant="yellow" size="sm" onClick={() => toast('Mời giáo viên (sắp ra mắt)')}>
            <UserPlus size={15} /> Mời giáo viên
          </GaBtn>
        }
      />

      <div className="flex-1 overflow-auto px-10 py-6">
        {loading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="ga-shimmer h-[96px] border border-ga-line" aria-hidden />)}</div>
        ) : error ? (
          <div className="border border-ga-line bg-ga-card px-10 py-[52px] text-center">
            <h2 className="font-ga-display text-[24px] font-medium text-ga-red">Không tải được giáo viên</h2>
            <p className="ga-ui mx-auto mb-5 mt-3 max-w-sm text-[14px] text-ga-muted">{error} <code className="font-mono text-[12px] text-ga-accent">GET /api/org/members</code></p>
            <GaBtn variant="primary" onClick={load}>Thử lại</GaBtn>
          </div>
        ) : (
          <>
            {/* Pending invitations */}
            {invites.length > 0 && (
              <div className="mb-6">
                <div className="mb-3 flex items-center gap-3 border px-5 py-3.5" style={{ borderColor: 'color-mix(in srgb, var(--ga-orange) 35%, transparent)', background: 'var(--ga-orange-soft)' }}>
                  <span className="h-2 w-2 shrink-0" style={{ background: 'var(--ga-orange)' }} />
                  <span className="flex-1 text-[14px] text-ga-ink"><strong>{invites.length} lời mời</strong> đang chờ giáo viên chấp nhận.</span>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {invites.map((inv) => (
                    <div key={inv.id} className="flex items-center gap-3.5 border border-ga-line bg-ga-card px-5 py-3.5">
                      <span className="grid h-10 w-10 shrink-0 place-items-center" style={{ background: 'var(--ga-orange-soft)' }}><Mail size={17} style={{ color: 'var(--ga-orange)' }} /></span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[14px] font-semibold text-ga-ink">{inv.email}</div>
                        <div className="text-[11.5px] text-ga-muted">Chờ chấp nhận · hết hạn {fmtDate(inv.expiresAt)}</div>
                      </div>
                      <button type="button" disabled={busy === inv.id} onClick={() => revoke(inv.id)} className="ga-ui shrink-0 border px-2.5 py-1.5 text-[11.5px] font-semibold disabled:opacity-50" style={{ color: 'var(--ga-red)', borderColor: 'color-mix(in srgb, var(--ga-red) 35%, transparent)' }}>
                        Thu hồi
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <GaCap className="mb-3.5 block">Giáo viên ({teachers.length})</GaCap>
            {teachers.length === 0 ? (
              <div className="border border-dashed border-ga-line px-10 py-[40px] text-center text-[14px] text-ga-muted">Tổ chức chưa có giáo viên — mời giáo viên đầu tiên ở trên.</div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {teachers.map((tc) => (
                  <div key={tc.userId} className="flex items-center gap-4 border border-ga-line bg-ga-card px-[22px] py-5">
                    <span className="grid h-12 w-12 shrink-0 place-items-center font-ga-display text-[20px] font-medium" style={{ color: VIOLET, background: 'var(--ga-violet-soft)' }}>{initial(tc.displayName)}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[15px] font-bold text-ga-ink">{tc.displayName || '—'}</span>
                        <span className="shrink-0 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.04em]" style={tc.status === 'ACTIVE' ? { color: 'var(--ga-green)', background: 'var(--ga-green-soft)' } : { color: 'var(--ga-muted)', background: 'var(--ga-side-active)' }}>
                          {tc.status === 'ACTIVE' ? 'Hoạt động' : 'Đã rời'}
                        </span>
                      </div>
                      <div className="mt-0.5 truncate text-[12.5px] text-ga-muted">{tc.email}</div>
                      <div className="mt-1.5 flex items-center gap-1 text-[11.5px] text-ga-subtle"><Clock size={11} /> Tham gia {fmtDate(tc.joinedAt)}</div>
                    </div>
                    <button type="button" disabled={tc.status !== 'ACTIVE'} onClick={() => setAssignTarget(tc)} className="ga-ui shrink-0 border border-ga-line px-3 py-2 text-[11.5px] font-semibold text-ga-muted transition-colors hover:border-ga-accent hover:text-ga-accent disabled:opacity-40">
                      Phân công
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {assignTarget && (
        <AssignClassModal teacher={assignTarget} onClose={() => setAssignTarget(null)} />
      )}
    </div>
  )
}

/** Org-admin assigns/unassigns the teacher across the org's classes (P1-4). */
function AssignClassModal({ teacher, onClose }: { teacher: OrgMember; onClose: () => void }) {
  const [classes, setClasses] = useState<OrgClass[]>([])
  const [assigned, setAssigned] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [page, ids] = await Promise.all([listClasses(0, 100), listTeacherClassIds(teacher.userId)])
      setClasses(page.content ?? [])
      setAssigned(new Set(ids))
    } catch (e: unknown) {
      toast.error(apiMessage(e))
    } finally {
      setLoading(false)
    }
  }, [teacher.userId])
  useEffect(() => { void load() }, [load])

  const toggle = async (classId: number) => {
    const on = assigned.has(classId)
    setBusyId(classId)
    try {
      if (on) {
        await unassignClassTeacher(classId, teacher.userId)
        setAssigned((s) => { const n = new Set(s); n.delete(classId); return n })
        toast.success('Đã gỡ phân công')
      } else {
        await assignClassTeacher(classId, teacher.userId)
        setAssigned((s) => new Set(s).add(classId))
        toast.success('Đã phân công lớp')
      }
    } catch (e: unknown) {
      toast.error(apiMessage(e))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <TkModal
      open
      onOpenChange={(o) => !o && onClose()}
      size="md"
      title="Phân công lớp"
      description={teacher.displayName || teacher.email}
      footer={<GaBtn variant="ghost" onClick={onClose}>Đóng</GaBtn>}
    >
      {loading ? (
        <LoadingState label="Đang tải lớp…" />
      ) : classes.length === 0 ? (
        <p className="ga-ui text-[13.5px] text-ga-muted">Tổ chức chưa có lớp nào để phân công.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {classes.map((c) => {
            const on = assigned.has(c.id)
            return (
              <div key={c.id} className="flex items-center gap-3 border border-ga-line bg-ga-card px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold text-ga-ink">{c.name}</p>
                  <p className="ga-ui text-[12px]" style={{ color: on ? 'var(--ga-green)' : 'var(--ga-muted)' }}>
                    {on ? 'Đã phân công' : 'Chưa phân công'}
                  </p>
                </div>
                <GaBtn
                  variant={on ? 'ghost' : 'primary'}
                  size="sm"
                  loading={busyId === c.id}
                  disabled={busyId !== null}
                  onClick={() => toggle(c.id)}
                >
                  {on ? 'Gỡ' : 'Phân công'}
                </GaBtn>
              </div>
            )
          })}
        </div>
      )}
    </TkModal>
  )
}
