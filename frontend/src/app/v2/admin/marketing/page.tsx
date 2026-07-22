'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Mail, MessageCircle, ExternalLink } from 'lucide-react'
import { apiMessage } from '@/lib/api'
import {
  getGrowthStats, listLeads, getTeacherClusters,
  type GrowthStats, type MarketingLead, type TeacherCluster,
} from '@/lib/adminMarketingApi'
import { GaPageHdr, GaCap, GaBtn, TkStatStrip } from '@/components/ui-v2'

// ─────────────────────────────────────────────────────────────────────────────
// Tăng trưởng / Leads (admin) — navy (W1.7 migrate admin/marketing).
// Plumbing reused 1:1: adminMarketingApi.getGrowthStats + listLeads(30,200) + getTeacherClusters(3).
// ─────────────────────────────────────────────────────────────────────────────

const fmtDate = (iso: string) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function SplitCard({ icon, label, value, total, tone }: { icon: React.ReactNode; label: string; value: number; total: number; tone: string }) {
  const t = useTranslations('v2.adminOps.marketing')
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div className="border border-ga-line bg-ga-card p-4 lg:p-[18px]">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 text-[13.5px] font-semibold text-ga-ink">{icon} {label}</div>
        <span className="shrink-0 font-ga-display text-[16px] font-medium text-ga-ink">{value.toLocaleString()}</span>
      </div>
      <span className="block h-2 w-full bg-ga-line"><span className="block h-full" style={{ width: `${pct}%`, background: tone }} /></span>
      <p className="ga-ui mt-1.5 text-[12px] text-ga-muted">{t('pctOfTotal', { pct })}</p>
    </div>
  )
}

export default function V2AdminMarketingPage() {
  const t = useTranslations('v2.adminOps.marketing')
  const tc = useTranslations('v2.common')
  const [stats, setStats] = useState<GrowthStats | null>(null)
  const [leads, setLeads] = useState<MarketingLead[]>([])
  const [clusters, setClusters] = useState<TeacherCluster[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [s, l, c] = await Promise.all([getGrowthStats(), listLeads(30, 200), getTeacherClusters(3)])
      setStats(s); setLeads(l); setClusters(c); setError('')
    } catch (e: unknown) {
      setError(apiMessage(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr
        accent
        title={t('title')}
        subtitle={t('subtitle')}
        right={
          <a href="/free-grade" target="_blank" rel="noopener noreferrer" className="ga-ui inline-flex items-center gap-1.5 border border-ga-line px-3 py-1.5 text-[12px] font-semibold text-ga-ink transition-colors hover:border-ga-accent hover:text-ga-accent">
            {t('gradePageLink')} <ExternalLink size={13} />
          </a>
        }
      />

      <div className="flex-1 overflow-auto px-4 py-6 sm:px-6 lg:px-10">
        {loading ? (
          <div className="flex flex-col gap-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="ga-shimmer h-[64px] border border-ga-line" aria-hidden />)}</div>
        ) : error ? (
          <div className="border border-ga-line bg-ga-card px-4 py-10 text-center sm:px-6 lg:px-10 lg:py-[52px]">
            <h2 className="font-ga-display text-[20px] font-medium text-ga-red lg:text-[24px]">{t('loadError')}</h2>
            <p className="ga-ui mx-auto mb-5 mt-3 max-w-sm break-words text-[14px] text-ga-muted">{error} <code className="break-words font-mono text-[12px] text-ga-accent">GET /api/admin/marketing/*</code></p>
            <GaBtn variant="primary" onClick={load}>{tc('retry')}</GaBtn>
          </div>
        ) : (
          <>
            <TkStatStrip
              items={[
                { label: t('stats.leadsTotal'), value: (stats?.leadsTotal ?? 0).toLocaleString(), sub: t('stats.leadsTotalSub', { count: stats?.leads7d ?? 0 }) },
                { label: t('stats.leadsToday'), value: stats?.leadsToday ?? 0, sub: t('stats.leadsTodaySub'), color: '#1E9E61' },
                { label: t('stats.reportsTotal'), value: (stats?.reportsTotal ?? 0).toLocaleString(), sub: t('stats.reportsTotalSub', { count: stats?.reports7d ?? 0 }), color: '#7C56C8' },
                { label: t('stats.avgScore'), value: stats?.avgScore ?? 0, sub: t('stats.avgScoreSub'), color: '#E07B39' },
              ]}
            />

            <div className="mt-[22px] grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <SplitCard icon={<Mail size={16} className="text-ga-accent" />} label={t('emailLeads')} value={stats?.emailLeads ?? 0} total={stats?.leadsTotal ?? 0} tone="var(--ga-blue)" />
              <SplitCard icon={<MessageCircle size={16} className="text-ga-accent" />} label={t('zaloLeads')} value={stats?.zaloLeads ?? 0} total={stats?.leadsTotal ?? 0} tone="var(--ga-teal)" />
            </div>

            {/* Recent leads */}
            <div className="mb-3.5 mt-[22px]"><GaCap>{t('recentLeads', { count: leads.length })}</GaCap></div>
            {leads.length === 0 ? (
              <div className="border border-dashed border-ga-line px-4 py-[40px] text-center text-[14px] text-ga-muted sm:px-6 lg:px-10">{t('noLeads')}</div>
            ) : (
              <div className="overflow-x-auto">
              <div className="min-w-[720px] border border-ga-line bg-ga-card">
                <div className="grid items-center gap-2 border-b border-ga-line bg-ga-bg px-5 py-[11px]" style={{ gridTemplateColumns: '1.2fr 1.4fr 1fr 70px 110px' }}>
                  {[
                    { key: 'colName', label: t('colName') },
                    { key: 'colContact', label: t('colContact') },
                    { key: 'colTopic', label: t('colTopic') },
                    { key: 'colScore', label: t('colScore') },
                    { key: 'colDate', label: t('colDate') },
                  ].map((h) => <span key={h.key} className="ga-ui text-[10px] font-bold uppercase tracking-[0.1em] text-ga-muted">{h.label}</span>)}
                </div>
                {leads.map((l, i) => (
                  <div key={l.id} className="grid items-center gap-2 px-5 py-3 transition-colors hover:bg-ga-surface" style={{ gridTemplateColumns: '1.2fr 1.4fr 1fr 70px 110px', borderTop: i ? '1px solid var(--ga-line)' : 'none' }}>
                    <span className="truncate text-[13.5px] font-semibold text-ga-ink">{l.name || '—'}</span>
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-[13px] text-ga-ink">{l.contact}</span>
                      <span className="shrink-0 px-1.5 py-0.5 text-[10px] font-bold uppercase text-ga-muted" style={{ background: 'var(--ga-side-active)' }}>{l.contactType}</span>
                    </span>
                    <span className="truncate text-[12.5px] text-ga-muted">{l.topic || '—'}</span>
                    <span className="text-[13px] font-semibold">{l.score != null ? <span className="text-ga-ink">{l.score}</span> : <span className="text-[11px] text-ga-red">{t('aiError')}</span>}</span>
                    <span className="text-[12px] text-ga-muted">{fmtDate(l.createdAt)}</span>
                  </div>
                ))}
              </div>
              </div>
            )}

            {/* Teacher clusters (B2B org-sales trigger) */}
            <div className="mb-3.5 mt-[22px]"><GaCap>{t('clusters')}</GaCap></div>
            {clusters.length === 0 ? (
              <div className="border border-dashed border-ga-line px-4 py-[34px] text-center text-[13.5px] text-ga-muted sm:px-6 lg:px-10">{t('noClusters')}</div>
            ) : (
              <div className="overflow-x-auto">
              <div className="min-w-[560px] border border-ga-line bg-ga-card">
                <div className="grid items-center gap-2 border-b border-ga-line bg-ga-bg px-5 py-[11px]" style={{ gridTemplateColumns: '1.4fr 90px 1.6fr' }}>
                  {[
                    { key: 'colCenter', label: t('colCenter') },
                    { key: 'colTeacherCount', label: t('colTeacherCount') },
                    { key: 'colContactEmail', label: t('colContactEmail') },
                  ].map((h) => <span key={h.key} className="ga-ui text-[10px] font-bold uppercase tracking-[0.1em] text-ga-muted">{h.label}</span>)}
                </div>
                {clusters.map((c, i) => (
                  <div key={c.centerName} className="grid items-center gap-2 px-5 py-3 transition-colors hover:bg-ga-surface" style={{ gridTemplateColumns: '1.4fr 90px 1.6fr', borderTop: i ? '1px solid var(--ga-line)' : 'none' }}>
                    <span className="truncate text-[13.5px] font-semibold text-ga-ink">{c.centerName}</span>
                    <span><span className="px-2 py-0.5 text-[11px] font-bold" style={{ color: 'var(--ga-green)', background: 'var(--ga-green-soft)' }}>{t('teacherCountBadge', { count: c.teacherCount })}</span></span>
                    <span className="truncate text-[12px] text-ga-muted">{c.contactEmails}</span>
                  </div>
                ))}
              </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
