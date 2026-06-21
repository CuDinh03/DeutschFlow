'use client'

import useAdminData from '@/hooks/useAdminData'
import { listFreeTeachers, type FreeTeacher } from '@/lib/adminOrgApi'
import { GaPageHdr, DataTable, type DataTableColumn } from '@/components/ui-v2'

// "Giáo viên tự do" = TEACHER không thuộc trung tâm nào (suy ra từ users.org_id IS NULL — không
// cờ/bảng). Platform-admin xem để mời/điều phối vào trung tâm (B2B model §4/§6).

export default function V2AdminFreeTeachersPage() {
  const { data, loading, error, reload } = useAdminData<FreeTeacher[]>({
    initialData: [],
    fetchData: listFreeTeachers,
    errorMessage: 'Không tải được danh sách giáo viên tự do',
  })

  const columns: DataTableColumn<FreeTeacher>[] = [
    {
      key: 'displayName',
      header: 'Giáo viên',
      sortable: true,
      sortValue: (t) => t.displayName || t.email,
      render: (t) => (
        <div>
          <p className="text-[14px] font-semibold text-ga-ink">{t.displayName || '—'}</p>
          <p className="truncate text-[12px] text-ga-muted">{t.email}</p>
        </div>
      ),
    },
    {
      key: 'userId',
      header: 'ID người dùng',
      align: 'right',
      sortable: true,
      sortValue: (t) => t.userId,
      render: (t) => <span className="ga-ui text-[13px] text-ga-muted">#{t.userId}</span>,
    },
  ]

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr
        accent
        title="Giáo viên tự do"
        subtitle="Giáo viên chưa thuộc trung tâm nào — để mời hoặc điều phối"
      />
      <div className="flex-1 px-10 py-6">
        <DataTable
          columns={columns}
          data={data}
          rowKey={(t) => t.userId}
          loading={loading}
          error={error || null}
          onRetry={() => void reload()}
          errorEndpoint="GET /api/admin/teachers/free"
          itemNoun="giáo viên"
          empty={<p className="ga-ui text-[14px] text-ga-muted">Không có giáo viên tự do nào.</p>}
        />
      </div>
    </div>
  )
}
