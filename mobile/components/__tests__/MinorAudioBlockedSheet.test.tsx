// Sheet 403 MINOR_AUDIO_BLOCKED: dựng cây phần tử của phần nội dung (không cần renderer — dự án
// không có react-test-renderer) và kiểm: tiêu đề theo reason, nội dung ưu tiên detail server,
// ghi chú "nâng gói không mở được", nút "Đã hiểu" luôn có, "Liên hệ trung tâm" theo cờ contact.

import type { ReactElement } from 'react'

jest.mock('@/lib/theme', () => ({
  radius: { sm: 4, md: 4, lg: 4, xl: 6, '2xl': 8, '3xl': 10, full: 9999 },
  space: { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 7: 28, 8: 32, 10: 40, 12: 48, 16: 64 },
  useTheme: () => ({
    colors: { bg: '#fff', accent: '#FFCD00', accentSoft: 'rgba(255,205,0,0.16)', surfaceSunken: '#F6F3EC' },
  }),
}))

jest.mock('@/components/ui', () => ({
  ThemedText: (_p: unknown) => null,
  Button: (_p: unknown) => null,
  GaGlyph: (_p: unknown) => null,
}))

jest.mock('@/lib/analytics', () => ({ captureEvent: jest.fn() }))

import { MinorAudioBlockedContent } from '@/components/MinorAudioBlockedSheet'
import { GaGlyph, Button } from '@/components/ui'
import type { MinorAudioBlocked } from '@/lib/minorAudio'

type AnyElement = ReactElement<Record<string, unknown>>

function isElement(n: unknown): n is AnyElement {
  return !!n && typeof n === 'object' && 'props' in (n as object) && 'type' in (n as object)
}

/** Gom mọi chuỗi (children + label của Button) theo thứ tự xuất hiện. */
function collectText(node: unknown, out: string[] = []): string[] {
  if (node == null || typeof node === 'boolean') return out
  if (typeof node === 'string' || typeof node === 'number') {
    out.push(String(node))
    return out
  }
  if (Array.isArray(node)) {
    node.forEach((n) => collectText(n, out))
    return out
  }
  if (isElement(node)) {
    if (typeof node.props.label === 'string') out.push(node.props.label)
    collectText(node.props.children, out)
  }
  return out
}

function findAll(node: unknown, type: unknown, out: AnyElement[] = []): AnyElement[] {
  if (Array.isArray(node)) {
    node.forEach((n) => findAll(n, type, out))
    return out
  }
  if (isElement(node)) {
    if (node.type === type) out.push(node)
    findAll(node.props.children, type, out)
  }
  return out
}

function render(info: MinorAudioBlocked, contact = true) {
  const onClose = jest.fn()
  const onContact = jest.fn()
  const tree = MinorAudioBlockedContent({ info, contact, onClose, onContact })
  return { tree, onClose, onContact, text: collectText(tree).join('\n') }
}

describe('MinorAudioBlockedContent', () => {
  test('GUARDIAN_CONSENT_REQUIRED: tiêu đề phiếu đồng ý, nội dung = detail server, có ghi chú nâng gói', () => {
    const { text } = render({ reason: 'GUARDIAN_CONSENT_REQUIRED', detail: 'Server: cần phiếu đồng ý.' })
    expect(text).toMatch(/Phần luyện nói tạm khoá/)
    expect(text).toMatch(/Cần phiếu đồng ý của cha mẹ\/người giám hộ/)
    expect(text).toMatch(/Server: cần phiếu đồng ý\./)
    expect(text).toMatch(/Nâng cấp gói không mở được/)
  })

  test('BIRTH_DATE_REQUIRED không có detail → câu dự phòng về ngày sinh', () => {
    const { text } = render({ reason: 'BIRTH_DATE_REQUIRED', detail: null })
    expect(text).toMatch(/Trung tâm chưa ghi nhận ngày sinh của bạn/)
    expect(text).toMatch(/bổ sung ngày sinh/)
  })

  test('GUARDIAN_CONSENT_REVOKED → người giám hộ liên hệ trung tâm cấp lại', () => {
    const { text } = render({ reason: 'GUARDIAN_CONSENT_REVOKED', detail: null })
    expect(text).toMatch(/Đồng ý ghi âm đã được thu hồi/)
    expect(text).toMatch(/người giám hộ liên hệ trung tâm/)
  })

  test('biểu tượng nhận diện là GaGlyph `khoa` (không Lucide, không emoji)', () => {
    const { tree, text } = render({ reason: 'GUARDIAN_CONSENT_REQUIRED', detail: null })
    const glyphs = findAll(tree, GaGlyph)
    expect(glyphs).toHaveLength(1)
    expect(glyphs[0].props.name).toBe('khoa')
    // eslint-disable-next-line no-misleading-character-class
    expect(text).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u)
  })

  test('nút: "Đã hiểu" gọi onClose; "Liên hệ trung tâm" gọi onContact', () => {
    const { tree, onClose, onContact } = render({ reason: 'GUARDIAN_CONSENT_REQUIRED', detail: null })
    const buttons = findAll(tree, Button)
    expect(buttons.map((b) => b.props.label)).toEqual(['Đã hiểu', 'Liên hệ trung tâm'])
    ;(buttons[0].props.onPress as () => void)()
    expect(onClose).toHaveBeenCalledTimes(1)
    ;(buttons[1].props.onPress as () => void)()
    expect(onContact).toHaveBeenCalledTimes(1)
  })

  test('contact=false (onboarding) → chỉ còn "Đã hiểu"', () => {
    const { tree } = render({ reason: 'GUARDIAN_CONSENT_REQUIRED', detail: null }, false)
    expect(findAll(tree, Button).map((b) => b.props.label)).toEqual(['Đã hiểu'])
  })
})
