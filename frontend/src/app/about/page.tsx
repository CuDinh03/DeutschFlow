import type { Metadata } from 'next'
import Link from 'next/link'
import '@/styles/galerie.css'
import { GaLogo, GaBtn, GaCap } from '@/components/ui-v2'

export const metadata: Metadata = {
  title: 'Về chúng tôi · myDeutschFlow',
  description:
    'myDeutschFlow là một dự án cá nhân của Đinh Huy Cự — một lập trình viên đang tự học tiếng Đức, xây công cụ mình cần cho hành trình sang Đức.',
}

const YellowSq = ({ dark = false }: { dark?: boolean }) => (
  <span className={`inline-block h-[7px] w-[7px] shrink-0 ${dark ? 'bg-ga-ink' : 'bg-ga-yellow'}`} />
)

// Founder values — [title, body]. Honest, first-person, no corporate voice.
const VALUES: [string, string][] = [
  [
    'Của người trong cuộc',
    'Mình cũng đang học tiếng Đức và chuẩn bị phỏng vấn. Mỗi tính năng ra đời từ một nhu cầu thật, không phải phỏng đoán.',
  ],
  [
    'Thành thật',
    'Không hứa hẹn viển vông. Cái gì làm được thì nói làm được; cái gì chưa có thì đang làm.',
  ],
  [
    'Lắng nghe',
    'Chỉ có một người phía sau, nên mình đọc và trả lời từng email. Góp ý của bạn trực tiếp định hình sản phẩm.',
  ],
]

// Footer legal/support links — mirrors the landing footer.
const FOOTER_LINKS: [string, string][] = [
  ['Chính sách bảo mật', '/privacy'],
  ['Điều khoản sử dụng', '/terms'],
  ['Hỗ trợ', '/support'],
]

export default function AboutPage() {
  return (
    <div className="ga-scope">
      <main className="min-h-screen bg-ga-bg font-ga-ui text-ga-ink">
        {/* Nav — brand left, CTA right (mirrors the landing / legal header) */}
        <nav className="sticky top-0 z-50 flex h-[78px] items-center justify-between border-b border-ga-border bg-ga-bg/90 px-6 backdrop-blur-md md:px-[60px]">
          <Link href="/" aria-label="myDeutschFlow" className="transition-opacity hover:opacity-80">
            <GaLogo />
          </Link>
          <div className="flex items-center gap-5">
            <Link href="/" className="hidden text-[14.5px] font-semibold text-ga-ink hover:opacity-80 sm:inline">
              Trang chủ
            </Link>
            <GaBtn asChild variant="ink" size="lg">
              <Link href="/v2/register">
                <YellowSq />
                Học thử miễn phí
              </Link>
            </GaBtn>
          </div>
        </nav>

        {/* Hero — editorial intro */}
        <header className="mx-auto max-w-[1080px] px-6 pb-16 pt-20 md:px-[60px] md:pb-24 md:pt-28">
          <GaCap className="mb-6">Về chúng tôi</GaCap>
          <h1 className="max-w-[16ch] font-ga-display text-[38px] font-medium leading-[1.08] tracking-[-0.02em] text-ga-ink md:text-[64px]">
            Tôi xây myDeutschFlow vì <span className="italic">chính tôi</span> cần nó.
          </h1>
          <p className="mt-8 max-w-[54ch] text-[17px] leading-[1.7] text-ga-muted md:text-[19px]">
            Không có công ty lớn phía sau. Chỉ có một người Việt đang tự học tiếng Đức, làm ra công
            cụ mà mình ước có trên hành trình này.
          </p>
        </header>

        {/* Story */}
        <section className="border-t border-ga-border">
          <div className="mx-auto grid max-w-[1080px] gap-x-16 gap-y-8 px-6 py-16 md:grid-cols-[220px_1fr] md:px-[60px] md:py-20">
            <GaCap className="md:pt-1">Câu chuyện</GaCap>
            <div className="max-w-[62ch] space-y-6 text-[16.5px] leading-[1.75] text-ga-ink/85 md:text-[18px]">
              <p>
                Mình là <strong className="font-semibold text-ga-ink">Đinh Huy Cự</strong>, một lập
                trình viên đang tự học tiếng Đức để tìm cơ hội mới ở Đức. Giống nhiều bạn khác, mình
                học không phải để thi cho vui — mà để thật sự sống, làm việc và phỏng vấn được bằng
                tiếng Đức.
              </p>
              <p>
                Trên hành trình đó, mình nhận ra một khoảng trống: người Việt học tiếng Đức có rất
                nhiều tài liệu, nhưng gần như không có chỗ nào để{' '}
                <strong className="font-semibold text-ga-ink">
                  luyện nói và luyện phỏng vấn đúng ngành
                </strong>{' '}
                một cách an toàn, có phản hồi chuyên môn, và hiểu được văn hóa tuyển dụng của người
                Đức.
              </p>
              <p>
                Nên mình tự xây myDeutschFlow — đúng công cụ mình đang cần: AI đóng vai HR người Đức
                phỏng vấn đúng ngành, chấm phát âm – ngữ pháp – nội dung từng câu trả lời, lộ trình
                học từ A1 đến C1, và luyện thi Goethe sát đề thật.
              </p>
              <p>
                Đây là một <strong className="font-semibold text-ga-ink">dự án cá nhân</strong>,
                không phải sản phẩm của một tập đoàn. Điều đó có nghĩa là: mình dùng chính sản phẩm
                này mỗi ngày, đọc từng phản hồi và sửa nhanh. Nếu bạn cũng đang trên con đường sang
                Đức, hy vọng nó giúp được bạn như đang giúp chính mình.
              </p>
            </div>
          </div>
        </section>

        {/* Values */}
        <section className="border-t border-ga-border">
          <div className="mx-auto max-w-[1080px] px-6 py-16 md:px-[60px] md:py-20">
            <GaCap className="mb-10">Điều mình quan tâm</GaCap>
            <div className="grid gap-px overflow-hidden border border-ga-border bg-ga-border md:grid-cols-3">
              {VALUES.map(([title, body]) => (
                <div key={title} className="bg-ga-bg p-7 md:p-9">
                  <YellowSq />
                  <h3 className="mt-5 font-ga-display text-[22px] font-medium text-ga-ink md:text-[24px]">
                    {title}
                  </h3>
                  <p className="mt-3 text-[15px] leading-[1.65] text-ga-muted">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Sign-off + contact */}
        <section className="border-t border-ga-border">
          <div className="mx-auto max-w-[1080px] px-6 py-16 md:px-[60px] md:py-20">
            <p className="font-ga-display text-[26px] font-medium italic leading-[1.3] text-ga-ink md:text-[32px]">
              — Đinh Huy Cự
            </p>
            <GaCap className="mt-2">Người làm myDeutschFlow</GaCap>
            <p className="mt-8 max-w-[54ch] text-[16px] leading-[1.7] text-ga-muted">
              Có câu hỏi hay góp ý? Viết cho mình:{' '}
              <a
                href="mailto:dinhhuycu0305@gmail.com"
                className="font-medium text-ga-ink underline underline-offset-2 hover:opacity-80"
              >
                dinhhuycu0305@gmail.com
              </a>{' '}
              — hoặc xem trang{' '}
              <Link href="/support" className="font-medium text-ga-ink underline underline-offset-2 hover:opacity-80">
                Hỗ trợ
              </Link>
              .
            </p>
          </div>
        </section>

        {/* CTA band */}
        <section className="bg-ga-ink text-ga-bg">
          <div className="mx-auto grid max-w-[1080px] items-center gap-[40px] px-6 py-16 md:grid-cols-[1fr_auto] md:px-[60px] md:py-[72px]">
            <div>
              <GaCap className="mb-[18px] text-[#76716A]">Bắt đầu ngay hôm nay</GaCap>
              <h2 className="max-w-[18ch] font-ga-display text-[34px] font-medium leading-[1.12] md:text-[46px]">
                Sẵn sàng cho hành trình tiếng Đức của bạn?
              </h2>
            </div>
            <GaBtn asChild variant="yellow" size="lg">
              <Link href="/v2/register">
                <YellowSq dark />
                Học thử miễn phí
              </Link>
            </GaBtn>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-ga-border bg-ga-bg">
          <div className="mx-auto flex max-w-[1080px] flex-col gap-6 px-6 py-12 md:flex-row md:items-center md:justify-between md:px-[60px]">
            <GaLogo />
            <nav aria-label="Liên kết pháp lý" className="flex flex-wrap items-center gap-x-7 gap-y-2">
              {FOOTER_LINKS.map(([label, href]) => (
                <Link
                  key={href}
                  href={href}
                  className="text-[14px] font-medium text-ga-muted transition-colors hover:text-ga-ink"
                >
                  {label}
                </Link>
              ))}
            </nav>
            <p className="text-[12.5px] text-ga-faint">© {new Date().getFullYear()} myDeutschFlow</p>
          </div>
        </footer>
      </main>
    </div>
  )
}
