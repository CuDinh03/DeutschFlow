"use client"

import React from 'react'
import Link from 'next/link'
import { LayoutDashboard, Users, BarChart2, LogOut, Menu, BookOpen, FileText, Store, Sparkles, GraduationCap, Bell, User, ClipboardCheck, Image } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { getOrgRole } from '@/lib/authSession'
import { MARKETPLACE_ENABLED } from '@/lib/features'

interface TeacherShellProps {
  children: React.ReactNode
  activeMenu: 'dashboard' | 'classes' | 'reports' | 'grammar' | 'materials' | 'marketplace' | 'notifications' | 'profile' | 'grading' | 'media'
  userName: string
  onLogout: () => void
  headerTitle?: string
  headerSubtitle?: string
  pendingGradingCount?: number
}

export function TeacherShell({
  children,
  activeMenu,
  userName,
  onLogout,
  headerTitle,
  headerSubtitle,
  pendingGradingCount = 0,
}: TeacherShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)

  // Teachers who belong to an org don't sell 1-1 sessions on the open marketplace, so the
  // marketplace profile + directory are hidden for them (B2B decision). Computed after mount
  // to avoid an SSR/client hydration mismatch (the token is client-only).
  const [isOrgTeacher, setIsOrgTeacher] = React.useState(false)
  React.useEffect(() => {
    setIsOrgTeacher(Boolean(getOrgRole()))
  }, [])

  const menuGroups = [
    {
      title: 'Quản lý lớp',
      items: [
        { id: 'dashboard', label: 'Dashboard & Lớp học', icon: LayoutDashboard, href: '/teacher/dashboard' },
        { id: 'grading', label: 'Trung tâm Chấm bài', icon: ClipboardCheck, href: '/teacher/grading', pendingCount: pendingGradingCount },
        { id: 'reports', label: 'Báo cáo & Phân tích', icon: BarChart2, href: '/teacher/reports' },
      ]
    },
    {
      title: 'Thông báo',
      items: [
        { id: 'notifications', label: 'Thông báo của tôi', icon: Bell, href: '/teacher/notifications' },
      ]
    },
    {
      title: 'Công cụ AI & Thư viện',
      items: [
        { id: 'grammar', label: 'Ngữ pháp AI', icon: BookOpen, href: '/teacher/grammar', badge: 'AI' },
        { id: 'materials', label: 'Tạo Tài liệu AI', icon: Sparkles, href: '/teacher/materials', badge: 'AI' },
        { id: 'media', label: 'Thư viện ảnh (S3)', icon: Image, href: '/teacher/media' },
      ]
    },
    {
      title: 'Cá nhân',
      items: [
        { id: 'profile', label: 'Hồ sơ Giáo viên', icon: User, href: '/teacher/profile' },
        { id: 'marketplace', label: 'Marketplace GV', icon: Store, href: '/teachers' },
      ]
    },
  ]
    // Drop marketplace items (and any group left empty) for org teachers, and hide the C2C
    // marketplace entirely for v1.0 unless the flag is on (see lib/features.ts).
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (item.id === 'marketplace' && !MARKETPLACE_ENABLED) return false
        return !(isOrgTeacher && (item.id === 'profile' || item.id === 'marketplace'))
      }),
    }))
    .filter((group) => group.items.length > 0)

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-[#0F172A] text-white">
      {/* Brand */}
      <div className="h-16 flex items-center px-6 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center font-black text-white shadow-lg">
            DF
          </div>
          <span className="font-bold text-lg tracking-tight">TeacherPortal</span>
        </div>
      </div>

      {/* Profile */}
      <div className="p-6 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-emerald-400 to-teal-500 flex items-center justify-center font-bold shadow-md">
            {userName.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-bold text-sm truncate">{userName}</p>
            <p className="text-xs text-indigo-300 font-medium">Giáo viên</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
        {menuGroups.map((group) => (
          <div key={group.title}>
            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-2 px-3">{group.title}</p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = activeMenu === item.id
                const Icon = item.icon
                const badge = 'badge' in item ? item.badge : undefined
                const pendingCount = 'pendingCount' in item ? (item as { pendingCount: number }).pendingCount : 0
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group ${
                      isActive
                        ? 'bg-indigo-600/20 text-indigo-400 shadow-sm'
                        : 'text-slate-400 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors relative ${
                      isActive ? 'bg-indigo-500/20' : 'bg-white/5 group-hover:bg-white/10'
                    }`}>
                      <Icon size={16} className={isActive ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-300 transition-colors'} />
                      {pendingCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 rounded-full flex items-center justify-center text-[9px] font-black text-white">
                          {pendingCount > 9 ? '9+' : pendingCount}
                        </span>
                      )}
                    </div>
                    <span className="font-semibold text-sm flex-1 truncate">{item.label}</span>
                    {badge && (
                      <span className="bg-indigo-500/20 text-indigo-300 text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-indigo-500/20">{badge}</span>
                    )}
                    {pendingCount > 0 && !isActive && (
                      <span className="bg-rose-500/20 text-rose-300 text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-rose-500/20">
                        {pendingCount}
                      </span>
                    )}
                    {isActive && (
                      <div className="w-1 h-4 bg-indigo-400 rounded-full" />
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Logout */}
      <div className="p-4 border-t border-white/5">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 transition-colors group"
        >
          <LogOut size={20} className="text-slate-500 group-hover:text-rose-400 transition-colors" />
          <span className="font-semibold text-sm">Đăng xuất</span>
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-[#F8FAFC]">
      {/* Desktop Sidebar */}
      <div className="hidden md:block w-72 h-full shrink-0 shadow-2xl z-20 relative">
        <SidebarContent />
      </div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 md:hidden"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
              className="fixed inset-y-0 left-0 w-72 z-50 shadow-2xl md:hidden"
            >
              <SidebarContent />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-8 shrink-0 z-10 shadow-sm">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              <Menu size={24} />
            </button>
            {(headerTitle || headerSubtitle) && (
              <div>
                {headerTitle && <h1 className="font-bold text-slate-800 leading-tight">{headerTitle}</h1>}
                {headerSubtitle && <p className="text-xs text-slate-500 font-medium">{headerSubtitle}</p>}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell inboxHref="/teacher/notifications" buttonClassName="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50" />
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
