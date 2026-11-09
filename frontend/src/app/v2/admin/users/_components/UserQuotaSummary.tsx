'use client'

import type { ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { GaCap, TkBadge } from '@/components/ui-v2'
import { useFmt } from '@/lib/i18n/useFmt'
import type { QuotaDetail } from '@/lib/adminUsersApi'

/** Ánh xạ quotaKind của backend sang khoá i18n. */
export function quotaKindKey(k: string | undefined): string {
  switch (k) {
    case 'WALLET':
      return 'quotaKind.wallet'
    case 'FREE_DAY':
      return 'quotaKind.freeDay'
    case 'INTERNAL_UNLIMITED':
      return 'quotaKind.internalUnlimited'
    default:
      return 'quotaKind.none'
  }
}

/** Hạn mức AI hiện tại của một người (GET /admin/users/{id}/quota). Tách từ UserDetailModal 09/11/2026. */
export function UserQuotaSummary({ quota }: { quota: QuotaDetail | null }) {
  const t = useTranslations('v2.adminOps.users.detail')
  const fmt = useFmt()

  const stat = (label: string, value: ReactNode) => (
    <div>
      <GaCap>{label}</GaCap>
      <p className="mt-1 font-semibold tabular-nums text-ga-ink">{value}</p>
    </div>
  )

  return (
    <section className="space-y-4" data-testid="user-quota-summary">
      <div className="flex items-center gap-2">
        <GaCap>{t('quotaCap')}</GaCap>
        {quota?.unlimitedInternal && <TkBadge tone="green">{t('unlimited')}</TkBadge>}
      </div>
      {quota ? (
        <>
          <p className="ga-ui text-ga-small text-ga-muted">{t(quotaKindKey(quota.quotaKind))}</p>
          <div className="grid grid-cols-2 gap-4 text-ga-small">
            {stat(t('stat.ledger30'), fmt.num(quota.usageLast30Days))}
            {stat(t('stat.today'), fmt.num(quota.usedToday ?? quota.usedThisMonth))}
            {stat(
              t('stat.remainingSpendable'),
              quota.unlimitedInternal ? '—' : fmt.num(quota.remainingSpendable ?? quota.remainingThisMonth),
            )}
            {stat(t('stat.walletCap'), fmt.num(quota.walletCap))}
            {stat(t('stat.dailyGrant'), fmt.num(quota.dailyTokenGrant))}
            {stat(t('stat.walletBalance'), fmt.num(quota.walletBalance))}
          </div>
        </>
      ) : (
        <p className="ga-ui text-ga-small italic text-ga-muted">{t('noQuotaSnapshot')}</p>
      )}
    </section>
  )
}
