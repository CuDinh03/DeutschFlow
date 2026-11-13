/**
 * Chính sách bot AI và /llms.txt (owner chốt 14/11/2026): bot tìm kiếm/trích dẫn đọc được như mọi bot,
 * bot huấn luyện bị chặn; llms.txt không hứa điều sản phẩm chưa có.
 */
import { describe, expect, it } from 'vitest'
import robots from '@/app/robots'
import { AI_SEARCH_BOTS, AI_TRAINING_BOTS } from '@/lib/aiCrawlers'
import { buildLlmsTxt } from '@/lib/llmsTxt'

describe('robots.txt — bot AI', () => {
  const rules = robots().rules
  const list = Array.isArray(rules) ? rules : [rules]
  const ruleFor = (bot: string) => list.find((r) => (Array.isArray(r.userAgent) ? r.userAgent : [r.userAgent]).includes(bot))

  it('bot huấn luyện bị chặn toàn site', () => {
    for (const bot of AI_TRAINING_BOTS) expect(ruleFor(bot)?.disallow, bot).toBe('/')
  })

  it('bot tìm kiếm/trích dẫn được đọc trang công khai nhưng vẫn bị chặn khu vực riêng tư', () => {
    for (const bot of AI_SEARCH_BOTS) {
      const r = ruleFor(bot)
      expect(r?.allow, bot).toBe('/')
      expect(r?.disallow, bot).toContain('/v2/')
    }
  })

  it('không bot nào vừa ở nhóm tìm kiếm vừa ở nhóm huấn luyện', () => {
    const both = AI_SEARCH_BOTS.filter((b) => (AI_TRAINING_BOTS as readonly string[]).includes(b))
    expect(both).toEqual([])
  })
})

describe('/llms.txt', () => {
  const txt = buildLlmsTxt()

  it('có tiêu đề, tóm tắt và các trang chính', () => {
    expect(txt.startsWith('# myDeutschFlow\n')).toBe(true)
    for (const path of ['/phong-van/', '/luyen-thi/', '/free-grade/', '/trung-tam/', '/mydeutschflow-la-gi/']) {
      expect(txt).toContain(`${path})`)
    }
  })

  it('đúng sổ lời hứa: thi thử chỉ telc B1, Android dùng web, chấm Nói Beta; không hứa kết quả', () => {
    expect(txt).toContain('chỉ có cho telc Deutsch B1')
    expect(txt).toContain('Android dùng bản web')
    expect(txt).toContain('Beta')
    expect(txt).not.toMatch(/thi thử Goethe|đỗ visa|đậu visa|cam kết|₫/i)
  })
})
