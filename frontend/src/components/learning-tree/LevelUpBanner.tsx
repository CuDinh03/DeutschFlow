import { Sparkles, Loader2 } from 'lucide-react'

/**
 * The "ready to level up" call-to-action — shown above the tree when the current level's milestone is
 * {@code ready} (all four skills matured). Tapping it triggers the level-up ritual on the page.
 */
export function LevelUpBanner({
  readyLevel,
  nextLevel,
  busy,
  onLevelUp,
}: {
  readyLevel: string
  nextLevel: string | null
  busy: boolean
  onLevelUp: () => void
}) {
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 rounded-ga border px-4 py-3"
      style={{
        background: 'var(--ga-yellow-soft)',
        borderColor: 'var(--ga-yellow)',
      }}
    >
      <div className="flex items-center gap-2.5">
        <span
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full"
          style={{ background: 'var(--ga-yellow)' }}
        >
          <Sparkles size={18} className="text-ga-ink" aria-hidden />
        </span>
        <div>
          <p className="font-ga-display text-[15px] font-medium text-ga-ink">
            Đủ 4 nhánh {readyLevel} đã chín — sẵn sàng lên cấp!
          </p>
          <p className="ga-ui text-[12.5px] text-ga-muted">
            Vượt mốc để cây vươn lên tầng {nextLevel ?? 'mới'} và mở khoá những nhánh kế tiếp.
          </p>
        </div>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={onLevelUp}
        className="ga-ui inline-flex items-center gap-1.5 rounded-ga-pill bg-ga-ink px-4 py-2 text-[13px] font-semibold text-ga-bg transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Sparkles size={15} aria-hidden />}
        {nextLevel ? `Lên cấp ${nextLevel}` : 'Lên cấp'}
      </button>
    </div>
  )
}
