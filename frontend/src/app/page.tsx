'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import api from '@/lib/api'
import { getAccessToken, clearTokens, logout } from '@/lib/authSession'
import { isNative } from '@/lib/native'
import { DeutschFlowLogo } from '@/components/ui/DeutschFlowLogo'
import { motion, useInView } from 'framer-motion'
import {
  Mic2, ArrowRight, CheckCircle2, Play,
  Briefcase, HeartPulse, Code2, ChefHat,
  Volume2, Brain, Target, Clock,
  Star, TrendingUp, AlertTriangle,
  Building2, Zap
} from 'lucide-react'

const INDUSTRIES = [
  { icon: HeartPulse, label: 'Điều dưỡng', de: 'Pflege', color: 'bg-rose-500' },
  { icon: Code2, label: 'CNTT / Kỹ sư', de: 'IT / Ingenieur', color: 'bg-blue-500' },
  { icon: ChefHat, label: 'Nhà bếp', de: 'Küche / Gastronomie', color: 'bg-amber-500' },
  { icon: Building2, label: 'Xây dựng', de: 'Bau / Handwerk', color: 'bg-emerald-500' },
  { icon: Briefcase, label: 'Văn phòng', de: 'Büro / Verwaltung', color: 'bg-violet-500' },
]

const PAIN_POINTS = [
  {
    icon: AlertTriangle,
    title: '\"Warum wollen Sie bei uns arbeiten?\"',
    desc: 'Câu hỏi này đơn giản mà hàng ngàn ứng viên Việt trả lời sai hoàn toàn vì không hiểu văn hóa phỏng vấn Đức.',
  },
  {
    icon: Volume2,
    title: 'Phát âm rõ khi bình tĩnh, mất khi căng thẳng',
    desc: 'Luyện một mình không ai sửa lỗi. Đến lúc phỏng vấn thật, áp lực khiến bạn phát âm sai những gì đã thuộc.',
  },
  {
    icon: Brain,
    title: 'Không biết HR Đức kỳ vọng gì',
    desc: 'Người Đức đánh giá cao sự chuẩn bị, độ chính xác và thái độ thẳng thắn — rất khác cách phỏng vấn ở Việt Nam.',
  },
  {
    icon: Clock,
    title: 'Không có chỗ luyện tập an toàn',
    desc: 'Bạn không thể mắc lỗi với HR thật. Mà luyện với bạn bè thì thiếu phản hồi chuyên môn và ngữ cảnh tiếng Đức.',
  },
]

const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Chọn ngành và cấp độ',
    desc: 'Điền ngành nghề và trình độ tiếng Đức. AI tạo bộ câu hỏi phỏng vấn đúng ngành, từ A2 đến C1.',
  },
  {
    step: '02',
    title: 'Phỏng vấn với AI HR người Đức',
    desc: 'AI đóng vai người phỏng vấn Đức, hỏi bằng tiếng Đức, điều chỉnh tốc độ và độ phức tạp theo bạn.',
  },
  {
    step: '03',
    title: 'Nhận phân tích chi tiết',
    desc: 'Sau mỗi buổi: điểm ngữ pháp, phát âm, nội dung câu trả lời và gợi ý cải thiện cụ thể.',
  },
]

const TESTIMONIALS = [
  {
    name: 'Nguyễn Thị Lan',
    role: 'Điều dưỡng tại Münster',
    quote: 'Sau 3 tuần luyện với DeutschFlow, tôi vượt qua phỏng vấn tại bệnh viện Herz-Jesu ngay lần đầu. HR nói tôi trả lời rất tự nhiên.',
    stars: 5,
  },
  {
    name: 'Trần Văn Hùng',
    role: 'IT Engineer tại Berlin',
    quote: 'AI hỏi đúng những câu phỏng vấn IT bằng tiếng Đức mà Google không tìm được. Tôi dùng 2 tuần trước ngày phỏng vấn thật.',
    stars: 5,
  },
  {
    name: 'Phạm Thị Mai',
    role: 'Krankenpflegerin tại Hamburg',
    quote: 'Điểm B2 không cao nhưng vẫn được nhận vì phỏng vấn tốt. Coach AI giúp tôi biết cách nói tự tin thay vì chỉ đúng ngữ pháp.',
    stars: 5,
  },
]

function FadeIn({
  children,
  delay = 0,
  className = '',
}: {
  children: React.ReactNode
  delay?: number
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.55, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export default function HomePage() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    setMounted(true)

    // On native iOS/Android, skip the marketing landing page entirely.
    // The native AppDelegate overlay handles splash + onboarding + auth choice,
    // then navigates the webview directly to /register or /login. Here we only
    // route returning users with a valid token to /dashboard, else to /login.
    const native = isNative()
    if (native) {
      if (getAccessToken()) {
        router.replace('/dashboard')
      } else {
        router.replace('/login')
      }
      return
    }

    if (getAccessToken()) {
      setIsLoggedIn(true)
      api.get('/auth/me')
        .then(() => router.replace('/dashboard'))
        .catch(() => clearTokens())
    }
  }, [router])

  if (!mounted) return null

  return (
    <div className="min-h-screen bg-[#121212] text-white selection:bg-[#FFCD00] selection:text-[#121212]">

      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/10 bg-[#121212]/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <DeutschFlowLogo variant="horizontal" size={148} animated={false} />

          <div className="hidden md:flex items-center gap-8 text-sm font-semibold text-white/60">
            <a href="#pain" className="hover:text-white transition-colors">Vấn đề</a>
            <a href="#how" className="hover:text-white transition-colors">Cách hoạt động</a>
            <a href="#industries" className="hover:text-white transition-colors">Ngành nghề</a>
            {isLoggedIn ? (
              <>
                <button onClick={() => logout()} className="hover:text-white transition-colors">Đăng xuất</button>
                <Link href="/dashboard" className="bg-[#FFCD00] text-[#121212] font-bold px-5 py-2 rounded-full hover:bg-[#E6B800] transition-colors">
                  Dashboard →
                </Link>
              </>
            ) : (
              <>
                <Link href="/login" className="hover:text-white transition-colors">Đăng nhập</Link>
                <Link href="/register" className="bg-[#FFCD00] text-[#121212] font-bold px-5 py-2 rounded-full hover:bg-[#E6B800] transition-colors">
                  Luyện tập miễn phí
                </Link>
              </>
            )}
          </div>

          <button className="md:hidden text-white/70 hover:text-white" onClick={() => setMenuOpen(v => !v)}>
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
              {menuOpen
                ? <><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></>
                : <><line x1="4" y1="8" x2="20" y2="8" /><line x1="4" y1="16" x2="20" y2="16" /></>
              }
            </svg>
          </button>
        </div>

        {menuOpen && (
          <div className="md:hidden px-6 pb-6 flex flex-col gap-4 text-sm font-semibold border-t border-white/10 pt-4">
            <a href="#pain" onClick={() => setMenuOpen(false)} className="text-white/70 hover:text-white">Vấn đề</a>
            <a href="#how" onClick={() => setMenuOpen(false)} className="text-white/70 hover:text-white">Cách hoạt động</a>
            <a href="#industries" onClick={() => setMenuOpen(false)} className="text-white/70 hover:text-white">Ngành nghề</a>
            <Link href="/register" className="bg-[#FFCD00] text-[#121212] font-bold py-3 rounded-xl text-center">
              Luyện tập miễn phí
            </Link>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="pt-36 pb-24 px-6 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
        <div className="absolute top-24 right-0 w-[600px] h-[600px] bg-[#FFCD00] opacity-[0.06] blur-[120px] rounded-full pointer-events-none" />

        <div className="max-w-7xl mx-auto relative z-10">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="inline-flex items-center gap-2 border border-[#FFCD00]/30 bg-[#FFCD00]/10 rounded-full px-4 py-1.5 mb-8">
              <span className="w-2 h-2 rounded-full bg-[#FFCD00] animate-pulse" />
              <span className="text-[#FFCD00] text-sm font-bold tracking-wide">AI Interview Coach &bull; Dành cho người Việt đi Đức</span>
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
            className="text-5xl sm:text-6xl md:text-[5.5rem] font-extrabold leading-[1.05] tracking-tighter max-w-4xl mb-8"
          >
            Tự tin phỏng vấn tại Đức &mdash;{' '}
            <span className="text-[#FFCD00]">dù tiếng Đức chưa hoàn hảo.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.18 }}
            className="text-xl md:text-2xl text-white/60 max-w-2xl mb-10 leading-relaxed"
          >
            AI Coach 1-1 luyện phỏng vấn đúng ngành, đúng văn hóa Đức. Sửa lỗi phát âm, ngữ pháp và nội dung sau mỗi buổi. Dành riêng cho người Việt chuẩn bị đi làm việc tại Đức.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.26 }}
            className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-12"
          >
            <Link
              href="/register"
              className="group inline-flex items-center gap-2 bg-[#FFCD00] text-[#121212] text-lg font-extrabold px-8 py-4 rounded-full hover:bg-[#E6B800] transition-all hover:-translate-y-0.5"
            >
              Bắt đầu luyện miễn phí
              <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
            </Link>
            <button className="inline-flex items-center gap-2 text-white/60 hover:text-white font-semibold transition-colors">
              <span className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center">
                <Play size={16} className="translate-x-0.5" />
              </span>
              Xem demo 90 giây
            </button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="flex flex-wrap items-center gap-6 text-sm text-white/40 font-medium"
          >
            <span className="flex items-center gap-2"><CheckCircle2 size={15} className="text-[#FFCD00]" /> 2,400+ người Việt đã dùng</span>
            <span className="flex items-center gap-2"><CheckCircle2 size={15} className="text-[#FFCD00]" /> 12 ngành nghề</span>
            <span className="flex items-center gap-2"><CheckCircle2 size={15} className="text-[#FFCD00]" /> Không cần thẻ tín dụng</span>
          </motion.div>
        </div>

        {/* Interview card mockup */}
        <motion.div
          initial={{ opacity: 0, x: 60 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="hidden lg:block absolute right-12 top-1/2 -translate-y-1/2 w-[380px]"
        >
          <div className="bg-[#1E1E1E] border border-white/10 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-full bg-[#FFCD00] flex items-center justify-center">
                <Mic2 size={18} className="text-[#121212]" />
              </div>
              <div>
                <div className="font-bold text-sm">AI HR &bull; Pflegezentrum Berlin</div>
                <div className="text-xs text-white/40">Phỏng vấn đang diễn ra</div>
              </div>
              <span className="ml-auto flex items-center gap-1 text-xs text-emerald-400 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />REC
              </span>
            </div>
            <div className="space-y-3">
              <div className="bg-white/5 rounded-xl p-4 text-sm text-white/70 leading-relaxed">
                <span className="text-[#FFCD00] font-semibold block mb-1">HR Müller:</span>
                &bdquo;Warum haben Sie sich entschieden, als Krankenpflegerin in Deutschland zu arbeiten?&rdquo;
              </div>
              <div className="bg-[#FFCD00]/10 border border-[#FFCD00]/20 rounded-xl p-4 text-sm text-white/80 leading-relaxed">
                <span className="text-[#FFCD00] font-semibold block mb-1">Bạn (đang nói):</span>
                &bdquo;Ich möchte meine Fähigkeiten im deutschen Gesundheitssystem...&rdquo;
              </div>
              <div className="flex items-center gap-2 mt-4">
                <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full w-3/5 bg-[#FFCD00] rounded-full" />
                </div>
                <span className="text-xs text-white/40">0:43 / 1:20</span>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Pain section */}
      <section id="pain" className="py-24 px-6 bg-[#0E0E0E] border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <FadeIn className="mb-16 max-w-2xl">
            <div className="text-[#FFCD00] text-sm font-bold tracking-widest uppercase mb-4">Vấn đề thực tế</div>
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight leading-tight mb-4">
              Biết tiếng Đức không đủ để được nhận việc.
            </h2>
            <p className="text-white/50 text-lg leading-relaxed">
              Hàng ngàn người Việt trượt phỏng vấn không phải vì tiếng Đức kém &mdash; mà vì không biết cách phỏng vấn đúng với người Đức.
            </p>
          </FadeIn>

          <div className="grid md:grid-cols-2 gap-6">
            {PAIN_POINTS.map((item, i) => (
              <FadeIn key={i} delay={i * 0.08}>
                <div className="bg-[#1A1A1A] border border-white/8 rounded-2xl p-7 hover:border-[#FFCD00]/20 transition-colors group">
                  <div className="w-11 h-11 rounded-xl bg-[#DA291C]/15 text-[#DA291C] flex items-center justify-center mb-5 group-hover:bg-[#DA291C]/20 transition-colors">
                    <item.icon size={22} />
                  </div>
                  <h3 className="font-bold text-lg mb-3 leading-snug">{item.title}</h3>
                  <p className="text-white/50 leading-relaxed">{item.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="py-24 px-6 border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <FadeIn className="text-center mb-16 max-w-2xl mx-auto">
            <div className="text-[#FFCD00] text-sm font-bold tracking-widest uppercase mb-4">Cách hoạt động</div>
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">
              Từ luyện tập đến phỏng vấn thật &mdash; trong 3 bước.
            </h2>
          </FadeIn>

          <div className="grid md:grid-cols-3 gap-8">
            {HOW_IT_WORKS.map((item, i) => (
              <FadeIn key={i} delay={i * 0.1}>
                <div className="relative">
                  <div className="text-[6rem] font-extrabold text-white/[0.04] leading-none mb-4 select-none">{item.step}</div>
                  <div className="absolute top-8 left-0 text-[#FFCD00] text-5xl font-extrabold leading-none">{item.step}</div>
                  <div className="pt-6 pl-2">
                    <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                    <p className="text-white/50 leading-relaxed">{item.desc}</p>
                  </div>
                  {i < HOW_IT_WORKS.length - 1 && (
                    <div className="hidden md:block absolute top-10 -right-4 text-white/15">
                      <ArrowRight size={24} />
                    </div>
                  )}
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* AI Feedback feature */}
      <section className="py-24 px-6 bg-[#0E0E0E] border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <FadeIn>
              <div className="text-[#FFCD00] text-sm font-bold tracking-widest uppercase mb-4">Phân tích AI</div>
              <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight leading-tight mb-6">
                Biết chính xác bạn sai ở đâu &mdash; không chỉ &ldquo;cần cải thiện&rdquo;.
              </h2>
              <p className="text-white/50 text-lg leading-relaxed mb-8">
                Sau mỗi buổi phỏng vấn giả, AI phân tích từng câu: ngữ pháp sai chỗ nào, phát âm cần sửa gì, nội dung câu trả lời có phù hợp văn hóa Đức không.
              </p>
              <ul className="space-y-4">
                {[
                  { icon: Target, text: 'Chấm điểm từng câu trả lời theo tiêu chí HR Đức' },
                  { icon: Volume2, text: 'Nhận diện lỗi phát âm đặc trưng của người Việt nói tiếng Đức' },
                  { icon: TrendingUp, text: 'Biểu đồ tiến độ qua từng buổi luyện tập' },
                  { icon: Zap, text: 'Gợi ý câu trả lời mẫu tốt hơn để học theo' },
                ].map(({ icon: Icon, text }, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="w-8 h-8 rounded-lg bg-[#FFCD00]/10 text-[#FFCD00] flex items-center justify-center shrink-0 mt-0.5">
                      <Icon size={16} />
                    </span>
                    <span className="text-white/70 font-medium">{text}</span>
                  </li>
                ))}
              </ul>
            </FadeIn>

            <FadeIn delay={0.12}>
              <div className="bg-[#1A1A1A] border border-white/10 rounded-2xl p-7">
                <div className="text-sm font-bold text-white/40 uppercase tracking-wider mb-5">Báo cáo sau phỏng vấn</div>
                <div className="space-y-5">
                  {[
                    { label: 'Ngữ pháp', score: 78, color: 'bg-blue-500' },
                    { label: 'Phát âm', score: 65, color: 'bg-amber-500' },
                    { label: 'Nội dung', score: 82, color: 'bg-emerald-500' },
                    { label: 'Độ tự nhiên', score: 55, color: 'bg-violet-500' },
                  ].map(({ label, score, color }) => (
                    <div key={label}>
                      <div className="flex justify-between text-sm font-semibold mb-2">
                        <span>{label}</span>
                        <span className="text-white/50">{score}/100</span>
                      </div>
                      <div className="h-2 bg-white/8 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          whileInView={{ width: `${score}%` }}
                          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                          viewport={{ once: true }}
                          className={`h-full rounded-full ${color}`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-6 pt-5 border-t border-white/8">
                  <div className="text-xs text-white/40 mb-3 font-semibold uppercase tracking-wider">Lỗi cần sửa</div>
                  <div className="space-y-2">
                    {[
                      'Dativkonstruktion sai trong câu “Ich freue mich auf...”',
                      'Phát âm “ü” trong Büro chưa chuẩn',
                      'Cần thêm Konjunktiv II để lịch sự hơn',
                    ].map((err, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-white/55">
                        <span className="text-[#DA291C] mt-0.5">&bull;</span>
                        <span>{err}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* Industries */}
      <section id="industries" className="py-24 px-6 border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <FadeIn className="text-center mb-14 max-w-xl mx-auto">
            <div className="text-[#FFCD00] text-sm font-bold tracking-widest uppercase mb-4">Ngành nghề</div>
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">
              Luyện đúng ngành bạn sẽ làm ở Đức.
            </h2>
            <p className="text-white/50 leading-relaxed">
              Mỗi ngành có bộ câu hỏi phỏng vấn riêng, từ vựng chuyên ngành và tình huống thực tế tại Đức.
            </p>
          </FadeIn>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {INDUSTRIES.map((item, i) => (
              <FadeIn key={i} delay={i * 0.07}>
                <div className="group bg-[#1A1A1A] border border-white/8 rounded-2xl p-6 text-center hover:border-[#FFCD00]/30 hover:-translate-y-1 transition-all cursor-pointer">
                  <div className={`w-12 h-12 rounded-xl ${item.color} flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform`}>
                    <item.icon size={22} className="text-white" />
                  </div>
                  <div className="font-bold text-sm mb-1">{item.label}</div>
                  <div className="text-white/40 text-xs">{item.de}</div>
                </div>
              </FadeIn>
            ))}
          </div>

          <FadeIn delay={0.3} className="mt-6 text-center">
            <span className="text-white/30 text-sm">+ 7 ngành khác đang được thêm vào</span>
          </FadeIn>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 px-6 bg-[#0E0E0E] border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <FadeIn className="text-center mb-14">
            <div className="text-[#FFCD00] text-sm font-bold tracking-widest uppercase mb-4">Câu chuyện thật</div>
            <h2 className="text-4xl font-extrabold tracking-tight">Người Việt đã thành công tại Đức.</h2>
          </FadeIn>

          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <FadeIn key={i} delay={i * 0.09}>
                <div className="bg-[#1A1A1A] border border-white/8 rounded-2xl p-7 hover:border-[#FFCD00]/20 transition-colors">
                  <div className="flex gap-1 mb-5">
                    {Array.from({ length: t.stars }).map((_, j) => (
                      <Star key={j} size={14} className="fill-[#FFCD00] text-[#FFCD00]" />
                    ))}
                  </div>
                  <p className="text-white/70 leading-relaxed mb-6 text-[0.95rem]">&bdquo;{t.quote}&rdquo;</p>
                  <div>
                    <div className="font-bold text-sm">{t.name}</div>
                    <div className="text-white/40 text-sm">{t.role}</div>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 px-6 border-t border-white/5">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: '2,400+', label: 'Học viên người Việt' },
            { value: '87%', label: 'Tỉ lệ đậu phỏng vấn' },
            { value: '12', label: 'Ngành nghề' },
            { value: 'A2–C1', label: 'Mọi cấp độ tiếng Đức' },
          ].map(({ value, label }, i) => (
            <FadeIn key={i} delay={i * 0.07}>
              <div className="text-[#FFCD00] text-4xl font-extrabold tracking-tight mb-2">{value}</div>
              <div className="text-white/40 text-sm font-medium">{label}</div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-28 px-6 relative overflow-hidden border-t border-white/5">
        <div className="absolute inset-0 bg-[#FFCD00]" />
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: 'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <FadeIn>
            <div className="text-[#121212]/60 text-sm font-bold tracking-widest uppercase mb-6">Bắt đầu ngay hôm nay</div>
            <h2 className="text-5xl md:text-6xl font-extrabold tracking-tight text-[#121212] leading-tight mb-6">
              Đừng để buổi phỏng vấn thật là lần đầu tiên bạn luyện.
            </h2>
            <p className="text-[#121212]/65 text-xl mb-10 leading-relaxed max-w-xl mx-auto">
              Bắt đầu bằng 1 buổi phỏng vấn thử miễn phí &mdash; không cần thẻ tín dụng, không giới hạn thời gian.
            </p>
            <Link
              href="/register"
              className="inline-flex items-center gap-3 bg-[#121212] text-white text-xl font-extrabold px-10 py-5 rounded-full hover:bg-[#1E1E1E] transition-all hover:-translate-y-1 shadow-[0_8px_40px_rgba(0,0,0,0.25)]"
            >
              Bắt đầu luyện phỏng vấn
              <ArrowRight size={22} />
            </Link>
            <p className="mt-5 text-[#121212]/50 text-sm font-medium">Dùng thử miễn phí &middot; Không cần credit card</p>
          </FadeIn>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 bg-[#0E0E0E] border-t border-white/5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <DeutschFlowLogo variant="horizontal" size={130} animated={false} className="opacity-50" />
          <div className="flex flex-wrap justify-center gap-6 text-sm text-white/30 font-medium">
            <Link href="/login" className="hover:text-white/60 transition-colors">Đăng nhập</Link>
            <Link href="/register" className="hover:text-white/60 transition-colors">Đăng ký</Link>
            <a href="#pain" className="hover:text-white/60 transition-colors">Tính năng</a>
          </div>
          <p className="text-white/20 text-sm">&copy; 2026 DeutschFlow. Dành cho người Việt đi Đức.</p>
        </div>
      </footer>

      {/* Mobile sticky CTA */}
      <div className="md:hidden fixed bottom-0 inset-x-0 p-4 bg-[#121212]/95 backdrop-blur-md border-t border-white/10 z-50">
        {isLoggedIn ? (
          <Link href="/dashboard" className="flex items-center justify-center w-full bg-[#FFCD00] text-[#121212] text-base font-extrabold py-4 rounded-xl">
            Vào Dashboard &rarr;
          </Link>
        ) : (
          <Link href="/register" className="flex items-center justify-center w-full bg-[#FFCD00] text-[#121212] text-base font-extrabold py-4 rounded-xl">
            Luyện phỏng vấn miễn phí &rarr;
          </Link>
        )}
      </div>
    </div>
  )
}
