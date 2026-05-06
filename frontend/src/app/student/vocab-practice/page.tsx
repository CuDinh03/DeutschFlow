'use client'

import type React from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, CheckCircle2, ChevronRight, Eye, EyeOff, Mic, MicOff, RefreshCw, SkipForward, Trophy, Volume2, XCircle } from 'lucide-react'
import api from '@/lib/api'
import { speakGerman, primeGermanVoices } from '@/lib/speechDe'
import { getAccessToken, clearTokens, logout } from '@/lib/authSession'
import { isAcceptedHeardForWord } from '@/lib/scoring/textScoring'
import { StudentShell } from '@/components/layouts/StudentShell'
import { PracticeGlassSkeleton } from '@/components/practice/PracticeGlassSkeleton'
import { KlausCharacter } from '@/components/speaking/characters/KlausCharacter'
import { useStudentPracticeSession } from '@/hooks/useStudentPracticeSession'
import { shouldShowKlausChefGuide } from '@/lib/restaurantTopicCoach'

// ─── Constants ─────────────────────────────────────────────────────────────────

const CYAN   = '#22d3ee'
const PURPLE = '#a78bfa'
const GREEN  = '#4ade80'
const RED    = '#f87171'
const AMBER  = '#fbbf24'

const glass = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(10px)' }

const CEFR_LEVELS = [
  { id: 'A1', emoji: '🌱', color: GREEN,  desc: 'cefrA1Desc' },
  { id: 'A2', emoji: '🌿', color: CYAN,   desc: 'cefrA2Desc' },
  { id: 'B1', emoji: '🌟', color: PURPLE, desc: 'cefrB1Desc' },
  { id: 'B2', emoji: '🚀', color: AMBER,  desc: 'cefrB2Desc' },
] as const

// ─── Types ──────────────────────────────────────────────────────────────────────

interface TagItem { id: number; name: string; color?: string; localizedLabel?: string | null }

interface WordItem {
  id: number
  baseForm: string
  dtype: string
  cefrLevel: string
  phonetic?: string | null
  meaning?: string | null
  article?: string | null
  gender?: string | null
  tags?: string[]
}

interface PracticeResult {
  word: WordItem
  heard: string
  correct: boolean
}

interface WordListApiResponse {
  items: WordItem[]
  page: number
  size: number
  total: number
}

type Screen = 'setup' | 'practicing' | 'summary'
type MicState = 'idle' | 'listening' | 'processing'
type Verdict  = 'correct' | 'wrong' | null

function genderColor(g?: string | null): string {
  if (g === 'DER') return '#60a5fa'
  if (g === 'DIE') return '#f472b6'
  if (g === 'DAS') return '#a78bfa'
  return CYAN
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function VocabPracticePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const t      = useTranslations('vocabPractice')
  const locale = useLocale()
  const urlTopic = (searchParams.get('topic') ?? '').trim()
  const urlFocus = (searchParams.get('focus') ?? '').trim()
  const urlCefr = (searchParams.get('cefr') ?? '').trim().toUpperCase()

  const { me, loading: authLoading, targetLevel, practiceFloorLevel, streakDays, initials, reload } =
    useStudentPracticeSession()

  useEffect(() => {
    primeGermanVoices()
  }, [])

  // ── State
  const [screen,  setScreen]  = useState<Screen>('setup')
  const [tags,    setTags]    = useState<TagItem[]>([])
  const [selTag,  setSelTag]  = useState<string>('') // '' = all
  const [selCefr, setSelCefr] = useState<string>('B1')
  const [words,   setWords]   = useState<WordItem[]>([])
  const [idx,     setIdx]     = useState(0)
  const [results, setResults] = useState<PracticeResult[]>([])
  const [verdict, setVerdict] = useState<Verdict>(null)
  const [heard,   setHeard]   = useState('')
  const [micState, setMicState] = useState<MicState>('idle')
  const [showMeaning, setShowMeaning] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [previewTotal, setPreviewTotal] = useState<number | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  const showKlausCoach = useMemo(
    () => shouldShowKlausChefGuide({ selTag, urlTopic, tags }),
    [selTag, urlTopic, tags],
  )

  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const setupStartAnchorRef = useRef<HTMLDivElement | null>(null)

  const buildWordsParams = useCallback(
    (size: string): Record<string, string> => {
      const params: Record<string, string> = {
        cefr: selCefr,
        locale,
        size,
        page: '0',
      }
      if (selTag) params.tag = selTag
      if (urlTopic) params.topic = urlTopic
      if (urlFocus) params.focus = urlFocus
      return params
    },
    [selCefr, selTag, locale, urlTopic, urlFocus],
  )

  const scrollSetupStartIntoView = useCallback(() => {
    queueMicrotask(() => {
      setupStartAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }, [])

  // ── Deeplink level (?cefr=)
  useEffect(() => {
    if (urlCefr === 'A1' || urlCefr === 'A2' || urlCefr === 'B1' || urlCefr === 'B2') {
      setSelCefr(urlCefr)
    }
  }, [urlCefr])

  useEffect(() => {
    if (urlCefr === 'A1' || urlCefr === 'A2' || urlCefr === 'B1' || urlCefr === 'B2') return
    const p = practiceFloorLevel
    if (p === 'A1' || p === 'A2' || p === 'B1' || p === 'B2') setSelCefr(p)
  }, [practiceFloorLevel, urlCefr])

  // ── Load tags (localized — topic taxonomy only for learner pickers)
  useEffect(() => {
    api
      .get<TagItem[]>('/tags', { params: { locale, topicsOnly: 'true' } })
      .then(r => setTags(r.data))
      .catch(() => {})
  }, [locale])

  // Lightweight total for UX: backend already returns cumulative CEFR + tag filter.
  useEffect(() => {
    if (typeof window === 'undefined' || !getAccessToken()) return
    let alive = true
    const tid = window.setTimeout(() => {
      ;(async () => {
        setPreviewLoading(true)
        try {
          const res = await api.get<WordListApiResponse>('/words', { params: buildWordsParams('1') })
          if (!alive) return
          const n = res.data.total
          setPreviewTotal(Number.isFinite(n) ? n : null)
        } catch {
          if (!alive) return
          setPreviewTotal(null)
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

  // Deeplink: ?topic= matches a tag name → preselect tag; else topic is passed as search to /words
  useEffect(() => {
    if (!urlTopic || tags.length === 0) return
    const match = tags.find(
      (tg) => tg.name.toLowerCase() === urlTopic.toLowerCase() || (tg.localizedLabel ?? '').toLowerCase() === urlTopic.toLowerCase(),
    )
    if (match) setSelTag(match.name)
  }, [urlTopic, tags])

  // ── Start practice
  const handleStart = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get<WordListApiResponse>('/words', { params: buildWordsParams('30') })
      const list = res.data.items
      if (list.length === 0) {
        setError(t('noWords'))
        scrollSetupStartIntoView()
        return
      }
      // shuffle
      const shuffled = [...list].sort(() => Math.random() - 0.5)
      setWords(shuffled)
      setIdx(0)
      setResults([])
      setVerdict(null)
      setHeard('')
      setShowMeaning(false)
      setScreen('practicing')
      setTimeout(() => speakGerman((shuffled[0].article ? shuffled[0].article + ' ' : '') + shuffled[0].baseForm), 500)
    } catch {
      setError(t('loadError'))
      scrollSetupStartIntoView()
    } finally {
      setLoading(false)
    }
  }, [buildWordsParams, t, scrollSetupStartIntoView])

  // ── TTS
  const handleListen = useCallback(() => {
    if (!words[idx]) return
    const w = words[idx]
    speakGerman((w.article ? w.article + ' ' : '') + w.baseForm)
  }, [words, idx])

  // ── STT
  const handleMic = useCallback(() => {
    if (micState === 'listening') {
      recognitionRef.current?.stop()
      setMicState('idle')
      return
    }

    const SR =
      typeof window !== 'undefined'
        ? window.SpeechRecognition ?? window.webkitSpeechRecognition
        : null

    if (!SR) { setError(t('speechNotSupported')); return }

    const rec = new SR()
    rec.lang = 'de-DE'
    rec.continuous = false
    rec.interimResults = false
    rec.maxAlternatives = 3

    rec.onstart = () => setMicState('listening')
    rec.onend = () =>
      setMicState((prev) => (prev === 'listening' ? 'idle' : prev))
    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      setMicState('idle')
      if (e.error !== 'no-speech') setError(t('micError'))
    }

    rec.onresult = (e: SpeechRecognitionEvent) => {
      setMicState('processing')
      const transcript = e.results[0][0].transcript.trim()
      setHeard(transcript)
      const word = words[idx]
      const ok   = isAcceptedHeardForWord(transcript, word.baseForm)
      setVerdict(ok ? 'correct' : 'wrong')
      setShowMeaning(true)
      setResults(prev => [...prev, { word, heard: transcript, correct: ok }])
      if (ok) speakGerman('Richtig!')
      setMicState('idle')
    }

    recognitionRef.current = rec
    rec.start()
  }, [micState, words, idx, t])

  // ── Navigate cards
  const handleNext = useCallback(() => {
    if (idx + 1 >= words.length) {
      setScreen('summary')
      return
    }
    const next = idx + 1
    setIdx(next)
    setVerdict(null)
    setHeard('')
    setShowMeaning(false)
    setTimeout(() => speakGerman((words[next].article ? words[next].article + ' ' : '') + words[next].baseForm), 300)
  }, [idx, words])

  const handleSkip = useCallback(() => {
    if (verdict === null) {
      setResults(prev => [...prev, { word: words[idx], heard: '', correct: false }])
    }
    handleNext()
  }, [verdict, words, idx, handleNext])

  // ── Restart
  const handleRestart = () => {
    setScreen('setup')
    setWords([])
    setIdx(0)
    setResults([])
    setVerdict(null)
    setHeard('')
  }

  // ── Score
  const score   = results.filter(r => r.correct).length
  const total   = results.length
  const pct     = total > 0 ? Math.round((score / total) * 100) : 0

  // ────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────────────────────────────────────

  if (authLoading) {
    return (
      <div className="df-page-mesh flex min-h-screen flex-col items-center justify-center px-4 py-10">
        <PracticeGlassSkeleton className="max-w-[430px]" />
      </div>
    )
  }

  if (!me) {
    return (
      <div className="df-page-mesh flex min-h-screen flex-col items-center justify-center gap-4 px-4 py-10">
        <p className="max-w-md text-center text-sm text-[#64748B]">
          Could not load your profile. Check your connection and try again.
        </p>
        <button
          type="button"
          className="rounded-[14px] bg-[#00305E] px-5 py-2.5 text-sm font-bold text-white shadow-md"
          onClick={() => void reload()}
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <StudentShell
      activeSection="vocabulary"
      user={{ displayName: me.displayName, role: me.role }}
      targetLevel={targetLevel}
      streakDays={streakDays}
      initials={initials}
      onLogout={() => {
        logout()
      }}
      headerTitle={t('title')}
      headerSubtitle={`CEFR · ${selCefr} → ${targetLevel}`}
      hideBottomNav={screen === 'practicing'}
    >
      <div className="relative mx-auto flex w-full max-w-[430px] flex-1 flex-col min-h-0 pb-2">
        {showKlausCoach && (screen === 'setup' || screen === 'practicing') ? (
          <div className="pointer-events-none fixed bottom-6 right-4 z-30 w-[100px] sm:w-[115px] md:right-10">
            <KlausCharacter
              expression={micState === 'listening' ? 'talking' : 'neutral'}
              isTalking={micState === 'listening'}
              className="drop-shadow-2xl opacity-95"
            />
          </div>
        ) : null}

        <div
          className="relative flex min-h-[70vh] w-full flex-col overflow-hidden rounded-[22px] border border-white/20 df-glass-subtle shadow-xl sm:min-h-[min(88vh,820px)]"
          style={{ background: 'linear-gradient(160deg, #070B14 0%, #0A1628 40%, #0D0A2E 100%)' }}
        >
          {/* Glow orbs */}
          <div
            className="pointer-events-none absolute -top-8 left-1/4 h-64 w-64 rounded-full opacity-90"
            style={{ background: `radial-gradient(circle, ${CYAN}15 0%, transparent 70%)`, filter: 'blur(40px)' }}
          />
          <div
            className="pointer-events-none absolute bottom-10 right-1/4 h-48 w-48 rounded-full opacity-90"
            style={{ background: `radial-gradient(circle, ${PURPLE}15 0%, transparent 70%)`, filter: 'blur(40px)' }}
          />

          <div
            className="relative flex w-full flex-1 flex-col min-h-0"
            style={{ background: 'rgba(255,255,255,0.02)', ...({} as React.CSSProperties) }}
          >

        {/* ── Top bar */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <button onClick={() => screen === 'setup' ? router.push('/student/vocabulary') : handleRestart()}
            className="flex items-center gap-1.5 py-1.5 px-2 rounded-[10px] transition-colors"
            style={{ color: 'rgba(255,255,255,0.5)' }}>
            <ArrowLeft size={16} />
            <span className="text-xs">{t('back')}</span>
          </button>
          <div className="flex items-center gap-2">
            {screen === 'practicing' && (
              <span className="px-3 py-1.5 rounded-full text-xs font-bold"
                style={{ background: `linear-gradient(135deg, ${CYAN}25, ${PURPLE}25)`, border: `1px solid ${CYAN}40`, color: CYAN }}>
                {selCefr}
              </span>
            )}
            <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {t('title')}
            </span>
          </div>
        </div>

        {/* ── Error banner */}
        <AnimatePresence>
          {error && (
            <motion.div
              role="alert"
              aria-live="assertive"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mx-4 mt-3 px-4 py-2 rounded-[12px] text-xs flex items-center justify-between"
              style={{ background: `${RED}18`, border: `1px solid ${RED}40`, color: RED }}
            >
              {error}
              <button type="button" onClick={() => setError(null)} className="ml-2 opacity-60 hover:opacity-100">
                ✕
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── SETUP SCREEN */}
        <AnimatePresence mode="wait">
          {screen === 'setup' && (
            <motion.div key="setup" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-4"
              style={{ scrollbarWidth: 'none' }}>

              {/* Hero */}
              <div
                className="df-glass-subtle relative overflow-hidden rounded-[20px] border border-cyan-400/20 p-5"
                style={{ background: `linear-gradient(135deg, rgba(34,211,238,0.15), rgba(167,139,250,0.15))` }}
              >
                <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full"
                  style={{ background: `radial-gradient(circle, rgba(34,211,238,0.2) 0%, transparent 70%)`, filter: 'blur(20px)' }} />
                <div className="relative z-10">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold mb-3"
                    style={{ background: `${CYAN}20`, border: `1px solid ${CYAN}40`, color: CYAN }}>
                    🎤 {t('badge')}
                  </div>
                  <h2 className="text-white font-extrabold text-xl mb-1">{t('heroTitle')}</h2>
                  <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>
                    {t('heroSubtitle')}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {[t('tag1'), t('tag2'), t('tag3')].map(label => (
                      <span key={label} className="text-[11px] px-2.5 py-1 rounded-full"
                        style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.1)' }}>
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* CEFR Level */}
              <div className="df-glass-subtle rounded-[20px] border border-white/10 p-4" style={glass}>
                <p className="text-xs font-semibold mb-3" style={{ color: 'rgba(255,255,255,0.5)' }}>{t('chooseLevel')}</p>
                <div className="grid grid-cols-4 gap-2">
                  {CEFR_LEVELS.map(({ id, emoji, color, desc }) => (
                    <button key={id} onClick={() => setSelCefr(id)}
                      className="flex flex-col items-center gap-1.5 p-3 rounded-[14px] transition-all"
                      style={{
                        background: selCefr === id ? `${color}20` : 'rgba(255,255,255,0.05)',
                        border:     selCefr === id ? `1px solid ${color}60` : '1px solid rgba(255,255,255,0.08)',
                      }}>
                      <span className="text-lg">{emoji}</span>
                      <span className="text-xs font-extrabold" style={{ color: selCefr === id ? color : 'rgba(255,255,255,0.7)' }}>{id}</span>
                      <span className="text-[9px] leading-tight text-center" style={{ color: 'rgba(255,255,255,0.35)' }}>
                        {t(desc as Parameters<typeof t>[0])}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Topic tags */}
              <div className="df-glass-subtle rounded-[20px] border border-white/10 p-4" style={glass}>
                <p className="text-xs font-semibold mb-3" style={{ color: 'rgba(255,255,255,0.5)' }}>{t('chooseTopic')}</p>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setSelTag('')}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                    style={{
                      background: !selTag ? `${CYAN}20` : 'rgba(255,255,255,0.06)',
                      border:     !selTag ? `1px solid ${CYAN}50` : '1px solid rgba(255,255,255,0.1)',
                      color:      !selTag ? CYAN : 'rgba(255,255,255,0.65)',
                    }}>
                    🗂 {t('allTopics')}
                  </button>
                  {tags.map(tag => (
                    <button key={tag.id} onClick={() => setSelTag(tag.name)}
                      className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                      style={{
                        background: selTag === tag.name ? `${PURPLE}20` : 'rgba(255,255,255,0.06)',
                        border:     selTag === tag.name ? `1px solid ${PURPLE}50` : '1px solid rgba(255,255,255,0.1)',
                        color:      selTag === tag.name ? PURPLE : 'rgba(255,255,255,0.65)',
                      }}>
                      {tag.localizedLabel ?? tag.name}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] mt-3 leading-snug" style={{ color: 'rgba(255,255,255,0.38)' }}>
                  {previewLoading ? t('wordCountChecking') : previewTotal !== null ? t('wordCountPreview', { count: previewTotal }) : null}
                </p>
              </div>

              <div ref={setupStartAnchorRef}>
                {error && error !== t('noWords') && (
                  <div
                    className="mb-3 mx-0 px-4 py-2.5 rounded-[12px] text-xs"
                    style={{ background: `${RED}18`, border: `1px solid ${RED}40`, color: RED }}
                    aria-hidden="true"
                  >
                    {error}
                  </div>
                )}

              {/* Start button */}
              <motion.button
                onClick={handleStart}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-[16px] font-bold text-sm"
                style={{
                  background: loading ? 'rgba(255,255,255,0.1)' : `linear-gradient(135deg, ${CYAN}, ${PURPLE})`,
                  color: 'white',
                  boxShadow: loading ? 'none' : `0 5px 0 0 rgba(0,0,0,0.3), 0 8px 24px rgba(34,211,238,0.3)`,
                  opacity: loading ? 0.7 : 1,
                }}
                whileHover={!loading ? { scale: 1.02 } : {}}
                whileTap={!loading ? { scale: 0.97 } : {}}
              >
                {loading ? (
                  <>
                    <motion.div className="w-4 h-4 rounded-full border-2"
                      style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }}
                      animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} />
                    {t('loading')}
                  </>
                ) : (
                  <>
                    🎤 {t('startBtn')}
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                      style={{ background: 'rgba(0,0,0,0.25)' }}>
                      {selCefr} {selTag ? `· ${selTag}` : ''}
                    </span>
                  </>
                )}
              </motion.button>
              </div>
            </motion.div>
          )}

          {/* ── PRACTICE SCREEN */}
          {screen === 'practicing' && words[idx] && (
            <motion.div key="practice" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex-1 flex flex-col px-4 py-5 gap-4" style={{ scrollbarWidth: 'none' }}>

              {/* Progress */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                  <motion.div className="h-full rounded-full"
                    style={{ background: `linear-gradient(90deg, ${CYAN}, ${PURPLE})` }}
                    animate={{ width: `${((idx) / words.length) * 100}%` }}
                    transition={{ duration: 0.4 }} />
                </div>
                <span className="text-xs font-bold tabular-nums" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  {idx + 1} / {words.length}
                </span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ background: `${GREEN}20`, color: GREEN, border: `1px solid ${GREEN}40` }}>
                  ✓ {results.filter(r => r.correct).length}
                </span>
              </div>

              {/* ─ Word card */}
              <AnimatePresence mode="wait">
                <motion.div key={idx}
                  initial={{ opacity: 0, y: 20, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -20, scale: 0.96 }}
                  transition={{ duration: 0.25 }}
                  className="rounded-[24px] p-6 text-center relative overflow-hidden"
                  style={{
                    background: verdict === 'correct'
                      ? `linear-gradient(135deg, ${GREEN}15, ${GREEN}08)`
                      : verdict === 'wrong'
                      ? `linear-gradient(135deg, ${RED}15, ${RED}08)`
                      : `linear-gradient(135deg, rgba(34,211,238,0.1), rgba(167,139,250,0.1))`,
                    border: verdict === 'correct'
                      ? `1px solid ${GREEN}40`
                      : verdict === 'wrong'
                      ? `1px solid ${RED}40`
                      : `1px solid rgba(34,211,238,0.2)`,
                    minHeight: 220,
                  }}>

                  {/* CEFR badge */}
                  <div className="absolute top-4 right-4">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }}>
                      {words[idx].cefrLevel}
                    </span>
                  </div>

                  {/* Verdict icon */}
                  <AnimatePresence>
                    {verdict && (
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                        className="absolute top-4 left-4">
                        {verdict === 'correct'
                          ? <CheckCircle2 size={22} style={{ color: GREEN }} />
                          : <XCircle size={22} style={{ color: RED }} />}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Article + Word */}
                  {words[idx].article && (
                    <p className="text-sm font-semibold mb-1"
                      style={{ color: genderColor(words[idx].gender) }}>
                      {words[idx].article}
                    </p>
                  )}
                  <h1 className="text-4xl font-extrabold text-white mb-2 leading-tight">
                    {words[idx].baseForm}
                  </h1>

                  {/* Phonetic */}
                  {words[idx].phonetic && (
                    <p className="text-sm mb-3" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      /{words[idx].phonetic}/
                    </p>
                  )}

                  {/* Meaning (hidden until revealed) */}
                  <AnimatePresence>
                    {showMeaning && words[idx].meaning && (
                      <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="text-sm font-medium px-4 py-2 rounded-[12px] mt-2 inline-block"
                        style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.8)' }}>
                        {words[idx].meaning}
                      </motion.p>
                    )}
                  </AnimatePresence>

                  {/* What was heard */}
                  <AnimatePresence>
                    {heard && verdict === 'wrong' && (
                      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        className="mt-3 text-xs" style={{ color: RED }}>
                        {t('youSaid')}: &ldquo;{heard}&rdquo;
                      </motion.div>
                    )}
                    {heard && verdict === 'correct' && (
                      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        className="mt-3 text-xs" style={{ color: GREEN }}>
                        &ldquo;{heard}&rdquo; ✓
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              </AnimatePresence>

              {/* ─ Controls */}
              <div className="flex items-center justify-center gap-3">
                {/* Show meaning toggle */}
                <button onClick={() => setShowMeaning(v => !v)}
                  className="w-11 h-11 rounded-full flex items-center justify-center transition-all"
                  style={{ background: showMeaning ? `${CYAN}20` : 'rgba(255,255,255,0.06)', border: `1px solid ${showMeaning ? CYAN + '50' : 'rgba(255,255,255,0.1)'}` }}>
                  {showMeaning ? <EyeOff size={18} style={{ color: CYAN }} /> : <Eye size={18} style={{ color: 'rgba(255,255,255,0.5)' }} />}
                </button>

                {/* Listen (TTS) */}
                <button onClick={handleListen}
                  className="w-12 h-12 rounded-full flex items-center justify-center transition-all"
                  style={{ background: `${AMBER}15`, border: `1px solid ${AMBER}40` }}>
                  <Volume2 size={20} style={{ color: AMBER }} />
                </button>

                {/* Speak (STT) — big button */}
                <motion.button
                  onClick={micState === 'idle' || micState === 'listening' ? handleMic : undefined}
                  disabled={verdict !== null || micState === 'processing'}
                  whileHover={verdict === null ? { scale: 1.08 } : {}}
                  whileTap={verdict === null ? { scale: 0.95 } : {}}
                  className="w-20 h-20 rounded-full flex items-center justify-center relative"
                  style={{
                    background: micState === 'listening'
                      ? `linear-gradient(135deg, ${RED}, #dc2626)`
                      : verdict !== null
                      ? 'rgba(255,255,255,0.06)'
                      : `linear-gradient(135deg, ${CYAN}, ${PURPLE})`,
                    boxShadow: micState === 'listening'
                      ? `0 0 30px ${RED}60`
                      : verdict === null
                      ? `0 5px 0 0 rgba(0,0,0,0.3), 0 8px 24px rgba(34,211,238,0.3)`
                      : 'none',
                    cursor: verdict !== null ? 'default' : 'pointer',
                  }}>
                  {micState === 'listening'
                    ? <MicOff size={28} className="text-white" />
                    : micState === 'processing'
                    ? <motion.div className="w-6 h-6 rounded-full border-2 border-white/30 border-t-white"
                        animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} />
                    : <Mic size={28} className="text-white" />}

                  {/* Pulse ring while listening */}
                  {micState === 'listening' && (
                    <motion.div className="absolute inset-0 rounded-full"
                      style={{ border: `2px solid ${RED}` }}
                      animate={{ scale: [1, 1.4], opacity: [0.8, 0] }}
                      transition={{ duration: 1, repeat: Infinity }} />
                  )}
                </motion.button>

                {/* Skip */}
                <button onClick={handleSkip}
                  className="w-12 h-12 rounded-full flex items-center justify-center transition-all"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <SkipForward size={20} style={{ color: 'rgba(255,255,255,0.5)' }} />
                </button>

                {/* Next (shown after verdict) */}
                <AnimatePresence>
                  {verdict !== null && (
                    <motion.button initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                      onClick={handleNext}
                      className="w-11 h-11 rounded-full flex items-center justify-center transition-all"
                      style={{ background: `${GREEN}20`, border: `1px solid ${GREEN}50` }}>
                      <ChevronRight size={20} style={{ color: GREEN }} />
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>

              {/* Listening hint */}
              <AnimatePresence>
                {micState === 'listening' && (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="text-center text-xs"
                    style={{ color: 'rgba(255,255,255,0.5)' }}>
                    🎙 {t('listeningHint')}
                  </motion.p>
                )}
                {verdict === null && micState === 'idle' && (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="text-center text-xs"
                    style={{ color: 'rgba(255,255,255,0.3)' }}>
                    {t('tapMicHint')}
                  </motion.p>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* ── SUMMARY SCREEN */}
          {screen === 'summary' && (
            <motion.div key="summary" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-4"
              style={{ scrollbarWidth: 'none' }}>

              {/* Score card */}
              <div className="rounded-[24px] p-6 text-center"
                style={{ background: `linear-gradient(135deg, ${pct >= 70 ? GREEN : RED}15, ${PURPLE}15)`, border: `1px solid ${pct >= 70 ? GREEN : RED}30` }}>
                <Trophy size={40} className="mx-auto mb-3" style={{ color: pct >= 70 ? AMBER : 'rgba(255,255,255,0.3)' }} />
                <p className="text-5xl font-extrabold text-white mb-1">{pct}%</p>
                <p className="text-sm mb-1" style={{ color: 'rgba(255,255,255,0.6)' }}>
                  {score} / {total} {t('correct')}
                </p>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  {pct >= 90 ? t('excellent') : pct >= 70 ? t('good') : t('keepPracticing')}
                </p>
              </div>

              {/* Wrong words review */}
              {results.filter(r => !r.correct).length > 0 && (
                <div className="rounded-[20px] p-4" style={glass}>
                  <p className="text-xs font-semibold mb-3" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    {t('reviewWrong')}
                  </p>
                  <div className="flex flex-col gap-2">
                    {results.filter(r => !r.correct).map((r, i) => (
                      <div key={i} className="flex items-center justify-between px-3 py-2.5 rounded-[12px]"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <div>
                          <p className="text-sm font-bold text-white">
                            {r.word.article ? <span style={{ color: genderColor(r.word.gender) }}>{r.word.article} </span> : null}
                            {r.word.baseForm}
                          </p>
                          {r.word.meaning && <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>{r.word.meaning}</p>}
                        </div>
                        <button onClick={() => speakGerman((r.word.article ? r.word.article + ' ' : '') + r.word.baseForm)}
                          className="w-8 h-8 rounded-full flex items-center justify-center"
                          style={{ background: `${AMBER}15`, border: `1px solid ${AMBER}30` }}>
                          <Volume2 size={14} style={{ color: AMBER }} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Buttons */}
              <div className="flex flex-col gap-3">
                <motion.button onClick={handleStart}
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-[16px] font-bold text-sm text-white"
                  style={{ background: `linear-gradient(135deg, ${CYAN}, ${PURPLE})`, boxShadow: `0 5px 0 0 rgba(0,0,0,0.3), 0 8px 24px rgba(34,211,238,0.3)` }}
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                  <RefreshCw size={16} /> {t('practiceAgain')}
                </motion.button>
                <button onClick={handleRestart}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-[16px] text-sm font-semibold"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}>
                  {t('changeTopic')}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
          </div>
        </div>
      </div>
    </StudentShell>
  )
}
