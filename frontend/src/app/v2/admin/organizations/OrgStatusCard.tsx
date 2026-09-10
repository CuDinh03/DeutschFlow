'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { PauseCircle, PlayCircle, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { apiMessage } from '@/lib/api'
import { activateEntitlements, updateOrganization, type AdminOrgDetail } from '@/lib/adminOrgApi'
import { ConfirmDialog, ErrorBanner, GaBtn, GaCap, GaCard, TkBadge } from '@/components/ui-v2'
import { useFmt } from '@/lib/i18n/useFmt'
import { addDays, GRACE_DAYS } from './orgLicence'

/**
 * Trạng thái vòng đời của trung tâm (D5, owner chốt 09/09/2026) + hai thao tác có hệ quả tức thì:
 *
 * - Đình chỉ ⇒ CHỈ ĐỌC NGAY (không tạo mới, không AI), học viên giữ gói 7 ngày ân hạn kể từ hôm
 *   nay rồi bị cắt (SubscriptionReconcileJob), ghi sổ trung tâm với tên admin.
 * - Mở lại ⇒ xoá mốc đình chỉ, cấp lại quyền lợi cho mọi học viên đang hoạt động NGAY.
 * - Cấp lại quyền lợi (activate-entitlements) ⇒ dùng sau khi đổi gói: cấp gói hiện tại cho mọi
 *   học viên đang hoạt động, không đổi trạng thái/hạn.
 *
 * Cả ba đi qua ConfirmDialog nêu hệ quả; không window.confirm.
 */
export interface OrgStatusCardProps {
  org: AdminOrgDetail
  onChanged: () => void
}

type Pending = 'suspend' | 'reactivate' | 'regrant'

export function OrgStatusCard({ org, onChanged }: OrgStatusCardProps) {
  const t = useTranslations('v2.adminOps.organizations.statusCard')
  const tStatus = useTranslations('v2.adminOps.organizations.status')
  const tOrg = useTranslations('v2.adminOps.organizations')
  const fmt = useFmt()
  const [pending, setPending] = useState<Pending | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const suspended = (org.status ?? '').toUpperCase() === 'SUSPENDED'
  const students = org.studentCount ?? 0
  const graceEnd = org.suspendedAt ? addDays(new Date(org.suspendedAt), GRACE_DAYS) : null

  const run = async (action: () => Promise<void>) => {
    setBusy(true)
    setError('')
    try {
      await action()
      onChanged()
      setPending(null)
    } catch (e: unknown) {
      setError(apiMessage(e))
      setPending(null)
    } finally {
      setBusy(false)
    }
  }

  const suspend = () =>
    run(async () => {
      await updateOrganization(org.id, { status: 'SUSPENDED' })
      toast.success(t('suspended', { org: org.name }))
    })
  const reactivate = () =>
    run(async () => {
      await updateOrganization(org.id, { status: 'ACTIVE' })
      toast.success(t('reactivated', { org: org.name }))
    })
  const regrant = () =>
    run(async () => {
      const granted = await activateEntitlements(org.id)
      toast.success(tOrg('activated', { count: granted }))
    })

  return (
    <GaCard className="p-4 lg:p-6" data-testid="org-status-card">
      <GaCap>{t('title')}</GaCap>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <TkBadge dot tone={suspended ? 'red' : 'green'}>
          {suspended ? tStatus('SUSPENDED') : tStatus('ACTIVE')}
        </TkBadge>
      </div>
      <p className="ga-ui mt-2 text-ga-small text-ga-muted">
        {suspended
          ? t('suspendedSince', {
              date: fmt.dateTime(org.suspendedAt),
              graceEnd: graceEnd ? fmt.date(graceEnd) : '—',
            })
          : org.validUntil
            ? t('activeUntil', { date: fmt.date(org.validUntil) })
            : t('activePerpetual')}
      </p>

      {error && <ErrorBanner className="mt-3" message={error} />}

      <div className="mt-4 flex flex-col gap-2">
        {suspended ? (
          <GaBtn variant="primary" disabled={busy} onClick={() => setPending('reactivate')} data-testid="status-reactivate">
            <PlayCircle size={15} aria-hidden />
            {t('reactivate')}
          </GaBtn>
        ) : (
          <GaBtn
            variant="ghost"
            className="text-ga-red hover:border-ga-red"
            disabled={busy}
            onClick={() => setPending('suspend')}
            data-testid="status-suspend"
          >
            <PauseCircle size={15} aria-hidden />
            {t('suspend')}
          </GaBtn>
        )}
        <GaBtn variant="ghost" disabled={busy} onClick={() => setPending('regrant')} data-testid="status-regrant">
          <Sparkles size={15} aria-hidden />
          {t('regrant')}
        </GaBtn>
        <p className="ga-ui text-ga-caption text-ga-subtle">{t('regrantHint')}</p>
      </div>

      {pending === 'suspend' && (
        <ConfirmDialog
          open
          onOpenChange={(o) => {
            if (!o && !busy) setPending(null)
          }}
          title={t('suspendDialog.title', { org: org.name })}
          description={t('suspendDialog.description')}
          details={[
            t('suspendDialog.detailReadOnly'),
            t('suspendDialog.detailGrace', { count: fmt.num(students), date: fmt.date(addDays(new Date(), GRACE_DAYS)) }),
            t('suspendDialog.detailLedger'),
          ]}
          confirmLabel={t('suspendDialog.confirm')}
          cancelLabel={t('cancel')}
          loading={busy}
          onConfirm={() => void suspend()}
        />
      )}

      {pending === 'reactivate' && (
        <ConfirmDialog
          open
          onOpenChange={(o) => {
            if (!o && !busy) setPending(null)
          }}
          title={t('reactivateDialog.title', { org: org.name })}
          description={t('reactivateDialog.description')}
          details={[
            t('reactivateDialog.detailClearAnchor'),
            t('reactivateDialog.detailRegrant', { count: fmt.num(students) }),
            t('reactivateDialog.detailLedger'),
          ]}
          confirmLabel={t('reactivateDialog.confirm')}
          cancelLabel={t('cancel')}
          destructive={false}
          loading={busy}
          onConfirm={() => void reactivate()}
        />
      )}

      {pending === 'regrant' && (
        <ConfirmDialog
          open
          onOpenChange={(o) => {
            if (!o && !busy) setPending(null)
          }}
          title={t('regrantDialog.title', { org: org.name })}
          description={t('regrantDialog.description')}
          details={[
            t('regrantDialog.detail', { count: fmt.num(students), plan: org.planCode || tOrg('noPlan') }),
            t('regrantDialog.detailNoStatus'),
          ]}
          confirmLabel={t('regrantDialog.confirm')}
          cancelLabel={t('cancel')}
          destructive={false}
          loading={busy}
          onConfirm={() => void regrant()}
        />
      )}
    </GaCard>
  )
}
