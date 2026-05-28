'use client'

import { useEffect, useState } from 'react'
import api from '@/lib/api'

type Rarity = 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY'

type Achievement = {
  id: number
  code: string
  nameVi: string
  descriptionVi: string
  iconEmoji: string
  xpReward: number
  rarity: Rarity
  unlocked: boolean
}

const RARITY_STYLE: Record<Rarity, { border: string; bg: string; label: string; glow: string }> = {
  COMMON:    { border: 'border-slate-200',  bg: 'bg-slate-50',  label: 'text-slate-400',    glow: '' },
  RARE:      { border: 'border-blue-200',   bg: 'bg-blue-50',   label: 'text-blue-500',     glow: 'shadow-blue-100' },
  EPIC:      { border: 'border-purple-200', bg: 'bg-purple-50', label: 'text-purple-600',   glow: 'shadow-purple-100' },
  LEGENDARY: { border: 'border-amber-300',  bg: 'bg-amber-50',  label: 'text-amber-600',    glow: 'shadow-amber-100' },
}

type AchievementBadgesProps = {
  limit?: number
  showLocked?: boolean
}

export function AchievementBadges({ limit = 6, showLocked = false }: AchievementBadgesProps) {
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get<Achievement[]>('/achievements/me')
      .then((res) => {
        const data = res.data ?? []
        const filtered = showLocked ? data : data.filter((a) => a.unlocked)
        setAchievements(filtered.slice(0, limit))
      })
      .catch(() => setAchievements([]))
      .finally(() => setLoading(false))
  }, [limit, showLocked])

  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: Math.min(limit, 6) }).map((_, i) => (
          <div key={i} className="h-20 rounded-2xl bg-slate-100 animate-pulse" />
        ))}
      </div>
    )
  }

  if (achievements.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-3xl mb-2">🏆</p>
        <p className="text-sm text-slate-400">Noch keine Abzeichen. Weiter lernen!</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-3 gap-3">
      {achievements.map((a) => {
        const style = RARITY_STYLE[a.rarity]
        return (
          <div
            key={a.id}
            className={`relative flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 text-center transition-all
              ${a.unlocked ? style.bg + ' ' + style.border + ' shadow-sm ' + style.glow : 'bg-slate-50 border-slate-100 opacity-40'}`}
            title={a.descriptionVi}
          >
            <span className={`text-2xl ${!a.unlocked ? 'grayscale' : ''}`}>{a.iconEmoji}</span>
            <span className="text-[11px] font-bold text-slate-700 leading-tight line-clamp-2">{a.nameVi}</span>
            <span className={`text-[10px] font-semibold ${style.label}`}>{a.xpReward} XP</span>
            {!a.unlocked ? (
              <span className="absolute top-1.5 right-1.5 text-[9px] bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded-full font-bold">🔒</span>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
