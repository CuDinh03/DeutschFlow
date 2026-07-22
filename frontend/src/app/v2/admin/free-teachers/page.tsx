'use client'

import { useTranslations } from 'next-intl'
import useAdminData from '@/hooks/useAdminData'
import { listFreeTeachers, type FreeTeacher } from '@/lib/adminOrgApi'
import { GaPageHdr, DataTable, type DataTableColumn } from '@/components/ui-v2'

// "Giáo viên tự do" = TEACHER không thuộc trung tâm nào (suy ra từ users.org_id IS NULL — không
// cờ/bảng). Platform-admin xem để mời/điều phối vào trung tâm (B2B model §4/§6).

export default function V2AdminFreeTeachersPage() {
  const t = useTranslations('v2.adminOps.freeTeachers')
  const { data, loading, error, reload } = useAdminData<FreeTeacher[]>({
    initialData: [],
    fetchData: listFreeTeachers,
    errorMessage: t('loadError'),
  })

  const columns: DataTableColumn<FreeTeacher>[] = [
    {
      key: 'displayName',
      header: t('colTeacher'),
      sortable: true,
      sortValue: (row) => row.displayName || row.email,
      render: (row) => (
        <div>
          <p className="text-[14px] font-semibold text-ga-ink">{row.displayName || '—'}</p>
          <p className="truncate text-[12px] text-ga-muted">{row.email}</p>
        </div>
      ),
    },
    {
      key: 'userId',
      header: t('colUserId'),
      align: 'right',
      sortable: true,
      sortValue: (row) => row.userId,
      render: (row) => <span className="ga-ui text-[13px] text-ga-muted">#{row.userId}</span>,
    },
  ]

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr
        accent
        title={t('title')}
        subtitle={t('subtitle')}
      />
      <div className="flex-1 px-4 py-6 sm:px-6 lg:px-10">
        <DataTable
          columns={columns}
          data={data}
          rowKey={(row) => row.userId}
          loading={loading}
          error={error || null}
          onRetry={() => void reload()}
          errorEndpoint="GET /api/admin/teachers/free"
          itemNoun={t('itemNoun')}
          empty={<p className="ga-ui text-[14px] text-ga-muted">{t('empty')}</p>}
        />
      </div>
    </div>
  )
}
