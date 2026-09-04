import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * GaStatStrip — dải KPI DUY NHẤT của /v2 (DS §8.2, backlog B-08).
 *
 * Trước đây hệ có BA bản cho cùng một thứ:
 *   · `TkStatStrip` (teacher/org) — thanh 3px, giá trị 32px, nhận CSS var.
 *   · `AdStatStrip` (admin) — thanh 5px, giá trị 36px, nhận HEX thô và tự ghép `${color}0e` làm nền.
 *   · một bản `AdStat` chép tay trong `admin/users/page.tsx`, lệch thêm ở nhãn (10px/0.08em).
 * Chênh lệch 3px↔5px và 32↔36 không mang nghĩa gì — chỉ là biến thể tuỳ tiện giữa hai màn.
 *
 * **API nhận tone token, không nhận màu.** Lý do rất cụ thể chứ không phải sạch sẽ suông: hợp
 * đồng cũ của AdStat bắt caller đưa HEX để chuỗi `${color}0e` giải được, nên khi `admin/users`
 * truyền `var(--ga-navy)` thì nền thành `"var(--ga-navy)0e"` — CSS vô nghĩa, im lặng không vẽ gì
 * và không ai biết trong nhiều tháng. Một API không thể diễn đạt sai thì không có lỗi đó.
 *
 * Đã bỏ: nền tint (chỉ AdStat có) và `delta`/`deltaUp` của TkStatItem — không call site nào dùng.
 */
export type GaStatTone =
  | 'accent'
  | 'navy'
  | 'blue'
  | 'violet'
  | 'teal'
  | 'green'
  | 'orange'
  | 'gold'
  | 'red'
  | 'neutral'

export interface GaStatItem {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  /** Tone ngữ nghĩa của ô. Mặc định `accent` — màu của role đang mở. */
  tone?: GaStatTone
  /** `sub` chuyển đỏ + chấm cảnh báo. Dành cho số cần người xử lý, không phải để nhấn mạnh. */
  alert?: boolean
}

/**
 * Tone → class TĨNH. Không được ghép chuỗi (`bg-ga-${tone}`): Tailwind quét mã nguồn theo văn bản
 * nên class ghép lúc chạy sẽ không có trong bundle và ô mất màu.
 */
const TONE_BAR: Record<GaStatTone, string> = {
  accent: 'bg-ga-accent',
  navy: 'bg-ga-navy',
  blue: 'bg-ga-blue',
  violet: 'bg-ga-violet',
  teal: 'bg-ga-teal',
  green: 'bg-ga-green',
  orange: 'bg-ga-orange',
  gold: 'bg-ga-gold',
  red: 'bg-ga-red',
  neutral: 'bg-ga-muted',
}

const TONE_TEXT: Record<GaStatTone, string> = {
  accent: 'text-ga-accent',
  navy: 'text-ga-navy',
  blue: 'text-ga-blue',
  violet: 'text-ga-violet',
  teal: 'text-ga-teal',
  green: 'text-ga-green',
  orange: 'text-ga-orange',
  gold: 'text-ga-gold',
  red: 'text-ga-red',
  neutral: 'text-ga-muted',
}

/**
 * Lưới KPI responsive: mobile 1 cột → sm 2 cột → lg đúng N cột như thiết kế gốc.
 * N là động (`items.length`) nên KHÔNG thể ghép chuỗi class Tailwind (JIT sẽ không sinh ra
 * class); giá trị đi qua biến CSS `--ga-stat-cols` và được đọc lại bằng arbitrary property
 * ở biến thể `lg:` — từ 1024px kết quả y hệt `repeat(N, minmax(0,1fr))`.
 */
const STAT_COLS =
  '[grid-template-columns:repeat(1,minmax(0,1fr))] sm:[grid-template-columns:repeat(2,minmax(0,1fr))] lg:[grid-template-columns:repeat(var(--ga-stat-cols),minmax(0,1fr))]'

export function GaStatStrip({ items, className }: { items: GaStatItem[]; className?: string }) {
  return (
    <div
      // Vách ngăn ngang: khi ô xếp chồng (mobile/sm) đường kẻ `border-l` giữa các ô biến mất,
      // nên mỗi ô tự vẽ `border-t` và khung ngoài tắt `border-t`. Ở lg đảo lại.
      className={cn(
        'grid border border-ga-line border-l-0 border-t-0 lg:border-t',
        STAT_COLS,
        className,
      )}
      style={{ '--ga-stat-cols': Math.max(1, items.length) } as React.CSSProperties}
    >
      {items.map((it, i) => {
        const tone = it.tone ?? 'accent'
        return (
          <div
            key={i}
            className="relative min-w-0 border-l border-t border-ga-line bg-ga-card px-4 py-[22px] lg:border-t-0 lg:px-6"
          >
            <div className={cn('absolute inset-x-0 top-0 h-[3px]', TONE_BAR[tone])} />
            <p className="ga-ui mb-2.5 uppercase text-ga-stat-label text-ga-muted">{it.label}</p>
            <p
              className={cn(
                'min-w-0 break-words font-ga-display text-ga-stat-m lg:text-ga-stat',
                TONE_TEXT[tone],
              )}
            >
              {it.value}
            </p>
            {it.sub && (
              <p
                className={cn(
                  'ga-ui mt-2 flex items-center gap-1.5 text-ga-caption',
                  it.alert ? 'text-ga-red' : 'text-ga-muted',
                )}
              >
                {it.alert && (
                  <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-ga-red" />
                )}
                {it.sub}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}
