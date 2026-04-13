'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import {
  LayoutDashboard,
  Users,
  BookOpen,
  Settings,
  Shield,
  Bell,
  Menu,
  X,
  LogOut,
  TrendingUp,
  Database,
  Activity,
  AlertCircle,
  CheckCircle2,
  UserPlus,
} from 'lucide-react'

type User = {
  userId: number
  email: string
  displayName: string
  role: string
  locale: string
}

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'users', label: 'Người dùng', icon: Users },
  { id: 'content', label: 'Nội dung', icon: BookOpen },
  { id: 'system', label: 'Hệ thống', icon: Database },
  { id: 'settings', label: 'Cài đặt', icon: Settings },
]

export default function AdminPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeNav, setActiveNav] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('accessToken')
    if (!token) {
      router.push('/login')
      return
    }

    api
      .get('/auth/me')
      .then((res) => {
        const userData = res.data
        if (userData.role !== 'ADMIN') {
          // Redirect nếu không phải admin
          router.push(`/${userData.role.toLowerCase()}`)
          return
        }
        setUser(userData)
      })
      .catch(() => {
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
        router.push('/login')
      })
      .finally(() => setLoading(false))
  }, [router])

  const handleLogout = () => {
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    router.push('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <svg className="animate-spin h-12 w-12 text-primary" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <p className="text-muted-foreground">Đang tải...</p>
        </div>
      </div>
    )
  }

  if (!user) return null

  const firstName = user.displayName.split(' ')[0]

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:relative z-30 flex flex-col h-full w-64 bg-primary text-primary-foreground transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex items-center gap-3 px-6 py-6 border-b border-white/10">
          <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center flex-shrink-0">
            <Shield size={20} className="text-accent-foreground" />
          </div>
          <span className="font-bold text-xl">Admin Panel</span>
          <button className="ml-auto lg:hidden text-white/60 hover:text-white" onClick={() => setSidebarOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => {
                setActiveNav(id)
                setSidebarOpen(false)
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 text-left ${
                activeNav === id
                  ? 'bg-accent text-accent-foreground shadow-md'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon size={19} className="flex-shrink-0" />
              <span className="font-medium text-sm">{label}</span>
            </button>
          ))}
        </nav>

        <div className="px-3 pb-6 space-y-2">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-white/70 hover:bg-white/10 hover:text-white transition-all"
          >
            <LogOut size={19} />
            <span className="font-medium text-sm">Đăng xuất</span>
          </button>
          
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-white/8 border border-white/10">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-accent to-accent-hover flex items-center justify-center flex-shrink-0">
              <span className="text-accent-foreground font-bold text-sm">
                {user.displayName.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm text-white truncate">{user.displayName}</p>
              <p className="text-white/50 text-xs">Administrator</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="bg-card border-b border-border px-6 py-4 flex items-center justify-between flex-shrink-0 shadow-sm">
          <div className="flex items-center gap-4">
            <button
              className="lg:hidden p-2 rounded-lg hover:bg-muted text-muted-foreground"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={20} />
            </button>
            <div>
              <h1 className="text-xl text-foreground">
                Xin chào, <span className="text-primary font-semibold">{firstName}</span>! 👋
              </h1>
              <p className="text-muted-foreground text-sm mt-0.5">Quản trị hệ thống DeutschFlow</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button className="relative p-2.5 rounded-lg bg-muted hover:bg-muted/80 transition-colors">
              <Bell size={18} className="text-muted-foreground" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full border border-card" />
            </button>

            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-primary-hover flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-sm">{user.displayName.charAt(0).toUpperCase()}</span>
            </div>
          </div>
        </header>

        {/* Scrollable Main */}
        <main className="flex-1 overflow-y-auto px-6 py-6">
          {/* System Status */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              { icon: Users, label: 'Tổng người dùng', value: '156', color: 'text-info', bg: 'bg-info/10', status: 'up' },
              { icon: BookOpen, label: 'Từ vựng', value: '80', color: 'text-success', bg: 'bg-success/10', status: 'up' },
              { icon: Activity, label: 'Uptime', value: '99.9%', color: 'text-success', bg: 'bg-success/10', status: 'ok' },
              { icon: Database, label: 'Database', value: '45 MB', color: 'text-accent', bg: 'bg-accent/10', status: 'ok' },
            ].map(({ icon: Icon, label, value, color, bg, status }) => (
              <div key={label} className="card p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center`}>
                    <Icon size={18} className={color} />
                  </div>
                  {status === 'ok' && <CheckCircle2 size={16} className="text-success" />}
                  {status === 'up' && <TrendingUp size={16} className="text-success" />}
                </div>
                <p className="text-muted-foreground text-xs mb-0.5">{label}</p>
                <p className="font-bold text-foreground text-base">{value}</p>
              </div>
            ))}
          </div>

          {/* Quick Actions */}
          <div className="grid md:grid-cols-3 gap-6 mb-6">
            <button className="card p-6 text-left hover:shadow-xl transition-all">
              <UserPlus size={24} className="text-primary mb-3" />
              <h3 className="font-semibold text-foreground mb-1">Thêm người dùng</h3>
              <p className="text-sm text-muted-foreground">Tạo tài khoản mới cho học sinh hoặc giáo viên</p>
            </button>

            <button className="card p-6 text-left hover:shadow-xl transition-all">
              <BookOpen size={24} className="text-success mb-3" />
              <h3 className="font-semibold text-foreground mb-1">Import từ vựng</h3>
              <p className="text-sm text-muted-foreground">Thêm từ vựng mới từ Wiktionary hoặc CSV</p>
            </button>

            <button className="card p-6 text-left hover:shadow-xl transition-all">
              <Database size={24} className="text-accent mb-3" />
              <h3 className="font-semibold text-foreground mb-1">Backup dữ liệu</h3>
              <p className="text-sm text-muted-foreground">Sao lưu database và cấu hình hệ thống</p>
            </button>
          </div>

          {/* Recent Users */}
          <div className="card p-6 mb-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold text-foreground">Người dùng mới</h3>
              <button className="text-primary text-sm font-medium hover:text-primary-hover">
                Xem tất cả
              </button>
            </div>
            <div className="space-y-3">
              {[
                { name: 'Nguyễn Văn A', email: 'nguyenvana@example.com', role: 'STUDENT', date: '2 giờ trước' },
                { name: 'Trần Thị B', email: 'tranthib@example.com', role: 'STUDENT', date: '5 giờ trước' },
                { name: 'Lê Văn C', email: 'levanc@example.com', role: 'TEACHER', date: '1 ngày trước' },
                { name: 'Phạm Thị D', email: 'phamthid@example.com', role: 'STUDENT', date: '2 ngày trước' },
              ].map((u) => (
                <div key={u.email} className="flex items-center gap-4 p-3 bg-muted rounded-lg">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary-hover flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-bold text-sm">{u.name.charAt(0)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground">{u.name}</p>
                    <p className="text-sm text-muted-foreground truncate">{u.email}</p>
                  </div>
                  <div className="text-right">
                    <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                      u.role === 'TEACHER' ? 'bg-accent/10 text-accent' : 'bg-info/10 text-info'
                    }`}>
                      {u.role}
                    </span>
                    <p className="text-xs text-muted-foreground mt-1">{u.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* System Alerts */}
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-6">
              <AlertCircle size={20} className="text-warning" />
              <h3 className="font-semibold text-foreground">Cảnh báo hệ thống</h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-4 bg-success/10 border border-success/20 rounded-lg">
                <CheckCircle2 size={18} className="text-success flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">Database backup thành công</p>
                  <p className="text-sm text-muted-foreground">Backup tự động đã hoàn tất lúc 03:00 AM</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3 p-4 bg-info/10 border border-info/20 rounded-lg">
                <Activity size={18} className="text-info flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">Cập nhật hệ thống</p>
                  <p className="text-sm text-muted-foreground">Phiên bản mới v1.2.0 đã sẵn sàng để cài đặt</p>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
