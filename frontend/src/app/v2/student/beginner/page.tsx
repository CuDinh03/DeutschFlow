'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ArrowRight, CheckCircle2, Mic, Sparkles, Star, Volume2 } from 'lucide-react'
import { beginnerApi, type BeginnerItem, type BeginnerSessionResponse } from '@/lib/beginnerApi'
import { usePageTimeTracker } from '@/hooks/usePageTimeTracker'
import { GaBtn, GaCap, GaCard, GaPageHdr, ErrorBanner, LoadingState } from '@/components/ui-v2'

// ─────────────────────────────────────────────────────────────────────────────
// /v2/student/beginner — "Ngày 1", the very first session (Galerie shell).
//
// Port of /student/beginner: same endpoints via beginnerApi —
//   GET  /beginner/first-session
//   POST /beginner/first-session/complete
// Same split (VOCABULARY items → cards · everything else → phrase rows), same browser
// speechSynthesis pronunciation (de-DE, rate 0.85 — no TTS backend call), same completion flow.
// Only the shell changed; the speaking CTA now points at /v2/student/speaking.
//
// NOTE: /v2/student/welcome is a static orientation page — it does NOT call beginnerApi and does
// not replace this screen.
// ─────────────────────────────────────────────────────────────────────────────

export default function V2StudentBeginnerPage() {
  usePageTimeTracker('beginner')
  const t = useTranslations('v2.student.beginner')

  const [session, setSession] = useState<BeginnerSessionResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    setError(null)
    beginnerApi
      .getFirstSession()
      .then((res) => setSession(res.data))
      .catch(() => setError(t('loadError')))
      .finally(() => setLoading(false))
  }
  useEffect(load, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleComplete() {
    if (completing || completed) return
    setCompleting(true)
    try {
      await beginnerApi.completeFirstSession()
      setCompleted(true)
    } catch {
      setError(t('completeError'))
    } finally {
      setCompleting(false)
    }
  }

  function speakWord(text: string) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    const utt = new SpeechSynthesisUtterance(text)
    utt.lang = 'de-DE'
    utt.rate = 0.85
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utt)
  }

  const vocabItems = session?.items.filter((i) => i.itemType === 'VOCABULARY') ?? []
  const phraseItems = session?.items.filter((i) => i.itemType !== 'VOCABULARY') ?? []

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr accent title={t('title')} subtitle={t('subtitle')} />

      <div className="flex-1 px-10 py-6">
        {loading ? (
          <LoadingState label={t('loading')} />
        ) : error && !session ? (
          <ErrorBanner variant="page" message={error} onRetry={load} />
        ) : (
          <div className="space-y-[22px]">
            {error && <ErrorBanner message={error} />}

            {/* Hero */}
            <div className="bg-ga-ink p-7 text-ga-bg">
              <GaCap className="mb-2 flex items-center gap-1.5" style={{ color: '#A39E94' }}>
                <Sparkles size={13} style={{ color: 'var(--ga-yellow)' }} aria-hidden />
                {t('heroCap')}
              </GaCap>
              <p className="font-ga-display text-[28px] font-medium">{t('heroTitle')}</p>
              <p className="ga-ui mt-2 max-w-2xl text-[14.5px] leading-relaxed" style={{ color: '#A39E94' }}>
                {session?.welcomeMessage}
              </p>
            </div>

            {/* Vocabulary */}
            {vocabItems.length > 0 && (
              <div>
                <GaCap className="mb-3 block">{t('vocabCap')}</GaCap>
                <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2 xl:grid-cols-3">
                  {vocabItems.map((item) => (
                    <VocabCard key={item.sequenceOrder} item={item} onSpeak={speakWord} />
                  ))}
                </div>
              </div>
            )}

            {/* Phrases */}
            {phraseItems.length > 0 && (
              <div>
                <GaCap className="mb-3 block">{t('phrasesCap')}</GaCap>
                <div className="border border-ga-line bg-ga-card">
                  {phraseItems.map((item, i) => (
                    <div
                      key={item.sequenceOrder}
                      className="flex items-center gap-3.5 px-5 py-3.5"
                      style={{ borderTop: i ? '1px solid var(--ga-border)' : 'none' }}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-[14.5px] font-semibold text-ga-ink">{item.titleDe}</p>
                        <p className="ga-ui text-[12.5px] text-ga-muted">{item.titleVi}</p>
                      </div>
                      <SpeakBtn label={t('listen', { text: item.titleDe })} onClick={() => speakWord(item.titleDe)} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Speaking CTA */}
            <div
              className="flex flex-wrap items-center gap-4 border p-5"
              style={{ background: 'var(--ga-yellow-soft)', borderColor: 'color-mix(in srgb, var(--ga-gold) 40%, transparent)' }}
            >
              <span
                className="grid h-11 w-11 shrink-0 place-items-center rounded-ga"
                style={{ background: 'var(--ga-yellow)', color: 'var(--ga-ink)' }}
              >
                <Mic size={20} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[14.5px] font-semibold text-ga-ink">{t('speakingCta')}</p>
                <p className="ga-ui mt-0.5 text-[13px] text-ga-muted">{session?.firstSpeakingPrompt}</p>
              </div>
              <GaBtn variant="yellow" asChild>
                <Link href="/v2/student/speaking">
                  {t('speakWithAi')} <ArrowRight size={14} aria-hidden />
                </Link>
              </GaBtn>
            </div>

            {/* Complete */}
            {!completed ? (
              <GaBtn variant="ink" size="lg" className="w-full" loading={completing} onClick={handleComplete}>
                <CheckCircle2 size={18} aria-hidden /> {t('completeCta')}
              </GaBtn>
            ) : (
              <div
                className="flex flex-col items-center gap-1.5 border px-6 py-6 text-center"
                style={{ background: 'var(--ga-green-soft)', borderColor: 'var(--ga-green)' }}
              >
                <p
                  className="inline-flex items-center gap-2 font-ga-display text-[20px] font-medium"
                  style={{ color: 'var(--ga-green)' }}
                >
                  <Star size={16} className="fill-current" aria-hidden />
                  {t('completedTitle')}
                </p>
                <p className="ga-ui text-[13px] text-ga-muted">{session?.encouragement}</p>
                <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
                  <GaBtn variant="ghost" size="sm" asChild>
                    <Link href="/v2/student/dashboard">{t('backToDashboard')}</Link>
                  </GaBtn>
                  <GaBtn variant="primary" size="sm" asChild>
                    <Link href="/v2/student/speaking">
                      {t('speakWithAi')} <ArrowRight size={14} aria-hidden />
                    </Link>
                  </GaBtn>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function VocabCard({ item, onSpeak }: { item: BeginnerItem; onSpeak: (text: string) => void }) {
  const t = useTranslations('v2.student.beginner')
  return (
    <GaCard className="p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="font-ga-display text-[26px] font-medium leading-tight text-ga-ink">{item.titleDe}</p>
        <SpeakBtn label={t('listen', { text: item.titleDe })} onClick={() => onSpeak(item.titleDe)} />
      </div>
      <p className="ga-ui mt-1.5 text-[13.5px] font-semibold text-ga-muted">{item.titleVi}</p>
      {item.exampleDe && <p className="ga-ui mt-2.5 text-[12.5px] italic text-ga-subtle">&bdquo;{item.exampleDe}&ldquo;</p>}
      {item.audioHint && <p className="ga-ui mt-1 text-[11.5px] text-ga-subtle">/{item.audioHint}/</p>}
    </GaCard>
  )
}

function SpeakBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid h-8 w-8 shrink-0 place-items-center rounded-ga border border-ga-line bg-ga-card text-ga-muted transition-colors hover:bg-ga-surface hover:text-ga-ink"
    >
      <Volume2 size={14} aria-hidden />
    </button>
  )
}
