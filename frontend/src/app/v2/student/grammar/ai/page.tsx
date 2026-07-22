'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Brain, BookOpen, CheckCircle2, Globe, RotateCcw } from 'lucide-react'
import api from '@/lib/api'
import { recordAbilityScore, scorePercentToItem } from '@/lib/abilityApi'
import { localAiApi } from '@/lib/localAiApi'
import { useStudentPracticeSession } from '@/hooks/useStudentPracticeSession'
import { useTracking } from '@/hooks/useTracking'
import { GaCap, GaCard, GaPageHdr, LoadingState, TkSeg } from '@/components/ui-v2'

/**
 * /v2/student/grammar/ai — công cụ NGỮ PHÁP AI (vỏ Galerie).
 *
 * Port của /student/grammar-practice. GIỮ NGUYÊN endpoint + payload:
 *   · POST /grammar/ai/practice-suggestions  { cefrLevel, count: 6 }
 *   · POST /grammar/ai/correct | /explain | /analyze  { text, cefrLevel }
 *   · POST /speaking/ai/cultural-context     (qua localAiApi.culturalContext)
 * Giữ nguyên việc ghi điểm năng lực (recordAbilityScore + scorePercentToItem) và toàn bộ event
 * PostHog `grammar_practice` (started / quit / completed + {action, cefr, latencyMs}).
 *
 * KHÁC /v2/student/grammar[/practice]: hai trang kia chạy trên /grammar/syllabus/* (bài soạn sẵn,
 * chấm bằng đáp án). Trang này là phần AI sinh nội dung — backend riêng, KHÔNG bị hai trang kia phủ.
 */

type Tab = 'suggestions' | 'correct' | 'explain' | 'analyze' | 'cultural'
const TABS: Tab[] = ['suggestions', 'correct', 'explain', 'analyze', 'cultural']

const CEFR = ['A1', 'A2', 'B1', 'B2'] as const
type Cefr = (typeof CEFR)[number]

/** Chip chủ đề văn hoá Đức — giữ nguyên danh sách của v1 (tiếng Đức, không dịch). */
const CULTURAL_CHIPS = [
  'Pünktlichkeit',
  'Kaffeekultur',
  'Duzen vs Siezen',
  'Begrüßung',
  'Feierabend',
  'Mülltrennung',
  'Direktheit',
  'Weihnachten',
]

interface Suggestion {
  topic: string
  description: string
  example: string
}

export default function V2StudentGrammarAiPage() {
  const t = useTranslations('v2.student.grammarAi')
  const { me, loading: meLoading } = useStudentPracticeSession()
  const { trackFeatureAction } = useTracking()

  const [tab, setTab] = useState<Tab>('suggestions')
  const [cefr, setCefr] = useState<Cefr>('A1')
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Record<string, unknown> | null>(null)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [sessionStart] = useState(() => Date.now())

  const [culturalTopic, setCulturalTopic] = useState('')
  const [culturalLoading, setCulturalLoading] = useState(false)
  const [culturalResult, setCulturalResult] = useState<{ topic: string; culturalContext: string } | null>(null)

  useEffect(() => {
    trackFeatureAction('grammar_practice', 'started')
    return () => trackFeatureAction('grammar_practice', 'quit')
  }, [trackFeatureAction])

  const loadSuggestions = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.post<{ suggestions: Suggestion[] }>('/grammar/ai/practice-suggestions', {
        cefrLevel: cefr,
        count: 6,
      })
      setSuggestions(data?.suggestions ?? [])
    } catch {
      setSuggestions([])
    } finally {
      setLoading(false)
    }
  }, [cefr])

  useEffect(() => {
    if (me && tab === 'suggestions') void loadSuggestions()
  }, [me, tab, loadSuggestions])

  const run = async () => {
    if (!text.trim()) return
    setLoading(true)
    setResult(null)
    const endpoint =
      tab === 'correct' ? '/grammar/ai/correct' : tab === 'explain' ? '/grammar/ai/explain' : '/grammar/ai/analyze'
    const startTime = Date.now()
    try {
      const { data } = await api.post<Record<string, unknown>>(endpoint, { text, cefrLevel: cefr })
      const latencyMs = Date.now() - startTime
      setResult(data)
      // Quy tắc chấm điểm giữ nguyên v1: analyze → lấy `score` (mặc định 70);
      // correct/explain → có lỗi = 60, không lỗi = 90.
      const score =
        tab === 'analyze'
          ? Number((data as { score?: number })?.score ?? 70)
          : (data as { errors?: unknown[] })?.errors?.length
            ? 60
            : 90
      await recordAbilityScore([scorePercentToItem(score)], Math.max(1, (Date.now() - sessionStart) / 1000))
      trackFeatureAction('grammar_practice', 'completed', { action: tab, cefr, latencyMs })
    } catch {
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  const runCultural = async (topic?: string) => {
    const topicText = topic ?? culturalTopic
    if (!topicText.trim()) return
    if (topic) setCulturalTopic(topic)
    setCulturalLoading(true)
    setCulturalResult(null)
    const startTime = Date.now()
    try {
      const res = await localAiApi.culturalContext(topicText.trim())
      const latencyMs = Date.now() - startTime
      setCulturalResult(res.data)
      trackFeatureAction('grammar_practice', 'completed', { action: 'cultural', topic: topicText.trim(), latencyMs })
    } catch {
      setCulturalResult(null)
    } finally {
      setCulturalLoading(false)
    }
  }

  if (meLoading || !me) return <LoadingState label={t('loading')} />

  const isTextTab = tab === 'correct' || tab === 'explain' || tab === 'analyze'
  const RunIcon = tab === 'correct' ? CheckCircle2 : tab === 'explain' ? BookOpen : Brain

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr accent title={t('title')} subtitle={t('subtitle')} />

      <div className="flex-1 px-4 py-6 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-2xl space-y-[18px]">
          {/* Tabs */}
          <TkSeg
            aria-label={t('tabsLabel')}
            className="w-full [&>button]:flex-1"
            options={TABS.map((id) => ({ value: id, label: t(`tabs.${id}`) }))}
            value={tab}
            onValueChange={(v) => {
              setTab(v)
              setResult(null)
              setCulturalResult(null)
            }}
          />

          {/* CEFR — không áp dụng cho tab văn hoá (giữ đúng v1) */}
          {tab !== 'cultural' && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <GaCap>{t('levelLabel')}</GaCap>
              <TkSeg
                aria-label={t('levelLabel')}
                options={CEFR.map((l) => ({ value: l, label: l }))}
                value={cefr}
                onValueChange={setCefr}
              />
            </div>
          )}

          {/* Gợi ý luyện tập */}
          {tab === 'suggestions' && (
            <div className="space-y-3">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => void loadSuggestions()}
                  className="ga-ui inline-flex min-h-10 items-center gap-1 text-[12.5px] font-semibold text-ga-accent transition-opacity hover:opacity-80 lg:min-h-0"
                >
                  <RotateCcw size={12} aria-hidden /> {t('refresh')}
                </button>
              </div>

              {loading ? (
                <LoadingState label={t('loadingSuggestions')} />
              ) : suggestions.length === 0 ? (
                <div className="rounded-ga border border-ga-line bg-ga-card py-14 text-center">
                  <p className="font-ga-display text-[20px] font-medium text-ga-ink">{t('noSuggestions')}</p>
                  <p className="ga-ui mt-2 text-[13px] text-ga-muted">{t('noSuggestionsDesc')}</p>
                </div>
              ) : (
                suggestions.map((s, i) => (
                  <GaCard key={i} hover>
                    {/* Bấm vào gợi ý → nạp câu ví dụ sang tab "Sửa lỗi" (hành vi v1). */}
                    <button
                      type="button"
                      onClick={() => {
                        setText(s.example ?? '')
                        setTab('correct')
                      }}
                      className="w-full px-4 py-4 text-left transition-colors hover:bg-ga-surface lg:px-5"
                    >
                      <p className="text-[15px] font-semibold text-ga-ink">{s.topic}</p>
                      {s.description && <p className="ga-ui mt-1 text-[13px] text-ga-muted">{s.description}</p>}
                      {s.example && (
                        <p className="ga-ui mt-2 rounded-ga border border-ga-line bg-ga-surface px-3 py-1.5 text-[12.5px] italic text-ga-muted">
                          &ldquo;{s.example}&rdquo;
                        </p>
                      )}
                    </button>
                  </GaCard>
                ))
              )}
            </div>
          )}

          {/* Văn hoá Đức */}
          {tab === 'cultural' && (
            <div className="space-y-4">
              <GaCard className="p-4 lg:p-5">
                <GaCap className="mb-2 block">{t('culturalTopicCap')}</GaCap>
                <div className="flex flex-wrap gap-2">
                  <input
                    value={culturalTopic}
                    onChange={(e) => setCulturalTopic(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void runCultural()
                    }}
                    placeholder={t('culturalPlaceholder')}
                    className="ga-ui min-w-0 flex-1 basis-40 rounded-ga border border-ga-line bg-ga-card px-3.5 py-2.5 text-[14px] text-ga-ink outline-none focus:border-ga-accent"
                  />
                  <button
                    type="button"
                    onClick={() => void runCultural()}
                    disabled={culturalLoading || !culturalTopic.trim()}
                    className="ga-ui inline-flex items-center gap-2 rounded-ga bg-ga-accent px-4 py-3 text-[13px] font-semibold text-ga-accent-ink transition-opacity hover:opacity-90 disabled:opacity-50 lg:py-2.5"
                  >
                    <Globe size={14} aria-hidden /> {t('lookUp')}
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {CULTURAL_CHIPS.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => void runCultural(chip)}
                      className="ga-ui inline-flex min-h-10 items-center rounded-ga-pill bg-ga-accent-soft px-3 py-1 text-[11.5px] font-medium text-ga-accent transition-opacity hover:opacity-80 lg:min-h-0 lg:px-2.5"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </GaCard>

              {culturalLoading && <LoadingState label={t('culturalLoading')} />}

              {culturalResult && (
                <GaCard className="p-4 lg:p-6">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="shrink-0 text-[20px]" aria-hidden>
                      🇩🇪
                    </span>
                    <p className="min-w-0 break-words font-ga-display text-[20px] font-medium text-ga-ink">{culturalResult.topic}</p>
                  </div>
                  <p className="ga-ui whitespace-pre-wrap break-words text-[14px] leading-relaxed text-ga-muted">
                    {culturalResult.culturalContext}
                  </p>
                </GaCard>
              )}
            </div>
          )}

          {/* Sửa lỗi · Giải thích · Phân tích */}
          {isTextTab && (
            <div className="space-y-3">
              <GaCard className="p-4 lg:p-5">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={t(`placeholders.${tab}`)}
                  rows={4}
                  className="ga-ui min-h-[90px] w-full resize-none bg-transparent text-[14px] leading-relaxed text-ga-ink outline-none"
                />
                <button
                  type="button"
                  onClick={run}
                  disabled={loading || !text.trim()}
                  className="ga-ui mt-3 inline-flex items-center gap-2 rounded-ga bg-ga-accent px-4 py-3 text-[13px] font-semibold text-ga-accent-ink transition-opacity hover:opacity-90 disabled:opacity-50 lg:py-2.5"
                >
                  <RunIcon size={14} aria-hidden />
                  {loading ? t('processing') : t(`actions.${tab}`)}
                </button>
              </GaCard>

              {loading && <LoadingState label={t('processing')} />}

              {result != null && (
                <GaCard className="p-4 lg:p-5">
                  <GaCap className="mb-3 block">{t('resultCap')}</GaCap>
                  {/* Giữ nguyên cách hiển thị của v1: đổ thẳng JSON trả về. Ba endpoint có ba shape
                      khác nhau — render có cấu trúc là việc riêng, không gộp vào đợt port này. */}
                  <pre className="max-h-64 overflow-auto rounded-ga border border-ga-line bg-ga-surface p-3 font-mono text-[12px] whitespace-pre-wrap text-ga-ink">
                    {JSON.stringify(result, null, 2)}
                  </pre>
                </GaCard>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
