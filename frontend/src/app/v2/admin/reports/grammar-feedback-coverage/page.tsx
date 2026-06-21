'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import api, { apiMessage } from '@/lib/api'
import { GaPageHdr, GaBtn, GaCap, TkStatStrip } from '@/components/ui-v2'

// Báo cáo phản hồi ngữ pháp (admin) — navy (W1.7 migrate admin/reports/grammar-feedback-coverage).
// GET /api/admin/reports/grammar-feedback-coverage?days=N → GrammarCoverageRow[].

interface Row { grammar_point: string; feedback_count: number; distinct_users: number; last_seen: string }
const selectCls = 'ga-ui border border-ga-line bg-ga-bg px-2.5 py-1.5 text-[12px] text-ga-ink outline-none'

export default function V2GrammarFeedbackCoveragePage() {
  const router = useRouter()
  const [rows, setRows] = useState<Row[]>([])
  const [days, setDays] = useState(7)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try { const { data } = await api.get<Row[]>(`/admin/reports/grammar-feedback-coverage?days=${days}`); setRows(data ?? []); setError('') }
    catch (e: unknown) { setError(apiMessage(e)) }
    finally { setLoading(false) }
  }, [days])
  useEffect(() => { void load() }, [load])

  const maxCount = useMemo(() => Math.max(1, ...rows.map((r) => r.feedback_count)), [rows])
  const totalFb = rows.reduce((s, r) => s + r.feedback_count, 0)
  const maxUsers = rows.length ? Math.max(...rows.map((r) => r.distinct_users)) : 0

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr
        accent
        title="Báo cáo phản hồi ngữ pháp"
        subtitle="Lỗi ngữ pháp phổ biến cần bổ sung nội dung"
        right={
          <div className="flex items-center gap-2">
            <select className={selectCls} value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Khoảng ngày">
              {[7, 14, 30].map((d) => <option key={d} value={d}>{d} ngày</option>)}
            </select>
            <GaBtn variant="ghost" size="sm" onClick={() => router.push('/v2/admin/reports')}><ArrowLeft size={15} /> Báo cáo</GaBtn>
          </div>
        }
      />
      <div className="flex-1 overflow-auto px-10 py-6">
        {loading ? (
          <div className="flex flex-col gap-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="ga-shimmer h-[48px] border border-ga-line" aria-hidden />)}</div>
        ) : error ? (
          <div className="border border-ga-line bg-ga-card px-10 py-[52px] text-center">
            <h2 className="font-ga-display text-[24px] font-medium text-ga-red">Không tải được báo cáo</h2>
            <p className="ga-ui mx-auto mb-5 mt-3 max-w-sm text-[14px] text-ga-muted">{error} <code className="font-mono text-[12px] text-ga-accent">GET /api/admin/reports/grammar-feedback-coverage</code></p>
            <GaBtn variant="primary" onClick={load}>Thử lại</GaBtn>
          </div>
        ) : rows.length === 0 ? (
          <div className="border border-dashed border-ga-line px-10 py-[40px] text-center text-[14px] text-ga-muted">Không có dữ liệu trong {days} ngày.</div>
        ) : (
          <>
            <TkStatStrip
              items={[
                { label: 'Điểm ngữ pháp', value: rows.length, sub: 'cần chú ý' },
                { label: 'Tổng phản hồi', value: totalFb.toLocaleString(), sub: `${days} ngày qua`, color: '#2F6FC9' },
                { label: 'Học viên (max)', value: maxUsers, sub: 'trên 1 điểm', color: '#E07B39' },
              ]}
            />
            <div className="mb-3.5 mt-[22px]"><GaCap>Điểm ngữ pháp cần chú ý (top 20)</GaCap></div>
            <div className="border border-ga-line bg-ga-card">
              {rows.slice(0, 20).map((r, i) => {
                const pct = Math.round((r.feedback_count / maxCount) * 100)
                return (
                  <div key={r.grammar_point} className="px-5 py-3.5" style={{ borderTop: i ? '1px solid var(--ga-line)' : 'none' }}>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="flex min-w-0 items-center gap-3">
                        <span className="w-5 shrink-0 text-[11px] font-bold text-ga-muted">{i + 1}</span>
                        <span className="truncate text-[14px] font-semibold text-ga-ink">{r.grammar_point}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-3 text-[12px] text-ga-muted">
                        <span className="font-bold text-ga-accent">{r.feedback_count} lần</span>
                        <span>{r.distinct_users} HV</span>
                      </span>
                    </div>
                    <span className="ml-8 block h-1.5 bg-ga-line"><span className="block h-full" style={{ width: `${pct}%`, background: 'var(--ga-accent)' }} /></span>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
