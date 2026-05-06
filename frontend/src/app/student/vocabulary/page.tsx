'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { isAxiosError } from 'axios'
import api from '@/lib/api'
import { getAccessToken, clearTokens } from '@/lib/authSession'
import { StudentShell } from '@/components/layouts/StudentShell'
import { useVocabulary, useVocabularyReload } from '@/hooks/useVocabulary'
import { speakGerman, primeGermanVoices } from '@/lib/speechDe'
import { inferGenderFromGermanText, normalizeGenderCode } from '@/lib/constants'
import { VocabAiPanel } from '@/components/vocabulary/VocabAiPanel'
import { QuickAiToolbar } from '@/components/vocabulary/QuickAiToolbar'
import {
  AlignLeft,
  BookOpen,
  Bookmark,
  BookmarkCheck,
  ChevronDown,
  ChevronRight,
  Filter,
  Hash,
  LayoutGrid,
  Layers,
  List,
  Mic,
  Pause,
  Play,
  Search,
  Star,
  Volume2,
  X,
  Zap,
} from 'lucide-react'

type WordListItem = {
  id: number
  dtype: string
  baseForm: string
  cefrLevel: string
  phonetic?: string | null
  meaning?: string | null
  meaningEn?: string | null
  example?: string | null
  exampleDe?: string | null
  exampleEn?: string | null
  usageNote?: string | null
  gender?: 'DER' | 'DIE' | 'DAS' | null
  article?: 'der' | 'die' | 'das' | null
  genderColor?: string | null
  tags?: string[] | null
  nounDetails?: {
    pluralForm?: string | null
    genitiveForm?: string | null
    nounType?: string | null
    declensions?: Array<{ kasus: string; numerus: string; form: string }> | null
  } | null
  verbDetails?: {
    auxiliaryVerb?: string | null
    partizip2?: string | null
    isSeparable?: boolean | null
    prefix?: string | null
    isIrregular?: boolean | null
    conjugations?: Array<{ tense: string; pronoun: string; form: string }> | null
  } | null
  adjectiveDetails?: {
    comparative?: string | null
    superlative?: string | null
    isIrregular?: boolean | null
  } | null
}

type WordListResponse = {
  items: WordListItem[]
  page: number
  size: number
  total: number
}

type TagItem = {
  id: number
  name: string
  color?: string | null
  localizedLabel?: string | null
}

type Me = {
  displayName: string
  locale: string
  role: string
}

type ArticleLower = 'der' | 'die' | 'das'
type GenderCode = 'DER' | 'DIE' | 'DAS'

type VocabCardItem = {
  id: number
  dtype: string
  word: string
  article: ArticleLower
  gender: GenderCode
  meaning: string
  english: string
  phonetic: string
  usageNote: string
  category: string
  level: string
  tags: string[]
  exampleDE: string
  exampleTranslation: string
  nounDetails?: WordListItem['nounDetails']
  verbDetails?: WordListItem['verbDetails']
  adjectiveDetails?: WordListItem['adjectiveDetails']
}

const CATEGORY_OPTIONS = ['Alle', 'IT', 'Business', 'Alltag', 'Reisen', 'Grammatik'] as const
type CategoryOption = typeof CATEGORY_OPTIONS[number]

const GENDER_STYLE: Record<GenderCode, { bg: string; text: string; border: string; dot: string }> = {
  DER: { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE', dot: '#3B82F6' },
  DIE: { bg: '#FFF1F2', text: '#BE123C', border: '#FECDD3', dot: '#F43F5E' },
  DAS: { bg: '#F0FDF4', text: '#166534', border: '#BBF7D0', dot: '#10B981' },
}

const LEVEL_STYLE: Record<string, { bg: string; text: string }> = {
  A1: { bg: '#F0FDF4', text: '#166534' },
  A2: { bg: '#EFF6FF', text: '#1D4ED8' },
  B1: { bg: '#FFF8E1', text: '#92400E' },
  B2: { bg: '#F5F3FF', text: '#4C1D95' },
  C1: { bg: '#F1F5F9', text: '#0F172A' },
  C2: { bg: '#EEF2FF', text: '#3730A3' },
}

const WAVE_BARS = [
  3, 6, 10, 16, 22, 28, 32, 36, 30, 26, 34, 38, 32, 28, 22, 18, 26, 34, 38, 34,
  28, 22, 30, 36, 32, 26, 20, 16, 12, 18, 22, 28,
]

function normalizeText(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

const CATEGORY_KEYWORDS: Record<Exclude<CategoryOption, 'Alle'>, string[]> = {
  IT: [
    'it',
    'api',
    'backend',
    'frontend',
    'schnittstelle',
    'algorithmus',
    'datenbank',
    'netzwerk',
    'server',
    'client',
    'microservice',
    'software',
    'debug',
    'deployment',
    'cloud',
    'speicher',
    'programmierung',
  ],
  Business: [
    'business',
    'unternehmen',
    'firma',
    'kunde',
    'kunden',
    'besprechung',
    'meeting',
    'projekt',
    'manager',
    'team',
    'vertrag',
    'budget',
    'karriere',
    'startup',
    'sitzung',
  ],
  Alltag: [
    'alltag',
    'gesprach',
    'familie',
    'freunde',
    'freund',
    'essen',
    'trinken',
    'wohnung',
    'haus',
    'schule',
    'einkauf',
    'arzt',
    'termin',
    'stadt',
  ],
  Reisen: [
    'reisen',
    'reise',
    'bahnhof',
    'flughafen',
    'hotel',
    'ticket',
    'zug',
    'bus',
    'urlaub',
    'koffer',
    'buchung',
    'pass',
    'transport',
    'station',
  ],
  Grammatik: [
    'grammatik',
    'konjugation',
    'deklination',
    'artikelgebrauch',
    'nominativ',
    'akkusativ',
    'dativ',
    'genitiv',
    'praeposition',
    'temporalsatz',
    'nebensatz',
    'perfekt',
    'praeteritum',
    'satzbau',
  ],
}

type CategoryScoreBreakdown = Record<Exclude<CategoryOption, 'Alle'>, number>

function scoreCategory(
  blob: string,
  tokens: Set<string>,
  tags: string[]
): { winner: Exclude<CategoryOption, 'Alle'>; bestScore: number; breakdown: CategoryScoreBreakdown } {
  const breakdown: CategoryScoreBreakdown = {
    IT: 0,
    Business: 0,
    Alltag: 0,
    Reisen: 0,
    Grammatik: 0,
  }
  let bestCategory: Exclude<CategoryOption, 'Alle'> = 'Alltag'
  let bestScore = 0

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS) as Array<[Exclude<CategoryOption, 'Alle'>, string[]]>) {
    let score = 0
    for (const keyword of keywords) {
      if (tags.includes(keyword)) score += 4
      if (tokens.has(keyword)) score += 3
      if (!tokens.has(keyword) && blob.includes(keyword)) score += 2
    }
    breakdown[category] = score
    if (score > bestScore) {
      bestScore = score
      bestCategory = category
    }
  }

  return { winner: bestCategory, bestScore, breakdown }
}

function detectCategory(item: WordListItem): CategoryOption {
  const tags = item.tags?.map((x) => normalizeText(String(x))) ?? []
  const blob = normalizeText(
    [item.baseForm, item.meaning || '', item.example || '', item.dtype || '', ...(item.tags ?? [])].join(' ')
  )
  const tokens = new Set(blob.split(/[^a-z0-9]+/).filter(Boolean))

  const directTag = tags.find((tag) =>
    (CATEGORY_OPTIONS as readonly string[]).some((c) => c !== 'Alle' && normalizeText(c) === tag)
  )
  if (directTag) {
    return CATEGORY_OPTIONS.find((c) => c !== 'Alle' && normalizeText(c) === directTag)! as CategoryOption
  }

  const { winner, bestScore, breakdown } = scoreCategory(blob, tokens, tags)

  if (bestScore > 0) return winner
  return 'Alltag'
}

function mapWordToCard(item: WordListItem, t: (key: string) => string): VocabCardItem {
  const inferred = normalizeGenderCode(item.gender ?? inferGenderFromGermanText(item.baseForm))
  const gender: GenderCode = inferred === 'DIE' || inferred === 'DAS' ? inferred : 'DER'
  const article: ArticleLower =
    item.article && (item.article === 'der' || item.article === 'die' || item.article === 'das')
      ? item.article
      : gender.toLowerCase() as ArticleLower
  const sourceTags = item.tags?.filter(Boolean) ?? []
  const category = detectCategory(item)
  const meaning = (item.meaning || '').trim() || t('meaningMissing')
  const enMeaning = (item.meaningEn || '').trim()
  const words = (enMeaning || meaning).split(/\s+/)
  const shortEnglish = words.slice(0, 8).join(' ') + (words.length > 8 ? '…' : '')
  return {
    id: item.id,
    dtype: item.dtype || 'Word',
    word: item.baseForm,
    article,
    gender,
    meaning,
    english: shortEnglish,
    phonetic: (item.phonetic || '').trim() || t('ipaMissing'),
    usageNote: (item.usageNote || '').trim() || t('usageNoteFallback'),
    category,
    level: item.cefrLevel || 'A1',
    tags: sourceTags.length > 0 ? sourceTags : [category, item.dtype].filter(Boolean) as string[],
    exampleDE: (item.exampleDe || '').trim(),
    exampleTranslation: (item.example || '').trim(),
    nounDetails: item.nounDetails ?? null,
    verbDetails: item.verbDetails ?? null,
    adjectiveDetails: item.adjectiveDetails ?? null,
  }
}

function prettyPronoun(pronoun: string): string {
  switch (pronoun) {
    case 'ER_SIE_ES':
      return 'er/sie/es'
    case 'SIE_FORMAL':
      return 'Sie'
    default:
      return pronoun.toLowerCase()
  }
}

function prettyTense(tense: string): string {
  switch (tense) {
    case 'PRASENS':
      return 'Prasens'
    case 'PRATERITUM':
      return 'Prateritum'
    case 'PERFEKT':
      return 'Perfekt'
    case 'FUTUR1':
      return 'Futur I'
    case 'KONJUNKTIV2':
      return 'Konjunktiv II'
    case 'IMPERATIV':
      return 'Imperativ'
    default:
      return tense
  }
}

function prettyKasus(kasus: string): string {
  switch (kasus) {
    case 'NOMINATIV':
      return 'Nominativ'
    case 'AKKUSATIV':
      return 'Akkusativ'
    case 'DATIV':
      return 'Dativ'
    case 'GENITIV':
      return 'Genitiv'
    default:
      return kasus
  }
}

function Waveform({ isPlaying, progress }: { isPlaying: boolean; progress: number }) {
  const played = Math.floor(WAVE_BARS.length * progress)
  return (
    <div className="flex items-center gap-[2px] h-10 px-1 overflow-hidden">
      {WAVE_BARS.map((h, i) => (
        <div
          key={i}
          className={`w-[3px] rounded-full transition-all duration-150 ${isPlaying && Math.abs(i - played) < 2 ? 'scale-y-125' : ''}`}
          style={{
            height: h,
            background: i <= played ? '#FFCE00' : '#CBD5E1',
            animation: isPlaying && Math.abs(i - played) < 3 ? `dfPulse 360ms ease-in-out ${(i % 4) * 60}ms infinite` : 'none',
          }}
        />
      ))}
    </div>
  )
}

function ExampleHoverSentence({
  sentenceDe,
  meaningVi,
}: {
  sentenceDe: string
  meaningVi?: string
}) {
  const meaning = (meaningVi || '').trim()
  return (
    <div className="relative group">
      <p className="text-[#1E293B] text-sm leading-relaxed">
        🇩🇪 {sentenceDe}
      </p>
      {meaning ? (
        <div className="pointer-events-none absolute left-0 top-full z-10 mt-2 w-full max-w-xl rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs text-[#475569] shadow-lg opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          🇻🇳 {meaning}
        </div>
      ) : null}
    </div>
  )
}

function DetailModal({
  item,
  onClose,
  closing,
}: {
  item: VocabCardItem
  onClose: () => void
  closing: boolean
}) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [bookmarked, setBookmarked] = useState(false)
  const style = GENDER_STYLE[item.gender]
  const levelStyle = LEVEL_STYLE[item.level] ?? LEVEL_STYLE.A1

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  const togglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false)
      if (intervalRef.current) clearInterval(intervalRef.current)
      intervalRef.current = null
      return
    }
    setIsPlaying(true)
    setProgress(0)
    const phrase = `${item.article} ${item.word}`.trim()
    speakGerman(phrase)
    intervalRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current)
          intervalRef.current = null
          setIsPlaying(false)
          return 0
        }
        return prev + 0.02
      })
    }, 80)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
      <div className={`absolute inset-0 bg-[#001734]/60 backdrop-blur-sm ${closing ? 'df-overlay-exit' : 'df-overlay-enter'}`} onClick={onClose} />
      <div className={`relative w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl bg-white shadow-2xl ${closing ? 'df-modal-exit' : 'df-modal-enter'}`}>
        <div className="relative px-6 py-6 rounded-t-3xl bg-gradient-to-br from-[#00305E] to-[#004b90]">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 w-9 h-9 rounded-full border border-white/20 bg-white/10 text-white flex items-center justify-center"
          >
            <X size={16} />
          </button>
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold border" style={{ background: style.bg, color: style.text, borderColor: style.border }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: style.dot }} />
              {item.article}
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-full font-bold" style={{ background: levelStyle.bg, color: levelStyle.text }}>
              {item.level}
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-white/10 text-white/80">
              {item.category}
            </span>
          </div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">{item.word}</h2>
          <p className="text-white/65 text-sm mt-0.5">{item.english}</p>

          <div className="mt-4 rounded-2xl border border-white/20 bg-white/10 p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs uppercase tracking-widest text-white/60">Aussprache</p>
              <p className="text-xs text-white/50 font-mono">{item.phonetic}</p>
            </div>
            <Waveform isPlaying={isPlaying} progress={progress} />
            <button
              type="button"
              className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FFCE00] text-[#00305E] font-bold text-sm"
              onClick={togglePlay}
            >
              {isPlaying ? <Pause size={14} /> : <Play size={14} />} {isPlaying ? 'Pause' : 'Abspielen'}
            </button>
          </div>
        </div>

        <div className="px-6 py-5 border-b border-[#EEF2F6]">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen size={16} className="text-[#00305E]" />
            <h3 className="text-sm font-bold uppercase tracking-widest text-[#00305E]">Bedeutung</h3>
          </div>
          <p className="text-sm text-[#334155] leading-relaxed">{item.meaning}</p>
          <div className="flex flex-wrap gap-2 mt-3">
            {item.tags.map((tag) => (
              <span key={tag} className="text-xs px-2 py-1 rounded-full border border-[#E2E8F0] bg-[#F8FAFC] text-[#64748B]">
                #{tag}
              </span>
            ))}
          </div>
        </div>

        <div className="px-6 py-5 border-b border-[#EEF2F6]">
          <div className="flex items-center gap-2 mb-2">
            <Layers size={16} className="text-[#0369A1]" />
            <h3 className="text-sm font-bold uppercase tracking-widest text-[#0369A1]">Verwendung</h3>
          </div>
          <p className="text-sm text-[#334155] leading-relaxed">{item.usageNote}</p>
        </div>

        {item.exampleDE ? (
          <div className="px-6 py-5 border-b border-[#EEF2F6]">
            <div className="flex items-center gap-2 mb-2">
              <AlignLeft size={16} className="text-[#B45309]" />
              <h3 className="text-sm font-bold uppercase tracking-widest text-[#B45309]">Beispielsatz</h3>
            </div>
            <div className="rounded-xl border border-[#E2E8F0] bg-[#FAFCFF] p-4">
              <ExampleHoverSentence
                sentenceDe={item.exampleDE}
                meaningVi={item.exampleTranslation}
              />
              {item.exampleTranslation ? (
                <p className="text-[#94A3B8] text-xs mt-3">
                  Hover vào câu để xem nghĩa tiếng Việt (UTF-8).
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="px-6 py-5 border-b border-[#EEF2F6]">
          <div className="flex items-center gap-2 mb-3">
            <Star size={16} className="text-[#7C3AED]" />
            <h3 className="text-sm font-bold uppercase tracking-widest text-[#7C3AED]">Grammatikdetails</h3>
          </div>

          {item.dtype === 'Noun' ? (
            <div className="rounded-xl border border-[#E2E8F0] bg-[#FAFBFF] p-4 text-sm space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <p><span className="text-[#64748B]">Artikel:</span> <span className="font-semibold text-[#0F172A]">{item.article}</span></p>
                <p><span className="text-[#64748B]">Plural:</span> <span className="font-semibold text-[#0F172A]">{item.nounDetails?.pluralForm || '—'}</span></p>
                <p><span className="text-[#64748B]">Genitiv:</span> <span className="font-semibold text-[#0F172A]">{item.nounDetails?.genitiveForm || '—'}</span></p>
              </div>
              <p><span className="text-[#64748B]">Typ:</span> <span className="font-semibold text-[#0F172A]">{item.nounDetails?.nounType || '—'}</span></p>
              {item.nounDetails?.declensions?.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-separate border-spacing-y-1">
                    <thead>
                      <tr className="text-[#64748B]">
                        <th className="text-left font-semibold">Kasus</th>
                        <th className="text-left font-semibold">Numerus</th>
                        <th className="text-left font-semibold">Form</th>
                      </tr>
                    </thead>
                    <tbody>
                      {item.nounDetails.declensions.map((row) => (
                        <tr key={`${row.kasus}-${row.numerus}`} className="bg-white">
                          <td className="py-1.5 pr-2">{prettyKasus(row.kasus)}</td>
                          <td className="py-1.5 pr-2">{row.numerus?.toLowerCase()}</td>
                          <td className="py-1.5 font-semibold text-[#0F172A]">{row.form}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-[#94A3B8]">Chưa có bảng biến cách chi tiết cho danh từ này.</p>
              )}
            </div>
          ) : null}

          {item.dtype === 'Verb' ? (
            <div className="rounded-xl border border-[#E2E8F0] bg-[#FAFBFF] p-4 text-sm space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <p><span className="text-[#64748B]">Hilfsverb:</span> <span className="font-semibold text-[#0F172A]">{item.verbDetails?.auxiliaryVerb || '—'}</span></p>
                <p><span className="text-[#64748B]">Partizip II:</span> <span className="font-semibold text-[#0F172A]">{item.verbDetails?.partizip2 || '—'}</span></p>
                <p><span className="text-[#64748B]">Trennbar:</span> <span className="font-semibold text-[#0F172A]">{item.verbDetails?.isSeparable ? 'Ja' : 'Nein'}</span></p>
                <p><span className="text-[#64748B]">Unregelmaessig:</span> <span className="font-semibold text-[#0F172A]">{item.verbDetails?.isIrregular ? 'Ja' : 'Nein'}</span></p>
              </div>
              {item.verbDetails?.conjugations?.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-separate border-spacing-y-1">
                    <thead>
                      <tr className="text-[#64748B]">
                        <th className="text-left font-semibold">Zeit</th>
                        <th className="text-left font-semibold">Pronomen</th>
                        <th className="text-left font-semibold">Form</th>
                      </tr>
                    </thead>
                    <tbody>
                      {item.verbDetails.conjugations.map((row) => (
                        <tr key={`${row.tense}-${row.pronoun}`} className="bg-white">
                          <td className="py-1.5 pr-2">{prettyTense(row.tense)}</td>
                          <td className="py-1.5 pr-2">{prettyPronoun(row.pronoun)}</td>
                          <td className="py-1.5 font-semibold text-[#0F172A]">{row.form}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-[#94A3B8]">Chưa có bảng chia động từ theo ngôi cho từ này.</p>
              )}
            </div>
          ) : null}

          {item.dtype === 'Adjective' ? (
            <div className="rounded-xl border border-[#E2E8F0] bg-[#FAFBFF] p-4 text-sm space-y-2">
              <p><span className="text-[#64748B]">Komparativ:</span> <span className="font-semibold text-[#0F172A]">{item.adjectiveDetails?.comparative || '—'}</span></p>
              <p><span className="text-[#64748B]">Superlativ:</span> <span className="font-semibold text-[#0F172A]">{item.adjectiveDetails?.superlative || '—'}</span></p>
              <p><span className="text-[#64748B]">Unregelmaessig:</span> <span className="font-semibold text-[#0F172A]">{item.adjectiveDetails?.isIrregular ? 'Ja' : 'Nein'}</span></p>
              <p className="text-xs text-[#64748B] mt-2">
                Tính từ sẽ đổi đuôi theo giống, số và cách (Kasus) của danh từ đi kèm.
              </p>
            </div>
          ) : null}

          {item.dtype !== 'Noun' && item.dtype !== 'Verb' && item.dtype !== 'Adjective' ? (
            <p className="text-sm text-[#64748B]">
              Từ này thuộc nhóm từ chung. Hãy học theo cụm từ, ví dụ và ngữ cảnh sử dụng thực tế.
            </p>
          ) : null}
        </div>

        <div className="px-6 py-5">
          <div className="flex items-center gap-2 mb-3">
            <Layers size={16} className="text-[#7C3AED]" />
            <h3 className="text-sm font-bold uppercase tracking-widest text-[#7C3AED]">Hierarchiestruktur</h3>
          </div>
          <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFF] p-3 text-sm">
            <div className="flex items-center gap-2 py-1">
              <Zap size={14} className="text-[#7C3AED]" />
              <span className="font-semibold text-[#0F172A]">Interaktionszustand</span>
            </div>
            <div className="pl-6 py-1 flex items-center gap-2 text-[#334155]">
              <ChevronRight size={14} className="text-[#94A3B8]" />
              <Layers size={13} className="text-[#00305E]" />
              <span>Komponentenzustand</span>
            </div>
            <div className="pl-12 py-1 flex items-center gap-2 text-[#334155]">
              <ChevronRight size={14} className="text-[#94A3B8]" />
              <Star size={13} className="text-[#FFCE00]" />
              <span>Komponenten-Hero</span>
            </div>
            <div className="pl-16 py-1 flex items-center gap-2 text-[#0F172A] font-medium">
              <Hash size={12} className="text-[#94A3B8]" />
              <span>{item.word}</span>
            </div>
          </div>

          <div className="mt-4 flex gap-3">
            <button type="button" className="flex-1 py-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] text-[#64748B] font-semibold" onClick={onClose}>
              Schließen
            </button>
            <button
              type="button"
              className="flex-[1.4] py-2.5 rounded-xl bg-[#00305E] text-white font-bold inline-flex items-center justify-center gap-2"
              onClick={() => setBookmarked((prev) => !prev)}
            >
              {bookmarked ? <BookmarkCheck size={15} /> : <Bookmark size={15} />} {bookmarked ? 'Gespeichert' : 'Zur Lernliste'}
            </button>
          </div>
        </div>

        {/* AI Insights Panel */}
        <VocabAiPanel word={item.word} meaning={item.meaning} />
      </div>
    </div>
  )
}

function VocabCard({
  item,
  selected,
  index,
  onSelect,
}: {
  item: VocabCardItem
  selected: boolean
  index: number
  onSelect: () => void
}) {
  const [bookmarked, setBookmarked] = useState(false)
  const [hovered, setHovered] = useState(false)
  const style = GENDER_STYLE[item.gender]
  const levelStyle = LEVEL_STYLE[item.level] ?? LEVEL_STYLE.A1
  return (
    <button
      type="button"
      onClick={onSelect}
      className="relative overflow-hidden text-left bg-white rounded-2xl border-2 transition-all duration-200 ease-out hover:-translate-y-[3px] hover:scale-[1.012] hover:shadow-xl cursor-pointer df-card-enter"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderColor: selected ? '#00305E' : hovered ? '#CBD5E1' : '#E2E8F0',
        boxShadow: selected
          ? '0 10px 26px rgba(0,48,94,0.18), 0 0 0 3px rgba(0,48,94,0.08)'
          : hovered
            ? '0 12px 30px rgba(0,48,94,0.16), 0 0 0 3px rgba(0,48,94,0.10)'
            : '0 3px 10px rgba(0,48,94,0.06)',
        animationDelay: `${Math.min(index, 10) * 45}ms`,
        background: hovered ? 'linear-gradient(180deg, #ffffff 0%, #fbfdff 100%)' : '#ffffff',
      }}
    >
      <div
        className="absolute top-0 left-0 right-0 h-1 transition-opacity duration-200"
        style={{
          opacity: selected || hovered ? 1 : 0,
          background: 'linear-gradient(90deg, #00305E 0%, #2B6CB0 100%)',
        }}
      />
      <div className="px-4 pt-4 pb-3 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border" style={{ background: style.bg, color: style.text, borderColor: style.border }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: style.dot }} />
            {item.article}
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: levelStyle.bg, color: levelStyle.text }}>
            {item.level}
          </span>
        </div>
        <button
          type="button"
          className="p-1 rounded-md hover:bg-[#F4F7FA]"
          onClick={(e) => {
            e.stopPropagation()
            setBookmarked((prev) => !prev)
          }}
        >
          {bookmarked ? <BookmarkCheck size={16} className="text-[#FFCE00]" /> : <Bookmark size={16} className="text-[#94A3B8]" />}
        </button>
      </div>

      <div className="px-4 pb-3">
        <h3 className="font-extrabold text-lg text-[#00305E] tracking-tight">{item.word}</h3>
        {item.phonetic ? <p className="text-[11px] text-[#94A3B8] font-mono">{item.phonetic}</p> : null}
      </div>
      <div className="mx-4 h-px bg-[#EEF2F6]" />
      <div className="px-4 py-3">
        <p className="text-sm font-semibold text-[#334155]">{item.english}</p>
        <p className="text-xs text-[#94A3B8] mt-1.5 line-clamp-2">{item.meaning}</p>
      </div>
      <div className="px-4 pb-4 flex items-center justify-between">
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#F1F5F9] text-[#64748B] font-semibold">{item.category}</span>
        <span
          className="text-xs font-semibold inline-flex items-center gap-1 transition-colors duration-200"
          style={{ color: hovered || selected ? '#00305E' : '#94A3B8' }}
        >
          Details <ChevronRight size={13} />
        </span>
      </div>
    </button>
  )
}

export default function StudentVocabularyPage() {
  const t = useTranslations('vocabulary')
  const uiLocale = useLocale()
  const router = useRouter()
  const { notifyApiError } = useVocabulary()
  const [me, setMe] = useState<Me | null>(null)
  const [targetLevel, setTargetLevel] = useState('A1')
  const [streakDays, setStreakDays] = useState(0)
  const [items, setItems] = useState<VocabCardItem[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [cefr, setCefr] = useState('')
  const [dtype, setDtype] = useState<'Noun' | 'Verb' | 'Adjective' | 'Word' | ''>('')
  const [gender, setGender] = useState<'DER' | 'DIE' | 'DAS' | ''>('')
  const [tag, setTag] = useState<string>('')
  const [tags, setTags] = useState<TagItem[]>([])
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(24)
  const [total, setTotal] = useState(0)
  const [loadError, setLoadError] = useState('')
  const [selectedItem, setSelectedItem] = useState<VocabCardItem | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [showFilters, setShowFilters] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState<CategoryOption>('Alle')
  const [modalClosing, setModalClosing] = useState(false)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    }
  }, [])

  const filtered = useMemo(() => {
    // Chỉ filter theo category (client-side) — search q đã được gửi lên API
    return items.filter((item) => {
      return categoryFilter === 'Alle' || item.category === categoryFilter
    })
  }, [items, categoryFilter])

  const [debouncedQ, setDebouncedQ] = useState('')

  // Debounce search query — chờ 400ms sau khi user ngừng gõ mới fetch
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQ(q)
      setPage(0)
    }, 400)
    return () => clearTimeout(timer)
  }, [q])

  useEffect(() => {
    if (!getAccessToken()) {
      router.push('/login')
      return
    }

    ;(async () => {
      try {
        setLoadError('')
        primeGermanVoices()
        const meRes = await api.get('/auth/me')
        if (meRes.data.role !== 'STUDENT') {
          router.push(`/${String(meRes.data.role).toLowerCase()}`)
          return
        }
        setMe(meRes.data)

        const [planRes, dashRes] = await Promise.all([
          api.get<{ plan?: { targetLevel?: string } }>('/plan/me').catch(() => null),
          api.get<{ streakDays?: number }>('/student/dashboard').catch(() => null),
        ])
        setTargetLevel(planRes?.data?.plan?.targetLevel ?? 'A1')
        setStreakDays(Number(dashRes?.data?.streakDays ?? 0))

        const tagsRes = await api.get<TagItem[]>('/tags', {
          params: { locale: uiLocale || meRes.data.locale || 'vi', topicsOnly: 'true' },
        })
        setTags(tagsRes.data ?? [])

        const { data } = await api.get<WordListResponse>('/words', {
          params: {
            cefr,
            q: debouncedQ || undefined,
            dtype: dtype || undefined,
            gender: gender || undefined,
            tag: tag || undefined,
            locale: uiLocale || meRes.data.locale || 'vi',
            page,
            size,
          },
        })
        setItems((data.items ?? []).map((it) => mapWordToCard(it, t)))
        setTotal(data.total ?? 0)
      } catch (e) {
        if (isAxiosError(e) && e.response?.status === 401) {
          router.push('/login')
          return
        }
        setItems([])
        setTotal(0)
        setLoadError(t('loadError'))
        notifyApiError(e)
      } finally {
        setLoading(false)
      }
    })()
  }, [router, cefr, debouncedQ, dtype, gender, tag, page, size, uiLocale, t, notifyApiError])

  const reload = useVocabularyReload(async () => {
    if (!me) return
    setLoading(true)
    setLoadError('')
    try {
      setPage(0)
      const { data } = await api.get<WordListResponse>('/words', {
        params: {
          cefr,
          q: q || undefined,
          dtype: dtype || undefined,
          gender: gender || undefined,
          tag: tag || undefined,
          locale: uiLocale || me.locale || 'vi',
          page: 0,
          size,
        },
      })
      setItems((data.items ?? []).map((it) => mapWordToCard(it, t)))
      setTotal(data.total ?? 0)
      setDebouncedQ(q) // sync debounced
    } catch (e) {
      if (isAxiosError(e) && e.response?.status === 401) {
        router.push('/login')
        return
      }
      setLoadError(t('loadError'))
      notifyApiError(e, reload)
    } finally {
      setLoading(false)
    }
  })

  const openModal = (item: VocabCardItem) => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
    setModalClosing(false)
    setSelectedItem(item)
  }

  const requestCloseModal = () => {
    if (!selectedItem || modalClosing) return
    setModalClosing(true)
    closeTimerRef.current = setTimeout(() => {
      setSelectedItem(null)
      setModalClosing(false)
      closeTimerRef.current = null
    }, 230)
  }

  const handleLogout = useCallback(() => {
    clearTokens()
    router.push('/')
  }, [router])

  if (loading && !me) {
    return (
      <div className="min-h-screen df-page-mesh flex items-center justify-center">
        <p className="text-[#64748B]">{t('loading')}</p>
      </div>
    )
  }

  if (!me) return null

  const initials = me.displayName
    .split(' ')
    .map((p) => p.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const itCount = filtered.filter((item) => item.category === 'IT').length

  return (
    <StudentShell
      activeSection="vocabulary"
      user={{ displayName: me.displayName, role: me.role }}
      targetLevel={targetLevel}
      streakDays={streakDays}
      initials={initials}
      onLogout={handleLogout}
      headerTitle={t('pageHeroTitle')}
      headerSubtitle={t('subtitle')}
    >
      <div className="flex flex-col -mx-6 -mt-6">
      <section className="df-glass-subtle border-b border-white/30 rounded-t-2xl overflow-hidden">
        <div className="max-w-7xl mx-auto px-5 py-4">
          <div className="flex items-start justify-between mb-4 gap-3 flex-wrap">
            <p className="text-[#94A3B8] text-xs max-w-xl">
              {t('pageHeroSubtitle', { total, itCount })}
            </p>
            <div className="flex items-center gap-2 ml-auto">
              {/* Vocab practice shortcut */}
              <button
                type="button"
                onClick={() => {
                  const p = new URLSearchParams()
                  if (cefr) p.set('cefr', cefr)
                  if (tag) p.set('topic', tag)
                  const qs = p.toString()
                  router.push('/student/vocab-practice' + (qs ? '?' + qs : ''))
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all hover:scale-105"
                style={{ background: 'linear-gradient(135deg, #22d3ee, #a78bfa)', color: 'white', boxShadow: '0 2px 8px rgba(34,211,238,0.4)' }}
                title={t('practiceSpeak')}>
                <Mic size={13} />
                {t('practiceSpeak')}
              </button>
              <button
                type="button"
                onClick={() => {
                  const p = new URLSearchParams()
                  if (cefr) p.set('cefr', cefr)
                  if (tag) p.set('tag', tag)
                  const qs = p.toString()
                  router.push('/student/swipe-cards' + (qs ? '?' + qs : ''))
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all hover:scale-105 bg-white border border-[#E2E8F0] text-[#475569]"
                title={t('swipeCards')}>
                <Layers size={13} />
                {t('swipeCards')}
              </button>
              <div className="flex items-center gap-1 bg-[#F5F7FA] rounded-xl p-0.5 border border-[#E2E8F0]">
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-lg ${viewMode === 'grid' ? 'bg-white text-[#00305E] shadow-sm' : 'text-[#94A3B8]'}`}
                >
                  <LayoutGrid size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-white text-[#00305E] shadow-sm' : 'text-[#94A3B8]'}`}
                >
                  <List size={15} />
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
              <input
                type="text"
                placeholder={t('searchPlaceholder')}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setDebouncedQ(q)
                    setPage(0)
                  }
                }}
                className="w-full pl-9 pr-9 py-2.5 rounded-xl text-sm text-[#0F172A] placeholder-[#94A3B8] border border-[#E2E8F0] bg-[#F8FAFF] focus:outline-none focus:ring-2 focus:ring-[#00305E]/15"
              />
              {q && (
                <button
                  type="button"
                  onClick={() => { setQ(''); setDebouncedQ(''); setPage(0) }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#64748B]"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <button
              type="button"
              className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                showFilters ? 'bg-[#EEF4FF] text-[#00305E] border-[#bfd7ff]' : 'bg-[#F8FAFF] text-[#64748B] border-[#E2E8F0]'
              }`}
              onClick={() => setShowFilters((prev) => !prev)}
            >
              <Filter size={14} />
              {t('filterButton')}
              <ChevronDown size={13} />
            </button>
            <button type="button" className="btn-primary btn-md" onClick={reload} disabled={loading}>
              {t('filter')}
            </button>
          </div>

          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {CATEGORY_OPTIONS.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  categoryFilter === cat
                    ? 'bg-[#00305E] text-white border-[#00305E]'
                    : 'bg-white text-[#64748B] border-[#E2E8F0]'
                }`}
                onClick={() => {
                  setCategoryFilter(cat)
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          <div
            className={`grid sm:grid-cols-2 lg:grid-cols-5 gap-3 transition-all duration-300 overflow-hidden ${
              showFilters ? 'mt-3 opacity-100 max-h-[260px]' : 'mt-0 opacity-0 max-h-0'
            }`}
          >
              <div>
                <label className="text-xs text-[#64748B] font-semibold">CEFR</label>
                <select className="input mt-1" value={cefr} onChange={(e) => setCefr(e.target.value)}>
                  <option value="">{t('allLevels')}</option>
                  {['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((x) => (
                    <option key={x} value={x}>{x}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-[#64748B] font-semibold">{t('allTypes')}</label>
                <select className="input mt-1" value={dtype} onChange={(e) => setDtype(e.target.value as 'Noun' | 'Verb' | 'Adjective' | 'Word' | '')}>
                  <option value="">{t('allTypes')}</option>
                  <option value="Noun">{t('noun')}</option>
                  <option value="Verb">{t('verb')}</option>
                  <option value="Adjective">Adjective</option>
                  <option value="Word">Word</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-[#64748B] font-semibold">{t('allGenders')}</label>
                <select className="input mt-1" value={gender} onChange={(e) => setGender(e.target.value as 'DER' | 'DIE' | 'DAS' | '')}>
                  <option value="">{t('allGenders')}</option>
                  <option value="DER">DER</option>
                  <option value="DIE">DIE</option>
                  <option value="DAS">DAS</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-[#64748B] font-semibold">{t('allTags')}</label>
                <select className="input mt-1" value={tag} onChange={(e) => setTag(e.target.value)}>
                  <option value="">{t('allTags')}</option>
                  {tags.map((tagItem) => (
                    <option key={tagItem.id} value={tagItem.name}>{tagItem.localizedLabel ?? tagItem.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-[#64748B] font-semibold">{t('size')}</label>
                <select className="input mt-1" value={size} onChange={(e) => { setSize(Number(e.target.value)); setPage(0) }}>
                  {[12, 24, 48].map((x) => <option key={x} value={x}>{x}</option>)}
                </select>
              </div>
          </div>
        </div>
      </section>

      <main className="flex-1 max-w-7xl mx-auto w-full px-5 py-6">
        {loadError ? <div className="mb-4 alert-error">{loadError}</div> : null}
        {loading ? (
          <div className="text-[#64748B]">{t('loading')}</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-[#F1F4F9] flex items-center justify-center mb-4">
              <Search size={24} className="text-[#CBD5E1]" />
            </div>
            <p className="text-[#64748B] font-semibold mb-1">{t('emptyTitle')}</p>
            <p className="text-[#94A3B8] text-sm">{t('emptyHint')}</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between text-sm text-[#64748B] mb-4">
              <span>{t('results', { total, page: page + 1 })}</span>
              <div className="flex items-center gap-2">
                <button type="button" className="btn-secondary btn-sm" disabled={page <= 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                  {t('prev')}
                </button>
                <button type="button" className="btn-secondary btn-sm" disabled={(page + 1) * size >= total} onClick={() => setPage((p) => p + 1)}>
                  {t('next')}
                </button>
              </div>
            </div>

            {viewMode === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {filtered.map((item) => (
                  <VocabCard
                    key={item.id}
                    item={item}
                    index={item.id}
                    selected={selectedItem?.id === item.id}
                    onSelect={() => openModal(item)}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {filtered.map((item, idx) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => openModal(item)}
                    className="bg-white rounded-2xl border-2 border-[#E2E8F0] px-5 py-3.5 flex items-center gap-4 text-left hover:border-[#00305E] df-card-enter"
                    style={{ animationDelay: `${Math.min(idx, 10) * 35}ms` }}
                  >
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border" style={{ background: GENDER_STYLE[item.gender].bg, color: GENDER_STYLE[item.gender].text, borderColor: GENDER_STYLE[item.gender].border }}>
                      {item.article}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-[#00305E] truncate">{item.word}</p>
                      {item.phonetic ? <p className="text-xs text-[#94A3B8] font-mono">{item.phonetic}</p> : null}
                    </div>
                    <p className="hidden md:block text-sm text-[#334155] flex-1">{item.english}</p>
                    <button
                      type="button"
                      className="btn-outline btn-sm inline-flex items-center gap-1"
                      onClick={(e) => {
                        e.stopPropagation()
                        speakGerman(`${item.article} ${item.word}`)
                      }}
                    >
                      <Volume2 size={14} />
                    </button>
                    <ChevronRight size={14} className="text-[#CBD5E1]" />
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {selectedItem ? <DetailModal item={selectedItem} closing={modalClosing} onClose={requestCloseModal} /> : null}

      <style jsx global>{`
        @keyframes dfFadeUp {
          0% {
            opacity: 0;
            transform: translateY(14px) scale(0.995);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes dfOverlayIn {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes dfModalIn {
          0% {
            opacity: 0;
            transform: translateY(20px) scale(0.97);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes dfOverlayOut {
          0% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes dfModalOut {
          0% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          100% {
            opacity: 0;
            transform: translateY(18px) scale(0.97);
          }
        }
        @keyframes dfPulse {
          0%, 100% { transform: scaleY(1); }
          50% { transform: scaleY(1.45); }
        }
        .df-card-enter {
          animation: dfFadeUp 420ms cubic-bezier(0.2, 0.7, 0.25, 1) both;
        }
        .df-overlay-enter {
          animation: dfOverlayIn 240ms ease-out both;
        }
        .df-modal-enter {
          animation: dfModalIn 280ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
        }
        .df-overlay-exit {
          animation: dfOverlayOut 210ms ease-in both;
        }
        .df-modal-exit {
          animation: dfModalOut 220ms cubic-bezier(0.5, 0, 0.8, 0.2) both;
        }
      `}</style>
      </div>
      <QuickAiToolbar />
    </StudentShell>
  )
}


