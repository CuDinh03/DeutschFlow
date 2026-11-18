/** Chữ cái trên nút ảnh đại diện: chữ đầu của từ cuối trong tên ("Nguyễn Thị Lan" → "L"). */
export function avatarInitial(displayName: string | null | undefined): string {
  const last = (displayName ?? '').trim().split(/\s+/).at(-1) ?? ''
  const ch = last.charAt(0)
  return ch ? ch.toLocaleUpperCase('vi') : '?'
}
