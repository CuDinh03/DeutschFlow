'use client'

import * as React from 'react'
import Link from 'next/link'
import { GaLogo, GaBtn, GaCap } from '@/components/ui-v2'

/**
 * /v2 — public marketing landing (proto GaLanding, proto-landing.jsx + proto-landing-sections.jsx).
 * Full-bleed (no role shell). CTAs route to the real /v2/register · /v2/login · /v2/teacher.
 * Editorial Galerie style: 1px-divided grids, Newsreader display, yellow brand accent.
 */

const YellowSq = ({ dark = false }: { dark?: boolean }) => (
  <span className={`inline-block h-[7px] w-[7px] shrink-0 ${dark ? 'bg-ga-ink' : 'bg-ga-yellow'}`} />
)

const NAV_LINKS: [string, string][] = [
  ['Tính năng', 'features'],
  ['Lộ trình học', 'learning-path'],
  ['Luyện thi', 'exam'],
  ['Dành cho giáo viên', 'teachers'],
]

const PAINS = [
  { title: 'Warum wollen Sie bei uns arbeiten?', body: 'Câu hỏi này đơn giản nhưng hàng ngàn ứng viên Việt trả lời sai hoàn toàn — vì không hiểu văn hóa phỏng vấn Đức.' },
  { title: 'Phát âm rõ khi bình tĩnh, mất khi căng thẳng', body: 'Luyện một mình không ai sửa lỗi. Đến lúc phỏng vấn thật, áp lực khiến bạn phát âm sai những gì đã thuộc.' },
  { title: 'Không biết HR Đức kỳ vọng gì', body: 'Người Đức đánh giá cao sự chuẩn bị, độ chính xác và thái độ thẳng thắn — rất khác cách phỏng vấn ở Việt Nam.' },
  { title: 'Không có chỗ luyện tập an toàn', body: 'Bạn không thể mắc lỗi với HR thật. Luyện với bạn bè thiếu phản hồi chuyên môn và ngữ cảnh tiếng Đức.' },
]
const HOW = [
  { n: '01', title: 'Chọn ngành và cấp độ', body: 'Điền ngành nghề và trình độ tiếng Đức. AI tạo bộ câu hỏi phỏng vấn đúng ngành, từ A2 đến C1.' },
  { n: '02', title: 'Phỏng vấn với AI HR người Đức', body: 'AI đóng vai người phỏng vấn Đức, hỏi bằng tiếng Đức, điều chỉnh tốc độ và độ phức tạp theo bạn.' },
  { n: '03', title: 'Nhận phân tích chi tiết', body: 'Sau mỗi buổi: điểm ngữ pháp, phát âm, nội dung câu trả lời và gợi ý cải thiện cụ thể.' },
]
const FEATURES = [
  { name: 'Luyện nói AI', de: 'KI-Sprechtraining', accent: 'var(--ga-yellow)', desc: 'AI đóng vai HR người Đức, phỏng vấn đúng ngành của bạn và chấm phát âm, ngữ pháp, nội dung từng câu.' },
  { name: 'Video bài học', de: 'Video-Lektionen', accent: 'var(--ga-green)', desc: 'Hình ảnh + lồng tiếng Đức + phụ đề song ngữ Việt–Đức cho từ vựng, ngữ pháp và nghe hiểu.' },
  { name: 'Từ vựng SRS', de: 'Wortschatz', accent: 'var(--ga-violet)', desc: 'Ôn thẻ đúng thời điểm bằng thuật toán lặp lại ngắt quãng — nhớ lâu hơn, quên ít hơn.' },
  { name: 'Lộ trình cá nhân hóa', de: 'Lernpfad', accent: 'var(--ga-blue)', desc: 'Bài học sắp xếp theo trình độ và mục tiêu của bạn, một con đường rõ ràng từ A1 đến C1.' },
  { name: 'Luyện thi Goethe', de: 'Prüfung', accent: 'var(--ga-orange)', desc: 'Mô phỏng 4 phần thi Lesen, Hören, Schreiben, Sprechen sát đề thật, chấm điểm tự động.' },
  { name: 'Báo cáo tiến độ', de: 'Fortschritt', accent: 'var(--ga-teal)', desc: 'Theo dõi XP, chuỗi ngày học, kỹ năng mạnh yếu và toàn bộ lịch sử hoạt động.' },
]
const PATH_LEVELS = [
  { id: 'A1', name: 'Khởi đầu', de: 'Anfänger', weeks: '6–8 tuần', body: 'Chào hỏi, giới thiệu bản thân, số đếm, câu đơn giản trong đời sống.' },
  { id: 'A2', name: 'Giao tiếp cơ bản', de: 'Grundlagen', weeks: '8 tuần', body: 'Công việc hằng ngày, mua sắm, hẹn gặp, kể về quá khứ với Perfekt.' },
  { id: 'B1', name: 'Tự tin nghề nghiệp', de: 'Beruf', weeks: '10–12 tuần', body: 'Phỏng vấn, môi trường làm việc Pflege, câu phụ với „weil", „dass".', current: true },
  { id: 'B2', name: 'Thành thạo chuyên môn', de: 'Fortgeschritten', weeks: '12 tuần', body: 'Văn viết y khoa, thảo luận, Passiv và cấu trúc câu phức.' },
  { id: 'C1', name: 'Nâng cao', de: 'Kompetent', weeks: '12+ tuần', body: 'Ngôn ngữ học thuật, trình bày và lãnh đạo trong môi trường Đức.' },
]
const EXAM_PARTS = [
  { de: 'Lesen', vi: 'Đọc hiểu', time: '65 phút', body: '5 phần đọc với văn bản đời sống & công việc, chấm tự động ngay.' },
  { de: 'Hören', vi: 'Nghe hiểu', time: '40 phút', body: 'Hội thoại, thông báo và phỏng vấn radio ở tốc độ thi thật.' },
  { de: 'Schreiben', vi: 'Viết', time: '60 phút', body: 'Email và nêu ý kiến — nộp qua ảnh, AI chấm bố cục và ngữ pháp.' },
  { de: 'Sprechen', vi: 'Nói', time: '15 phút', body: 'Phỏng vấn cặp đôi — luyện trực tiếp với AI HR trước ngày thi.' },
]
const TESTIMONIALS = [
  { name: 'Nguyễn Thị Lan', role: 'Điều dưỡng tại Münster', q: 'Sau 3 tuần luyện với DeutschFlow, tôi vượt qua phỏng vấn tại bệnh viện Herz-Jesu ngay lần đầu. HR nói tôi trả lời rất tự nhiên.' },
  { name: 'Trần Văn Hùng', role: 'IT Engineer tại Berlin', q: 'AI hỏi đúng những câu phỏng vấn IT bằng tiếng Đức mà Google không tìm được. Tôi dùng 2 tuần trước ngày phỏng vấn thật.' },
  { name: 'Phạm Thị Mai', role: 'Krankenpflegerin tại Hamburg', q: 'Điểm B2 không cao nhưng vẫn được nhận vì phỏng vấn tốt. Coach AI giúp tôi biết cách nói tự tin.' },
]
const TEACH_VALUE = [
  { t: 'Quản lý lớp học', s: 'Tạo lớp bằng mã, theo dõi tiến độ từng học viên theo thời gian thực.' },
  { t: 'Chấm bài bằng AI', s: 'AI chấm Speaking và nhận bài viết qua ảnh — tiết kiệm hàng giờ mỗi tuần.' },
  { t: 'Tạo tài liệu AI', s: 'Sinh bài tập, quiz và đề kiểm tra theo chủ đề chỉ trong vài giây.' },
  { t: 'Báo cáo tiến độ', s: 'Phân tích điểm mạnh – yếu của lớp và từng cá nhân để dạy đúng trọng tâm.' },
]
const PLANS = [
  { name: 'Miễn phí', price: '0₫', features: ['3 buổi phỏng vấn AI/tháng', 'Phản hồi cơ bản', '1 ngành nghề'], cta: 'Bắt đầu ngay', highlight: false },
  { name: 'Pro', price: '299.000₫', sub: '/tháng', features: ['Không giới hạn phỏng vấn', 'Phân tích phát âm chi tiết', '12 ngành nghề', 'Luyện thi Goethe B1/B2'], cta: 'Dùng thử 7 ngày miễn phí', highlight: true },
  { name: 'Giáo viên', price: 'Liên hệ', features: ['Quản lý lớp học', 'Tạo tài liệu AI', 'Chấm bài Speaking', 'Báo cáo tiến độ học viên'], cta: 'Nhận tư vấn', highlight: false },
]
const INDUSTRIES = [
  {
    id: 'pflege', label: 'Điều dưỡng', de: 'Pflege / Krankenpflege', color: 'var(--ga-red)',
    pitch: 'Ngành thiếu nhân lực nhất nước Đức. Phỏng vấn tập trung vào kinh nghiệm chăm sóc, y đức và cách xử lý tình huống với bệnh nhân.',
    level: 'B1 – B2', topic: 'Krankenhaus & Pflege', roles: 'Krankenpfleger · Altenpfleger · Pflegehelfer',
    questions: ['„Warum möchten Sie als Pflegekraft in Deutschland arbeiten?"', '„Wie gehen Sie mit schwierigen oder dementen Patienten um?"', '„Beschreiben Sie Ihren typischen Arbeitstag im Krankenhaus."'],
    vocab: ['die Pflegekraft', 'die Untersuchung', 'das Medikament', 'der Patient', 'die Behandlung', 'die Krankenversicherung'],
  },
  {
    id: 'it', label: 'CNTT / Kỹ sư', de: 'IT / Ingenieur', color: 'var(--ga-blue)',
    pitch: 'Phỏng vấn kỹ thuật bằng tiếng Đức — bạn cần trình bày dự án, giải thích giải pháp và phối hợp trong nhóm quốc tế.',
    level: 'B1 – B2', topic: 'Fachvokabular IT', roles: 'Softwareentwickler · Systemadmin · Ingenieur',
    questions: ['„Können Sie ein Projekt beschreiben, an dem Sie gearbeitet haben?"', '„Welche Programmiersprachen beherrschen Sie am besten?"', '„Wie lösen Sie technische Konflikte im Team?"'],
    vocab: ['die Programmierung', 'die Schnittstelle', 'die Datenbank', 'der Algorithmus', 'die Anforderung', 'die Bereitstellung'],
  },
  {
    id: 'gastro', label: 'Nhà bếp / F&B', de: 'Gastronomie / Küche', color: 'var(--ga-green)',
    pitch: 'Phỏng vấn cho đầu bếp và phụ bếp — đề cao vệ sinh, quy trình và khả năng làm việc nhanh dưới áp lực.',
    level: 'A2 – B1', topic: 'Gastronomie', roles: 'Koch · Küchenhilfe · Servicekraft',
    questions: ['„Haben Sie Erfahrung in einer professionellen Küche?"', '„Wie halten Sie die Hygienevorschriften (HACCP) ein?"', '„Wie arbeiten Sie unter Zeitdruck im Service?"'],
    vocab: ['die Küche', 'die Hygiene', 'die Zutat', 'das Gericht', 'die Bestellung', 'der Arbeitsplatz'],
  },
  {
    id: 'bau', label: 'Xây dựng', de: 'Bau / Handwerk', color: 'var(--ga-orange)',
    pitch: 'Phỏng vấn cho thợ xây và thợ thủ công — tập trung vào tay nghề, an toàn lao động và đọc bản vẽ kỹ thuật.',
    level: 'A2 – B1', topic: 'Bau & Sicherheit', roles: 'Maurer · Elektriker · Bauhelfer',
    questions: ['„Welche handwerklichen Fähigkeiten bringen Sie mit?"', '„Kennen Sie die Sicherheitsvorschriften auf der Baustelle?"', '„Können Sie technische Zeichnungen lesen?"'],
    vocab: ['die Baustelle', 'die Sicherheit', 'das Werkzeug', 'der Beton', 'die Zeichnung', 'der Schutzhelm'],
  },
]

const SECTION = 'mx-auto max-w-[1240px] px-[60px] py-[78px]'
const H2 = 'font-ga-display text-[44px] font-medium tracking-[-0.015em] text-ga-ink'

export default function V2LandingPage() {
  const [ind, setInd] = React.useState(INDUSTRIES[0])

  return (
    <div className="min-h-screen scroll-smooth bg-ga-bg font-ga-ui text-ga-ink">
      {/* Nav */}
      <nav className="sticky top-0 z-50 flex h-[78px] items-center justify-between border-b border-ga-border bg-ga-bg/90 px-[60px] backdrop-blur-md">
        <GaLogo />
        <div className="hidden gap-9 md:flex">
          {NAV_LINKS.map(([l, id]) => (
            <a key={id} href={`#${id}`} className="text-[14.5px] font-medium text-ga-muted transition-colors hover:text-ga-ink">
              {l}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-5">
          <Link href="/v2/login" className="text-[14.5px] font-semibold text-ga-ink hover:opacity-80">
            Đăng nhập
          </Link>
          <GaBtn asChild variant="ink" size="lg">
            <Link href="/v2/register"><YellowSq />Học thử miễn phí</Link>
          </GaBtn>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto grid max-w-[1240px] items-center gap-20 px-[60px] pb-[72px] pt-[90px] lg:grid-cols-[1.15fr_1fr]">
        <div>
          <div className="mb-[26px] inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-ga-muted">
            <YellowSq />AI Interview Coach · Dành cho người Việt đi Đức
          </div>
          <h1 className="font-ga-display text-[68px] font-medium leading-[1.06] tracking-[-0.02em]">
            Vượt qua phỏng vấn tiếng Đức{' '}
            <em className="italic [background:linear-gradient(transparent_58%,var(--ga-yellow)_58%,var(--ga-yellow)_90%,transparent_90%)]">
              ngay lần đầu.
            </em>
          </h1>
          <p className="mt-[26px] max-w-[520px] text-[18px] leading-[1.7] text-ga-muted">
            AI đóng vai HR người Đức — phỏng vấn đúng ngành của bạn, sửa phát âm và chấm điểm từng câu trả lời theo kỳ vọng của nhà tuyển dụng Đức.
          </p>
          <div className="mt-9 flex gap-3.5">
            <GaBtn asChild variant="ink" size="lg">
              <Link href="/v2/register"><YellowSq />Bắt đầu miễn phí</Link>
            </GaBtn>
            <GaBtn asChild variant="ghost" size="lg">
              <Link href="/v2/login">Xem demo 90 giây</Link>
            </GaBtn>
          </div>
          <div className="mt-[38px] flex flex-wrap gap-6">
            {['2.400+ học viên', '12 ngành nghề', 'Không cần thẻ tín dụng'].map((t) => (
              <span key={t} className="flex items-center gap-1.5 text-[13px] text-ga-muted">
                <span className="inline-block h-[5px] w-[5px] bg-ga-yellow" />{t}
              </span>
            ))}
          </div>
        </div>
        {/* Interview preview card */}
        <div className="border border-ga-border bg-ga-card p-[28px_30px] shadow-[0_8px_48px_rgba(22,21,19,0.07)]">
          <GaCap className="mb-[18px]">Phiên phỏng vấn đang diễn ra</GaCap>
          <div className="mb-[18px] flex items-center gap-3 border-b border-ga-border pb-[18px]">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-ga-ink text-[16px] font-bold text-ga-yellow">S</div>
            <div>
              <div className="text-[15px] font-bold">Frau Schmidt</div>
              <div className="text-[12.5px] text-ga-muted">AI HR · Pflegezentrum Berlin · B1</div>
            </div>
            <span className="ml-auto inline-flex items-center gap-1.5 text-[11.5px] font-bold tracking-[0.04em] text-ga-red">
              <span className="inline-block h-[7px] w-[7px] animate-pulse rounded-full bg-ga-red" />REC
            </span>
          </div>
          <div className="mb-3 bg-ga-bg p-[14px_16px]">
            <GaCap className="mb-[7px] text-ga-subtle">Câu hỏi 3 / 8</GaCap>
            <div className="font-ga-display text-[16px] italic leading-[1.5]">„Warum haben Sie sich entschieden, als Pflegekraft in Deutschland zu arbeiten?“</div>
          </div>
          <div className="mb-[18px] border border-ga-yellow bg-ga-yellow-soft p-[13px_16px]">
            <GaCap className="mb-[7px] text-ga-gold">Bạn đang trả lời…</GaCap>
            <div className="text-[15px] leading-[1.55] text-ga-ink">„Ich möchte meine Fähigkeiten im deutschen Gesundheitssystem erweitern und…“</div>
          </div>
          <div className="grid grid-cols-3">
            {[['Phát âm', '82'], ['Ngữ pháp', '76'], ['Nội dung', '88']].map(([l, v], i) => (
              <div key={l} className={`border-t-2 border-ga-border py-3 text-center ${i ? 'border-l border-l-ga-border' : ''}`}>
                <div className="font-ga-display text-[26px] font-medium">{v}</div>
                <div className="mt-1 text-[11.5px] text-ga-muted">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <div className="grid grid-cols-3 border-y border-ga-border">
        {[['2.400+', 'học viên đang luyện mỗi tuần'], ['92%', 'đậu phỏng vấn trong 2 lần đầu'], ['4.9/5', 'đánh giá từ học viên tại Đức']].map(([n, l], i) => (
          <div key={l} className={`py-8 text-center ${i ? 'border-l border-ga-border' : ''}`}>
            <div className="font-ga-display text-[42px] font-medium">{n}</div>
            <div className="mt-[9px] text-[14px] text-ga-muted">{l}</div>
          </div>
        ))}
      </div>

      {/* Pain points */}
      <section className={SECTION}>
        <GaCap className="mb-[18px]">Vấn đề thực sự</GaCap>
        <h2 className={`${H2} mb-12 max-w-[700px]`}>Tại sao phỏng vấn tiếng Đức khó hơn bạn nghĩ?</h2>
        <div className="grid border border-ga-border sm:grid-cols-2">
          {PAINS.map((p, i) => (
            <div key={i} className={`p-[36px_40px] ${i >= 2 ? 'border-t border-ga-border' : ''} ${i % 2 ? 'sm:border-l sm:border-l-ga-border' : ''}`}>
              <div className="mb-3.5 font-ga-display text-[22px] font-medium italic leading-[1.35]">„{p.title}“</div>
              <p className="text-[15px] leading-[1.72] text-ga-muted">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-ga-border bg-ga-card">
        <div className={SECTION}>
          <GaCap className="mb-[18px]">Cách hoạt động</GaCap>
          <h2 className={`${H2} mb-12`}>Ba bước đến phỏng vấn thành công</h2>
          <div className="grid border border-ga-border md:grid-cols-3">
            {HOW.map((h, i) => (
              <div key={i} className={`p-[36px_40px] ${i ? 'md:border-l md:border-l-ga-border' : ''}`}>
                <div className="mb-5 font-ga-display text-[56px] font-normal leading-none text-[#D8D3C8]">{h.n}</div>
                <div className="mb-3 text-[18px] font-bold">{h.title}</div>
                <p className="text-[15px] leading-[1.72] text-ga-muted">{h.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className={`${SECTION} scroll-mt-[78px]`}>
        <GaCap className="mb-[18px]">Tính năng</GaCap>
        <h2 className={`${H2} mb-3 max-w-[760px]`}>Mọi công cụ để bạn sẵn sàng đi Đức</h2>
        <p className="mb-11 max-w-[560px] text-[17px] leading-[1.6] text-ga-muted">Một nền tảng khép kín — từ luyện nói, học từ, đến luyện thi và theo dõi tiến độ, tất cả cá nhân hóa theo ngành của bạn.</p>
        <div className="grid border border-ga-border md:grid-cols-3">
          {FEATURES.map((f, i) => (
            <div key={f.name} className={`bg-ga-card p-[30px_32px] transition-shadow hover:shadow-[var(--ga-shadow-card-hover)] ${i % 3 ? 'md:border-l md:border-l-ga-border' : ''} ${i >= 3 ? 'md:border-t md:border-t-ga-border' : ''}`}>
              <div className="mb-4 flex items-center gap-3">
                <span className="h-[11px] w-[11px] shrink-0" style={{ background: f.accent }} />
                <span className="text-[18px] font-bold">{f.name}</span>
              </div>
              <div className="mb-3 font-ga-display text-[14px] italic text-ga-subtle">{f.de}</div>
              <p className="text-[14.5px] leading-[1.7] text-ga-muted">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Learning path */}
      <section id="learning-path" className="scroll-mt-[78px] border-y border-ga-border bg-ga-card">
        <div className={SECTION}>
          <GaCap className="mb-[18px]">Lộ trình học</GaCap>
          <h2 className={`${H2} mb-3`}>Từ A1 đến B2 — một con đường rõ ràng</h2>
          <p className="mb-11 max-w-[600px] text-[17px] leading-[1.6] text-ga-muted">
            Phần lớn học viên đi xuất khẩu lao động cần đạt <strong className="text-ga-ink">B1</strong>. Chúng tôi vạch sẵn từng bước và điều chỉnh theo tốc độ của bạn.
          </p>
          <div className="grid grid-cols-2 border border-ga-border md:grid-cols-5">
            {PATH_LEVELS.map((lv, i) => (
              <div key={lv.id} className={`relative p-[28px_26px] ${i ? 'md:border-l md:border-l-ga-border' : ''} ${lv.current ? 'bg-ga-ink text-ga-bg' : ''}`}>
                {lv.current && <div className="absolute inset-x-0 top-0 h-[3px] bg-ga-yellow" />}
                <div className="mb-3.5 flex items-baseline gap-2">
                  <span className={`font-ga-display text-[36px] font-medium leading-none ${lv.current ? 'text-ga-yellow' : 'text-[#D8D3C8]'}`}>{lv.id}</span>
                  {lv.current && <span className="text-[9.5px] font-bold uppercase tracking-[0.1em] text-ga-yellow">Phổ biến</span>}
                </div>
                <div className="mb-1 text-[15.5px] font-bold">{lv.name}</div>
                <div className={`mb-3 font-ga-display text-[12.5px] italic ${lv.current ? 'text-[#A39E94]' : 'text-ga-subtle'}`}>{lv.de} · {lv.weeks}</div>
                <p className={`text-[13px] leading-[1.6] ${lv.current ? 'text-[#A39E94]' : 'text-ga-muted'}`}>{lv.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 flex items-center gap-2.5 text-[14px] text-ga-muted">
            <span className="inline-block h-[7px] w-[7px] bg-ga-yellow" />
            Mục tiêu mặc định: <strong className="text-ga-ink">B2 Goethe-Zertifikat</strong> — bạn có thể đổi bất cứ lúc nào trong hồ sơ.
          </div>
        </div>
      </section>

      {/* Industries — interactive */}
      <section id="industries" className={`${SECTION} scroll-mt-[78px]`}>
        <GaCap className="mb-[18px]">Ngành nghề hỗ trợ</GaCap>
        <h2 className={`${H2} mb-3`}>Đúng ngành của bạn</h2>
        <p className="mb-9 max-w-[580px] text-[17px] leading-[1.6] text-ga-muted">Chọn ngành để xem AI luyện phỏng vấn cho bạn như thế nào — câu hỏi thật bằng tiếng Đức và từ vựng trọng tâm.</p>
        <div className="grid grid-cols-2 border border-ga-border md:grid-cols-4">
          {INDUSTRIES.map((x, i) => {
            const on = x.id === ind.id
            return (
              <button
                key={x.id}
                onClick={() => setInd(x)}
                style={{ borderTopColor: on ? x.color : 'transparent' }}
                className={`border-t-[3px] p-[18px_20px] text-left transition-colors ${i ? 'md:border-l md:border-l-ga-border' : ''} ${on ? 'bg-ga-ink text-ga-bg' : 'bg-ga-card text-ga-ink'}`}
              >
                <span className="mb-2.5 inline-block h-[9px] w-[9px]" style={{ background: x.color }} />
                <div className="mb-1 text-[15.5px] font-bold">{x.label}</div>
                <div className={`font-ga-display text-[12.5px] italic ${on ? 'text-[#A39E94]' : 'text-ga-subtle'}`}>{x.de}</div>
              </button>
            )
          })}
        </div>
        <div className="grid border border-t-0 border-ga-border md:grid-cols-[1fr_1.1fr]">
          <div className="border-ga-border bg-ga-bg p-[28px_32px] md:border-r">
            <div className="mb-3.5 flex items-center gap-2.5">
              <span className="h-[11px] w-[11px] shrink-0" style={{ background: ind.color }} />
              <span className="text-[18px] font-bold">{ind.label}</span>
            </div>
            <p className="mb-[22px] text-[15px] leading-[1.7] text-ga-muted">{ind.pitch}</p>
            {[['Vị trí phổ biến', ind.roles], ['Trình độ mục tiêu', ind.level], ['Chủ đề từ vựng', ind.topic]].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 border-t border-ga-border py-[11px]">
                <span className="shrink-0 text-[12.5px] text-ga-muted">{k}</span>
                <span className="text-right text-[13px] font-semibold text-ga-ink">{v}</span>
              </div>
            ))}
          </div>
          <div className="p-[28px_32px]">
            <GaCap className="mb-3.5">Câu hỏi phỏng vấn mẫu</GaCap>
            <div className="mb-6 flex flex-col gap-2.5">
              {ind.questions.map((q, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="shrink-0 font-ga-display text-[15px] font-semibold leading-[1.5]" style={{ color: ind.color }}>{i + 1}</span>
                  <div className="font-ga-display text-[15px] italic leading-[1.5] text-ga-ink">{q}</div>
                </div>
              ))}
            </div>
            <GaCap className="mb-3">Từ vựng trọng tâm</GaCap>
            <div className="flex flex-wrap gap-2">
              {ind.vocab.map((w) => (
                <span key={w} className="border border-ga-border bg-ga-card p-[7px_12px] font-ga-display text-[14px] italic text-ga-ink">{w}</span>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-[18px] flex items-center gap-2.5 text-[14px] text-ga-muted">
          <span className="inline-block h-[7px] w-[7px] bg-ga-yellow" />
          Ngoài 4 ngành trên, DeutschFlow còn hỗ trợ <strong className="text-ga-ink">Văn phòng</strong> và nhiều ngành khác — tổng cộng 12 bộ câu hỏi.
        </div>
      </section>

      {/* Exam */}
      <section id="exam" className={`${SECTION} scroll-mt-[78px]`}>
        <GaCap className="mb-[18px]">Luyện thi Goethe</GaCap>
        <h2 className={`${H2} mb-3`}>Mô phỏng đề thật, chấm điểm tức thì</h2>
        <p className="mb-11 max-w-[600px] text-[17px] leading-[1.6] text-ga-muted">Luyện đủ 4 phần của Goethe-Zertifikat B1/B2 trong điều kiện sát thi thật, kèm phân tích điểm yếu sau mỗi lần làm.</p>
        <div className="grid grid-cols-2 border border-ga-border md:grid-cols-4">
          {EXAM_PARTS.map((p, i) => (
            <div key={i} className={`bg-ga-card p-[28px_26px] ${i ? 'md:border-l md:border-l-ga-border' : ''}`}>
              <div className="mb-[3px] font-ga-display text-[24px] font-medium">{p.de}</div>
              <div className="mb-4 text-[12.5px] text-ga-muted">{p.vi} · {p.time}</div>
              <p className="text-[13.5px] leading-[1.65] text-ga-muted">{p.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-[18px] bg-ga-ink p-[22px_28px] text-ga-bg">
          <div className="min-w-0 flex-1">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-ga-yellow">Thi thử có chấm AI</div>
            <div className="font-ga-display text-[21px] font-medium leading-[1.35]">Biết ngay mình ở đâu so với chuẩn B1 — trước khi tốn tiền thi thật.</div>
          </div>
          <GaBtn asChild variant="yellow" size="lg">
            <Link href="/v2/register"><YellowSq dark />Làm thử miễn phí</Link>
          </GaBtn>
        </div>
      </section>

      {/* Testimonials */}
      <section className="border-y border-ga-border bg-ga-card">
        <div className={SECTION}>
          <GaCap className="mb-[18px]">Học viên nói gì</GaCap>
          <h2 className={`${H2} mb-12`}>Họ đã thành công như thế nào</h2>
          <div className="grid border border-ga-border md:grid-cols-3">
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className={`p-[36px_40px] ${i ? 'md:border-l md:border-l-ga-border' : ''}`}>
                <div className="mb-3.5 font-ga-display text-[40px] leading-none text-[#E7E3DA]">&ldquo;</div>
                <p className="mb-6 font-ga-display text-[17px] italic leading-[1.65]">{t.q}</p>
                <div className="text-[14.5px] font-bold">{t.name}</div>
                <div className="mt-[3px] text-[13px] text-ga-muted">{t.role}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Teachers */}
      <section id="teachers" className="scroll-mt-[78px] border-y border-ga-border bg-ga-card">
        <div className="mx-auto grid max-w-[1240px] items-center gap-[60px] px-[60px] py-[78px] md:grid-cols-2">
          <div>
            <GaCap className="mb-[18px]">Dành cho giáo viên</GaCap>
            <h2 className="mb-4 font-ga-display text-[42px] font-medium leading-[1.12] tracking-[-0.015em]">Công cụ cho giáo viên & trung tâm tiếng Đức</h2>
            <p className="mb-[30px] max-w-[480px] text-[16.5px] leading-[1.65] text-ga-muted">Giảm tải việc chấm bài và soạn tài liệu, để bạn tập trung vào điều quan trọng nhất — dạy học viên nói tự tin.</p>
            <div className="mb-[30px] grid grid-cols-2 border border-ga-border">
              {TEACH_VALUE.map((v, i) => (
                <div key={v.t} className={`p-[22px_24px] ${i % 2 ? 'border-l border-l-ga-border' : ''} ${i >= 2 ? 'border-t border-t-ga-border' : ''}`}>
                  <div className="mb-2 flex items-center gap-2.5">
                    <span className="h-2 w-2 shrink-0 bg-ga-violet" />
                    <span className="text-[15px] font-bold">{v.t}</span>
                  </div>
                  <p className="text-[13px] leading-[1.6] text-ga-muted">{v.s}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-3">
              <GaBtn asChild variant="ink" size="lg">
                <Link href="/v2/register"><YellowSq />Nhận tư vấn cho trung tâm</Link>
              </GaBtn>
              <GaBtn asChild variant="ghost" size="lg">
                <Link href="/v2/login">Xem demo bảng giáo viên →</Link>
              </GaBtn>
            </div>
          </div>
          <div className="border border-ga-border bg-ga-bg p-[24px_26px]">
            <div className="mb-4 flex items-center justify-between">
              <GaCap>Bảng giáo viên · Lớp K30</GaCap>
              <span className="border border-ga-violet/30 bg-ga-violet-soft p-[4px_10px] text-[10.5px] font-bold text-ga-violet">2 chờ chấm</span>
            </div>
            {([['Võ Thị Hoa', 'đạt 91 điểm Phỏng vấn vòng 1', 'var(--ga-green)'], ['Phạm Thị Mai', 'nộp Schreiben qua ảnh', 'var(--ga-violet)'], ['Lê Đức Anh', 'vắng 3 ngày — cần nhắc', 'var(--ga-orange)']] as const).map(([who, what, c], i) => (
              <div key={i} className="flex gap-2.5 border-t border-ga-border py-3">
                <span className="mt-1.5 h-2 w-2 shrink-0" style={{ background: c }} />
                <div className="min-w-0 flex-1 text-[13.5px] leading-[1.45] text-ga-ink"><strong>{who}</strong> {what}</div>
              </div>
            ))}
            <div className="mt-4 flex h-[88px] items-center justify-center border border-ga-violet/40 bg-ga-violet-soft text-[11px] font-semibold uppercase tracking-[0.14em] text-ga-violet">
              Ảnh · Báo cáo lớp
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className={SECTION}>
        <GaCap className="mb-[18px]">Gói học phí</GaCap>
        <h2 className={`${H2} mb-12`}>Chọn gói phù hợp</h2>
        <div className="grid border border-ga-border md:grid-cols-3">
          {PLANS.map((p, i) => (
            <div key={i} className={`relative p-[36px] ${i ? 'md:border-l md:border-l-ga-border' : ''} ${p.highlight ? 'bg-ga-ink text-ga-bg' : ''}`}>
              {p.highlight && <div className="absolute inset-x-0 top-0 h-[3px] bg-ga-yellow" />}
              <GaCap className={`mb-3.5 ${p.highlight ? 'text-ga-muted' : ''}`}>{p.name}</GaCap>
              <div className="mb-1 font-ga-display text-[40px] font-medium">{p.price}</div>
              {p.sub && <div className="mb-5 text-[13px] text-ga-muted">{p.sub}</div>}
              <div className="mb-7 mt-5 flex flex-col gap-2.5">
                {p.features.map((f, j) => (
                  <div key={j} className="flex items-center gap-2 text-[14.5px] leading-[1.4]">
                    <span className="inline-block h-[5px] w-[5px] shrink-0 bg-ga-yellow" />{f}
                  </div>
                ))}
              </div>
              <GaBtn asChild variant={p.highlight ? 'yellow' : 'ink'} size="md">
                <Link href="/v2/register">{p.cta}</Link>
              </GaBtn>
            </div>
          ))}
        </div>
      </section>

      {/* CTA footer */}
      <section className="bg-ga-ink text-ga-bg">
        <div className="mx-auto grid max-w-[1240px] items-center gap-[60px] px-[60px] py-[72px] md:grid-cols-[1fr_auto]">
          <div>
            <GaCap className="mb-[18px] text-[#76716A]">Bắt đầu ngay hôm nay</GaCap>
            <h2 className="font-ga-display text-[50px] font-medium leading-[1.1]">Sẵn sàng cho phỏng vấn tiếng Đức của bạn?</h2>
          </div>
          <GaBtn asChild variant="yellow" size="lg">
            <Link href="/v2/register"><YellowSq dark />Học thử miễn phí</Link>
          </GaBtn>
        </div>
      </section>
    </div>
  )
}
