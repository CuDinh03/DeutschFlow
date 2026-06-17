'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Flame, ArrowRight, Mic, BookOpen, Repeat } from 'lucide-react'
import { todayApi, type TodayPlan } from '@/lib/todayApi'
import { phaseApi, type PhaseStateResponse, type PhaseType } from '@/lib/phaseApi'
import { xpApi, type XpSummaryDto } from '@/lib/xpApi'
import { useUserStore } from '@/stores/useUserStore'
import { GaPageHdr, TkStatStrip, GaCard, GaCap, LoadingState, ErrorBanner } from '@/components/ui-v2'

const PHASE_LABEL: Record<PhaseType, string> = {
  FOUNDATION: 'Nền tảng',
  PRODUCTION: 'Sản sinh',
  FLUENCY: 'Lưu loát',
  GRADUATED: 'Tốt nghiệp',
}

const YELLOW = '#C79A00' // readable gold for value text on light bg

export default function V2StudentDashboardPage() {
  const displayName = useUserStore((s) => s.user?.displayName)
  const [today, setToday] = useState<TodayPlan | null>(null)
  const [phase, setPhase] = useState<PhaseStateResponse | null>(null)
  const [xp, setXp] = useState<XpSummaryDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    setError(null)
    Promise.allSettled([todayApi.getMe(), phaseApi.getCurrent(), xpApi.getMyXp()])
      .then(([t, p, x]) => {
        if (t.status === 'fulfilled') setToday(t.value.data)
        if (p.status === 'fulfilled') setPhase(p.value.data)
        if (x.status === 'fulfilled') setXp(x.value)
        if (t.status === 'rejected' && p.status === 'rejected' && x.status === 'rejected') {
          setError('Không thể tải bảng điều khiển.')
        }
      })
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const xpPct =
    xp && xp.progressInLevel + xp.xpNeededForNext > 0
      ? Math.round((xp.progressInLevel / (xp.progressInLevel + xp.xpNeededForNext)) * 100)
      : 0

  // `/today/me` may omit `progress`/`dueRepairTasks` for new students → guard fully.
  const streakDays = today?.progress?.streakDays ?? 0
  const accuracy = today?.progress?.rollingAccuracyPercent
  const dueCount = today?.dueRepairTasks?.length ?? 0
  const unlockedAch = xp?.achievements?.filter((a) => a.unlocked) ?? []

  const actions = [
    {
      icon: Mic,
      title: 'Luyện nói AI',
      desc: today?.recommendedSpeaking?.topic || 'Hội thoại tiếng Đức với AI',
      href: '/v2/student/speaking',
      tone: 'var(--ga-violet)',
    },
    {
      icon: BookOpen,
      title: 'Học từ vựng',
      desc: today?.recommendedVocabPractice?.topic || 'Ôn từ theo màu giống',
      href: '/v2/student/vocabulary',
      tone: 'var(--ga-blue)',
    },
    {
      icon: Repeat,
      title: 'Ôn tập SRS',
      desc: dueCount ? `${dueCount} mục cần ôn hôm nay` : 'Hàng đợi ôn tập',
      href: '/v2/student/review',
      tone: 'var(--ga-orange)',
    },
  ]

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr
        accent
        title={displayName ? `Xin chào, ${displayName}` : 'Bảng điều khiển'}
        subtitle="Tiếp tục hành trình tiếng Đức của bạn hôm nay"
        right={
          today ? (
            <span className="ga-ui inline-flex items-center gap-2 rounded-ga border border-ga-line px-3 py-2 text-[13px] font-semibold text-ga-ink">
              <Flame size={16} className="text-ga-orange" aria-hidden />
              {streakDays} ngày streak
            </span>
          ) : null
        }
      />
      <div className="flex-1 px-10 py-6">
        {error && (
          <div className="mb-5">
            <ErrorBanner message={error} onRetry={load} />
          </div>
        )}
        {loading ? (
          <LoadingState label="Đang tải bảng điều khiển…" />
        ) : (
          <div className="space-y-[22px]">
            <TkStatStrip
              items={[
                { label: 'Streak', value: streakDays, sub: 'ngày liên tiếp', color: '#E07B39' },
                {
                  label: 'Độ chính xác',
                  value: accuracy != null ? `${Math.round(accuracy)}%` : '—',
                  sub: 'gần đây',
                  color: '#1E9E61',
                },
                {
                  label: 'Cấp độ',
                  value: xp?.level != null ? `Lv ${xp.level}` : '—',
                  sub: xp?.totalXp != null ? `${xp.totalXp.toLocaleString('vi-VN')} XP` : undefined,
                  color: YELLOW,
                },
                {
                  label: 'Từ đã thuộc',
                  value: phase?.vocabularyMasteredCount ?? 0,
                  sub: 'từ vựng',
                  color: '#2F6FC9',
                },
              ]}
            />

            {/* Today's actions */}
            <div>
              <GaCap className="mb-3 block">Hôm nay học gì</GaCap>
              <div className="grid grid-cols-1 gap-[18px] md:grid-cols-3">
                {actions.map((a) => {
                  const Icon = a.icon
                  return (
                    <Link key={a.title} href={a.href}>
                      <GaCard hover className="group h-full p-5">
                        <span
                          className="mb-3 grid h-11 w-11 place-items-center rounded-ga"
                          style={{ background: `${a.tone}1a`, color: a.tone }}
                        >
                          <Icon size={22} aria-hidden />
                        </span>
                        <p className="font-ga-display text-[18px] font-medium text-ga-ink">{a.title}</p>
                        <p className="ga-ui mt-1 line-clamp-2 text-[13.5px] text-ga-muted">{a.desc}</p>
                        <span className="ga-ui mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-ga-accent">
                          Bắt đầu <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" aria-hidden />
                        </span>
                      </GaCard>
                    </Link>
                  )
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-[22px] lg:grid-cols-[1fr_1fr]">
              {/* Phase progress */}
              {phase && (
                <GaCard className="p-6">
                  <GaCap className="mb-3 block">Giai đoạn học</GaCap>
                  <p className="font-ga-display text-[24px] font-medium text-ga-ink">
                    {PHASE_LABEL[phase.currentPhase]}
                  </p>
                  <div className="mt-4 space-y-3">
                    {[
                      ['Từ vựng đã thuộc', phase.vocabularyMasteredCount],
                      ['Phút luyện nói', phase.speakingMinutesTotal],
                      ['Độ chính xác ngữ pháp', `${Math.round(phase.grammarAccuracyPercent)}%`],
                      ['Phiên đã hoàn thành', phase.sessionsCompleted],
                    ].map(([k, v]) => (
                      <div key={String(k)} className="ga-ui flex items-center justify-between text-[13.5px]">
                        <span className="text-ga-muted">{k}</span>
                        <span className="font-semibold text-ga-ink">{v}</span>
                      </div>
                    ))}
                  </div>
                  {phase.readyToAdvance && (
                    <div className="mt-4 rounded-ga bg-ga-green-soft px-3.5 py-2.5 text-[13px] font-semibold text-ga-green">
                      🎉 Bạn đã sẵn sàng lên giai đoạn tiếp theo!
                    </div>
                  )}
                </GaCard>
              )}

              {/* XP level */}
              {xp && (
                <GaCard className="p-6">
                  <GaCap className="mb-3 block">Tiến độ cấp độ</GaCap>
                  <div className="flex items-baseline justify-between">
                    <p className="font-ga-display text-[26px] font-medium text-ga-ink">Cấp {xp.level}</p>
                    <span className="ga-ui text-[13px] text-ga-muted">
                      {xp.progressInLevel} / {xp.progressInLevel + xp.xpNeededForNext} XP
                    </span>
                  </div>
                  <div className="mt-3 h-2.5 overflow-hidden rounded-[3px] bg-ga-border">
                    <div className="h-full rounded-[3px] bg-ga-yellow" style={{ width: `${xpPct}%` }} />
                  </div>
                  <p className="ga-ui mt-2 text-[12.5px] text-ga-muted">Còn {xp.xpNeededForNext} XP để lên cấp tiếp theo</p>
                  {unlockedAch.length > 0 && (
                    <div className="mt-5">
                      <GaCap className="mb-2.5 block">Thành tích gần đây</GaCap>
                      <div className="flex flex-wrap gap-2">
                        {unlockedAch
                          .slice(0, 6)
                          .map((a) => (
                            <span
                              key={a.id}
                              title={a.nameVi}
                              className="grid h-10 w-10 place-items-center rounded-ga border border-ga-line text-[20px]"
                            >
                              {a.iconEmoji}
                            </span>
                          ))}
                      </div>
                    </div>
                  )}
                  <Link
                    href="/v2/student/achievements"
                    className="ga-ui mt-4 inline-flex items-center gap-1 text-[13px] font-semibold text-ga-accent"
                  >
                    Xem tất cả thành tích <ArrowRight size={14} aria-hidden />
                  </Link>
                </GaCard>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
