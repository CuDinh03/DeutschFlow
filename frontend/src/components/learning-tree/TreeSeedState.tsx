import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

/**
 * The A0 "mầm" (seedling) state — shown when the learner has no tree content yet (level A0 carries no
 * lessons; the tree sprouts at A1). Instead of an empty canvas, we draw a sprout breaking soil plus an
 * invitation to start, so a brand-new learner sees the promise of the tree ("complete your first
 * lesson and it grows from here"). Presentational only — the page decides when to render it.
 */
export function TreeSeedState({ displayName }: { displayName?: string }) {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-6 overflow-hidden border border-ga-line bg-ga-card px-6 py-10 text-center">
      {/* soft ground glow behind the sprout */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2"
        style={{ background: 'radial-gradient(60% 90% at 50% 100%, var(--ga-yellow-soft), transparent 70%)' }}
      />
      <Sprout />
      <div className="relative max-w-sm space-y-2">
        <h2 className="font-ga-display text-[22px] font-medium text-ga-ink">
          {displayName ? `${displayName}, hạt giống đã sẵn sàng` : 'Hạt giống đã sẵn sàng'}
        </h2>
        <p className="ga-ui text-[14px] leading-relaxed text-ga-muted">
          Hoàn thành bài học đầu tiên và cây tiếng Đức của bạn sẽ <span className="font-semibold text-ga-ink">nảy mầm</span> từ
          đây — mỗi bài học là một chiếc lá mới.
        </p>
      </div>
      <Link
        href="/v2/student/dashboard"
        className="ga-ui relative inline-flex items-center gap-1.5 rounded-ga-pill bg-ga-ink px-5 py-2.5 text-[13.5px] font-semibold text-ga-bg transition-transform hover:-translate-y-0.5"
      >
        Bắt đầu học <ArrowRight size={15} aria-hidden />
      </Link>
    </div>
  )
}

/** A small sprout: soil mound, stem, and two cotyledon leaves that sway gently. */
function Sprout() {
  return (
    <svg
      width={132}
      height={132}
      viewBox="-66 -66 132 132"
      className="relative"
      role="img"
      aria-label="Mầm cây vừa nhú lên"
    >
      <defs>
        <linearGradient id="lt-seed-leaf" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#A9C48C" />
          <stop offset="100%" stopColor="#C3D6AC" />
        </linearGradient>
      </defs>
      {/* soil mound */}
      <ellipse cx="0" cy="46" rx="46" ry="11" fill="#E3D8C4" />
      <ellipse cx="0" cy="44" rx="34" ry="7.5" fill="#D6C7AC" />
      {/* stem + cotyledons (sway as one group) */}
      <g className="lt-sprout-sway">
        <path d="M0 46 L0 -2" stroke="#8AA86B" strokeWidth="3.4" strokeLinecap="round" fill="none" />
        {/* left leaf */}
        <path d="M0 6 C-26 2 -38 -14 -30 -30 C-12 -26 0 -12 0 6 Z" fill="url(#lt-seed-leaf)" />
        <path d="M0 6 C-14 -4 -22 -16 -28 -26" stroke="#8AA86B" strokeWidth="1.4" fill="none" opacity="0.5" />
        {/* right leaf */}
        <path d="M0 2 C26 -2 40 -20 32 -38 C12 -34 0 -18 0 2 Z" fill="url(#lt-seed-leaf)" />
        <path d="M0 2 C14 -8 24 -22 30 -34" stroke="#8AA86B" strokeWidth="1.4" fill="none" opacity="0.5" />
        {/* tiny bud at the tip */}
        <circle cx="0" cy="-4" r="3.4" fill="#E8C84E" />
      </g>
    </svg>
  )
}
