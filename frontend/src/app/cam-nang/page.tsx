import '@/styles/galerie.css'
import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { GUIDE_ARTICLES } from '@/data/camNang'
import { absoluteUrl } from '@/lib/siteUrl'
import { ogImage } from '@/lib/ogImage'
import { breadcrumbStructuredData, toJsonLd } from '@/lib/homeStructuredData'
import { GaBtn } from '@/components/ui-v2/GaBtn'
import { PublicShell } from '@/components/landing-v2/PublicShell'
import { START_HREF } from '@/components/landing-v2/links'
import { GuideIndexCatalog } from '@/components/marketing/GuideIndexCatalog'

/** Mục lục Cẩm nang `/cam-nang/` (đợt D, 08/11/2026) — chỉ tiếng Việt, nâng cấp ấn phẩm biên tập v3.4. */
const TITLE = 'Cẩm nang phỏng vấn tiếng Đức theo nghề · myDeutschFlow'
const DESCRIPTION =
  'Cẩm nang phỏng vấn xin việc bằng tiếng Đức theo từng nghề: câu hỏi tiêu biểu, cách trả lời, từ vựng chuyên môn và lỗi ngữ pháp người Việt hay gặp.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: absoluteUrl('/cam-nang/') },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    locale: 'vi_VN',
    url: absoluteUrl('/cam-nang/'),
    siteName: 'myDeutschFlow',
    images: [ogImage('home', 'vi', TITLE)],
  },
}

export default function GuideIndexPage() {
  return (
    <PublicShell
      current="guide"
      showLanguage={false}
      stickyCta="b2c"
      mainClassName="mx-auto w-full max-w-[1240px] px-5 pb-24 pt-10 sm:px-8 md:pt-14 lg:px-[60px]"
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: toJsonLd(breadcrumbStructuredData([['Trang chủ', '/'], ['Cẩm nang', '/cam-nang/']])),
        }}
      />

      <section className="rounded-ga-xl border border-ga-border bg-ga-card p-6 shadow-ga-sm sm:p-10">
        <div className="mb-4 inline-flex items-center gap-2 rounded-ga-pill border border-ga-border bg-ga-bg px-3.5 py-1 text-ga-eyebrow uppercase text-ga-muted">
          <span className="inline-block h-2 w-2 shrink-0 rounded-ga-pill bg-ga-yellow" />
          Ấn phẩm biên tập · Cẩm nang thực chiến
        </div>
        <h1 className="max-w-[820px] font-ga-display text-ga-m-h1-m font-medium text-ga-ink sm:text-ga-m-h1-t lg:text-ga-m-h1">
          Cẩm nang phỏng vấn <span className="ga-hero-mark">tiếng Đức theo nghề</span>
        </h1>
        <p className="mt-4 max-w-[660px] text-ga-m-lead text-ga-muted">{DESCRIPTION}</p>
        <p className="mt-3 text-ga-small text-ga-muted">
          Mỗi bài chỉ trích nguyên văn câu hỏi phỏng vấn đã được duyệt trên hệ thống, kèm từ vựng đúng giống danh từ và cách tránh lỗi ngữ pháp người Việt hay mắc.
        </p>
      </section>

      <GuideIndexCatalog articles={GUIDE_ARTICLES} />

      <section className="mt-12 grid gap-5 rounded-ga-xl border border-ga-border bg-ga-card p-6 shadow-ga-sm sm:p-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div>
          <span className="text-ga-eyebrow uppercase text-ga-muted">Chưa thấy nghề của bạn trong cẩm nang?</span>
          <h2 className="mt-2 font-ga-display text-ga-m-h2-m font-medium text-ga-ink sm:text-ga-m-h2-t">
            Xem câu hỏi mẫu theo từng nghề và vào nói thử ngay
          </h2>
          <p className="mt-2 max-w-[620px] text-ga-body text-ga-muted">
            Danh mục nghề trên myDeutschFlow có câu hỏi mẫu tiếng Đức kèm bản dịch tiếng Việt cho từng vị trí làm việc tại Đức. Dùng thử 7 ngày khi đăng ký, không cần thanh toán trước.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
          <GaBtn asChild variant="yellow" size="lg" className="ga-btn-gleam w-full sm:w-auto">
            <Link href={START_HREF}>
              Học thử miễn phí
              <ArrowRight size={16} aria-hidden />
            </Link>
          </GaBtn>
          <GaBtn asChild variant="ghost" size="lg" className="w-full sm:w-auto">
            <Link href="/phong-van/">Xem tất cả trang nghề</Link>
          </GaBtn>
        </div>
      </section>
    </PublicShell>
  )
}
