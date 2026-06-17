'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, ArrowRight } from 'lucide-react'
import { phaseApi, type PhaseStateResponse, type PhaseType } from '@/lib/phaseApi'
import { GaPageHdr, GaCard, GaCap, LoadingState, ErrorBanner } from '@/components/ui-v2'

const PHASES: { type: PhaseType; label: string; desc: string }[] = [
  { type: 'FOUNDATION', label: 'Nền tảng', desc: 'Bảng chữ cái, từ vựng & ngữ pháp cơ bản (A1)' },
  { type: 'PRODUCTION', label: 'Sản sinh', desc: 'Tạo câu, luyện nói có cấu trúc (A2–B1)' },
  { type: 'FLUENCY', label: 'Lưu loát', desc: 'Hội thoại tự nhiên, phỏng vấn, thi thử (B1–B2)' },
  { type: 'GRADUATED', label: 'Tốt nghiệp', desc: 'Sẵn sàng cho kỳ thi Goethe & môi trường thực tế' },
]
const ORDER: PhaseType[] = ['FOUNDATION', 'PRODUCTION', 'FLUENCY', 'GRADUATED']

export default function V2StudentRoadmapPage() {
  const [phase, setPhase] = useState<PhaseStateResponse | null>(null)
  const [nextActions, setNextActions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    setError(null)
    Promise.allSettled([phaseApi.getCurrent(), phaseApi.getNextActions()])
      .then(([p, n]) => {
        if (p.status === 'fulfilled') setPhase(p.value.data)
        else setError('Không thể tải lộ trình.')
        if (n.status === 'fulfilled') setNextActions(n.value.data.nextActions ?? [])
      })
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const currentIdx = phase ? ORDER.indexOf(phase.currentPhase) : -1

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr accent title="Lộ trình học" subtitle="Hành trình 4 giai đoạn từ người mới đến sẵn sàng thi" />
      <div className="flex-1 px-10 py-6">
        {error && (
          <div className="mb-5">
            <ErrorBanner message={error} onRetry={load} />
          </div>
        )}
        {loading ? (
          <LoadingState label="Đang tải lộ trình…" />
        ) : (
          <div className="space-y-[22px]">
            {/* Phase timeline */}
            <div className="space-y-0">
              {PHASES.map((p, i) => {
                const done = currentIdx > i
                const active = currentIdx === i
                const tone = done ? 'var(--ga-green)' : active ? 'var(--ga-accent)' : 'var(--ga-subtle)'
                return (
                  <div key={p.type} className="flex gap-4">
                    {/* rail */}
                    <div className="flex flex-col items-center">
                      <span
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[14px] font-bold text-white"
                        style={{ background: tone }}
                      >
                        {done ? <Check size={18} aria-hidden /> : i + 1}
                      </span>
                      {i < PHASES.length - 1 && (
                        <span className="my-1 w-0.5 flex-1" style={{ background: done ? 'var(--ga-green)' : 'var(--ga-border)' }} />
                      )}
                    </div>
                    {/* card */}
                    <div className={`mb-4 flex-1 border bg-ga-card p-5 ${active ? 'border-ga-accent' : 'border-ga-line'}`}>
                      <div className="flex items-center gap-2">
                        <p className="font-ga-display text-[19px] font-medium text-ga-ink">{p.label}</p>
                        {active && (
                          <span className="ga-ui rounded-ga-pill bg-ga-accent-soft px-2 py-0.5 text-[11px] font-semibold text-ga-accent">
                            Hiện tại
                          </span>
                        )}
                        {done && <span className="ga-ui text-[12px] font-semibold text-ga-green">Hoàn thành</span>}
                      </div>
                      <p className="ga-ui mt-1 text-[13.5px] text-ga-muted">{p.desc}</p>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Current stats + next actions */}
            <div className="grid grid-cols-1 gap-[22px] lg:grid-cols-2">
              {phase && (
                <GaCard className="p-6">
                  <GaCap className="mb-3 block">Tiến độ hiện tại</GaCap>
                  <div className="space-y-3">
                    {[
                      ['Từ vựng đã thuộc', phase.vocabularyMasteredCount],
                      ['Phút luyện nói', phase.speakingMinutesTotal],
                      ['Độ chính xác ngữ pháp', `${Math.round(phase.grammarAccuracyPercent)}%`],
                      ['Phiên hoàn thành', phase.sessionsCompleted],
                    ].map(([k, v]) => (
                      <div key={String(k)} className="ga-ui flex items-center justify-between text-[13.5px]">
                        <span className="text-ga-muted">{k}</span>
                        <span className="font-semibold text-ga-ink">{v}</span>
                      </div>
                    ))}
                  </div>
                </GaCard>
              )}

              <GaCard className="p-6">
                <GaCap className="mb-3 block">Việc nên làm tiếp theo</GaCap>
                {nextActions.length > 0 ? (
                  <ul className="space-y-2.5">
                    {nextActions.map((a, i) => (
                      <li key={i} className="ga-ui flex items-start gap-2.5 text-[14px] text-ga-ink">
                        <ArrowRight size={16} className="mt-0.5 shrink-0 text-ga-accent" aria-hidden />
                        {a}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="ga-ui text-[13.5px] text-ga-muted">Tiếp tục luyện tập hằng ngày để tiến bộ.</p>
                )}
                <Link
                  href="/v2/student/dashboard"
                  className="ga-ui mt-4 inline-flex items-center gap-1 text-[13px] font-semibold text-ga-accent"
                >
                  Tới bảng điều khiển <ArrowRight size={14} aria-hidden />
                </Link>
              </GaCard>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
