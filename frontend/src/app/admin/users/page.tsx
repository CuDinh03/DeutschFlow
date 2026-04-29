'use client'

import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { Search } from 'lucide-react'
import AdminShell from '@/components/admin/AdminShell'
import useAdminData from '@/hooks/useAdminData'

type AdminUser = {
  id: number
  email: string
  displayName: string
  role: 'ADMIN' | 'TEACHER' | 'STUDENT'
  isActive: boolean
}

export default function AdminUsersPage() {
  const [items, setItems] = useState<AdminUser[]>([])
  const [query, setQuery] = useState('')
  const { data, loading, refreshing, error, lastSyncedAt, reload } = useAdminData<AdminUser[]>({
    initialData: [],
    errorMessage: 'Khong the tai danh sach user.',
    fetchData: async () => {
      const res = await api.get('/admin/users')
      return (res.data ?? []) as AdminUser[]
    },
  })

  useEffect(() => {
    setItems(data)
  }, [data])

  const updateRole = async (id: number, role: string) => {
    try {
      await api.patch(`/admin/users/${id}/role`, { role })
      await reload({ silent: true })
    } catch {
      // hook refresh will display generic error state on next cycle
    }
  }

  const filteredItems = items.filter((u) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    return (
      u.displayName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      String(u.id).includes(q) ||
      u.role.toLowerCase().includes(q)
    )
  })

  if (loading) return <div className="page-shell text-muted-foreground">Dang tai users...</div>

  return (
    <AdminShell
      title="Quan ly nguoi dung"
      subtitle="Dong bo realtime voi database"
      activeNav="students"
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
              placeholder="Tim theo ten/email/role..."
              className="w-full input pl-8 h-9 py-1 text-sm"
            />
          </div>
        </div>

        {filteredItems.length === 0 ? (
          <div className="empty-state">Khong co user phu hop.</div>
        ) : (
          <div className="space-y-3">
            {filteredItems.map((u) => (
              <div key={u.id} className="list-item flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-foreground">{u.displayName}</p>
                  <p className="text-sm text-muted-foreground">
                    #{u.id} · {u.email} · {u.isActive ? 'Active' : 'Inactive'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex rounded-full bg-[#EEF4FF] px-2 py-0.5 text-xs font-semibold text-[#00305E]">
                    {u.role}
                  </span>
                  <select
                    className="input py-1 px-2 text-sm"
                    value={u.role}
                    onChange={(e) => updateRole(u.id, e.target.value)}
                  >
                    <option value="STUDENT">STUDENT</option>
                    <option value="TEACHER">TEACHER</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminShell>
  )
}

