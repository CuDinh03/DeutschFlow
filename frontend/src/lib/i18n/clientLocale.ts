/**
 * Locale UI cho module KHÔNG chạy trong React (vd. lib/api.ts): đọc cookie `locale` — cùng nguồn
 * mà src/i18n/request.ts dùng phía server và LanguageSwitcher/login ghi phía client. Không có
 * document (SSR/test) → 'vi' (mặc định của app).
 */
import { toUiLocale, type UiLocale } from './format'

export function currentUiLocale(): UiLocale {
  if (typeof document === 'undefined') return 'vi'
  const m = /(?:^|;\s*)locale=([^;]+)/.exec(document.cookie ?? '')
  return toUiLocale(m ? decodeURIComponent(m[1]) : null)
}

/** Ba bản của một câu — dùng cho thông điệp cố định trong module ngoài React (lib/*Api.ts). */
export type LocaleText = Record<UiLocale, string>

/**
 * Chọn câu theo locale UI hiện hành (cookie `locale`) cho module KHÔNG chạy trong React — cùng
 * cơ chế với bảng dự phòng của lib/api.ts (F-I18N-02c). Đợt 3 audit UTF-8/i18n 06/09/2026: thông
 * điệp lỗi của asyncJob/curriculumImportApi/paymentApi… đi qua đây thay vì ghim tiếng Việt.
 */
export function uiText(map: LocaleText): string {
  return map[currentUiLocale()]
}
