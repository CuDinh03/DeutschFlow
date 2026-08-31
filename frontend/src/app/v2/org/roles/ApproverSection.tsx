'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { apiMessage } from '@/lib/api'
import { listClasses, type OrgClass, type OrgMember } from '@/lib/orgApi'
import {
  grantAcademicApprover,
  listAcademicApprovers,
  revokeAcademicApprover,
  type AcademicApprover,
  type ApproverScope,
} from '@/lib/orgAcademicApproverApi'
import { GaBtn, TkBadge, ConfirmDialog, LoadingState } from '@/components/ui-v2'
import { GaSection } from '../../analyticsShared'

/**
 * Phân công NGƯỜI DUYỆT HỌC VỤ (giáo viên trưởng) — PR-2, P01. Hiện trong màn Phân quyền:
 * org-admin xem; chỉ giám đốc (OWNER) gán/thu hồi. Thu hồi đi qua ConfirmDialog nêu hệ quả
 * (§2.11). Giám đốc mặc định có quyền duyệt nên không xuất hiện trong bảng.
 */
export function ApproverSection({ isOwner, members }: {
  isOwner: boolean
  members: OrgMember[]
}) {
  const t = useTranslations('v2.org.roles.approvers')
  const [approvers, setApprovers] = useState<AcademicApprover[]>([])
  const [classes, setClasses] = useState<OrgClass[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [grantUserId, setGrantUserId] = useState('')
  const [grantScope, setGrantScope] = useState<ApproverScope>('ORG')
  const [grantClassId, setGrantClassId] = useState('')
  const [revoking, setRevoking] = useState<AcademicApprover | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [rows, classPage] = await Promise.all([listAcademicApprovers(), listClasses(0, 100)])
      setApprovers(rows)
      setClasses(classPage.content)
    } catch (e) {
      setError(apiMessage(e))
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { void load() }, [load])

  // Ứng viên: thành viên ACTIVE vai TEACHER/MANAGER (OWNER mặc định có quyền; STUDENT bị backend chặn)
  const candidates = members.filter((m) => m.status === 'ACTIVE' && (m.role === 'TEACHER' || m.role === 'MANAGER'))

  const grant = async (): Promise<void> => {
    if (!grantUserId) return
    setBusy(true)
    try {
      await grantAcademicApprover({
        userId: Number(grantUserId),
        scope: grantScope,
        classId: grantScope === 'CLASS' ? Number(grantClassId) : null,
      })
      toast.success(t('grantSuccess'))
      setGrantUserId('')
      setGrantClassId('')
      await load()
    } catch (e) {
      toast.error(apiMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const revoke = async (): Promise<void> => {
    if (!revoking) return
    setBusy(true)
    try {
      await revokeAcademicApprover(revoking.id)
      toast.success(t('revokeSuccess'))
      setRevoking(null)
      await load()
    } catch (e) {
      toast.error(apiMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <GaSection title={t('title')}>
      <p className="ga-ui mb-3 text-[12.5px] leading-relaxed text-ga-muted">
        {t('subtitle')} {isOwner ? '' : t('ownerNote')}
      </p>

      {loading && <LoadingState variant="skeleton" rows={2} />}
      {!loading && error && (
        <p className="text-[13px] text-ga-red">
          {error}{' '}
          <button type="button" className="underline" onClick={() => void load()}>{t('retry')}</button>
        </p>
      )}

      {!loading && !error && (
        <>
          {approvers.length === 0 ? (
            <p className="ga-ui border border-dashed border-ga-line px-5 py-6 text-center text-[13px] text-ga-muted">
              {t('empty')}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left lg:min-w-0">
                <thead>
                  <tr className="border-b border-ga-border">
                    {[t('colMember'), t('colScope'), t('colGranted'), ''].map((h, i) => (
                      <th key={i} className={`ga-ui px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-ga-muted ${i === 3 ? 'text-right' : ''}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {approvers.map((a) => (
                    <tr key={a.id} className="border-b border-ga-border last:border-0 hover:bg-ga-surface">
                      <td className="px-4 py-2.5">
                        <p className="text-[13.5px] font-semibold text-ga-ink">{a.displayName || a.email}</p>
                        <p className="truncate text-[12px] text-ga-muted">{a.email}</p>
                      </td>
                      <td className="px-4 py-2.5">
                        <TkBadge tone={a.scope === 'ORG' ? 'navy' : 'violet'}>
                          {a.scope === 'ORG' ? t('scopeORG') : t('scopeCLASS')}
                        </TkBadge>
                        {a.scope === 'CLASS' && (
                          <span className="ml-1.5 text-[12px] text-ga-muted">{a.className ?? `#${a.classId}`}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-[12.5px] text-ga-muted">
                        {format(new Date(a.grantedAt), 'dd/MM/yyyy')}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {isOwner && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => setRevoking(a)}
                            className="ga-ui inline-flex min-h-[40px] items-center justify-center rounded-ga border border-ga-line px-[10px] py-[6px] text-[11px] font-semibold text-ga-muted transition-colors hover:border-ga-red hover:text-ga-red disabled:opacity-40 lg:min-h-0"
                          >
                            {t('revoke')}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {isOwner && (
            <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-ga-border pt-4">
              <label className="flex min-w-[180px] flex-1 flex-col gap-1">
                <span className="ga-ui text-[11px] font-semibold uppercase tracking-wide text-ga-muted">{t('grantMember')}</span>
                <select
                  value={grantUserId}
                  onChange={(e) => setGrantUserId(e.target.value)}
                  className="ga-ui min-h-[40px] rounded-ga border border-ga-line bg-ga-surface px-2 py-1.5 text-[13px] text-ga-ink lg:min-h-0"
                >
                  <option value="">{t('grantSelectMember')}</option>
                  {candidates.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {(m.displayName || m.email) + (m.role === 'MANAGER' ? ` (${t('managerTag')})` : '')}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="ga-ui text-[11px] font-semibold uppercase tracking-wide text-ga-muted">{t('grantScope')}</span>
                <select
                  value={grantScope}
                  onChange={(e) => setGrantScope(e.target.value as ApproverScope)}
                  className="ga-ui min-h-[40px] rounded-ga border border-ga-line bg-ga-surface px-2 py-1.5 text-[13px] text-ga-ink lg:min-h-0"
                >
                  <option value="ORG">{t('scopeORG')}</option>
                  <option value="CLASS">{t('scopeCLASS')}</option>
                </select>
              </label>
              {grantScope === 'CLASS' && (
                <label className="flex min-w-[160px] flex-col gap-1">
                  <span className="ga-ui text-[11px] font-semibold uppercase tracking-wide text-ga-muted">{t('grantClass')}</span>
                  <select
                    value={grantClassId}
                    onChange={(e) => setGrantClassId(e.target.value)}
                    className="ga-ui min-h-[40px] rounded-ga border border-ga-line bg-ga-surface px-2 py-1.5 text-[13px] text-ga-ink lg:min-h-0"
                  >
                    <option value="">{t('grantSelectClass')}</option>
                    {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </label>
              )}
              <GaBtn
                size="sm"
                loading={busy}
                disabled={!grantUserId || (grantScope === 'CLASS' && !grantClassId)}
                onClick={() => void grant()}
              >
                {t('grantBtn')}
              </GaBtn>
            </div>
          )}

          <p className="ga-ui mt-3 text-[11.5px] leading-relaxed text-ga-subtle">{t('ownerImplicitNote')}</p>
        </>
      )}

      {revoking && (
        <ConfirmDialog
          open
          onOpenChange={(o) => { if (!o) setRevoking(null) }}
          title={t('revokeDialogTitle')}
          description={t('revokeDialogDesc', { name: revoking.displayName || revoking.email || `#${revoking.userId}` })}
          details={[
            revoking.scope === 'ORG'
              ? t('revokeDialogDetailOrg')
              : t('revokeDialogDetailClass', { className: revoking.className ?? `#${revoking.classId}` }),
            t('revokeDialogDetailHistory'),
          ]}
          confirmLabel={t('revokeDialogOk')}
          cancelLabel={t('cancel')}
          loading={busy}
          onConfirm={() => void revoke()}
        />
      )}
    </GaSection>
  )
}
