'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { CheckCircle2, Mic, Volume2, ChevronRight, Sparkles, Star } from 'lucide-react'
import api from '@/lib/api'
import { clearTokens, getAccessToken } from '@/lib/authSession'
import { StudentShell } from '@/components/layouts/StudentShell'
import { beginnerApi, type BeginnerSessionResponse, type BeginnerItem } from '@/lib/beginnerApi'
import { usePageTimeTracker } from '@/hooks/usePageTimeTracker'

type Me = { displayName: string; role: string }

export default function BeginnerPage() {
  usePageTimeTracker('beginner');
  const router = useRouter()
  const [me, setMe] = useState<Me | null>(null)
  const [session, setSession] = useState<BeginnerSessionResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!getAccessToken()) { router.push('/login'); return }
    ;(async () => {
      try {
        const [meRes, sessionRes] = await Promise.allSettled([
          api.get<Me>('/auth/me'),
          beginnerApi.getFirstSession(),
        ])
        if (meRes.status === 'fulfilled') setMe(meRes.value.data)
        if (sessionRes.status === 'fulfilled') setSession(sessionRes.value.data)
        else setError('Không thể tải bài học. Vui lòng thử lại.')
      } finally {
        setLoading(false)
      }
    })()
  }, [router])

  const handleLogout = useCallback(() => { clearTokens(); router.push('/') }, [router])

  async function handleComplete() {
    if (completing || completed) return
    setCompleting(true)
    try {
      await beginnerApi.completeFirstSession()
      setCompleted(true)
    } catch {
      setError('Không thể lưu tiến trình. Vui lòng thử lại.')
    } finally {
      setCompleting(false)
    }
  }

  function speakWord(text: string) {
    if (typeof window === 'undefined') return
    const utt = new SpeechSynthesisUtterance(text)
    utt.lang = 'de-DE'
    utt.rate = 0.85
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utt)
  }

  if (!me) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-[#121212] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const initials = me.displayName.split(' ').map((p) => p.charAt(0)).join('').slice(0, 2).toUpperCase()
  const shellProps = {
    activeSection: 'dashboard' as const,
    user: { displayName: me.displayName, role: me.role },
    targetLevel: 'A1',
    streakDays: 0,
    initials,
    onLogout: handleLogout,
    headerTitle: 'Ngày 1 — Bắt đầu!',
  }

  if (loading) {
    return (
      <StudentShell {...shellProps}>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-8 h-8 border-3 border-[#121212] border-t-transparent rounded-full animate-spin" />
        </div>
      </StudentShell>
    )
  }

  if (error && !session) {
    return (
      <StudentShell {...shellProps}>
        <div className="max-w-xl mx-auto px-4 py-16 text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button onClick={() => window.location.reload()} className="px-6 py-2.5 bg-[#121212] text-white rounded-xl text-sm font-semibold">
            Thử lại
          </button>
        </div>
      </StudentShell>
    )
  }

  const vocabItems = session?.items.filter(i => i.itemType === 'VOCABULARY') ?? []
  const phraseItems = session?.items.filter(i => i.itemType !== 'VOCABULARY') ?? []

  return (
    <StudentShell {...shellProps}>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#121212] rounded-[24px] px-6 py-7 text-white"
        >
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={16} className="text-[#FFCD00]" />
            <span className="text-xs font-bold uppercase tracking-widest text-white/50">Buổi học đầu tiên</span>
          </div>
          <h1 className="text-2xl font-extrabold mb-2">Ngày 1 — Xin chào!</h1>
          <p className="text-sm text-white/70 leading-relaxed">{session?.welcomeMessage}</p>
        </motion.div>

        {/* Vocabulary cards */}
        {vocabItems.length > 0 && (
          <section>
            <h2 className="text-sm font-bold uppercase tracking-widest text-[#94A3B8] mb-3 px-1">
              Từ vựng hôm nay
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {vocabItems.map((item, i) => (
                <VocabCard key={item.sequenceOrder} item={item} index={i} onSpeak={speakWord} />
              ))}
            </div>
          </section>
        )}

        {/* Phrases */}
        {phraseItems.length > 0 && (
          <section>
            <h2 className="text-sm font-bold uppercase tracking-widest text-[#94A3B8] mb-3 px-1">
              Câu hội thoại
            </h2>
            <div className="space-y-2">
              {phraseItems.map(item => (
                <PhraseRow key={item.sequenceOrder} item={item} onSpeak={speakWord} />
              ))}
            </div>
          </section>
        )}

        {/* Speaking CTA */}
        <div className="bg-amber-50 border border-amber-200 rounded-[20px] p-5">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-amber-400 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Mic size={16} className="text-white" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-amber-900 text-sm mb-1">Bây giờ hãy thử nói!</p>
              <p className="text-xs text-amber-700 mb-3">{session?.firstSpeakingPrompt}</p>
              <Link
                href="/speaking"
                className="inline-flex items-center gap-1.5 bg-amber-400 text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-amber-500 transition-colors"
              >
                Nói với AI <ChevronRight size={12} />
              </Link>
            </div>
          </div>
        </div>

        {/* Complete button */}
        {!completed ? (
          <button
            onClick={handleComplete}
            disabled={completing}
            className="w-full py-4 bg-[#121212] text-white font-extrabold rounded-[16px] flex items-center justify-center gap-2 hover:bg-[#1e1e1e] transition-colors disabled:opacity-60"
          >
            {completing ? (
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <CheckCircle2 size={18} />
                Hoàn thành buổi học đầu tiên
              </>
            )}
          </button>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full py-4 bg-emerald-50 border border-emerald-200 rounded-[16px] flex flex-col items-center gap-1"
          >
            <div className="flex items-center gap-2 text-emerald-700 font-bold">
              <Star size={16} className="fill-emerald-500 text-emerald-500" />
              Tuyệt vời! Buổi học đầu tiên hoàn thành!
            </div>
            <p className="text-xs text-emerald-600">{session?.encouragement}</p>
            <div className="flex gap-3 mt-3">
              <Link href="/dashboard" className="text-xs text-[#64748B] underline">
                Về trang chủ
              </Link>
              <Link href="/speaking" className="text-xs font-bold text-emerald-700">
                Nói chuyện với AI →
              </Link>
            </div>
          </motion.div>
        )}

      </div>
    </StudentShell>
  )
}

function VocabCard({ item, index, onSpeak }: { item: BeginnerItem; index: number; onSpeak: (t: string) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="bg-white border border-[#E2E8F0] rounded-[18px] p-4 shadow-sm"
    >
      <div className="flex items-start justify-between mb-2">
        <span className="text-2xl font-extrabold text-[#0F172A] leading-tight">{item.titleDe}</span>
        <button
          onClick={() => onSpeak(item.titleDe)}
          className="w-8 h-8 rounded-full bg-[#F1F4F9] flex items-center justify-center hover:bg-[#E2E8F0] transition-colors flex-shrink-0"
          aria-label={`Nghe "${item.titleDe}"`}
        >
          <Volume2 size={14} className="text-[#64748B]" />
        </button>
      </div>
      <p className="text-sm text-[#64748B] font-medium">{item.titleVi}</p>
      {item.exampleDe && (
        <p className="text-xs text-[#94A3B8] mt-2 italic">&bdquo;{item.exampleDe}&ldquo;</p>
      )}
      {item.audioHint && (
        <p className="text-[10px] text-[#CBD5E1] mt-1">/{item.audioHint}/</p>
      )}
    </motion.div>
  )
}

function PhraseRow({ item, onSpeak }: { item: BeginnerItem; onSpeak: (t: string) => void }) {
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-[14px] px-4 py-3 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="font-bold text-[#0F172A] text-sm truncate">{item.titleDe}</p>
        <p className="text-xs text-[#64748B]">{item.titleVi}</p>
      </div>
      <button
        onClick={() => onSpeak(item.titleDe)}
        className="w-8 h-8 rounded-full bg-[#F1F4F9] flex items-center justify-center hover:bg-[#E2E8F0] transition-colors flex-shrink-0"
        aria-label={`Nghe "${item.titleDe}"`}
      >
        <Volume2 size={13} className="text-[#64748B]" />
      </button>
    </div>
  )
}
