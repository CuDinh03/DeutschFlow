/**
 * A3 (kế hoạch cải thiện trang chủ 08/11/2026): ảnh chia sẻ 1200×630.
 * Route `app/og/...` gọi `next/og` (không chạy được trong vitest trên Windows) nên test phần thuần:
 * URL ảnh, chọn câu hỏi cho ảnh trang nghề, và chữ trong mẫu đọc đúng catalog.
 */
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { OG_SIZE, occupationOgImage, ogImage } from '@/lib/ogImage'
import { HomeCard, OG_FONT_FILES, OccupationCard, pickOgQuestion } from '@/lib/og/ogCards'
import type { OccupationDetail } from '@/lib/occupationTypes'

describe('ogImage', () => {
  it('URL đuôi .png (middleware cho đi thẳng), có ngôn ngữ và số phiên bản, khổ 1200×630', () => {
    const img = ogImage('home', 'en', 'alt')
    expect(img.url).toMatch(/^\/og\/home\.png\?l=en&v=\d+$/)
    expect([img.width, img.height]).toEqual([1200, 630])
    expect(OG_SIZE).toEqual({ width: 1200, height: 630 })
    expect(occupationOgImage('koch', 'vi', 'alt').url).toMatch(/^\/og\/nghe\/koch\.png\?l=vi&v=\d+$/)
  })
})

describe('pickOgQuestion', () => {
  const q = (phase: string, source: 'BANK' | 'APPROVED' | 'AI_GENERATED', questionDe: string) => ({ phase, source, questionDe })

  it('ưu tiên câu chuyên môn đã duyệt, bỏ câu mở đầu', () => {
    expect(pickOgQuestion([q('INTRO', 'BANK', 'A'), q('HARD_SKILLS', 'BANK', 'B')])?.questionDe).toBe('B')
  })

  it('không bao giờ lấy câu AI chưa duyệt — rơi về câu mở đầu', () => {
    const list: OccupationDetail['sampleQuestions'] = [q('INTRO', 'BANK', 'A'), q('HARD_SKILLS', 'AI_GENERATED', 'X')]
    expect(pickOgQuestion(list)?.questionDe).toBe('A')
    expect(pickOgQuestion([q('HARD_SKILLS', 'AI_GENERATED', 'X')])).toBeNull()
  })
})

describe('mẫu ảnh', () => {
  it('ảnh trang chủ tiếng Việt: tiêu đề hero, "Bạn đã nói / Nên nói", nhãn Minh hoạ', () => {
    const html = renderToStaticMarkup(<HomeCard locale="vi" />)
    for (const s of ['Luyện', 'nghề', 'Bạn đã nói', 'Nên nói', 'Minh hoạ', 'mydeutschflow.com']) expect(html).toContain(s)
  })

  it('ảnh trang nghề không có câu hỏi thì không vẽ thẻ câu hỏi', () => {
    const html = renderToStaticMarkup(
      <OccupationCard locale="de" nameDe="Koch/Köchin" nameLocal={null} question={null} translation={null} interviewer={null} />,
    )
    expect(html).toContain('Koch/Köchin')
    expect(html).not.toContain('Diese Fragen stellt die KI')
  })

  it('đủ bốn tệp font (Be Vietnam Pro 400/600, Newsreader 500 thường + nghiêng)', () => {
    expect(OG_FONT_FILES.map(([, w, s, f]) => `${w}${s}${f}`)).toHaveLength(4)
  })
})
