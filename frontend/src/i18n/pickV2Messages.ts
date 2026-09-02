import type { AbstractIntlMessages } from 'next-intl'
import { getMessages } from 'next-intl/server'

/**
 * W2 audit lag 02/09 — i18n theo khu.
 *
 * `request.ts` nạp base + CẢ 9 phần v2 (~375KB raw) và RootLayout từng serialize trọn bộ vào
 * NextIntlClientProvider → MỌI trang SSR cõng ~245KB chuỗi dịch trong HTML, phần lớn của những
 * khu người dùng không bao giờ mở (student cõng teacher+org+admin và ngược lại).
 *
 * Helper này cắt phần `v2` theo khu cho từng provider:
 *  - `chrome` (nav/shell/common/error) luôn có mặt — GaShell/GaSidebar/route-error dùng ở mọi khu;
 *  - `areas` là phần khu đó cần thêm. Nhận cả đường dẫn sâu (`'student.examSpeaking'`) cho vài
 *    component đặc thù render chéo khu (StimulusCard trong admin/exam-bank, MicDeniedGuide trong
 *    onboarding/mock-exam) — cấp đúng nhánh con thay vì cõng cả 75KB của khu student.
 *
 * Base (catalog legacy: learn, nav, srs…) giữ nguyên ở mọi provider — các trang v2 vẫn dùng
 * namespace gốc rải rác (vd. `learn` trong learn/[nodeId]); tách base là việc của đợt sau.
 *
 * ⚠️ Thêm khu/namespace mới thì chạy `npm run check:i18n` — và nhớ: một component client dùng
 * `useTranslations('v2.<x>')` chỉ chạy được trong khu có cấp phần `<x>` cho provider của nó.
 */
// `maintenance` đi cùng chrome ở MỌI provider: MaintenanceOverlay mount ở root layout và
// MaintenanceBanner nằm trong GaShell của cả 4 khu — thiếu nhóm này ở một provider là
// client component ném missing-namespace đúng lúc đang bảo trì (thời điểm tệ nhất có thể).
const V2_CORE = ['chrome', 'maintenance'] as const

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

/** Messages cho một provider: base nguyên vẹn + v2 chỉ gồm chrome + các phần được nêu tên. */
export async function messagesForV2Areas(...areas: string[]): Promise<AbstractIntlMessages> {
  const all = (await getMessages()) as Messages
  const v2 = all.v2
  if (v2 == null || typeof v2 !== 'object') return all as AbstractIntlMessages

  const picked: Messages = {}
  for (const key of [...V2_CORE, ...areas]) {
    const value = pickDeep(v2 as Messages, key)
    if (value !== undefined) assignDeep(picked, key, value)
  }
  return { ...all, v2: picked } as AbstractIntlMessages
}
