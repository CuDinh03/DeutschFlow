'use client'

import { Check } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { GaPageHdr, GaBtn } from '@/components/ui-v2'
import { RoleShell } from '../RoleShell'

// v1.0: PRO only (ULTRA deferred). Web self-serve payment (SePay "gói N ngày") ships in v1.1;
// until then the paid card shows a "coming soon" CTA. MoMo/Stripe removed per the locked billing
// decision (SePay is the VN channel; Stripe hidden; MoMo deferred).

// nameKey/periodKey/featureKeys resolve via t(); code/priceVnd/accent/highlight stay as logic values.
interface Plan {
  code: 'FREE' | 'PRO'
  nameKey: string
  priceVnd: number
  periodKey: string
  accent: string
  featureKeys: string[]
  highlight?: boolean
}

const PLANS: Plan[] = [
  {
    code: 'FREE',
    nameKey: 'planFreeName',
    priceVnd: 0,
    periodKey: 'planFreePeriod',
    accent: 'var(--ga-muted)',
    featureKeys: ['planFreeFeature1', 'planFreeFeature2', 'planFreeFeature3'],
  },
  {
    code: 'PRO',
    nameKey: 'planProName',
    priceVnd: 299000,
    periodKey: 'planProPeriod',
    accent: 'var(--ga-violet)',
    highlight: true,
    featureKeys: ['planProFeature1', 'planProFeature2', 'planProFeature3', 'planProFeature4'],
  },
]

function PaymentBody() {
  const t = useTranslations('v2.account.payment')
  const vnd = (n: number) => (n === 0 ? t('priceFree') : `${n.toLocaleString('vi-VN')}₫`)
  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr accent title={t('title')} subtitle={t('subtitle')} />
      <div className="flex-1 px-4 py-8 sm:px-6 lg:px-10">
        <div className="mx-auto grid max-w-3xl grid-cols-1 gap-6 lg:grid-cols-2">
          {PLANS.map((plan) => {
            const paid = plan.code !== 'FREE'
            return (
              <div
                key={plan.code}
                className="relative flex flex-col border bg-ga-card p-5 lg:p-7"
                style={{
                  borderColor: plan.highlight ? plan.accent : 'var(--ga-line)',
                  boxShadow: plan.highlight ? 'var(--ga-shadow-card-hover)' : undefined,
                }}
              >
                {plan.highlight && (
                  <span
                    className="ga-ui absolute -top-3 left-5 rounded-ga-pill px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-white lg:left-7"
                    style={{ background: plan.accent }}
                  >
                    {t('mostPopular')}
                  </span>
                )}
                <p className="font-ga-display text-[20px] font-medium text-ga-ink lg:text-[24px]">{t(plan.nameKey)}</p>
                <div className="mt-3 flex flex-wrap items-baseline gap-1.5">
                  <span className="font-ga-display text-[26px] font-medium sm:text-[30px] lg:text-[34px]" style={{ color: plan.accent }}>
                    {vnd(plan.priceVnd)}
                  </span>
                  <span className="ga-ui text-[13px] text-ga-muted">{t('perPeriod', { period: t(plan.periodKey) })}</span>
                </div>

                <ul className="my-6 flex-1 space-y-3">
                  {plan.featureKeys.map((fKey) => (
                    <li key={fKey} className="ga-ui flex items-start gap-2.5 text-[13.5px] text-ga-ink">
                      <Check size={16} className="mt-0.5 shrink-0" style={{ color: plan.accent }} aria-hidden />
                      {t(fKey)}
                    </li>
                  ))}
                </ul>

                {paid ? (
                  <div className="space-y-2.5">
                    <GaBtn variant="primary" className="w-full justify-center" disabled>
                      {t('comingSoon')}
                    </GaBtn>
                    <p className="ga-ui text-center text-[12px] text-ga-subtle">
                      {t('comingSoonNote')}
                    </p>
                  </div>
                ) : (
                  <div className="ga-ui rounded-ga border border-ga-line py-2.5 text-center text-[13px] font-semibold text-ga-muted">
                    {t('defaultPlan')}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function V2PaymentPage() {
  return (
    <RoleShell>
      <PaymentBody />
    </RoleShell>
  )
}
