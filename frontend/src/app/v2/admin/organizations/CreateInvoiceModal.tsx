'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { apiMessage } from '@/lib/api'
import { createInvoice, type AdminOrgDetail, type CreateInvoiceInput } from '@/lib/adminOrgApi'
import { ErrorBanner, GaBtn, GaCap, GaInput, GaTextarea, TkModal } from '@/components/ui-v2'
import { useFmt } from '@/lib/i18n/useFmt'
import { clampInt } from './orgLicence'

/**
 * T-01 — tạo hoá đơn NHÁP cho một trung tâm (POST /admin/organizations/{id}/invoices).
 * Ghế mặc định = sĩ số học viên đang hoạt động (để 0 thì backend tự chụp sĩ số lúc tạo — D-3/G).
 * Số tiền > 0 (M-14) và kỳ không ngược — hai luật backend cũng chặn, kiểm ở đây để không gửi một
 * request chắc chắn 400.
 */
export interface CreateInvoiceModalProps {
  org: AdminOrgDetail
  onClose: () => void
  onCreated: () => void
}

export function CreateInvoiceModal({ org, onClose, onCreated }: CreateInvoiceModalProps) {
  const t = useTranslations('v2.adminOps.organizations.invoices.createModal')
  const fmt = useFmt()
  const students = org.studentCount ?? 0
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [seats, setSeats] = useState(String(students))
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const amountVnd = Math.round(Number(amount))
  const amountValid = Number.isFinite(amountVnd) && amountVnd > 0
  const periodValid = !periodStart || !periodEnd || periodEnd >= periodStart

  const submit = async () => {
    setError('')
    if (!amountValid) {
      setError(t('errAmount'))
      return
    }
    if (!periodValid) {
      setError(t('errPeriod'))
      return
    }
    const body: CreateInvoiceInput = {
      periodStart: periodStart || undefined,
      periodEnd: periodEnd || undefined,
      seats: clampInt(seats),
      amountVnd,
      note: note.trim() || undefined,
    }
    setSaving(true)
    try {
      const created = await createInvoice(org.id, body)
      toast.success(t('created', { id: String(created.id), amount: fmt.vnd(created.amountVnd) }))
      onCreated()
      onClose()
    } catch (e: unknown) {
      setError(apiMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <TkModal
      open
      onOpenChange={(o) => !o && !saving && onClose()}
      size="md"
      title={t('title', { org: org.name })}
      description={t('description')}
      footer={
        <>
          <GaBtn variant="ghost" disabled={saving} onClick={onClose}>
            {t('cancel')}
          </GaBtn>
          <GaBtn variant="primary" loading={saving} onClick={() => void submit()} data-testid="invoice-submit">
            {t('submit')}
          </GaBtn>
        </>
      }
    >
      {error && <ErrorBanner className="mb-4" message={error} />}

      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <GaCap>{t('periodStart')}</GaCap>
            <GaInput className="mt-1" type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} data-testid="invoice-period-start" />
          </label>
          <label className="block">
            <GaCap>{t('periodEnd')}</GaCap>
            <GaInput
              className="mt-1"
              type="date"
              value={periodEnd}
              min={periodStart || undefined}
              invalid={!periodValid}
              onChange={(e) => setPeriodEnd(e.target.value)}
              data-testid="invoice-period-end"
            />
          </label>
        </div>
        <p className="ga-ui text-ga-caption text-ga-subtle">{t('periodHint')}</p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <GaCap>{t('seats')}</GaCap>
            <GaInput
              className="mt-1"
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              value={seats}
              onChange={(e) => setSeats(e.target.value)}
              data-testid="invoice-seats"
            />
            <p className="ga-ui mt-1 text-ga-caption text-ga-subtle">{t('seatsHint', { count: fmt.num(students) })}</p>
          </label>
          <label className="block">
            <GaCap>{t('amount')}</GaCap>
            <GaInput
              className="mt-1"
              type="number"
              min={1}
              step={1000}
              inputMode="numeric"
              value={amount}
              invalid={amount !== '' && !amountValid}
              placeholder={t('amountPlaceholder')}
              onChange={(e) => setAmount(e.target.value)}
              data-testid="invoice-amount"
            />
            <p className="ga-ui mt-1 text-ga-caption text-ga-subtle">
              {amountValid ? fmt.vnd(amountVnd) : t('amountHint')}
            </p>
          </label>
        </div>

        <label className="block">
          <GaCap>{t('note')}</GaCap>
          <GaTextarea className="mt-1" rows={2} value={note} maxLength={500} placeholder={t('notePlaceholder')} onChange={(e) => setNote(e.target.value)} />
        </label>
      </div>
    </TkModal>
  )
}
