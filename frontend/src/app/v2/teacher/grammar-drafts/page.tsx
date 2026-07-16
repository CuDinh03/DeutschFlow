'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  Brain, FileEdit, Send, SendHorizonal, Loader2, ChevronDown, ChevronUp,
} from 'lucide-react'
import { toast } from 'sonner'
import api, { apiMessage } from '@/lib/api'
import { GaPageHdr, GaBtn, GaCap, EmptyState, LoadingState } from '@/components/ui-v2'

// ─────────────────────────────────────────────────────────────────────────────
// Ngân hàng bài tập ngữ pháp (giáo viên) — nơi GV *tạo* bản nháp mà admin *duyệt*
// ở /v2/admin/grammar-review. Port 1:1 từ v1 teacher/dashboard/[id]/grammar.
//
// Plumbing tái dùng nguyên vẹn (zero backend):
//   GET  /grammar/syllabus/topics?cefrLevel={lv}          → danh sách chủ đề
//   GET  /grammar/syllabus/exercises/my-drafts            → bản nháp của tôi (mọi trạng thái)
//   POST /grammar/syllabus/topics/{id}/generate {count:5} → AI sinh → status DRAFT
//   POST /grammar/syllabus/exercises/{id}/submit-review   → DRAFT → PENDING_REVIEW
//   POST /grammar/syllabus/topics/{id}/submit-all-review  → mọi DRAFT của topic → PENDING_REVIEW
//
// Vòng khép kín: submit-review ghi status='PENDING_REVIEW' vào bảng grammar_exercises,
// đúng là điều kiện admin/pending đọc ra (GrammarSyllabusService). GV nộp → admin thấy.
//
// Khác v1 duy nhất: v1 ghim cứng cefrLevel=A1 nên các chủ đề A2/B1/B2 (seed V257) KHÔNG có
// đường tạo bài tập nào. Ở đây dùng tab cấp độ — vẫn đúng param `cefrLevel` sẵn có của endpoint.
// ─────────────────────────────────────────────────────────────────────────────

interface GrammarTopic {
  id: number
  cefr_level: string
  title_de: string
  title_vi: string
}
interface DraftExercise {
  id: number
  topic_id: number
  topic_title?: string
  exercise_type: string
  difficulty: number
  question_json: string
  status: string
  reject_reason?: string | null
}
interface ParsedQ { prompt?: string; options?: string[]; correct_answer?: string; explanation_vi?: string }

const LEVELS = ['A1', 'A2', 'B1', 'B2'] as const
const GENERATE_COUNT = 5

const STATUS_STYLE: Record<string, { fg: string; bg: string }> = {
  DRAFT: { fg: 'var(--ga-muted)', bg: 'var(--ga-side-active)' },
  PENDING_REVIEW: { fg: 'var(--ga-orange)', bg: 'var(--ga-orange-soft)' },
  APPROVED: { fg: 'var(--ga-green)', bg: 'var(--ga-green-soft)' },
  REJECTED: { fg: 'var(--ga-red)', bg: 'var(--ga-red-soft)' },
}
const STATUS_KEY: Record<string, string> = {
  DRAFT: 'statusDraft',
  PENDING_REVIEW: 'statusPending',
  APPROVED: 'statusApproved',
  REJECTED: 'statusRejected',
}

export default function V2TeacherGrammarDraftsPage() {
  const t = useTranslations('v2.teacher.grammarDrafts')
  const tc = useTranslations('v2.common')

  const [level, setLevel] = useState<string>('A1')
  const [topics, setTopics] = useState<GrammarTopic[]>([])
  const [drafts, setDrafts] = useState<DraftExercise[]>([])
  const [selectedTopic, setSelectedTopic] = useState<GrammarTopic | null>(null)
  const [generatingFor, setGeneratingFor] = useState<number | null>(null)
  const [submittingId, setSubmittingId] = useState<number | null>(null)
  const [submittingAll, setSubmittingAll] = useState<number | null>(null)
  const [loadingTopics, setLoadingTopics] = useState(true)
  const [loadingDrafts, setLoadingDrafts] = useState(true)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [error, setError] = useState('')

  const loadTopics = useCallback(async (lv: string) => {
    setLoadingTopics(true)
    try {
      const { data } = await api.get<GrammarTopic[]>(`/grammar/syllabus/topics?cefrLevel=${lv}`)
      setTopics(data ?? [])
      setError('')
    } catch (e: unknown) {
      setTopics([])
      setError(apiMessage(e))
    } finally {
      setLoadingTopics(false)
    }
  }, [])

  const loadDrafts = useCallback(async () => {
    setLoadingDrafts(true)
    try {
      const { data } = await api.get<DraftExercise[]>('/grammar/syllabus/exercises/my-drafts')
      setDrafts(data ?? [])
    } catch {
      setDrafts([])
    } finally {
      setLoadingDrafts(false)
    }
  }, [])

  useEffect(() => { void loadTopics(level) }, [loadTopics, level])
  useEffect(() => { void loadDrafts() }, [loadDrafts])

  const generate = async (topic: GrammarTopic) => {
    setGeneratingFor(topic.id)
    try {
      const { data } = await api.post<DraftExercise[]>(
        `/grammar/syllabus/topics/${topic.id}/generate`,
        { count: GENERATE_COUNT },
      )
      toast.success(t('generated', { count: data?.length ?? GENERATE_COUNT, topic: topic.title_vi }))
      void loadDrafts()
    } catch (e: unknown) {
      toast.error(apiMessage(e))
    } finally {
      setGeneratingFor(null)
    }
  }

  const submitOne = async (exerciseId: number) => {
    setSubmittingId(exerciseId)
    try {
      await api.post(`/grammar/syllabus/exercises/${exerciseId}/submit-review`)
      toast.success(t('submittedOne'))
      void loadDrafts()
    } catch (e: unknown) {
      toast.error(apiMessage(e))
    } finally {
      setSubmittingId(null)
    }
  }

  const submitAll = async (topicId: number) => {
    setSubmittingAll(topicId)
    try {
      await api.post(`/grammar/syllabus/topics/${topicId}/submit-all-review`)
      toast.success(t('submittedAll'))
      void loadDrafts()
    } catch (e: unknown) {
      toast.error(apiMessage(e))
    } finally {
      setSubmittingAll(null)
    }
  }

  const visibleDrafts = useMemo(
    () => (selectedTopic ? drafts.filter((d) => d.topic_id === selectedTopic.id) : drafts),
    [drafts, selectedTopic],
  )
  const pendingCount = useMemo(
    () => drafts.filter((d) => d.status === 'PENDING_REVIEW').length,
    [drafts],
  )

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr
        accent
        title={t('title')}
        subtitle={t('subtitle', { pending: pendingCount })}
        right={
          <GaBtn
            variant="ghost"
            size="sm"
            onClick={() => { void loadTopics(level); void loadDrafts() }}
          >
            {t('refresh')}
          </GaBtn>
        }
      />

      <div className="flex-1 overflow-auto px-10 py-6">
        <div className="grid gap-6 md:grid-cols-3">
          {/* ── Chủ đề ─────────────────────────────────────────────── */}
          <div className="border border-ga-line bg-ga-card p-4">
            <GaCap className="mb-3 block">{t('topicsCap')}</GaCap>

            <div className="mb-3 flex items-center gap-1.5">
              {LEVELS.map((lv) => (
                <button
                  key={lv}
                  type="button"
                  onClick={() => { setLevel(lv); setSelectedTopic(null) }}
                  className="ga-ui border px-2.5 py-1 text-[11.5px] font-bold transition-colors"
                  style={
                    level === lv
                      ? { color: 'var(--ga-bg)', background: 'var(--ga-accent)', borderColor: 'var(--ga-accent)' }
                      : { color: 'var(--ga-muted)', borderColor: 'var(--ga-line)' }
                  }
                >
                  {lv}
                </button>
              ))}
            </div>

            {loadingTopics ? (
              <LoadingState variant="skeleton" rows={5} label={tc('loading')} />
            ) : error ? (
              <div className="py-6 text-center">
                <p className="ga-ui mb-3 text-[12.5px] text-ga-red">{error}</p>
                <GaBtn variant="ghost" size="sm" onClick={() => void loadTopics(level)}>{tc('retry')}</GaBtn>
              </div>
            ) : topics.length === 0 ? (
              <p className="ga-ui py-6 text-center text-[12.5px] text-ga-muted">{t('topicsEmpty')}</p>
            ) : (
              <div className="space-y-1.5">
                {topics.map((topic) => {
                  const open = selectedTopic?.id === topic.id
                  return (
                    <div key={topic.id} className="space-y-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectedTopic(open ? null : topic)}
                        className="ga-ui flex w-full items-center justify-between gap-2 border px-3 py-2 text-left text-[13px] font-medium transition-colors"
                        style={
                          open
                            ? { color: 'var(--ga-accent)', borderColor: 'var(--ga-accent)', background: 'var(--ga-accent-soft)' }
                            : { color: 'var(--ga-ink)', borderColor: 'var(--ga-line)' }
                        }
                      >
                        <span className="truncate">{topic.title_vi}</span>
                        <span
                          className="shrink-0 px-1.5 py-0.5 text-[10px] font-bold"
                          style={{ color: 'var(--ga-violet)', background: 'var(--ga-violet-soft)' }}
                        >
                          {topic.cefr_level}
                        </span>
                      </button>

                      {open && (
                        <div className="flex gap-1.5 pl-1">
                          <GaBtn
                            variant="yellow"
                            size="sm"
                            className="flex-1"
                            loading={generatingFor === topic.id}
                            disabled={generatingFor === topic.id}
                            onClick={() => generate(topic)}
                          >
                            <Brain size={13} /> {t('generate', { count: GENERATE_COUNT })}
                          </GaBtn>
                          <GaBtn
                            variant="ghost"
                            size="sm"
                            className="flex-1"
                            loading={submittingAll === topic.id}
                            disabled={submittingAll === topic.id}
                            onClick={() => submitAll(topic.id)}
                          >
                            <SendHorizonal size={13} /> {t('submitAll')}
                          </GaBtn>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── Bản nháp ───────────────────────────────────────────── */}
          <div className="md:col-span-2">
            <p className="ga-ui mb-3 text-[13.5px] font-bold text-ga-ink">
              {selectedTopic ? t('draftsFor', { topic: selectedTopic.title_vi }) : t('draftsAll')}
              <span className="ml-2 font-normal text-ga-subtle">{t('count', { count: visibleDrafts.length })}</span>
            </p>

            {loadingDrafts ? (
              <LoadingState variant="skeleton" rows={5} label={tc('loading')} />
            ) : visibleDrafts.length === 0 ? (
              <EmptyState
                variant="invite"
                icon="menu_book"
                title={t('emptyTitle')}
                description={t('emptyDesc')}
              />
            ) : (
              <div className="flex flex-col gap-2.5">
                {visibleDrafts.map((ex) => {
                  let parsed: ParsedQ = {}
                  try { parsed = JSON.parse(ex.question_json) as ParsedQ } catch { /* ignore */ }
                  const open = expandedId === ex.id
                  const style = STATUS_STYLE[ex.status] ?? STATUS_STYLE.DRAFT
                  const statusLabel = t(STATUS_KEY[ex.status] ?? 'statusDraft')

                  return (
                    <div key={ex.id} className="border border-ga-line bg-ga-card">
                      <div className="flex items-start gap-3 p-4">
                        <span
                          className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center"
                          style={{ color: 'var(--ga-accent)', background: 'var(--ga-accent-soft)' }}
                        >
                          <FileEdit size={14} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[14px] font-semibold text-ga-ink">{parsed.prompt ?? t('exerciseFallback')}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <span
                              className="px-1.5 py-0.5 text-[10px] font-bold uppercase text-ga-muted"
                              style={{ background: 'var(--ga-side-active)' }}
                            >
                              {ex.exercise_type}
                            </span>
                            <span className="ga-ui text-[11px] text-ga-subtle">
                              {t('difficulty', { level: ex.difficulty })}
                            </span>
                            {!selectedTopic && ex.topic_title && (
                              <span className="truncate text-[11px] text-ga-subtle">{ex.topic_title}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span
                            className="px-2 py-0.5 text-[10px] font-bold"
                            style={{ color: style.fg, background: style.bg }}
                          >
                            {statusLabel}
                          </span>
                          <button
                            type="button"
                            onClick={() => setExpandedId(open ? null : ex.id)}
                            className="text-ga-muted transition-colors hover:text-ga-ink"
                            aria-label={t('toggleAria', { id: ex.id })}
                          >
                            {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        </div>
                      </div>

                      {open && (
                        <div className="space-y-3 border-t border-ga-line px-4 pb-4 pt-3">
                          {parsed.options && (
                            <div className="flex flex-wrap gap-2">
                              {parsed.options.map((o, i) => (
                                <span
                                  key={i}
                                  className="px-2.5 py-1 text-[12px]"
                                  style={
                                    o === parsed.correct_answer
                                      ? { color: 'var(--ga-green)', background: 'var(--ga-green-soft)', fontWeight: 700 }
                                      : { color: 'var(--ga-muted)', background: 'var(--ga-side-active)' }
                                  }
                                >
                                  {o}
                                </span>
                              ))}
                            </div>
                          )}
                          {parsed.explanation_vi && (
                            <p className="ga-ui text-[12.5px] italic text-ga-muted">{parsed.explanation_vi}</p>
                          )}
                          {ex.status === 'REJECTED' && ex.reject_reason && (
                            <p className="ga-ui border-l-2 pl-2.5 text-[12.5px]" style={{ borderColor: 'var(--ga-red)', color: 'var(--ga-red)' }}>
                              {t('rejectReason', { reason: ex.reject_reason })}
                            </p>
                          )}
                          {ex.status === 'DRAFT' && (
                            <button
                              type="button"
                              disabled={submittingId === ex.id}
                              onClick={() => submitOne(ex.id)}
                              className="ga-ui inline-flex items-center gap-1.5 border px-3 py-1.5 text-[11.5px] font-bold transition-colors disabled:opacity-60"
                              style={{ color: 'var(--ga-accent)', borderColor: 'var(--ga-accent)' }}
                            >
                              {submittingId === ex.id ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                              {t('submitOne')}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
