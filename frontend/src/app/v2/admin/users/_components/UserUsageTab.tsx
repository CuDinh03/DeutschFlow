'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { apiMessage } from '@/lib/api'
import { adminUsersApi, type UsageRow } from '@/lib/adminUsersApi'
import { DataTable, type DataTableColumn } from '@/components/ui-v2'
import { useFmt } from '@/lib/i18n/useFmt'

/** Tab "Sử dụng AI": 200 lượt dùng token gần nhất, 20 dòng/trang (trước đây là bảng cuộn trong modal). */
export function UserUsageTab({ userId }: { userId: number }) {
  const t = useTranslations('v2.adminOps.users.detail')
  const fmt = useFmt()
  const [rows, setRows] = useState<UsageRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    adminUsersApi
      .usage(userId, 200)
      .then((r) => !cancelled && setRows(r.data ?? []))
      .catch((e) => !cancelled && setError(apiMessage(e)))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [userId, nonce])

  const columns: DataTableColumn<UsageRow>[] = [
    {
      key: 'createdAt',
      header: t('usageCol.time'),
      render: (r) => <span className="whitespace-nowrap text-ga-muted">{r.createdAt ? fmt.dateTime(r.createdAt) : '—'}</span>,
    },
    { key: 'feature', header: t('usageCol.feature'), render: (r) => <span className="font-semibold">{r.feature ?? '—'}</span> },
    {
      key: 'model',
      header: t('usageCol.providerModel'),
      render: (r) => <span className="text-ga-muted">{[r.provider, r.model].filter(Boolean).join(' / ') || '—'}</span>,
    },
    {
      key: 'totalTokens',
      header: t('usageCol.tokens'),
      align: 'right',
      sortable: true,
      sortValue: (r) => Number(r.totalTokens) || 0,
      render: (r) => <span className="font-semibold tabular-nums">{fmt.num(r.totalTokens)}</span>,
    },
  ]

  return (
    <div data-testid="user-usage-tab">
      <p className="ga-ui mb-3 text-ga-small text-ga-muted">{t('usageCap')}</p>
      <DataTable
        columns={columns}
        data={rows}
        rowKey={(r) => r.id}
        loading={loading}
        error={error}
        onRetry={() => setNonce((n) => n + 1)}
        errorEndpoint={`GET /api/admin/users/${userId}/usage`}
        pageSize={20}
        empty={<p className="ga-ui px-4 py-8 text-center text-ga-small text-ga-muted">{t('usageEmpty')}</p>}
      />
    </div>
  )
}
