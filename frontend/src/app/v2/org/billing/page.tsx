'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, CreditCard, FileDown } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { apiMessage } from '@/lib/api'
import { getOrgSummary, listMyInvoices, type OrgSummary, type OrgInvoice } from '@/lib/orgApi'
import { GaPageHdr, GaBtn, GaCap } from '@/components/ui-v2'
import { OrgOwnerOnly } from '../OwnerOnly'

// ─────────────────────────────────────────────────────────────────────────────
// Gói & Thanh toán (GaOrgBilling) — green accent. Plumbing reused 1:1 (zero backend):
//   getOrgSummary (plan + seats) + listMyInvoices (history + next-due).
// Option-1: no buy-seats / pay / PDF endpoints → those actions toast. "Hoá đơn kế tiếp"
//   = the latest unpaid (SENT) invoice; history = issued invoices.
// ─────────────────────────────────────────────────────────────────────────────

const GREEN = '#1E9E61'
const billingAccent = {
  '--ga-accent': GREEN,
  '--ga-hdr-bg': 'rgba(30,158,97,0.07)',
  '--ga-hdr-line': 'rgba(30,158,97,0.20)',
} as React.CSSProperties
const fmtDate = (d: string | null | undefined) => (d ? format(new Date(d), 'dd/MM/yyyy') : '—')
const vnd = (n: number) => `${Math.round(n).toLocaleString('vi-VN')}₫`
// Invoice status → color + catalog key for the label (resolved via t('status.<key>')).
const INV_STATUS: Record<string, { key: 'paid' | 'sent' | 'draft' | 'void'; c: string }> = {
  PAID: { key: 'paid', c: 'var(--ga-green)' },
  SENT: { key: 'sent', c: 'var(--ga-orange)' },
  DRAFT: { key: 'draft', c: 'var(--ga-muted)' },
  VOID: { key: 'void', c: 'var(--ga-muted)' },
}

function V2OrgBillingInner() {
  const t = useTranslations('v2.org.billing')
  const tc = useTranslations('v2.common')
  const [summary, setSummary] = useState<OrgSummary | null>(null)
  const [invoices, setInvoices] = useState<OrgInvoice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [sum, inv] = await Promise.all([getOrgSummary(), listMyInvoices().catch(() => [] as OrgInvoice[])])
      setSummary(sum)
      setInvoices(inv)
      setError('')
    } catch (e: unknown) {
      setError(apiMessage(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const seatPct = summary && summary.seatLimit > 0 ? Math.round((summary.seatUsed / summary.seatLimit) * 100) : 0
  const freeSeats = summary ? Math.max(0, summary.seatLimit - summary.seatUsed) : 0
  const issued = useMemo(
    () => [...invoices].filter((i) => !['DRAFT', 'VOID'].includes((i.status ?? '').toUpperCase())).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [invoices],
  )
  const nextDue = invoices.find((i) => (i.status ?? '').toUpperCase() === 'SENT') ?? null

  if (error) {
    return (
      <div className="flex min-h-full flex-col" style={billingAccent}>
        <GaPageHdr accent title={t('title')} subtitle={t('subtitle')} />
        <div className="flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
          <div className="border border-ga-line bg-ga-card px-4 py-8 sm:px-8 lg:px-10 lg:py-[52px] text-center">
            <h2 className="font-ga-display text-[20px] font-medium text-ga-red lg:text-[24px]">{t('loadError')}</h2>
            <p className="ga-ui mx-auto mb-5 mt-3 max-w-sm break-words text-[14px] text-ga-muted">{error}</p>
            <GaBtn variant="primary" onClick={load}>{tc('retry')}</GaBtn>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-full flex-col" style={billingAccent}>
      <GaPageHdr accent title={t('title')} subtitle={t('subtitle')} />

      <div className="flex-1 overflow-auto px-4 py-5 sm:px-6 lg:px-10 lg:py-7">
        {loading ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2"><div className="ga-shimmer h-[190px]" aria-hidden /><div className="ga-shimmer h-[190px]" aria-hidden /></div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {/* Current plan */}
              <div className="bg-ga-ink p-5 text-ga-bg lg:p-7">
                <GaCap className="mb-2.5 block" style={{ color: '#A39E94' }}>{t('currentPlanCap')}</GaCap>
                <div className="break-words font-ga-display text-[22px] font-medium sm:text-[26px] lg:text-[28px]">{summary?.planCode || t('noPlan')}</div>
                <p className="mb-[18px] mt-2 text-[14px]" style={{ color: '#A39E94' }}>
                  {t('planDesc', { seats: summary?.seatLimit ?? 0 })}
                </p>
                <div className="mb-2 h-2 overflow-hidden bg-white/15"><div className="h-full" style={{ width: `${Math.min(100, seatPct)}%`, background: 'var(--ga-yellow)' }} /></div>
                <div className="text-[13px]" style={{ color: '#A39E94' }}>{t('seatsUsedDesc', { used: summary?.seatUsed ?? 0, limit: summary?.seatLimit ?? 0, free: freeSeats })}</div>
                <GaBtn variant="yellow" size="sm" className="mt-[18px]" onClick={() => toast(t('buySeatsSoon'))}><Plus size={14} /> {t('buySeats')}</GaBtn>
              </div>

              {/* Next invoice */}
              <div className="flex flex-col border border-ga-line bg-ga-card p-5 lg:p-7">
                <GaCap className="mb-3.5 block">{t('nextInvoiceCap')}</GaCap>
                {nextDue ? (
                  <>
                    <div className="break-words font-ga-display text-[22px] font-medium text-ga-ink sm:text-[26px] lg:text-[32px]">{vnd(nextDue.amountVnd)}</div>
                    <div className="mb-auto mt-1.5 text-[13.5px] text-ga-muted">{t('dueDesc', { date: fmtDate(nextDue.periodEnd), seats: nextDue.seats })}</div>
                    <div className="mt-4 flex flex-wrap gap-2.5">
                      <GaBtn variant="yellow" size="sm" onClick={() => toast(t('paySoon'))}><CreditCard size={14} /> {t('pay')}</GaBtn>
                      <GaBtn variant="ghost" size="sm" onClick={() => toast(t('downloadSoon'))}><FileDown size={14} /> {t('downloadInvoice')}</GaBtn>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-1 items-center justify-center text-center">
                    <p className="ga-ui text-[14px] text-ga-muted">{t('noNextInvoice')}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Invoice history */}
            <div className="mt-[26px] border border-ga-line bg-ga-card p-4 sm:p-6 lg:p-[26px]">
              <GaCap className="mb-4 block">{t('invoiceHistoryCap', { count: issued.length })}</GaCap>
              {issued.length === 0 ? (
                <p className="py-6 text-center text-[13px] text-ga-muted">{t('noIssued')}</p>
              ) : (
                <div className="overflow-x-auto lg:overflow-visible">
                  <div className="grid min-w-[640px] gap-2 border-b border-ga-line pb-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-ga-muted lg:min-w-0" style={{ gridTemplateColumns: '1.4fr 1fr 1fr 140px' }}>
                    <span>{t('colPeriod')}</span><span>{t('colIssued')}</span><span>{t('colAmount')}</span><span className="text-right">{t('colStatus')}</span>
                  </div>
                  {issued.map((inv) => {
                    const st = INV_STATUS[(inv.status ?? '').toUpperCase()]
                    const stLabel = st ? t(`status.${st.key}`) : inv.status
                    const stColor = st ? st.c : 'var(--ga-muted)'
                    return (
                      <div key={inv.id} className="grid min-w-[640px] items-center gap-2 border-t border-ga-line py-3 text-[14px] lg:min-w-0" style={{ gridTemplateColumns: '1.4fr 1fr 1fr 140px' }}>
                        <span className="font-semibold text-ga-ink">{fmtDate(inv.periodStart)} – {fmtDate(inv.periodEnd)}</span>
                        <span className="text-ga-muted">{fmtDate(inv.createdAt)}</span>
                        <span className="font-ga-display font-medium text-ga-ink">{vnd(inv.amountVnd)}</span>
                        <span className="flex items-center justify-end gap-1.5 text-[12.5px]" style={{ color: stColor }}>
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: stColor }} /> {stLabel}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// Gói & Giấy phép = OWNER-only (giám đốc). MANAGER (nhân sự) bị guard chặn → /v2/org.
export default function V2OrgBillingPage() {
  return (
    <OrgOwnerOnly>
      <V2OrgBillingInner />
    </OrgOwnerOnly>
  )
}
