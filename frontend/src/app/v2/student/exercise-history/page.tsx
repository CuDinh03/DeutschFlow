'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { apiMessage } from '@/lib/api'
import { planAttemptsApi, type PlanAttemptRow } from '@/lib/planAttemptsApi'
import { usePageTimeTracker } from '@/hooks/usePageTimeTracker'
import { DataTable, EmptyState, GaBtn, GaPageHdr, type DataTableColumn } from '@/components/ui-v2'

/**
 * /v2/student/exercise-history — lịch sử làm bài của lộ trình (vỏ Galerie).
 *
 * Port của /student/exercise-history: GIỮ NGUYÊN endpoint GET /plan/me/attempts (qua
 * `planAttemptsApi.list(page, 25)` — dùng lại lib, không copy) và giữ nguyên phân trang
 * SERVER-side (page 0-based, size 25) cùng event PostHog `exercise_history`.
 *
 * KHÁC /v2/student/progress: trang kia là tiến độ LỚP (buổi đã dạy, knowledge points do GV cập
 * nhật). Trang này là các LƯỢT NỘP bài của lộ trình cá nhân (tuần/buổi · lần thử · điểm % · số lỗi).
 *
 * ⚠️ Cột "Mở buổi" của v1 trỏ tới /student/plan/week/{w}/session/{s} — route ĐÓ KHÔNG TỒN TẠI
 * (đã 404 sẵn trên v1; không có bản v2 tương ứng: /v2/student/roadmap là learning-tree, không phải
 * plan tuần/buổi). Vì vậy cột này bị BỎ thay vì port một link chết trỏ vào cây v1 sắp xoá.
 * Khi nào có runner buổi học ở v2 thì thêm lại cột này.
 */

const PAGE_SIZE = 25

/** Ngưỡng màu điểm — thuần trình bày, không đổi dữ liệu. */
function scoreColor(pct: number) {
  if (pct >= 80) return 'var(--ga-green)'
  if (pct >= 50) return 'var(--ga-orange)'
  return 'var(--ga-red)'
}

export default function V2StudentExerciseHistoryPage() {
  usePageTimeTracker('exercise_history')
  const t = useTranslations('v2.student.exerciseHistory')

  const [rows, setRows] = useState<PlanAttemptRow[]>([])
  const [page, setPage] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await planAttemptsApi.list(page, PAGE_SIZE)
      setRows(res.data.content ?? [])
      setTotalPages(Math.max(1, res.data.totalPages ?? 1))
    } catch (e: unknown) {
      setError(apiMessage(e))
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => {
    void load()
  }, [load])

  const columns: DataTableColumn<PlanAttemptRow>[] = [
    {
      key: 'createdAt',
      header: t('when'),
      render: (r) => (
        <span className="whitespace-nowrap text-ga-ink">
          {new Date(r.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
        </span>
      ),
    },
    {
      key: 'session',
      header: t('session'),
      render: (r) => (
        <span className="font-semibold text-ga-ink">
          {t('weekSession', { w: r.weekNumber, s: r.sessionIndex })}
        </span>
      ),
    },
    {
      key: 'attemptNo',
      header: t('try'),
      render: (r) => <span className="text-ga-muted">#{r.attemptNo}</span>,
    },
    {
      key: 'scorePercent',
      header: t('score'),
      align: 'right',
      render: (r) => (
        <span className="font-semibold" style={{ color: scoreColor(r.scorePercent) }}>
          {r.scorePercent}%
        </span>
      ),
    },
    {
      key: 'mistakeCount',
      header: t('mistakes'),
      align: 'right',
      render: (r) => <span className="text-ga-muted">{r.mistakeCount == null ? '—' : r.mistakeCount}</span>,
    },
  ]

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr accent title={t('title')} subtitle={t('subtitle')} />

      <div className="flex-1 px-10 py-6">
        <div className="mx-auto max-w-4xl space-y-4">
          <DataTable
            columns={columns}
            data={rows}
            rowKey={(r) => r.id}
            loading={loading}
            error={error}
            onRetry={load}
            errorEndpoint="GET /api/plan/me/attempts"
            // Phân trang do SERVER làm (page/size) → tắt phân trang nội bộ của DataTable,
            // nếu không nó sẽ cắt lại 25 dòng của trang hiện tại thành các trang con 8 dòng.
            pageSize={0}
            empty={<EmptyState icon="history" title={t('emptyTitle')} description={t('emptyDesc')} />}
          />

          {!loading && !error && rows.length > 0 && (
            <div className="flex items-center justify-between gap-2">
              <GaBtn variant="ghost" size="sm" disabled={page <= 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                {t('prevPage')}
              </GaBtn>
              <span className="ga-ui text-[13px] text-ga-muted">
                {t('pageOf', { n: page + 1, total: totalPages })}
              </span>
              <GaBtn
                variant="ghost"
                size="sm"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                {t('nextPage')}
              </GaBtn>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
