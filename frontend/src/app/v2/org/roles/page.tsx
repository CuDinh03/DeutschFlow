'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { apiMessage } from '@/lib/api'
import { changeMemberRole, listMembers, removeMember, type OrgMember, type OrgRole } from '@/lib/orgApi'
import { getOrgRole } from '@/lib/authSession'
import { GaPageHdr, TkStatStrip, TkBadge, ErrorBanner, LoadingState } from '@/components/ui-v2'
import { GaSection, nfVN } from '../../analyticsShared'

// listMembers() (all roles) + real mutations: changeMemberRole (PATCH /org/members/{id}/role,
// OWNER-only, MANAGER↔TEACHER) and removeMember (DELETE → REVOKED). Both backed by #143.

const fmtDate = (d: string | null | undefined) => (d ? format(new Date(d), 'dd/MM/yyyy') : '—')

// Role → badge tone only; the label comes from t('meta.<ROLE>').
const ROLE_TONE: Record<OrgRole, 'red' | 'navy' | 'violet' | 'blue'> = {
  OWNER: 'red',
  MANAGER: 'navy',
  TEACHER: 'violet',
  STUDENT: 'blue',
}

export default function V2OrgRolesPage() {
  const t = useTranslations('v2.org.roles')
  const [members, setMembers] = useState<OrgMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<number | null>(null)
  const [isOwner, setIsOwner] = useState(false)

  useEffect(() => { setIsOwner(getOrgRole() === 'OWNER') }, [])

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

  const handleChangeRole = async (m: OrgMember, role: OrgRole) => {
    if (role === m.role) return
    setBusy(m.userId)
    try {
      await changeMemberRole(m.userId, role)
      toast.success(t('changed'))
      await load()
    } catch (e: unknown) {
      toast.error(apiMessage(e))
    } finally {
      setBusy(null)
    }
  }

  const handleRemove = async (m: OrgMember) => {
    if (m.role === 'OWNER') {
      toast.error(t('cannotRemoveOwner'))
      return
    }
    if (!window.confirm(t('confirmRemove', { name: m.displayName || m.email }))) return
    setBusy(m.userId)
    try {
      await removeMember(m.userId)
      toast.success(t('removed'))
      await load()
    } catch (e: unknown) {
      toast.error(apiMessage(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr accent title={t('title')} subtitle={t('subtitle')} />
      <div className="flex-1 px-4 py-6 sm:px-6 lg:px-10">
        {error && (
          <div className="mb-5">
            <ErrorBanner message={error} onRetry={() => void load()} />
          </div>
        )}
        {loading ? (
          <LoadingState label={t('loading')} />
        ) : (
          <div className="space-y-[22px]">
            <TkStatStrip
              items={[
                { label: t('stats.managers'), value: count('OWNER', 'MANAGER'), sub: t('stats.managersSub'), color: '#27406B' },
                { label: t('stats.teachers'), value: count('TEACHER'), color: '#7C56C8' },
                { label: t('stats.students'), value: count('STUDENT'), color: '#2F6FC9' },
                { label: t('stats.totalMembers'), value: active.length, color: '#11888A' },
              ]}
            />

            <GaSection title={t('sectionTitle')} bodyClassName="p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-left lg:min-w-0">
                  <thead>
                    <tr className="border-b border-ga-border">
                      {[t('colMember'), t('colRole'), t('colStatus'), t('colJoined'), ''].map((h, i) => (
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
                          {t('emptyMembers')}
                        </td>
                      </tr>
                    ) : (
                      members.map((m) => {
                        const tone = ROLE_TONE[m.role]
                        const removed = m.status !== 'ACTIVE'
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
                              {isOwner && !removed && (m.role === 'MANAGER' || m.role === 'TEACHER') ? (
                                <select
                                  value={m.role}
                                  disabled={busy === m.userId}
                                  onChange={(e) => void handleChangeRole(m, e.target.value as OrgRole)}
                                  className="ga-ui min-h-[40px] rounded-ga border border-ga-line bg-ga-surface px-2 py-1 text-[12.5px] font-semibold text-ga-ink transition-colors hover:border-ga-navy disabled:opacity-40 lg:min-h-0"
                                  aria-label={t('changeRoleAria', { name: m.displayName || m.email })}
                                >
                                  <option value="MANAGER">{t('optManager')}</option>
                                  <option value="TEACHER">{t('optTeacher')}</option>
                                </select>
                              ) : (
                                <TkBadge tone={tone}>{t(`meta.${m.role}`)}</TkBadge>
                              )}
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
                                {removed ? t('statusRemoved') : t('statusActive')}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-[13px] text-ga-muted">{fmtDate(m.joinedAt)}</td>
                            <td className="px-5 py-3 text-right">
                              {m.role !== 'OWNER' && !removed && (
                                <button
                                  type="button"
                                  disabled={busy === m.userId}
                                  onClick={() => handleRemove(m)}
                                  className="ga-ui inline-flex min-h-[40px] items-center justify-center rounded-ga border border-ga-line px-[10px] py-[6px] text-[11px] font-semibold text-ga-muted transition-colors hover:border-ga-red hover:text-ga-red disabled:opacity-40 lg:min-h-0"
                                >
                                  {t('remove')}
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
              {isOwner ? t('footerOwner', { count: nfVN.format(members.length) }) : t('footerMember', { count: nfVN.format(members.length) })}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
