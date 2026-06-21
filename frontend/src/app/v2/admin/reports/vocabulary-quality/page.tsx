'use client'

import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import api, { apiMessage } from '@/lib/api'
import { GaPageHdr, GaBtn, GaCap, TkStatStrip } from '@/components/ui-v2'

// Báo cáo chất lượng từ vựng (admin) — navy (W1.7 migrate admin/reports/vocabulary-quality).
// GET /api/admin/reports/vocabulary-quality?days=N → VocabQualityData.

interface VocabQualityDay { date: string; total_generated: number; approved: number; rejected: number; pending: number; approval_rate_pct: number }
interface Data { days: VocabQualityDay[]; total_generated: number; overall_approval_rate_pct: number }
const selectCls = 'ga-ui border border-ga-line bg-ga-bg px-2.5 py-1.5 text-[12px] text-ga-ink outline-none'

function rateColor(p: number) {
  if (p >= 80) return { color: 'var(--ga-green)', background: 'var(--ga-green-soft)' }
  if (p >= 60) return { color: 'var(--ga-orange)', background: 'var(--ga-orange-soft)' }
  return { color: 'var(--ga-red)', background: 'var(--ga-red-soft)' }
}

export default function V2VocabularyQualityPage() {
  const router = useRouter()
  const [data, setData] = useState<Data | null>(null)
  const [days, setDays] = useState(30)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try { const { data: res } = await api.get<Data>(`/admin/reports/vocabulary-quality?days=${days}`); setData(res); setError('') }
    catch (e: unknown) { setError(apiMessage(e)) }
    finally { setLoading(false) }
  }, [days])
  useEffect(() => { void load() }, [load])

  const GRID = '1fr 80px 80px 80px 70px 96px'

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr
        accent
        title="Báo cáo chất lượng từ vựng"
        subtitle="Tỷ lệ phê duyệt từ vựng AI theo ngày"
        right={
          <div className="flex items-center gap-2">
            <select className={selectCls} value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Khoảng ngày">
              {[7, 14, 30, 90].map((d) => <option key={d} value={d}>{d} ngày</option>)}
            </select>
            <GaBtn variant="ghost" size="sm" onClick={() => router.push('/v2/admin/reports')}><ArrowLeft size={15} /> Báo cáo</GaBtn>
          </div>
        }
      />
      <div className="flex-1 overflow-auto px-10 py-6">
        {loading ? (
          <div className="flex flex-col gap-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="ga-shimmer h-[44px] border border-ga-line" aria-hidden />)}</div>
        ) : error ? (
          <div className="border border-ga-line bg-ga-card px-10 py-[52px] text-center">
            <h2 className="font-ga-display text-[24px] font-medium text-ga-red">Không tải được báo cáo</h2>
            <p className="ga-ui mx-auto mb-5 mt-3 max-w-sm text-[14px] text-ga-muted">{error} <code className="font-mono text-[12px] text-ga-accent">GET /api/admin/reports/vocabulary-quality</code></p>
            <GaBtn variant="primary" onClick={load}>Thử lại</GaBtn>
          </div>
        ) : !data ? (
          <div className="border border-dashed border-ga-line px-10 py-[40px] text-center text-[14px] text-ga-muted">Không có dữ liệu.</div>
        ) : (
          <>
            <TkStatStrip
              items={[
                { label: 'Tổng từ vựng sinh', value: (data.total_generated ?? 0).toLocaleString(), sub: `${days} ngày` },
                { label: 'Tỷ lệ phê duyệt', value: `${data.overall_approval_rate_pct ?? 0}%`, sub: 'tổng thể', color: '#1E9E61' },
                { label: 'Khoảng thời gian', value: `${days}`, sub: 'ngày', color: '#E07B39' },
              ]}
            />
            <div className="mb-3.5 mt-[22px]"><GaCap>Chi tiết theo ngày</GaCap></div>
            <div className="border border-ga-line bg-ga-card">
              <div className="grid items-center gap-2 border-b border-ga-line bg-ga-bg px-5 py-[11px]" style={{ gridTemplateColumns: GRID }}>
                {['Ngày', 'Sinh ra', 'Duyệt', 'Từ chối', 'Chờ', 'Tỷ lệ'].map((h, i) => <span key={h} className={`ga-ui text-[10px] font-bold uppercase tracking-[0.1em] text-ga-muted ${i >= 1 ? 'text-center' : ''}`}>{h}</span>)}
              </div>
              {(data.days ?? []).length === 0 ? (
                <div className="px-6 py-[30px] text-center text-[14px] text-ga-muted">Chưa có dữ liệu ngày nào.</div>
              ) : (
                (data.days ?? []).map((r, i) => (
                  <div key={r.date} className="grid items-center gap-2 px-5 py-2.5 transition-colors hover:bg-ga-surface" style={{ gridTemplateColumns: GRID, borderTop: i ? '1px solid var(--ga-line)' : 'none' }}>
                    <span className="font-mono text-[12px] text-ga-muted">{r.date}</span>
                    <span className="text-center text-[13px] font-semibold text-ga-ink">{r.total_generated}</span>
                    <span className="text-center text-[13px] font-semibold" style={{ color: 'var(--ga-green)' }}>{r.approved}</span>
                    <span className="text-center text-[13px] font-semibold" style={{ color: 'var(--ga-red)' }}>{r.rejected}</span>
                    <span className="text-center text-[13px] font-semibold" style={{ color: 'var(--ga-orange)' }}>{r.pending}</span>
                    <span className="flex justify-center"><span className="px-2 py-0.5 text-[11px] font-bold" style={rateColor(r.approval_rate_pct)}>{r.approval_rate_pct}%</span></span>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
