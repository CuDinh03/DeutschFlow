/**
 * Khung lỗi ở trang admin phải nói CHUYỆN GÌ hỏng (owner yêu cầu 13/11/2026): `<ErrorBanner>` không có `title`
 * hiện tiêu đề chung "Đã xảy ra lỗi", còn `message` thường là câu của backend — admin không biết trang đang tải
 * hay lưu cái gì. Test này quét mã nguồn để khung lỗi mới không tái phạm.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, it, expect } from 'vitest'

const ROOTS = ['src/app/v2/admin', 'src/components/admin']

/**
 * Được miễn tiêu đề riêng: `message` ở các chỗ này đã là câu của chính trang, nêu rõ đang tải gì
 * (vd. "Không thể tải dữ liệu doanh thu."), nên thêm tiêu đề chỉ lặp lại.
 */
const MESSAGE_ALREADY_SPECIFIC = new Set([
  'src/app/v2/admin/ai-usage/AiCostOverviewTab.tsx',
  'src/app/v2/admin/interviews/page.tsx',
  'src/app/v2/admin/page.tsx',
  'src/app/v2/admin/revenue/page.tsx',
  // Xưởng đề: hai khung này được thêm tiêu đề ở PR riêng của đợt Xưởng đề.
  'src/components/admin/exam-studio/SetRunsPanel.tsx',
  'src/components/admin/exam-studio/SourcesTab.tsx',
])

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.tsx') ? [p] : []
  })
}

describe('khung lỗi ở trang admin', () => {
  it('mỗi <ErrorBanner> có tiêu đề riêng, trừ khi message đã là câu cụ thể của trang', () => {
    const offenders: string[] = []
    let seen = 0
    for (const file of ROOTS.flatMap(walk)) {
      const rel = relative(process.cwd(), file).split(sep).join('/')
      const src = readFileSync(file, 'utf8')
      for (const tag of src.match(/<ErrorBanner\b[^>]*>/g) ?? []) {
        seen += 1
        if (/\btitle=/.test(tag)) continue
        // message={t('…')}: câu cố định của trang, tự nó đã nói chuyện gì.
        if (/message=\{t\(/.test(tag)) continue
        if (MESSAGE_ALREADY_SPECIFIC.has(rel)) continue
        offenders.push(`${rel}: ${tag}`)
      }
    }
    expect(seen).toBeGreaterThan(20)
    expect(offenders).toEqual([])
  })
})
