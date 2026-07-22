'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ArrowLeft, GitBranch, Check } from 'lucide-react'
import { useRouter } from 'next/navigation'
import api, { apiMessage } from '@/lib/api'
import { GaPageHdr, GaBtn, GaCap } from '@/components/ui-v2'

// Ruleset cá nhân hoá (admin) — navy.
// GET /api/admin/reports/personalization-ruleset → { version, dimensionsSupported: string[] }
// Bộ quy tắc suy ra loại buổi học từ hồ sơ học viên (active ruleset version + các chiều hỗ trợ).

interface Data {
  version?: string
  dimensionsSupported?: string[]
}
// Backend dimension key → catalog label/desc keys (resolved via t()).
const DIMENSION_KEY: Record<string, { labelKey: string; descKey: string }> = {
  goalType: { labelKey: 'dimGoalType', descKey: 'dimGoalTypeDesc' },
  targetLevel: { labelKey: 'dimTargetLevel', descKey: 'dimTargetLevelDesc' },
  learningSpeed: { labelKey: 'dimLearningSpeed', descKey: 'dimLearningSpeedDesc' },
  industry: { labelKey: 'dimIndustry', descKey: 'dimIndustryDesc' },
  sessionsPerWeek: { labelKey: 'dimSessionsPerWeek', descKey: 'dimSessionsPerWeekDesc' },
  minutesPerSession: { labelKey: 'dimMinutesPerSession', descKey: 'dimMinutesPerSessionDesc' },
}

export default function V2PersonalizationRulesetPage() {
  const t = useTranslations('v2.adminContent.reportPersonalization')
  const tc = useTranslations('v2.common')
  const dimMeta = (k: string): { label: string; desc: string } => {
    const hit = DIMENSION_KEY[k]
    if (hit) return { label: t(hit.labelKey), desc: t(hit.descKey) }
    return { label: k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()), desc: '' }
  }
  const router = useRouter()
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data: res } = await api.get<Data>('/admin/reports/personalization-ruleset')
      setData(res)
      setError('')
    } catch (e: unknown) {
      setError(apiMessage(e))
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  const dims = data?.dimensionsSupported ?? []

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr
        accent
        title={t('title')}
        subtitle={t('subtitle')}
        right={
          <GaBtn variant="ghost" size="sm" onClick={() => router.push('/v2/admin/reports')}>
            <ArrowLeft size={15} /> {t('backToReports')}
          </GaBtn>
        }
      />
      <div className="flex-1 overflow-auto px-4 py-6 sm:px-6 lg:px-10">
        {loading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="ga-shimmer h-[100px] border border-ga-line" aria-hidden />
            ))}
          </div>
        ) : error ? (
          <div className="border border-ga-line bg-ga-card px-4 py-10 text-center sm:px-6 lg:px-10 lg:py-[52px]">
            <h2 className="font-ga-display text-[20px] font-medium text-ga-red lg:text-[24px]">{t('loadError')}</h2>
            <p className="ga-ui mx-auto mb-5 mt-3 max-w-sm break-words text-[14px] text-ga-muted">
              {error} <code className="break-words font-mono text-[12px] text-ga-accent">GET /api/admin/reports/personalization-ruleset</code>
            </p>
            <GaBtn variant="primary" onClick={load}>
              {tc('retry')}
            </GaBtn>
          </div>
        ) : !data ? (
          <div className="border border-dashed border-ga-line px-4 py-[40px] text-center text-[14px] text-ga-muted sm:px-6 lg:px-10">{t('noData')}</div>
        ) : (
          <>
            {/* Active version banner */}
            <div className="flex items-center gap-4 border border-ga-line bg-ga-card p-4 lg:p-[22px]">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full" style={{ background: 'var(--ga-accent-soft, rgba(47,111,201,0.12))' }}>
                <GitBranch size={22} style={{ color: 'var(--ga-accent)' }} />
              </span>
              <div className="min-w-0">
                <GaCap>{t('activeVersionCap')}</GaCap>
                <p className="mt-1 break-words font-ga-display text-[20px] font-medium text-ga-ink sm:text-[24px] lg:text-[28px]">{data.version ?? '—'}</p>
              </div>
            </div>

            <div className="mb-3.5 mt-[26px]">
              <GaCap>{t('dimensionsCap', { count: dims.length })}</GaCap>
            </div>
            {dims.length === 0 ? (
              <div className="border border-dashed border-ga-line px-4 py-[40px] text-center text-[14px] text-ga-muted sm:px-6 lg:px-10">
                {t('noDimensions')}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
                {dims.map((d) => {
                  const m = dimMeta(d)
                  return (
                    <div key={d} className="flex items-start gap-3 border border-ga-line bg-ga-card p-4">
                      <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full" style={{ background: 'var(--ga-green-soft)' }}>
                        <Check size={13} style={{ color: 'var(--ga-green)' }} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[14px] font-semibold text-ga-ink">{m.label}</p>
                        {m.desc && <p className="ga-ui mt-0.5 text-[12px] text-ga-muted">{m.desc}</p>}
                        <p className="ga-ui mt-1 font-mono text-[11px] text-ga-subtle">{d}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
