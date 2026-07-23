'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { xpApi, type XpSummaryDto, type LeaderboardEntry, type AchievementDto } from '@/lib/xpApi'
import { useUserStore } from '@/stores/useUserStore'
import { GaPageHdr, TkStatStrip, GaCap, LoadingState, ErrorBanner } from '@/components/ui-v2'

const RARITY: Record<string, { labelKey: string; color: string }> = {
  COMMON: { labelKey: 'rarity.common', color: '#76716A' },
  RARE: { labelKey: 'rarity.rare', color: '#2F6FC9' },
  EPIC: { labelKey: 'rarity.epic', color: '#7C56C8' },
  LEGENDARY: { labelKey: 'rarity.legendary', color: '#C79A00' },
}

function AchievementCard({ a }: { a: AchievementDto }) {
  const t = useTranslations('v2.student.achievements')
  const r = RARITY[a.rarity?.toUpperCase()] ?? RARITY.COMMON
  return (
    <div
      className={`flex min-w-0 flex-col items-center gap-2 border bg-ga-card p-4 text-center transition-shadow ${
        a.unlocked ? 'border-ga-line hover:shadow-ga-card-hover' : 'border-ga-border opacity-55'
      }`}
      style={a.unlocked ? { borderColor: `${r.color}55` } : undefined}
    >
      <span className={`grid h-14 w-14 place-items-center rounded-full text-[28px] ${a.unlocked ? '' : 'grayscale'}`} style={{ background: `${r.color}14` }}>
        {a.unlocked ? a.iconEmoji : '🔒'}
      </span>
      <p className="text-[13.5px] font-semibold leading-tight text-ga-ink break-words">{a.nameVi}</p>
      <p className="ga-ui line-clamp-2 break-words text-[11.5px] text-ga-muted">{a.descriptionVi}</p>
      <span className="ga-ui mt-auto break-words text-[11px] font-semibold" style={{ color: r.color }}>
        {t('rarityReward', { rarity: t(r.labelKey), xp: a.xpReward })}
      </span>
    </div>
  )
}

export default function V2AchievementsPage() {
  const t = useTranslations('v2.student.achievements')
  const myId = useUserStore((s) => s.user?.id)
  const [xp, setXp] = useState<XpSummaryDto | null>(null)
  const [board, setBoard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    setError(null)
    Promise.allSettled([xpApi.getMyXp(), xpApi.getLeaderboard(20)])
      .then(([x, b]) => {
        if (x.status === 'fulfilled') setXp(x.value)
        else setError(t('loadError'))
        if (b.status === 'fulfilled') setBoard(b.value)
      })
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const achievements = xp?.achievements ?? []
  const unlocked = achievements.filter((a) => a.unlocked).length
  const total = achievements.length
  const myRank = board.find((e) => String(e.userId) === String(myId))?.rank

  // unlocked first, then locked
  const sorted = [...achievements].sort((a, b) => Number(b.unlocked) - Number(a.unlocked))

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr accent title={t('title')} subtitle={t('subtitle')} />
      <div className="flex-1 px-4 py-6 sm:px-6 lg:px-10">
        {error && (
          <div className="mb-5">
            <ErrorBanner message={error} onRetry={load} />
          </div>
        )}
        {loading ? (
          <LoadingState label={t('loading')} />
        ) : (
          <div className="space-y-[22px]">
            <TkStatStrip
              items={[
                { label: t('stats.level'), value: xp ? `Lv ${xp.level}` : '—', color: '#C79A00' },
                { label: t('stats.totalXp'), value: xp ? xp.totalXp.toLocaleString('vi-VN') : '—', color: '#7C56C8' },
                { label: t('stats.badges'), value: `${unlocked}/${total}`, sub: t('stats.badgesSub'), color: '#1E9E61' },
                { label: t('stats.rank'), value: myRank ? `#${myRank}` : '—', sub: t('stats.rankSub'), color: '#2F6FC9' },
              ]}
            />

            <div className="grid grid-cols-1 gap-[22px] lg:grid-cols-[2fr_1fr]">
              <div>
                <GaCap className="mb-3 block">{t('badgesCap', { unlocked, total })}</GaCap>
                {sorted.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                    {sorted.map((a) => (
                      <AchievementCard key={a.id} a={a} />
                    ))}
                  </div>
                ) : (
                  <p className="ga-ui py-8 text-[14px] text-ga-muted">{t('noBadges')}</p>
                )}
              </div>

              <div>
                <GaCap className="mb-3 block">{t('leaderboardCap')}</GaCap>
                <div className="border border-ga-line bg-ga-card">
                  {board.length === 0 ? (
                    <p className="ga-ui py-8 text-center text-[13.5px] text-ga-muted">{t('noLeaderboard')}</p>
                  ) : (
                    board.map((e, i) => {
                      const me = String(e.userId) === String(myId)
                      return (
                        <div
                          key={e.userId}
                          className={`flex items-center gap-3 px-4 py-3 ${i ? 'border-t border-ga-border' : ''} ${
                            me ? 'bg-ga-accent-soft' : ''
                          }`}
                        >
                          <span
                            className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12px] font-bold ${
                              e.rank <= 3 ? 'text-white' : 'text-ga-muted'
                            }`}
                            style={{
                              background:
                                e.rank === 1 ? '#C79A00' : e.rank === 2 ? '#9BA3AF' : e.rank === 3 ? '#CD7F32' : 'var(--ga-side-active)',
                            }}
                          >
                            {e.rank}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13.5px] font-semibold text-ga-ink">
                              {e.displayName}
                              {me && <span className="ml-1.5 text-[11px] text-ga-accent">{t('you')}</span>}
                            </p>
                            <p className="text-[11.5px] text-ga-muted">{t('levelShort', { level: e.level })}</p>
                          </div>
                          <span className="shrink-0 font-ga-display text-[14px] font-medium text-ga-ink">
                            {e.totalXp.toLocaleString('vi-VN')}
                          </span>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
