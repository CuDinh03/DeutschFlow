import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * AdStat strip — the admin KPI band (pattern-setter: 70-admin-users / 77-admin-orgs).
 * 4-up grid, each cell = 5px accent top-bar + faint `{color}0e` tint + GaCap label +
 * Newsreader-36 value + optional sub (red-dot alert). Pass HEX colors so the tint resolves.
 */
export interface AdStatCell {
  label: string
  value: React.ReactNode
  /** HEX accent (e.g. '#1E9E61') — drives top-bar, value colour and the 0e tint. */
  color: string
  sub?: React.ReactNode
  alert?: boolean
}

function AdStatItem({ label, value, color, sub, alert }: AdStatCell) {
  return (
    <div
      className="relative border-l border-t border-ga-border px-4 py-[22px] lg:border-t-0 lg:px-6"
      style={{ background: `${color}0e` }}
    >
      <div className="absolute inset-x-0 top-0 h-[5px]" style={{ background: color }} />
      <p className="ga-ui mb-[10px] text-[11px] font-semibold uppercase tracking-[0.16em] text-ga-muted">
        {label}
      </p>
      <p
        className="min-w-0 break-words font-ga-display text-[24px] font-medium leading-none sm:text-[28px] lg:text-[36px]"
        style={{ color }}
      >
        {value}
      </p>
      {sub && (
        <p
          className={cn(
            'ga-ui mt-2 flex items-center gap-1.5 text-[13px]',
            alert ? 'text-ga-red' : 'text-ga-muted',
          )}
        >
          {alert && <span className="inline-block h-1.5 w-1.5 rounded-full bg-ga-red" />}
          {sub}
        </p>
      )}
    </div>
  )
}

/**
 * Lưới KPI responsive: mobile 1 cột → sm 2 cột → lg đúng N cột như thiết kế gốc.
 * N là động (`cells.length`) nên KHÔNG thể ghép chuỗi class Tailwind (JIT sẽ không sinh ra
 * class); giá trị đi qua biến CSS `--ga-adstat-cols` và được đọc lại bằng arbitrary property
 * ở biến thể `lg:` — từ 1024px kết quả y hệt `repeat(N, minmax(0,1fr))` trước đây.
 */
const ADSTAT_COLS =
  '[grid-template-columns:repeat(1,minmax(0,1fr))] sm:[grid-template-columns:repeat(2,minmax(0,1fr))] lg:[grid-template-columns:repeat(var(--ga-adstat-cols),minmax(0,1fr))]'

export function AdStatStrip({ cells, className }: { cells: AdStatCell[]; className?: string }) {
  return (
    <div
      // Vách ngăn ngang: khi ô xếp chồng (mobile/sm) đường kẻ `border-l` giữa các ô biến mất,
      // nên mỗi ô tự vẽ `border-t` và khung ngoài tắt `border-t`. Ở lg đảo lại đúng như cũ.
      className={cn('grid border border-ga-border border-l-0 border-t-0 lg:border-t', ADSTAT_COLS, className)}
      style={{ '--ga-adstat-cols': Math.max(1, cells.length) } as React.CSSProperties}
    >
      {cells.map((c, i) => (
        <AdStatItem key={i} {...c} />
      ))}
    </div>
  )
}
