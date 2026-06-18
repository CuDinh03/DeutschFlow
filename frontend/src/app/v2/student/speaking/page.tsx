'use client'

import { useEffect, useState } from 'react'
import { MessageCircle, Briefcase, CalendarDays, ArrowRight, Mic, Coins } from 'lucide-react'
import { todayApi, type TodayPlan } from '@/lib/todayApi'
import { aiSpeakingApi, type AiSpeakingQuota } from '@/lib/aiSpeakingApi'
import { coinApi } from '@/lib/coinApi'
import { useStudentCoins } from '@/lib/flags'
import { GaPageHdr, GaCard, GaCap, LoadingState } from '@/components/ui-v2'

// Speaking launcher (v2). The live conversation engine (mic streaming + XTTS) is the proven
// legacy flow → mode cards deep-link there. Full v2 chat reskin = deferred (backlog).
// Coin (student-coins-v1): when today's free token quota is exhausted, a learner can spend coins
// for a one-day top-up (one extra session). Must match backend CoinService.PRICE_BONUS_SPEAKING.
const BONUS_PRICE = 3

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
    href: '/interview',
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
  const coinsEnabled = useStudentCoins()
  const [today, setToday] = useState<TodayPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [quota, setQuota] = useState<AiSpeakingQuota | null>(null)
  const [coins, setCoins] = useState<number | null>(null)
  const [buying, setBuying] = useState(false)
  const [bonusError, setBonusError] = useState<string | null>(null)

  useEffect(() => {
    todayApi
      .getMe()
      .then((r) => setToday(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Quota + coins — flag-gated, best-effort. Drives the "out of free turns → buy bonus" affordance.
  const loadQuotaAndCoins = () => {
    if (!coinsEnabled) return
    aiSpeakingApi.getQuota().then((r) => setQuota(r.data)).catch(() => setQuota(null))
    coinApi.getBalance().then((b) => setCoins(b.balance)).catch(() => setCoins(null))
  }
  useEffect(loadQuotaAndCoins, [coinsEnabled])

  const buyBonus = async () => {
    setBuying(true)
    setBonusError(null)
    try {
      const res = await coinApi.buyBonusSpeaking()
      setCoins(res.balance)
      const q = await aiSpeakingApi.getQuota()
      setQuota(q.data)
    } catch {
      setBonusError('Không mua được lượt nói thêm. Vui lòng thử lại.')
    } finally {
      setBuying(false)
    }
  }

  const quotaExhausted = coinsEnabled && quota != null && !quota.canStartSession

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr
        accent
        title="Luyện nói AI"
        subtitle="Thực hành phát âm và hội thoại tiếng Đức với gia sư AI"
        right={
          coinsEnabled && coins != null ? (
            <span
              className="ga-ui inline-flex items-center gap-1.5 border border-ga-line bg-ga-bg px-3 py-2 text-[13px] text-ga-ink"
              title="Xu thưởng — hoàn thành bài học để nhận"
            >
              <span className="font-ga-display text-[18px] font-medium">{coins.toLocaleString('vi-VN')}</span>
              <span className="text-ga-muted">🪙 xu</span>
            </span>
          ) : undefined
        }
      />
      <div className="flex-1 px-10 py-6">
        {/* Out of free turns today → spend coins for a one-day top-up (PRO stays the unlimited path). */}
        {quotaExhausted && (
          <div className="mb-[22px] flex flex-col items-start gap-3 rounded-ga border border-ga-line bg-ga-surface p-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <Coins size={20} className="mt-0.5 shrink-0 text-ga-gold" aria-hidden />
              <div>
                <p className="text-[14.5px] font-semibold text-ga-ink">Hết lượt nói miễn phí hôm nay</p>
                <p className="ga-ui mt-0.5 text-[13px] text-ga-muted">
                  Dùng {BONUS_PRICE} 🪙 cho một lượt nói thêm hôm nay, hoặc nâng cấp PRO để không giới hạn.
                </p>
                {bonusError && <p className="ga-ui mt-1 text-[12.5px] text-ga-red">{bonusError}</p>}
              </div>
            </div>
            {coins != null && coins >= BONUS_PRICE ? (
              <button
                type="button"
                onClick={buyBonus}
                disabled={buying}
                className="ga-ui inline-flex shrink-0 items-center gap-1.5 bg-ga-accent px-5 py-3 text-[14px] font-semibold text-ga-accent-ink transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {buying ? 'Đang xử lý…' : `Dùng ${BONUS_PRICE} 🪙 cho lượt nói thêm`}
              </button>
            ) : (
              <span className="ga-ui shrink-0 text-[12.5px] text-ga-subtle">
                Cần {BONUS_PRICE} 🪙 (bạn có {coins ?? 0})
              </span>
            )}
          </div>
        )}

        {/* Recommended */}
        {!loading && today?.recommendedSpeaking?.topic && (
          <a href={today.recommendedSpeaking.href || '/speaking'}>
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
              <a key={m.title} href={m.href}>
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
