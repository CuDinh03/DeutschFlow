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
