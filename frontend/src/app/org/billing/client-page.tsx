'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Receipt } from 'lucide-react'
import { OrgShell } from '@/components/layouts/OrgShell'
import { logout } from '@/lib/authSession'
import { httpStatus } from '@/lib/api'
import { toastApiError } from '@/lib/toastApiError'
import { useUserStore } from '@/stores/useUserStore'
import { listMyInvoices, type OrgInvoice, type InvoiceStatus } from '@/lib/orgApi'

export default function OrgBillingClientPage() {
  const router = useRouter()
  const user = useUserStore((s) => s.user)

  const [invoices, setInvoices] = useState<OrgInvoice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const rows = await listMyInvoices()
      setInvoices(rows)
    } catch (e) {
      if (httpStatus(e) === 401) {
        router.push('/login')
        return
      }
      if (httpStatus(e) === 403) {
        router.push('/teacher/dashboard')
        return
      }
      setError('Không thể tải danh sách hóa đơn. Vui lòng thử lại sau.')
      toastApiError(e, { onRetry: () => void load() })
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    void load()
  }, [load])

  const userName = user?.displayName || user?.email?.split('@')[0] || 'Quản trị viên'

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 size={32} className="animate-spin text-indigo-600" />
          <p className="font-medium text-slate-500">Đang tải danh sách hóa đơn...</p>
        </div>
      </div>
    )
  }

  return (
    <OrgShell
      activeMenu="billing"
      userName={userName}
      onLogout={() => {
        void logout()
      }}
      headerTitle="Hóa đơn"
      headerSubtitle="Lịch sử hóa đơn của tổ chức"
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <p className="text-sm text-slate-500">
          {invoices.length > 0
            ? `Tổ chức có ${invoices.length} hóa đơn`
            : 'Tổ chức chưa có hóa đơn nào'}
        </p>

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-700">
            <div className="mb-1 font-semibold">Không tải được danh sách</div>
            <p className="text-sm">{error}</p>
            <button
              onClick={() => void load()}
              className="mt-3 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"
            >
              Thử lại
            </button>
          </div>
        ) : invoices.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <Receipt className="mx-auto mb-3 h-10 w-10 text-slate-300" />
            <h3 className="text-base font-semibold text-slate-700">Chưa có hóa đơn nào</h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
              Hóa đơn của tổ chức sẽ xuất hiện ở đây khi quản trị viên hệ thống phát hành.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Kỳ thanh toán</th>
                  <th className="px-5 py-3">Số ghế</th>
                  <th className="px-5 py-3">Số tiền</th>
                  <th className="px-5 py-3">Trạng thái</th>
                  <th className="hidden px-5 py-3 md:table-cell">Ghi chú</th>
                  <th className="hidden px-5 py-3 sm:table-cell">Ngày tạo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-3 font-semibold text-slate-800">
                      {formatPeriod(inv.periodStart, inv.periodEnd)}
                    </td>
                    <td className="px-5 py-3 text-slate-500">{inv.seats}</td>
                    <td className="px-5 py-3 font-semibold text-slate-800">
                      {formatVnd(inv.amountVnd)}
                    </td>
                    <td className="px-5 py-3">
                      <InvoiceStatusBadge status={inv.status} />
                    </td>
                    <td className="hidden max-w-[16rem] px-5 py-3 text-slate-500 md:table-cell">
                      <span className="truncate">{inv.note || '—'}</span>
                    </td>
                    <td className="hidden px-5 py-3 text-xs text-slate-400 sm:table-cell">
                      {formatDate(inv.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </OrgShell>
  )
}

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: 'Nháp',
  SENT: 'Đã gửi',
  PAID: 'Đã thanh toán',
  VOID: 'Đã hủy',
}

const STATUS_TONES: Record<InvoiceStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-500',
  SENT: 'bg-amber-50 text-amber-700',
  PAID: 'bg-emerald-50 text-emerald-700',
  VOID: 'bg-rose-50 text-rose-700',
}

function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        STATUS_TONES[status] ?? 'bg-slate-100 text-slate-500'
      }`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}

function formatVnd(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatPeriod(start: string | null, end: string | null): string {
  const from = formatDate(start)
  const to = formatDate(end)
  if (from === '—' && to === '—') return '—'
  if (from === '—') return to
  if (to === '—') return from
  return `${from} – ${to}`
}
