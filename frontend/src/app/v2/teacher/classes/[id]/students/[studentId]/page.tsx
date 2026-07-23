'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ArrowLeft, Sparkles, AlertCircle, Mic, BookOpen } from 'lucide-react'
import { format } from 'date-fns'
import api, { apiMessage } from '@/lib/api'
import {
  GaPageHdr, GaBtn, GaCap, TkStatStrip,
  TkTabs, TkTabsList, TkTabsTrigger, TkTabsContent,
} from '@/components/ui-v2'

// ─────────────────────────────────────────────────────────────────────────────
// Báo cáo học viên (GaStudentReport) — violet. Mở từ class-detail "Chi tiết".
// Plumbing reused 1:1 (zero backend): GET /v2/teacher/students/{id}/{assignments,speaking-sessions}
//   (rẻ, load khi mở) + GET /v2/teacher/classes/{cid}/students/{sid}/comprehensive-report
//   (sinh AI advisory qua LLM — tốn token → LAZY, chỉ khi mở tab "Phân tích AI").
// ─────────────────────────────────────────────────────────────────────────────

const VIOLET = '#7C56C8'

interface Metrics {
  totalAssignmentsCompleted: number; averageScore: number
  totalSpeakingSessions: number; averageSpeakingScore: number
  pendingReviewItems: number; reviewCompletionRate: number
}
interface Report {
  studentId: number; studentName: string
  preClassMetrics: Metrics | null; inClassMetrics: Metrics | null
  topWeaknesses: string[]; recommendedNextActions: string[]; aiAdvisoryReport: string
}
interface SpeakingSession {
  id: number; topic: string; cefrLevel: string; status: string; messageCount: number
  aiScore: number | null; teacherScore: number | null; startedAt: string
}
interface AssignmentRow {
  id: number; assignmentId: number; status: string; teacherScore: number | null
  topic: string | null; assignmentType: string | null; submittedAt: string | null
}

type Tab = 'analysis' | 'assignments' | 'speaking'

// Known status keys → v2.teacher.studentDetail.statusLabels.<key>; unknown falls back to raw value.
const STATUS_KEYS = new Set(['PENDING', 'SUBMITTED', 'GRADED', 'EVALUATED', 'ENDED', 'ACTIVE'])
const fmt = (d: string | null) => (d ? format(new Date(d), 'dd/MM/yyyy') : '—')
const score = (v: number | null) => (v == null ? '—' : `${v}/100`)

function StudentReport() {
  const t = useTranslations('v2.teacher.studentDetail')
  const tc = useTranslations('v2.common')
  const router = useRouter()
  const params = useParams()
  const sp = useSearchParams()
  const classId = Number(params.id)
  const studentId = Number(params.studentId)
  const nameHint = sp.get('name') || t('nameFallback', { id: studentId })
  const statusLabel = (status: string) => (STATUS_KEYS.has(status) ? t(`statusLabels.${status}`) : status)

  const [tab, setTab] = useState<Tab>('assignments')
  const [speaking, setSpeaking] = useState<SpeakingSession[]>([])
  const [assignments, setAssignments] = useState<AssignmentRow[]>([])
  const [loading, setLoading] = useState(true)

  // AI analysis — lazy (LLM cost): only fetched when the tab is first opened.
  const [report, setReport] = useState<Report | null>(null)
  const [reportLoading, setReportLoading] = useState(false)
  const [reportError, setReportError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [sp2, asg] = await Promise.all([
        api.get<SpeakingSession[]>(`/v2/teacher/students/${studentId}/speaking-sessions`).catch(() => ({ data: [] })),
        api.get<AssignmentRow[]>(`/v2/teacher/students/${studentId}/assignments`).catch(() => ({ data: [] })),
      ])
      setSpeaking(sp2.data ?? [])
      setAssignments(asg.data ?? [])
    } finally {
      setLoading(false)
    }
  }, [studentId])

  useEffect(() => {
    if (!Number.isNaN(studentId)) void load()
  }, [load, studentId])

  const fetchReport = useCallback(async () => {
    if (report || reportLoading) return
    setReportLoading(true)
    setReportError('')
    try {
      const res = await api.get<Report>(`/v2/teacher/classes/${classId}/students/${studentId}/comprehensive-report`)
      setReport(res.data)
    } catch (e: unknown) {
      setReportError(apiMessage(e))
    } finally {
      setReportLoading(false)
    }
  }, [classId, studentId, report, reportLoading])

  // Lazy-load the LLM report the first time the analysis tab is opened.
  useEffect(() => {
    if (tab === 'analysis') void fetchReport()
  }, [tab, fetchReport])

  const studentName = report?.studentName || nameHint
  const gradedCount = useMemo(() => assignments.filter((a) => a.status === 'GRADED' || a.status === 'EVALUATED').length, [assignments])
  const avgTeacherSpeaking = useMemo(() => {
    const vs = speaking.map((s) => s.teacherScore).filter((v): v is number => v != null)
    return vs.length ? Math.round(vs.reduce((a, b) => a + b, 0) / vs.length) : null
  }, [speaking])

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr
        accent
        title={studentName}
        subtitle={t('subtitle')}
        right={
          <GaBtn variant="ghost" size="sm" onClick={() => router.push(`/v2/teacher/classes/${classId}`)}>
            <ArrowLeft size={15} /> {t('backToClass')}
          </GaBtn>
        }
      />

      <div className="flex-1 overflow-auto px-4 py-5 sm:px-6 lg:px-10 lg:py-6">
        <TkStatStrip
          items={[
            { label: t('stats.assignments'), value: assignments.length, sub: t('stats.assignmentsSub', { count: gradedCount }), color: VIOLET },
            { label: t('stats.speakingSessions'), value: speaking.length, sub: t('stats.speakingSessionsSub'), color: '#2F6FC9' },
            { label: t('stats.avgSpeaking'), value: avgTeacherSpeaking ?? '—', sub: avgTeacherSpeaking != null ? t('stats.avgSpeakingSub') : t('stats.avgSpeakingSubEmpty'), color: '#1E9E61' },
          ]}
        />

        <div className="mt-[22px]">
          <TkTabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
            <TkTabsList>
              <TkTabsTrigger value="assignments">{t('tabAssignments')} · {assignments.length}</TkTabsTrigger>
              <TkTabsTrigger value="speaking">{t('tabSpeaking')} · {speaking.length}</TkTabsTrigger>
              <TkTabsTrigger value="analysis">{t('tabAnalysis')}</TkTabsTrigger>
            </TkTabsList>

            {/* ── Assignments (read-only; chấm ở Trung tâm Chấm bài) ── */}
            <TkTabsContent value="assignments">
              {loading ? (
                <div className="ga-shimmer h-[160px] border border-ga-line" aria-hidden />
              ) : assignments.length === 0 ? (
                <Empty icon={BookOpen} text={t('assignmentsEmpty')} />
              ) : (
                <div className="border border-ga-line bg-ga-card">
                  {assignments.map((a, i) => (
                    <div key={a.id} className="flex items-center gap-3 px-4 py-[13px] lg:gap-4 lg:px-[18px]" style={{ borderTop: i ? '1px solid var(--ga-line)' : 'none' }}>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-semibold text-ga-ink">{a.topic || t('assignmentFallback', { id: a.assignmentId })}</p>
                        <p className="ga-ui text-[12px] text-ga-muted">{t('submitted', { date: fmt(a.submittedAt) })}</p>
                      </div>
                      <span className="shrink-0 text-[12px] font-semibold text-ga-muted">{statusLabel(a.status)}</span>
                      <span className="w-[64px] shrink-0 text-right text-[13.5px] font-semibold text-ga-ink">{score(a.teacherScore)}</span>
                    </div>
                  ))}
                </div>
              )}
            </TkTabsContent>

            {/* ── Speaking sessions (read-only) ── */}
            <TkTabsContent value="speaking">
              {loading ? (
                <div className="ga-shimmer h-[160px] border border-ga-line" aria-hidden />
              ) : speaking.length === 0 ? (
                <Empty icon={Mic} text={t('speakingEmpty')} />
              ) : (
                <div className="border border-ga-line bg-ga-card">
                  {speaking.map((s, i) => (
                    <div key={s.id} className="flex items-center gap-3 px-4 py-[13px] lg:gap-4 lg:px-[18px]" style={{ borderTop: i ? '1px solid var(--ga-line)' : 'none' }}>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-semibold text-ga-ink">{s.topic || t('speakingFallback')}</p>
                        <p className="ga-ui text-[12px] text-ga-muted">{s.cefrLevel} · {fmt(s.startedAt)} · {statusLabel(s.status)}</p>
                      </div>
                      <span className="shrink-0 text-[12px] text-ga-muted">{t('aiPrefix')} {score(s.aiScore)}</span>
                      <span className="w-[64px] shrink-0 text-right text-[13.5px] font-semibold text-ga-ink">{score(s.teacherScore)}</span>
                    </div>
                  ))}
                </div>
              )}
            </TkTabsContent>

            {/* ── AI analysis (lazy, LLM) ── */}
            <TkTabsContent value="analysis">
              {reportLoading ? (
                <div className="border border-ga-line bg-ga-card px-4 py-10 text-center sm:px-6 lg:px-10 lg:py-[52px]">
                  <Sparkles size={28} className="mx-auto mb-3 animate-pulse" style={{ color: VIOLET }} />
                  <p className="text-[14px] text-ga-muted">{t('analysisLoading')}</p>
                </div>
              ) : reportError ? (
                <div className="border border-ga-line bg-ga-card px-4 py-8 text-center sm:px-6 lg:px-10 lg:py-[40px]">
                  <p className="ga-ui mb-4 break-words text-[14px] text-ga-red">{reportError}</p>
                  <GaBtn variant="ghost" onClick={() => void fetchReport()}>{tc('retry')}</GaBtn>
                </div>
              ) : report ? (
                <Analysis report={report} />
              ) : (
                <div className="border border-dashed border-ga-line px-4 py-8 text-center sm:px-6 lg:px-10 lg:py-[40px]">
                  <GaBtn variant="yellow" onClick={() => void fetchReport()}><Sparkles size={15} /> {t('generateAnalysis')}</GaBtn>
                </div>
              )}
            </TkTabsContent>
          </TkTabs>
        </div>
      </div>
    </div>
  )
}

function Empty({ icon: Icon, text }: { icon: typeof Mic; text: string }) {
  return (
    <div className="border border-dashed border-ga-line px-4 py-8 text-center sm:px-6 lg:px-10 lg:py-[40px]">
      <Icon size={36} className="mx-auto mb-3 text-ga-faint" />
      <p className="text-[14px] text-ga-muted">{text}</p>
    </div>
  )
}

// metricKey → v2.teacher.studentDetail.metricRows.<key>; pct flags a percentage value.
const METRIC_ROWS: [keyof Metrics, boolean][] = [
  ['totalAssignmentsCompleted', false],
  ['averageScore', true],
  ['totalSpeakingSessions', false],
  ['averageSpeakingScore', true],
]

function MetricCard({ title, m, accent }: { title: string; m: Metrics | null; accent: boolean }) {
  const t = useTranslations('v2.teacher.studentDetail')
  return (
    <div className="border border-ga-line bg-ga-card p-4 lg:p-[18px]" style={accent ? { borderColor: VIOLET } : undefined}>
      <GaCap className="mb-3 block" style={accent ? { color: VIOLET } : undefined}>{title}</GaCap>
      <ul className="flex flex-col gap-2">
        {METRIC_ROWS.map(([k, pct]) => (
          <li key={k} className="flex items-center justify-between border-b border-ga-line pb-1.5 text-[13px] last:border-b-0 last:pb-0">
            <span className="text-ga-muted">{t(`metricRows.${k}`)}</span>
            <span className="font-semibold text-ga-ink">{m ? `${m[k]}${pct ? '%' : ''}` : '—'}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Analysis({ report }: { report: Report }) {
  const t = useTranslations('v2.teacher.studentDetail')
  return (
    <div className="flex flex-col gap-[22px]">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <MetricCard title={t('metricPre')} m={report.preClassMetrics} accent={false} />
        <MetricCard title={t('metricIn')} m={report.inClassMetrics} accent />
      </div>

      {report.topWeaknesses?.length > 0 && (
        <div className="border border-ga-line bg-ga-card p-4 lg:p-[22px]">
          <GaCap className="mb-3 flex items-center gap-1.5"><AlertCircle size={13} className="text-ga-red" /> {t('weaknessesCap')}</GaCap>
          <ul className="list-disc break-words pl-5 text-[13.5px] text-ga-ink">
            {report.topWeaknesses.map((w, i) => <li key={i} className="mb-1">{w}</li>)}
          </ul>
        </div>
      )}

      {report.recommendedNextActions?.length > 0 && (
        <div className="border border-ga-line bg-ga-card p-4 lg:p-[22px]">
          <GaCap className="mb-3 block">{t('nextActionsCap')}</GaCap>
          <ul className="list-disc break-words pl-5 text-[13.5px] text-ga-ink">
            {report.recommendedNextActions.map((a, i) => <li key={i} className="mb-1">{a}</li>)}
          </ul>
        </div>
      )}

      {report.aiAdvisoryReport && (
        <div className="border border-ga-line p-4 lg:p-[22px]" style={{ background: 'var(--ga-violet-soft)' }}>
          <GaCap className="mb-3 flex items-center gap-1.5" style={{ color: VIOLET }}><Sparkles size={14} /> {t('aiRoadmapCap')}</GaCap>
          <div className="whitespace-pre-line break-words text-[14px] leading-relaxed text-ga-ink">{report.aiAdvisoryReport}</div>
        </div>
      )}
    </div>
  )
}

export default function V2StudentReportPage() {
  return (
    <Suspense fallback={null}>
      <StudentReport />
    </Suspense>
  )
}
