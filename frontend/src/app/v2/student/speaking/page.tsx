'use client'

import { useEffect, useState } from 'react'
import { MessageCircle, Briefcase, CalendarDays, ArrowRight, Mic } from 'lucide-react'
import { todayApi, type TodayPlan } from '@/lib/todayApi'
import { GaPageHdr, GaCard, GaCap, LoadingState } from '@/components/ui-v2'

// Speaking launcher (v2). The live conversation engine (mic streaming + XTTS) is the proven
// legacy flow → mode cards deep-link there. Full v2 chat reskin = deferred (backlog).
// We pass ?return so the legacy flow sends the user back into v2 (not the old dashboard) on exit.

const RETURN_TO = '/v2/student/speaking'
const withReturn = (href: string) =>
  `${href}${href.includes('?') ? '&' : '?'}return=${encodeURIComponent(RETURN_TO)}`

const MODES = [
  {
    icon: MessageCircle,
    title: 'Hội thoại tự do',
    desc: 'Trò chuyện tiếng Đức với AI theo chủ đề bạn chọn.',
    href: '/speaking',
    tone: 'var(--ga-violet)',
  },
  {
    icon: Briefcase,
    title: 'Luyện phỏng vấn',
    desc: 'Mô phỏng phỏng vấn xin việc với HR người Đức.',
    href: '/student/interviews',
    tone: 'var(--ga-blue)',
  },
  {
    icon: CalendarDays,
    title: 'Chủ đề theo tuần',
    desc: 'Bài luyện nói có chủ đề, cập nhật mỗi tuần.',
    href: '/speaking',
    tone: 'var(--ga-teal)',
  },
]

export default function V2StudentSpeakingPage() {
  const [today, setToday] = useState<TodayPlan | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    todayApi
      .getMe()
      .then((r) => setToday(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr accent title="Luyện nói AI" subtitle="Thực hành phát âm và hội thoại tiếng Đức với gia sư AI" />
      <div className="flex-1 px-10 py-6">
        {/* Recommended */}
        {!loading && today?.recommendedSpeaking?.topic && (
          <a href={withReturn(today.recommendedSpeaking.href || '/speaking')}>
            <div className="mb-[22px] flex flex-col items-start gap-4 bg-ga-ink p-7 text-ga-bg md:flex-row md:items-center md:justify-between">
              <div>
                <GaCap className="mb-2 block" style={{ color: '#A39E94' }}>Gợi ý hôm nay</GaCap>
                <p className="font-ga-display text-[24px] font-medium">{today.recommendedSpeaking.topic}</p>
                {today.recommendedSpeaking.cefrLevel && (
                  <p className="ga-ui mt-1.5 text-[14px]" style={{ color: '#A39E94' }}>
                    Cấp độ {today.recommendedSpeaking.cefrLevel}
                  </p>
                )}
              </div>
              <span className="ga-ui inline-flex shrink-0 items-center gap-2 bg-ga-yellow px-5 py-3 text-[14px] font-semibold text-ga-ink">
                <Mic size={16} aria-hidden /> Bắt đầu nói
              </span>
            </div>
          </a>
        )}
        {loading && <LoadingState label="Đang tải gợi ý…" />}

        <GaCap className="mb-3 block">Chế độ luyện nói</GaCap>
        <div className="grid grid-cols-1 gap-[18px] md:grid-cols-3">
          {MODES.map((m) => {
            const Icon = m.icon
            return (
              <a key={m.title} href={withReturn(m.href)}>
                <GaCard hover className="group h-full p-5">
                  <span
                    className="mb-3 grid h-11 w-11 place-items-center rounded-ga"
                    style={{ background: `${m.tone}1a`, color: m.tone }}
                  >
                    <Icon size={22} aria-hidden />
                  </span>
                  <p className="font-ga-display text-[18px] font-medium text-ga-ink">{m.title}</p>
                  <p className="ga-ui mt-1 text-[13.5px] text-ga-muted">{m.desc}</p>
                  <span className="ga-ui mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-ga-accent">
                    Vào luyện <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </span>
                </GaCard>
              </a>
            )
          })}
        </div>
      </div>
    </div>
  )
}
