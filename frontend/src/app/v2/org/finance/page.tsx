'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { apiMessage } from '@/lib/api'
import { getOrgSummary, listMyInvoices, type OrgSummary, type OrgInvoice } from '@/lib/orgApi'
import { GaPageHdr, TkStatStrip, ErrorBanner, LoadingState } from '@/components/ui-v2'
import { GaSection, GaBars, fmtVnd, nfVN } from '../../analyticsShared'

// Reuse getOrgSummary + listMyInvoices (same plumbing as billing) — finance framing:
// invoiced/outstanding aggregates + amount-by-period bars. No new endpoint.

const GREEN = '#1E9E61'
const financeAccent = {
  '--ga-accent': GREEN,
  '--ga-hdr-bg': 'rgba(30,158,97,0.07)',
  '--ga-hdr-line': 'rgba(30,158,97,0.20)',
} as React.CSSProperties
const fmtDate = (d: string | null | undefined) => (d ? format(new Date(d), 'dd/MM/yyyy') : '—')

const INV_STATUS: Record<string, { label: string; c: string }> = {
  PAID: { label: 'Đã thanh toán', c: 'var(--ga-green)' },
  SENT: { label: 'Chờ thanh toán', c: 'var(--ga-orange)' },
  DRAFT: { label: 'Nháp', c: 'var(--ga-muted)' },
  VOID: { label: 'Đã huỷ', c: 'var(--ga-muted)' },
}

export default function V2OrgFinancePage() {
  const [summary, setSummary] = useState<OrgSummary | null>(null)
  const [invoices, setInvoices] = useState<OrgInvoice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [sum, inv] = await Promise.all([getOrgSummary(), listMyInvoices().catch(() => [] as OrgInvoice[])])
      setSummary(sum)
      setInvoices(inv)
    } catch (e: unknown) {
      setError(apiMessage(e))
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { void load() }, [load])

  const paid = useMemo(() => invoices.filter((i) => (i.status ?? '').toUpperCase() === 'PAID'), [invoices])
  const sent = useMemo(() => invoices.filter((i) => (i.status ?? '').toUpperCase() === 'SENT'), [invoices])
  const totalPaid = paid.reduce((s, i) => s + i.amountVnd, 0)
  const totalOutstanding = sent.reduce((s, i) => s + i.amountVnd, 0)

  const issued = useMemo(
    () =>
      [...invoices]
        .filter((i) => !['DRAFT', 'VOID'].includes((i.status ?? '').toUpperCase()))
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [invoices],
  )
  const bars = issued.map((i) => ({ label: fmtDate(i.periodStart).slice(0, 5), value: i.amountVnd }))

  return (
    <div className="flex min-h-full flex-col" style={financeAccent}>
      <GaPageHdr accent title="Tài chính" subtitle="Tổng quan doanh thu, công nợ và hoá đơn của tổ chức" />
      <div className="flex-1 px-10 py-6">
        {error && (
          <div className="mb-5">
            <ErrorBanner message={error} onRetry={() => void load()} />
          </div>
        )}
        {loading ? (
          <LoadingState label="Đang tải tài chính…" />
        ) : (
          <div className="space-y-[22px]">
            <TkStatStrip
              items={[
                { label: 'Đã thanh toán', value: fmtVnd(totalPaid), sub: `${paid.length} hoá đơn`, color: GREEN },
                {
                  label: 'Đang chờ thu',
                  value: fmtVnd(totalOutstanding),
                  sub: `${sent.length} hoá đơn`,
                  color: totalOutstanding > 0 ? '#E07B39' : '#76716A',
                },
                { label: 'Tổng hoá đơn', value: nfVN.format(issued.length), color: '#2F6FC9' },
                { label: 'Ghế đã bán', value: summary ? nfVN.format(summary.seatUsed) : '—', sub: `/${summary?.seatLimit ?? 0} ghế`, color: '#7C56C8' },
              ]}
            />

            <GaSection title="Hoá đơn theo kỳ">
              {bars.length > 0 ? (
                <GaBars data={bars} color={GREEN} height={180} valueFmt={fmtVnd} />
              ) : (
                <p className="ga-ui py-10 text-center text-[14px] text-ga-muted">Chưa có hoá đơn đã xuất.</p>
              )}
            </GaSection>

            <GaSection title="Lịch sử hoá đơn" bodyClassName="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-ga-border">
                      {['Kỳ', 'Ngày xuất', 'Ghế', 'Số tiền', 'Trạng thái'].map((h, i) => (
                        <th
                          key={h}
                          className={`ga-ui px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-ga-muted ${
                            i >= 2 ? 'text-right' : ''
                          }`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {issued.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="ga-ui px-5 py-10 text-center text-[14px] text-ga-muted">
                          Chưa có hoá đơn.
                        </td>
                      </tr>
                    ) : (
                      [...issued].reverse().map((inv) => {
                        const st = INV_STATUS[(inv.status ?? '').toUpperCase()] ?? {
                          label: inv.status,
                          c: 'var(--ga-muted)',
                        }
                        return (
                          <tr key={inv.id} className="border-b border-ga-border last:border-0 hover:bg-ga-surface">
                            <td className="px-5 py-3 text-[13.5px] font-semibold text-ga-ink">
                              {fmtDate(inv.periodStart)} – {fmtDate(inv.periodEnd)}
                            </td>
                            <td className="px-5 py-3 text-[13px] text-ga-muted">{fmtDate(inv.createdAt)}</td>
                            <td className="px-5 py-3 text-right text-[13px] tabular-nums text-ga-muted">{inv.seats}</td>
                            <td className="px-5 py-3 text-right font-ga-display text-[14px] font-medium text-ga-ink">
                              {fmtVnd(inv.amountVnd)}
                            </td>
                            <td className="px-5 py-3 text-right">
                              <span className="ga-ui inline-flex items-center gap-1.5 text-[12.5px]" style={{ color: st.c }}>
                                <span className="h-1.5 w-1.5 rounded-full" style={{ background: st.c }} /> {st.label}
                              </span>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </GaSection>
          </div>
        )}
      </div>
    </div>
  )
}
