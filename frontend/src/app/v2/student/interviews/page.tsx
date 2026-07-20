'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ArrowLeft, Briefcase, Calendar, Download, Loader2, MessageSquare, Plus, Target } from 'lucide-react'
import api from '@/lib/api'
import { SessionSummary } from '@/components/features/ai-speaking/SessionSummary'
import { submitInterviewReport, streamJobResult } from '@/lib/interviewReportApi'
import { interviewDomainApi, type InterviewPhaseResultInfo } from '@/lib/interviewDomainApi'
import { useAiSpeakingQuota } from '@/hooks/useAiSpeakingQuota'
import { usePageTimeTracker } from '@/hooks/usePageTimeTracker'
import { useTracking } from '@/hooks/useTracking'
import { GaCap, GaCard, GaPageHdr, LoadingState, TkBadge } from '@/components/ui-v2'

/**
 * /v2/student/interviews — mock-interview RESULTS (Galerie shell).
 *
 * Port of the legacy /student/interviews page: same endpoints (GET /ai-speaking/sessions filtered
 * to sessionMode === 'INTERVIEW' · /sessions/{id}/messages · /interviews/{id}/phase-results) and the
 * same report lifecycle (stored report → else auto-submit + SSE stream for COMPLETED sessions with
 * ≥ 4 turns). The report card itself is the shared <SessionSummary> (dark by design) — reused, not
 * re-skinned, so the two surfaces can never drift.
 *
 * "Phỏng vấn mới" opens the v2 speaking engine (CompanionSelect reads ?mode and ?return), so the
 * user lands back on this results page when the session ends.
 */

const RETURN_TO = '/v2/student/interviews'
// Engine luyện nói đã có bản v2 (/v2/student/speaking/setup → …/live, cùng code engine, vỏ
// Galerie) → CTA "phỏng vấn mới" trỏ thẳng vào v2, không deep-link ngược /speaking (v1) nữa.
// ?mode=INTERVIEW để màn chọn nhân vật mở sẵn tab Phỏng vấn.
const NEW_INTERVIEW_HREF = `/v2/student/speaking/setup?mode=INTERVIEW&return=${encodeURIComponent(RETURN_TO)}`

interface SessionMessage {
  id: string
  role: 'user' | 'ai'
  contentDe: string
  isStreaming?: boolean
  feedback?: {
    errors?: unknown[]
    explanationVi?: string
    suggestions?: string[]
    correction?: string
    grammarPoint?: string
    action?: unknown
  }
}

interface SpeakingSession {
  id: number
  topic?: string
  cefrLevel?: string
  persona?: string
  status?: string
  createdAt?: string
  messageCount?: number
  sessionMode?: 'COMMUNICATION' | 'INTERVIEW'
  interviewPosition?: string
  experienceLevel?: string
  interviewReportJson?: string
}

export default function V2StudentInterviewsPage() {
  usePageTimeTracker('interviews')
  const t = useTranslations('v2.student.interviews')
  const { trackFeatureAction } = useTracking()
  const { quota } = useAiSpeakingQuota()

  const [sessions, setSessions] = useState<SpeakingSession[]>([])
  const [selected, setSelected] = useState<SpeakingSession | null>(null)
  const [messages, setMessages] = useState<SessionMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [reportJson, setReportJson] = useState<string | null>(null)
  const [phaseResults, setPhaseResults] = useState<InterviewPhaseResultInfo[]>([])
  const [generatingReport, setGeneratingReport] = useState(false)
  const [reportError, setReportError] = useState<string | null>(null)
  const reportStreamRef = useRef<AbortController | null>(null)

  useEffect(() => {
    api
      .get('/ai-speaking/sessions?size=50&sort=startedAt,desc')
      .then((res) => {
        const data = res.data
        const all = Array.isArray(data) ? data : (data?.content ?? data?.items ?? [])
        setSessions(all.filter((s: SpeakingSession) => s.sessionMode === 'INTERVIEW'))
      })
      .catch(() => setSessions([]))
      .finally(() => setLoading(false))
  }, [])

  // Abort the report SSE stream on unmount so a closed page can't keep a connection open.
  useEffect(() => () => reportStreamRef.current?.abort(), [])

  const openSession = async (sess: SpeakingSession) => {
    setSelected(sess)
    trackFeatureAction('interview_session', 'clicked', {
      session_id: sess.id,
      position: sess.interviewPosition,
      experience_level: sess.experienceLevel,
      cefr: sess.cefrLevel,
      message_count: sess.messageCount,
    })
    setReportJson(null)
    setPhaseResults([])
    setReportError(null)
    setLoadingMsgs(true)
    try {
      const res = await api.get(`/ai-speaking/sessions/${sess.id}/messages`)
      const raw = Array.isArray(res.data) ? res.data : (res.data?.content ?? [])
      const mapped: SessionMessage[] = raw.map((m: Record<string, unknown>) => {
        const isUser = String(m.role ?? '').toLowerCase() === 'user'
        return {
          id: String(m.id ?? Date.now() + Math.random()),
          role: isUser ? 'user' : 'ai',
          contentDe: String((isUser ? (m.userText ?? m.userMessage) : m.aiSpeechDe) ?? ''),
          isStreaming: false,
          feedback: {
            errors: (m.errors as unknown[]) || [],
            explanationVi: (m.explanationVi as string) || '',
            correction: (m.correction as string) || undefined,
            grammarPoint: (m.grammarPoint as string) || undefined,
            action: m.assistantAction ?? null,
          },
        }
      })
      setMessages(mapped)

      // Structured phase results are optional — a failure must not block the report.
      interviewDomainApi
        .getPhaseResults(sess.id)
        .then(setPhaseResults)
        .catch(() => {})

      if (sess.interviewReportJson) {
        setReportJson(sess.interviewReportJson)
      } else if (sess.status === 'COMPLETED' && sess.messageCount && sess.messageCount >= 4) {
        // Auto-generate the report for a completed session that doesn't have one yet.
        setGeneratingReport(true)
        try {
          const jobId = await submitInterviewReport(sess.id)
          reportStreamRef.current = streamJobResult(
            jobId,
            (result) => {
              setReportJson(result)
              setGeneratingReport(false)
              // Cache on the session so reopening it is instant
              setSessions((prev) => prev.map((s) => (s.id === sess.id ? { ...s, interviewReportJson: result } : s)))
            },
            (err) => {
              setReportError(err)
              setGeneratingReport(false)
            },
            () => {
              setReportError(t('reportTimeout'))
              setGeneratingReport(false)
            },
          )
        } catch {
          setGeneratingReport(false)
        }
      }
    } catch {
      setMessages([])
    } finally {
      setLoadingMsgs(false)
    }
  }

  const closeSession = () => {
    setSelected(null)
    setMessages([])
    reportStreamRef.current?.abort()
  }

  const downloadReport = (json: string, sessionId: number) => {
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `interview-report-${sessionId}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const weeklyCount = sessions.filter(
    (s) => s.createdAt && Date.now() - new Date(s.createdAt).getTime() < 7 * 24 * 60 * 60 * 1000,
  ).length

  // Report view — <SessionSummary> is built for a dark canvas, so it keeps its own surface
  // (the same treatment the legacy page used) instead of the light Galerie card.
  if (selected && !loadingMsgs) {
    return (
      <div
        className="flex min-h-full flex-col"
        style={{ background: 'linear-gradient(180deg, #0A0F1E 0%, #0F172A 60%, #1A1535 100%)' }}
      >
        <div className="mx-auto flex w-full max-w-[560px] flex-1 flex-col overflow-y-auto p-4">
          <div className="mb-4 mt-2 flex items-center justify-between">
            <button
              type="button"
              onClick={closeSession}
              className="ga-ui flex items-center gap-2 text-[13px] font-semibold text-white/70 transition-colors hover:text-white"
            >
              <span className="grid h-8 w-8 place-items-center rounded-full bg-white/10">
                <ArrowLeft size={16} aria-hidden />
              </span>
              {t('closeReport')}
            </button>
            {reportJson && (
              <button
                type="button"
                onClick={() => downloadReport(reportJson, selected.id)}
                className="ga-ui flex items-center gap-1.5 rounded-ga px-3 py-1.5 text-[12px] font-semibold text-white/60 transition-colors hover:text-white/90"
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}
              >
                <Download size={13} aria-hidden /> {t('downloadReport')}
              </button>
            )}
          </div>

          {generatingReport && (
            <div
              className="mb-4 flex items-center gap-3 rounded-ga px-4 py-3"
              style={{ background: 'rgba(255,205,0,0.1)', border: '1px solid rgba(255,205,0,0.2)' }}
            >
              <Loader2 size={16} className="animate-spin text-yellow-400" aria-hidden />
              <span className="ga-ui text-[13px] font-medium text-yellow-300">{t('generatingReport')}</span>
            </div>
          )}

          {reportError && (
            <div
              className="mb-4 rounded-ga px-4 py-3"
              style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)' }}
            >
              <span className="ga-ui text-[13px] text-red-300">{reportError}</span>
            </div>
          )}

          <SessionSummary
            // SessionSummary's ChatMessage type is not exported; the mapped shape is the exact one
            // the legacy page fed it (same fields, same optionality).
            messages={messages as never}
            duration="N/A"
            isInterviewMode
            interviewReportJson={reportJson}
            onRestart={() => {
              window.location.href = NEW_INTERVIEW_HREF
            }}
            onExit={closeSession}
          />

          {phaseResults.length > 0 && (
            <div
              className="mt-6 overflow-hidden rounded-ga"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}
            >
              <div className="border-b border-white/10 px-5 py-4">
                <h3 className="ga-ui text-[13px] font-semibold text-white/90">{t('phaseCap')}</h3>
              </div>
              <div className="space-y-3 p-4">
                {phaseResults.map((pr) => {
                  const pct = Math.round((pr.score / 10) * 100)
                  const color = pr.score >= 7 ? '#34d399' : pr.score >= 5 ? '#fbbf24' : '#f87171'
                  const parseList = (json: string): string[] => {
                    try {
                      return JSON.parse(json) as string[]
                    } catch {
                      return []
                    }
                  }
                  const strengths = parseList(pr.strengthsJson)
                  const weaknesses = parseList(pr.weaknessesJson)
                  return (
                    <div key={pr.phase} className="rounded-ga p-4" style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <div className="mb-2 flex items-center justify-between">
                        <span className="ga-ui text-[12px] font-semibold text-white/80">{pr.phase}</span>
                        <span className="ga-ui text-[12px] font-bold" style={{ color }}>
                          {pr.score.toFixed(1)}/10
                        </span>
                      </div>
                      <div className="mb-3 h-1.5 rounded-full bg-white/10">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                      </div>
                      {strengths.length > 0 && (
                        <ul className="mb-1 space-y-0.5">
                          {strengths.map((s, i) => (
                            <li key={i} className="ga-ui text-[11px] text-emerald-400">
                              ✓ {s}
                            </li>
                          ))}
                        </ul>
                      )}
                      {weaknesses.length > 0 && (
                        <ul className="space-y-0.5">
                          {weaknesses.map((w, i) => (
                            <li key={i} className="ga-ui text-[11px] text-red-400">
                              ✗ {w}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr
        accent
        title={t('title')}
        subtitle={t('subtitle')}
        right={
          <a
            href={NEW_INTERVIEW_HREF}
            className="ga-ui inline-flex items-center gap-1.5 rounded-ga bg-ga-accent px-4 py-2.5 text-[13px] font-semibold text-ga-accent-ink transition-opacity hover:opacity-90"
          >
            <Plus size={14} aria-hidden /> {t('newInterview')}
          </a>
        }
      />
      <div className="flex-1 px-10 py-6">
        <div className="mx-auto max-w-3xl space-y-3">
          <div className="flex items-center gap-2">
            <GaCap>{t('sessionCount', { count: sessions.length })}</GaCap>
            {/* FREE plan: 3 interview sessions per week (quota is enforced server-side). */}
            {quota?.planCode === 'FREE' && <TkBadge tone="yellow">{t('weeklyQuota', { used: weeklyCount })}</TkBadge>}
          </div>

          {loading || loadingMsgs ? (
            <LoadingState label={t('loading')} />
          ) : sessions.length === 0 ? (
            <div className="rounded-ga border border-ga-line bg-ga-card py-16 text-center">
              <Briefcase size={36} className="mx-auto mb-3 text-ga-subtle" aria-hidden />
              <p className="font-ga-display text-[20px] font-medium text-ga-ink">{t('emptyTitle')}</p>
              <p className="ga-ui mt-2 text-[13px] text-ga-muted">{t('emptyDesc')}</p>
              <a
                href={NEW_INTERVIEW_HREF}
                className="ga-ui mt-5 inline-flex items-center gap-1.5 rounded-ga bg-ga-ink px-5 py-2.5 text-[13px] font-semibold text-ga-bg transition-opacity hover:opacity-90"
              >
                {t('startNow')}
              </a>
            </div>
          ) : (
            sessions.map((sess) => {
              const date = sess.createdAt ? new Date(sess.createdAt) : null
              return (
                <GaCard key={sess.id} hover className="overflow-hidden">
                  <button
                    type="button"
                    onClick={() => openSession(sess)}
                    className="flex w-full items-start gap-4 px-5 py-4 text-left transition-colors hover:bg-ga-surface"
                  >
                    <span
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-ga"
                      style={{ background: 'var(--ga-yellow-soft)', color: 'var(--ga-ink)' }}
                    >
                      <Briefcase size={18} aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-[15px] font-semibold text-ga-ink">
                          {sess.interviewPosition ?? t('unknownPosition')}
                        </p>
                        {sess.experienceLevel && <TkBadge tone="yellow">{sess.experienceLevel}</TkBadge>}
                        {sess.cefrLevel && <TkBadge tone="neutral">{sess.cefrLevel}</TkBadge>}
                      </div>
                      <p className="ga-ui mt-1 flex flex-wrap items-center gap-3 text-[12px] text-ga-muted">
                        {date && (
                          <span className="inline-flex items-center gap-1">
                            <Calendar size={11} aria-hidden />
                            {date.toLocaleDateString('vi-VN')} —{' '}
                            {date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1">
                          <MessageSquare size={11} aria-hidden /> {t('turns', { count: sess.messageCount ?? 0 })}
                        </span>
                        {sess.persona && (
                          <span className="inline-flex items-center gap-1">
                            <Target size={11} aria-hidden /> {t('hrRole', { persona: sess.persona })}
                          </span>
                        )}
                      </p>
                    </div>
                    <TkBadge tone={sess.status === 'COMPLETED' ? 'green' : 'neutral'} className="shrink-0">
                      {sess.status === 'COMPLETED' ? t('completed') : t('incomplete')}
                    </TkBadge>
                  </button>
                </GaCard>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
