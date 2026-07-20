'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { AlertTriangle, ArrowLeft, Calendar, ChevronDown, ChevronUp, MessageSquare, Mic, Plus } from 'lucide-react'
import api from '@/lib/api'
import { getErrorSnippet } from '@/lib/errors/errorTaxonomy'
import { usePageTimeTracker } from '@/hooks/usePageTimeTracker'
import { GaCap, GaCard, GaPageHdr, LoadingState, TkBadge } from '@/components/ui-v2'

/**
 * /v2/student/speaking/history — lịch sử hội thoại luyện nói (vỏ Galerie).
 *
 * Port của /student/speaking-history: GIỮ NGUYÊN endpoint (GET /ai-speaking/sessions?size=20&
 * sort=startedAt,desc · GET /ai-speaking/sessions/{id}/messages), giữ nguyên mapSessionMessages
 * (backend trả `userText` HOẶC `userMessage` tuỳ phiên bản → fallback bắt buộc), giữ nguyên
 * event PostHog `speaking_history` (usePageTimeTracker).
 *
 * Danh sách KHÔNG lọc theo sessionMode — đúng như v1: mọi phiên (kể cả INTERVIEW) đều xem lại được
 * ở đây. /v2/student/interviews là bề mặt khác (báo cáo phỏng vấn), không thay thế trang này.
 *
 * CTA "phiên mới" trỏ vào engine v2 (/v2/student/speaking/setup) thay cho /speaking (v1 sắp xoá).
 */

const NEW_SESSION_HREF = `/v2/student/speaking/setup?return=${encodeURIComponent('/v2/student/speaking/history')}`

interface SessionMessage {
  id: number
  role: 'USER' | 'ASSISTANT'
  userText?: string
  aiSpeechDe?: string
  correction?: string
  explanationVi?: string
  grammarPoint?: string
  errors?: Array<{
    errorCode: string
    severity: string
    wrongSpan?: string
    correctedSpan?: string
    ruleViShort?: string
  }>
  createdAt?: string
}

interface SpeakingSession {
  id: number
  topic?: string
  cefrLevel?: string
  persona?: string
  status?: string
  createdAt?: string
  messageCount?: number
}

function mapSessionMessages(raw: unknown[]): SessionMessage[] {
  return raw.map((item) => {
    const m = item as Record<string, unknown>
    const roleRaw = String(m.role ?? '').toUpperCase()
    return {
      id: Number(m.id),
      role: roleRaw === 'USER' ? 'USER' : 'ASSISTANT',
      userText: (m.userText as string | undefined) ?? (m.userMessage as string | undefined),
      aiSpeechDe: m.aiSpeechDe as string | undefined,
      correction: m.correction as string | undefined,
      explanationVi: m.explanationVi as string | undefined,
      grammarPoint: m.grammarPoint as string | undefined,
      errors: m.errors as SessionMessage['errors'],
      createdAt: m.createdAt as string | undefined,
    }
  })
}

/** Ngưỡng nặng/nhẹ giữ nguyên v1: MAJOR|BLOCKING = đỏ, còn lại = cam. */
function severityTone(s: string) {
  const major = s === 'MAJOR' || s === 'BLOCKING'
  return major
    ? { fg: 'var(--ga-red)', bg: 'var(--ga-red-soft)' }
    : { fg: 'var(--ga-orange)', bg: 'var(--ga-orange-soft)' }
}

function MessageBubble({ msg }: { msg: SessionMessage }) {
  const t = useTranslations('v2.student.speakingHistory')
  const [expanded, setExpanded] = useState(false)
  const isUser = msg.role === 'USER'
  const bodyText = (isUser ? msg.userText : msg.aiSpeechDe)?.trim() ?? ''
  const hasErrors = (msg.errors?.length ?? 0) > 0
  const hasGrammar = !!msg.grammarPoint || !!msg.correction

  if (!bodyText) return null

  return (
    <div className={`flex gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <span className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-ga-pill bg-ga-ink text-ga-bg">
          <Mic size={13} aria-hidden />
        </span>
      )}
      <div className={`flex max-w-[80%] flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`ga-ui rounded-ga px-4 py-3 text-[14px] leading-relaxed ${
            isUser ? 'bg-ga-ink text-ga-bg' : 'border border-ga-line bg-ga-card text-ga-ink'
          }`}
        >
          {bodyText}
        </div>

        {!isUser && msg.correction && (
          <div
            className="ga-ui rounded-ga px-3 py-2 text-[12.5px]"
            style={{ background: 'var(--ga-orange-soft)', color: 'var(--ga-orange)' }}
          >
            <span className="font-bold">{t('correction')}</span>
            {msg.correction}
          </div>
        )}
        {!isUser && msg.explanationVi && (
          <div
            className="ga-ui rounded-ga px-3 py-2 text-[12.5px]"
            style={{ background: 'var(--ga-orange-soft)', color: 'var(--ga-orange)' }}
          >
            <span className="font-bold">{t('explanation')}</span>
            {msg.explanationVi}
          </div>
        )}

        {!isUser && (hasErrors || hasGrammar) && (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="ga-ui mt-0.5 flex items-center gap-1 text-[11px] text-ga-subtle transition-colors hover:text-ga-ink"
          >
            {expanded ? <ChevronUp size={11} aria-hidden /> : <ChevronDown size={11} aria-hidden />}
            {hasErrors ? t('grammarErrors', { count: msg.errors!.length }) : t('details')}
          </button>
        )}

        {expanded && hasErrors && (
          <div className="w-full space-y-1.5">
            {msg.errors!.map((err, i) => {
              const tone = severityTone(err.severity)
              return (
                <div
                  key={i}
                  className="ga-ui rounded-ga px-3 py-2 text-[12px]"
                  style={{ background: tone.bg, color: tone.fg }}
                >
                  <div className="mb-0.5 flex items-center gap-1.5">
                    <AlertTriangle size={10} aria-hidden />
                    <span className="font-bold" title={err.errorCode}>
                      {getErrorSnippet(err.errorCode, 'vi').title}
                    </span>
                    <span className="opacity-60">({err.severity})</span>
                  </div>
                  {err.wrongSpan && (
                    <p>
                      <span className="line-through">{err.wrongSpan}</span> → {err.correctedSpan}
                    </p>
                  )}
                  {err.ruleViShort && <p className="mt-0.5 opacity-80">{err.ruleViShort}</p>}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default function V2StudentSpeakingHistoryPage() {
  usePageTimeTracker('speaking_history')
  const t = useTranslations('v2.student.speakingHistory')

  const [sessions, setSessions] = useState<SpeakingSession[]>([])
  const [selected, setSelected] = useState<SpeakingSession | null>(null)
  const [messages, setMessages] = useState<SessionMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMsgs, setLoadingMsgs] = useState(false)

  useEffect(() => {
    api
      .get('/ai-speaking/sessions?size=20&sort=startedAt,desc')
      .then((res) => {
        const data = res.data
        setSessions(Array.isArray(data) ? data : (data?.content ?? data?.items ?? []))
      })
      .catch(() => setSessions([]))
      .finally(() => setLoading(false))
  }, [])

  const openSession = async (sess: SpeakingSession) => {
    setSelected(sess)
    setLoadingMsgs(true)
    try {
      const res = await api.get(`/ai-speaking/sessions/${sess.id}/messages`)
      const raw = Array.isArray(res.data) ? res.data : (res.data?.content ?? [])
      setMessages(mapSessionMessages(raw))
    } catch {
      setMessages([])
    } finally {
      setLoadingMsgs(false)
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr
        accent
        title={selected ? t('replayTitle') : t('title')}
        subtitle={
          selected
            ? [selected.topic, selected.cefrLevel].filter(Boolean).join(' — ') || t('subtitle')
            : t('subtitle')
        }
        right={
          <a
            href={NEW_SESSION_HREF}
            className="ga-ui inline-flex items-center gap-1.5 rounded-ga bg-ga-accent px-4 py-2.5 text-[13px] font-semibold text-ga-accent-ink transition-opacity hover:opacity-90"
          >
            <Plus size={14} aria-hidden /> {t('startNew')}
          </a>
        }
      />

      <div className="flex-1 px-10 py-6">
        <div className="mx-auto max-w-3xl space-y-3">
          {selected && (
            <button
              type="button"
              onClick={() => {
                setSelected(null)
                setMessages([])
              }}
              className="ga-ui mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-ga-muted transition-colors hover:text-ga-ink"
            >
              <ArrowLeft size={15} aria-hidden /> {t('sessionList')}
            </button>
          )}

          {!selected ? (
            <>
              <GaCap>{t('recentSessions', { count: sessions.length })}</GaCap>

              {loading ? (
                <LoadingState label={t('loading')} />
              ) : sessions.length === 0 ? (
                <div className="rounded-ga border border-ga-line bg-ga-card py-16 text-center">
                  <Mic size={36} className="mx-auto mb-3 text-ga-subtle" aria-hidden />
                  <p className="font-ga-display text-[20px] font-medium text-ga-ink">{t('noSessions')}</p>
                  <p className="ga-ui mt-2 text-[13px] text-ga-muted">{t('promptStart')}</p>
                  <a
                    href={NEW_SESSION_HREF}
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
                          <Mic size={18} aria-hidden />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-[15px] font-semibold text-ga-ink">
                              {sess.topic ?? t('noTopic')}
                            </p>
                            {sess.cefrLevel && <TkBadge tone="neutral">{sess.cefrLevel}</TkBadge>}
                            {sess.persona && <TkBadge tone="yellow">{sess.persona}</TkBadge>}
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
                              <MessageSquare size={11} aria-hidden /> {t('messages', { count: sess.messageCount ?? 0 })}
                            </span>
                          </p>
                        </div>
                        <TkBadge tone={sess.status === 'COMPLETED' ? 'green' : 'neutral'} className="shrink-0">
                          {sess.status === 'COMPLETED' ? t('completed') : t('open')}
                        </TkBadge>
                      </button>
                    </GaCard>
                  )
                })
              )}
            </>
          ) : loadingMsgs ? (
            <LoadingState label={t('loadingMessages')} />
          ) : messages.length === 0 ? (
            <div className="rounded-ga border border-ga-line bg-ga-card py-14 text-center">
              <MessageSquare size={32} className="mx-auto mb-3 text-ga-subtle" aria-hidden />
              <p className="ga-ui text-[13.5px] text-ga-muted">{t('noMessages')}</p>
            </div>
          ) : (
            <div className="space-y-4 pb-6">
              {messages.map((msg) => (
                <MessageBubble key={msg.id} msg={msg} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
