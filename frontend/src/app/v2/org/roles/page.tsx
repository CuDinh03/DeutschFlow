'use client'

import { useCallback, useEffect, useState } from 'react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { apiMessage } from '@/lib/api'
import { listMembers, removeMember, type OrgMember, type OrgRole } from '@/lib/orgApi'
import { GaPageHdr, TkStatStrip, TkBadge, ErrorBanner, LoadingState } from '@/components/ui-v2'
import { GaSection, nfVN } from '../../analyticsShared'

// Reuse listMembers() (all roles) + removeMember. Option-1: no role-CHANGE endpoint →
// roles are read-only (change = toast); removal is real (removeMember).

const fmtDate = (d: string | null | undefined) => (d ? format(new Date(d), 'dd/MM/yyyy') : '—')

const ROLE_META: Record<OrgRole, { label: string; tone: 'red' | 'navy' | 'violet' | 'blue' }> = {
  OWNER: { label: 'Chủ sở hữu', tone: 'red' },
  ADMIN: { label: 'Quản trị', tone: 'navy' },
  TEACHER: { label: 'Giáo viên', tone: 'violet' },
  STUDENT: { label: 'Học viên', tone: 'blue' },
}

export default function V2OrgRolesPage() {
  const [members, setMembers] = useState<OrgMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setMembers(await listMembers())
    } catch (e: unknown) {
      setError(apiMessage(e))
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { void load() }, [load])

  const active = members.filter((m) => m.status === 'ACTIVE')
  const count = (...roles: OrgRole[]) => active.filter((m) => roles.includes(m.role)).length

  const handleRemove = async (m: OrgMember) => {
    if (m.role === 'OWNER') {
      toast.error('Không thể gỡ chủ sở hữu.')
      return
    }
    if (!window.confirm(`Gỡ ${m.displayName || m.email} khỏi tổ chức?`)) return
    setBusy(m.userId)
    try {
      await removeMember(m.userId)
      toast.success('Đã gỡ thành viên.')
      await load()
    } catch (e: unknown) {
      toast.error(apiMessage(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr accent title="Phân quyền" subtitle="Vai trò và quyền hạn của thành viên trong tổ chức" />
      <div className="flex-1 px-10 py-6">
        {error && (
          <div className="mb-5">
            <ErrorBanner message={error} onRetry={() => void load()} />
          </div>
        )}
        {loading ? (
          <LoadingState label="Đang tải thành viên…" />
        ) : (
          <div className="space-y-[22px]">
            <TkStatStrip
              items={[
                { label: 'Quản trị', value: count('OWNER', 'ADMIN'), sub: 'chủ sở hữu + admin', color: '#27406B' },
                { label: 'Giáo viên', value: count('TEACHER'), color: '#7C56C8' },
                { label: 'Học viên', value: count('STUDENT'), color: '#2F6FC9' },
                { label: 'Tổng thành viên', value: active.length, color: '#11888A' },
              ]}
            />

            <GaSection title="Thành viên & vai trò" bodyClassName="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-ga-border">
                      {['Thành viên', 'Vai trò', 'Trạng thái', 'Tham gia', ''].map((h, i) => (
                        <th
                          key={i}
                          className={`ga-ui px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-ga-muted ${
                            i === 4 ? 'text-right' : ''
                          }`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {members.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="ga-ui px-5 py-10 text-center text-[14px] text-ga-muted">
                          Chưa có thành viên.
                        </td>
                      </tr>
                    ) : (
                      members.map((m) => {
                        const meta = ROLE_META[m.role]
                        const removed = m.status === 'REMOVED'
                        return (
                          <tr
                            key={m.userId}
                            className={`border-b border-ga-border last:border-0 hover:bg-ga-surface ${removed ? 'opacity-50' : ''}`}
                          >
                            <td className="px-5 py-3">
                              <p className="text-[14px] font-semibold text-ga-ink">{m.displayName || m.email}</p>
                              <p className="truncate text-[12px] text-ga-muted">{m.email}</p>
                            </td>
                            <td className="px-5 py-3">
                              <button
                                type="button"
                                onClick={() => toast('Đổi vai trò (sắp ra mắt)')}
                                disabled={m.role === 'OWNER'}
                                className="disabled:cursor-default"
                              >
                                <TkBadge tone={meta.tone}>{meta.label}</TkBadge>
                              </button>
                            </td>
                            <td className="px-5 py-3">
                              <span
                                className="ga-ui inline-flex items-center gap-1.5 text-[12.5px]"
                                style={{ color: removed ? 'var(--ga-muted)' : 'var(--ga-green)' }}
                              >
                                <span
                                  className="h-1.5 w-1.5 rounded-full"
                                  style={{ background: removed ? 'var(--ga-subtle)' : 'var(--ga-green)' }}
                                />
                                {removed ? 'Đã gỡ' : 'Hoạt động'}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-[13px] text-ga-muted">{fmtDate(m.joinedAt)}</td>
                            <td className="px-5 py-3 text-right">
                              {m.role !== 'OWNER' && !removed && (
                                <button
                                  type="button"
                                  disabled={busy === m.userId}
                                  onClick={() => handleRemove(m)}
                                  className="ga-ui rounded-ga border border-ga-line px-[10px] py-[6px] text-[11px] font-semibold text-ga-muted transition-colors hover:border-ga-red hover:text-ga-red disabled:opacity-40"
                                >
                                  Gỡ
                                </button>
                              )}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </GaSection>

            <p className="ga-ui text-[12px] text-ga-subtle">
              {nfVN.format(members.length)} thành viên · Đổi vai trò sẽ khả dụng khi backend hỗ trợ.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
