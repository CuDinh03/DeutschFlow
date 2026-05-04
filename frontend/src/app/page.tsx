'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import api from '@/lib/api'
import { getAccessToken, clearTokens } from '@/lib/authSession'
import {
  BookOpen,
  Mic2,
  Brain,
  Users,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  Play,
  Globe,
  Zap,
  Target,
} from 'lucide-react'

export default function HomePage() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    // Kiểm tra nếu đã đăng nhập thì redirect theo role
    if (getAccessToken()) {
      api.get('/auth/me')
        .then((res) => {
          const user = res.data
          router.push(`/${user.role.toLowerCase()}`)
        })
        .catch(() => {
          clearTokens()
        })
    }
  }, [router])

  if (!mounted) return null

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center">
              <span className="text-accent-foreground font-bold text-xl">D</span>
            </div>
            <span className="font-bold text-xl text-foreground">DeutschFlow</span>
          </div>
          
          <div className="flex items-center gap-4">
            <Link href="/login" className="btn-secondary btn-sm">
              Đăng nhập
            </Link>
            <Link href="/register" className="btn-accent btn-sm">
              Đăng ký miễn phí
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-accent/10 border border-accent/40 rounded-full px-4 py-2 mb-6">
                <Sparkles size={16} className="text-accent" />
                <span className="text-sm font-medium text-accent-foreground">Học tiếng Đức thông minh với AI</span>
              </div>
              
              <h1 className="text-5xl font-bold text-foreground mb-6 leading-tight">
                Làm chủ tiếng Đức với{' '}
                <span className="text-primary">Hệ thống màu sắc</span> độc đáo
              </h1>
              
              <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
                DeutschFlow kết hợp tư duy hệ thống, mã hóa màu sắc theo giống từ (DER/DIE/DAS) 
                và trí tuệ nhân tạo để giúp bạn học tiếng Đức hiệu quả hơn.
              </p>

              <div className="flex flex-wrap gap-4 mb-8">
                <Link href="/register" className="btn-accent btn-lg">
                  <Play size={18} fill="currentColor" />
                  Bắt đầu học miễn phí
                </Link>
                <button className="btn-outline btn-lg">
                  <Play size={18} />
                  Xem demo
                </button>
              </div>

              <div className="flex items-center gap-8 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-success" />
                  <span>Miễn phí 100%</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-success" />
                  <span>Không cần thẻ tín dụng</span>
                </div>
              </div>
            </div>

            {/* Gender System Demo */}
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-accent/20 rounded-3xl blur-3xl" />
              <div className="relative card p-8">
                <h3 className="font-semibold text-foreground mb-6 text-center">
                  Hệ thống màu sắc theo giống
                </h3>
                <div className="space-y-4">
                  {[
                    { gender: 'DER', color: 'bg-gender-der', label: 'Giống đực', word: 'der Tisch', meaning: 'cái bàn' },
                    { gender: 'DIE', color: 'bg-gender-die', label: 'Giống cái', word: 'die Frau', meaning: 'người phụ nữ' },
                    { gender: 'DAS', color: 'bg-gender-das', label: 'Giống trung', word: 'das Kind', meaning: 'đứa trẻ' },
                  ].map(({ gender, color, label, word, meaning }) => (
                    <div key={gender} className="flex items-center gap-4 p-4 bg-muted rounded-lg hover:shadow-md transition-shadow">
                      <div className={`w-12 h-12 rounded-lg ${color} flex items-center justify-center flex-shrink-0`}>
                        <span className="text-white font-bold">{gender}</span>
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-foreground">{word}</p>
                        <p className="text-sm text-muted-foreground">{label} · {meaning}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-6 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-foreground mb-4">
              Tính năng nổi bật
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Học tiếng Đức chưa bao giờ dễ dàng và thú vị đến thế
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: BookOpen,
                color: 'text-gender-der',
                bg: 'bg-blue-50',
                title: 'Từ vựng theo màu sắc',
                desc: 'Mỗi danh từ được gắn màu theo giống (DER/DIE/DAS) giúp ghi nhớ nhanh hơn 3 lần',
              },
              {
                icon: Brain,
                color: 'text-gender-die',
                bg: 'bg-red-50',
                title: 'Logic Lego',
                desc: 'Xây dựng câu bằng cách kéo thả các khối từ, tự động biến cách theo ngữ cảnh',
              },
              {
                icon: Mic2,
                color: 'text-gender-das',
                bg: 'bg-green-50',
                title: 'Luyện nói AI',
                desc: 'Trò chuyện với AI, nhận phản hồi về phát âm và ngữ pháp theo thời gian thực',
              },
              {
                icon: Users,
                color: 'text-accent',
                bg: 'bg-yellow-50',
                title: 'Quiz tương tác',
                desc: 'Giáo viên tạo quiz realtime, học sinh thi đua trên bảng xếp hạng',
              },
              {
                icon: Target,
                color: 'text-info',
                bg: 'bg-blue-50',
                title: 'Ôn tập thông minh',
                desc: 'Thuật toán SM-2 tự động lên lịch ôn tập đúng lúc bạn sắp quên',
              },
              {
                icon: Globe,
                color: 'text-success',
                bg: 'bg-green-50',
                title: 'Đa ngôn ngữ',
                desc: 'Giao diện hỗ trợ Tiếng Việt, Tiếng Anh và Tiếng Đức',
              },
            ].map(({ icon: Icon, color, bg, title, desc }) => (
              <div key={title} className="card p-6 hover:shadow-xl transition-all">
                <div className={`w-12 h-12 rounded-lg ${bg} flex items-center justify-center mb-4`}>
                  <Icon size={24} className={color} />
                </div>
                <h3 className="font-semibold text-foreground mb-2 text-lg">{title}</h3>
                <p className="text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8 text-center">
            {[
              { value: '80+', label: 'Từ vựng A1', icon: BookOpen },
              { value: '3', label: 'Cấp độ CEFR', icon: Target },
              { value: '100%', label: 'Miễn phí', icon: Zap },
            ].map(({ value, label, icon: Icon }) => (
              <div key={label} className="card p-8">
                <Icon size={32} className="text-primary mx-auto mb-4" />
                <p className="text-5xl font-bold text-foreground mb-2">{value}</p>
                <p className="text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 bg-gradient-to-br from-primary via-primary-hover to-navy-blue-dark text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-6">
            Sẵn sàng bắt đầu hành trình học tiếng Đức?
          </h2>
          <p className="text-xl text-white/80 mb-8">
            Tham gia DeutschFlow ngay hôm nay và trải nghiệm cách học tiếng Đức hoàn toàn mới
          </p>
          <Link href="/register" className="btn-accent btn-lg">
            <Play size={18} fill="currentColor" />
            Đăng ký miễn phí
            <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-border">
        <div className="max-w-7xl mx-auto text-center text-muted-foreground">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
              <span className="text-accent-foreground font-bold">D</span>
            </div>
            <span className="font-bold text-foreground">DeutschFlow</span>
          </div>
          <p className="text-sm">© 2026 DeutschFlow. Học tiếng Đức thông minh với AI.</p>
        </div>
      </footer>
    </div>
  )
}
