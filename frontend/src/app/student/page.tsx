'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import {
  LayoutDashboard,
  BookOpen,
  Mic2,
  BookMarked,
  Settings,
  Flame,
  Bell,
  ChevronRight,
  Play,
  Clock,
  TrendingUp,
  Trophy,
  Target,
  Zap,
  Menu,
  X,
  LogOut,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

type User = {
  userId: number
  email: string
  displayName: string
  role: string
  locale: string
}

const weeklyData = [
  { day: 'Mo', minutes: 25 },
  { day: 'Di', minutes: 40 },
  { day: 'Mi', minutes: 15 },
  { day: 'Do', minutes: 55 },
  { day: 'Fr', minutes: 35 },
  { day: 'Sa', minutes: 60 },
  { day: 'So', minutes: 20 },
]

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'courses', label: 'Bài học', icon: BookOpen },
  { id: 'speaking', label: 'Luyện nói AI', icon: Mic2 },
  { id: 'vocabulary', label: 'Từ vựng', icon: BookMarked },
  { id: 'settings', label: 'Cài đặt', icon: Settings },
]

const genderExamples = [
  {
    gender: 'DER',
    color: 'bg-gender-der',
    textColor: 'text-gender-der',
    bgLight: 'bg-blue-50',
    label: 'Giống đực',
    icon: 'M',
    examples: ['der Tisch', 'der Stuhl', 'der Mann'],
  },
  {
    gender: 'DIE',
    color: 'bg-gender-die',
    textColor: 'text-gender-die',
    bgLight: 'bg-red-50',
    label: 'Giống cái',
    icon: 'F',
    examples: ['die Frau', 'die Mutter', 'die Stadt'],
  },
  {
    gender: 'DAS',
    color: 'bg-gender-das',
    textColor: 'text-gender-das',
    bgLight: 'bg-green-50',
    label: 'Giống trung',
    icon: 'N',
    examples: ['das Kind', 'das Haus', 'das Buch'],
  },
]

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card rounded-lg shadow-lg px-3 py-2 border border-border">
        <p className="text-muted-foreground text-xs mb-1">{label}</p>
        <p className="text-foreground font-semibold text-sm">{payload[0].value} phút</p>
      </div>
    )
  }
  return null
}

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeNav, setActiveNav] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [plan, setPlan] = useState<any>(null)

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
        if (userData.role !== 'STUDENT') {
          // Redirect nếu không phải student
          router.push(`/${userData.role.toLowerCase()}`)
          return
        }
        setUser(userData)

        // Load learning plan (required after onboarding)
        return api.get('/plan/me')
      })
      .then((res) => {
        if (res?.data?.plan) setPlan(res.data.plan)
      })
      .catch(() => {
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
        router.push('/onboarding')
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

  const totalMinutes = weeklyData.reduce((sum, d) => sum + d.minutes, 0)
  const avgMinutes = Math.round(totalMinutes / weeklyData.length)
  const firstName = user.displayName.split(' ')[0]
  const week1 = plan?.weeks?.find?.((w: any) => w.week === 1) ?? plan?.weeks?.[0]
  const todaySession = week1?.sessions?.[0]

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
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-6 border-b border-white/10">
          <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center flex-shrink-0">
            <span className="text-accent-foreground font-bold text-xl">D</span>
          </div>
          <span className="font-bold text-xl">DeutschFlow</span>
          <button className="ml-auto lg:hidden text-white/60 hover:text-white" onClick={() => setSidebarOpen(false)}>
            <X size={20} />
          </button>
        </div>

        {/* Nav Links */}
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
              {activeNav === id && <ChevronRight size={14} className="ml-auto opacity-60" />}
            </button>
          ))}
        </nav>

        {/* User Profile */}
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
              <p className="text-white/50 text-xs">
                {user.role} · Cấp độ A1
              </p>
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
              <p className="text-muted-foreground text-sm mt-0.5">Tiếp tục hành trình học tiếng Đức của bạn</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Streak Badge */}
            <div className="flex items-center gap-2 bg-accent/10 border border-accent/40 rounded-lg px-3 py-2">
              <Flame size={18} className="text-orange-500" fill="#f97316" />
              <span className="font-bold text-primary text-sm">7 ngày</span>
            </div>

            {/* Notification */}
            <button className="relative p-2.5 rounded-lg bg-muted hover:bg-muted/80 transition-colors">
              <Bell size={18} className="text-muted-foreground" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-accent rounded-full border border-card" />
            </button>

            {/* Avatar */}
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
              {
                icon: Flame,
                label: 'Chuỗi ngày học',
                value: '7 ngày',
                color: 'text-orange-500',
                bgColor: 'bg-orange-50',
                fill: '#f97316',
              },
              {
                icon: Trophy,
                label: 'XP tuần này',
                value: '1.240 XP',
                color: 'text-accent',
                bgColor: 'bg-accent/10',
                fill: 'var(--accent)',
              },
              {
                icon: Target,
                label: 'Hoàn thành',
                value: '28 bài',
                color: 'text-success',
                bgColor: 'bg-success/10',
                fill: undefined,
              },
              {
                icon: Zap,
                label: 'TB mỗi ngày',
                value: `${avgMinutes} phút`,
                color: 'text-info',
                bgColor: 'bg-info/10',
                fill: undefined,
              },
            ].map(({ icon: Icon, label, value, color, bgColor, fill }) => (
              <div key={label} className="card p-4">
                <div className={`w-9 h-9 rounded-lg ${bgColor} flex items-center justify-center mb-3`}>
                  <Icon size={18} className={color} fill={fill} />
                </div>
                <p className="text-muted-foreground text-xs mb-0.5">{label}</p>
                <p className="font-bold text-foreground text-base">{value}</p>
              </div>
            ))}
          </div>

          {/* Main Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
            {/* Continue Learning Card */}
            <div className="xl:col-span-2">
              <div className="bg-gradient-to-br from-primary via-primary-hover to-navy-blue-dark rounded-xl p-6 text-white shadow-lg relative overflow-hidden">
                {/* Decorative circles */}
                <div className="absolute -top-8 -right-8 w-48 h-48 rounded-full bg-white/5" />
                <div className="absolute -bottom-12 -right-4 w-36 h-36 rounded-full bg-accent/10" />

                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <div className="inline-flex items-center gap-1.5 bg-accent text-accent-foreground text-xs font-semibold px-3 py-1 rounded-full mb-3">
                        <TrendingUp size={12} />
                        Hôm nay
                      </div>
                      <h2 className="text-xl text-white mb-1">
                        {todaySession ? `Buổi ${todaySession.index}: ${todaySession.type}` : 'Chưa có lộ trình'}
                      </h2>
                      <p className="text-white/70 text-sm">
                        {todaySession
                          ? `${todaySession.minutes} phút · Kỹ năng: ${(todaySession.skills ?? []).join(', ')} · Độ khó: ${todaySession.difficulty ?? '-'}`
                          : 'Hãy hoàn tất onboarding để tạo lộ trình học.'}
                      </p>
                    </div>
                  </div>

                  {/* Progress */}
                  <div className="mb-5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white/80 text-sm">Tiến độ</span>
                      <span className="text-accent font-semibold text-sm">{week1 ? 'Tuần 1' : '--'}</span>
                    </div>
                    <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                      <div className="h-full bg-accent rounded-full transition-all duration-700" style={{ width: '15%' }} />
                    </div>
                    <div className="flex items-center gap-4 mt-3 text-white/60 text-xs">
                      <span className="flex items-center gap-1">
                        <Clock size={12} /> {todaySession ? `${todaySession.minutes} phút` : '--'}
                      </span>
                      <span>{week1?.sessions?.length ? `Buổi 1 / ${week1.sessions.length}` : '—'}</span>
                    </div>
                  </div>

                  <button
                    className="btn-accent btn-md"
                    onClick={() => {
                      if (!todaySession) return
                      if (todaySession.type === 'VOCAB') router.push('/student/vocabulary')
                    }}
                  >
                    <Play size={16} fill="currentColor" />
                    Bắt đầu buổi học
                  </button>
                </div>
              </div>
            </div>

            {/* Daily Goals */}
            <div className="card p-5">
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Target size={16} className="text-primary" />
                Tuần 1 (mục tiêu)
              </h3>
              <div className="space-y-3">
                {(week1?.objectives ?? []).slice(0, 5).map((obj: string) => (
                  <div key={obj} className="flex items-start gap-2">
                    <div className="mt-1 w-2 h-2 rounded-full bg-accent flex-shrink-0" />
                    <p className="text-sm text-foreground">{obj}</p>
                  </div>
                ))}
                {!week1 && <p className="text-sm text-muted-foreground">Chưa có lộ trình. Hãy tạo ở trang onboarding.</p>}
              </div>
            </div>
          </div>

          {/* Weekly Progress Chart */}
          <div className="card p-6 mb-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-semibold text-foreground">Tiến độ tuần này</h3>
                <p className="text-muted-foreground text-sm mt-0.5">
                  Thời gian học · {totalMinutes} phút tổng
                </p>
              </div>
              <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-primary" />
                <span className="text-muted-foreground text-xs">Phút / ngày</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={weeklyData} barSize={36} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--muted)', radius: 8 }} />
                <Bar dataKey="minutes" fill="var(--primary)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Gender System Demo */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground">Hệ thống màu sắc theo giống</h3>
              <button className="text-primary text-sm font-medium hover:text-primary-hover flex items-center gap-1 transition-colors">
                Xem tất cả <ChevronRight size={14} />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {genderExamples.map(({ gender, color, textColor, bgLight, label, icon, examples }) => (
                <div key={gender} className="card p-5 hover:shadow-lg transition-shadow">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center`}>
                      <span className="text-white font-bold text-lg">{icon}</span>
                    </div>
                    <div>
                      <h4 className={`font-semibold ${textColor}`}>{gender}</h4>
                      <p className="text-muted-foreground text-xs">{label}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {examples.map((word) => (
                      <div key={word} className={`${bgLight} rounded-lg px-3 py-2`}>
                        <span className={`font-medium text-sm ${textColor}`}>{word}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
