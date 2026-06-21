'use client'

import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import api, { apiMessage } from '@/lib/api'
import { GaPageHdr, GaBtn, GaCap, TkStatStrip } from '@/components/ui-v2'

// Ruleset cá nhân hoá (admin) — navy (W1.7 migrate admin/reports/personalization-ruleset).
// GET /api/admin/reports/personalization-ruleset → PersonalizationData.

interface Data {
  total_learners_with_plan: number
  avg_sessions_per_week: number
  cefr_distribution: Record<string, number>
  topic_preferences: Array<{ topic: string; count: number }>
  generated_at?: string
}
const CEFR_COLOR: Record<string, string> = { A1: '#1E9E61', A2: '#2F6FC9', B1: '#7C56C8', B2: '#E07B39', C1: '#D14343', C2: '#11888A' }

export default function V2PersonalizationRulesetPage() {
  const router = useRouter()
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try { const { data: res } = await api.get<Data>('/admin/reports/personalization-ruleset'); setData(res); setError('') }
    catch (e: unknown) { setError(apiMessage(e)) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])

  const dist = data?.cefr_distribution ?? {}
  const distTotal = Object.values(dist).reduce((a, b) => a + b, 0)
  const topics = data?.topic_preferences ?? []

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr
        accent
        title="Ruleset cá nhân hoá"
        subtitle="Phân phối học viên theo trình độ & sở thích chủ đề"
        right={<GaBtn variant="ghost" size="sm" onClick={() => router.push('/v2/admin/reports')}><ArrowLeft size={15} /> Báo cáo</GaBtn>}
      />
      <div className="flex-1 overflow-auto px-10 py-6">
        {loading ? (
          <div className="flex flex-col gap-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="ga-shimmer h-[100px] border border-ga-line" aria-hidden />)}</div>
        ) : error ? (
          <div className="border border-ga-line bg-ga-card px-10 py-[52px] text-center">
            <h2 className="font-ga-display text-[24px] font-medium text-ga-red">Không tải được báo cáo</h2>
            <p className="ga-ui mx-auto mb-5 mt-3 max-w-sm text-[14px] text-ga-muted">{error} <code className="font-mono text-[12px] text-ga-accent">GET /api/admin/reports/personalization-ruleset</code></p>
            <GaBtn variant="primary" onClick={load}>Thử lại</GaBtn>
          </div>
        ) : !data ? (
          <div className="border border-dashed border-ga-line px-10 py-[40px] text-center text-[14px] text-ga-muted">Không có dữ liệu.</div>
        ) : (
          <>
            <TkStatStrip
              items={[
                { label: 'HV có lộ trình', value: (data.total_learners_with_plan ?? 0).toLocaleString(), sub: 'đang học' },
                { label: 'TB sessions/tuần', value: data.avg_sessions_per_week != null ? data.avg_sessions_per_week.toFixed(1) : '—', sub: 'mỗi học viên', color: '#2F6FC9' },
              ]}
            />

            {distTotal > 0 && (
              <>
                <div className="mb-3.5 mt-[22px]"><GaCap>Phân phối trình độ CEFR</GaCap></div>
                <div className="flex flex-col gap-3 border border-ga-line bg-ga-card p-[22px]">
                  {Object.entries(dist).map(([lvl, count]) => {
                    const pct = distTotal > 0 ? Math.round((count / distTotal) * 100) : 0
                    const color = CEFR_COLOR[lvl] ?? 'var(--ga-accent)'
                    return (
                      <div key={lvl} className="flex items-center gap-3">
                        <span className="w-8 text-[12px] font-bold" style={{ color }}>{lvl}</span>
                        <span className="h-2 flex-1 bg-ga-line"><span className="block h-full" style={{ width: `${pct}%`, background: color }} /></span>
                        <span className="w-20 text-right text-[12px] font-semibold text-ga-muted">{count} ({pct}%)</span>
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            {topics.length > 0 && (
              <>
                <div className="mb-3.5 mt-[22px]"><GaCap>Chủ đề phổ biến nhất</GaCap></div>
                <div className="border border-ga-line bg-ga-card">
                  <div className="grid items-center gap-2 border-b border-ga-line bg-ga-bg px-5 py-[11px]" style={{ gridTemplateColumns: '48px 1fr 110px' }}>
                    {['#', 'Chủ đề', 'Lượt chọn'].map((h, i) => <span key={h} className={`ga-ui text-[10px] font-bold uppercase tracking-[0.1em] text-ga-muted ${i === 2 ? 'text-right' : ''}`}>{h}</span>)}
                  </div>
                  {topics.slice(0, 10).map((t, i) => (
                    <div key={t.topic} className="grid items-center gap-2 px-5 py-3 transition-colors hover:bg-ga-surface" style={{ gridTemplateColumns: '48px 1fr 110px', borderTop: i ? '1px solid var(--ga-line)' : 'none' }}>
                      <span className="text-[12px] text-ga-muted">{i + 1}</span>
                      <span className="truncate text-[13.5px] font-medium text-ga-ink">{t.topic}</span>
                      <span className="text-right text-[13px] font-semibold text-ga-accent">{t.count.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
