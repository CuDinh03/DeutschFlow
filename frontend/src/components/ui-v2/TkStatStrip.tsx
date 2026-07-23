import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * TkStatStrip — teacher/org KPI band (proto TkStatStrip): 3px accent top-bar,
 * Newsreader-32 value (vs admin AdStat 5px / 36), optional delta + alert sub.
 * Value colour defaults to the item colour or the role accent.
 */
export interface TkStatItem {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  /** Accent colour (top-bar + value). Defaults to the role `--ga-accent`. */
  color?: string
  alert?: boolean
  /** e.g. "▲4.1" — rendered green (up) / red (down) beside the value. */
  delta?: string
  deltaUp?: boolean
}

/**
 * Lưới KPI responsive: mobile 1 cột → sm 2 cột → lg đúng N cột như thiết kế gốc.
 * N là động (`items.length`) nên KHÔNG thể ghép chuỗi class Tailwind (JIT sẽ không sinh ra
 * class); giá trị đi qua biến CSS `--ga-strip-cols` và được đọc lại bằng arbitrary property
 * ở biến thể `lg:` — từ 1024px kết quả y hệt `repeat(N, minmax(0,1fr))` trước đây.
 */
const STRIP_COLS =
  '[grid-template-columns:repeat(1,minmax(0,1fr))] sm:[grid-template-columns:repeat(2,minmax(0,1fr))] lg:[grid-template-columns:repeat(var(--ga-strip-cols),minmax(0,1fr))]'

export function TkStatStrip({ items, className }: { items: TkStatItem[]; className?: string }) {
  return (
    <div
      // Vách ngăn ngang: khi ô xếp chồng (mobile/sm) đường kẻ `border-l` giữa các ô biến mất,
      // nên mỗi ô tự vẽ `border-t` và khung ngoài tắt `border-t`. Ở lg đảo lại đúng như cũ.
      className={cn('grid border border-ga-line border-l-0 border-t-0 lg:border-t', STRIP_COLS, className)}
      style={{ '--ga-strip-cols': Math.max(1, items.length) } as React.CSSProperties}
    >
      {items.map((it, i) => {
        const color = it.color ?? 'var(--ga-accent)'
        return (
          <div
            key={i}
            className="relative border-l border-t border-ga-line bg-ga-card px-4 py-[22px] lg:border-t-0 lg:px-6"
          >
            <div className="absolute inset-x-0 top-0 h-[3px]" style={{ background: color }} />
            <p className="ga-ui mb-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-ga-muted">
              {it.label}
            </p>
            <div className="flex flex-wrap items-baseline gap-2 lg:flex-nowrap">
              <span
                className="min-w-0 break-words font-ga-display text-[22px] font-medium leading-none sm:text-[26px] lg:text-[32px]"
                style={{ color }}
              >
                {it.value}
              </span>
              {it.delta && (
                <span
                  className="text-[12.5px] font-semibold"
                  style={{ color: it.deltaUp ? 'var(--ga-green)' : 'var(--ga-red)' }}
                >
                  {it.delta}
                </span>
              )}
            </div>
            {it.sub && (
              <p
                className={cn(
                  'ga-ui mt-2 flex items-center gap-1.5 text-[12.5px]',
                  it.alert ? 'text-ga-red' : 'text-ga-muted',
                )}
              >
                {it.alert && <span className="inline-block h-1.5 w-1.5 rounded-full bg-ga-red" />}
                {it.sub}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}
