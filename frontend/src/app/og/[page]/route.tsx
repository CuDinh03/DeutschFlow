import { ExamCard, HomeCard, OG_CATALOG, TextCard } from '@/lib/og/ogCards'
import { renderOg } from '@/lib/og/renderOg'
import { OG_PAGES, type OgPage } from '@/lib/ogImage'
import { DEFAULT_PUBLIC_LOCALE, isPublicLocale, type PublicLocale } from '@/lib/publicLocale'

/**
 * `/og/<trang>.png?l=<vi|en|de>` — ảnh chia sẻ 1200×630 của trang chủ, luyện thi, trung tâm, tổng nghề
 * (A3, 08/11/2026). Nội dung chỉ từ catalog nên ảnh giống nhau mọi lượt: cache 1 ngày ở trình duyệt,
 * 7 ngày ở Cloudflare.
 */
export async function GET(req: Request, { params }: { params: { page: string } }) {
  const page = /^([a-z-]+)\.png$/.exec(params.page)?.[1] as OgPage | undefined
  if (!page || !OG_PAGES.includes(page)) return new Response('Not found', { status: 404 })
  const l = new URL(req.url).searchParams.get('l')
  const locale: PublicLocale = l && isPublicLocale(l) ? l : DEFAULT_PUBLIC_LOCALE
  const t = OG_CATALOG[locale]

  switch (page) {
    case 'home':
      return renderOg(<HomeCard locale={locale} />)
    case 'luyen-thi':
      return renderOg(<ExamCard />)
    case 'trung-tam': {
      // Trang trung tâm chưa có bản tiếng Đức → ảnh tiếng Anh, như lối của khối trung tâm trang chủ.
      const s = OG_CATALOG[locale === 'de' ? 'en' : locale].schools.hero
      return renderOg(<TextCard eyebrow={s.cap} lead={s.title} em={s.titleEm} />)
    }
    case 'free-grade':
      // Trang chấm thử chỉ có tiếng Việt (SEO 3e, 13/11/2026).
      return renderOg(<TextCard eyebrow="Schreiben B1 · Miễn phí" lead="Chấm thử bài viết tiếng Đức" em="bằng AI." sub="Điểm và nhận xét theo tiêu chí Goethe/telc trong 15 giây, không cần đăng ký." />)
    case 'phong-van': {
      const o = t.occupationPages.index
      return renderOg(<TextCard eyebrow={o.cap} lead={o.title} sub={o.intro} />)
    }
  }
}
