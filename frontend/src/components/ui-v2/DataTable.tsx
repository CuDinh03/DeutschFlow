'use client'

import * as React from 'react'
import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ChevronRight, ChevronsUpDown } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { GaBtn } from './GaBtn'
import { useFmt } from '@/lib/i18n/useFmt'

/**
 * DataTable — stateful list pattern-setter (70-admin-users hi-fi).
 * One card frame holds ALL states: loading (shimmer) · empty · error · data.
 * Client mode (default): sort + pagination over the `data` it receives.
 * Server mode (`server` prop, 09/11/2026): `data` IS the current page; sort/page changes are
 * reported through callbacks and the caller refetches — for lists too big to load whole
 * (admin users). The table never slices or sorts server data itself.
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
  /**
   * Row-action contract (Gate 0 remediation #2): accessible name CÓ NGỮ CẢNH ROW cho nút
   * mở chi tiết trong action column (vd `(u) => \`Mở hồ sơ ${u.name}\``). Khi `onRowClick`
   * được dùng mà thiếu prop này, nút rơi về nhãn chung `v2.ui.openRow` — màn nên truyền
   * label riêng khi được redesign (Wave 1+).
   */
  rowActionLabel?: (row: T) => string
  /** Per-row extra className (e.g. "opacity-60" for paused rows). */
  rowClassName?: (row: T) => string | undefined
  /** Page size; 0 disables pagination. Default 8. */
  pageSize?: number
  /** Noun for the footer count, e.g. "người dùng". */
  itemNoun?: string
  className?: string
  /**
   * Server mode: `data` is one page already sorted by the server. Footer + pager come from
   * `total`/`page`/`pageSize`; header clicks call `onSortChange(key, dir)` with the column `key`.
   */
  server?: DataTableServerState
  /**
   * Server mode while fetching the next page: keep showing the previous rows (dimmed, aria-busy)
   * instead of collapsing to shimmer — the pager does not jump under the cursor.
   */
  keepPreviousRows?: boolean
}

export interface DataTableServerState {
  total: number
  /** 1-based. */
  page: number
  pageSize: number
  sortKey?: string | null
  sortDir?: 'asc' | 'desc'
  onPageChange: (page: number) => void
  onSortChange?: (key: string, dir: 'asc' | 'desc') => void
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
  rowActionLabel,
  rowClassName,
  pageSize = 8,
  itemNoun,
  className,
  server,
  keepPreviousRows = false,
}: DataTableProps<T>) {
  // i18n contract (W0-C8): default copy từ v2.ui, prop override (itemNoun).
  const t = useTranslations('v2.ui')
  const fmt = useFmt()
  const noun = itemNoun ?? t('item')
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)

  const isServer = server != null
  const activeSortKey = isServer ? (server.sortKey ?? null) : sortKey
  const activeSortDir = isServer ? (server.sortDir ?? 'asc') : sortDir

  const sorted = useMemo(() => {
    if (isServer || !sortKey) return data
    const col = columns.find((c) => c.key === sortKey)
    if (!col?.sortable) return data
    const val = col.sortValue ?? ((r: T) => (r as Record<string, unknown>)[col.key] as string | number)
    return [...data].sort((a, b) => {
      const av = val(a)
      const bv = val(b)
      const cmp = av < bv ? -1 : av > bv ? 1 : 0
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [data, sortKey, columns, sortDir, isServer])

  const size = isServer ? Math.max(1, server.pageSize) : pageSize
  const paginate = isServer || size > 0
  const totalCount = isServer ? Math.max(server.total, data.length) : sorted.length
  const totalPages = paginate ? Math.max(1, Math.ceil(totalCount / size)) : 1
  const current = Math.min(isServer ? Math.max(1, server.page) : page, totalPages)
  const rows = isServer ? data : paginate ? sorted.slice((current - 1) * size, current * size) : sorted
  const from = totalCount === 0 || rows.length === 0 ? 0 : (current - 1) * size + 1
  const to = isServer ? (rows.length === 0 ? 0 : from + rows.length - 1) : paginate ? Math.min(current * size, totalCount) : totalCount

  const goTo = (p: number) => (isServer ? server.onPageChange(p) : setPage(p))

  const toggleSort = (key: string) => {
    if (isServer) {
      const dir = activeSortKey === key && activeSortDir === 'asc' ? 'desc' : 'asc'
      server.onSortChange?.(key, dir)
      return
    }
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
      <div role="alert" className={cn(card, className)}>
        <div className="px-4 py-10 text-center sm:px-6 lg:px-10 lg:py-[52px]">
          <h2 className="font-ga-display text-[20px] font-medium leading-[1.2] text-ga-red lg:text-[26px]">
            {t('tableErrorTitle')}
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
          {onRetry && <GaBtn variant="primary" onClick={onRetry}>{t('retry')}</GaBtn>}
        </div>
      </div>
    )
  }
  if (!loading && rows.length === 0) {
    return <div className={cn(card, className)}>{empty}</div>
  }

  const thead = (
    <thead>
      <tr>
        {columns.map((col) => {
          const isSorted = activeSortKey === col.key
          const sortIndicator =
            col.sortable &&
            (isSorted ? (
              activeSortDir === 'asc' ? (
                <ArrowUp size={12} className="text-ga-ink" />
              ) : (
                <ArrowDown size={12} className="text-ga-ink" />
              )
            ) : (
              <ChevronsUpDown size={12} className="text-ga-subtle opacity-50" />
            ))
          return (
            <th
              key={col.key}
              aria-sort={
                col.sortable
                  ? isSorted
                    ? activeSortDir === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : 'none'
                  : undefined
              }
              className={cn(
                'ga-ui select-none border-b border-ga-line bg-ga-surface text-[11px] font-semibold uppercase tracking-[0.06em] text-ga-muted',
                // Cột sortable: <th> không còn padding — <button> bên trong chiếm trọn ô để
                // vùng bấm/focus là phần tử tương tác THẬT (W0-C3: audit nested interactive).
                col.sortable ? 'p-0' : 'px-5 py-3.5',
                alignClass[col.align ?? 'left'],
                col.className,
              )}
            >
              {col.sortable ? (
                <button
                  type="button"
                  onClick={() => toggleSort(col.key)}
                  className={cn(
                    'ga-ui inline-flex w-full cursor-pointer items-center gap-1 px-5 py-3.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-ga-muted transition-colors hover:text-ga-ink',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus focus-visible:ring-inset',
                    col.align === 'right' && 'flex-row-reverse',
                    col.align === 'center' && 'justify-center',
                  )}
                >
                  {col.header}
                  {sortIndicator}
                </button>
              ) : (
                <span className={cn('inline-flex items-center gap-1', col.align === 'right' && 'flex-row-reverse')}>
                  {col.header}
                </span>
              )}
            </th>
          )
        })}
        {onRowClick && (
          // Action column (remediation #2): screen reader biết bảng có cột hành động.
          <th className="ga-ui w-11 border-b border-ga-line bg-ga-surface px-2 py-3.5">
            <span className="sr-only">{t('actions')}</span>
          </th>
        )}
      </tr>
    </thead>
  )
  const colCount = columns.length + (onRowClick ? 1 : 0)

  // Server mode, next page loading: keep the previous rows on screen (dimmed) — see `keepPreviousRows`.
  const refreshing = loading && keepPreviousRows && data.length > 0

  // ── loading: thead + shimmer rows ───────────────────────────────────────
  if (loading && !refreshing) {
    return (
      // role="status" + aria-busy (F-08): screen reader biết bảng đang tải thay vì im lặng.
      <div role="status" aria-busy="true" aria-live="polite" className={cn(card, className)}>
        <span className="sr-only">{t('loading')}</span>
        <div className={scroller}>
          <table className={cn('w-full border-collapse', tableMin)}>
            {thead}
            <tbody>
              {Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b border-ga-line last:border-0">
                  <td
                    colSpan={colCount}
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
    <div
      className={cn(card, className)}
      aria-busy={refreshing || undefined}
      data-refreshing={refreshing || undefined}
    >
      <div className={cn(scroller, refreshing && 'pointer-events-none opacity-60 transition-opacity')}>
        <table className={cn('ga-ui w-full border-collapse text-[14.5px]', tableMin)}>
          {thead}
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={rowKey(row, i)}
                // Row-action contract (Gate 0 remediation #2): pointer click TOÀN ROW chỉ là
                // enhancement; đường bàn phím/screen-reader đi qua NÚT THẬT trong action column
                // (có accessible name mang ngữ cảnh row). <tr> giữ nguyên table semantics —
                // không role=button, không tabIndex.
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
                {onRowClick && (
                  <td className="w-11 px-2 py-2 align-middle">
                    <button
                      type="button"
                      aria-label={rowActionLabel?.(row) ?? t('openRow')}
                      onClick={(e) => {
                        e.stopPropagation() // tránh gọi đôi qua onClick của <tr>
                        onRowClick(row)
                      }}
                      className="grid h-11 w-11 place-items-center rounded-ga text-ga-subtle transition-colors hover:bg-ga-surface hover:text-ga-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ga-focus lg:h-8 lg:w-8"
                    >
                      <ChevronRight size={16} aria-hidden />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {paginate && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ga-line px-4 py-3 lg:flex-nowrap lg:gap-0 lg:px-5 lg:py-3.5">
          <span className="ga-ui text-[13px] text-ga-muted">
            {t('tableFooter', { from, to, total: fmt.num(totalCount), noun })}
          </span>
          <div className="flex flex-wrap gap-1.5 lg:flex-nowrap">
            <PagerBtn ariaLabel={t('prevPage')} disabled={current === 1} onClick={() => goTo(current - 1)}>‹</PagerBtn>
            {pageList(current, totalPages).map((p, i) =>
              p === '…' ? (
                <span
                  key={`e${i}`}
                  className="grid h-11 w-11 place-items-center text-[12px] text-ga-subtle lg:h-8 lg:w-8"
                >
                  …
                </span>
              ) : (
                <PagerBtn key={p} ariaLabel={t('page', { page: p })} active={p === current} onClick={() => goTo(p)}>
                  {p}
                </PagerBtn>
              ),
            )}
            <PagerBtn ariaLabel={t('nextPage')} disabled={current === totalPages} onClick={() => goTo(current + 1)}>›</PagerBtn>
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
  ariaLabel,
}: {
  children: React.ReactNode
  active?: boolean
  disabled?: boolean
  onClick?: () => void
  ariaLabel?: string
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={ariaLabel}
      aria-current={active ? 'page' : undefined}
      className={cn(
        // 44px chạm tay trên mobile (F-06/D8); từ lg trở lại đúng 32px như thiết kế gốc.
        'ga-ui grid h-11 w-11 place-items-center rounded-ga border text-[12px] font-semibold transition-colors disabled:opacity-40 lg:h-8 lg:w-8',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus focus-visible:ring-inset',
        active
          ? 'border-ga-accent bg-ga-accent text-ga-accent-ink'
          : 'border-ga-line bg-ga-card text-ga-ink hover:bg-ga-surface',
      )}
    >
      {children}
    </button>
  )
}
