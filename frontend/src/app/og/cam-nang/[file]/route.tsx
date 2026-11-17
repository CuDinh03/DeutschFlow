import { TextCard } from '@/lib/og/ogCards'
import { renderOg } from '@/lib/og/renderOg'
import { guideArticle } from '@/data/camNang'

/**
 * `/og/cam-nang/<slug>.png` — ảnh chia sẻ riêng của một bài Cẩm nang (đợt 0, 18/11/2026). Chữ lớn đúng
 * bằng tên bài (cũng là `og:title`); dòng phụ là câu hỏi tiêu biểu ngắn nhất của bài, chép nguyên văn.
 * Chỉ tiếng Việt như trang Cẩm nang. Slug không có trong `GUIDE_ARTICLES` → 404.
 */
export async function GET(_req: Request, { params }: { params: { file: string } }) {
  const slug = /^([a-z0-9]+(?:-[a-z0-9]+)*)\.png$/.exec(params.file)?.[1]
  const a = slug ? guideArticle(slug) : undefined
  if (!a) return new Response('Not found', { status: 404 })

  const shortest = [...a.questions].sort((x, y) => x.de.length - y.de.length)[0]
  const sub = shortest ? `Câu hỏi tiêu biểu: „${shortest.de}“` : undefined
  return renderOg(<TextCard eyebrow={`Cẩm nang · ${a.occupationNameDe}`} lead={a.title} sub={sub} />)
}
