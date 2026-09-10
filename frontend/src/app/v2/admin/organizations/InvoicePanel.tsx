'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { apiMessage } from '@/lib/api'
import {
  updateInvoiceStatus,
  type AdminOrgDetail,
  type InvoiceStatus,
  type OrgInvoice,
} from '@/lib/adminOrgApi'
import { isInvoiceOverdue } from '@/lib/orgInvoice'
import { ConfirmDialog, DataTable, ErrorBanner, GaBtn, GaCap, TkBadge, type DataTableColumn } from '@/components/ui-v2'
import { useFmt } from '@/lib/i18n/useFmt'
import { CreateInvoiceModal } from './CreateInvoiceModal'
import { addDays, localDateFromIso } from './orgLicence'

/**
 * T-01 — sổ hoá đơn của một trung tâm + chuyển trạng thái (owner chốt 10/09/2026; không QR, không
 * nhắc nợ — đợt sau).
 *
 * Máy trạng thái backend (M-15) tiến một chiều: DRAFT → SENT → PAID | VOID, DRAFT → PAID cho đối
 * soát tay, PAID/VOID là đích. Mọi bước đều KHÔNG hoàn tác được, nên mỗi nút đi qua ConfirmDialog
 * nêu hệ quả — riêng PAID kích hoạt giấy phép (org ACTIVE + validUntil kéo tới cuối kỳ + cấp lại
 * quyền lợi), là thao tác tiền.
 */
export interface InvoicePanelProps {
  org: AdminOrgDetail
  invoices: OrgInvoice[]
  onChanged: () => void
}

type Transition = { invoice: OrgInvoice; to: Exclude<InvoiceStatus, 'DRAFT'> }

const STATUS_TONE: Record<string, 'green' | 'yellow' | 'neutral' | 'red'> = {
  PAID: 'green',
  SENT: 'yellow',
  DRAFT: 'neutral',
  VOID: 'red',
}
const STATUS_KEYS = ['DRAFT', 'SENT', 'PAID', 'VOID'] as const
type StatusKey = (typeof STATUS_KEYS)[number]

const statusKey = (raw: string | null | undefined): StatusKey | null => {
  const k = (raw ?? '').toUpperCase()
  return (STATUS_KEYS as readonly string[]).includes(k) ? (k as StatusKey) : null
}

/** Bước tiến hợp lệ từ mỗi trạng thái — cùng bảng với OrgBillingService.ALLOWED_TRANSITIONS (trừ tự-chuyển). */
const NEXT: Record<StatusKey, Transition['to'][]> = {
  DRAFT: ['SENT', 'PAID', 'VOID'],
  SENT: ['PAID', 'VOID'],
  PAID: [],
  VOID: [],
}

export function InvoicePanel({ org, invoices, onChanged }: InvoicePanelProps) {
  const t = useTranslations('v2.adminOps.organizations.invoices')
  const fmt = useFmt()
  const [showCreate, setShowCreate] = useState(false)
  const [pending, setPending] = useState<Transition | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const statusLabel = (raw: string | null | undefined) => {
    const k = statusKey(raw)
    return k ? t(`status.${k}`) : (raw ?? '')
  }

  const apply = async () => {
    if (!pending) return
    setBusy(true)
    setError('')
    try {
      await updateInvoiceStatus(org.id, pending.invoice.id, pending.to)
      toast.success(t('changed', { id: String(pending.invoice.id), status: t(`status.${pending.to}`) }))
      onChanged()
    } catch (e: unknown) {
      setError(apiMessage(e))
    } finally {
      setBusy(false)
      setPending(null)
    }
  }

  const period = (inv: OrgInvoice) => `${fmt.date(inv.periodStart)} – ${fmt.date(inv.periodEnd)}`

  const columns: DataTableColumn<OrgInvoice>[] = [
    {
      key: 'period',
      header: t('col.period'),
      render: (inv) => (
        <div>
          <p className="text-ga-small font-semibold text-ga-ink">{period(inv)}</p>
          {inv.note && <p className="mt-0.5 truncate text-ga-caption text-ga-muted">{inv.note}</p>}
        </div>
      ),
    },
    {
      key: 'seats',
      header: t('col.seats'),
      align: 'right',
      className: 'w-[80px]',
      render: (inv) => <span className="text-ga-small text-ga-muted">{fmt.num(inv.seats)}</span>,
    },
    {
      key: 'amount',
      header: t('col.amount'),
      align: 'right',
      className: 'w-[140px]',
      render: (inv) => <span className="text-ga-small font-semibold text-ga-ink">{fmt.vnd(inv.amountVnd)}</span>,
    },
    {
      key: 'status',
      header: t('col.status'),
      className: 'w-[120px]',
      render: (inv) => (
        <TkBadge dot tone={STATUS_TONE[(inv.status ?? '').toUpperCase()] ?? 'neutral'}>
          {statusLabel(inv.status)}
        </TkBadge>
      ),
    },
    {
      key: 'due',
      header: t('col.due'),
      className: 'w-[130px]',
      render: (inv) => {
        const overdue = isInvoiceOverdue(inv)
        return (
          <span className={overdue ? 'text-ga-small font-semibold text-ga-red' : 'text-ga-small text-ga-muted'}>
            {inv.dueDate ? fmt.date(inv.dueDate) : '—'}
            {overdue && <span className="ml-1 text-ga-caption">{t('overdue')}</span>}
          </span>
        )
      },
    },
    {
      key: 'code',
      header: t('col.code'),
      className: 'w-[150px]',
      render: (inv) => <span className="font-mono text-ga-caption text-ga-muted">{inv.paymentCode ?? '—'}</span>,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      className: 'w-[240px]',
      render: (inv) => {
        const k = statusKey(inv.status)
        const next = k ? NEXT[k] : []
        if (next.length === 0) return <span className="text-ga-caption text-ga-subtle">—</span>
        return (
          <div className="flex flex-wrap justify-end gap-1.5">
            {next.map((to) => (
              <GaBtn
                key={to}
                size="sm"
                variant={to === 'VOID' ? 'ghost' : to === 'PAID' ? 'primary' : 'yellow'}
                className={to === 'VOID' ? 'text-ga-red hover:border-ga-red' : undefined}
                disabled={busy}
                onClick={() => setPending({ invoice: inv, to })}
                data-testid={`invoice-${inv.id}-${to.toLowerCase()}`}
              >
                {t(`action.${to}`)}
              </GaBtn>
            ))}
          </div>
        )
      },
    },
  ]

  const dialog = pending && dialogCopy(pending, org, t, fmt)

  return (
    <section className="flex flex-col gap-3" data-testid="invoice-panel">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <GaCap>{t('title')}</GaCap>
          <p className="ga-ui mt-1 text-ga-small text-ga-muted">{t('subtitle', { count: fmt.num(invoices.length) })}</p>
        </div>
        <GaBtn variant="primary" onClick={() => setShowCreate(true)} data-testid="invoice-create">
          <Plus size={15} aria-hidden />
          {t('create')}
        </GaBtn>
      </div>

      {error && <ErrorBanner message={error} />}

      <DataTable
        columns={columns}
        data={invoices}
        rowKey={(inv) => inv.id}
        pageSize={0}
        itemNoun={t('noun')}
        empty={
          <div className="px-4 py-6 text-center">
            <p className="ga-ui text-ga-small text-ga-muted">{t('empty')}</p>
          </div>
        }
      />

      {showCreate && (
        <CreateInvoiceModal org={org} onClose={() => setShowCreate(false)} onCreated={onChanged} />
      )}

      {pending && dialog && (
        <ConfirmDialog
          open
          onOpenChange={(o) => {
            if (!o && !busy) setPending(null)
          }}
          title={dialog.title}
          description={dialog.description}
          details={dialog.details}
          confirmLabel={dialog.confirm}
          cancelLabel={t('dialog.cancel')}
          destructive={pending.to === 'VOID'}
          loading={busy}
          onConfirm={() => void apply()}
        />
      )}
    </section>
  )
}

type T = ReturnType<typeof useTranslations>
type Fmt = ReturnType<typeof useFmt>

/** Nội dung hộp thoại theo đích chuyển — hệ quả thật của backend, không phải câu chung chung. */
function dialogCopy(p: Transition, org: AdminOrgDetail, t: T, fmt: Fmt) {
  const { invoice, to } = p
  const base = {
    id: String(invoice.id),
    amount: fmt.vnd(invoice.amountVnd),
    period: `${fmt.date(invoice.periodStart)} – ${fmt.date(invoice.periodEnd)}`,
  }
  if (to === 'SENT') {
    return {
      title: t('dialog.send.title', { id: base.id }),
      description: t('dialog.send.description', base),
      details: [
        t('dialog.send.detailDue', { date: fmt.date(addDays(new Date(), 7)) }),
        t('dialog.send.detailVisible'),
        t('dialog.send.detailNoRevert'),
      ],
      confirm: t('dialog.send.confirm'),
    }
  }
  if (to === 'PAID') {
    // Cùng phép tính với AdminOrgService.activateForPaidInvoice: periodEnd + 1 ngày, 00:00.
    const periodEnd = localDateFromIso(invoice.periodEnd)
    const extendTo = periodEnd ? fmt.date(addDays(periodEnd, 1)) : null
    return {
      title: t('dialog.paid.title', { id: base.id }),
      description: t('dialog.paid.description', base),
      details: [
        t('dialog.paid.detailActivate', { org: org.name }),
        extendTo ? t('dialog.paid.detailExtend', { date: extendTo }) : t('dialog.paid.detailNoPeriod'),
        t('dialog.paid.detailRegrant', { count: fmt.num(org.studentCount ?? 0) }),
        t('dialog.paid.detailNoRevert'),
      ],
      confirm: t('dialog.paid.confirm'),
    }
  }
  return {
    title: t('dialog.void.title', { id: base.id }),
    description: t('dialog.void.description', base),
    details: [t('dialog.void.detailFinal'), t('dialog.void.detailNoLicence')],
    confirm: t('dialog.void.confirm'),
  }
}
