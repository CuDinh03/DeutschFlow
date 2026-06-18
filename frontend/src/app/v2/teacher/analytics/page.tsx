'use client'

import { useCallback, useEffect, useState } from 'react'
import { FileDown } from 'lucide-react'
import api from '@/lib/api'
import { GaPageHdr, GaBtn, TkStatStrip, ErrorBanner, LoadingState } from '@/components/ui-v2'
import { GaSection, GaBarRow, GA_CHART, nfVN } from '../../analyticsShared'

// Option-1: real teacher reports are FLAT (no time-series). Reuse:
//   GET /v2/teacher/reports/overview  → { classCount, assignmentCount, studentCount, avgScore }
//   GET /v2/teacher/classes           → class list
//   GET /v2/teacher/reports/classes/{id} → per-class { studentCount, assignmentCount, avgScore }
// Proto's score-trend chart + student leaderboard have no backing endpoint → dropped (backlog).

const VIOLET = '#7C56C8'

interface Overview {
  classCount: number
  studentCount: number
  assignmentCount: number
  avgScore: number
}
interface ClassRow {
  id: number
  name: string
  studentCount: number
  assignmentCount: number
  avgScore: number
}

function num(r: Record<string, unknown>, ...keys: string[]): number {
  for (const k of keys) {
    const n = Number(r[k])
    if (r[k] != null && Number.isFinite(n)) return n
  }
  return 0
}

export default function V2TeacherAnalyticsPage() {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [rows, setRows] = useState<ClassRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [ovRes, clsRes] = await Promise.all([
        api.get('/v2/teacher/reports/overview'),
        api.get('/v2/teacher/classes'),
      ])
      const o = (ovRes.data ?? {}) as Record<string, unknown>
      setOverview({
        classCount: num(o, 'classCount'),
        studentCount: num(o, 'studentCount'),
        assignmentCount: num(o, 'assignmentCount'),
        avgScore: num(o, 'avgScore'),
      })
      const classes = (clsRes.data ?? []) as Record<string, unknown>[]
      const detail = await Promise.all(
        classes.map(async (c) => {
          const id = Number(c.id)
          let d: Record<string, unknown> = {}
          try {
            d = ((await api.get(`/v2/teacher/reports/classes/${id}`)).data ?? {}) as Record<string, unknown>
          } catch {
            d = {}
          }
          return {
            id,
            name: String(c.name ?? `Lớp ${id}`),
            studentCount: num(d, 'studentCount') || num(c, 'studentCount', 'students'),
            assignmentCount: num(d, 'assignmentCount') || num(c, 'quizCount', 'taskCount'),
            avgScore: num(d, 'avgScore'),
          } as ClassRow
        }),
      )
      setRows(detail)
    } catch {
      setError('Không thể tải dữ liệu phân tích.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const scored = rows.filter((r) => r.avgScore > 0)

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr
        accent
        title="Phân tích giảng dạy"
        subtitle="Tổng quan lớp học, bài tập và điểm trung bình"
        right={
          <GaBtn variant="ghost" size="sm" onClick={() => window.print()}>
            <FileDown size={15} aria-hidden /> Xuất PDF
          </GaBtn>
        }
      />
      <div className="flex-1 px-10 py-6">
        {error && (
          <div className="mb-5">
            <ErrorBanner message={error} onRetry={() => void load()} />
          </div>
        )}
        {loading ? (
          <LoadingState label="Đang tải phân tích…" />
        ) : (
          <div className="space-y-[22px]">
            <TkStatStrip
              items={[
                { label: 'Lớp học', value: overview?.classCount ?? 0, color: VIOLET },
                { label: 'Học viên', value: overview?.studentCount ?? 0, sub: 'tổng cộng', color: '#2F6FC9' },
                { label: 'Bài tập', value: overview?.assignmentCount ?? 0, sub: 'đã giao', color: '#11888A' },
                {
                  label: 'Điểm trung bình',
                  value: overview && overview.avgScore > 0 ? overview.avgScore.toFixed(1) : '—',
                  sub: 'thang 100',
                  color: '#1E9E61',
                },
              ]}
            />

            <GaSection title="Điểm trung bình theo lớp">
              {scored.length > 0 ? (
                <div className="space-y-1">
                  {scored
                    .sort((a, b) => b.avgScore - a.avgScore)
                    .map((r, i) => (
                      <GaBarRow
                        key={r.id}
                        label={r.name}
                        value={r.avgScore}
                        max={100}
                        color={GA_CHART[i % GA_CHART.length]}
                        display={`${r.avgScore.toFixed(1)}đ`}
                      />
                    ))}
                </div>
              ) : (
                <p className="ga-ui py-8 text-center text-[14px] text-ga-muted">
                  Chưa có điểm trung bình theo lớp (chưa có bài chấm).
                </p>
              )}
            </GaSection>

            <GaSection title="Chi tiết theo lớp" bodyClassName="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-ga-border">
                      {['Lớp', 'Học viên', 'Bài tập', 'Điểm TB'].map((h, i) => (
                        <th
                          key={h}
                          className={`ga-ui px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-ga-muted ${
                            i === 0 ? '' : 'text-right'
                          }`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="ga-ui px-5 py-10 text-center text-[14px] text-ga-muted">
                          Chưa có lớp học nào.
                        </td>
                      </tr>
                    ) : (
                      rows.map((r) => (
                        <tr key={r.id} className="border-b border-ga-border last:border-0 hover:bg-ga-surface">
                          <td className="px-5 py-3 text-[14px] font-semibold text-ga-ink">{r.name}</td>
                          <td className="px-5 py-3 text-right text-[13.5px] tabular-nums text-ga-muted">
                            {nfVN.format(r.studentCount)}
                          </td>
                          <td className="px-5 py-3 text-right text-[13.5px] tabular-nums text-ga-muted">
                            {nfVN.format(r.assignmentCount)}
                          </td>
                          <td className="px-5 py-3 text-right text-[13.5px] font-semibold tabular-nums text-ga-ink">
                            {r.avgScore > 0 ? r.avgScore.toFixed(1) : '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </GaSection>
          </div>
        )}
      </div>
    </div>
  )
}
