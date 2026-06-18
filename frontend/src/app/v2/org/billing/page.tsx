'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, CreditCard, FileDown } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { apiMessage } from '@/lib/api'
import { getOrgSummary, listMyInvoices, type OrgSummary, type OrgInvoice } from '@/lib/orgApi'
import { GaPageHdr, GaBtn, GaCap } from '@/components/ui-v2'

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
const INV_STATUS: Record<string, { label: string; c: string }> = {
  PAID: { label: 'Đã thanh toán', c: 'var(--ga-green)' },
  SENT: { label: 'Chờ thanh toán', c: 'var(--ga-orange)' },
  DRAFT: { label: 'Nháp', c: 'var(--ga-muted)' },
  VOID: { label: 'Đã huỷ', c: 'var(--ga-muted)' },
}

export default function V2OrgBillingPage() {
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
        <GaPageHdr accent title="Gói & Thanh toán" subtitle="Quản lý ghế, gói B2B và hoá đơn của tổ chức" />
        <div className="flex-1 px-10 py-10">
          <div className="border border-ga-line bg-ga-card px-10 py-[52px] text-center">
            <h2 className="font-ga-display text-[24px] font-medium text-ga-red">Không tải được thông tin gói</h2>
            <p className="ga-ui mx-auto mb-5 mt-3 max-w-sm text-[14px] text-ga-muted">{error}</p>
            <GaBtn variant="primary" onClick={load}>Thử lại</GaBtn>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-full flex-col" style={billingAccent}>
      <GaPageHdr accent title="Gói & Thanh toán" subtitle="Quản lý ghế, gói B2B và hoá đơn của tổ chức" />

      <div className="flex-1 overflow-auto px-10 py-7">
        {loading ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2"><div className="ga-shimmer h-[190px]" aria-hidden /><div className="ga-shimmer h-[190px]" aria-hidden /></div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {/* Current plan */}
              <div className="bg-ga-ink p-7 text-ga-bg">
                <GaCap className="mb-2.5 block" style={{ color: '#A39E94' }}>Gói hiện tại</GaCap>
                <div className="font-ga-display text-[28px] font-medium">{summary?.planCode || 'Chưa có gói'}</div>
                <p className="mb-[18px] mt-2 text-[14px]" style={{ color: '#A39E94' }}>
                  {summary?.seatLimit ?? 0} ghế · token cho mỗi học viên · hỗ trợ ưu tiên
                </p>
                <div className="mb-2 h-2 overflow-hidden bg-white/15"><div className="h-full" style={{ width: `${Math.min(100, seatPct)}%`, background: 'var(--ga-yellow)' }} /></div>
                <div className="text-[13px]" style={{ color: '#A39E94' }}>{summary?.seatUsed ?? 0}/{summary?.seatLimit ?? 0} ghế đã dùng · còn {freeSeats} ghế trống</div>
                <GaBtn variant="yellow" size="sm" className="mt-[18px]" onClick={() => toast('Mua thêm ghế (sắp ra mắt)')}><Plus size={14} /> Mua thêm ghế</GaBtn>
              </div>

              {/* Next invoice */}
              <div className="flex flex-col border border-ga-line bg-ga-card p-7">
                <GaCap className="mb-3.5 block">Hoá đơn kế tiếp</GaCap>
                {nextDue ? (
                  <>
                    <div className="font-ga-display text-[32px] font-medium text-ga-ink">{vnd(nextDue.amountVnd)}</div>
                    <div className="mb-auto mt-1.5 text-[13.5px] text-ga-muted">Đến hạn {fmtDate(nextDue.periodEnd)} · {nextDue.seats} ghế</div>
                    <div className="mt-4 flex gap-2.5">
                      <GaBtn variant="yellow" size="sm" onClick={() => toast('Chuyển tới cổng thanh toán (sắp ra mắt)')}><CreditCard size={14} /> Thanh toán</GaBtn>
                      <GaBtn variant="ghost" size="sm" onClick={() => toast('Tải hoá đơn PDF (sắp ra mắt)')}><FileDown size={14} /> Tải hoá đơn</GaBtn>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-1 items-center justify-center text-center">
                    <p className="ga-ui text-[14px] text-ga-muted">Không có hoá đơn nào đang chờ thanh toán 🎉</p>
                  </div>
                )}
              </div>
            </div>

            {/* Invoice history */}
            <div className="mt-[26px] border border-ga-line bg-ga-card p-[26px]">
              <GaCap className="mb-4 block">Lịch sử hoá đơn ({issued.length})</GaCap>
              {issued.length === 0 ? (
                <p className="py-6 text-center text-[13px] text-ga-muted">Chưa có hoá đơn đã xuất.</p>
              ) : (
                <div>
                  <div className="grid gap-2 border-b border-ga-line pb-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-ga-muted" style={{ gridTemplateColumns: '1.4fr 1fr 1fr 140px' }}>
                    <span>Kỳ</span><span>Ngày xuất</span><span>Số tiền</span><span className="text-right">Trạng thái</span>
                  </div>
                  {issued.map((inv) => {
                    const st = INV_STATUS[(inv.status ?? '').toUpperCase()] ?? { label: inv.status, c: 'var(--ga-muted)' }
                    return (
                      <div key={inv.id} className="grid items-center gap-2 border-t border-ga-line py-3 text-[14px]" style={{ gridTemplateColumns: '1.4fr 1fr 1fr 140px' }}>
                        <span className="font-semibold text-ga-ink">{fmtDate(inv.periodStart)} – {fmtDate(inv.periodEnd)}</span>
                        <span className="text-ga-muted">{fmtDate(inv.createdAt)}</span>
                        <span className="font-ga-display font-medium text-ga-ink">{vnd(inv.amountVnd)}</span>
                        <span className="flex items-center justify-end gap-1.5 text-[12.5px]" style={{ color: st.c }}>
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: st.c }} /> {st.label}
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
