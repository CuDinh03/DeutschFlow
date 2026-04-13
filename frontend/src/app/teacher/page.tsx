'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import {
  LayoutDashboard,
  BookOpen,
  Users,
  Settings,
  Bell,
  Menu,
  X,
  LogOut,
  Plus,
  Play,
  Clock,
  TrendingUp,
  BookMarked,
  GraduationCap,
  ClipboardList,
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
  { id: 'classes', label: 'Lớp học', icon: Users },
  { id: 'quizzes', label: 'Quiz', icon: ClipboardList },
  { id: 'materials', label: 'Tài liệu', icon: BookOpen },
  { id: 'settings', label: 'Cài đặt', icon: Settings },
]

export default function TeacherPage() {
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
        if (userData.role !== 'TEACHER') {
          // Redirect nếu không phải teacher
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
            <span className="text-accent-foreground font-bold text-xl">D</span>
          </div>
          <span className="font-bold text-xl">DeutschFlow</span>
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
              <p className="text-white/50 text-xs">Giáo viên</p>
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
                Xin chào, <span className="text-primary font-semibold">Thầy/Cô {firstName}</span>! 👋
              </h1>
              <p className="text-muted-foreground text-sm mt-0.5">Quản lý lớp học và tạo bài kiểm tra</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button className="relative p-2.5 rounded-lg bg-muted hover:bg-muted/80 transition-colors">
              <Bell size={18} className="text-muted-foreground" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-accent rounded-full border border-card" />
            </button>

            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-primary-hover flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-sm">{user.displayName.charAt(0).toUpperCase()}</span>
            </div>
          </div>
        </header>

        {/* Scrollable Main */}
        <main className="flex-1 overflow-y-auto px-6 py-6">
          {/* Stats Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              { icon: Users, label: 'Học sinh', value: '45', color: 'text-info', bg: 'bg-info/10' },
              { icon: BookOpen, label: 'Lớp học', value: '3', color: 'text-success', bg: 'bg-success/10' },
              { icon: ClipboardList, label: 'Quiz đã tạo', value: '12', color: 'text-accent', bg: 'bg-accent/10' },
              { icon: TrendingUp, label: 'TB hoàn thành', value: '87%', color: 'text-primary', bg: 'bg-primary/10' },
            ].map(({ icon: Icon, label, value, color, bg }) => (
              <div key={label} className="card p-4">
                <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center mb-3`}>
                  <Icon size={18} className={color} />
                </div>
                <p className="text-muted-foreground text-xs mb-0.5">{label}</p>
                <p className="font-bold text-foreground text-base">{value}</p>
              </div>
            ))}
          </div>

          {/* Quick Actions */}
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div className="bg-gradient-to-br from-primary via-primary-hover to-navy-blue-dark rounded-xl p-6 text-white shadow-lg relative overflow-hidden">
              <div className="absolute -top-8 -right-8 w-48 h-48 rounded-full bg-white/5" />
              <div className="relative z-10">
                <GraduationCap size={32} className="mb-4" />
                <h3 className="text-xl font-semibold mb-2">Tạo Quiz mới</h3>
                <p className="text-white/70 text-sm mb-4">
                  Tạo bài kiểm tra tương tác với leaderboard realtime
                </p>
                <button className="btn-accent btn-md">
                  <Plus size={16} />
                  Tạo Quiz
                </button>
              </div>
            </div>

            <div className="bg-gradient-to-br from-accent via-accent-hover to-vibrant-yellow-dark rounded-xl p-6 text-accent-foreground shadow-lg relative overflow-hidden">
              <div className="absolute -top-8 -right-8 w-48 h-48 rounded-full bg-white/10" />
              <div className="relative z-10">
                <BookMarked size={32} className="mb-4" />
                <h3 className="text-xl font-semibold mb-2">Quản lý tài liệu</h3>
                <p className="text-accent-foreground/70 text-sm mb-4">
                  Upload và chia sẻ tài liệu học tập với học sinh
                </p>
                <button className="btn-primary btn-md">
                  <Plus size={16} />
                  Thêm tài liệu
                </button>
              </div>
            </div>
          </div>

          {/* Recent Classes */}
          <div className="card p-6 mb-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold text-foreground">Lớp học gần đây</h3>
              <button className="text-primary text-sm font-medium hover:text-primary-hover">
                Xem tất cả
              </button>
            </div>
            <div className="space-y-4">
              {[
                { name: 'A1 - Cơ bản', students: 18, progress: 65, nextLesson: 'Hôm nay, 14:00' },
                { name: 'A2 - Sơ cấp', students: 15, progress: 42, nextLesson: 'Thứ 3, 10:00' },
                { name: 'B1 - Trung cấp', students: 12, progress: 78, nextLesson: 'Thứ 5, 16:00' },
              ].map((cls) => (
                <div key={cls.name} className="flex items-center gap-4 p-4 bg-muted rounded-lg hover:shadow-md transition-shadow">
                  <div className="w-12 h-12 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
                    <BookOpen size={20} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-foreground">{cls.name}</h4>
                    <p className="text-sm text-muted-foreground">{cls.students} học sinh · Tiến độ {cls.progress}%</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground mb-1">Buổi tiếp theo</p>
                    <div className="flex items-center gap-1 text-sm font-medium text-foreground">
                      <Clock size={14} />
                      {cls.nextLesson}
                    </div>
                  </div>
                  <button className="btn-primary btn-sm">
                    <Play size={14} />
                    Vào lớp
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Quizzes */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold text-foreground">Quiz gần đây</h3>
              <button className="text-primary text-sm font-medium hover:text-primary-hover">
                Xem tất cả
              </button>
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              {[
                { title: 'Gender Quiz A1', participants: 24, avgScore: 85 },
                { title: 'Verb Conjugation', participants: 18, avgScore: 72 },
                { title: 'Vocabulary Test', participants: 30, avgScore: 91 },
              ].map((quiz) => (
                <div key={quiz.title} className="p-4 bg-muted rounded-lg hover:shadow-md transition-shadow">
                  <h4 className="font-semibold text-foreground mb-3">{quiz.title}</h4>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center justify-between">
                      <span>Người tham gia</span>
                      <span className="font-medium text-foreground">{quiz.participants}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Điểm TB</span>
                      <span className="font-medium text-success">{quiz.avgScore}%</span>
                    </div>
                  </div>
                  <button className="btn-secondary btn-sm w-full mt-4">
                    Xem chi tiết
                  </button>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
