import '@/styles/galerie.css'
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { GUIDE_ARTICLES } from '@/data/camNang'
import { absoluteUrl, SITE_URL } from '@/lib/siteUrl'
import { ogImage } from '@/lib/ogImage'
import { breadcrumbStructuredData } from '@/lib/homeStructuredData'
import { PAGE_LASTMOD } from '@/lib/sitemapDates'
import { GaBtn } from '@/components/ui-v2/GaBtn'
import { PublicShell } from '@/components/landing-v2/PublicShell'
import { APP_STORE_URL, START_HREF } from '@/components/landing-v2/links'
import { PUBLIC_V3_ASSETS } from '@/components/landing-v2/publicV3Assets'
import { DESCRIPTION, FAQS, FOUNDER, H1, PATH, PATHWAYS, TITLE } from '@/data/whatIsPage'

/*
 * "myDeutschFlow là gì?" — `/mydeutschflow-la-gi/` (13/11/2026), nâng cấp giao diện chuẩn v3.4.
 * Chỉ tiếng Việt. Owner duyệt hướng viết 13/11/2026: tên người sáng lập Đinh Huy Cự, không ghi giá
 * gói trả phí trên trang này (dẫn sang `/chi-phi/`).
 */
export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: absoluteUrl(PATH) },
  openGraph: {
    type: 'article',
    title: TITLE,
    description: DESCRIPTION,
    locale: 'vi_VN',
    url: absoluteUrl(PATH),
    siteName: 'myDeutschFlow',
    images: [ogImage('home', 'vi', TITLE)],
  },
}

const RELATED_GUIDES = ['phong-van-du-hoc-nghe-duc', 'gioi-thieu-ban-than-bang-tieng-duc', 'phong-van-tieng-duc-nghe-bep']

const H2 = 'mb-5 mt-12 scroll-mt-24 font-ga-display text-ga-m-h2-m font-medium text-ga-ink sm:text-ga-m-h2-t'
const H3 = 'mb-2 mt-7 text-ga-m-h3 font-semibold text-ga-ink'
const P = 'mt-3 text-ga-m-prose text-ga-ink'
const A = 'font-medium text-ga-navy underline decoration-ga-yellow decoration-2 underline-offset-4 hover:text-ga-ink'

const LIVE_FEATURES = [
  'Luyện phỏng vấn xin việc bằng giọng nói tiếng Đức theo từng nghề (nhãn câu hỏi rõ ràng: Đã duyệt, AI tạo, Bộ câu hỏi chung).',
  'Báo cáo sau buổi phỏng vấn chấm từng phần: câu bạn đã nói, câu nên nói, lý do ngữ pháp và bài luyện tiếp theo.',
  'Lộ trình học tiếng Đức hằng ngày từ A1 đến B1 đủ bốn kỹ năng Nghe, Đọc, Nói, Viết và ôn thẻ từ vựng.',
  'Thi thử 4 phần đề telc Deutsch B1 theo thời gian cấu trúc đề; chấm bài Viết theo ba tiêu chí của telc.',
  'Công cụ giao bài nói, nghe ghi âm, chấm bài viết tay và xuất phiếu kết quả cho giáo viên & trung tâm tiếng Đức.',
] as const

const HONEST_LIMITS = [
  'Phần chấm Nói trong thi thử telc B1 đang ở giai đoạn Beta, điểm chỉ để tham khảo.',
  'Lộ trình B2 đang được xây dựng; Chưa có lộ trình C1 trên hệ thống.',
  'Chưa có đề thi tiếng Đức nghề nghiệp (như telc Pflege hay DTB); mới có phỏng vấn theo nghề.',
  'Đề thi thử mô phỏng cấu trúc đề, không liên kết với telc và không thay cho chứng chỉ chính thức.',
  'Tính năng dành cho nhà tuyển dụng ở Đức xem hồ sơ luyện nói của ứng viên là Sắp có.',
] as const

export default function WhatIsPage() {
  const url = absoluteUrl(PATH)
  const guides = GUIDE_ARTICLES.filter((g) => RELATED_GUIDES.includes(g.slug))
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        headline: H1,
        description: DESCRIPTION,
        inLanguage: 'vi-VN',
        datePublished: PAGE_LASTMOD['/mydeutschflow-la-gi'],
        dateModified: PAGE_LASTMOD['/mydeutschflow-la-gi'],
        mainEntityOfPage: url,
        image: absoluteUrl(ogImage('home', 'vi', TITLE).url),
        about: { '@id': `${SITE_URL}/#app` },
        author: { '@type': 'Person', name: FOUNDER, url: absoluteUrl('/about/') },
        publisher: { '@id': `${SITE_URL}/#organization` },
      },
      {
        '@type': 'FAQPage',
        mainEntity: FAQS.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
      },
      { ...breadcrumbStructuredData([['Trang chủ', '/'], [H1, PATH]]), '@context': undefined },
    ],
  }

  return (
    <PublicShell
      current="none"
      showLanguage={false}
      stickyCta="b2c"
      mainClassName="mx-auto w-full max-w-[960px] px-5 pb-24 pt-10 sm:px-8 md:pt-14"
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, '\\u003c') }} />
      <article>
        {/* Header & hộp tóm tắt nhanh AEO */}
        <header className="rounded-ga-xl border border-ga-border bg-ga-card p-6 shadow-ga-sm sm:p-9">
          <div className="mb-4 inline-flex items-center gap-2 rounded-ga-pill border border-ga-border bg-ga-bg px-3.5 py-1 text-ga-eyebrow uppercase text-ga-muted">
            <span className="inline-block h-2 w-2 shrink-0 rounded-ga-pill bg-ga-yellow" />
            Giới thiệu sản phẩm & sổ tính năng thật
          </div>
          <h1 className="font-ga-display text-ga-m-h1-m font-medium text-ga-ink sm:text-ga-m-h1-art">
            <span className="ga-hero-mark">myDeutschFlow</span> là gì? Cách luyện phỏng vấn tiếng Đức với AI
          </h1>
          <p className="mt-4 text-ga-m-lead text-ga-muted">
            Nhiều người học tiếng Đức chia động từ đúng trên giấy, nhưng khi nhà tuyển dụng hỏi một câu về chính công việc của mình thì không biết bắt đầu từ đâu. Phỏng vấn đòi một kỹ năng khác với làm bài thi: nói thành câu, theo trình tự, về đúng chuyên môn của mình, ngay lúc đó.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-ga-border pt-4 text-ga-small text-ga-muted">
            <span>
              Cập nhật <time dateTime={PAGE_LASTMOD['/mydeutschflow-la-gi']}>{PAGE_LASTMOD['/mydeutschflow-la-gi'].split('-').reverse().join('/')}</time> · Người sáng lập:{' '}
              <Link href="/about/" className={A}>{FOUNDER}</Link>
            </span>
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/chi-phi/" className={A}>Xem các gói học</Link>
              <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer" className={A}>App Store iPhone ↗</a>
            </div>
          </div>

          <div className="mt-6 rounded-ga-lg border border-ga-yellow bg-ga-yellow-soft p-4 sm:p-5">
            <p className="text-ga-eyebrow uppercase text-ga-ink">Tóm tắt trong 30 giây</p>
            <p className="mt-1.5 text-ga-body text-ga-ink">
              <strong>myDeutschFlow</strong> là nền tảng luyện phỏng vấn xin việc bằng tiếng Đức theo từng nghề kết hợp lộ trình A1–B1 và thi thử telc B1, dùng chung một tài khoản trên web (mydeutschflow.com) và ứng dụng iPhone. Học viên mới được dùng thử 7 ngày khi đăng ký, không cần thanh toán trước.
            </p>
          </div>
        </header>

        <h2 className={H2}>myDeutschFlow giải quyết vấn đề gì?</h2>
        <p className={P}>
          <strong>myDeutschFlow</strong> là công cụ luyện phỏng vấn xin việc bằng tiếng Đức cho người Việt chuẩn bị sang Đức làm việc, dùng được trên web (mydeutschflow.com) và ứng dụng iPhone. AI đóng vai nhà tuyển dụng Đức, hỏi theo nghề bạn chọn, rồi chỉ ra chỗ cần sửa sau mỗi câu trả lời: ngữ pháp, từ dùng chưa đúng, ý còn thiếu.
        </p>
        <p className={P}>Ngoài phỏng vấn, nền tảng có lộ trình học tiếng Đức từ A1 đến B1, thi thử telc B1, và công cụ cho trung tâm, giáo viên tiếng Đức.</p>
        <p className={P}>
          myDeutschFlow do <Link href="/about/" className={A}>{FOUNDER}</Link> phát triển. Người sáng lập cũng đang học tiếng Đức và chuẩn bị phỏng vấn; mỗi tính năng ra đời từ một nhu cầu thật, không phải phỏng đoán.
        </p>

        <h3 className={H3}>Vì sao học giỏi ngữ pháp vẫn có thể lúng túng khi phỏng vấn?</h3>
        <p className={P}>
          Bài thi kiểm tra bạn hiểu và viết đúng. Buổi phỏng vấn kiểm tra bạn kể được việc mình đã làm, xử lý tình huống thế nào, vì sao chọn nghề này, bằng tiếng Đức và ngay tại chỗ. Hai kỹ năng này cần luyện riêng, và nói theo tình huống nghề nghiệp thường là phần ít được luyện nhất khi tự học.
        </p>

        <h3 className={H3}>myDeutschFlow luyện phỏng vấn như thế nào?</h3>
        <p className={P}>
          Bạn gõ tên nghề vào ô <strong>&ldquo;Bạn làm nghề gì?&rdquo;</strong>. Nghề đã có bộ câu hỏi riêng sẽ hiện ngay câu hỏi mẫu; nghề chưa có thì AI dùng bộ câu hỏi chung, điều chỉnh theo vị trí bạn nhập. Buổi luyện bắt đầu bằng lời mời giới thiệu bản thân, rồi tới câu hỏi về kinh nghiệm, tình huống và chuyên môn. Bạn trả lời bằng giọng nói; câu trả lời được chuyển thành chữ để AI chấm và nhận xét.
        </p>

        {/* Bảng sổ lời hứa: Đã chạy thật vs Đang hoàn thiện */}
        <h2 className={H2}>Sổ tính năng minh bạch: Đã chạy thật & Giới hạn hiện tại</h2>
        <p className={P}>
          Chúng tôi tách bạch rõ những gì bạn vào dùng được ngay hôm nay và những phần đang hoàn thiện để bạn chủ động sắp xếp kế hoạch ôn luyện:
        </p>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <section className="rounded-ga-xl border border-ga-border bg-ga-card p-5 shadow-ga-sm sm:p-6">
            <span className="inline-flex items-center gap-2 rounded-ga-pill bg-ga-green-soft px-3 py-1 text-ga-eyebrow uppercase text-ga-green">
              Đã chạy thật hôm nay
            </span>
            <ul className="mt-4 flex flex-col gap-3 text-ga-body text-ga-ink">
              {LIVE_FEATURES.map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <span aria-hidden className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-ga-pill bg-ga-green" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-ga-xl border border-ga-border bg-ga-card p-5 shadow-ga-sm sm:p-6">
            <span className="inline-flex items-center gap-2 rounded-ga-pill bg-ga-yellow-soft px-3 py-1 text-ga-eyebrow uppercase text-ga-ink">
              Giới hạn & phần chưa có
            </span>
            <ul className="mt-4 flex flex-col gap-3 text-ga-body text-ga-muted">
              {HONEST_LIMITS.map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <span aria-hidden className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-ga-pill bg-ga-yellow" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* Bảng nhận diện thương hiệu v3.4 */}
        <section className="mt-10 rounded-ga-xl border border-ga-border bg-ga-card p-5 shadow-ga-sm sm:p-7">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <span className="text-ga-eyebrow uppercase text-ga-muted">Nhận diện thương hiệu chính thức</span>
              <h2 className="mt-1 font-ga-display text-ga-m-h3 font-medium text-ga-ink">
                myDeutschFlow · Learn German. Find Your Flow.
              </h2>
            </div>
            <span className="text-ga-caption text-ga-muted">Biểu tượng chữ D đa giác · Ba sắc độ Đức hiện đại</span>
          </div>
          <div className="mt-4 overflow-hidden rounded-ga-lg border border-ga-border bg-ga-bg">
            <Image
              src={PUBLIC_V3_ASSETS.brandIdentitySheetV3}
              alt="Bảng nhận diện thương hiệu chính thức myDeutschFlow: biểu tượng chữ D đa giác, chấm vàng, mũi tên đỏ và bốn giá trị Hiệu quả, Tiến bộ, Giao tiếp, Kết nối"
              sizes="(min-width: 960px) 860px, 100vw"
              className="block h-auto w-full"
            />
          </div>
        </section>

        <h2 className={H2}>Các tính năng chính</h2>

        <h3 className={H3}>Câu hỏi theo đúng nghề</h3>
        <p className={P}>
          Mỗi nghề có trang riêng với câu hỏi tiêu biểu và từ chuyên môn, ví dụ <Link href="/phong-van/koch/" className={A}>nghề bếp</Link> hay <Link href="/phong-van/pflegefachkraft/" className={A}>điều dưỡng</Link>. Mỗi câu hỏi mang nhãn rõ ràng: <strong>Đã duyệt</strong> (đã có người kiểm), <strong>AI tạo</strong> (đang chờ duyệt), hoặc <strong>Bộ câu hỏi chung</strong>. Xem <Link href="/phong-van/" className={A}>tất cả nghề</Link>.
        </p>

        <h3 className={H3}>Báo cáo sau mỗi buổi phỏng vấn</h3>
        <p className={P}>Báo cáo chấm từng phần của buổi (giới thiệu, tình huống, chuyên môn), trích lại câu bạn đã nói, đưa câu nên nói với lời giải thích rõ lý do, và gợi ý bài luyện tiếp theo. Ví dụ minh hoạ cho vị trí Koch/Köchin: 68/100, &ldquo;gần sẵn sàng, cần luyện thêm phần tình huống&rdquo;. Ví dụ một lỗi hay gặp mà báo cáo chỉ ra:</p>
        <div className="mt-4 grid gap-3 rounded-ga-xl border border-ga-border bg-ga-card p-5 shadow-ga-sm sm:grid-cols-2">
          <div className="rounded-ga-md border border-ga-border bg-ga-red-soft p-4">
            <div className="text-ga-eyebrow uppercase text-ga-red">Bạn đã nói</div>
            <p lang="de" className="mt-1.5 text-ga-body text-ga-muted line-through decoration-ga-red">„Letztes Jahr ich habe in einem Restaurant in Hanoi gearbeitet …“</p>
          </div>
          <div className="rounded-ga-md border border-ga-border bg-ga-green-soft p-4">
            <div className="text-ga-eyebrow uppercase text-ga-green">Nên nói</div>
            <p lang="de" className="mt-1.5 text-ga-body font-semibold text-ga-ink">„Letztes Jahr habe ich in einem Restaurant in Hanoi gearbeitet …“</p>
          </div>
          <p className="text-ga-small text-ga-muted sm:col-span-2">
            <strong className="font-semibold text-ga-ink">Giải thích:</strong> Câu mở đầu bằng trạng từ thời gian thì động từ chia đứng ở vị trí thứ hai.
          </p>
        </div>
        <p className={P}>AI đánh dấu những từ chưa nghe rõ trong câu trả lời của bạn. Đây chưa phải phân tích phát âm từng âm. Điểm dùng để bạn theo dõi tiến bộ, không thay cho kỳ thi thật.</p>

        <h3 className={H3}>Lộ trình A1–B1 và ôn từ vựng</h3>
        <p className={P}>Lộ trình học từng ngày từ A1 đến B1, mỗi chặng có bốn kỹ năng nghe, đọc, nói, viết. Tiến độ hiện thành cây lộ trình: chặng đã xong mọc thành lá, chặng đang học là bông hoa. Thẻ từ vựng quay lại đúng lúc bạn sắp quên. B2 đang được xây dựng.</p>

        <h3 className={H3}>Thi thử telc B1</h3>
        <p className={P}>
          Luyện đủ 4 phần thi telc Deutsch B1 theo đúng thời gian và cấu trúc đề, đi cùng phân tích điểm yếu sau mỗi lần làm. Bài Viết bạn gõ trực tiếp, AI chấm theo ba tiêu chí của telc. Phần chấm Nói đang ở giai đoạn Beta, điểm chỉ để tham khảo. Đề thi thử mô phỏng cấu trúc đề telc B1, không liên kết với telc và không thay cho chứng chỉ. Xem <Link href="/luyen-thi/" className={A}>cấu trúc từng kỳ thi</Link> hoặc <Link href="/free-grade/" className={A}>chấm thử một bài viết tiếng Đức miễn phí</Link>.
        </p>

        <h2 className={H2}>Mỗi con đường sang Đức cần luyện gì?</h2>
        <p className={P}>
          Bảng dưới là mức thường gặp. Yêu cầu thật tuỳ chương trình, nhà tuyển dụng và cơ quan cấp thị thực; hãy kiểm tra tại nguồn chính thức như Đại sứ quán Đức tại Việt Nam (vietnam.diplo.de) và cổng Make it in Germany (make-it-in-germany.com).
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {PATHWAYS.map((p) => (
            <section key={p.name} className="rounded-ga-xl border border-ga-border bg-ga-card p-5 shadow-ga-sm">
              <h3 className="font-ga-display text-ga-m-h3 font-medium text-ga-ink">{p.name}</h3>
              <dl className="mt-3 flex flex-col gap-2 text-ga-small">
                <div>
                  <dt className="text-ga-caption text-ga-muted">Trình độ thường cần</dt>
                  <dd className="font-medium text-ga-ink">{p.level}</dd>
                </div>
                <div>
                  <dt className="text-ga-caption text-ga-muted">Kỳ thi</dt>
                  <dd className="text-ga-ink">{p.exam}</dd>
                </div>
                <div>
                  <dt className="text-ga-caption text-ga-muted">Phỏng vấn xoay quanh</dt>
                  <dd className="text-ga-ink">{p.interview}</dd>
                </div>
                <div className="border-t border-ga-border pt-2">
                  <dt className="text-ga-caption text-ga-muted">Trên myDeutschFlow</dt>
                  <dd className="font-medium text-ga-ink">{p.fit}</dd>
                </div>
              </dl>
            </section>
          ))}
        </div>
        {guides.length > 0 && (
          <ul className="mt-6 flex flex-col gap-2">
            {guides.map((g) => (
              <li key={g.slug}>
                <Link href={`/cam-nang/${g.slug}/`} className={`text-ga-body ${A}`}>
                  Cẩm nang thực chiến: {g.title} →
                </Link>
              </li>
            ))}
          </ul>
        )}

        <h2 className={H2}>Bắt đầu trong vài phút</h2>
        <div className="rounded-ga-xl border border-ga-border bg-ga-card p-6 shadow-ga-sm sm:p-7">
          <ol className="flex list-decimal flex-col gap-2.5 pl-5 text-ga-m-prose text-ga-ink">
            <li>
              Mở mydeutschflow.com hoặc tải <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer" className={A}>ứng dụng iPhone trên App Store</a> (miễn phí tải, iOS 15.1 trở lên). Web và app dùng chung một tài khoản.
            </li>
            <li>Gõ tên nghề vào ô &ldquo;Bạn làm nghề gì?&rdquo; và xem câu hỏi mẫu.</li>
            <li>Bấm Học thử miễn phí. Không cần thanh toán trước.</li>
            <li>Trả lời bằng giọng nói, đọc báo cáo sau buổi, rồi làm bài luyện được gợi ý.</li>
          </ol>
          <p className="mt-4 text-ga-small text-ga-muted">Nếu bạn mới bắt đầu: lộ trình bắt đầu từ A1, và luyện phỏng vấn theo nghề phù hợp nhất từ khoảng A2.</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <GaBtn asChild variant="yellow" size="lg" className="ga-btn-gleam w-full sm:w-auto">
              <Link href={START_HREF}>
                Học thử miễn phí
                <ArrowRight size={16} aria-hidden />
              </Link>
            </GaBtn>
            <GaBtn asChild variant="ghost" size="lg" className="w-full sm:w-auto">
              <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer">Tải ứng dụng iPhone</a>
            </GaBtn>
          </div>
        </div>

        <h2 className={H2}>Dành cho trung tâm và giáo viên tiếng Đức</h2>
        <p className={P}>
          Giáo viên giao bài nói cho cả lớp bằng một chủ đề, học viên làm trên điện thoại ngoài giờ học, AI chấm nháp. Giáo viên nghe bản ghi âm, đọc bài viết (cả ảnh bài viết tay) rồi chốt điểm. Kết quả thành phiếu gửi gia đình bằng tiếng Việt, Anh hoặc Đức. Giáo viên tự do dùng miễn phí; trung tâm có thể <Link href="/trung-tam/" className={A}>đặt lịch demo 20 phút</Link>.
        </p>
        <p className={P}>Tính năng cho nhà tuyển dụng ở Đức (xem hồ sơ luyện nói của ứng viên) là Sắp có.</p>

        <h2 className={H2}>Chi phí và thiết bị</h2>
        <p className={P}>
          Bắt đầu miễn phí, không cần thanh toán trước, dùng thử 7 ngày khi đăng ký; chi tiết các gói ở trang <Link href="/chi-phi/" className={A}>Chi phí</Link>. Dùng trên trình duyệt web (máy tính và điện thoại) và ứng dụng iPhone (iOS 15.1 trở lên); máy Android dùng bản web. Trang web có giao diện tiếng Việt, tiếng Anh và tiếng Đức.
        </p>

        <h2 className={H2}>Câu hỏi thường gặp</h2>
        <div className="flex flex-col gap-3">
          {FAQS.map((f, idx) => (
            <details
              key={f.q}
              open={idx === 0}
              className="group rounded-ga-lg border border-ga-border bg-ga-card p-5 shadow-ga-sm"
            >
              <summary className="cursor-pointer list-none font-semibold text-ga-ink">
                <span className="flex items-center justify-between gap-3">
                  <span>{f.q}</span>
                  <span aria-hidden className="text-ga-muted transition-transform group-open:rotate-45">+</span>
                </span>
              </summary>
              <p className="mt-3 border-t border-ga-border pt-3 text-ga-body text-ga-muted">{f.a}</p>
            </details>
          ))}
        </div>
        <p className="mt-5 text-ga-small text-ga-muted">Chi tiết về dữ liệu cá nhân: <Link href="/privacy/" className={A}>Chính sách bảo mật</Link>.</p>
      </article>
    </PublicShell>
  )
}
