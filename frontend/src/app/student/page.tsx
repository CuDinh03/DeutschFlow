'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import api from '@/lib/api'
import { clearAuthCookies } from '@/lib/authSession'
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

type DashboardStats = {
  streakDays: number
  weeklyXp: number
  completedSessionsTotal: number
  completedSessionsThisWeek: number
  weeklyMinutesByDay: number[]
  weeklyMinutesStudied: number
  avgMinutesPerDayThisWeek: number
  planProgressPercent: number
  sessionsPerWeek: number
  minutesPerSession: number
  weeklyTargetMinutes: number
  weeksTotal: number
  totalSessionsInPlan: number
}

const genderDefs = [
  {
    gender: 'DER',
    color: 'bg-gender-der',
    textColor: 'text-gender-der',
    bgLight: 'bg-blue-50',
    labelKey: 'genderDer' as const,
    icon: 'M',
    examples: ['der Tisch', 'der Stuhl', 'der Mann'],
  },
  {
    gender: 'DIE',
    color: 'bg-gender-die',
    textColor: 'text-gender-die',
    bgLight: 'bg-red-50',
    labelKey: 'genderDie' as const,
    icon: 'F',
    examples: ['die Frau', 'die Mutter', 'die Stadt'],
  },
  {
    gender: 'DAS',
    color: 'bg-gender-das',
    textColor: 'text-gender-das',
    bgLight: 'bg-green-50',
    labelKey: 'genderDas' as const,
    icon: 'N',
    examples: ['das Kind', 'das Haus', 'das Buch'],
  },
]

function sessionTypeLabel(t: (key: string) => string, type: string | undefined) {
  switch (type) {
    case 'GRAMMAR':
      return t('sessionTypeGRAMMAR')
    case 'PRACTICE':
      return t('sessionTypePRACTICE')
    case 'SPEAKING':
      return t('sessionTypeSPEAKING')
    case 'REVIEW':
      return t('sessionTypeREVIEW')
    default:
      return type ?? '—'
  }
}

export default function DashboardPage() {
  const t = useTranslations('student')
  const tErr = useTranslations('errors')
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeNav, setActiveNav] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [plan, setPlan] = useState<any>(null)
  const [dashboard, setDashboard] = useState<DashboardStats | null>(null)
  const [apiError, setApiError] = useState<string>('')

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
          router.push(`/${userData.role.toLowerCase()}`)
          return Promise.reject(new Error('redirect'))
        }
        setUser(userData)
        return Promise.all([api.get('/plan/me'), api.get('/student/dashboard')])
      })
      .then((res) => {
        if (!res) return
        const [planRes, dashRes] = res
        if (planRes?.data?.plan) setPlan(planRes.data.plan)
        if (dashRes?.data) setDashboard(dashRes.data)
      })
      .catch((err: any) => {
        if (err?.message === 'redirect') return
        const status = err?.response?.status
        if (status === 404) {
          router.push('/onboarding')
          return
        }
        if (status === 401 || status === 403) {
          localStorage.removeItem('accessToken')
          localStorage.removeItem('refreshToken')
          clearAuthCookies()
          router.push('/login')
          return
        }
        setApiError(tErr('backendUnreachable'))
      })
      .finally(() => setLoading(false))
  }, [router, tErr])

  const handleLogout = () => {
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    clearAuthCookies()
    router.push('/')
  }

  const navItems = useMemo(
    () => [
      { id: 'dashboard', label: t('navDashboard'), icon: LayoutDashboard },
      { id: 'plan', label: t('navPlan'), icon: BookOpen },
      { id: 'speaking', label: t('navSpeaking'), icon: Mic2 },
      { id: 'legoGame', label: 'Lego Game', icon: Trophy },
      { id: 'vocabulary', label: t('navVocabulary'), icon: BookMarked },
      { id: 'settings', label: t('navSettings'), icon: Settings },
    ],
    [t]
  )

  const chartDayKeys = useMemo(
    () => ['chartMon', 'chartTue', 'chartWed', 'chartThu', 'chartFri', 'chartSat', 'chartSun'] as const,
    []
  )

  const weeklyChartData = useMemo(() => {
    const mins = dashboard?.weeklyMinutesByDay ?? [0, 0, 0, 0, 0, 0, 0]
    return chartDayKeys.map((key, i) => ({
      day: t(key),
      minutes: mins[i] ?? 0,
    }))
  }, [dashboard?.weeklyMinutesByDay, chartDayKeys, t])

  const progress = plan?.progress ?? {}
  const currentWeek = Number(progress.currentWeek ?? 1)
  const currentSessionIndex = Number(progress.currentSessionIndex ?? 1)
  const targetLevel = plan?.targetLevel ?? 'A1'

  const currentWeekBlock = useMemo(() => {
    return plan?.weeks?.find?.((w: any) => Number(w.week) === currentWeek) ?? plan?.weeks?.[0]
  }, [plan, currentWeek])

  const nextSession = useMemo(() => {
    const sessions = currentWeekBlock?.sessions
    if (!Array.isArray(sessions)) return null
    return sessions.find((s: any) => Number(s.index) === currentSessionIndex) ?? null
  }, [currentWeekBlock, currentSessionIndex])

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card rounded-lg shadow-lg px-3 py-2 border border-border">
          <p className="text-muted-foreground text-xs mb-1">{label}</p>
          <p className="text-foreground font-semibold text-sm">{t('minutesShort', { n: payload[0].value })}</p>
        </div>
      )
    }
    return null
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
          <p className="text-muted-foreground">{t('loading')}</p>
        </div>
      </div>
    )
  }

  if (!user) return null

  const firstName = user.displayName.split(' ')[0]
  const d = dashboard
  const streak = d?.streakDays ?? 0
  const weeklyXp = d?.weeklyXp ?? 0
  const completedTotal = d?.completedSessionsTotal ?? 0
  const avgDay = d?.avgMinutesPerDayThisWeek ?? 0
  const planPct = d?.planProgressPercent ?? 0
  const weeklyStudied = d?.weeklyMinutesStudied ?? 0
  const weeklyTarget = d?.weeklyTargetMinutes ?? (Number(plan?.weeklyMinutes) || 0)
  const perWeek = d?.sessionsPerWeek ?? currentWeekBlock?.sessions?.length ?? 0

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

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
                if (id === 'plan') router.push('/student/plan')
                if (id === 'legoGame') router.push('/student/game')
                if (id === 'vocabulary') router.push('/student/vocabulary')
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

        <div className="px-3 pb-6 space-y-2">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-white/70 hover:bg-white/10 hover:text-white transition-all"
          >
            <LogOut size={19} />
            <span className="font-medium text-sm">{t('logout')}</span>
          </button>

          <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-white/8 border border-white/10">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-accent to-accent-hover flex items-center justify-center flex-shrink-0">
              <span className="text-accent-foreground font-bold text-sm">
                {user.displayName.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm text-white truncate">{user.displayName}</p>
              <p className="text-white/50 text-xs">{t('roleLevel', { role: user.role, level: targetLevel })}</p>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
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
                {t('greeting', { name: firstName })} 👋
              </h1>
              <p className="text-muted-foreground text-sm mt-0.5">{t('subtitle')}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-accent/10 border border-accent/40 rounded-lg px-3 py-2">
              <Flame size={18} className="text-orange-500" fill="#f97316" />
              <span className="font-bold text-primary text-sm">{t('streakDays', { n: streak })}</span>
            </div>

            <button type="button" className="relative p-2.5 rounded-lg bg-muted hover:bg-muted/80 transition-colors">
              <Bell size={18} className="text-muted-foreground" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-accent rounded-full border border-card" />
            </button>

            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-primary-hover flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-sm">{user.displayName.charAt(0).toUpperCase()}</span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto page-container max-w-[1200px] px-6 py-6">
          {apiError && (
            <div className="mb-6 p-4 rounded-lg border border-destructive/20 bg-destructive/10 text-destructive text-sm">
              {apiError}
            </div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              {
                icon: Flame,
                label: t('statsStreak'),
                value: t('streakDays', { n: streak }),
                color: 'text-orange-500',
                bgColor: 'bg-orange-50',
                fill: '#f97316',
              },
              {
                icon: Trophy,
                label: t('statsWeekXp'),
                value: `${weeklyXp} XP`,
                color: 'text-accent',
                bgColor: 'bg-accent/10',
                fill: 'var(--accent)',
              },
              {
                icon: Target,
                label: t('statsSessions'),
                value: String(completedTotal),
                color: 'text-success',
                bgColor: 'bg-success/10',
                fill: undefined,
              },
              {
                icon: Zap,
                label: t('statsAvgDay'),
                value: t('minutesShort', { n: avgDay }),
                color: 'text-info',
                bgColor: 'bg-info/10',
                fill: undefined,
              },
            ].map(({ icon: Icon, label, value, color, bgColor, fill }) => (
              <div key={label} className="section-card p-4">
                <div className={`w-9 h-9 rounded-lg ${bgColor} flex items-center justify-center mb-3`}>
                  <Icon size={18} className={color} fill={fill} />
                </div>
                <p className="text-muted-foreground text-xs mb-0.5">{label}</p>
                <p className="font-bold text-foreground text-base">{value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
            <div className="xl:col-span-2">
              <div className="bg-gradient-to-br from-primary via-primary-hover to-navy-blue-dark rounded-xl p-6 text-white shadow-lg relative overflow-hidden">
                <div className="absolute -top-8 -right-8 w-48 h-48 rounded-full bg-white/5" />
                <div className="absolute -bottom-12 -right-4 w-36 h-36 rounded-full bg-accent/10" />

                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <div className="inline-flex items-center gap-1.5 bg-accent text-accent-foreground text-xs font-semibold px-3 py-1 rounded-full mb-3">
                        <TrendingUp size={12} />
                        {t('continueBadge')}
                      </div>
                      <h2 className="text-xl text-white mb-1">
                        {nextSession
                          ? t('continueTitle', { week: currentWeek, session: currentSessionIndex })
                          : t('continueNoPlan')}
                      </h2>
                      <p className="text-white/90 text-sm font-medium">
                        {nextSession ? t('continueType', { type: sessionTypeLabel(t, nextSession.type) }) : ''}
                      </p>
                      <p className="text-white/70 text-sm mt-1">
                        {nextSession
                          ? t('continueMeta', {
                              minutes: nextSession.minutes ?? d?.minutesPerSession ?? 25,
                              skills: Array.isArray(nextSession.skills) ? nextSession.skills.join(', ') : '—',
                              difficulty: nextSession.difficulty ?? '—',
                            })
                          : t('continueOnboardingHint')}
                      </p>
                    </div>
                  </div>

                  <div className="mb-5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white/80 text-sm">{t('progressPlan')}</span>
                      <span className="text-accent font-semibold text-sm">{planPct}%</span>
                    </div>
                    <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent rounded-full transition-all duration-700"
                        style={{ width: `${Math.min(100, Math.max(0, planPct))}%` }}
                      />
                    </div>
                    <div className="flex items-center gap-4 mt-3 text-white/60 text-xs">
                      <span className="flex items-center gap-1">
                        <Clock size={12} />{' '}
                        {nextSession
                          ? t('minutesShort', { n: nextSession.minutes ?? d?.minutesPerSession ?? 25 })
                          : '—'}
                      </span>
                      <span>
                        {perWeek > 0
                          ? t('progressSessionLine', { session: currentSessionIndex, perWeek })
                          : '—'}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn-accent btn-md"
                    disabled={!nextSession}
                    onClick={() => {
                      if (!nextSession) {
                        router.push('/onboarding')
                        return
                      }
                      router.push(`/student/plan/week/${currentWeek}/session/${currentSessionIndex}`)
                    }}
                  >
                    <Play size={16} fill="currentColor" />
                    {nextSession ? t('startSession') : t('goToPlan')}
                  </button>
                </div>
              </div>
            </div>

            <div className="section-card p-5">
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Target size={16} className="text-primary" />
                {currentWeekBlock
                  ? t('weekObjectives', { week: currentWeekBlock.week ?? currentWeek })
                  : t('weekObjectives', { week: 1 })}
              </h3>
              <div className="space-y-3">
                {(currentWeekBlock?.objectives ?? []).slice(0, 6).map((obj: string) => (
                  <div key={obj} className="flex items-start gap-2">
                    <div className="mt-1 w-2 h-2 rounded-full bg-accent flex-shrink-0" />
                    <p className="text-sm text-foreground">{obj}</p>
                  </div>
                ))}
                {(!currentWeekBlock?.objectives || currentWeekBlock.objectives.length === 0) && (
                  <p className="text-sm text-muted-foreground">{t('noObjectives')}</p>
                )}
              </div>
            </div>
          </div>

          <div className="section-card p-6 mb-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-semibold text-foreground">{t('chartTitle')}</h3>
                <p className="text-muted-foreground text-sm mt-0.5">
                  {t('chartSubtitle', { total: weeklyStudied, target: weeklyTarget })}
                </p>
              </div>
              <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-primary" />
                <span className="text-muted-foreground text-xs">{t('chartLegend')}</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={weeklyChartData} barSize={36} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--muted)', radius: 8 }} />
                <Bar dataKey="minutes" fill="var(--primary)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground">{t('genderColorsTitle')}</h3>
              <button
                type="button"
                className="text-primary text-sm font-medium hover:text-primary-hover flex items-center gap-1 transition-colors"
                onClick={() => router.push('/student/vocabulary')}
              >
                {t('viewAll')} <ChevronRight size={14} />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {genderDefs.map(({ gender, color, textColor, bgLight, labelKey, icon, examples }) => (
                <div key={gender} className="section-card p-5 hover:shadow-lg transition-shadow">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center`}>
                      <span className="text-white font-bold text-lg">{icon}</span>
                    </div>
                    <div>
                      <h4 className={`font-semibold ${textColor}`}>{gender}</h4>
                      <p className="text-muted-foreground text-xs">{t(labelKey)}</p>
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
