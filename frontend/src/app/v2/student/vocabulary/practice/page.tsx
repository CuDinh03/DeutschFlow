'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Eye,
  EyeOff,
  Mic,
  MicOff,
  RefreshCw,
  SkipForward,
  Trophy,
  Volume2,
  XCircle,
} from 'lucide-react'
import api from '@/lib/api'
import { getAccessToken } from '@/lib/authSession'
import { primeGermanVoices, speakGerman } from '@/lib/speechDe'
import { isAcceptedHeardForWord } from '@/lib/scoring/textScoring'
import { shouldShowKlausChefGuide } from '@/lib/restaurantTopicCoach'
import { articleOf, genderColor, shuffle, wordWithArticle } from '@/lib/vocabWords'
import type { TagItem, WordListItem, WordListResponse } from '@/lib/vocabWords'
import { KlausCharacter } from '@/components/speaking/characters/KlausCharacter'
import { useStudentPracticeSession } from '@/hooks/useStudentPracticeSession'
import { useTracking } from '@/hooks/useTracking'
import { GaBtn, GaCap, GaCard, GaPageHdr, ErrorBanner, LoadingState, TkSeg } from '@/components/ui-v2'

/**
 * /v2/student/vocabulary/practice — luyện NÓI từ vựng (port của /student/vocab-practice).
 *
 * Giữ nguyên: GET /tags?locale&topicsOnly=true · GET /words?cefr&locale&size&page[&tag][&topic][&focus]
 * (preview size=1 để đếm, vào luyện size=30), Web Speech API de-DE, chấm bằng
 * isAcceptedHeardForWord(), PostHog vocab_practice started/completed/quit.
 * Deep-link contract giữ nguyên: ?cefr= ?topic= ?focus=
 *
 * ⚠️ Mạo từ der/die/das luôn được đọc kèm (speakGerman("der Tisch")) và hiện trên thẻ.
 */

const CEFR_LEVELS = [
  { id: 'A1', desc: 'cefrA1Desc' },
  { id: 'A2', desc: 'cefrA2Desc' },
  { id: 'B1', desc: 'cefrB1Desc' },
  { id: 'B2', desc: 'cefrB2Desc' },
] as const

type Level = (typeof CEFR_LEVELS)[number]['id']

interface PracticeResult {
  word: WordListItem
  heard: string
  correct: boolean
}

type Screen = 'setup' | 'practicing' | 'summary'
type MicState = 'idle' | 'listening' | 'processing'
type Verdict = 'correct' | 'wrong' | null

const isLevel = (v: string): v is Level => CEFR_LEVELS.some((l) => l.id === v)

function VocabPractice() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useTranslations('v2.student.vocabPractice')
  const locale = useLocale()
  const urlTopic = (searchParams.get('topic') ?? '').trim()
  const urlFocus = (searchParams.get('focus') ?? '').trim()
  const urlCefr = (searchParams.get('cefr') ?? '').trim().toUpperCase()
  const { trackFeatureAction } = useTracking()

  const { me, loading: authLoading, practiceFloorLevel, reload } = useStudentPracticeSession()

  useEffect(() => {
    primeGermanVoices()
  }, [])

  const [screen, setScreen] = useState<Screen>('setup')
  const [tags, setTags] = useState<TagItem[]>([])
  const [selTag, setSelTag] = useState('') // '' = tất cả chủ đề
  const [selCefr, setSelCefr] = useState<Level>('B1')
  const [words, setWords] = useState<WordListItem[]>([])
  const [idx, setIdx] = useState(0)
  const [results, setResults] = useState<PracticeResult[]>([])
  const [verdict, setVerdict] = useState<Verdict>(null)
  const [heard, setHeard] = useState('')
  const [micState, setMicState] = useState<MicState>('idle')
  const [showMeaning, setShowMeaning] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewTotal, setPreviewTotal] = useState<number | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  const showKlausCoach = useMemo(
    () => shouldShowKlausChefGuide({ selTag, urlTopic, tags }),
    [selTag, urlTopic, tags],
  )

  const recognitionRef = useRef<SpeechRecognition | null>(null)

  const buildWordsParams = useCallback(
    (size: string): Record<string, string> => {
      const params: Record<string, string> = { cefr: selCefr, locale, size, page: '0' }
      if (selTag) params.tag = selTag
      if (urlTopic) params.topic = urlTopic
      if (urlFocus) params.focus = urlFocus
      return params
    },
    [selCefr, selTag, locale, urlTopic, urlFocus],
  )

  // Deep-link ?cefr= thắng; nếu không có thì lấy mức sàn luyện tập của học viên.
  useEffect(() => {
    if (isLevel(urlCefr)) setSelCefr(urlCefr)
  }, [urlCefr])

  useEffect(() => {
    if (isLevel(urlCefr)) return
    if (isLevel(practiceFloorLevel)) setSelCefr(practiceFloorLevel)
  }, [practiceFloorLevel, urlCefr])

  useEffect(() => {
    api
      .get<TagItem[]>('/tags', { params: { locale, topicsOnly: 'true' } })
      .then((r) => setTags(r.data))
      .catch(() => {})
  }, [locale])

  // Đếm nhanh số từ khả dụng (backend đã lọc CEFR cộng dồn + tag).
  useEffect(() => {
    if (typeof window === 'undefined' || !getAccessToken()) return
    let alive = true
    const tid = window.setTimeout(() => {
      ;(async () => {
        setPreviewLoading(true)
        try {
          const res = await api.get<WordListResponse>('/words', { params: buildWordsParams('1') })
          if (!alive) return
          const n = res.data.total
          setPreviewTotal(Number.isFinite(n) ? n : null)
        } catch {
          if (alive) setPreviewTotal(null)
        } finally {
          if (alive) setPreviewLoading(false)
        }
      })()
    }, 280)
    return () => {
      alive = false
      window.clearTimeout(tid)
    }
  }, [buildWordsParams])

  // ?topic= trùng tên tag → preselect tag; nếu không, topic được truyền thẳng xuống /words.
  useEffect(() => {
    if (!urlTopic || tags.length === 0) return
    const match = tags.find(
      (tg) =>
        tg.name.toLowerCase() === urlTopic.toLowerCase() ||
        (tg.localizedLabel ?? '').toLowerCase() === urlTopic.toLowerCase(),
    )
    if (match) setSelTag(match.name)
  }, [urlTopic, tags])

  const handleStart = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get<WordListResponse>('/words', { params: buildWordsParams('30') })
      const list = res.data.items ?? []
      if (list.length === 0) {
        setError(t('noWords'))
        return
      }
      const shuffled = shuffle(list)
      setWords(shuffled)
      setIdx(0)
      setResults([])
      setVerdict(null)
      setHeard('')
      setShowMeaning(false)
      setScreen('practicing')
      trackFeatureAction('vocab_practice', 'started', { cefr: selCefr, tag: selTag, size: 30 })
      setTimeout(() => speakGerman(wordWithArticle(shuffled[0])), 500)
    } catch {
      setError(t('loadError'))
    } finally {
      setLoading(false)
    }
  }, [buildWordsParams, selCefr, selTag, t, trackFeatureAction])

  const handleListen = useCallback(() => {
    const w = words[idx]
    if (w) speakGerman(wordWithArticle(w))
  }, [words, idx])

  const handleMic = useCallback(() => {
    if (micState === 'listening') {
      recognitionRef.current?.stop()
      setMicState('idle')
      return
    }

    const SR =
      typeof window !== 'undefined' ? (window.SpeechRecognition ?? window.webkitSpeechRecognition) : null
    if (!SR) {
      setError(t('speechNotSupported'))
      return
    }

    const rec = new SR()
    rec.lang = 'de-DE'
    rec.continuous = false
    rec.interimResults = false
    rec.maxAlternatives = 3

    rec.onstart = () => setMicState('listening')
    rec.onend = () => setMicState((prev) => (prev === 'listening' ? 'idle' : prev))
    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      setMicState('idle')
      if (e.error !== 'no-speech') setError(t('micError'))
    }
    rec.onresult = (e: SpeechRecognitionEvent) => {
      setMicState('processing')
      const transcript = e.results[0][0].transcript.trim()
      setHeard(transcript)
      const word = words[idx]
      const ok = isAcceptedHeardForWord(transcript, word.baseForm)
      setVerdict(ok ? 'correct' : 'wrong')
      setShowMeaning(true)
      setResults((prev) => [...prev, { word, heard: transcript, correct: ok }])
      if (ok) speakGerman('Richtig!')
      setMicState('idle')
    }

    recognitionRef.current = rec
    rec.start()
  }, [micState, words, idx, t])

  const handleNext = useCallback(() => {
    if (idx + 1 >= words.length) {
      setScreen('summary')
      trackFeatureAction('vocab_practice', 'completed', {
        score: results.filter((r) => r.correct).length,
        total: results.length,
      })
      return
    }
    const next = idx + 1
    setIdx(next)
    setVerdict(null)
    setHeard('')
    setShowMeaning(false)
    setTimeout(() => speakGerman(wordWithArticle(words[next])), 300)
  }, [idx, results, trackFeatureAction, words])

  const handleSkip = useCallback(() => {
    if (verdict === null) {
      setResults((prev) => [...prev, { word: words[idx], heard: '', correct: false }])
    }
    handleNext()
  }, [verdict, words, idx, handleNext])

  const handleRestart = useCallback(() => {
    setScreen('setup')
    setWords([])
    setIdx(0)
    setResults([])
    setVerdict(null)
    setHeard('')
  }, [])

  const score = results.filter((r) => r.correct).length
  const total = results.length
  const pct = total > 0 ? Math.round((score / total) * 100) : 0

  if (authLoading) return <LoadingState label={t('loading')} />

  if (!me) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-4 px-4 py-16 sm:px-6 lg:px-10">
        <p className="ga-ui max-w-md text-center text-[14px] text-ga-muted">{t('profileError')}</p>
        <GaBtn variant="ghost" onClick={() => void reload()}>
          {t('retry')}
        </GaBtn>
      </div>
    )
  }

  const current = words[idx]

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr
        accent
        title={t('title')}
        subtitle={t('subtitle')}
        right={
          screen === 'practicing' ? (
            <span className="ga-ui text-[13px] font-semibold text-ga-muted">
              {idx + 1}/{words.length} · ✓ {score}
            </span>
          ) : null
        }
      />

      <div className="relative flex-1 px-4 py-6 sm:px-6 lg:px-10">
        {showKlausCoach && screen !== 'summary' ? (
          <div className="pointer-events-none fixed bottom-6 right-6 z-30 hidden w-[110px] lg:block">
            <KlausCharacter
              expression={micState === 'listening' ? 'talking' : 'neutral'}
              isTalking={micState === 'listening'}
              className="opacity-95 drop-shadow-2xl"
            />
          </div>
        ) : null}

        <div className="mx-auto max-w-2xl space-y-[22px]">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                if (screen === 'practicing') {
                  trackFeatureAction('vocab_practice', 'quit', { progress: idx, total: words.length })
                }
                if (screen === 'setup') router.push('/v2/student/vocabulary')
                else handleRestart()
              }}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-ga border border-ga-line bg-ga-card text-ga-muted transition-colors hover:bg-ga-surface lg:h-9 lg:w-9"
              aria-label={t('back')}
            >
              <ArrowLeft size={16} aria-hidden />
            </button>
            <GaCap>{t('badge')}</GaCap>
          </div>

          {error && <ErrorBanner message={error} onRetry={screen === 'setup' ? handleStart : undefined} />}

          {/* ── SETUP */}
          {screen === 'setup' && (
            <>
              <GaCard className="p-4 lg:p-6">
                <p className="font-ga-display text-[20px] font-medium leading-snug text-ga-ink lg:text-[24px]">
                  {t('heroTitle')}
                </p>
                <p className="ga-ui mt-2 text-[14px] text-ga-muted">{t('heroSubtitle')}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {[t('tag1'), t('tag2'), t('tag3')].map((label) => (
                    <span
                      key={label}
                      className="ga-ui rounded-ga-pill border border-ga-line px-2.5 py-1 text-[11.5px] font-semibold text-ga-muted"
                    >
                      {label}
                    </span>
                  ))}
                </div>
              </GaCard>

              <div>
                <GaCap className="mb-3 block">{t('chooseLevel')}</GaCap>
                <TkSeg
                  aria-label={t('chooseLevel')}
                  options={CEFR_LEVELS.map((l) => ({
                    value: l.id,
                    label: (
                      <span className="flex flex-col items-center leading-tight">
                        <span>{l.id}</span>
                        <span className="text-[10px] font-normal text-ga-subtle">{t(l.desc)}</span>
                      </span>
                    ),
                  }))}
                  value={selCefr}
                  onValueChange={setSelCefr}
                />
              </div>

              <div>
                <GaCap className="mb-3 block">{t('chooseTopic')}</GaCap>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSelTag('')}
                    className={`ga-ui inline-flex min-h-10 items-center justify-center rounded-ga border px-[14px] py-2 text-[12.5px] font-semibold transition-colors lg:min-h-0 ${
                      !selTag
                        ? 'border-ga-ink bg-ga-ink text-ga-card'
                        : 'border-ga-border bg-ga-card text-ga-muted hover:border-ga-ink hover:text-ga-ink'
                    }`}
                  >
                    {t('allTopics')}
                  </button>
                  {tags.map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => setSelTag(tag.name)}
                      className={`ga-ui inline-flex min-h-10 items-center justify-center rounded-ga border px-[14px] py-2 text-[12.5px] font-semibold transition-colors lg:min-h-0 ${
                        selTag === tag.name
                          ? 'border-ga-ink bg-ga-ink text-ga-card'
                          : 'border-ga-border bg-ga-card text-ga-muted hover:border-ga-ink hover:text-ga-ink'
                      }`}
                    >
                      {tag.localizedLabel ?? tag.name}
                    </button>
                  ))}
                </div>
                <p className="ga-ui mt-3 text-[12.5px] text-ga-subtle">
                  {previewLoading
                    ? t('wordCountChecking')
                    : previewTotal !== null
                      ? t('wordCountPreview', { count: previewTotal })
                      : null}
                </p>
              </div>

              <GaBtn variant="primary" size="lg" className="w-full" loading={loading} onClick={handleStart}>
                <Mic size={16} aria-hidden /> {loading ? t('loading') : t('startBtn')}
              </GaBtn>
            </>
          )}

          {/* ── PRACTICE */}
          {screen === 'practicing' && current && (
            <>
              <div className="h-1.5 overflow-hidden rounded-ga-pill bg-ga-border">
                <div
                  className="h-full rounded-ga-pill bg-ga-accent transition-[width]"
                  style={{ width: `${(idx / words.length) * 100}%` }}
                />
              </div>

              <GaCard
                className="border-2 p-4 text-center sm:p-6 lg:p-8"
                style={{
                  borderColor:
                    verdict === 'correct'
                      ? 'var(--ga-green)'
                      : verdict === 'wrong'
                        ? 'var(--ga-red)'
                        : 'var(--ga-line)',
                  background:
                    verdict === 'correct'
                      ? 'var(--ga-green-soft)'
                      : verdict === 'wrong'
                        ? 'var(--ga-red-soft)'
                        : undefined,
                }}
              >
                <div className="mb-3 flex items-center justify-between">
                  <span aria-hidden>
                    {verdict === 'correct' ? (
                      <CheckCircle2 size={20} style={{ color: 'var(--ga-green)' }} />
                    ) : verdict === 'wrong' ? (
                      <XCircle size={20} style={{ color: 'var(--ga-red)' }} />
                    ) : (
                      <span className="block h-5 w-5" />
                    )}
                  </span>
                  <span className="ga-ui rounded-ga border border-ga-line px-2 py-0.5 text-[10.5px] font-semibold text-ga-muted">
                    {current.cefrLevel}
                  </span>
                </div>

                {current.imageUrl ? (
                  <div className="mx-auto mb-5 max-w-xs overflow-hidden rounded-ga border border-ga-line">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={current.imageUrl}
                      alt=""
                      className="h-36 w-full object-cover"
                      onError={(e) => {
                        const parent = (e.target as HTMLImageElement).parentElement
                        if (parent) parent.style.display = 'none'
                      }}
                    />
                  </div>
                ) : null}

                {/* Mạo từ hiển thị riêng, đúng màu giống — KHÔNG BAO GIỜ ẩn. */}
                {articleLine(current)}

                <p className="break-words font-ga-display text-[26px] font-medium leading-tight text-ga-ink sm:text-[32px] lg:text-[40px]">
                  {current.baseForm}
                </p>
                {current.phonetic && (
                  <p className="ga-ui mt-2 text-[13px] text-ga-subtle">/{current.phonetic}/</p>
                )}

                {showMeaning && current.meaning && (
                  <p className="ga-ui mt-4 inline-block rounded-ga bg-ga-surface px-4 py-2 text-[14px] font-medium text-ga-ink">
                    {current.meaning}
                  </p>
                )}

                {heard && verdict === 'wrong' && (
                  <p className="ga-ui mt-4 text-[12.5px]" style={{ color: 'var(--ga-red)' }}>
                    {t('youSaid')}: “{heard}”
                  </p>
                )}
                {heard && verdict === 'correct' && (
                  <p className="ga-ui mt-4 text-[12.5px]" style={{ color: 'var(--ga-green)' }}>
                    “{heard}” ✓
                  </p>
                )}
              </GaCard>

              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowMeaning((v) => !v)}
                  className="grid h-11 w-11 place-items-center rounded-ga-pill border border-ga-line bg-ga-card text-ga-muted transition-colors hover:bg-ga-surface"
                  aria-label={t('toggleMeaning')}
                >
                  {showMeaning ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
                </button>

                <button
                  type="button"
                  onClick={handleListen}
                  className="grid h-12 w-12 place-items-center rounded-ga-pill border border-ga-line bg-ga-card transition-colors hover:bg-ga-surface"
                  style={{ color: 'var(--ga-orange)' }}
                  aria-label={t('listen')}
                >
                  <Volume2 size={20} aria-hidden />
                </button>

                <button
                  type="button"
                  onClick={micState === 'processing' ? undefined : handleMic}
                  disabled={verdict !== null || micState === 'processing'}
                  className="grid h-20 w-20 place-items-center rounded-ga-pill text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                  style={{
                    background:
                      micState === 'listening' ? 'var(--ga-red)' : 'var(--ga-accent)',
                    color: micState === 'listening' ? '#fff' : 'var(--ga-accent-ink)',
                  }}
                  aria-label={micState === 'listening' ? t('stopMic') : t('startMic')}
                >
                  {micState === 'listening' ? (
                    <MicOff size={28} aria-hidden />
                  ) : micState === 'processing' ? (
                    <span className="h-6 w-6 animate-spin rounded-full border-[3px] border-white/40 border-t-white" />
                  ) : (
                    <Mic size={28} aria-hidden />
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleSkip}
                  className="grid h-12 w-12 place-items-center rounded-ga-pill border border-ga-line bg-ga-card text-ga-muted transition-colors hover:bg-ga-surface"
                  aria-label={t('skip')}
                >
                  <SkipForward size={20} aria-hidden />
                </button>

                {verdict !== null && (
                  <button
                    type="button"
                    onClick={handleNext}
                    className="grid h-11 w-11 place-items-center rounded-ga-pill border transition-colors"
                    style={{ borderColor: 'var(--ga-green)', color: 'var(--ga-green)' }}
                    aria-label={t('next')}
                  >
                    <ChevronRight size={20} aria-hidden />
                  </button>
                )}
              </div>

              <p className="ga-ui text-center text-[12.5px] text-ga-subtle">
                {micState === 'listening'
                  ? t('listeningHint')
                  : verdict === null
                    ? t('tapMicHint')
                    : null}
              </p>
            </>
          )}

          {/* ── SUMMARY */}
          {screen === 'summary' && (
            <>
              <GaCard className="p-4 text-center sm:p-6 lg:p-8">
                <Trophy
                  size={40}
                  className="mx-auto mb-3"
                  style={{ color: pct >= 70 ? 'var(--ga-gold)' : 'var(--ga-subtle)' }}
                  aria-hidden
                />
                <p className="font-ga-display text-[32px] font-medium leading-none text-ga-ink sm:text-[38px] lg:text-[44px]">
                  {pct}%
                </p>
                <p className="ga-ui mt-2 text-[14px] text-ga-muted">
                  {score} / {total} {t('correct')}
                </p>
                <p className="ga-ui mt-1 text-[12.5px] text-ga-subtle">
                  {pct >= 90 ? t('excellent') : pct >= 70 ? t('good') : t('keepPracticing')}
                </p>
              </GaCard>

              {results.some((r) => !r.correct) && (
                <div>
                  <GaCap className="mb-3 block">{t('reviewWrong')}</GaCap>
                  <div className="rounded-ga border border-ga-line bg-ga-card">
                    {results
                      .filter((r) => !r.correct)
                      .map((r, i) => (
                        <div
                          key={`${r.word.id}-${i}`}
                          className={`flex items-center justify-between gap-3 px-4 py-3.5 lg:px-5 ${i ? 'border-t border-ga-border' : ''}`}
                        >
                          <div className="min-w-0">
                            <p className="break-words text-[14.5px] font-semibold text-ga-ink">
                              {articleOfInline(r.word)}
                              {r.word.baseForm}
                            </p>
                            {r.word.meaning && (
                              <p className="ga-ui text-[12px] text-ga-muted">{r.word.meaning}</p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => speakGerman(wordWithArticle(r.word))}
                            className="-m-3 shrink-0 p-3 text-ga-subtle transition-colors hover:text-ga-accent lg:m-0 lg:p-0"
                            aria-label={t('listen')}
                          >
                            <Volume2 size={16} aria-hidden />
                          </button>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <GaBtn variant="primary" size="lg" className="w-full" onClick={handleStart}>
                  <RefreshCw size={16} aria-hidden /> {t('practiceAgain')}
                </GaBtn>
                <GaBtn variant="ghost" size="lg" className="w-full" onClick={handleRestart}>
                  {t('changeTopic')}
                </GaBtn>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/** Dòng mạo từ trên thẻ — der/die/das theo màu giống (ràng buộc sư phạm cứng). */
function articleLine(word: WordListItem) {
  // Dùng articleOf(): nó tự lùi về `gender` (DER/DIE/DAS) khi `article` vắng/không chuẩn hoá.
  // Tự suy lại ở đây sẽ ĐÁNH RƠI mạo từ khi backend trả "Der" — đúng thứ không được phép mất.
  const art = articleOf(word)
  if (!art) return null
  return (
    <p className="ga-ui mb-1 text-[15px] font-semibold" style={{ color: genderColor(word) }}>
      {art}
    </p>
  )
}

/** Mạo từ inline (danh sách ôn lại) — cùng mã màu. */
function articleOfInline(word: WordListItem) {
  const art = articleOf(word)
  if (!art) return null
  return <span style={{ color: genderColor(word) }}>{art} </span>
}

// useSearchParams() ép nhánh này sang client bailout — thiếu <Suspense> là build prerender GÃY.
export default function V2StudentVocabPracticePage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <VocabPractice />
    </Suspense>
  )
}
