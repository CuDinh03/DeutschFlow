import '@/styles/galerie.css'
import type { Metadata } from 'next'
import Link from 'next/link'
import { GUIDE_ARTICLES } from '@/data/camNang'
import { absoluteUrl, SITE_URL } from '@/lib/siteUrl'
import { ogImage } from '@/lib/ogImage'
import { breadcrumbStructuredData } from '@/lib/homeStructuredData'
import { PAGE_LASTMOD } from '@/lib/sitemapDates'
import { GaBtn } from '@/components/ui-v2/GaBtn'
import { LandingHeader } from '@/components/landing-v2/LandingHeader'
import { LandingFooter } from '@/components/landing-v2/LandingFooter'
import { START_HREF } from '@/components/landing-v2/links'
import { DESCRIPTION, FAQS, FOUNDER, H1, PATH, PATHWAYS, TITLE } from '@/data/whatIsPage'

/**
 * "myDeutschFlow là gì?" — `/mydeutschflow-la-gi/` (13/11/2026), trang giới thiệu cho truy vấn thương hiệu.
 * Chỉ tiếng Việt. Owner duyệt hướng viết 13/11/2026: tên người sáng lập Đinh Huy Cự, không ghi giá
 * gói trả phí (giá đổi), đặt ở trang riêng.
 *
 * Luật nội dung (sổ lời hứa): mọi khẳng định về sản phẩm lấy từ catalog trang chủ
 * (`messages/v2/landing.vi.json`: hero, report, exam, learn, pathways, partners, faq, app) và giữ đủ
 * các lưu ý của trang chủ (chấm Nói Beta, B2 đang xây dựng, chưa có C1, đề thi nghề nghiệp đang biên
 * soạn, tính năng nhà tuyển dụng sắp có). Không hứa đỗ visa, không số liệu người dùng, không giá.
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

/** Bài Cẩm nang liên quan — chỉ dẫn tới bài đã đăng (bài nháp không có trong `GUIDE_ARTICLES`). */
const RELATED_GUIDES = ['phong-van-du-hoc-nghe-duc', 'gioi-thieu-ban-than-bang-tieng-duc', 'phong-van-tieng-duc-nghe-bep']

const YellowSq = () => <span className="inline-block h-[7px] w-[7px] shrink-0 bg-ga-yellow" />
const H2 = 'mb-5 mt-14 font-ga-display text-ga-h2 font-medium text-ga-ink sm:text-[32px]'
const H3 = 'mb-2 mt-8 text-ga-h3 text-ga-ink'
const P = 'mt-3 text-ga-body-lg text-ga-ink'
const A = 'underline decoration-ga-yellow decoration-2 underline-offset-4 hover:decoration-ga-ink'

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
    <div className="ga-scope min-h-screen overflow-x-clip bg-ga-bg font-ga-ui text-ga-ink">
      <LandingHeader current="none" showLanguage={false} />
      <main className="mx-auto max-w-[860px] px-5 pb-16 pt-10 sm:px-8 md:pt-14">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, '\\u003c') }} />
        <article>
          <div className="mb-[18px] inline-flex items-center gap-2 text-ga-eyebrow uppercase text-ga-muted">
            <YellowSq />Giới thiệu
          </div>
          <h1 className="font-ga-display text-ga-h1-m font-medium leading-[1.1] sm:text-ga-h1">{H1}</h1>
          <p className="mt-5 text-ga-body-lg text-ga-muted">
            Nhiều người học tiếng Đức chia động từ đúng trên giấy, nhưng khi nhà tuyển dụng hỏi một câu về chính công việc của mình thì không biết bắt đầu từ đâu. Phỏng vấn đòi một kỹ năng khác với làm bài thi: nói thành câu, theo trình tự, về đúng chuyên môn của mình, ngay lúc đó.
          </p>
          <p className="mt-3 text-ga-small text-ga-muted">
            Cập nhật <time dateTime={PAGE_LASTMOD['/mydeutschflow-la-gi']}>{PAGE_LASTMOD['/mydeutschflow-la-gi'].split('-').reverse().join('/')}</time>
          </p>

          <h2 className={H2}>myDeutschFlow là gì?</h2>
          <p className={P}>
            <strong>myDeutschFlow</strong> là công cụ luyện phỏng vấn xin việc bằng tiếng Đức cho người Việt chuẩn bị sang Đức làm việc, dùng được trên web (mydeutschflow.com) và ứng dụng iPhone. AI đóng vai nhà tuyển dụng Đức, hỏi theo nghề bạn chọn, rồi chỉ ra chỗ cần sửa sau mỗi câu trả lời: ngữ pháp, từ dùng chưa đúng, ý còn thiếu.
          </p>
          <p className={P}>Ngoài phỏng vấn, nền tảng có lộ trình học tiếng Đức từ A1 đến B1, thi thử theo format Goethe và telc, và công cụ cho trung tâm, giáo viên tiếng Đức.</p>
          <p className={P}>
            myDeutschFlow do <Link href="/about/" className={A}>{FOUNDER}</Link> phát triển. Người sáng lập cũng đang học tiếng Đức và chuẩn bị phỏng vấn; mỗi tính năng ra đời từ một nhu cầu thật, không phải phỏng đoán.
          </p>

          <h3 className={H3}>Vì sao học giỏi ngữ pháp vẫn có thể lúng túng khi phỏng vấn?</h3>
          <p className={P}>
            Bài thi kiểm tra bạn hiểu và viết đúng. Buổi phỏng vấn kiểm tra bạn kể được việc mình đã làm, xử lý tình huống thế nào, vì sao chọn nghề này, bằng tiếng Đức và trong thời gian thực. Hai kỹ năng này cần luyện riêng, và luyện nói theo tình huống nghề nghiệp thường là phần ít được luyện nhất khi tự học.
          </p>

          <h3 className={H3}>myDeutschFlow luyện phỏng vấn như thế nào?</h3>
          <p className={P}>
            Bạn gõ tên nghề vào ô <strong>&ldquo;Bạn làm nghề gì?&rdquo;</strong>. Nghề đã có bộ câu hỏi riêng sẽ hiện ngay câu hỏi mẫu; nghề chưa có thì AI dùng bộ câu hỏi chung, điều chỉnh theo vị trí bạn nhập. Buổi luyện bắt đầu bằng lời mời giới thiệu bản thân, rồi tới câu hỏi về kinh nghiệm, tình huống và chuyên môn. Bạn trả lời bằng giọng nói; câu trả lời được chuyển thành chữ để AI chấm và nhận xét.
          </p>

          <h2 className={H2}>Các tính năng chính</h2>

          <h3 className={H3}>Câu hỏi theo đúng nghề</h3>
          <p className={P}>
            Mỗi nghề có trang riêng với câu hỏi tiêu biểu và từ chuyên môn, ví dụ <Link href="/phong-van/koch/" className={A}>nghề bếp</Link> hay <Link href="/phong-van/pflegefachkraft/" className={A}>điều dưỡng</Link>. Mỗi câu hỏi mang nhãn rõ ràng: <strong>Đã duyệt</strong> (đã có người kiểm), <strong>AI tạo</strong> (đang chờ duyệt), hoặc <strong>Bộ câu hỏi chung</strong>. Xem <Link href="/phong-van/" className={A}>tất cả nghề</Link>.
          </p>

          <h3 className={H3}>Báo cáo sau mỗi buổi phỏng vấn</h3>
          <p className={P}>Báo cáo chấm từng phần của buổi (giới thiệu, tình huống, chuyên môn), trích lại câu bạn đã nói, đưa câu nên nói kèm lý do, và gợi ý bài luyện tiếp theo. Ví dụ minh hoạ cho vị trí Koch/Köchin: 68/100, &ldquo;gần sẵn sàng, cần luyện thêm phần tình huống&rdquo;. Một lỗi quen thuộc báo cáo bắt được:</p>
          <div className="mt-4 border border-ga-border bg-ga-card p-4 sm:p-5">
            <div className="text-ga-caption text-ga-muted">Bạn đã nói</div>
            <p lang="de" className="mt-1 text-ga-body text-ga-muted line-through decoration-ga-red">„Letztes Jahr ich habe in einem Restaurant in Hanoi gearbeitet …“</p>
            <div className="mt-3 text-ga-caption text-ga-muted">Nên nói</div>
            <p lang="de" className="mt-1 text-ga-body font-semibold text-ga-ink">„Letztes Jahr habe ich in einem Restaurant in Hanoi gearbeitet …“</p>
            <p className="mt-2 text-ga-small text-ga-muted">Câu mở đầu bằng trạng từ thời gian thì động từ chia đứng ở vị trí thứ hai.</p>
          </div>
          <p className={P}>AI cho biết những từ nó nghe chưa rõ trong câu trả lời của bạn; đây chưa phải phân tích phát âm chi tiết từng âm. Điểm dùng để bạn theo dõi tiến bộ, không thay cho kỳ thi thật.</p>

          <h3 className={H3}>Lộ trình A1–B1 và ôn từ vựng</h3>
          <p className={P}>Lộ trình học từng ngày từ A1 đến B1, mỗi chặng có bốn kỹ năng nghe, đọc, nói, viết. Tiến độ hiện thành cây lộ trình: chặng đã xong mọc thành lá, chặng đang học là bông hoa. Từ vựng được nhắc lại theo cách lặp lại ngắt quãng, đúng lúc bạn sắp quên. B2 đang được xây dựng.</p>

          <h3 className={H3}>Thi thử theo format Goethe và telc</h3>
          <p className={P}>
            Luyện đủ 4 phần thi Goethe-Zertifikat A2–B2 và telc B1 theo đúng thời gian và cấu trúc đề, kèm phân tích điểm yếu sau mỗi lần làm. Bài Viết nộp qua ảnh để AI chấm bố cục và ngữ pháp. Phần chấm Nói đang ở giai đoạn Beta, điểm chỉ để tham khảo. Đề thi thử mô phỏng format, không liên kết với Goethe-Institut hay telc và không thay cho chứng chỉ. Xem <Link href="/luyen-thi/" className={A}>cấu trúc từng kỳ thi</Link> hoặc <Link href="/free-grade/" className={A}>chấm thử bài Schreiben B1 miễn phí</Link>.
          </p>

          <h2 className={H2}>Mỗi con đường sang Đức cần luyện gì?</h2>
          <p className={P}>
            Bảng dưới là mức thường gặp. Yêu cầu thật tuỳ chương trình, nhà tuyển dụng và cơ quan cấp thị thực; hãy kiểm tra tại nguồn chính thức như Đại sứ quán Đức tại Việt Nam (vietnam.diplo.de) và cổng Make it in Germany (make-it-in-germany.com).
          </p>
          <div className="mt-6 flex flex-col gap-4">
            {PATHWAYS.map((p) => (
              <section key={p.name} className="border border-ga-border bg-ga-card p-4 sm:p-5">
                <h3 className="text-ga-h3 text-ga-ink">{p.name}</h3>
                <dl className="mt-2 grid gap-x-6 gap-y-1 text-ga-small sm:grid-cols-[160px_minmax(0,1fr)]">
                  <dt className="text-ga-muted">Trình độ thường cần</dt><dd className="text-ga-ink">{p.level}</dd>
                  <dt className="text-ga-muted">Kỳ thi</dt><dd className="text-ga-ink">{p.exam}</dd>
                  <dt className="text-ga-muted">Phỏng vấn xoay quanh</dt><dd className="text-ga-ink">{p.interview}</dd>
                  <dt className="text-ga-muted">Trên myDeutschFlow</dt><dd className="text-ga-ink">{p.fit}</dd>
                </dl>
              </section>
            ))}
          </div>
          {guides.length > 0 && (
            <ul className="mt-6 flex flex-col gap-2">
              {guides.map((g) => (
                <li key={g.slug}><Link href={`/cam-nang/${g.slug}/`} className={`text-ga-body text-ga-ink ${A}`}>Cẩm nang: {g.title}</Link></li>
              ))}
            </ul>
          )}

          <h2 className={H2}>Bắt đầu trong vài phút</h2>
          <ol className="flex list-decimal flex-col gap-2 pl-5 text-ga-body-lg text-ga-ink">
            <li>Mở mydeutschflow.com hoặc tải ứng dụng iPhone trên App Store (miễn phí tải, iOS 15.1 trở lên). Web và app dùng chung một tài khoản.</li>
            <li>Gõ tên nghề vào ô &ldquo;Bạn làm nghề gì?&rdquo; và xem câu hỏi mẫu.</li>
            <li>Bấm Học thử miễn phí. Không cần thẻ.</li>
            <li>Trả lời bằng giọng nói, đọc báo cáo sau buổi, rồi làm bài luyện được gợi ý.</li>
          </ol>
          <p className={P}>Nếu bạn mới bắt đầu: lộ trình bắt đầu từ A1, và luyện phỏng vấn theo nghề phù hợp nhất từ khoảng A2.</p>
          <div className="mt-6">
            <GaBtn asChild variant="ink" size="lg" className="w-full sm:w-auto">
              <Link href={START_HREF}><YellowSq />Học thử miễn phí</Link>
            </GaBtn>
          </div>

          <h2 className={H2}>Dành cho trung tâm và giáo viên tiếng Đức</h2>
          <p className={P}>
            Giáo viên giao bài nói cho cả lớp bằng một chủ đề, học viên làm trên điện thoại ngoài giờ học, AI chấm nháp. Giáo viên xem lại và chốt điểm bài viết, chấm được cả ảnh bài viết tay; kết quả thành phiếu gửi gia đình, đọc được bằng tiếng Việt, Anh, Đức. Có gói miễn phí cho giáo viên; trung tâm có thể <Link href="/trung-tam/" className={A}>nhận tư vấn</Link>.
          </p>
          <p className={P}>Với nhà tuyển dụng ở Đức, tính năng xem hồ sơ luyện nói của ứng viên đang chuẩn bị; nền tảng đang tìm đối tác chạy thử.</p>

          <h2 className={H2}>Chi phí và thiết bị</h2>
          <p className={P}>Bắt đầu miễn phí, có hạn mức luyện AI mỗi ngày, không cần thẻ tín dụng; thông tin gói trả phí có trong ứng dụng. Dùng trên trình duyệt web máy tính và ứng dụng iPhone (iOS 15.1 trở lên). Trang web có giao diện tiếng Việt, tiếng Anh và tiếng Đức.</p>

          <h2 className={H2}>Câu hỏi thường gặp</h2>
          <div className="border-t border-ga-border">
            {FAQS.map((f) => (
              <div key={f.q} className="border-b border-ga-border py-4">
                <h3 className="text-ga-h3 text-ga-ink">{f.q}</h3>
                <p className="mt-2 text-ga-body text-ga-muted">{f.a}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-ga-small text-ga-muted">Chi tiết về dữ liệu: <Link href="/privacy/" className={A}>Chính sách bảo mật</Link>.</p>
        </article>
      </main>
      <LandingFooter />
    </div>
  )
}
