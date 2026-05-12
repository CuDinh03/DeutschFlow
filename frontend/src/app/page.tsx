'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import api from '@/lib/api'
import { getAccessToken, clearTokens, logout } from '@/lib/authSession'
import { DeutschFlowLogo } from '@/components/ui/DeutschFlowLogo'
import {
  Mic2,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  Play,
  TrendingUp,
  MessageSquare,
  Ear,
  GraduationCap,
  Newspaper
} from 'lucide-react'
import { motion } from 'framer-motion'

export default function HomePage() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    setMounted(true)
    if (getAccessToken()) {
      setIsLoggedIn(true)
      api.get('/auth/me')
        .then(() => {
          router.replace(`/dashboard`)
        })
        .catch(() => {
          clearTokens()
        })
    }
  }, [router])

  if (!mounted) return null

  return (
    <div className="min-h-screen bg-white selection:bg-blue-100 selection:text-blue-900">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100 transition-all">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <DeutschFlowLogo variant="horizontal" size={160} animated={false} />
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-600">
            <Link href="#features" className="hover:text-gray-900 transition-colors">Tính năng</Link>
            <Link href="#journey" className="hover:text-gray-900 transition-colors">Lộ trình học</Link>
            <Link href="#news" className="hover:text-gray-900 transition-colors">Tin tức</Link>
            
            {isLoggedIn ? (
              <>
                <button onClick={() => logout()} className="hover:text-gray-900 transition-colors">Đăng xuất</button>
                <Link href="/dashboard" className="bg-primary hover:bg-blue-700 text-white px-5 py-2.5 rounded-full shadow-sm shadow-blue-500/30 transition-all font-bold">
                  Vào Dashboard
                </Link>
              </>
            ) : (
              <>
                <Link href="/login" className="hover:text-gray-900 transition-colors">Đăng nhập</Link>
                <Link href="/register" className="bg-primary hover:bg-blue-700 text-white px-5 py-2.5 rounded-full shadow-sm shadow-blue-500/30 transition-all font-bold">
                  Try AI Tutor Free
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-40 pb-20 px-6 overflow-hidden relative">
        <div className="absolute top-0 right-0 -translate-y-12 translate-x-1/3 w-[800px] h-[800px] bg-blue-50 rounded-full blur-3xl opacity-50 pointer-events-none"></div>
        <div className="max-w-7xl mx-auto text-center relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-full px-4 py-2 mb-8"
          >
            <Sparkles size={16} className="text-blue-600" />
            <span className="text-sm font-bold text-blue-700">Trợ giảng tiếng Đức AI thông minh nhất</span>
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-5xl md:text-7xl font-extrabold text-gray-900 mb-8 tracking-tighter leading-[1.1] max-w-4xl mx-auto"
          >
            Học giao tiếp tiếng Đức chưa bao giờ <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Dễ Dàng</span> đến thế.
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-xl md:text-2xl text-gray-500 mb-10 leading-relaxed max-w-2xl mx-auto font-medium"
          >
            Luyện nói mỗi ngày với AI, sửa lỗi ngữ pháp tự động và chinh phục chứng chỉ Goethe/TELC nhanh gấp 3 lần.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8"
          >
            <Link href="/register" className="w-full sm:w-auto bg-primary hover:bg-blue-700 text-white text-lg font-bold px-8 py-4 rounded-full shadow-[0_8px_30px_rgb(37,99,235,0.3)] hover:shadow-[0_8px_30px_rgb(37,99,235,0.5)] transition-all flex items-center justify-center gap-2 hover:-translate-y-1">
              Start Speaking For Free
              <ArrowRight size={20} />
            </Link>
            <button className="w-full sm:w-auto bg-white border-2 border-gray-200 hover:border-gray-300 text-gray-700 text-lg font-bold px-8 py-4 rounded-full transition-all flex items-center justify-center gap-2">
              <Play size={20} />
              Xem Demo Ngắn
            </button>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.6 }}
            className="flex items-center justify-center gap-8 text-sm font-semibold text-gray-400"
          >
            <span className="flex items-center gap-2"><CheckCircle2 size={16} className="text-green-500" /> Không cần thẻ tín dụng</span>
            <span className="flex items-center gap-2"><CheckCircle2 size={16} className="text-green-500" /> Hủy bất kỳ lúc nào</span>
          </motion.div>

          {/* Hero Image Mockup Placeholder */}
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="mt-20 max-w-5xl mx-auto"
          >
            <div className="aspect-[16/9] w-full bg-gray-100 rounded-2xl md:rounded-[2rem] border-8 border-gray-900 shadow-2xl flex items-center justify-center overflow-hidden relative group">
              <div className="absolute inset-0 bg-gray-200/50 flex flex-col items-center justify-center text-gray-400 font-mono">
                <svg className="w-16 h-16 mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                [ Screenshot App Dashboard (Desktop) ]
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Social Proof Section */}
      <section className="py-12 border-y border-gray-100 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-sm font-bold text-gray-400 tracking-widest uppercase mb-8">
            Được tin dùng bởi hàng ngàn học viên chuẩn bị thi chứng chỉ
          </p>
          <div className="flex flex-wrap justify-center items-center gap-12 opacity-50 grayscale">
            {/* Logos Placeholders */}
            <div className="font-extrabold text-2xl font-serif">Goethe-Institut</div>
            <div className="font-extrabold text-2xl tracking-tight">telc</div>
            <div className="font-extrabold text-2xl italic">ÖSD</div>
            <div className="font-extrabold text-2xl">TestDaF</div>
          </div>
        </div>
      </section>

      {/* Product Showcases (Zig-zag) */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-7xl mx-auto space-y-32">
          
          {/* Feature 1 */}
          <div className="flex flex-col md:flex-row items-center gap-16">
            <div className="flex-1 space-y-6">
              <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
                <Mic2 size={24} />
              </div>
              <h2 className="text-4xl font-extrabold text-gray-900 tracking-tight leading-tight">
                Vượt qua nỗi sợ giao tiếp. Phản xạ như người bản xứ.
              </h2>
              <p className="text-xl text-gray-500 leading-relaxed">
                Đừng chỉ học thuộc lòng ngữ pháp. Hãy luyện nói trực tiếp với AI Roleplay qua hàng chục tình huống đời thực: Phỏng vấn xin việc, đi siêu thị, làm việc tại bệnh viện...
              </p>
              <ul className="space-y-4 pt-4">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="text-blue-500 mt-1 shrink-0" />
                  <span className="text-gray-700 text-lg">Giọng nói tự nhiên nhờ công nghệ AI Voice cao cấp.</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="text-blue-500 mt-1 shrink-0" />
                  <span className="text-gray-700 text-lg">AI linh hoạt theo ngữ cảnh, không rập khuôn kịch bản.</span>
                </li>
              </ul>
            </div>
            <div className="flex-1 relative">
              <div className="absolute inset-0 bg-blue-100 rounded-[3rem] -rotate-3 scale-105"></div>
              {/* Mobile Mockup Placeholder */}
              <div className="relative mx-auto w-[300px] h-[600px] bg-white rounded-[2.5rem] border-[10px] border-gray-900 shadow-2xl flex flex-col overflow-hidden">
                <div className="flex-1 bg-gray-100 flex flex-col items-center justify-center text-gray-400 font-mono text-sm p-8 text-center">
                  <svg className="w-12 h-12 mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                  [ Screenshot AI Chat Interface (Mobile) ]
                </div>
              </div>
            </div>
          </div>

          {/* Feature 2 */}
          <div className="flex flex-col md:flex-row-reverse items-center gap-16">
            <div className="flex-1 space-y-6">
              <div className="w-12 h-12 bg-red-100 text-red-600 rounded-xl flex items-center justify-center">
                <TrendingUp size={24} />
              </div>
              <h2 className="text-4xl font-extrabold text-gray-900 tracking-tight leading-tight">
                Hệ thống bắt lỗi thông minh. Chữa tận gốc rễ.
              </h2>
              <p className="text-xl text-gray-500 leading-relaxed">
                Sau mỗi cuộc trò chuyện, AI phân tích chi tiết độ trôi chảy và bóc tách từng lỗi ngữ pháp (Akkusativ, Dativ, vị trí động từ...).
              </p>
              <ul className="space-y-4 pt-4">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="text-red-500 mt-1 shrink-0" />
                  <span className="text-gray-700 text-lg">Biểu đồ Radar Chart theo dõi kỹ năng trực quan.</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="text-red-500 mt-1 shrink-0" />
                  <span className="text-gray-700 text-lg">Hệ thống Spaced Repetition tự động ép bạn sửa lỗi vào ngày hôm sau.</span>
                </li>
              </ul>
            </div>
            <div className="flex-1 w-full">
              {/* Dashboard Report Mockup Placeholder */}
              <div className="aspect-square max-w-md mx-auto bg-gray-50 rounded-3xl border border-gray-200 shadow-xl flex items-center justify-center text-gray-400 font-mono text-sm p-8 text-center relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-red-100 blur-3xl rounded-full"></div>
                <div className="absolute bottom-0 left-0 w-40 h-40 bg-blue-100 blur-3xl rounded-full"></div>
                <div className="relative z-10 flex flex-col items-center">
                  <svg className="w-12 h-12 mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                  [ Screenshot Radar Chart & Error Report ]
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* The Learning Journey / Roadmap */}
      <section id="journey" className="py-24 bg-gray-50 border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-4xl font-extrabold text-gray-900 tracking-tight mb-6">
              Hành trình Đi Từ Số 0 Đến Giao Tiếp Thành Thạo
            </h2>
            <p className="text-xl text-gray-500">
              Lộ trình được thiết kế bài bản theo chuẩn CEFR, không chỉ dạy từ vựng mà còn xây dựng năng lực phản xạ qua từng ngày.
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-6 relative">
            {/* Horizontal Line connecting steps (hidden on mobile) */}
            <div className="hidden md:block absolute top-1/2 left-0 right-0 h-1 bg-gray-200 -translate-y-1/2 z-0"></div>

            {[
              {
                step: 1,
                title: 'Nền Tảng A1',
                desc: 'Học hệ thống giống từ bằng màu sắc (Der/Die/Das) và cấu trúc câu cơ bản.',
                icon: GraduationCap,
                color: 'text-blue-600',
                bg: 'bg-blue-100'
              },
              {
                step: 2,
                title: 'Phản Xạ Nghe',
                desc: 'Tắm ngôn ngữ (Immersion) qua các bài nghe hội thoại thực tế có transcript.',
                icon: Ear,
                color: 'text-purple-600',
                bg: 'bg-purple-100'
              },
              {
                step: 3,
                title: 'Luyện Nói Hàng Ngày',
                desc: 'Roleplay 1-1 với AI để vượt qua rào cản sợ nói, tự động chữa lỗi.',
                icon: MessageSquare,
                color: 'text-green-600',
                bg: 'bg-green-100'
              },
              {
                step: 4,
                title: 'Tự Tin Lấy Chứng Chỉ',
                desc: 'Thực hành các đề mô phỏng thi Nói của Goethe/TELC trước khi thi thật.',
                icon: TrendingUp,
                color: 'text-orange-600',
                bg: 'bg-orange-100'
              }
            ].map((item, idx) => (
              <div key={idx} className="relative z-10 bg-white rounded-2xl p-6 shadow-xl shadow-gray-200/50 border border-gray-100 text-center hover:-translate-y-2 transition-transform">
                <div className={`w-16 h-16 mx-auto rounded-full ${item.bg} ${item.color} flex items-center justify-center mb-6 ring-8 ring-white`}>
                  <item.icon size={28} />
                </div>
                <div className="text-sm font-bold text-gray-400 mb-2 uppercase tracking-widest">Giai đoạn {item.step}</div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{item.title}</h3>
                <p className="text-gray-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* News Section */}
      <section id="news" className="py-24 px-6 bg-white border-t border-gray-100">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-end justify-between mb-12">
            <div>
              <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-600 font-bold px-3 py-1 rounded-full text-xs mb-4">
                <Newspaper size={14} />
                <span>Cập Nhật Hàng Ngày</span>
              </div>
              <h2 className="text-4xl font-extrabold text-gray-900 tracking-tight">Tin tức & Đời sống Đức</h2>
              <p className="text-gray-500 mt-2 text-lg">Học tiếng Đức qua tin tức thực tế từ Tagesschau, DW và Der Spiegel.</p>
            </div>
            {isLoggedIn && (
              <Link href="/news" className="hidden md:flex items-center gap-2 text-blue-600 font-bold hover:text-blue-800 transition-colors">
                Xem tất cả tin tức <ArrowRight size={18} />
              </Link>
            )}
          </div>

          <div className="grid md:grid-cols-3 gap-6 relative">
            {/* Dummy articles for landing page preview */}
            {[
              { source: 'DW Deutsch lernen', title: 'Deutschland wählt: Die wichtigsten Infos', summary: 'Am 28. September wird in Deutschland ein neuer Bundestag gewählt. Wir erklären, wie das Wahlsystem funktioniert.', time: '5 phút đọc' },
              { source: 'Tagesschau', title: 'Neue Regeln für das Deutschlandticket', summary: 'Der Preis für das Deutschlandticket steigt auf 58 Euro. Das haben die Verkehrsminister der Länder beschlossen.', time: '3 phút đọc' },
              { source: 'Der Spiegel', title: 'So plant die Bahn den Sommer', summary: 'Die Deutsche Bahn verspricht weniger Verspätungen während der EM. Ein Blick auf die neuen Fahrpläne.', time: '7 phút đọc' },
            ].map((article, idx) => (
              <div key={idx} className={`bg-gray-50 rounded-2xl p-6 border border-gray-200 transition-all ${!isLoggedIn && idx > 0 ? 'blur-sm select-none' : 'hover:-translate-y-1 hover:shadow-lg'}`}>
                <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
                  <span className="text-blue-600">{article.source}</span>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3 leading-snug">{article.title}</h3>
                <p className="text-gray-600 leading-relaxed mb-6">{article.summary}</p>
                <div className="flex items-center justify-between text-sm font-medium">
                  {isLoggedIn || idx === 0 ? (
                    <Link href="/news" className="text-primary hover:text-blue-700 flex items-center gap-1">
                      Đọc bài <ArrowRight size={16} />
                    </Link>
                  ) : (
                    <span className="text-gray-400">Yêu cầu đăng nhập</span>
                  )}
                  <span className="text-gray-400 flex items-center gap-1.5">
                    <CheckCircle2 size={14} /> {article.time}
                  </span>
                </div>
              </div>
            ))}

            {/* Blur overlay for unauthenticated users */}
            {!isLoggedIn && (
              <div className="absolute inset-0 bg-gradient-to-t from-white via-white/80 to-transparent flex flex-col items-center justify-end pb-12 z-10">
                <div className="bg-white p-6 rounded-2xl shadow-xl shadow-gray-200 text-center max-w-sm mx-auto border border-gray-100">
                  <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Newspaper size={24} />
                  </div>
                  <h4 className="font-bold text-gray-900 text-lg mb-2">Đọc tin tức để luyện tập</h4>
                  <p className="text-gray-500 text-sm mb-6">Đăng nhập để đọc toàn bộ tin tức được cập nhật hàng ngày và lưu từ vựng.</p>
                  <Link href="/login?next=/news" className="block w-full bg-primary hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all">
                    Đăng nhập để đọc
                  </Link>
                </div>
              </div>
            )}
          </div>
          
          {isLoggedIn && (
            <div className="mt-8 text-center md:hidden">
              <Link href="/news" className="inline-flex items-center gap-2 text-blue-600 font-bold hover:text-blue-800 transition-colors">
                Xem tất cả tin tức <ArrowRight size={18} />
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Pricing / Final CTA Section */}
      <section className="py-24 px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gray-900"></div>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-blue-600/30 blur-[120px] rounded-full pointer-events-none"></div>
        
        <div className="max-w-4xl mx-auto text-center relative z-10 text-white">
          <h2 className="text-5xl font-extrabold tracking-tight mb-8">
            Đừng để ngôn ngữ là rào cản cơ hội của bạn.
          </h2>
          <p className="text-2xl text-gray-300 mb-12 leading-relaxed">
            Hàng ngàn người đã bắt đầu chinh phục tiếng Đức mỗi ngày. Bạn đã sẵn sàng chưa?
          </p>
          
          <Link href="/register" className="inline-flex items-center justify-center gap-2 bg-white text-gray-900 hover:bg-gray-100 text-xl font-bold px-12 py-5 rounded-full shadow-[0_0_40px_rgba(255,255,255,0.3)] hover:shadow-[0_0_60px_rgba(255,255,255,0.5)] transition-all hover:scale-105">
            Try AI Tutor Free
            <ArrowRight size={24} />
          </Link>
          
          <p className="mt-6 text-gray-400 font-medium">Làm bài Mock Exam trong 3 phút. Không yêu cầu thẻ tín dụng.</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 bg-gray-50 border-t border-gray-200 text-center">
        <DeutschFlowLogo variant="horizontal" size={140} animated={false} className="mx-auto mb-6 grayscale opacity-60" />
        <p className="text-gray-400 font-medium">&copy; 2026 DeutschFlow. Premium German Learning Platform.</p>
      </footer>

      {/* Sticky Mobile CTA */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-md border-t border-gray-200 z-50">
        {isLoggedIn ? (
          <Link href="/dashboard" className="flex items-center justify-center w-full bg-primary text-white text-lg font-bold py-4 rounded-xl shadow-lg">
            Vào Dashboard
          </Link>
        ) : (
          <Link href="/register" className="flex items-center justify-center w-full bg-primary text-white text-lg font-bold py-4 rounded-xl shadow-lg">
            Try AI Tutor Free
          </Link>
        )}
      </div>
    </div>
  )
}
