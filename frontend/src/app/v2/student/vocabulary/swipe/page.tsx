'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { motion } from 'framer-motion'
import { ArrowLeft, RotateCcw } from 'lucide-react'
import api from '@/lib/api'
import { primeGermanVoices } from '@/lib/speechDe'
import { shuffle, type WordListResponse } from '@/lib/vocabWords'
import { useStudentPracticeSession } from '@/hooks/useStudentPracticeSession'
import { useTracking } from '@/hooks/useTracking'
import { GaBtn, GaCap, GaCard, GaPageHdr, ErrorBanner, LoadingState, TkSeg } from '@/components/ui-v2'
import { SwipeCard, CARD_COLOR, mapWordToSwipe, type CardMode, type SwipeCardData } from './SwipeCard'

/**
 * /v2/student/vocabulary/swipe — thẻ vuốt der/die/das (port của /student/swipe-cards).
 *
 * Giữ nguyên: GET /words?size=20&page=0&locale&cefr[&tag] · 2 chế độ flip/type · vuốt phải =
 * đã thuộc, vuốt trái = ôn lại · PostHog swipe_cards started/completed/quit.
 * Deep-link contract giữ nguyên: ?cefr= ?tag=
 */

const LEVELS = ['A1', 'A2', 'B1', 'B2'] as const
type Level = (typeof LEVELS)[number]

function SwipeCards() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useTranslations('v2.student.swipeCards')
  const uiLocale = useLocale()
  const urlCefrQ = (searchParams.get('cefr') ?? '').trim().toUpperCase()
  const urlTagQ = (searchParams.get('tag') ?? '').trim()

  const { me, loading: sessionLoading, practiceFloorLevel, reload } = useStudentPracticeSession()
  const { trackFeatureAction } = useTracking()

  const deckCefr = useMemo(
    () => ((LEVELS as readonly string[]).includes(urlCefrQ) ? (urlCefrQ as Level) : practiceFloorLevel),
    [practiceFloorLevel, urlCefrQ],
  )

  const [deck, setDeck] = useState<SwipeCardData[]>([])
  const [deckLoading, setDeckLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [poolTotal, setPoolTotal] = useState<number | null>(null)
  const [learnedIds, setLearnedIds] = useState<Set<number>>(new Set())
  const [reviewIds, setReviewIds] = useState<Set<number>>(new Set())
  const [showComplete, setShowComplete] = useState(false)
  const [mode, setMode] = useState<CardMode>('flip')

  useEffect(() => {
    primeGermanVoices()
  }, [])

  useEffect(() => {
    if (!me || sessionLoading) return
    let cancelled = false
    setDeckLoading(true)
    setLoadError('')
    ;(async () => {
      try {
        const wordsRes = await api.get<WordListResponse>('/words', {
          params: {
            size: 20,
            page: 0,
            locale: uiLocale || 'de',
            cefr: deckCefr,
            ...(urlTagQ ? { tag: urlTagQ } : {}),
          },
        })
        if (cancelled) return
        const loc = uiLocale || 'de'
        setPoolTotal(Number.isFinite(wordsRes.data.total) ? wordsRes.data.total : null)
        const cards = shuffle((wordsRes.data.items ?? []).map((w) => mapWordToSwipe(w, loc)))
        setDeck(cards)
        if (cards.length > 0) {
          trackFeatureAction('swipe_cards', 'started', { cefr: deckCefr, tag: urlTagQ, mode })
        }
      } catch {
        if (!cancelled) setLoadError(t('loadError'))
      } finally {
        if (!cancelled) setDeckLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [deckCefr, me, mode, sessionLoading, t, trackFeatureAction, uiLocale, urlTagQ])

  const remaining = useMemo(
    () => deck.filter((c) => !learnedIds.has(c.id) && !reviewIds.has(c.id)),
    [deck, learnedIds, reviewIds],
  )

  const total = deck.length
  const done = learnedIds.size + reviewIds.size
  const currentCard = remaining[0]

  const handleSwipe = useCallback(
    (dir: 'learned' | 'unlearned') => {
      if (!currentCard) return
      if (dir === 'learned') setLearnedIds((s) => new Set(s).add(currentCard.id))
      else setReviewIds((s) => new Set(s).add(currentCard.id))

      if (remaining.length <= 1) {
        setTimeout(() => {
          setShowComplete(true)
          trackFeatureAction('swipe_cards', 'completed', {
            learned: learnedIds.size + (dir === 'learned' ? 1 : 0),
            review: reviewIds.size + (dir === 'unlearned' ? 1 : 0),
            mode,
          })
        }, 200)
      }
    },
    [currentCard, learnedIds.size, mode, remaining.length, reviewIds.size, trackFeatureAction],
  )

  const restart = useCallback(() => {
    setLearnedIds(new Set())
    setReviewIds(new Set())
    setShowComplete(false)
    setDeck((d) => shuffle(d))
  }, [])

  if (sessionLoading) return <LoadingState label={t('loading')} />

  if (!me) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-4 px-10 py-16">
        <p className="ga-ui max-w-md text-center text-[14px] text-ga-muted">{t('profileError')}</p>
        <GaBtn variant="ghost" onClick={() => void reload()}>
          {t('retry')}
        </GaBtn>
      </div>
    )
  }

  const pct = total > 0 ? Math.round((learnedIds.size / total) * 100) : 0
  const inDeck = !showComplete && deck.length > 0 && !loadError

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr
        accent
        title={t('title')}
        subtitle={mode === 'type' ? t('subtitleType') : t('subtitleFlip')}
        right={
          inDeck && total ? (
            <span className="ga-ui text-[13px] font-semibold text-ga-muted">
              {Math.min(done + 1, total)} / {total}
            </span>
          ) : null
        }
      />

      <div className="flex-1 px-10 py-6">
        <div className="mx-auto max-w-md space-y-[22px]">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                if (inDeck) trackFeatureAction('swipe_cards', 'quit', { progress: done, total, mode })
                router.push('/v2/student/vocabulary')
              }}
              className="grid h-9 w-9 place-items-center rounded-ga border border-ga-line bg-ga-card text-ga-muted transition-colors hover:bg-ga-surface"
              aria-label={t('back')}
            >
              <ArrowLeft size={16} aria-hidden />
            </button>
            {poolTotal != null ? <GaCap>{t('wordsInPool', { count: poolTotal })}</GaCap> : <span />}
            <TkSeg
              aria-label={t('modeLabel')}
              options={[
                { value: 'flip' as CardMode, label: t('modeFlip') },
                { value: 'type' as CardMode, label: t('modeType') },
              ]}
              value={mode}
              onValueChange={(v) => {
                if (v === mode) return
                setMode(v)
                restart()
              }}
            />
          </div>

          {loadError && <ErrorBanner message={loadError} />}

          {deckLoading ? (
            <LoadingState label={t('loading')} />
          ) : !deck.length && !loadError ? (
            <GaCard className="px-7 py-14 text-center">
              <p className="font-ga-display text-[20px] font-medium text-ga-ink">{t('noWords')}</p>
            </GaCard>
          ) : showComplete ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <GaCard className="flex flex-col items-center gap-4 px-6 py-8">
                <span className="text-[40px]" aria-hidden>
                  🏆
                </span>
                <p className="font-ga-display text-[24px] font-medium text-ga-ink">{t('sessionEnd')}</p>
                <div className="grid w-full grid-cols-3 gap-2 text-center">
                  {[
                    { value: learnedIds.size, label: t('learned'), color: 'var(--ga-green)' },
                    { value: `${pct}%`, label: t('score'), color: 'var(--ga-blue)' },
                    { value: reviewIds.size, label: t('review'), color: 'var(--ga-red)' },
                  ].map((s) => (
                    <div key={s.label} className="rounded-ga border border-ga-line bg-ga-surface p-3">
                      <p className="font-ga-display text-[22px] font-medium" style={{ color: s.color }}>
                        {s.value}
                      </p>
                      <p className="ga-ui text-[11px] text-ga-muted">{s.label}</p>
                    </div>
                  ))}
                </div>
                <GaBtn variant="primary" size="lg" className="w-full" onClick={restart}>
                  <RotateCcw size={16} aria-hidden /> {t('again')}
                </GaBtn>
              </GaCard>
            </motion.div>
          ) : (
            <div className="flex flex-col">
              <div className="relative mx-auto w-full" style={{ height: 420 }}>
                {[remaining[2], remaining[1], remaining[0]].map((card, i) => {
                  if (!card) return null
                  const stackPos = (2 - i) as 0 | 1 | 2
                  return (
                    <SwipeCard
                      key={`${card.id}-${i}`}
                      card={card}
                      stackIndex={stackPos}
                      onSwipe={handleSwipe}
                      mode={mode}
                      t={t}
                    />
                  )
                })}
              </div>
              <p className="ga-ui mt-5 px-2 text-center text-[12px] text-ga-subtle">
                {mode === 'type' ? t('typeHint') : t('swipeHint')}
              </p>
              {currentCard ? (
                <p className="ga-ui mt-1 text-center text-[11px] text-ga-faint">
                  {CARD_COLOR[currentCard.type].label} · {CARD_COLOR[currentCard.type].tag}
                </p>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// useSearchParams() → phải bọc <Suspense>, nếu không build prerender GÃY.
export default function V2StudentSwipeCardsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <SwipeCards />
    </Suspense>
  )
}
