'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, Check } from 'lucide-react'
import { todayApi, type TodayPlan } from '@/lib/todayApi'
import { phaseApi, type PhaseStateResponse, type PhaseType } from '@/lib/phaseApi'
import { xpApi, type XpSummaryDto } from '@/lib/xpApi'
import { coinApi } from '@/lib/coinApi'
import { useStudentCoins } from '@/lib/flags'
import { getErrorSnippet } from '@/lib/errors/errorCatalog'
import { useUserStore } from '@/stores/useUserStore'
import { GaPageHdr, GaCard, GaCap, LoadingState, ErrorBanner } from '@/components/ui-v2'

// Reskin of proto GaDashboard (proto-dashboard-main.jsx): the dark "Tiếp tục học" hero + the
// interactive "Kế hoạch hôm nay" checklist are the two signature moments. Built from REAL data —
// todayApi (recommended speaking/vocab + dueRepairTasks + progress) · phaseApi · xpApi.
// Option-1 drops (no backing data): per-task minutes, video-resume card, per-skill score bars,
// class-deadline feed → replaced with the SRS due-task list. The checklist toggle is local (the
// proto's is likewise a session-local "đánh dấu xong", not persisted).

const PHASE_LABEL: Record<PhaseType, string> = {
  FOUNDATION: 'Nền tảng',
  PRODUCTION: 'Sản sinh',
  FLUENCY: 'Lưu loát',
  GRADUATED: 'Tốt nghiệp',
}

interface PlanItem {
  id: string
  tag: string
  title: string
  meta: string
  href: string
}

export default function V2StudentDashboardPage() {
  const router = useRouter()
  const coinsEnabled = useStudentCoins()
  const displayName = useUserStore((s) => s.user?.displayName)
  const [today, setToday] = useState<TodayPlan | null>(null)
  const [phase, setPhase] = useState<PhaseStateResponse | null>(null)
  const [xp, setXp] = useState<XpSummaryDto | null>(null)
  const [coins, setCoins] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<Set<string>>(new Set())

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

  // Coin balance — separate, flag-gated, best-effort (never blocks the dashboard).
  useEffect(() => {
    if (!coinsEnabled) return
    coinApi
      .getBalance()
      .then((b) => setCoins(b.balance))
      .catch(() => setCoins(null))
  }, [coinsEnabled])

  // `/today/me` may omit nested blocks for new students → guard fully.
  const streakDays = today?.progress?.streakDays ?? 0
  const accuracy = today?.progress?.rollingAccuracyPercent
  const dueTasks = today?.dueRepairTasks ?? []
  const dueCount = dueTasks.length
  const unlockedAch = xp?.achievements?.filter((a) => a.unlocked) ?? []

  // Today's plan, assembled from the real recommendations.
  const plan = useMemo<PlanItem[]>(() => {
    const items: PlanItem[] = []
    const sp = today?.recommendedSpeaking
    if (sp?.topic)
      items.push({
        id: 'speak',
        tag: 'Luyện nói',
        title: sp.topic,
        meta: sp.focusOrStructures?.slice(0, 3).join(' · ') || (sp.cefrLevel ? `Cấp độ ${sp.cefrLevel}` : 'Hội thoại AI'),
        href: '/v2/student/speaking',
      })
    const vp = today?.recommendedVocabPractice
    if (vp?.topic)
      items.push({
        id: 'vocab',
        tag: 'Từ vựng',
        title: vp.topic,
        meta: vp.focusOrStructures?.slice(0, 3).join(' · ') || 'Ôn từ theo màu giống',
        href: '/v2/student/vocabulary',
      })
    if (dueCount > 0)
      items.push({
        id: 'review',
        tag: 'Ôn tập',
        title: `Ôn ${dueCount} mục đến hạn hôm nay`,
        meta: 'Lặp lại ngắt quãng (SRS)',
        href: '/v2/student/review',
      })
    const wk = today?.recommendedWeeklySpeaking
    if (wk?.topic)
      items.push({
        id: 'weekly',
        tag: 'Theo tuần',
        title: wk.topic,
        meta: wk.cefrLevel ? `Bài tuần · ${wk.cefrLevel}` : 'Bài luyện theo tuần',
        href: '/v2/student/speaking',
      })
    return items
  }, [today, dueCount])

  const doneCount = plan.filter((p) => done.has(p.id)).length
  const allDone = plan.length > 0 && doneCount === plan.length
  const nextTask = plan.find((p) => !done.has(p.id)) ?? plan[0]

  const toggle = (id: string) =>
    setDone((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const metrics: { v: string | number; l: string }[] = [
    { v: streakDays, l: 'ngày streak 🔥' },
    { v: accuracy != null ? `${Math.round(accuracy)}%` : '—', l: 'độ chính xác gần đây' },
    { v: phase?.vocabularyMasteredCount ?? 0, l: 'từ vựng đã thuộc' },
    { v: xp ? `Lv ${xp.level}` : '—', l: xp ? `${xp.totalXp.toLocaleString('vi-VN')} XP` : 'cấp độ' },
  ]

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr
        accent
        title={displayName ? `Chào, ${displayName}` : 'Bảng điều khiển'}
        subtitle={
          allDone
            ? 'Bạn đã hoàn thành kế hoạch hôm nay. Giữ vững phong độ nhé!'
            : `Hoàn thành kế hoạch hôm nay để duy trì chuỗi học ${streakDays} ngày.`
        }
        right={
          <div className="flex items-center gap-2">
            <span className="ga-ui inline-flex items-center gap-1.5 border border-ga-line bg-ga-bg px-3 py-2 text-[13px] text-ga-ink">
              <span className="font-ga-display text-[18px] font-medium">{streakDays}</span>
              <span className="text-ga-muted">ngày 🔥</span>
            </span>
            {coinsEnabled && coins != null && (
              <span
                className="ga-ui inline-flex items-center gap-1.5 border border-ga-line bg-ga-bg px-3 py-2 text-[13px] text-ga-ink"
                title="Xu thưởng — hoàn thành bài học để nhận, dùng để mở đề thi & lượt nói thêm"
              >
                <span className="font-ga-display text-[18px] font-medium">{coins.toLocaleString('vi-VN')}</span>
                <span className="text-ga-muted">🪙 xu</span>
              </span>
            )}
            {xp && (
              <span className="ga-ui inline-flex items-center gap-1.5 border border-ga-line bg-ga-bg px-3 py-2 text-[13px] text-ga-ink">
                <span className="font-ga-display text-[18px] font-medium">{xp.totalXp.toLocaleString('vi-VN')}</span>
                <span className="text-ga-muted">XP</span>
              </span>
            )}
          </div>
        }
      />
      <div className="flex-1 px-10 py-7">
        {error && (
          <div className="mb-5">
            <ErrorBanner message={error} onRetry={load} />
          </div>
        )}
        {loading ? (
          <LoadingState label="Đang tải bảng điều khiển…" />
        ) : (
          <div className="space-y-7">
            {/* ── Dark "Tiếp tục học" hero ── */}
            {allDone ? (
              <div className="flex items-center gap-7 bg-ga-ink px-9 py-7 text-ga-bg">
                <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-ga-green text-[30px] font-bold text-white">
                  ✓
                </div>
                <div className="min-w-0 flex-1">
                  <div className="ga-ui mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-ga-accent">
                    Hoàn thành kế hoạch hôm nay
                  </div>
                  <h2 className="font-ga-display text-[26px] font-medium leading-tight">
                    Tuyệt vời! Chuỗi học của bạn đang là {streakDays} ngày 🔥
                  </h2>
                  <p className="ga-ui mt-2 text-[14.5px] text-ga-bg/60">
                    Bạn đã xong các việc hôm nay. Nghỉ ngơi, hoặc luyện thêm để vượt kế hoạch.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => router.push('/v2/student/speaking')}
                  className="ga-ui shrink-0 whitespace-nowrap bg-ga-accent px-6 py-3.5 text-[15px] font-bold text-ga-accent-ink transition-opacity hover:opacity-90"
                >
                  Luyện thêm 1 buổi
                </button>
              </div>
            ) : nextTask ? (
              <div className="flex flex-col items-stretch gap-6 bg-ga-ink px-9 py-7 text-ga-bg md:flex-row md:items-center">
                <div className="min-w-0 flex-1">
                  <div className="mb-2.5 flex items-center gap-2.5">
                    <span className="ga-ui text-[11px] font-semibold uppercase tracking-[0.16em] text-ga-accent">
                      Tiếp tục học
                    </span>
                    <span className="ga-ui border border-ga-bg/20 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ga-bg/60">
                      {nextTask.tag}
                    </span>
                  </div>
                  <h2 className="font-ga-display text-[26px] font-medium leading-snug [overflow-wrap:anywhere]">
                    {nextTask.title}
                  </h2>
                  <p className="ga-ui mt-2 text-[14px] text-ga-bg/60 [overflow-wrap:anywhere]">{nextTask.meta}</p>
                </div>
                <div className="flex shrink-0 items-center gap-6">
                  {accuracy != null && (
                    <div className="text-right">
                      <div className="font-ga-display text-[26px] font-medium leading-none">{Math.round(accuracy)}%</div>
                      <div className="ga-ui mt-1.5 text-[11px] text-ga-bg/60">độ chính xác</div>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => router.push(nextTask.href)}
                    className="ga-ui whitespace-nowrap bg-ga-accent px-6 py-3.5 text-[15px] font-bold text-ga-accent-ink transition-opacity hover:opacity-90"
                  >
                    Tiếp tục →
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-start gap-4 bg-ga-ink px-9 py-7 text-ga-bg md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="ga-ui mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-ga-accent">
                    Bắt đầu hôm nay
                  </div>
                  <h2 className="font-ga-display text-[26px] font-medium">Sẵn sàng luyện tiếng Đức?</h2>
                </div>
                <button
                  type="button"
                  onClick={() => router.push('/v2/student/speaking')}
                  className="ga-ui shrink-0 bg-ga-accent px-6 py-3.5 text-[15px] font-bold text-ga-accent-ink hover:opacity-90"
                >
                  Luyện nói AI →
                </button>
              </div>
            )}

            {/* ── Today's plan — interactive checklist ── */}
            {plan.length > 0 && (
              <div>
                <div className="flex items-center justify-between border-b border-ga-ink pb-3.5">
                  <GaCap>Kế hoạch hôm nay</GaCap>
                  <GaCap className={allDone ? 'text-ga-green' : 'text-ga-gold'}>
                    Hoàn thành {doneCount}/{plan.length}
                    {allDone ? ' ✓' : ''}
                  </GaCap>
                </div>
                {plan.map((p) => {
                  const isDone = done.has(p.id)
                  return (
                    <div
                      key={p.id}
                      className="flex items-center gap-5 border-b border-ga-line px-2 py-4 transition-opacity"
                      style={{ opacity: isDone ? 0.62 : 1 }}
                    >
                      <button
                        type="button"
                        onClick={() => toggle(p.id)}
                        aria-label="Đánh dấu hoàn thành"
                        className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full border-2 transition-colors"
                        style={{
                          borderColor: isDone ? 'var(--ga-green)' : 'var(--ga-line)',
                          background: isDone ? 'var(--ga-green)' : 'transparent',
                          color: '#fff',
                        }}
                      >
                        {isDone && <Check size={14} aria-hidden />}
                      </button>
                      <span className="ga-ui hidden shrink-0 border border-ga-line px-2 py-1.5 text-center text-[10px] font-semibold uppercase tracking-[0.1em] text-ga-muted sm:block">
                        {p.tag}
                      </span>
                      <Link href={p.href} className="group min-w-0 flex-1">
                        <div
                          className={`text-[16px] font-semibold text-ga-ink [overflow-wrap:anywhere] ${isDone ? 'line-through' : ''}`}
                        >
                          {p.title}
                        </div>
                        <div className="ga-ui mt-1 text-[12.5px] text-ga-muted [overflow-wrap:anywhere]">{p.meta}</div>
                      </Link>
                      <Link
                        href={p.href}
                        className="shrink-0 font-ga-display text-[22px] text-ga-muted transition-colors hover:text-ga-ink"
                        aria-label="Mở"
                      >
                        →
                      </Link>
                    </div>
                  )
                })}
              </div>
            )}

            {/* ── Quick metrics ── */}
            <div className="grid grid-cols-2 border border-ga-line md:grid-cols-4">
              {metrics.map((m, i) => (
                <div
                  key={m.l}
                  className={`px-6 py-[18px] ${i % 2 ? 'border-l border-ga-line' : ''} ${i >= 2 ? 'border-t md:border-t-0' : ''} ${i % 4 !== 0 ? 'md:border-l' : ''} border-ga-line`}
                >
                  <div className="font-ga-display text-[26px] font-medium leading-none text-ga-ink">{m.v}</div>
                  <div className="ga-ui mt-2 text-[12.5px] text-ga-muted">{m.l}</div>
                </div>
              ))}
            </div>

            {/* ── Two-column lower ── */}
            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1.5fr_1fr]">
              {/* Left */}
              <div className="flex flex-col gap-6">
                <GaCard className="p-6">
                  <div className="mb-3 flex items-center justify-between">
                    <GaCap>Việc ôn đến hạn</GaCap>
                    <Link href="/v2/student/review" className="ga-ui text-[12px] font-semibold text-ga-muted underline">
                      Vào ôn tập →
                    </Link>
                  </div>
                  {dueTasks.length > 0 ? (
                    dueTasks.slice(0, 5).map((d, i) => {
                      const snip = getErrorSnippet(d.errorCode, 'vi')
                      return (
                        <Link
                          key={d.id}
                          href="/v2/student/review"
                          className="flex items-center gap-3.5 border-t border-ga-line px-1.5 py-3 first:border-t-0 hover:bg-ga-surface"
                        >
                          <span className="h-2.5 w-2.5 shrink-0 bg-ga-orange" />
                          <div className="min-w-0 flex-1">
                            <div className="text-[14.5px] font-semibold text-ga-ink [overflow-wrap:anywhere]">
                              {snip?.title || d.errorCode}
                            </div>
                            <div className="ga-ui mt-0.5 text-[12.5px] text-ga-muted">Lặp lại ngắt quãng · đến hạn</div>
                          </div>
                          <ArrowRight size={15} className="shrink-0 text-ga-subtle" aria-hidden />
                        </Link>
                      )
                    })
                  ) : (
                    <p className="ga-ui py-4 text-[13.5px] text-ga-muted">Không có mục nào đến hạn — bạn đang theo kịp! 🎉</p>
                  )}
                </GaCard>

                {phase && (
                  <GaCard className="p-6">
                    <GaCap className="mb-3 block">Giai đoạn học · {PHASE_LABEL[phase.currentPhase]}</GaCap>
                    <div className="mt-1 space-y-3">
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
              </div>

              {/* Right — XP level */}
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
                    <div
                      className="h-full rounded-[3px] bg-ga-yellow"
                      style={{
                        width: `${
                          xp.progressInLevel + xp.xpNeededForNext > 0
                            ? Math.round((xp.progressInLevel / (xp.progressInLevel + xp.xpNeededForNext)) * 100)
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                  <p className="ga-ui mt-2 text-[12.5px] text-ga-muted">Còn {xp.xpNeededForNext} XP để lên cấp tiếp theo</p>
                  {unlockedAch.length > 0 && (
                    <div className="mt-5">
                      <GaCap className="mb-2.5 block">Thành tích gần đây</GaCap>
                      <div className="flex flex-wrap gap-2">
                        {unlockedAch.slice(0, 6).map((a) => (
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
