'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Plus, ShieldCheck, UserCog, FileText } from 'lucide-react'
import { format } from 'date-fns'
import useAdminData from '@/hooks/useAdminData'
import { listOrganizations, listOrgInvoices, type AdminOrg, type OrgInvoice } from '@/lib/adminOrgApi'
import { isInvoiceOverdue } from '@/lib/orgInvoice'
import { GaPageHdr, GaBtn, GaStatStrip, DataTable, TkBadge, type DataTableColumn } from '@/components/ui-v2'
import { CreateOrgModal } from './CreateOrgModal'
import { ForceOwnerDialog } from './ForceOwnerDialog'
import { poolSummary } from './orgLicence'
import { useFmt } from '@/lib/i18n/useFmt'

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
// Quá hạn: dùng chung `isInvoiceOverdue` với /v2/org/billing (V-12b). Trước đó màn này đo bằng
// `periodEnd` (ngày kết thúc KỲ DỊCH VỤ), nên một hoá đơn gửi cuối kỳ — còn nguyên 7 ngày để trả —
// đã bị gắn cờ đỏ ở đây trong khi trung tâm nhìn màn của mình thấy "chưa tới hạn".
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
      if (isInvoiceOverdue(inv)) hasOverdue = true
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


// Enum → catalog-key maps (labels resolved via t('status.<KEY>') / t('pay.<key>')).
// T-03 (10/09/2026): bỏ PENDING — backend chỉ nhận ACTIVE | SUSPENDED; nút "Kích hoạt" cho PENDING
// là mã chết chưa từng bấm được. "Cấp lại quyền lợi" giờ nằm ở hồ sơ trung tâm (OrgStatusCard).
const STATUS_KEYS = ['ACTIVE', 'SUSPENDED'] as const
const PAY_TONE: Record<OrgPay, { c: string; s: string }> = {
  paid: { c: 'var(--ga-green)', s: 'var(--ga-green-soft)' },
  pending: { c: 'var(--ga-orange)', s: 'var(--ga-orange-soft)' },
  overdue: { c: 'var(--ga-red)', s: 'var(--ga-red-soft)' },
  none: { c: 'var(--ga-muted)', s: 'var(--ga-side-active)' },
}

export default function V2AdminOrgsPage() {
  const t = useTranslations('v2.adminOps.organizations')
  const fmt = useFmt()
  const [showCreate, setShowCreate] = useState(false)
  // DEC-13 / A6: trung tâm đang cần admin chỉ định giám đốc (giám đốc mất tài khoản / nghỉ việc).
  const [forceTarget, setForceTarget] = useState<AdminOrg | null>(null)

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
    let suspended = 0
    for (const { org, finance } of data) {
      revenue += finance.totalInvoiced
      seats += org.seatLimit ?? 0
      if (finance.outstanding > 0) unpaid += 1
      if ((org.status ?? '').toUpperCase() === 'SUSPENDED') suspended += 1
    }
    return { revenue, seats, unpaid, suspended, count: data.length }
  }, [data])

  const statusLabel = (status: string | null | undefined): string => {
    const key = (status ?? '').toUpperCase()
    return (STATUS_KEYS as readonly string[]).includes(key) ? t(`status.${key}`) : (status ?? '')
  }

  const poolLabel = (org: AdminOrg): string => {
    const pool = poolSummary(org)
    if (pool === 'unlimited') return t('aiPool.unlimited')
    if (pool === 'metered') return t('aiPool.metered', { count: fmt.num(Number(org.monthlyTokenPool ?? 0)) })
    return t('aiPool.unset')
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
              {org.planCode || t('noPlan')} · {t('studentsSuffix', { count: fmt.num(Number(org.studentCount ?? 0)) })}
            </p>
            {/* T-03: hạn mức AI nhân sự ngay trong danh sách — "chưa cấu hình" là ca nhân sự bị 429 im lặng. */}
            <p
              className={
                poolSummary(org) === 'unset'
                  ? 'mt-0.5 text-ga-caption font-semibold text-ga-red'
                  : 'mt-0.5 text-ga-caption text-ga-subtle'
              }
            >
              {poolLabel(org)}
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
          {org.seatLimit > 0 ? fmt.num(Number(org.seatLimit)) : '∞'}{' '}
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
          <p className="text-[14px] font-semibold text-ga-ink">{fmt.vndCompact(finance.totalInvoiced)}</p>
          <p className="mt-0.5 text-[11.5px] text-ga-muted">
            {t('issuedInvoices')}
            {finance.outstanding > 0 && (
              <span style={{ color: 'var(--ga-red)' }}>{t('debtSuffix', { amount: fmt.vnd(finance.outstanding) })}</span>
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
            <p className="mt-[5px] text-[11px] text-ga-muted">
              {org.validUntil ? t('renewOn', { date: fmtDate(org.validUntil) }) : t('perpetual')}
            </p>
          </div>
        )
      },
    },
    {
      key: 'action',
      header: '',
      align: 'right',
      className: 'w-[190px]',
      render: ({ org }) => {
        const isSuspended = (org.status ?? '').toUpperCase() === 'SUSPENDED'
        return (
          <div className="flex flex-col items-end gap-1.5" onClick={(e) => e.stopPropagation()}>
            <TkBadge dot tone={isSuspended ? 'red' : 'green'}>
              {statusLabel(org.status)}
            </TkBadge>
            {/* T-03/T-01: hồ sơ trung tâm — sửa gói/ghế/hạn mức/hạn giấy phép + sổ hoá đơn. */}
            <Link
              href={`/v2/admin/organizations/${org.id}`}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-ga border border-ga-line px-[10px] py-[6px] text-ga-caption font-semibold text-ga-muted transition-colors hover:border-ga-accent hover:text-ga-accent lg:min-h-0"
            >
              <FileText size={13} aria-hidden />
              {t('openDetail')}
            </Link>
            {/* DEC-13 / A6: đường khôi phục quyền giám đốc — mở ConfirmDialog nêu hệ quả + lý do bắt buộc,
                thay cho cách cũ "đặt lại mật khẩu rồi đăng nhập thay" vốn ghi sổ sai người thực hiện. */}
            <button
              type="button"
              onClick={() => setForceTarget(org)}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-ga border border-ga-line px-[10px] py-[6px] text-ga-caption font-semibold text-ga-muted transition-colors hover:border-ga-red hover:text-ga-red lg:min-h-0"
            >
              <UserCog size={13} aria-hidden />
              {t('forceOwner.action')}
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

      <div className="flex-1 px-4 py-6 sm:px-6 lg:px-10">
        {/* Privacy notice — platform admin sees finance only */}
        <div
          className="mb-[22px] flex items-start gap-3 border px-4 py-[13px] lg:items-center lg:px-[18px]"
          style={{ background: 'var(--ga-navy-soft)', borderColor: 'rgba(39,64,107,0.20)' }}
        >
          <ShieldCheck size={20} aria-hidden style={{ color: 'var(--ga-navy)', flexShrink: 0 }} />
          <p className="text-[13.5px] leading-[1.5] text-ga-ink">
            {t.rich('privacyNotice', { strong: (chunks) => <strong>{chunks}</strong> })}
          </p>
        </div>

        <GaStatStrip
          className="mb-6"
          items={[
            { label: t('stats.issuedRevenue'), value: fmt.vndCompact(stats.revenue), tone: 'green', sub: t('stats.issuedRevenueSub') },
            {
              label: t('stats.totalSeats'),
              value: fmt.num(stats.seats),
              tone: 'violet',
              sub: t('stats.totalSeatsSub', { count: stats.count }),
            },
            {
              label: t('stats.unpaidInvoices'),
              value: stats.unpaid,
              tone: 'orange',
              sub: t('stats.unpaidInvoicesSub'),
              alert: stats.unpaid > 0,
            },
            {
              label: t('stats.suspended'),
              value: stats.suspended,
              tone: 'red',
              sub: t('stats.suspendedSub'),
              alert: stats.suspended > 0,
            },
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
            <div className="px-4 py-5 text-center sm:px-6 lg:px-10 lg:py-7">
              <p className="ga-ui text-[14.5px] text-ga-muted">{t('emptyOrgs')}</p>
            </div>
          }
        />
      </div>

      {showCreate && (
        <CreateOrgModal onClose={() => setShowCreate(false)} onCreated={() => reload({ silent: true })} />
      )}

      {forceTarget && (
        <ForceOwnerDialog
          org={forceTarget}
          onClose={() => setForceTarget(null)}
          onDone={() => reload({ silent: true })}
        />
      )}
    </div>
  )
}
