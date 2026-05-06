'use client'

import { ReactNode, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { logout } from '@/lib/authSession'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import {
  BarChart3,
  BookOpen,
  Bot,
  Coins,
  Database,
  LayoutDashboard,
  LineChart,
  LogOut,
  Menu,
  PieChart,
  RefreshCw,
  Settings,
  Users,
  X,
} from 'lucide-react'

export type AdminNavId =
  | 'overview'
  | 'revenue'
  | 'tokenAnalytics'
  | 'students'
  | 'plans'
  | 'classes'
  | 'vocabulary'
  | 'reports'
  | 'aiConfig'
  | 'settings'

type AdminShellProps = {
  title: string
  subtitle?: string
  activeNav: AdminNavId
  children: ReactNode
  error?: string
  refreshing?: boolean
  onRefresh?: () => void
  lastSyncedAt?: Date | null
}

export default function AdminShell({
  title,
  subtitle,
  activeNav,
  children,
  error,
  refreshing = false,
  onRefresh,
  lastSyncedAt,
}: AdminShellProps) {
  const router = useRouter()
  const t = useTranslations('adminNav')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const navItems = useMemo(() => [
    { id: 'overview' as const,       label: t('overview'),         href: '/admin',               icon: LayoutDashboard },
    { id: 'revenue' as const,       label: t('revenue'), href: '/admin/revenue',       icon: LineChart },
    { id: 'tokenAnalytics' as const,label: t('tokenAnalytics'),      href: '/admin/token-analytics', icon: PieChart },
    { id: 'students' as const,      label: t('students'),        href: '/admin/users',         icon: Users },
    { id: 'plans' as const,         label: t('plans'),       href: '/admin/plans',          icon: Coins },
    { id: 'classes' as const,       label: t('classes'),           href: '/admin/classes',        icon: BookOpen },
    { id: 'vocabulary' as const,    label: t('vocabulary'),           href: '/admin/vocabulary',     icon: Database },
    { id: 'reports' as const,       label: t('reports'),       href: '/admin/reports',        icon: BarChart3 },
    { id: 'aiConfig' as const,      label: t('aiConfig'),       href: '/admin/ai-config',      icon: Bot },
    { id: 'settings' as const,      label: t('settings'),           href: '/admin/settings',       icon: Settings },
  ], [t])

  const handleLogout = () => {
    logout()
  }

  return (
    <div className="flex h-screen bg-[#F1F4F9] overflow-hidden">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`fixed lg:relative z-30 flex flex-col h-full w-60 bg-[#00305E] transition-transform duration-300 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-white/10">
          <div className="w-8 h-8 rounded-[8px] bg-[#FFCE00] flex items-center justify-center flex-shrink-0">
            <span className="text-[#00305E] font-extrabold text-base leading-none">D</span>
          </div>
          <div>
            <span className="font-bold text-white text-base tracking-tight">DeutschFlow</span>
            <div className="text-white/40 text-[10px] leading-tight font-medium tracking-widest uppercase">Admin</div>
          </div>
          <button className="ml-auto lg:hidden text-white/50 hover:text-white" onClick={() => setSidebarOpen(false)}>
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
          {navItems.map(({ id, label, href, icon: Icon }) => (
            <button key={id}
              onClick={() => { setSidebarOpen(false); router.push(href) }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] transition-all duration-150 text-left ${
                id === activeNav
                  ? 'bg-[#FFCE00] text-[#00305E] font-semibold'
                  : 'text-white/60 hover:bg-white/10 hover:text-white'
              }`}>
              <Icon size={17} className="flex-shrink-0" />
              <span className="text-sm">{label}</span>
            </button>
          ))}
        </nav>

        {/* Logout */}
        <div className="px-3 pb-5 border-t border-white/10 pt-3">
          <button onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-white/70 hover:bg-white/10 hover:text-white transition-colors text-left">
            <LogOut size={17} />
            <span className="font-medium text-sm">{t('logout')}</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-[#E2E8F0] px-5 py-3.5 flex items-center gap-4 flex-shrink-0 shadow-[0_1px_3px_rgba(0,48,94,0.05)]">
          <button className="lg:hidden p-2 rounded-[8px] hover:bg-[#F5F7FA] text-[#64748B]" onClick={() => setSidebarOpen(true)}>
            <Menu size={18} />
          </button>
          <div>
            <h1 className="text-[#0F172A] text-base font-bold">{title}</h1>
            {subtitle && <p className="text-[#94A3B8] text-xs">{subtitle}</p>}
          </div>
          <div className="ml-auto flex items-center gap-3">
            <NotificationBell buttonClassName="p-2 rounded-[8px] border border-[#E2E8F0] bg-[#FAFBFC] hover:bg-[#F5F7FA] transition-colors" />
            {lastSyncedAt && (
              <p className="hidden md:block text-xs text-[#94A3B8]">
                {t('lastUpdated')}: {lastSyncedAt.toLocaleTimeString()}
              </p>
            )}
            {onRefresh && (
              <button onClick={onRefresh} disabled={refreshing}
                className="inline-flex items-center gap-1.5 px-3 h-9 rounded-[8px] border border-[#E2E8F0] bg-[#FAFBFC] text-sm text-[#64748B] hover:bg-[#F5F7FA] transition-colors">
                <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
                {refreshing ? t('refreshing') : t('refresh')}
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-[10px]">
              {error}
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  )
}
