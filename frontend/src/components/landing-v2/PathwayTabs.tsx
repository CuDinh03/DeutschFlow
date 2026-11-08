'use client'

import * as React from 'react'

export type Pathway = { name: string; de: string; who: string; level: string; exam: string; interview: string; fit: string }

/**
 * Hành trình sang Đức thành tab (đợt B, kế hoạch cải thiện trang chủ 08/11/2026): năm cột chữ dày,
 * cao lệch nhau → mỗi lần một con đường, mặc định mở con đường đầu (Học nghề). Đúng mẫu tab ARIA:
 * mũi tên trái/phải, Home/End chuyển tab và chuyển tiêu điểm; chỉ tab đang chọn nằm trong thứ tự Tab.
 * Mọi bảng đều có trong HTML (bảng không chọn `hidden`) để máy tìm kiếm đọc đủ năm con đường.
 */
export function PathwayTabs({
  items,
  colors,
  labels,
  ariaLabel,
}: {
  items: Pathway[]
  colors: string[]
  labels: { level: string; exam: string; interview: string }
  ariaLabel: string
}) {
  const [active, setActive] = React.useState(0)
  const tabs = React.useRef<(HTMLButtonElement | null)[]>([])
  const baseId = React.useId()

  const select = (i: number) => {
    const next = (i + items.length) % items.length
    setActive(next)
    tabs.current[next]?.focus()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    const map: Record<string, number> = { ArrowRight: active + 1, ArrowLeft: active - 1, Home: 0, End: items.length - 1 }
    if (!(e.key in map)) return
    e.preventDefault()
    select(map[e.key])
  }

  return (
    <div>
      <div role="tablist" aria-label={ariaLabel} onKeyDown={onKeyDown} className="flex gap-2 overflow-x-auto pb-1">
        {items.map((p, i) => (
          <button
            key={p.name}
            ref={(el) => { tabs.current[i] = el }}
            type="button"
            role="tab"
            id={`${baseId}-tab-${i}`}
            aria-selected={i === active}
            aria-controls={`${baseId}-panel-${i}`}
            tabIndex={i === active ? 0 : -1}
            onClick={() => setActive(i)}
            className={`inline-flex min-h-11 shrink-0 items-center gap-2 border px-4 text-ga-small font-semibold transition-colors ${
              i === active ? 'border-ga-ink bg-ga-ink text-ga-bg' : 'border-ga-border bg-ga-bg text-ga-ink hover:border-ga-ink'
            }`}
          >
            <span aria-hidden className="inline-block h-[8px] w-[8px]" style={{ background: colors[i] }} />
            {p.name}
          </button>
        ))}
      </div>
      {items.map((p, i) => (
        <div
          key={p.name}
          role="tabpanel"
          id={`${baseId}-panel-${i}`}
          aria-labelledby={`${baseId}-tab-${i}`}
          hidden={i !== active}
          className="mt-4 border border-ga-border bg-ga-bg p-5 sm:p-8"
        >
          <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] md:gap-12">
            <div>
              <div className="text-ga-h2 text-ga-ink">{p.name}</div>
              {/* Bản tiếng Đức: tên lộ trình đã là thuật ngữ Đức — không lặp lại dòng phụ. */}
              {p.de !== p.name && <div lang="de" className="font-ga-display text-ga-body italic text-ga-muted">{p.de}</div>}
              <p className="mt-4 text-ga-body text-ga-muted">{p.who}</p>
              <p className="mt-5 border-l-2 border-ga-yellow pl-3 text-ga-body text-ga-ink">{p.fit}</p>
            </div>
            <dl className="grid content-start gap-4 sm:grid-cols-3 md:grid-cols-1 lg:grid-cols-3">
              {([[labels.level, p.level], [labels.exam, p.exam], [labels.interview, p.interview]] as const).map(([k, v]) => (
                <div key={k} className="border-t border-ga-border pt-3">
                  <dt className="text-ga-caption text-ga-muted">{k}</dt>
                  <dd className="mt-1 text-ga-small text-ga-ink">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      ))}
    </div>
  )
}
