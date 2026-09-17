// Lớp Tailwind dùng chung cho các bước wizard — cùng token Galerie với page.tsx và OrgLiteWizard.
// Chỉ thang `text-ga-*` (ratchet design-token đếm file mới từ baseline 0).

export const cardCls = 'rounded-ga border border-ga-line bg-ga-card p-4 lg:p-6 shadow-ga-card-hover space-y-4'

export const headingCls = 'font-ga-display text-ga-h1-m text-ga-ink outline-none'

export const subCls = 'text-ga-small text-ga-muted'

/** Hàng chọn (radio) một cột. */
export function rowCls(selected: boolean): string {
  return `w-full flex items-center gap-3 p-3 rounded-ga border text-left transition-colors duration-150 ${
    selected ? 'border-ga-gold bg-ga-yellow-soft' : 'border-ga-line hover:border-ga-subtle'
  }`
}

/** Ô lưới 2 cột (mục tiêu, nhịp). */
export function tileCls(selected: boolean): string {
  return `p-3 rounded-ga border text-center transition-colors duration-150 ${
    selected ? 'border-ga-gold bg-ga-yellow-soft' : 'border-ga-line hover:border-ga-subtle'
  }`
}

/** Chip pill (trình độ mục tiêu, lĩnh vực). */
export function chipCls(selected: boolean): string {
  return `ga-ui text-ga-caption px-3 py-1.5 min-h-[40px] lg:min-h-0 rounded-ga-pill border transition-colors ${
    selected ? 'bg-ga-yellow border-ga-gold text-ga-ink font-bold' : 'border-ga-line text-ga-muted hover:border-ga-subtle'
  }`
}
