'use client'

import { useTranslations } from 'next-intl'
import { AlertTriangle, BookOpen, Headphones, PenTool, Mic2, ArrowRight, PartyPopper } from 'lucide-react'

// Nhãn phần thi + lời khuyên lấy từ catalog `v2.student.examResult`: `parts.<section>` (dùng chung với
// DetailedScoreBreakdown) và `weakAreas.tips.<section>`.
const SECTION_META: Record<string, { icon: React.ReactNode; color: string; studyLink: string }> = {
  LESEN: {
    icon: <BookOpen size={16} />,
    color: '#6366F1',
    studyLink: '/student/grammar-practice',
  },
  HOEREN: {
    icon: <Headphones size={16} />,
    color: '#0EA5E9',
    studyLink: '/student/practice',
  },
  SCHREIBEN: {
    icon: <PenTool size={16} />,
    color: '#10B981',
    studyLink: '/student/assignments',
  },
  SPRECHEN: {
    icon: <Mic2 size={16} />,
    color: '#F59E0B',
    studyLink: '/student/interviews',
  },
}

interface WeakAreasRecommendationProps {
  weakAreas: string[]
}

export function WeakAreasRecommendation({ weakAreas }: WeakAreasRecommendationProps) {
  const t = useTranslations('v2.student.examResult')
  if (!weakAreas || weakAreas.length === 0) {
    return (
      <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex items-start gap-3">
        <div className="w-8 h-8 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0">
          <PartyPopper size={18} className="text-emerald-700" aria-hidden />
        </div>
        <div>
          <p className="font-bold text-emerald-800 text-sm">{t('weakAreas.noneTitle')}</p>
          <p className="text-xs text-emerald-600 mt-0.5">
            {t('weakAreas.noneDesc')}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <AlertTriangle size={16} className="text-amber-500" />
        <h3 className="font-bold text-[#0F172A] text-sm">{t('weakAreas.title')}</h3>
      </div>

      <div className="space-y-2">
        {weakAreas.map(section => {
          const meta = SECTION_META[section]
          if (!meta) return null

          return (
            <div
              key={section}
              className="bg-white rounded-2xl border border-[#E2E8F0] p-4 hover:border-slate-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: meta.color + '18', color: meta.color }}
                >
                  {meta.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="min-w-0 font-bold text-sm text-[#0F172A]">{section} — {t(`parts.${section}`)}</p>
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded-full shrink-0"
                      style={{ background: meta.color + '18', color: meta.color }}
                    >
                      {t('weakAreas.below60')}
                    </span>
                  </div>
                  <p className="text-xs text-[#64748B] mt-1.5 leading-relaxed">{t(`weakAreas.tips.${section}`)}</p>
                  <a
                    href={meta.studyLink}
                    className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-bold transition-colors"
                    style={{ color: meta.color }}
                  >
                    {t('weakAreas.practiceNow')} <ArrowRight size={12} strokeWidth={2.5} />
                  </a>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <p className="text-xs text-[#94A3B8] text-center pt-1">
        {t('weakAreas.footer')}
      </p>
    </div>
  )
}
