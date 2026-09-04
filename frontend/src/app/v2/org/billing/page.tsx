'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Banknote, Check, Copy } from 'lucide-react'
import { format } from 'date-fns'
import { apiMessage } from '@/lib/api'
import { getOrgSummary, getPaymentInfo, listMyInvoices, type OrgInvoice, type OrgSummary, type PaymentInfo } from '@/lib/orgApi'
import { seatMetaOf } from '@/lib/orgSeats'
import { GaPageHdr, GaBtn, GaCap, GaStatStrip } from '@/components/ui-v2'
import { OrgOwnerOnly } from '../OwnerOnly'

// ─────────────────────────────────────────────────────────────────────────────
// Gói DeutschFlow & thanh toán — Đợt 0 OWNER (F01/F02/F03/F05, báo cáo 31/08).
//   GÓC NHÌN NGƯỜI MUA: đây là khoản trung tâm TRẢ CHO DeutschFlow (license/ghế),
//   không phải doanh thu của trung tâm — trang "Tài chính" cũ đã gộp về đây.
//   - F02: lỗi tải hoá đơn là LỖI hiển thị rõ, không còn `.catch(() => [])` thành 0đ.
//   - F03: nút "Thanh toán" giả đã thay bằng hướng dẫn chuyển khoản THẬT
//     (GET /org/payment-info + paymentCode từng hoá đơn — SePay tự xác nhận).
//     Nút "Mua thêm ghế"/"Tải PDF" chưa có nghiệp vụ → GỠ, không toast "sắp ra mắt".
//   - F05: seatLimit=0 nghĩa là KHÔNG GIỚI HẠN (helper orgSeats); "đến hạn" đổi thành
//     "kỳ dịch vụ" vì OrgInvoice chưa có dueDate thật (O-2 sẽ thêm).
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

function CopyBtn({ text, copyLabel, copiedLabel }: { text: string; copyLabel: string; copiedLabel: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        } catch {
          // Clipboard bị chặn — giá trị vẫn hiển thị trên màn hình để chép tay.
        }
      }}
      className="ga-ui inline-flex items-center gap-1 border border-ga-line px-2 py-1 text-[11px] font-semibold text-ga-muted transition-colors hover:border-ga-accent hover:text-ga-accent"
    >
      {copied ? <Check size={12} style={{ color: 'var(--ga-green)' }} /> : <Copy size={12} />}
      {copied ? copiedLabel : copyLabel}
    </button>
  )
}

function V2OrgBillingInner() {
  const t = useTranslations('v2.org.billing')
  const tc = useTranslations('v2.common')
  const [summary, setSummary] = useState<OrgSummary | null>(null)
  const [invoices, setInvoices] = useState<OrgInvoice[]>([])
  const [payInfo, setPayInfo] = useState<PaymentInfo | null>(null)
  // F02: hướng dẫn thanh toán lỗi phải NÓI là lỗi — không âm thầm ẩn khối chuyển khoản.
  const [payInfoError, setPayInfoError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadPayInfo = useCallback(async () => {
    try {
      setPayInfo(await getPaymentInfo())
      setPayInfoError(false)
    } catch {
      setPayInfo(null)
      setPayInfoError(true)
    }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // F02: KHÔNG nuốt lỗi hoá đơn thành [] — thiếu dữ liệu tiền là lỗi toàn trang.
      const [sum, inv] = await Promise.all([getOrgSummary(), listMyInvoices()])
      setSummary(sum)
      setInvoices(inv)
      setError('')
      await loadPayInfo()
    } catch (e: unknown) {
      setError(apiMessage(e))
    } finally {
      setLoading(false)
    }
  }, [loadPayInfo])

  useEffect(() => { void load() }, [load])

  // null khi summary chưa về; JSX dùng seats chỉ render sau loading (summary chắc chắn có,
  // vì summary lỗi đã rẽ sang error panel) — nhưng vẫn null-safe để không lệ thuộc thứ tự render.
  const seats = seatMetaOf(summary)
  const issued = useMemo(
    () => [...invoices].filter((i) => !['DRAFT', 'VOID'].includes((i.status ?? '').toUpperCase())).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [invoices],
  )
  const paid = useMemo(() => issued.filter((i) => (i.status ?? '').toUpperCase() === 'PAID'), [issued])
  // "Cần thanh toán" = hoá đơn SENT (DeutschFlow đã phát hành, chờ trung tâm trả).
  const unpaid = useMemo(
    () =>
      issued
        .filter((i) => (i.status ?? '').toUpperCase() === 'SENT')
        .sort((a, b) => new Date(a.periodEnd ?? a.createdAt).getTime() - new Date(b.periodEnd ?? b.createdAt).getTime()),
    [issued],
  )
  const totalPaid = paid.reduce((s, i) => s + i.amountVnd, 0)
  const totalOwed = unpaid.reduce((s, i) => s + i.amountVnd, 0)
  const nextInvoice = unpaid[0] ?? null
  const payConfigured = !!payInfo?.bankAccount

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
            {/* F01: tổng hợp theo chiều NGƯỜI MUA — đã trả / cần trả cho DeutschFlow. */}
            <GaStatStrip
              items={[
                { label: t('stats.paidToDf'), value: vnd(totalPaid), sub: t('stats.invoiceCount', { count: paid.length }), tone: 'green' },
                { label: t('stats.owedToDf'), value: vnd(totalOwed), sub: t('stats.invoiceCount', { count: unpaid.length }), tone: totalOwed > 0 ? 'orange' : 'neutral', alert: totalOwed > 0 },
                { label: t('stats.seatsInUse'), value: summary ? summary.seatUsed.toLocaleString('vi-VN') : '—', sub: !seats ? '—' : seats.unlimited ? t('stats.seatsUnlimited') : t('stats.seatsOfLimit', { limit: summary?.seatLimit ?? 0 }), tone: 'violet' },
              ]}
            />

            <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
              {/* Current plan */}
              <div className="bg-ga-ink p-5 text-ga-bg lg:p-7">
                <GaCap className="mb-2.5 block" style={{ color: '#A39E94' }}>{t('currentPlanCap')}</GaCap>
                <div className="break-words font-ga-display text-[22px] font-medium sm:text-[26px] lg:text-[28px]">{summary?.planCode || t('noPlan')}</div>
                <p className="mb-[18px] mt-2 text-[14px]" style={{ color: '#A39E94' }}>
                  {seats?.unlimited ? t('planDescUnlimited') : t('planDescLimited', { seats: summary?.seatLimit ?? 0 })}
                </p>
                {/* F05: org không giới hạn KHÔNG vẽ thanh 0% sức chứa. */}
                {seats && !seats.unlimited && (
                  <>
                    <div className="mb-2 h-2 overflow-hidden bg-white/15"><div className="h-full" style={{ width: `${seats.pct ?? 0}%`, background: 'var(--ga-yellow)' }} /></div>
                    <div className="text-[13px]" style={{ color: '#A39E94' }}>{t('seatsUsedLimited', { used: summary?.seatUsed ?? 0, limit: summary?.seatLimit ?? 0, free: seats.free ?? 0 })}</div>
                  </>
                )}
                {seats?.unlimited && (
                  <div className="text-[13px]" style={{ color: '#A39E94' }}>{t('seatsUsedUnlimited', { used: summary?.seatUsed ?? 0 })}</div>
                )}
              </div>

              {/* Hoá đơn chờ thanh toán (SENT sớm nhất theo kỳ dịch vụ) */}
              <div className="flex flex-col border border-ga-line bg-ga-card p-5 lg:p-7">
                <GaCap className="mb-3.5 block">{t('nextInvoiceCap')}</GaCap>
                {nextInvoice ? (
                  <>
                    <div className="break-words font-ga-display text-[22px] font-medium text-ga-ink sm:text-[26px] lg:text-[32px]">{vnd(nextInvoice.amountVnd)}</div>
                    {/* F05: periodEnd là mốc KỲ DỊCH VỤ, không phải hạn trả tiền — không gọi là "đến hạn". */}
                    <div className="mb-auto mt-1.5 text-[13.5px] text-ga-muted">
                      {t('servicePeriodDesc', { from: fmtDate(nextInvoice.periodStart), to: fmtDate(nextInvoice.periodEnd), seats: nextInvoice.seats })}
                    </div>
                    <p className="ga-ui mt-4 text-[13px] text-ga-muted">{t('payBelowHint')}</p>
                  </>
                ) : (
                  <div className="flex flex-1 items-center justify-center text-center">
                    <p className="ga-ui text-[14px] text-ga-muted">{t('noNextInvoice')}</p>
                  </div>
                )}
              </div>
            </div>

            {/* F03: hướng dẫn chuyển khoản THẬT thay cho nút "Thanh toán (sắp ra mắt)". */}
            {unpaid.length > 0 && (
              <div className="mt-[26px] border border-ga-line bg-ga-card p-4 sm:p-6 lg:p-[26px]">
                <GaCap className="mb-3.5 flex items-center gap-2"><Banknote size={15} style={{ color: GREEN }} /> {t('payCap')}</GaCap>
                {payInfoError ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="ga-ui text-[13.5px] text-ga-red">{t('payInfoError')}</p>
                    <GaBtn variant="ghost" size="sm" onClick={() => void loadPayInfo()}>{tc('retry')}</GaBtn>
                  </div>
                ) : !payConfigured ? (
                  <p className="ga-ui text-[13.5px] text-ga-muted">{t('payNotConfigured')}</p>
                ) : (
                  <>
                    <p className="ga-ui mb-4 text-[13.5px] text-ga-muted">{t('payIntro')}</p>
                    <div className="mb-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                      {[
                        { label: t('bankName'), value: payInfo?.bankName ?? '', copyable: false },
                        { label: t('bankAccount'), value: payInfo?.bankAccount ?? '', copyable: true },
                        { label: t('accountName'), value: payInfo?.accountName ?? '', copyable: false },
                      ].map((f) => (
                        <div key={f.label} className="border border-ga-line bg-ga-bg px-3 py-2">
                          <GaCap className="block text-[9.5px]">{f.label}</GaCap>
                          <div className="mt-1 flex items-center gap-2">
                            <span className="min-w-0 break-words text-[14px] font-semibold text-ga-ink">{f.value || '—'}</span>
                            {f.copyable && f.value && <CopyBtn text={f.value} copyLabel={t('copy')} copiedLabel={t('copied')} />}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-col gap-2">
                      {unpaid.map((inv) => (
                        <div key={inv.id} className="flex flex-wrap items-center justify-between gap-3 border border-ga-line bg-ga-bg px-4 py-3">
                          <div className="min-w-0">
                            <p className="text-[12px] text-ga-muted">{fmtDate(inv.periodStart)} – {fmtDate(inv.periodEnd)} · {t('seatCount', { count: inv.seats })}</p>
                            <p className="mt-0.5 text-[13.5px] text-ga-ink">
                              {t('transferContent')}: <span className="font-mono font-bold" style={{ color: GREEN }}>{inv.paymentCode || '—'}</span>
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-3">
                            <span className="font-ga-display text-[15px] font-medium text-ga-ink">{vnd(inv.amountVnd)}</span>
                            {inv.paymentCode && <CopyBtn text={inv.paymentCode} copyLabel={t('copy')} copiedLabel={t('copied')} />}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

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

// Gói & thanh toán = OWNER-only (giám đốc). MANAGER (nhân sự) bị guard chặn → /v2/org.
export default function V2OrgBillingPage() {
  return (
    <OrgOwnerOnly>
      <V2OrgBillingInner />
    </OrgOwnerOnly>
  )
}
