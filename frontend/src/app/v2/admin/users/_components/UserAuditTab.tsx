'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { apiMessage } from '@/lib/api'
import { adminUsersApi, type AuditItem, type AuditPage } from '@/lib/adminUsersApi'
import { DataTable, type DataTableColumn } from '@/components/ui-v2'
import { useFmt } from '@/lib/i18n/useFmt'

const PAGE_SIZE = 20

/** Lý do (nếu có) trong metadata của vết — các thao tác nhạy cảm từ 09/11/2026 luôn có. */
function reasonOf(item: AuditItem): string | null {
  if (!item.metadataJson) return null
  try {
    const meta = JSON.parse(item.metadataJson) as Record<string, unknown>
    return typeof meta.reason === 'string' ? meta.reason : null
  } catch {
    return null
  }
}

/**
 * Tab "Nhật ký" của hồ sơ người dùng: các vết có đối tượng là người này
 * (GET /admin/audit?targetUserId=, phân trang server) — ai đã khoá, đổi gói, xem dữ liệu, vì sao.
 */
export function UserAuditTab({ userId }: { userId: number }) {
  const t = useTranslations('v2.adminOps.users.detail.audit')
  const fmt = useFmt()
  const [page, setPage] = useState(1)
  const [data, setData] = useState<AuditPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    adminUsersApi
      .audit(userId, page, PAGE_SIZE)
      .then((r) => !cancelled && setData(r.data))
      .catch((e) => !cancelled && setError(apiMessage(e)))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [userId, page, nonce])

  const columns: DataTableColumn<AuditItem>[] = [
    {
      key: 'createdAt',
      header: t('colTime'),
      render: (r) => <span className="whitespace-nowrap text-ga-muted">{r.createdAt ? fmt.dateTime(r.createdAt) : '—'}</span>,
    },
    { key: 'eventName', header: t('colEvent'), render: (r) => <code className="font-mono text-ga-caption">{r.eventName}</code> },
    { key: 'actorEmail', header: t('colActor'), render: (r) => <span className="text-ga-muted">{r.actorEmail ?? '—'}</span> },
    { key: 'reason', header: t('colReason'), render: (r) => <span>{reasonOf(r) ?? '—'}</span> },
  ]

  return (
    <div data-testid="user-audit-tab">
      <DataTable
        columns={columns}
        data={data?.items ?? []}
        rowKey={(r) => r.id}
        loading={loading}
        keepPreviousRows
        error={error}
        onRetry={() => setNonce((n) => n + 1)}
        errorEndpoint={`GET /api/admin/audit?targetUserId=${userId}`}
        server={{ total: data?.total ?? 0, page, pageSize: PAGE_SIZE, onPageChange: setPage }}
        empty={<p className="ga-ui px-4 py-8 text-center text-ga-small text-ga-muted">{t('empty')}</p>}
      />
    </div>
  )
}
