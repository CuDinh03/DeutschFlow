import type { AbstractIntlMessages } from 'next-intl'
import { getMessages } from 'next-intl/server'
import chromeVi from '../../messages/v2/chrome.vi.json'

/**
 * W2 audit lag 02/09 — i18n theo khu.
 *
 * `request.ts` nạp base + CẢ 9 phần v2 (~375KB raw) và RootLayout từng serialize trọn bộ vào
 * NextIntlClientProvider → MỌI trang SSR cõng ~245KB chuỗi dịch trong HTML, phần lớn của những
 * khu người dùng không bao giờ mở (student cõng teacher+org+admin và ngược lại).
 *
 * Helper này cắt phần `v2` theo khu cho từng provider:
 *  - lõi chrome (nav/shell/common/error/maintenance) luôn có mặt — GaShell/GaSidebar/route-error/
 *    MaintenanceOverlay dùng ở mọi khu;
 *  - `areas` là phần khu đó cần thêm. Nhận cả đường dẫn sâu (`'student.examSpeaking'`) cho vài
 *    component đặc thù render chéo khu (StimulusCard trong admin/exam-bank, MicDeniedGuide trong
 *    onboarding/mock-exam) — cấp đúng nhánh con thay vì cõng cả 75KB của khu student.
 *
 * Base (catalog legacy) TRƯỚC ĐÂY đi kèm nguyên vẹn ở mọi provider. Sau khi dọn xác v1 (#608,
 * #610) nó chỉ còn ba namespace — `nav`, `learn`, `speaking` — nhưng riêng `speaking` đã 14KB và
 * chỉ khu student cần, nên mọi trang khác (landing, đăng nhập, teacher, org, admin) cõng vô ích.
 * Nay base cũng khai báo tường minh, bằng tiền tố `base:`; không khai thì KHÔNG có. Cổng
 * `scripts/check-i18n-providers.mjs` đối chiếu khai báo với nhu cầu thật của cây import từng khu.
 *
 * ⚠️ Thêm khu/namespace mới thì chạy `npm run check:i18n` — và nhớ: một component client dùng
 * `useTranslations('v2.<x>')` chỉ chạy được trong khu có cấp phần `<x>` cho provider của nó.
 */
// Lõi mọi provider đều mang = ĐÚNG các nhóm top-level của chrome.<locale>.json, đọc từ file vi
// (source of truth, cùng quy ước với scripts/check-i18n-usage.js). request.ts merge chrome PHẲNG
// vào root `v2` — KHÔNG tồn tại node `v2.chrome`, nên bản đầu hard-code `['chrome', 'maintenance']`
// pick trượt toàn bộ nav/shell/common/error: prod hiện nguyên khoá thô (v2.shell.logout,
// v2.common.start…) ở mọi khu. Derive từ file để chrome thêm nhóm mới là lõi tự mở rộng theo,
// không phụ thuộc ai đó nhớ cập nhật danh sách tay.
const V2_CORE: readonly string[] = Object.keys(chromeVi)

/** Tiền tố khai báo namespace của catalog GỐC (khác `v2.*`). */
const BASE_PREFIX = 'base:'

type Messages = Record<string, unknown>

function pickDeep(source: Messages, dotPath: string): unknown {
  let node: unknown = source
  for (const seg of dotPath.split('.')) {
    if (node == null || typeof node !== 'object') return undefined
    node = (node as Messages)[seg]
  }
  return node
}

function assignDeep(target: Messages, dotPath: string, value: unknown): void {
  const segs = dotPath.split('.')
  let node = target
  for (const seg of segs.slice(0, -1)) {
    const next = node[seg]
    if (next == null || typeof next !== 'object') {
      const created: Messages = {}
      node[seg] = created
      node = created
    } else {
      node = next as Messages
    }
  }
  node[segs[segs.length - 1]] = value
}

/**
 * Messages cho một provider: v2 gồm chrome + các phần nêu tên, base gồm ĐÚNG các namespace khai
 * bằng tiền tố `base:`.
 *
 * `messagesForV2Areas('student', 'base:learn', 'base:speaking')` — khu student.
 * `messagesForV2Areas('teacher')` — khu teacher, không cần catalog gốc nào.
 */
export async function messagesForV2Areas(...areas: string[]): Promise<AbstractIntlMessages> {
  const all = (await getMessages()) as Messages
  const baseWanted = new Set(areas.filter((a) => a.startsWith(BASE_PREFIX)).map((a) => a.slice(BASE_PREFIX.length)))
  const v2Areas = areas.filter((a) => !a.startsWith(BASE_PREFIX))

  const base: Messages = {}
  for (const key of Object.keys(all)) {
    if (key !== 'v2' && baseWanted.has(key)) base[key] = all[key]
  }

  const v2 = all.v2
  if (v2 == null || typeof v2 !== 'object') return { ...base } as AbstractIntlMessages

  const picked: Messages = {}
  for (const key of [...V2_CORE, ...v2Areas]) {
    const value = pickDeep(v2 as Messages, key)
    if (value !== undefined) assignDeep(picked, key, value)
  }
  return { ...base, v2: picked } as AbstractIntlMessages
}
