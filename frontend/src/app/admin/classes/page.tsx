'use client'

import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { Search } from 'lucide-react'
import AdminShell from '@/components/admin/AdminShell'
import useAdminData from '@/hooks/useAdminData'

type AdminClass = {
  id: number
  name: string
  teacherName: string
  studentCount: number
}

export default function AdminClassesPage() {
  const [items, setItems] = useState<AdminClass[]>([])
  const [query, setQuery] = useState('')
  const { data, loading, refreshing, error, lastSyncedAt, reload } = useAdminData<AdminClass[]>({
    initialData: [],
    errorMessage: 'Khong the tai danh sach lop.',
    fetchData: async () => {
      const res = await api.get('/admin/classes')
      return (res.data ?? []) as AdminClass[]
    },
  })

  useEffect(() => {
    setItems(data)
  }, [data])

  const filteredItems = items.filter((c) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    return (
      c.name.toLowerCase().includes(q) ||
      c.teacherName.toLowerCase().includes(q) ||
      String(c.id).includes(q)
    )
  })

  if (loading) return <div className="page-shell text-muted-foreground">Dang tai classes...</div>

  return (
    <AdminShell
      title="Quan ly lop hoc"
      subtitle="Dong bo realtime voi database"
      activeNav="classes"
      error={error}
      refreshing={refreshing}
      onRefresh={() => reload({ silent: true })}
      lastSyncedAt={lastSyncedAt}
    >
      <div className="section-card rounded-[14px] border border-[#E2E8F0]">
        <div className="flex flex-col md:flex-row md:items-center gap-2 mb-3">
          <div className="relative md:w-[320px]">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tim theo ten lop / giao vien / id..."
              className="w-full input pl-8 h-9 py-1 text-sm"
            />
          </div>
        </div>

        {filteredItems.length === 0 ? (
          <div className="empty-state">Khong co lop phu hop.</div>
        ) : (
          <div className="space-y-3">
            {filteredItems.map((c) => (
              <div key={c.id} className="list-item">
                <p className="font-semibold text-foreground">{c.name}</p>
                <p className="text-sm text-muted-foreground">
                  #{c.id} · Giao vien: {c.teacherName} · Hoc vien: {c.studentCount}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminShell>
  )
}

