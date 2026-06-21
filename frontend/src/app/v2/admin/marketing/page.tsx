'use client'

import { useCallback, useEffect, useState } from 'react'
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
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div className="border border-ga-line bg-ga-card p-[18px]">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[13.5px] font-semibold text-ga-ink">{icon} {label}</div>
        <span className="font-ga-display text-[16px] font-medium text-ga-ink">{value.toLocaleString()}</span>
      </div>
      <span className="block h-2 w-full bg-ga-line"><span className="block h-full" style={{ width: `${pct}%`, background: tone }} /></span>
      <p className="ga-ui mt-1.5 text-[12px] text-ga-muted">{pct}% tổng lead</p>
    </div>
  )
}

export default function V2AdminMarketingPage() {
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
        title="Tăng trưởng (Leads)"
        subtitle="Phễu lead magnet & report chia sẻ — follow-up khách quan tâm"
        right={
          <a href="/free-grade" target="_blank" rel="noopener noreferrer" className="ga-ui inline-flex items-center gap-1.5 border border-ga-line px-3 py-1.5 text-[12px] font-semibold text-ga-ink transition-colors hover:border-ga-accent hover:text-ga-accent">
            Trang chấm thử <ExternalLink size={13} />
          </a>
        }
      />

      <div className="flex-1 overflow-auto px-10 py-6">
        {loading ? (
          <div className="flex flex-col gap-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="ga-shimmer h-[64px] border border-ga-line" aria-hidden />)}</div>
        ) : error ? (
          <div className="border border-ga-line bg-ga-card px-10 py-[52px] text-center">
            <h2 className="font-ga-display text-[24px] font-medium text-ga-red">Không tải được số liệu tăng trưởng</h2>
            <p className="ga-ui mx-auto mb-5 mt-3 max-w-sm text-[14px] text-ga-muted">{error} <code className="font-mono text-[12px] text-ga-accent">GET /api/admin/marketing/*</code></p>
            <GaBtn variant="primary" onClick={load}>Thử lại</GaBtn>
          </div>
        ) : (
          <>
            <TkStatStrip
              items={[
                { label: 'Lead (tổng)', value: (stats?.leadsTotal ?? 0).toLocaleString(), sub: `+${stats?.leads7d ?? 0} trong 7 ngày` },
                { label: 'Lead hôm nay', value: stats?.leadsToday ?? 0, sub: '24 giờ qua', color: '#1E9E61' },
                { label: 'Lượt chấm thử', value: (stats?.reportsTotal ?? 0).toLocaleString(), sub: `+${stats?.reports7d ?? 0} trong 7 ngày`, color: '#7C56C8' },
                { label: 'Điểm TB', value: stats?.avgScore ?? 0, sub: 'trên 100', color: '#E07B39' },
              ]}
            />

            <div className="mt-[22px] grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <SplitCard icon={<Mail size={16} className="text-ga-accent" />} label="Lead để lại Email" value={stats?.emailLeads ?? 0} total={stats?.leadsTotal ?? 0} tone="var(--ga-blue)" />
              <SplitCard icon={<MessageCircle size={16} className="text-ga-accent" />} label="Lead để lại Zalo/ĐT" value={stats?.zaloLeads ?? 0} total={stats?.leadsTotal ?? 0} tone="var(--ga-teal)" />
            </div>

            {/* Recent leads */}
            <div className="mb-3.5 mt-[22px]"><GaCap>Lead gần đây (30 ngày) · {leads.length}</GaCap></div>
            {leads.length === 0 ? (
              <div className="border border-dashed border-ga-line px-10 py-[40px] text-center text-[14px] text-ga-muted">Chưa có lead nào.</div>
            ) : (
              <div className="border border-ga-line bg-ga-card">
                <div className="grid items-center gap-2 border-b border-ga-line bg-ga-bg px-5 py-[11px]" style={{ gridTemplateColumns: '1.2fr 1.4fr 1fr 70px 110px' }}>
                  {['Tên', 'Liên hệ', 'Chủ đề', 'Điểm', 'Ngày'].map((h) => <span key={h} className="ga-ui text-[10px] font-bold uppercase tracking-[0.1em] text-ga-muted">{h}</span>)}
                </div>
                {leads.map((l, i) => (
                  <div key={l.id} className="grid items-center gap-2 px-5 py-3 transition-colors hover:bg-ga-surface" style={{ gridTemplateColumns: '1.2fr 1.4fr 1fr 70px 110px', borderTop: i ? '1px solid var(--ga-line)' : 'none' }}>
                    <span className="truncate text-[13.5px] font-semibold text-ga-ink">{l.name || '—'}</span>
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-[13px] text-ga-ink">{l.contact}</span>
                      <span className="shrink-0 px-1.5 py-0.5 text-[10px] font-bold uppercase text-ga-muted" style={{ background: 'var(--ga-side-active)' }}>{l.contactType}</span>
                    </span>
                    <span className="truncate text-[12.5px] text-ga-muted">{l.topic || '—'}</span>
                    <span className="text-[13px] font-semibold">{l.score != null ? <span className="text-ga-ink">{l.score}</span> : <span className="text-[11px] text-ga-red">AI lỗi</span>}</span>
                    <span className="text-[12px] text-ga-muted">{fmtDate(l.createdAt)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Teacher clusters (B2B org-sales trigger) */}
            <div className="mb-3.5 mt-[22px]"><GaCap>Cụm GV theo trung tâm (≥3 GV tự do) · cơ hội B2B</GaCap></div>
            {clusters.length === 0 ? (
              <div className="border border-dashed border-ga-line px-10 py-[34px] text-center text-[13.5px] text-ga-muted">Chưa có cụm nào (cần ≥3 GV tự do khai cùng một trung tâm).</div>
            ) : (
              <div className="border border-ga-line bg-ga-card">
                <div className="grid items-center gap-2 border-b border-ga-line bg-ga-bg px-5 py-[11px]" style={{ gridTemplateColumns: '1.4fr 90px 1.6fr' }}>
                  {['Trung tâm', 'Số GV', 'Email liên hệ'].map((h) => <span key={h} className="ga-ui text-[10px] font-bold uppercase tracking-[0.1em] text-ga-muted">{h}</span>)}
                </div>
                {clusters.map((c, i) => (
                  <div key={c.centerName} className="grid items-center gap-2 px-5 py-3 transition-colors hover:bg-ga-surface" style={{ gridTemplateColumns: '1.4fr 90px 1.6fr', borderTop: i ? '1px solid var(--ga-line)' : 'none' }}>
                    <span className="truncate text-[13.5px] font-semibold text-ga-ink">{c.centerName}</span>
                    <span><span className="px-2 py-0.5 text-[11px] font-bold" style={{ color: 'var(--ga-green)', background: 'var(--ga-green-soft)' }}>{c.teacherCount} GV</span></span>
                    <span className="truncate text-[12px] text-ga-muted">{c.contactEmails}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
