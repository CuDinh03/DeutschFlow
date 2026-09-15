'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import api from '@/lib/api'
import { GaStatStrip, type GaStatItem, ErrorBanner, LoadingState } from '@/components/ui-v2'
import { GaPageHdr } from '@/components/ui-v2'
import { GaSection, GaBars } from '../../analyticsShared'
import { useFmt } from '@/lib/i18n/useFmt'

// ── Real shape of GET /admin/analytics/revenue (AdminAnalyticsController) ────────
interface RevenueOverview {
  grossVnd: number
  netVnd: number
  marginPct: number
}
interface ChartRow {
  period: string
  grossVnd: number
  netVnd: number
  storeFeeVnd: number
  apiCostVnd: number
  marginPct: number
  subscribers: number
}
interface Transaction {
  id: number
  email: string
  planCode: string
  amount: number
  status: string
  providerTransactionId: string
  createdAt: string
}
interface TransactionPage {
  content: Transaction[]
  totalPages: number
  totalElements: number
}
interface RevenueResponse {
  // Backend (AdminRevenueAnalyticsResponse) serialises this as `totals`, not `overview`.
  totals: RevenueOverview
  chartData: ChartRow[]
  transactions: TransactionPage
}

const PAGE_SIZE = 20

// Tập trạng thái THẬT của payment_transactions (V129__payment_gateway.sql):
// PENDING | SUCCESS | FAILED | CANCELLED. Mã cũ nhận diện 'COMPLETED' — một giá trị không tồn tại
// ở bất kỳ đâu trong backend — nên MỌI giao dịch SUCCESS rơi vào nhánh mặc định và hiện màu cam
// y như đang chờ. Giá trị ngoài tập được gọi thẳng là "không xác định", không giả làm đang chờ.
const STATUS_TONE: Record<string, { color: string; key: string }> = {
  SUCCESS: { color: 'var(--ga-green)', key: 'statusSuccess' },
  FAILED: { color: 'var(--ga-red)', key: 'statusFailed' },
  PENDING: { color: 'var(--ga-orange)', key: 'statusPending' },
  CANCELLED: { color: 'var(--ga-muted)', key: 'statusCancelled' },
}

function StatusDot({ status, t }: { status: string; t: (k: string) => string }) {
  const s = (status ?? '').toUpperCase()
  const known = STATUS_TONE[s]
  const color = known?.color ?? 'var(--ga-muted)'
  return (
    <span className="ga-ui inline-flex items-center gap-1.5 text-[12px] font-semibold" style={{ color }}>
      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {known ? t(known.key) : t('statusUnknown')}
    </span>
  )
}

export default function V2AdminRevenuePage() {
  const t = useTranslations('v2.adminOps.revenue')
  const fmt = useFmt()
  const [data, setData] = useState<RevenueResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(0)

  const fetchData = useCallback(async (pageNum: number) => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get<RevenueResponse>('/admin/analytics/revenue', {
        params: { page: pageNum, size: PAGE_SIZE },
      })
      setData(res.data)
      setPage(pageNum)
    } catch {
      setError(t('loadError'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    fetchData(0)
  }, [fetchData])

  const overview = data?.totals
  const chart = data?.chartData ?? []
  const tx = data?.transactions
  const latest = chart.length > 0 ? chart[chart.length - 1] : null
  const netRemaining = latest?.netVnd ?? overview?.netVnd ?? 0

  // F01: giá trị này là gross − phí cửa hàng giả định 15% − chi phí AI ước tính, của MỘT kỳ gần nhất
  // (AdminAnalyticsService.STORE_FEE_RATE). Gọi nó là "MRR" là sai nghĩa: MRR là doanh thu định kỳ
  // của các thuê bao đang hiệu lực, không phải phần còn lại sau chi phí. ARR cũ = giá trị này × 12
  // nên đã bỏ hẳn — phép ngoại suy đó không có cơ sở khi chưa biết kỳ có đủ tháng hay chưa.
  // F02: `subscribers` là COUNT(id) trên giao dịch SUCCESS (PaymentTransactionRepository) — số GIAO DỊCH,
  // không phải số người. Hai giao dịch của cùng một người đếm thành 2.
  const cells: GaStatItem[] = [
    {
      label: t('stats.netRemaining'),
      value: fmt.vndCompact(netRemaining),
      tone: netRemaining < 0 ? 'orange' : 'green',
      sub: latest ? latest.period : '—',
    },
    {
      label: t('stats.successTx'),
      value: latest ? fmt.num(latest.subscribers) : '—',
      tone: 'violet',
      sub: t('stats.successTxSub'),
    },
    {
      label: t('stats.margin'),
      value: overview ? `${overview.marginPct.toFixed(1)}%` : '—',
      tone: overview && overview.marginPct >= 50 ? 'green' : 'orange',
      sub: t('stats.marginSub'),
    },
  ]

  // F04: bản cũ vẽ donut với Math.max(0, …) — một kỳ lỗ (net âm) bị kẹp về 0 rồi `filter(v > 0)`
  // loại luôn khỏi hình, nên hình trông như kỳ đó hoà vốn. Donut vốn không biểu diễn được số âm:
  // nó chia một tổng dương thành các phần. Thay bằng bảng có dấu — lỗ hiện ra là lỗ.
  const breakdownRows = latest
    ? [
        { key: 'rowGross', value: latest.grossVnd, strong: false },
        { key: 'rowStoreFee', value: -latest.storeFeeVnd, strong: false },
        { key: 'rowAiCost', value: -latest.apiCostVnd, strong: false },
        { key: 'rowNet', value: latest.netVnd, strong: true },
      ]
    : []

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr accent title={t('title')} subtitle={t('subtitle')} />

      <div className="flex-1 px-4 py-6 sm:px-6 lg:px-10">
        {error && (
          <div className="mb-5">
            <ErrorBanner message={error} onRetry={() => fetchData(page)} />
          </div>
        )}

        {/* D08: trước đây lần tải ĐẦU thất bại vẫn rơi xuống nhánh dưới và dựng bộ KPI từ dữ liệu rỗng —
            "0 ₫" nằm ngay dưới banner lỗi, đọc như một con số thật. Không có dữ liệu thì chỉ còn banner. */}
        {loading && !data ? (
          <LoadingState label={t('loading')} />
        ) : !data ? null : (
          <div className="space-y-[22px]">
            <GaStatStrip items={cells} />

            <div className="grid grid-cols-1 gap-[22px] lg:grid-cols-[2fr_1fr]">
              <GaSection title={t('netByPeriod')}>
                {chart.length > 0 ? (
                  <GaBars
                    data={chart.map((r) => ({ label: r.period, value: r.netVnd }))}
                    color="#1E9E61"
                    height={180}
                    valueFmt={fmt.vndCompact}
                  />
                ) : (
                  <p className="ga-ui py-10 text-center text-[14px] text-ga-muted">{t('noPeriodData')}</p>
                )}
              </GaSection>

              <GaSection title={t('latestBreakdown')}>
                {breakdownRows.length > 0 ? (
                  <div>
                    <table className="w-full text-left">
                      <tbody>
                        {breakdownRows.map((row) => (
                          <tr
                            key={row.key}
                            className={row.strong ? 'border-t border-ga-border' : 'border-b border-ga-border last:border-0'}
                          >
                            <th
                              scope="row"
                              className={
                                row.strong
                                  ? 'ga-ui py-2.5 pr-3 text-ga-small font-semibold text-ga-ink'
                                  : 'ga-ui py-2.5 pr-3 text-ga-small font-medium text-ga-muted'
                              }
                            >
                              {t(row.key)}
                            </th>
                            <td
                              className={`py-2.5 text-right text-ga-small tabular-nums ${
                                row.strong ? 'font-semibold' : ''
                              } ${row.value < 0 ? 'text-ga-red' : 'text-ga-ink'}`}
                            >
                              {fmt.vndCompact(row.value)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="ga-ui mt-3 text-ga-caption leading-relaxed text-ga-muted">{t('breakdownNote')}</p>
                  </div>
                ) : (
                  <p className="ga-ui py-10 text-center text-[14px] text-ga-muted">{t('noPeriodData')}</p>
                )}
              </GaSection>
            </div>

            <GaSection
              title={t('recentTransactions')}
              right={
                tx ? (
                  <span className="ga-ui text-[12.5px] text-ga-muted">{t('txCount', { count: fmt.num(tx.totalElements) })}</span>
                ) : null
              }
              bodyClassName="p-0"
            >
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-left lg:min-w-0">
                  <thead>
                    <tr className="border-b border-ga-border">
                      {[
                        { key: 'colId', label: t('colId') },
                        { key: 'colEmail', label: t('colEmail') },
                        { key: 'colPlan', label: t('colPlan') },
                        { key: 'colAmount', label: t('colAmount') },
                        { key: 'colStatus', label: t('colStatus') },
                        { key: 'colTxId', label: t('colTxId') },
                        { key: 'colDate', label: t('colDate') },
                      ].map((h) => (
                        <th
                          key={h.key}
                          className="ga-ui px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-ga-muted"
                        >
                          {h.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {!tx || tx.content.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="ga-ui px-5 py-10 text-center text-[14px] text-ga-muted">
                          {t('noTransactions')}
                        </td>
                      </tr>
                    ) : (
                      tx.content.map((r) => (
                        <tr key={r.id} className="border-b border-ga-border last:border-0 hover:bg-ga-surface">
                          <td className="px-5 py-3 text-[12px] tabular-nums text-ga-subtle">{r.id}</td>
                          <td className="max-w-[200px] truncate px-5 py-3 text-[13.5px] font-medium text-ga-ink">
                            {r.email}
                          </td>
                          <td className="px-5 py-3">
                            <span className="ga-ui rounded-ga border border-ga-line px-2 py-0.5 text-[11px] font-semibold text-ga-muted">
                              {r.planCode || '—'}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-[13.5px] font-semibold text-ga-ink">{fmt.vndCompact(r.amount)}</td>
                          <td className="px-5 py-3">
                            <StatusDot status={r.status} t={t} />
                          </td>
                          <td className="max-w-[150px] truncate px-5 py-3 font-mono text-[11px] text-ga-subtle">
                            {r.providerTransactionId || '—'}
                          </td>
                          <td className="whitespace-nowrap px-5 py-3 text-[12.5px] text-ga-muted">
                            {fmt.dateTime(r.createdAt)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {tx && tx.totalPages > 1 && (
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ga-border px-5 py-3">
                  <p className="ga-ui text-[12.5px] text-ga-muted">
                    {t('pageInfo', { page: page + 1, total: tx.totalPages })}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={page === 0 || loading}
                      onClick={() => fetchData(page - 1)}
                      className="ga-ui flex min-h-[40px] items-center gap-1 rounded-ga border border-ga-line px-3 py-1.5 text-[12px] font-semibold text-ga-muted transition-colors hover:border-ga-accent hover:text-ga-accent disabled:opacity-40 lg:min-h-0"
                    >
                      <ChevronLeft size={14} aria-hidden /> {t('prev')}
                    </button>
                    <button
                      type="button"
                      disabled={page >= tx.totalPages - 1 || loading}
                      onClick={() => fetchData(page + 1)}
                      className="ga-ui flex min-h-[40px] items-center gap-1 rounded-ga border border-ga-line px-3 py-1.5 text-[12px] font-semibold text-ga-muted transition-colors hover:border-ga-accent hover:text-ga-accent disabled:opacity-40 lg:min-h-0"
                    >
                      {t('next')} <ChevronRight size={14} aria-hidden />
                    </button>
                  </div>
                </div>
              )}
            </GaSection>
          </div>
        )}
      </div>
    </div>
  )
}
