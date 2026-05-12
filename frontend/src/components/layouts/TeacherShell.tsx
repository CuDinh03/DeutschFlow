import React from 'react'
import Link from 'next/link'
import { LayoutDashboard, Users, HelpCircle, BarChart2, LogOut, Menu, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface TeacherShellProps {
  children: React.ReactNode
  activeMenu: 'dashboard' | 'classes' | 'quizzes' | 'reports'
  userName: string
  onLogout: () => void
  headerTitle?: string
  headerSubtitle?: string
}

export function TeacherShell({
  children,
  activeMenu,
  userName,
  onLogout,
  headerTitle,
  headerSubtitle,
}: TeacherShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/teacher' },
    { id: 'classes', label: 'Quản lý Lớp', icon: Users, href: '/teacher/classes' },
    { id: 'quizzes', label: 'Quản lý Quiz', icon: HelpCircle, href: '/teacher/quizzes' },
    { id: 'reports', label: 'Báo cáo', icon: BarChart2, href: '/teacher/reports' },
  ]

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
      <div className="flex-1 overflow-y-auto py-6 px-4 space-y-2">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 px-2">Menu chính</p>
        {menuItems.map((item) => {
          const isActive = activeMenu === item.id
          const Icon = item.icon
          return (
            <Link
              key={item.id}
              href={item.href}
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                isActive
                  ? 'bg-indigo-600/20 text-indigo-400'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Icon size={20} className={isActive ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-300 transition-colors'} />
              <span className="font-semibold text-sm">{item.label}</span>
            </Link>
          )
        })}
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
