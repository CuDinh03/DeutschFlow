'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import api, { httpStatus } from '@/lib/api'
import { getAccessToken } from '@/lib/authSession'
import { BookOpen, Check, ChevronLeft, Flame, Lock, Play, Sparkles, Star, Target, Trophy } from 'lucide-react'

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
  const t = useTranslations('plan')
  const tErr = useTranslations('errors')
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [plan, setPlan] = useState<Plan | null>(null)
  const [apiError, setApiError] = useState<string>('')

  useEffect(() => {
    if (!getAccessToken()) {
      router.push('/login')
      return
    }

    api
      .get('/plan/me')
      .then((res) => setPlan(res.data?.plan ?? null))
      .catch((err: unknown) => {
        const status = httpStatus(err)
        if (status === 404) {
          router.push('/onboarding')
          return
        }
        if (status === 401 || status === 403) {
          router.push('/login')
          return
        }
        setApiError(tErr('backendUnreachable'))
      })
      .finally(() => setLoading(false))
  }, [router, t, tErr])

  const progress = plan?.progress
  const current = useMemo(() => {
    const week = progress?.currentWeek ?? 1
    const sessionIndex = progress?.currentSessionIndex ?? 1
    return { week, sessionIndex }
  }, [progress])

  const currentWeek = plan?.weeks?.find?.((w: Week) => w.week === current.week) ?? plan?.weeks?.[0]
  const currentSession =
    currentWeek?.sessions?.find?.((s: Session) => s.index === current.sessionIndex) ?? currentWeek?.sessions?.[0]

  const weeks: Week[] = plan?.weeks ?? []
  const completedWeeks = weeks.filter((w) => weekState(w.week, current.week) === 'completed').length
  const totalXP = completedWeeks * 450 + Math.max(0, current.sessionIndex - 1) * 60
  const weeklyTarget = Number(plan?.weeklyMinutes ?? 0)
  const currentTheme = sessionTypeTheme(currentSession?.type)
  const selectedWeek = currentWeek
  const selectedState = weekState(selectedWeek?.week ?? current.week, current.week)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">{t('loading')}</p>
      </div>
    )
  }

  if (!plan) return null

  return (
    <div
      className="min-h-screen overflow-y-auto"
      style={{
        background: '#F1F4F9',
        backgroundImage: 'radial-gradient(circle, rgba(0,48,94,0.04) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }}
    >
      <div
        className="relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #00305E 0%, #004080 60%, #0052A3 100%)',
          borderBottom: '3px solid rgba(255,206,0,0.3)',
        }}
      >
        <div className="absolute -top-12 -right-12 w-52 h-52 rounded-full bg-white/5" />
        <div className="absolute -bottom-16 right-32 w-40 h-40 rounded-full bg-[#FFCE00]/8" />

        <div className="relative max-w-5xl mx-auto px-5 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-[10px] text-white/70 hover:text-white hover:bg-white/10 transition-colors text-sm font-medium"
            >
              <ChevronLeft size={16} /> Dashboard
            </button>

            <div className="w-px h-8 bg-white/20" />

            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-[12px] flex items-center justify-center"
                style={{
                  background: 'linear-gradient(145deg, #FFD940, #FFCE00)',
                  boxShadow: '0 4px 0 0 #C9A200, 0 6px 14px rgba(255,206,0,0.3)',
                }}
              >
                <BookOpen className="w-5 h-5 text-[#00305E]" />
              </div>
              <div>
                <h1 className="text-white font-extrabold text-xl tracking-tight">{t('title')}</h1>
                <p className="text-white/60 text-xs">{t('subtitle', { week: current.week, session: current.sessionIndex })}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-[14px] bg-[#FFCE00]/15 border border-[#FFCE00]/40">
              <Star size={16} fill="#FFCE00" className="text-[#FFCE00]" />
              <span className="font-extrabold text-white">{totalXP.toLocaleString()}</span>
              <span className="text-white/60 text-xs">XP</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-[14px] bg-orange-500/15 border border-orange-500/40">
              <Flame size={16} fill="#f97316" className="text-orange-400" />
              <span className="font-extrabold text-white">{Math.max(3, completedWeeks + 2)}</span>
              <span className="text-white/60 text-xs">Days</span>
            </div>
          </div>
        </div>

        <div className="relative max-w-5xl mx-auto px-5 pb-4">
          <div className="flex gap-1.5">
            {weeks.map((w) => {
              const state = weekState(w.week, current.week)
              return (
                <div
                  key={w.week}
                  className="flex-1 h-1.5 rounded-full"
                  style={{
                    background:
                      state === 'completed'
                        ? '#FFCE00'
                        : state === 'current'
                          ? 'rgba(255,206,0,0.4)'
                          : 'rgba(255,255,255,0.12)',
                  }}
                />
              )
            })}
          </div>
        </div>
      </div>

      <div className="page-container max-w-5xl w-full px-4 sm:px-5 py-6 grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        {apiError && (
          <div className="lg:col-span-3 p-4 rounded-lg border border-destructive/20 bg-destructive/10 text-destructive text-sm">
            {apiError}
          </div>
        )}

        <div className="hidden lg:flex flex-col gap-4">
          <div className="section-card border-2 border-[#E2E8F0] rounded-[16px]">
            <div className="w-10 h-10 rounded-[12px] flex items-center justify-center mb-3 bg-[#FFF8E1]">
              <Trophy className="w-[18px] h-[18px] text-amber-600" />
            </div>
            <p className="text-[#64748B] text-xs mb-0.5">Target</p>
            <p className="text-[#0F172A] font-extrabold text-xl">{plan?.targetLevel ?? 'A1'}</p>
            <p className="text-[#94A3B8] text-xs mt-0.5">{t('week', { n: current.week })}</p>
          </div>
          <div className="section-card border-2 border-[#E2E8F0] rounded-[16px]">
            <div className="w-10 h-10 rounded-[12px] flex items-center justify-center mb-3 bg-[#EEF4FF]">
              <Target className="w-[18px] h-[18px] text-[#00305E]" />
            </div>
            <p className="text-[#64748B] text-xs mb-0.5">Minutes/Week</p>
            <p className="text-[#0F172A] font-extrabold text-xl">{weeklyTarget || '—'}</p>
            <p className="text-[#94A3B8] text-xs mt-0.5">Study target</p>
          </div>
          <button className="btn-outline btn-md" onClick={() => router.push('/student/vocabulary')}>
            {t('openVocabulary')}
          </button>
        </div>

        <div className="lg:col-span-2">
          <div className="section-card rounded-[20px] p-5 sm:p-6 border-2 border-[#E2E8F0] shadow-[0_4px_24px_rgba(0,48,94,0.07)]">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="font-bold text-[#0F172A]">Roadmap</h2>
                <p className="text-[#94A3B8] text-xs mt-0.5">
                  {completedWeeks} / {weeks.length} completed
                </p>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-[10px] text-xs font-semibold bg-[#EEF4FF] text-[#00305E] border border-[#00305E]/15">
                <Sparkles size={12} />
                CEFR Path
              </div>
            </div>

            <div className="flex flex-col items-stretch">
              {weeks.map((w, i) => {
                const state = weekState(w.week, current.week)
                const isLocked = state === 'locked'
                const isCurrent = state === 'current'
                const isCompleted = state === 'completed'
                const cardAccent = isCurrent ? '#FFCE00' : isCompleted ? '#10B981' : '#94A3B8'
                const left = i % 2 === 0
                const currentWeekSessionTotal = w.sessions?.length ?? 0
                const completedInWeek =
                  state === 'completed'
                    ? currentWeekSessionTotal
                    : isCurrent
                      ? Math.max(0, current.sessionIndex - 1)
                      : 0

                return (
                  <div key={w.week} className="mb-2">
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
                            <p className="font-bold text-sm text-slate-900">
                              {t('week', { n: w.week })}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">{(w.objectives ?? [])[0] || 'Learning objectives'}</p>
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
                          className="relative flex items-center justify-center rounded-full"
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
                            const target = isCurrent ? current.sessionIndex : w.sessions?.[0]?.index ?? 1
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
                        <div
                          className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white border-2 border-white"
                          style={{ background: isCurrent ? '#C9A200' : isCompleted ? '#059669' : '#94A3B8' }}
                        >
                          {w.week}
                        </div>
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
                            <p className="font-bold text-sm text-slate-900">
                              {t('week', { n: w.week })}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">{(w.objectives ?? [])[0] || 'Learning objectives'}</p>
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

                    {i < weeks.length - 1 ? (
                      <div className="flex flex-col items-center" style={{ height: 34 }}>
                        <div
                          className="w-0.5 h-full"
                          style={{
                            background:
                              state === 'completed' && weekState(weeks[i + 1]!.week, current.week) === 'completed'
                                ? '#10B981'
                                : state === 'completed' && weekState(weeks[i + 1]!.week, current.week) === 'current'
                                  ? 'linear-gradient(180deg, #10B981 0%, #FFCE00 100%)'
                                  : '#E2E8F0',
                          }}
                        />
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>

            {selectedWeek && currentSession && (
              <div
                className="mt-6 rounded-[16px] p-4"
                style={{
                  background: selectedState === 'completed' ? '#F0FDF4' : selectedState === 'current' ? '#FFF8E1' : '#F8FAFC',
                  border: `2px solid ${selectedState === 'completed' ? '#BBF7D0' : selectedState === 'current' ? '#FDE68A' : '#E2E8F0'}`,
                }}
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/70 border border-white">
                    {selectedState === 'locked' ? <Lock className="w-5 h-5 text-slate-500" /> : <BookOpen className="w-5 h-5 text-[#00305E]" />}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-slate-900">
                      {t('week', { n: selectedWeek.week })} · {t('session', { n: currentSession.index })}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${currentTheme.badge}`}>
                        {currentSession.type}
                      </span>
                      <span className="text-xs text-slate-600">
                        {t('minutesDifficulty', { minutes: currentSession.minutes, difficulty: currentSession.difficulty ?? '-' })}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-[14px] font-bold text-sm transition-all text-white"
                  style={{
                    background: '#00305E',
                    boxShadow: '0 5px 0 0 #002447, 0 8px 20px rgba(0,48,94,0.25)',
                  }}
                  onClick={() => router.push(`/student/plan/week/${current.week}/session/${currentSession.index}`)}
                >
                  <Play size={16} fill="white" /> {t('goSession')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

