'use client'

import Link from 'next/link'
import { Mic, BookOpen, Repeat, Route, Trophy, ArrowRight } from 'lucide-react'
import { GaPageHdr, GaCard, GaCap } from '@/components/ui-v2'

// Welcome / help tour (client-side, no backend) — quick orientation to the daily surfaces.

const STEPS = [
  { icon: Route, title: 'Theo lộ trình', desc: 'Đi qua 4 giai đoạn từ nền tảng đến sẵn sàng thi Goethe.', href: '/v2/student/roadmap', tone: 'var(--ga-teal)' },
  { icon: BookOpen, title: 'Học từ vựng', desc: 'Ghi nhớ từ theo màu giống (der/die/das) kèm ví dụ & phát âm.', href: '/v2/student/vocabulary', tone: 'var(--ga-blue)' },
  { icon: Mic, title: 'Luyện nói với AI', desc: 'Hội thoại và phỏng vấn tiếng Đức, nhận phản hồi tức thì.', href: '/v2/student/speaking', tone: 'var(--ga-violet)' },
  { icon: Repeat, title: 'Ôn tập thông minh', desc: 'Hệ thống SRS nhắc bạn ôn đúng lúc để nhớ lâu.', href: '/v2/student/review', tone: 'var(--ga-orange)' },
  { icon: Trophy, title: 'Theo dõi thành tích', desc: 'Tích XP, mở huy hiệu và leo bảng xếp hạng.', href: '/v2/student/achievements', tone: 'var(--ga-gold)' },
]

export default function V2StudentWelcomePage() {
  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr accent title="Chào mừng đến DeutschFlow" subtitle="Hướng dẫn nhanh để bắt đầu hành trình tiếng Đức" />
      <div className="flex-1 px-10 py-6">
        <div className="mb-[22px] bg-ga-ink p-7 text-ga-bg">
          <GaCap className="mb-2 block" style={{ color: '#A39E94' }}>Bắt đầu</GaCap>
          <p className="font-ga-display text-[26px] font-medium">Học tiếng Đức theo cách của bạn</p>
          <p className="ga-ui mt-2 max-w-xl text-[14.5px]" style={{ color: '#A39E94' }}>
            DeutschFlow kết hợp AI luyện nói, từ vựng theo màu giống, ôn tập ngắt quãng và luyện thi
            Goethe — tất cả trong một lộ trình cá nhân hoá.
          </p>
          <Link
            href="/v2/student/dashboard"
            className="ga-ui mt-5 inline-flex items-center gap-2 bg-ga-yellow px-5 py-3 text-[14px] font-semibold text-ga-ink"
          >
            Tới bảng điều khiển <ArrowRight size={16} aria-hidden />
          </Link>
        </div>

        <GaCap className="mb-3 block">Khám phá tính năng</GaCap>
        <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
          {STEPS.map((s, i) => {
            const Icon = s.icon
            return (
              <Link key={s.title} href={s.href}>
                <GaCard hover className="group h-full p-5">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-ga" style={{ background: `${s.tone}1a`, color: s.tone }}>
                      <Icon size={20} aria-hidden />
                    </span>
                    <span className="font-ga-display text-[15px] font-medium text-ga-subtle">0{i + 1}</span>
                  </div>
                  <p className="mt-3 font-ga-display text-[17px] font-medium text-ga-ink">{s.title}</p>
                  <p className="ga-ui mt-1 text-[13.5px] text-ga-muted">{s.desc}</p>
                  <span className="ga-ui mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-ga-accent">
                    Mở <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </span>
                </GaCard>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
