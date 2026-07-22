'use client'

import * as React from 'react'
import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { GaBtn } from './GaBtn'

/**
 * DataTable — stateful list pattern-setter (70-admin-users hi-fi).
 * One card frame holds ALL states: loading (shimmer) · empty · error · data.
 * Internal client-side sort + pagination over the `data` it receives.
 */
export interface DataTableColumn<T> {
  key: string
  header: React.ReactNode
  render?: (row: T) => React.ReactNode
  align?: 'left' | 'right' | 'center'
  sortable?: boolean
  /** Value used for sorting when `sortable` (defaults to row[key]). */
  sortValue?: (row: T) => string | number
  className?: string
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[]
  data: T[]
  rowKey: (row: T, index: number) => string | number
  loading?: boolean
  error?: string | null
  onRetry?: () => void
  /** Endpoint shown in the error card, e.g. "GET /api/admin/users". */
  errorEndpoint?: string
  /** Custom empty content (rendered inside the card). */
  empty?: React.ReactNode
  onRowClick?: (row: T) => void
  /** Per-row extra className (e.g. "opacity-60" for paused rows). */
  rowClassName?: (row: T) => string | undefined
  /** Page size; 0 disables pagination. Default 8. */
  pageSize?: number
  /** Noun for the footer count, e.g. "người dùng". */
  itemNoun?: string
  className?: string
}

const alignClass = { left: 'text-left', right: 'text-right', center: 'text-center' } as const

function pageList(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const out = new Set<number>([1, total, current, current - 1, current + 1])
  const sorted = Array.from(out)
    .filter((p) => p >= 1 && p <= total)
    .sort((a, b) => a - b)
  const res: (number | '…')[] = []
  let prev = 0
  for (const p of sorted) {
    if (p - prev > 1) res.push('…')
    res.push(p)
    prev = p
  }
  return res
}

export function DataTable<T>({
  columns,
  data,
  rowKey,
  loading = false,
  error = null,
  onRetry,
  errorEndpoint,
  empty,
  onRowClick,
  rowClassName,
  pageSize = 8,
  itemNoun = 'mục',
  className,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)

  const sorted = useMemo(() => {
    if (!sortKey) return data
    const col = columns.find((c) => c.key === sortKey)
    if (!col?.sortable) return data
    const val = col.sortValue ?? ((r: T) => (r as Record<string, unknown>)[col.key] as string | number)
    return [...data].sort((a, b) => {
      const av = val(a)
      const bv = val(b)
      const cmp = av < bv ? -1 : av > bv ? 1 : 0
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [data, sortKey, columns, sortDir])

  const paginate = pageSize > 0
  const totalPages = paginate ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1
  const current = Math.min(page, totalPages)
  const rows = paginate ? sorted.slice((current - 1) * pageSize, current * pageSize) : sorted
  const from = sorted.length === 0 ? 0 : (current - 1) * pageSize + 1
  const to = paginate ? Math.min(current * pageSize, sorted.length) : sorted.length

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir('asc')
    }
    setPage(1)
  }

  const card = 'overflow-hidden rounded-ga border border-ga-line bg-ga-card'
  // Thẻ bọc ngoài có `overflow-hidden` nên trên mobile bảng bị CẮT MẤT cột thay vì cuộn được.
  // Vùng cuộn ngang riêng + min-w cho table giữ cột khỏi bị bóp nát; từ lg tắt cả hai để
  // hành vi desktop (table `w-full` co theo thẻ) không đổi một pixel.
  const scroller = 'overflow-x-auto lg:overflow-x-visible'
  // Bề rộng tối thiểu theo số cột: bảng nhiều cột cần chỗ để không bị bóp nát, bảng 1–2 cột
  // vẫn vừa khổ hẹp nên không ép cuộn vô cớ. Các chuỗi là literal tĩnh để JIT sinh được class.
  const tableMin =
    columns.length >= 5
      ? 'min-w-[720px] lg:min-w-0'
      : columns.length >= 3
        ? 'min-w-[560px] lg:min-w-0'
        : ''

  // ── error / empty take over the whole card ──────────────────────────────
  if (!loading && error) {
    return (
      <div className={cn(card, className)}>
        <div className="px-4 py-10 text-center sm:px-6 lg:px-10 lg:py-[52px]">
          <h2 className="font-ga-display text-[20px] font-medium leading-[1.2] text-ga-red lg:text-[26px]">
            Không tải được danh sách
          </h2>
          <p className="ga-ui mx-auto mb-5 mt-3 max-w-sm text-[14.5px] text-ga-muted">
            {error}
            {errorEndpoint && (
              <>
                {' '}
                <code className="font-mono text-[12px] text-ga-accent">{errorEndpoint}</code>
              </>
            )}
          </p>
          {onRetry && <GaBtn variant="primary" onClick={onRetry}>Thử lại</GaBtn>}
        </div>
      </div>
    )
  }
  if (!loading && sorted.length === 0) {
    return <div className={cn(card, className)}>{empty}</div>
  }

  const thead = (
    <thead>
      <tr>
        {columns.map((col) => {
          const isSorted = sortKey === col.key
          return (
            <th
              key={col.key}
              onClick={col.sortable ? () => toggleSort(col.key) : undefined}
              aria-sort={
                col.sortable
                  ? isSorted
                    ? sortDir === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : 'none'
                  : undefined
              }
              className={cn(
                'ga-ui select-none border-b border-ga-line bg-ga-surface px-5 py-3.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-ga-muted',
                alignClass[col.align ?? 'left'],
                col.sortable && 'cursor-pointer',
                col.className,
              )}
            >
              <span className={cn('inline-flex items-center gap-1', col.align === 'right' && 'flex-row-reverse')}>
                {col.header}
                {col.sortable &&
                  (isSorted ? (
                    sortDir === 'asc' ? (
                      <ArrowUp size={12} className="text-ga-ink" />
                    ) : (
                      <ArrowDown size={12} className="text-ga-ink" />
                    )
                  ) : (
                    <ChevronsUpDown size={12} className="text-ga-subtle opacity-50" />
                  ))}
              </span>
            </th>
          )
        })}
      </tr>
    </thead>
  )

  // ── loading: thead + shimmer rows ───────────────────────────────────────
  if (loading) {
    return (
      <div className={cn(card, className)}>
        <div className={scroller}>
          <table className={cn('w-full border-collapse', tableMin)}>
            {thead}
            <tbody>
              {Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b border-ga-line last:border-0">
                  <td
                    colSpan={columns.length}
                    className="ga-shimmer h-[62px] p-0"
                    aria-hidden
                  />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // ── data ────────────────────────────────────────────────────────────────
  return (
    <div className={cn(card, className)}>
      <div className={scroller}>
        <table className={cn('ga-ui w-full border-collapse text-[14.5px]', tableMin)}>
          {thead}
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={rowKey(row, i)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  'border-b border-ga-line text-ga-ink last:border-0',
                  onRowClick && 'cursor-pointer transition-colors hover:bg-ga-surface',
                  rowClassName?.(row),
                )}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn('px-5 py-3.5 align-middle', alignClass[col.align ?? 'left'], col.className)}
                  >
                    {col.render ? col.render(row) : (row as Record<string, React.ReactNode>)[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {paginate && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ga-line px-4 py-3 lg:flex-nowrap lg:gap-0 lg:px-5 lg:py-3.5">
          <span className="ga-ui text-[13px] text-ga-muted">
            Hiển thị {from}–{to} trong {sorted.length.toLocaleString('vi-VN')} {itemNoun}
          </span>
          <div className="flex flex-wrap gap-1.5 lg:flex-nowrap">
            <PagerBtn disabled={current === 1} onClick={() => setPage(current - 1)}>‹</PagerBtn>
            {pageList(current, totalPages).map((p, i) =>
              p === '…' ? (
                <span
                  key={`e${i}`}
                  className="grid h-10 w-10 place-items-center text-[12px] text-ga-subtle lg:h-8 lg:w-8"
                >
                  …
                </span>
              ) : (
                <PagerBtn key={p} active={p === current} onClick={() => setPage(p)}>
                  {p}
                </PagerBtn>
              ),
            )}
            <PagerBtn disabled={current === totalPages} onClick={() => setPage(current + 1)}>›</PagerBtn>
          </div>
        </div>
      )}
    </div>
  )
}

function PagerBtn({
  children,
  active,
  disabled,
  onClick,
}: {
  children: React.ReactNode
  active?: boolean
  disabled?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        // 40px chạm tay trên mobile; từ lg trở lại đúng 32px như thiết kế gốc.
        'ga-ui grid h-10 w-10 place-items-center rounded-ga border text-[12px] font-semibold transition-colors disabled:opacity-40 lg:h-8 lg:w-8',
        active
          ? 'border-ga-accent bg-ga-accent text-ga-accent-ink'
          : 'border-ga-line bg-ga-card text-ga-ink hover:bg-ga-surface',
      )}
    >
      {children}
    </button>
  )
}
