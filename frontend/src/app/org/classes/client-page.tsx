'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import api, { httpStatus } from '@/lib/api'
import { logout } from '@/lib/authSession'
import { toastApiError } from '@/lib/toastApiError'
import { OrgShell } from '@/components/layouts/OrgShell'
import { listClasses, type OrgClass, type Page } from '@/lib/orgApi'
import {
  GraduationCap, Loader2, RefreshCw, ChevronLeft, ChevronRight, Hash, User,
} from 'lucide-react'

const PAGE_SIZE = 20

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function OrgClassesPage() {
  const router = useRouter()
  const [userName, setUserName] = useState('Quản trị viên')
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState<Page<OrgClass> | null>(null)
  const [pageIndex, setPageIndex] = useState(0)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [me, classesPage] = await Promise.all([
        api.get('/auth/me').catch(() => null),
        listClasses(pageIndex, PAGE_SIZE),
      ])
      if (me?.data) {
        const d = me.data
        if (d.displayName) setUserName(d.displayName)
        else if (d.name) setUserName(d.name)
        else if (d.email) setUserName(String(d.email).split('@')[0])
      }
      setPage(classesPage)
    } catch (e) {
      const status = httpStatus(e)
      if (status === 401) {
        router.push('/login')
        return
      }
      if (status === 403) {
        router.push('/teacher')
        return
      }
      toastApiError(e, { onRetry: loadData, locale: 'vi' })
    } finally {
      setLoading(false)
    }
  }, [router, pageIndex])

  useEffect(() => {
    loadData()
  }, [loadData])

  const classes = page?.content ?? []
  const totalPages = page?.totalPages ?? 0
  const totalElements = page?.totalElements ?? 0
  const isFirst = page?.first ?? true
  const isLast = page?.last ?? true

  if (loading && !page) {
    return (
      <OrgShell
        activeMenu="classes"
        userName={userName}
        onLogout={() => void logout()}
        headerTitle="Lớp học"
        headerSubtitle="Tất cả lớp học thuộc tổ chức"
      >
        <div className="flex h-full items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 size={32} className="animate-spin text-indigo-600" />
            <p className="font-medium text-slate-500">Đang tải danh sách lớp học...</p>
          </div>
        </div>
      </OrgShell>
    )
  }

  return (
    <OrgShell
      activeMenu="classes"
      userName={userName}
      onLogout={() => void logout()}
      headerTitle="Lớp học"
      headerSubtitle="Tất cả lớp học thuộc tổ chức"
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Header row */}
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-bold text-slate-800 flex items-center gap-2">
            <GraduationCap size={20} className="text-indigo-600" />
            Danh sách lớp học
            <span className="bg-indigo-100 text-indigo-700 text-sm font-bold px-2.5 py-0.5 rounded-full">
              {totalElements}
            </span>
          </h2>
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-60"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Làm mới
          </button>
        </div>

        {classes.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 border-dashed p-16 flex flex-col items-center text-center">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
              <GraduationCap size={36} className="text-slate-300" />
            </div>
            <h3 className="text-lg font-bold text-slate-700 mb-2">Chưa có lớp học nào</h3>
            <p className="text-slate-500 max-w-sm text-sm">
              Các lớp học do giáo viên trong tổ chức tạo sẽ hiển thị ở đây.
            </p>
          </div>
        ) : (
          <>
            {/* Table — read-only */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60 text-left">
                    <th className="px-5 py-3 font-semibold text-slate-500">Tên lớp</th>
                    <th className="px-5 py-3 font-semibold text-slate-500 hidden sm:table-cell">Mã mời</th>
                    <th className="px-5 py-3 font-semibold text-slate-500 hidden md:table-cell">Giáo viên</th>
                    <th className="px-5 py-3 font-semibold text-slate-500 text-right">Ngày tạo</th>
                  </tr>
                </thead>
                <tbody>
                  {classes.map((c) => (
                    <tr key={c.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3.5 font-semibold text-slate-800">{c.name}</td>
                      <td className="px-5 py-3.5 hidden sm:table-cell">
                        {c.inviteCode ? (
                          <span className="inline-flex items-center gap-1 font-mono text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                            <Hash size={11} className="text-slate-400" />
                            {c.inviteCode}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 hidden md:table-cell text-slate-600">
                        {c.teacherId != null ? (
                          <span className="inline-flex items-center gap-1">
                            <User size={13} className="text-slate-400" />
                            #{c.teacherId}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right text-slate-500">{formatDate(c.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">
                  Trang <span className="font-semibold text-slate-700">{pageIndex + 1}</span> / {totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
                    disabled={isFirst || loading}
                    className="flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft size={16} />
                    Trước
                  </button>
                  <button
                    onClick={() => setPageIndex((p) => p + 1)}
                    disabled={isLast || loading}
                    className="flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Sau
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </OrgShell>
  )
}
