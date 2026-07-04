'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, ShieldCheck, Lock, Bell, FileDown, Sparkles } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { apiMessage } from '@/lib/api'
import useAdminData from '@/hooks/useAdminData'
import {
  listOrganizations,
  listOrgInvoices,
  activateEntitlements,
  type AdminOrg,
  type OrgInvoice,
} from '@/lib/adminOrgApi'
import { GaPageHdr, GaBtn, GaCap, AdStatStrip, DataTable, TkModal, type DataTableColumn } from '@/components/ui-v2'
import { CreateOrgModal } from './CreateOrgModal'

const fmtDate = (d: string | null | undefined) => (d ? format(new Date(d), 'dd/MM/yyyy') : '—')

// ── Violet header accent (orgs screen overrides the admin-navy chrome) ────────
const VIOLET = '#7C56C8'
const orgsAccentVars = {
  '--ga-accent': VIOLET,
  '--ga-hdr-bg': 'rgba(124,86,200,0.07)',
  '--ga-hdr-line': 'rgba(124,86,200,0.20)',
} as React.CSSProperties

// ── Finance rollup (from existing per-org invoices — no new endpoint) ─────────
// "Đã xuất HĐ" = issued (SENT + PAID); DRAFT not issued, VOID cancelled → excluded.
// Overdue = a SENT invoice whose period_end is already in the past (real field).
type OrgPay = 'paid' | 'pending' | 'overdue' | 'none'
interface OrgFinance {
  totalInvoiced: number
  outstanding: number
  invoiceCount: number
  pay: OrgPay
}
interface OrgRow {
  org: AdminOrg
  finance: OrgFinance
  invoices: OrgInvoice[]
}

function rollup(invoices: OrgInvoice[]): OrgFinance {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  let totalInvoiced = 0
  let outstanding = 0
  let invoiceCount = 0
  let paidCount = 0
  let hasOverdue = false
  for (const inv of invoices) {
    const st = (inv.status ?? '').toUpperCase()
    if (st === 'DRAFT' || st === 'VOID') continue // not issued / cancelled
    const amt = Number(inv.amountVnd) || 0
    totalInvoiced += amt
    invoiceCount += 1
    if (st === 'SENT') {
      outstanding += amt
      const due = inv.periodEnd ? new Date(inv.periodEnd) : null
      if (due && !Number.isNaN(due.getTime()) && due < today) hasOverdue = true
    } else if (st === 'PAID') {
      paidCount += 1
    }
  }
  const pay: OrgPay = hasOverdue
    ? 'overdue'
    : outstanding > 0
      ? 'pending'
      : paidCount > 0
        ? 'paid'
        : 'none'
  return { totalInvoiced, outstanding, invoiceCount, pay }
}

// ── VND formatting (compact tr₫ for headline, full ₫ for the debt sub) ────────
function vndCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.', ',')}tr₫`
  if (n <= 0) return '0₫'
  return `${n.toLocaleString('vi-VN')}₫`
}
function vndFull(n: number): string {
  return `${Math.round(n).toLocaleString('vi-VN')}₫`
}

// Enum → catalog-key maps (labels resolved via t('status.<KEY>') / t('pay.<key>')).
const STATUS_KEYS = ['ACTIVE', 'SUSPENDED', 'PENDING'] as const
const PAY_TONE: Record<OrgPay, { c: string; s: string }> = {
  paid: { c: 'var(--ga-green)', s: 'var(--ga-green-soft)' },
  pending: { c: 'var(--ga-orange)', s: 'var(--ga-orange-soft)' },
  overdue: { c: 'var(--ga-red)', s: 'var(--ga-red-soft)' },
  none: { c: 'var(--ga-muted)', s: 'var(--ga-side-active)' },
}

export default function V2AdminOrgsPage() {
  const t = useTranslations('v2.adminOps.organizations')
  const [activating, setActivating] = useState<number | null>(null)
  const [detail, setDetail] = useState<OrgRow | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const { data, loading, error, reload } = useAdminData<OrgRow[]>({
    initialData: [],
    errorMessage: t('loadError'),
    fetchData: async () => {
      const page = await listOrganizations(0, 200)
      const orgs = page.content ?? []
      // N+1 invoice rollup (parallel). OK at current org count; replace with a
      // finance-aggregate list endpoint when orgs grow (see backlog).
      return Promise.all(
        orgs.map(async (org) => {
          let invoices: OrgInvoice[] = []
          try {
            invoices = await listOrgInvoices(org.id)
          } catch {
            invoices = []
          }
          return { org, finance: rollup(invoices), invoices }
        }),
      )
    },
  })

  const stats = useMemo(() => {
    let revenue = 0
    let seats = 0
    let unpaid = 0
    let pending = 0
    for (const { org, finance } of data) {
      revenue += finance.totalInvoiced
      seats += org.seatLimit ?? 0
      if (finance.outstanding > 0) unpaid += 1
      if ((org.status ?? '').toUpperCase() === 'PENDING') pending += 1
    }
    return { revenue, seats, unpaid, pending, count: data.length }
  }, [data])

  const doActivate = async (id: number) => {
    setActivating(id)
    try {
      const granted = await activateEntitlements(id)
      toast.success(t('activated', { count: granted }))
      await reload({ silent: true })
    } catch (e: unknown) {
      toast.error(apiMessage(e))
    } finally {
      setActivating(null)
    }
  }

  const statusLabel = (status: string | null | undefined): string => {
    const key = (status ?? '').toUpperCase()
    return (STATUS_KEYS as readonly string[]).includes(key) ? t(`status.${key}`) : (status ?? '')
  }

  const columns: DataTableColumn<OrgRow>[] = [
    {
      key: 'org',
      header: t('col.org'),
      render: ({ org }) => (
        <div className="flex items-center gap-3.5">
          <span
            className="grid h-10 w-10 shrink-0 place-items-center font-ga-display text-[18px] font-semibold"
            style={{ background: 'var(--ga-violet-soft)', color: 'var(--ga-violet)' }}
          >
            {(org.name?.[0] ?? 'T').toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="text-[15px] font-bold leading-[1.25] text-ga-ink">{org.name}</p>
            <p className="mt-0.5 text-[12.5px] text-ga-muted">
              {org.planCode || t('noPlan')} · {t('studentsSuffix', { count: Number(org.studentCount ?? 0).toLocaleString('vi-VN') })}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'seats',
      header: t('col.seats'),
      className: 'w-[120px]',
      render: ({ org }) => (
        <p className="font-ga-display text-[18px] font-medium text-ga-ink">
          {Number(org.seatLimit ?? 0).toLocaleString('vi-VN')}{' '}
          <span className="ga-ui text-[12.5px] text-ga-muted">{t('seatsUnit')}</span>
        </p>
      ),
    },
    {
      key: 'revenue',
      header: t('col.revenue'),
      className: 'w-[180px]',
      render: ({ finance }) => (
        <div>
          <p className="text-[14px] font-semibold text-ga-ink">{vndCompact(finance.totalInvoiced)}</p>
          <p className="mt-0.5 text-[11.5px] text-ga-muted">
            {t('issuedInvoices')}
            {finance.outstanding > 0 && (
              <span style={{ color: 'var(--ga-red)' }}>{t('debtSuffix', { amount: vndFull(finance.outstanding) })}</span>
            )}
          </p>
        </div>
      ),
    },
    {
      key: 'pay',
      header: t('col.pay'),
      className: 'w-[150px]',
      render: ({ finance, org }) => {
        const tone = PAY_TONE[finance.pay]
        return (
          <div>
            <span
              className="inline-flex items-center gap-1.5 px-[9px] py-[5px] text-[11px] font-bold"
              style={{ color: tone.c, background: tone.s }}
            >
              <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: tone.c }} />
              {t(`pay.${finance.pay}`)}
            </span>
            <p className="mt-[5px] text-[11px] text-ga-muted">{t('renewOn', { date: fmtDate(org.validUntil) })}</p>
          </div>
        )
      },
    },
    {
      key: 'action',
      header: '',
      align: 'right',
      className: 'w-[170px]',
      render: (row) => {
        const { org } = row
        const isPending = (org.status ?? '').toUpperCase() === 'PENDING'
        return (
          <div className="flex flex-col items-end gap-1.5" onClick={(e) => e.stopPropagation()}>
            {isPending ? (
              <button
                type="button"
                disabled={activating === org.id}
                onClick={() => doActivate(org.id)}
                className="rounded-ga bg-ga-yellow px-3 py-2 text-[11.5px] font-bold text-ga-ink transition-opacity disabled:opacity-60"
              >
                {activating === org.id ? t('activating') : t('activate')}
              </button>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[12px]" style={{ color: 'var(--ga-green)' }}>
                <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: 'var(--ga-green)' }} />
                {statusLabel(org.status)}
              </span>
            )}
            <button
              type="button"
              onClick={() => setDetail(row)}
              className="rounded-ga border border-ga-line px-[10px] py-[6px] text-[11px] font-semibold text-ga-muted transition-colors hover:border-ga-accent hover:text-ga-accent"
            >
              {t('viewFinance')}
            </button>
          </div>
        )
      },
    },
  ]

  return (
    <div className="flex min-h-full flex-col" style={orgsAccentVars}>
      <GaPageHdr
        accent
        title={t('title')}
        subtitle={t('subtitle')}
        right={
          <GaBtn variant="ghost" onClick={() => setShowCreate(true)}>
            <Plus size={15} aria-hidden />
            {t('addOrg')}
          </GaBtn>
        }
      />

      <div className="flex-1 px-10 py-6">
        {/* Privacy notice — platform admin sees finance only */}
        <div
          className="mb-[22px] flex items-center gap-3 border px-[18px] py-[13px]"
          style={{ background: 'var(--ga-navy-soft)', borderColor: 'rgba(39,64,107,0.20)' }}
        >
          <ShieldCheck size={20} aria-hidden style={{ color: 'var(--ga-navy)', flexShrink: 0 }} />
          <p className="text-[13.5px] leading-[1.5] text-ga-ink">
            {t.rich('privacyNotice', { strong: (chunks) => <strong>{chunks}</strong> })}
          </p>
        </div>

        <AdStatStrip
          className="mb-6"
          cells={[
            { label: t('stats.issuedRevenue'), value: vndCompact(stats.revenue), color: '#1E9E61', sub: t('stats.issuedRevenueSub') },
            {
              label: t('stats.totalSeats'),
              value: stats.seats.toLocaleString('vi-VN'),
              color: '#7C56C8',
              sub: t('stats.totalSeatsSub', { count: stats.count }),
            },
            {
              label: t('stats.unpaidInvoices'),
              value: stats.unpaid,
              color: '#E07B39',
              sub: t('stats.unpaidInvoicesSub'),
              alert: stats.unpaid > 0,
            },
            { label: t('stats.pendingActivation'), value: stats.pending, color: '#2F6FC9', alert: stats.pending > 0 },
          ]}
        />

        <DataTable
          columns={columns}
          data={data}
          rowKey={({ org }) => org.id}
          loading={loading}
          error={error || null}
          onRetry={() => reload({ silent: false })}
          errorEndpoint="GET /api/admin/organizations"
          itemNoun={t('col.org')}
          pageSize={0}
          empty={
            <div className="px-10 py-7 text-center">
              <p className="ga-ui text-[14.5px] text-ga-muted">{t('emptyOrgs')}</p>
            </div>
          }
        />
      </div>

      <OrgFinanceModal row={detail} onClose={() => setDetail(null)} />

      {showCreate && (
        <CreateOrgModal onClose={() => setShowCreate(false)} onCreated={() => reload({ silent: true })} />
      )}
    </div>
  )
}

// ── Financial-detail modal (admin sees finance only; learning data is locked) ─
// Invoice status enum → catalog key + tone (label via t('modal.invStatus.<key>')).
const INV_STATUS: Record<string, { labelKey: 'paid' | 'sent' | 'draft' | 'void'; tone: OrgPay }> = {
  PAID: { labelKey: 'paid', tone: 'paid' },
  SENT: { labelKey: 'sent', tone: 'pending' },
  DRAFT: { labelKey: 'draft', tone: 'none' },
  VOID: { labelKey: 'void', tone: 'none' },
}
const LOCKED_FIELD_KEYS = ['students', 'classes', 'scores', 'progress'] as const

function OrgFinanceModal({ row, onClose }: { row: OrgRow | null; onClose: () => void }) {
  const t = useTranslations('v2.adminOps.organizations')
  if (!row) return null
  const { org, finance, invoices } = row
  const issued = [...invoices]
    .filter((i) => !['DRAFT', 'VOID'].includes((i.status ?? '').toUpperCase()))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const facts: [string, React.ReactNode][] = [
    [t('modal.facts.plan'), org.planCode || t('noPlan')],
    [t('modal.facts.seats'), `${(org.seatUsed ?? 0).toLocaleString('vi-VN')}/${(org.seatLimit ?? 0).toLocaleString('vi-VN')}`],
    [t('modal.facts.issuedRevenue'), vndCompact(finance.totalInvoiced)],
    [t('modal.facts.debt'), finance.outstanding > 0 ? vndFull(finance.outstanding) : '—'],
    [t('modal.facts.payMethod'), t(`pay.${finance.pay}`)],
    [t('modal.facts.renewUntil'), fmtDate(org.validUntil)],
  ]

  return (
    <TkModal open={!!row} onOpenChange={(o) => !o && onClose()} title={org.name} description={t('modal.description')} size="lg">
      <div className="flex flex-col gap-5">
        {/* Privacy banner */}
        <div className="flex items-center gap-2.5 border px-4 py-2.5" style={{ background: 'var(--ga-navy-soft)', borderColor: 'rgba(39,64,107,0.20)' }}>
          <ShieldCheck size={17} style={{ color: 'var(--ga-navy)' }} className="shrink-0" />
          <p className="ga-ui m-0 text-[12.5px] leading-[1.5] text-ga-ink">{t('modal.privacyBanner')}</p>
        </div>

        {/* Contract facts grid */}
        <div>
          <GaCap className="mb-2.5 block">{t('modal.contractInfo')}</GaCap>
          <div className="grid grid-cols-2 gap-px border border-ga-line bg-ga-line sm:grid-cols-3">
            {facts.map(([k, v]) => (
              <div key={k} className="bg-ga-card px-3.5 py-3">
                <div className="ga-ui text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ga-subtle">{k}</div>
                <div className="mt-1 text-[14px] font-semibold text-ga-ink">{v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Invoice history */}
        <div>
          <GaCap className="mb-2.5 block">{t('modal.invoiceHistory', { count: issued.length })}</GaCap>
          {issued.length === 0 ? (
            <div className="border border-dashed border-ga-line px-4 py-6 text-center text-[13px] text-ga-muted">{t('modal.noIssued')}</div>
          ) : (
            <div className="border border-ga-line">
              <div className="grid grid-cols-[1fr_64px_110px_92px] gap-2 border-b border-ga-line bg-ga-bg px-3.5 py-2 text-[10px] font-bold uppercase tracking-[0.08em] text-ga-muted">
                <span>{t('modal.colPeriod')}</span><span className="text-right">{t('modal.colSeats')}</span><span className="text-right">{t('modal.colAmount')}</span><span className="text-right">{t('modal.colStatus')}</span>
              </div>
              {issued.map((inv, i) => {
                const st = INV_STATUS[(inv.status ?? '').toUpperCase()]
                const stLabel = st ? t(`modal.invStatus.${st.labelKey}`) : inv.status
                const tone = PAY_TONE[st?.tone ?? 'none']
                return (
                  <div key={inv.id} className="grid grid-cols-[1fr_64px_110px_92px] items-center gap-2 px-3.5 py-2.5 text-[12.5px]" style={{ borderTop: i ? '1px solid var(--ga-line)' : 'none' }}>
                    <span className="text-ga-ink">{fmtDate(inv.periodStart)} – {fmtDate(inv.periodEnd)}</span>
                    <span className="text-right text-ga-muted">{inv.seats}</span>
                    <span className="text-right font-semibold text-ga-ink">{vndFull(inv.amountVnd)}</span>
                    <span className="text-right">
                      <span className="px-1.5 py-0.5 text-[10.5px] font-bold" style={{ color: tone.c, background: tone.s }}>{stLabel}</span>
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Locked learning data (privacy) */}
        <div>
          <GaCap className="mb-2.5 block">{t('modal.learningData')}</GaCap>
          <div className="grid grid-cols-2 gap-2">
            {LOCKED_FIELD_KEYS.map((f) => (
              <div key={f} className="flex items-center gap-2 border border-dashed border-ga-line bg-ga-bg px-3 py-2.5 text-[12.5px] text-ga-subtle">
                <Lock size={13} className="shrink-0" /> {t(`modal.lockedFields.${f}`)} <span className="ml-auto text-[10.5px]">{t('modal.noAccess')}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-ga-line pt-4">
        <GaBtn variant="ghost" size="sm" onClick={() => toast(t('modal.remindPaymentSoon'))}><Bell size={14} /> {t('modal.remindPayment')}</GaBtn>
        <GaBtn variant="ghost" size="sm" onClick={() => toast(t('modal.exportInvoiceSoon'))}><FileDown size={14} /> {t('modal.exportInvoice')}</GaBtn>
        {(org.status ?? '').toUpperCase() === 'PENDING' && (
          <GaBtn variant="yellow" size="sm" onClick={() => toast(t('modal.activateFromList'))}><Sparkles size={14} /> {t('modal.activate')}</GaBtn>
        )}
      </div>
    </TkModal>
  )
}
