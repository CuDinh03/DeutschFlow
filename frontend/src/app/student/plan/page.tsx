'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import api, { httpStatus } from '@/lib/api'
import { getAccessToken, clearTokens } from '@/lib/authSession'
import { StudentShell } from '@/components/layouts/StudentShell'
import { BookOpen, Trophy, Target, Sparkles, Check, Play, Lock } from 'lucide-react'

type Session = {
  index: number
  type: string
  minutes: number
  difficulty?: number
  skills?: string[]
}

type Week = {
  week: number
  objectives: string[]
  sessions: Session[]
}

type Plan = {
  weeks?: Week[]
  weeklyMinutes?: number
  targetLevel?: string
  progress?: {
    currentWeek?: number
    currentSessionIndex?: number
    completedSessions?: number
  }
}

function sessionTypeTheme(type?: string) {
  switch (type) {
    case 'GRAMMAR':
      return { badge: 'bg-blue-100 text-blue-700 border-blue-200', accent: '#3B82F6' }
    case 'PRACTICE':
      return { badge: 'bg-amber-100 text-amber-800 border-amber-200', accent: '#F59E0B' }
    case 'SPEAKING':
      return { badge: 'bg-violet-100 text-violet-700 border-violet-200', accent: '#8B5CF6' }
    case 'REVIEW':
      return { badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', accent: '#10B981' }
    default:
      return { badge: 'bg-slate-100 text-slate-600 border-slate-200', accent: '#94A3B8' }
  }
}

function weekState(week: number, currentWeek: number): 'completed' | 'current' | 'locked' {
  if (week < currentWeek) return 'completed'
  if (week === currentWeek) return 'current'
  return 'locked'
}

export default function StudentPlanPage() {
  const t = useTranslations('student') // Use 'student' to match StudentShell translations
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [plan, setPlan] = useState<Plan | null>(null)
  const [me, setMe] = useState<{ displayName: string; role: string } | null>(null)
  const [streakDays, setStreakDays] = useState(0)
  const [apiError, setApiError] = useState('')

  useEffect(() => {
    if (!getAccessToken()) {
      router.push('/login')
      return
    }

    ;(async () => {
      try {
        const [planRes, meRes, dashRes] = await Promise.all([
          api.get<{ plan?: Plan }>('/plan/me'),
          api.get('/auth/me'),
          api.get<{ streakDays?: number }>('/student/dashboard').catch(() => null),
        ])
        setPlan(planRes.data.plan || null)
        setMe(meRes.data)
        setStreakDays(Number(dashRes?.data?.streakDays ?? 0))
      } catch (err: any) {
        if (httpStatus(err) === 404) {
          router.push('/onboarding')
        } else {
          setApiError('Không thể tải lộ trình học.')
        }
      } finally {
        setLoading(false)
      }
    })()
  }, [router])

  const initials = useMemo(() => {
    return (me?.displayName ?? 'U')
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }, [me])

  if (loading || !me) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F5F7FA]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#00305E]/20 border-t-[#00305E] rounded-full animate-spin" />
          <p className="text-[#64748B] font-medium">Laden...</p>
        </div>
      </div>
    )
  }

  const current = plan?.progress || { currentWeek: 1, currentSessionIndex: 0 }
  const weeks = plan?.weeks || []
  const completedWeeks = weeks.filter(w => weekState(w.week, current.currentWeek || 1) === 'completed').length
  const currentWeekObj = weeks.find(w => w.week === current.currentWeek)
  const currentSession = currentWeekObj?.sessions?.find(s => s.index === current.currentSessionIndex)

  return (
    <StudentShell
      activeSection="courses"
      user={me}
      targetLevel={plan?.targetLevel ?? 'A1'}
      streakDays={streakDays}
      initials={initials}
      onLogout={() => {
        clearTokens()
        router.push('/login')
      }}
      headerTitle={t('navMyCourses')}
    >
      <div className="min-h-full">
        <div
          className="relative overflow-hidden rounded-[24px] mb-8"
          style={{
            background: 'linear-gradient(135deg, #00305E 0%, #004080 60%, #0052A3 100%)',
            borderBottom: '3px solid rgba(255,206,0,0.3)',
          }}
        >
          <div className="absolute -top-12 -right-12 w-52 h-52 rounded-full bg-white/5" />
          <div className="absolute -bottom-16 right-32 w-40 h-40 rounded-full bg-[#FFCE00]/8" />

          <div className="relative px-8 py-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div
                className="w-14 h-14 rounded-[18px] flex items-center justify-center"
                style={{
                  background: 'linear-gradient(145deg, #FFD940, #FFCE00)',
                  boxShadow: '0 4px 0 0 #C9A200, 0 6px 14px rgba(255,206,0,0.3)',
                }}
              >
                <BookOpen className="w-7 h-7 text-[#00305E]" />
              </div>
              <div>
                <h1 className="text-white font-extrabold text-2xl tracking-tight">{t('navMyCourses')}</h1>
                <p className="text-white/60 text-sm">Tuần {current.currentWeek}, Bài {current.currentSessionIndex}</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="bg-white/10 backdrop-blur-md rounded-[16px] px-5 py-3 border border-white/10">
                <p className="text-white/60 text-[10px] uppercase font-bold tracking-wider mb-0.5">Trình độ mục tiêu</p>
                <div className="flex items-center gap-2">
                  <Target size={16} className="text-[#FFCE00]" />
                  <span className="text-white font-extrabold">{plan?.targetLevel}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="page-container max-w-5xl w-full px-4 sm:px-5 py-6 grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
          {apiError && (
            <div className="lg:col-span-3 p-4 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm">
              {apiError}
            </div>
          )}

          <div className="hidden lg:flex flex-col gap-4">
            <div className="bg-white rounded-[16px] p-4 shadow-[0_2px_8px_rgba(0,48,94,0.06)] border border-[#E2E8F0]">
              <div className="w-10 h-10 rounded-[12px] flex items-center justify-center mb-3 bg-[#FFF8E1]">
                <Trophy className="w-[18px] h-[18px] text-amber-600" />
              </div>
              <p className="text-[#64748B] text-xs mb-0.5">Trình độ</p>
              <p className="text-[#0F172A] font-extrabold text-xl">{plan?.targetLevel ?? 'A1'}</p>
            </div>
            <div className="bg-white rounded-[16px] p-4 shadow-[0_2px_8px_rgba(0,48,94,0.06)] border border-[#E2E8F0]">
              <div className="w-10 h-10 rounded-[12px] flex items-center justify-center mb-3 bg-[#EEF4FF]">
                <Target className="w-[18px] h-[18px] text-[#00305E]" />
              </div>
              <p className="text-[#64748B] text-xs mb-0.5">Thời gian/Tuần</p>
              <p className="text-[#0F172A] font-extrabold text-xl">{plan?.weeklyMinutes || '—'} Phút</p>
            </div>
            <button 
              className="w-full py-3 rounded-xl border-2 border-[#00305E] text-[#00305E] font-bold hover:bg-[#00305E]/5 transition-colors"
              onClick={() => router.push('/student/vocabulary')}
            >
              Mở từ vựng
            </button>
          </div>

          <div className="lg:col-span-2">
            <div className="bg-white rounded-[20px] p-5 sm:p-6 border-2 border-[#E2E8F0] shadow-[0_4px_24px_rgba(0,48,94,0.07)]">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="font-bold text-[#0F172A]">Lộ trình của bạn</h2>
                  <p className="text-[#94A3B8] text-xs mt-0.5">
                    {completedWeeks} / {weeks.length} tuần đã hoàn thành
                  </p>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-[10px] text-xs font-semibold bg-[#EEF4FF] text-[#00305E] border border-[#00305E]/15">
                  <Sparkles size={12} />
                  Lộ trình CEFR
                </div>
              </div>

              <div className="flex flex-col items-stretch gap-8">
                {weeks.map((w, i) => {
                  const state = weekState(w.week, current.currentWeek || 1)
                  const isLocked = state === 'locked'
                  const isCurrent = state === 'current'
                  const isCompleted = state === 'completed'
                  const cardAccent = isCurrent ? '#FFCE00' : isCompleted ? '#10B981' : '#94A3B8'
                  const left = i % 2 === 0
                  const currentWeekSessionTotal = w.sessions?.length ?? 0
                  const completedInWeek =
                    isCompleted
                      ? currentWeekSessionTotal
                      : isCurrent
                        ? Math.max(0, (current.currentSessionIndex || 1) - 1)
                        : 0

                  return (
                    <div key={w.week} className="relative">
                      <div className="flex items-center w-full">
                        <div className="flex-1 flex justify-end pr-5">
                          {left && (
                            <div
                              className="rounded-[16px] p-4 max-w-[260px] w-full"
                              style={{
                                background: 'white',
                                border: `2px solid ${cardAccent}44`,
                                boxShadow: '0 2px 10px rgba(0,48,94,0.06)',
                                opacity: isLocked ? 0.65 : 1,
                              }}
                            >
                              <p className="font-bold text-sm text-slate-900">Tuần {w.week}</p>
                              <p className="text-xs text-slate-500 mt-1">{w.objectives?.[0] || 'Mục tiêu học tập'}</p>
                              <div className="mt-3 w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${currentWeekSessionTotal > 0 ? Math.round((completedInWeek / currentWeekSessionTotal) * 100) : 0}%`,
                                    background: cardAccent,
                                  }}
                                />
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col items-center relative z-10">
                          <button
                            type="button"
                            className="relative flex items-center justify-center rounded-full transition-transform hover:scale-110 active:scale-95"
                            style={{
                              width: isCurrent ? 76 : 66,
                              height: isCurrent ? 76 : 66,
                              background: isCompleted
                                ? 'linear-gradient(145deg, #34D399, #10B981)'
                                : isCurrent
                                  ? 'linear-gradient(145deg, #FFD940, #FFCE00)'
                                  : 'linear-gradient(145deg, #E2E8F0, #CBD5E1)',
                              boxShadow: isCompleted
                                ? '0 6px 0 0 #059669, 0 10px 28px rgba(16,185,129,0.3)'
                                : isCurrent
                                  ? '0 6px 0 0 #C9A200, 0 10px 28px rgba(255,206,0,0.35)'
                                  : '0 4px 0 0 #94A3B8, 0 6px 16px rgba(0,0,0,0.1)',
                              border: '3px solid rgba(255,255,255,0.7)',
                            }}
                            onClick={() => {
                              if (isLocked) return
                              const target = isCurrent ? (current.currentSessionIndex || 1) : 1
                              router.push(`/student/plan/week/${w.week}/session/${target}`)
                            }}
                          >
                            {isCompleted ? (
                              <Check size={26} className="text-white" strokeWidth={3} />
                            ) : isCurrent ? (
                              <Play size={24} className="text-[#00305E] fill-[#00305E]" />
                            ) : (
                              <Lock size={18} className="text-slate-500" />
                            )}
                          </button>
                        </div>

                        <div className="flex-1 pl-5">
                          {!left && (
                            <div
                              className="rounded-[16px] p-4 max-w-[260px] w-full"
                              style={{
                                background: 'white',
                                border: `2px solid ${cardAccent}44`,
                                boxShadow: '0 2px 10px rgba(0,48,94,0.06)',
                                opacity: isLocked ? 0.65 : 1,
                              }}
                            >
                              <p className="font-bold text-sm text-slate-900">Tuần {w.week}</p>
                              <p className="text-xs text-slate-500 mt-1">{w.objectives?.[0] || 'Mục tiêu học tập'}</p>
                              <div className="mt-3 w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${currentWeekSessionTotal > 0 ? Math.round((completedInWeek / currentWeekSessionTotal) * 100) : 0}%`,
                                    background: cardAccent,
                                  }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </StudentShell>
  )
}
