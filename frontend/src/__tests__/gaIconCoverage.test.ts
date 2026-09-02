/**
 * Hợp đồng ICON: mọi tên icon mà UI /v2 tham chiếu phải CÓ THẬT trong bảng của `GaIcon`.
 *
 * VÌ SAO CẦN TEST NÀY: `GaIcon` rơi về `Circle` khi tra không thấy tên. Trên sidebar, đó là một
 * vòng tròn rỗng nằm cạnh các icon thật — trông y hệt lỗi tải, và không có gì báo động: không
 * lỗi TypeScript (tên icon là `string`), không lỗi runtime, không cảnh báo console. Đúng lỗi này
 * đã âm thầm sống với `timer` / `query_stats` / `person_search` (Chấm công, Thống kê, Giáo viên
 * tự do) cho tới khi rà tay mới thấy.
 *
 * Test kiểm ba nguồn tên icon: `ROLE_NAV` (sidebar của 4 role), `emojiIconMap.ts` (đích của bảng
 * dịch `skill_tree_nodes.emoji`), và `PERSONA_GROUPS` (chip lọc ngành màn chọn bạn luyện nói).
 * Khi mô hình area-nav vào nhánh chính thì thêm một `it()` duyệt `ROLE_AREAS` theo đúng khuôn này.
 */
import { describe, it, expect } from 'vitest'
import { GA_ICON_NAMES } from '@/components/ui-v2/GaIcon'
import { EMOJI_ICON, iconNameForEmoji } from '@/components/ui-v2/emojiIconMap'
import { ROLE_NAV } from '@/components/ui-v2/nav'
import { PERSONA_GROUPS } from '@/lib/personas'

const KNOWN = new Set(GA_ICON_NAMES)

describe('GaIcon — bao phủ tên icon', () => {
  it('mọi icon trong sidebar nav (4 role) đều có trong bảng', () => {
    const missing = Object.values(ROLE_NAV)
      .flatMap((nav) => nav.sections.flatMap((s) => s.items.map((i) => i.icon)))
      .filter((name) => !KNOWN.has(name))
    expect(Array.from(new Set(missing))).toEqual([])
  })

  it('mọi đích của bảng emoji → icon đều có trong bảng', () => {
    const missing = Object.entries(EMOJI_ICON)
      .filter(([, name]) => !KNOWN.has(name))
      .map(([emoji, name]) => `${emoji} → ${name}`)
    expect(missing).toEqual([])
  })

  it('chip lọc ngành của màn chọn bạn luyện nói dùng tên icon hợp lệ', () => {
    expect(PERSONA_GROUPS.map((g) => g.icon).filter((name) => !KNOWN.has(name))).toEqual([])
  })
})

describe('iconNameForEmoji', () => {
  it('bỏ qua variation selector: 🗣️ và 🗣 cùng ra một icon', () => {
    expect(iconNameForEmoji('🗣️')).toBe('record_voice_over')
    expect(iconNameForEmoji('🗣')).toBe('record_voice_over')
  })

  it('emoji lạ / rỗng rơi về icon mặc định hợp lệ, không phải vòng tròn rỗng', () => {
    for (const input of ['🫥', '', null, undefined]) {
      expect(KNOWN.has(iconNameForEmoji(input))).toBe(true)
    }
    // Mặc định khớp DEFAULT '📖' của cột skill_tree_nodes.emoji.
    expect(iconNameForEmoji(undefined)).toBe('menu_book')
  })

  it('khớp đúng emoji node hay gặp nhất của lộ trình', () => {
    expect(iconNameForEmoji('🔤')).toBe('alphabet')
    expect(iconNameForEmoji('📖')).toBe('menu_book')
    expect(iconNameForEmoji('🏥')).toBe('stethoscope')
  })
})
