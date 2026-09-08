'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { apiMessage } from '@/lib/api'
import { changeMemberRole, listMembers, removeMember, transferOwnership, type OrgMember, type OrgRole } from '@/lib/orgApi'
import { getOrgRole } from '@/lib/authSession'
import { GaPageHdr, GaStatStrip, TkBadge, ErrorBanner, LoadingState, ConfirmDialog } from '@/components/ui-v2'
import { GaSection } from '../../sectionShared'
import { ApproverSection } from './ApproverSection'
import { useFmt } from '@/lib/i18n/useFmt'

// listMembers() (all roles) + real mutations: changeMemberRole (PATCH /org/members/{id}/role,
// OWNER-only, MANAGER↔TEACHER) and removeMember (DELETE → REVOKED). Both backed by #143.
//
// V-12b (08/09/2026): GET /org/members chỉ trả thành viên ACTIVE (OrgService#listMembers gọi
// findByIdOrgIdAndStatus(orgId, 'ACTIVE')), nên `m.status !== 'ACTIVE'` KHÔNG BAO GIỜ đúng và cả
// nhánh giao diện "Đã gỡ" — dòng mờ đi, ẩn nút gỡ, ẩn ô đổi vai — là mã chết. Gỡ xong thành viên
// biến khỏi danh sách ở lần `load()` kế tiếp; đó mới là hành vi thật. Cột "Trạng thái" vì thế nói
// đúng một điều duy nhất và đã gỡ luôn thay vì giả vờ có hai giá trị.

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
  const fmt = useFmt()
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

  // `members` đã là ACTIVE hết (máy chủ lọc) — không lọc lại lần nữa để khỏi ngụ ý có nhóm khác.
  const count = (...roles: OrgRole[]) => members.filter((m) => roles.includes(m.role)).length

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

  // §2.11: gỡ thành viên là thao tác hủy hoại → ConfirmDialog nêu hệ quả (thay window.confirm cũ).
  const [removeTarget, setRemoveTarget] = useState<OrgMember | null>(null)

  const handleRemove = (m: OrgMember) => {
    if (m.role === 'OWNER') {
      toast.error(t('cannotRemoveOwner'))
      return
    }
    setRemoveTarget(m)
  }

  const confirmRemove = async () => {
    if (!removeTarget) return
    const m = removeTarget
    setBusy(m.userId)
    try {
      await removeMember(m.userId)
      toast.success(t('removed'))
      setRemoveTarget(null)
      await load()
    } catch (e: unknown) {
      toast.error(apiMessage(e))
    } finally {
      setBusy(null)
    }
  }

  // G-08: chuyển quyền giám đốc — POST /org/members/{id}/transfer-ownership. Backend promote người
  // nhận lên OWNER và demote người gọi xuống MANAGER trong CÙNG một transaction; trước đợt này
  // không màn web nào gọi tới, nên giám đốc nghỉ việc là trung tâm khoá cứng (OWNER không bị gỡ,
  // không tự rời được) và phải nhờ đội nền tảng sửa thẳng cơ sở dữ liệu.
  const [transferTarget, setTransferTarget] = useState<OrgMember | null>(null)
  // Tên giám đốc mới sau khi chuyển xong — dùng cho dòng thông báo, và là dấu "phiên đã hạ vai".
  const [demotedTo, setDemotedTo] = useState<string | null>(null)

  const confirmTransfer = async () => {
    if (!transferTarget) return
    const m = transferTarget
    const name = m.displayName || m.email
    setBusy(m.userId)
    try {
      await transferOwnership(m.userId)
      toast.success(t('transferred', { name }))
      setTransferTarget(null)
      // Người bấm KHÔNG còn là OWNER. Access token cũ vẫn mang orgRole=OWNER tới lần refresh kế
      // tiếp, nên getOrgRole() sẽ vẫn nói dối — hạ cờ tại chỗ để mọi nút OWNER-only tắt ngay thay
      // vì mời người dùng bấm tiếp rồi ăn 403 từ OrgGuard.
      setIsOwner(false)
      setDemotedTo(name)
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
            {demotedTo && (
              <p role="status" className="ga-ui rounded-ga border border-ga-line bg-ga-surface px-4 py-3 text-ga-small text-ga-ink">
                {t('transferDoneNote', { name: demotedTo })}
              </p>
            )}
            <GaStatStrip
              items={[
                { label: t('stats.managers'), value: count('OWNER', 'MANAGER'), sub: t('stats.managersSub'), tone: 'navy' },
                { label: t('stats.teachers'), value: count('TEACHER'), tone: 'violet' },
                { label: t('stats.students'), value: count('STUDENT'), tone: 'blue' },
                { label: t('stats.totalMembers'), value: members.length, tone: 'teal' },
              ]}
            />

            <GaSection title={t('sectionTitle')} bodyClassName="p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-left lg:min-w-0">
                  <thead>
                    <tr className="border-b border-ga-border">
                      {[t('colMember'), t('colRole'), t('colJoined'), ''].map((h, i) => (
                        <th
                          key={i}
                          className={`ga-ui px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-ga-muted ${
                            i === 3 ? 'text-right' : ''
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
                        <td colSpan={4} className="ga-ui px-5 py-10 text-center text-[14px] text-ga-muted">
                          {t('emptyMembers')}
                        </td>
                      </tr>
                    ) : (
                      members.map((m) => {
                        const tone = ROLE_TONE[m.role]
                        return (
                          <tr key={m.userId} className="border-b border-ga-border last:border-0 hover:bg-ga-surface">
                            <td className="px-5 py-3">
                              <p className="text-[14px] font-semibold text-ga-ink">{m.displayName || m.email}</p>
                              <p className="truncate text-[12px] text-ga-muted">{m.email}</p>
                            </td>
                            <td className="px-5 py-3">
                              {isOwner && (m.role === 'MANAGER' || m.role === 'TEACHER') ? (
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
                            <td className="px-5 py-3 text-[13px] text-ga-muted">{fmtDate(m.joinedAt)}</td>
                            <td className="px-5 py-3 text-right">
                              {/* G-08: chỉ OWNER chuyển được quyền, và chỉ cho nhân sự (MANAGER/TEACHER). */}
                              {isOwner && (m.role === 'MANAGER' || m.role === 'TEACHER') && (
                                <button
                                  type="button"
                                  disabled={busy === m.userId}
                                  onClick={() => setTransferTarget(m)}
                                  className="ga-ui mr-2 inline-flex min-h-[40px] items-center justify-center rounded-ga border border-ga-line px-[10px] py-[6px] text-ga-caption font-semibold text-ga-muted transition-colors hover:border-ga-navy hover:text-ga-navy disabled:opacity-40 lg:min-h-0"
                                >
                                  {t('transfer')}
                                </button>
                              )}
                              {/* Backend chỉ cho OWNER gỡ MANAGER (V-14): đừng mở hộp thoại rồi mới ăn 403. */}
                              {m.role !== 'OWNER' && (isOwner || m.role !== 'MANAGER') && (
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

            <ApproverSection isOwner={isOwner} members={members} />

            <p className="ga-ui text-[12px] text-ga-subtle">
              {isOwner ? t('footerOwner', { count: fmt.num(members.length) }) : t('footerMember', { count: fmt.num(members.length) })}
            </p>
          </div>
        )}
      </div>

      {transferTarget && (
        <ConfirmDialog
          open
          onOpenChange={(o) => { if (!o) setTransferTarget(null) }}
          title={t('transferDialogTitle')}
          description={t('transferDialogDesc', { name: transferTarget.displayName || transferTarget.email })}
          details={[
            t('transferDialogDetailNewOwner', { name: transferTarget.displayName || transferTarget.email }),
            t('transferDialogDetailSelfDemoted'),
            t('transferDialogDetailIrreversible'),
          ]}
          confirmLabel={t('transferDialogOk')}
          cancelLabel={t('removeDialogCancel')}
          loading={busy === transferTarget.userId}
          onConfirm={() => void confirmTransfer()}
        />
      )}

      {removeTarget && (
        <ConfirmDialog
          open
          onOpenChange={(o) => { if (!o) setRemoveTarget(null) }}
          title={t('removeDialogTitle')}
          description={t('confirmRemove', { name: removeTarget.displayName || removeTarget.email })}
          details={[t('removeDialogDetailAccess'), t('removeDialogDetailReinvite')]}
          confirmLabel={t('remove')}
          cancelLabel={t('removeDialogCancel')}
          loading={busy === removeTarget.userId}
          onConfirm={() => void confirmRemove()}
        />
      )}
    </div>
  )
}
