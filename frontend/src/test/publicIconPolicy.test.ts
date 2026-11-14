/**
 * Luật icon trang công khai (owner 14/11/2026): bỏ icon thư viện mang tính trang trí ("lấp lánh", tia sét, ngôi
 * sao…) — chúng không nói gì về hành động của nút. Nhận diện dùng bộ glyph Galerie (`GaGlyphMark`, chung mobile)
 * hoặc ô `GaGlyph`; nút chỉ được mang icon điều khiển có nghĩa (mũi tên chỉ hướng, tải, sao chép, phát/dừng).
 * Xem `frontend/ICON_WEB.md` §2.
 */
import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const SRC = join(__dirname, '..')

/** Thư mục/tệp của trang công khai (không cần đăng nhập) và component chỉ trang công khai dùng. */
const PUBLIC_ROOTS = [
  'app/page.tsx', 'app/HomeClient.tsx', 'app/not-found.tsx', 'app/about', 'app/cam-nang', 'app/certificate',
  'app/chi-phi', 'app/free-grade', 'app/hoc-nghe', 'app/luyen-thi', 'app/mydeutschflow-la-gi', 'app/phieu',
  'app/phong-van', 'app/privacy', 'app/report', 'app/support', 'app/terms', 'app/trung-tam',
  'components/landing-v2', 'components/marketing',
]

/** Icon trang trí không có nghĩa hành động — cấm ở trang công khai. */
const DECORATIVE = [
  'Sparkles', 'Sparkle', 'WandSparkles', 'Wand2', 'Wand', 'Zap', 'Star', 'Stars', 'Rocket', 'Flame', 'Crown', 'Gem',
  'PartyPopper', 'Trophy', 'Lightbulb', 'Award', 'Medal', 'ThumbsUp', 'Smile', 'Heart',
]

function files(path: string): string[] {
  const full = join(SRC, path)
  let st
  try {
    st = statSync(full)
  } catch {
    return []
  }
  if (st.isFile()) return /\.tsx?$/.test(full) ? [full] : []
  return readdirSync(full).flatMap((n) => files(join(path, n)))
}

describe('icon trang công khai', () => {
  const all = PUBLIC_ROOTS.flatMap(files).filter((f) => !/\.test\.tsx?$/.test(f))

  it('quét được các trang công khai', () => {
    expect(all.length).toBeGreaterThan(20)
  })

  it('không import icon trang trí từ lucide-react', () => {
    const bad: string[] = []
    for (const f of all) {
      const src = readFileSync(f, 'utf8')
      const re = /import\s*\{([^}]*)\}\s*from\s*['"]lucide-react['"]/g
      let m: RegExpExecArray | null
      while ((m = re.exec(src)) !== null) {
        const names = m[1].split(',').map((s: string) => s.trim().split(/\s+as\s+/)[0]).filter(Boolean)
        for (const n of names) if (DECORATIVE.includes(n)) bad.push(`${relative(SRC, f)}: ${n}`)
      }
    }
    expect(bad).toEqual([])
  })
})
