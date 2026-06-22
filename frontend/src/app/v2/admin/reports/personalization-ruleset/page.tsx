'use client'

import { useCallback, useEffect, useState } from 'react'
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
const DIMENSION_VI: Record<string, { label: string; desc: string }> = {
  goalType: { label: 'Mục tiêu học', desc: 'Công việc · Du học · Định cư · Thi cử' },
  targetLevel: { label: 'Trình độ đích', desc: 'CEFR mục tiêu (A1–C2)' },
  learningSpeed: { label: 'Tốc độ học', desc: 'Nhịp độ mong muốn' },
  industry: { label: 'Ngành nghề', desc: 'Bối cảnh chuyên ngành' },
  sessionsPerWeek: { label: 'Buổi / tuần', desc: 'Tần suất học' },
  minutesPerSession: { label: 'Phút / buổi', desc: 'Thời lượng mỗi buổi' },
}
const dimMeta = (k: string) =>
  DIMENSION_VI[k] ?? { label: k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()), desc: '' }

export default function V2PersonalizationRulesetPage() {
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
        title="Ruleset cá nhân hoá"
        subtitle="Bộ quy tắc suy ra loại buổi học từ hồ sơ học viên"
        right={
          <GaBtn variant="ghost" size="sm" onClick={() => router.push('/v2/admin/reports')}>
            <ArrowLeft size={15} /> Báo cáo
          </GaBtn>
        }
      />
      <div className="flex-1 overflow-auto px-10 py-6">
        {loading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="ga-shimmer h-[100px] border border-ga-line" aria-hidden />
            ))}
          </div>
        ) : error ? (
          <div className="border border-ga-line bg-ga-card px-10 py-[52px] text-center">
            <h2 className="font-ga-display text-[24px] font-medium text-ga-red">Không tải được báo cáo</h2>
            <p className="ga-ui mx-auto mb-5 mt-3 max-w-sm text-[14px] text-ga-muted">
              {error} <code className="font-mono text-[12px] text-ga-accent">GET /api/admin/reports/personalization-ruleset</code>
            </p>
            <GaBtn variant="primary" onClick={load}>
              Thử lại
            </GaBtn>
          </div>
        ) : !data ? (
          <div className="border border-dashed border-ga-line px-10 py-[40px] text-center text-[14px] text-ga-muted">Không có dữ liệu.</div>
        ) : (
          <>
            {/* Active version banner */}
            <div className="flex items-center gap-4 border border-ga-line bg-ga-card p-[22px]">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full" style={{ background: 'var(--ga-accent-soft, rgba(47,111,201,0.12))' }}>
                <GitBranch size={22} style={{ color: 'var(--ga-accent)' }} />
              </span>
              <div>
                <GaCap>Phiên bản ruleset đang hoạt động</GaCap>
                <p className="mt-1 font-ga-display text-[28px] font-medium text-ga-ink">{data.version ?? '—'}</p>
              </div>
            </div>

            <div className="mb-3.5 mt-[26px]">
              <GaCap>Các chiều cá nhân hoá được hỗ trợ ({dims.length})</GaCap>
            </div>
            {dims.length === 0 ? (
              <div className="border border-dashed border-ga-line px-10 py-[40px] text-center text-[14px] text-ga-muted">
                Ruleset chưa khai báo chiều nào.
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
