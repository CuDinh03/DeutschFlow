'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ArrowLeft } from 'lucide-react'
import { format } from 'date-fns'
import { apiMessage } from '@/lib/api'
import {
  getOrgClassDetail, getOrgClassGradebook, getOrgClassLessonLogs,
  type OrgClassDetail, type OrgGradebook, type OrgLessonLog,
} from '@/lib/orgApi'
import {
  GaPageHdr, GaBtn, GaCap, TkStatStrip, TkSearch,
  TkTabs, TkTabsList, TkTabsTrigger, TkTabsContent, ErrorBanner, LoadingState,
} from '@/components/ui-v2'

// ─────────────────────────────────────────────────────────────────────────────
// Chi tiết lớp của tổ chức (GaOrgClassDetail) — teal, read-only org-admin (W1.4 + QA Prototype A).
// orgApi.getOrgClassDetail → GET /api/org/classes/{id} (B1.1): { ..., teacherName, students[] (skill_*) }.
// QA vs Prototype A (proto-org-admin.jsx#GaOrgClassDetail): proto dùng mock progress/exam/attendance/
//   schedule mà backend KHÔNG có → Option-1: giữ cấu trúc 2-cột (roster + side panel) của proto nhưng
//   side panel dùng DỮ LIỆU THẬT (GV phụ trách + điểm kỹ năng TB từ skill_*); bỏ schedule/attendance
//   (no backend). Token: var(--ga-*) (token-discipline). 404 nếu lớp khác org (IDOR-safe).
// ─────────────────────────────────────────────────────────────────────────────

const TEAL = 'var(--ga-teal)'
const fmtDate = (d: string | null) => (d ? format(new Date(d), 'dd/MM/yyyy') : '—')
const initial = (n: string | null) => (n?.trim()[0] ?? '?').toUpperCase()
const skill = (v: number | null) => (v == null ? '—' : v.toFixed(1))
const SKILLS = [
  { field: 'skillHoren', labelKey: 'skillHoren' },
  { field: 'skillLesen', labelKey: 'skillLesen' },
  { field: 'skillSchreiben', labelKey: 'skillSchreiben' },
  { field: 'skillSprechen', labelKey: 'skillSprechen' },
] as const

export default function V2OrgClassDetailPage() {
  const t = useTranslations('v2.org.classDetail')
  const tc = useTranslations('v2.common')
  const params = useParams()
  const router = useRouter()
  const id = Number(params.id)

  const [detail, setDetail] = useState<OrgClassDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    if (Number.isNaN(id)) { setError(t('invalidId')); setLoading(false); return }
    try { setDetail(await getOrgClassDetail(id)); setError('') }
    catch (e: unknown) { setError(apiMessage(e)) }
    finally { setLoading(false) }
  }, [id, t])
  useEffect(() => { void load() }, [load])

  const rows = useMemo(() => {
    const students = detail?.students ?? []
    const q = query.trim().toLowerCase()
    if (!q) return students
    return students.filter((s) => (s.displayName ?? '').toLowerCase().includes(q) || (s.email ?? '').toLowerCase().includes(q))
  }, [detail, query])

  // Điểm kỹ năng TB từ roster (dữ liệu thật, thay cho "phân bố tiến độ" mock của proto).
  const skillAvg = useMemo(() => {
    const students = detail?.students ?? []
    return SKILLS.map(({ field, labelKey }) => {
      const vals = students.map((s) => s[field]).filter((v): v is number => v != null)
      const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
      return { labelKey, avg }
    })
  }, [detail])

  const GRID = '1fr 110px 60px 60px 60px 60px'

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr
        accent
        title={detail?.name ?? t('titleFallback')}
        subtitle={detail ? t('subtitle', { code: detail.inviteCode || '—', teacher: detail.teacherName || t('unassignedTeacher'), count: detail.studentCount }) : t('subtitleLoading')}
        right={<GaBtn variant="ghost" size="sm" onClick={() => router.push('/v2/org/classes')}><ArrowLeft size={15} /> {t('backToClasses')}</GaBtn>}
      />

      <div className="flex-1 overflow-auto px-4 py-6 sm:px-6 lg:px-10">
        {loading ? (
          <div className="flex flex-col gap-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="ga-shimmer h-[54px] border border-ga-line" aria-hidden />)}</div>
        ) : error ? (
          <div className="border border-ga-line bg-ga-card px-4 py-8 sm:px-8 lg:px-10 lg:py-[52px] text-center">
            <h2 className="font-ga-display text-[20px] font-medium text-ga-red lg:text-[24px]">{t('loadError')}</h2>
            <p className="ga-ui mx-auto mb-5 mt-3 max-w-sm break-words text-[14px] text-ga-muted">{error} <code className="font-mono text-[12px] text-ga-accent">{`GET /api/org/classes/${id}`}</code></p>
            <GaBtn variant="primary" onClick={load}>{tc('retry')}</GaBtn>
          </div>
        ) : detail ? (
          <>
            <TkStatStrip
              items={[
                { label: t('stats.size'), value: detail.studentCount, sub: t('stats.sizeSub') },
                { label: t('stats.teacher'), value: detail.teacherName || '—', sub: detail.teacherId ? `#${detail.teacherId}` : t('stats.teacherUnassigned'), color: TEAL },
                { label: t('stats.code'), value: detail.inviteCode || '—', sub: t('stats.codeSub') },
                { label: t('stats.created'), value: fmtDate(detail.createdAt), sub: t('stats.createdSub') },
              ]}
            />

            <TkTabs defaultValue="students" className="mt-[22px]">
              <TkTabsList>
                <TkTabsTrigger value="students">{t('tabs.students')}</TkTabsTrigger>
                <TkTabsTrigger value="gradebook">{t('tabs.gradebook')}</TkTabsTrigger>
                <TkTabsTrigger value="logs">{t('tabs.logs')}</TkTabsTrigger>
              </TkTabsList>

              <TkTabsContent value="students">
            <div className="mt-[18px] grid grid-cols-1 gap-[22px] lg:grid-cols-[1fr_320px]">
              {/* Roster */}
              <div>
                <div className="mb-3.5 flex flex-wrap items-center justify-between gap-4">
                  <GaCap>{t('rosterCap')}</GaCap>
                  <TkSearch value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('searchPlaceholder')} containerClassName="w-full sm:w-[200px]" />
                </div>
                <div className="overflow-x-auto border border-ga-line bg-ga-card lg:overflow-visible">
                  <div className="grid min-w-[640px] items-center gap-2 border-b border-ga-line bg-ga-bg px-[18px] py-[11px] lg:min-w-0" style={{ gridTemplateColumns: GRID }}>
                    {[t('colStudent'), t('colJoined'), t('colHoren'), t('colLesen'), t('colSchreiben'), t('colSprechen')].map((h, i) => (
                      <span key={h} className={`ga-ui text-[10px] font-bold uppercase tracking-[0.1em] text-ga-muted ${i >= 2 ? 'text-right' : ''}`}>{h}</span>
                    ))}
                  </div>
                  {rows.length === 0 ? (
                    <div className="px-6 py-[30px] text-center text-[14px] text-ga-muted">{detail.students.length === 0 ? t('emptyRoster') : t('emptySearch')}</div>
                  ) : rows.map((s, i) => (
                    <div key={s.userId} className="grid min-w-[640px] items-center gap-2 px-[18px] py-[13px] transition-colors hover:bg-ga-surface lg:min-w-0" style={{ gridTemplateColumns: GRID, borderTop: i ? '1px solid var(--ga-line)' : 'none' }}>
                      <button type="button" onClick={() => router.push(`/v2/org/students/${s.userId}`)} className="flex min-w-0 items-center gap-2.5 text-left">
                        <span className="grid h-8 w-8 shrink-0 place-items-center font-ga-display text-[13px] font-medium" style={{ color: TEAL, background: 'var(--ga-teal-soft)' }}>{initial(s.displayName)}</span>
                        <span className="min-w-0">
                          <span className="block truncate text-[14px] font-semibold text-ga-ink hover:text-ga-accent">{s.displayName || '—'}</span>
                          <span className="block truncate text-[11.5px] text-ga-muted">{s.email || '—'}</span>
                        </span>
                      </button>
                      <span className="text-[12.5px] text-ga-muted">{fmtDate(s.joinedAt)}</span>
                      {[s.skillHoren, s.skillLesen, s.skillSchreiben, s.skillSprechen].map((v, j) => (
                        <span key={j} className="text-right text-[13px] font-semibold text-ga-ink">{skill(v)}</span>
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              {/* Side panel (proto 2-col: real data only) */}
              <div className="flex flex-col gap-[18px]">
                <div className="border border-ga-line bg-ga-card p-4 lg:p-[22px]">
                  <GaCap className="mb-3.5 block">{t('teacherCap')}</GaCap>
                  {detail.teacherName ? (
                    <div className="flex items-center gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center font-ga-display text-[15px] font-medium" style={{ color: 'var(--ga-violet)', background: 'var(--ga-violet-soft)' }}>{initial(detail.teacherName)}</span>
                      <div className="min-w-0">
                        <div className="truncate text-[14px] font-semibold text-ga-ink">{detail.teacherName}</div>
                        <div className="text-[12px] text-ga-muted">{detail.teacherId ? t('teacherRef', { id: detail.teacherId }) : ''}</div>
                      </div>
                    </div>
                  ) : (
                    <button type="button" onClick={() => router.push('/v2/org/teachers')} className="ga-ui min-h-[40px] w-full border px-3 py-3 text-[12px] font-bold lg:min-h-0" style={{ color: 'var(--ga-red)', background: 'var(--ga-red-soft)', borderColor: 'color-mix(in srgb, var(--ga-red) 30%, transparent)' }}>{t('assignTeacher')}</button>
                  )}
                </div>

                <div className="border border-ga-line bg-ga-card p-4 lg:p-[22px]">
                  <GaCap className="mb-3.5 block">{t('skillAvgCap')}</GaCap>
                  {skillAvg.every((s) => s.avg == null) ? (
                    <p className="text-[12.5px] text-ga-muted">{t('noSkillScores')}</p>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {skillAvg.map((s) => (
                        <div key={s.labelKey} className="flex items-center gap-3">
                          <span className="w-[72px] text-[12.5px] text-ga-ink">{t(s.labelKey)}</span>
                          <span className="h-2 flex-1 bg-ga-line"><span className="block h-full" style={{ width: `${s.avg != null ? (s.avg / 9) * 100 : 0}%`, background: TEAL }} /></span>
                          <span className="w-9 text-right font-ga-display text-[14px] font-medium text-ga-ink">{s.avg != null ? s.avg.toFixed(1) : '—'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
              </TkTabsContent>

              {/* M-17: hai tab dữ liệu sâu — sổ điểm + nhật ký buổi (read-only, API /api/org mới) */}
              <TkTabsContent value="gradebook">
                <div className="mt-[18px]"><OrgGradebookPanel classId={id} /></div>
              </TkTabsContent>
              <TkTabsContent value="logs">
                <div className="mt-[18px]"><OrgLessonLogsPanel classId={id} /></div>
              </TkTabsContent>
            </TkTabs>
          </>
        ) : null}
      </div>
    </div>
  )
}

// ─── M-17: Giám sát lớp — panel sổ điểm + nhật ký buổi (read-only, tái dùng DTO teacher) ───

function OrgGradebookPanel({ classId }: { classId: number }) {
  const ts = useTranslations('v2.org.classDetail.supervision')
  const [data, setData] = useState<OrgGradebook | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    setLoading(true)
    try { setData(await getOrgClassGradebook(classId)); setError('') }
    catch (e: unknown) { setError(apiMessage(e)) }
    finally { setLoading(false) }
  }, [classId])
  useEffect(() => { void load() }, [load])

  if (loading) return <LoadingState variant="skeleton" rows={4} />
  if (error) return <ErrorBanner message={error} onRetry={() => void load()} />
  if (!data || data.assignments.length === 0) {
    return <p className="ga-ui border border-ga-line bg-ga-card px-6 py-[30px] text-center text-[14px] text-ga-muted">{ts('gradebookEmpty')}</p>
  }
  return (
    <div className="overflow-x-auto border border-ga-line bg-ga-card">
      <table className="w-full min-w-[640px] border-collapse">
        <thead>
          <tr className="border-b border-ga-line bg-ga-bg">
            <th className="ga-ui px-[18px] py-[11px] text-left text-[10px] font-bold uppercase tracking-[0.1em] text-ga-muted">{ts('colStudent')}</th>
            <th className="ga-ui px-3 py-[11px] text-right text-[10px] font-bold uppercase tracking-[0.1em] text-ga-muted">{ts('colAvg')}</th>
            {data.assignments.map((a) => (
              <th key={a.id} className="ga-ui max-w-[140px] truncate px-3 py-[11px] text-right text-[10px] font-bold uppercase tracking-[0.1em] text-ga-muted" title={a.topic}>{a.topic}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.students.map((s) => (
            <tr key={s.studentId} className="border-t border-ga-line transition-colors hover:bg-ga-surface">
              <td className="px-[18px] py-[13px]">
                <span className="block truncate text-[14px] font-semibold text-ga-ink">{s.name || '—'}</span>
                <span className="block truncate text-[11.5px] text-ga-muted">{s.email || ''}</span>
              </td>
              <td className="px-3 py-[13px] text-right font-ga-display text-[14px] font-medium text-ga-ink">
                {s.avgScore != null ? s.avgScore.toFixed(1) : '—'}
              </td>
              {data.assignments.map((a) => {
                const cell = s.cells[String(a.id)]
                return (
                  <td key={a.id} className="px-3 py-[13px] text-right text-[13px] text-ga-ink">
                    {cell?.score != null ? cell.score : cell ? ts('cellPending') : '—'}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function OrgLessonLogsPanel({ classId }: { classId: number }) {
  const ts = useTranslations('v2.org.classDetail.supervision')
  const [logs, setLogs] = useState<OrgLessonLog[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    setLoading(true)
    try { setLogs(await getOrgClassLessonLogs(classId)); setError('') }
    catch (e: unknown) { setError(apiMessage(e)) }
    finally { setLoading(false) }
  }, [classId])
  useEffect(() => { void load() }, [load])

  if (loading) return <LoadingState variant="skeleton" rows={4} />
  if (error) return <ErrorBanner message={error} onRetry={() => void load()} />
  if (!logs || logs.length === 0) {
    return <p className="ga-ui border border-ga-line bg-ga-card px-6 py-[30px] text-center text-[14px] text-ga-muted">{ts('logsEmpty')}</p>
  }
  return (
    <div className="overflow-x-auto border border-ga-line bg-ga-card">
      <table className="w-full min-w-[640px] border-collapse">
        <thead>
          <tr className="border-b border-ga-line bg-ga-bg">
            {[ts('colDate'), ts('colSession'), ts('colTopic'), ts('colAttendance'), ts('colHomework')].map((h, i) => (
              <th key={h} className={`ga-ui px-[18px] py-[11px] text-[10px] font-bold uppercase tracking-[0.1em] text-ga-muted ${i >= 3 ? 'text-right' : 'text-left'}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => {
            const present = log.attendance.filter((a) => a.status === 'PRESENT').length
            return (
              <tr key={log.id} className="border-t border-ga-line transition-colors hover:bg-ga-surface">
                <td className="px-[18px] py-[13px] text-[13px] text-ga-ink">{format(new Date(log.sessionDate), 'dd/MM/yyyy')}</td>
                <td className="px-[18px] py-[13px] text-[13px] text-ga-muted">{log.sessionNumber ?? '—'}</td>
                <td className="max-w-[280px] px-[18px] py-[13px]">
                  <span className="block truncate text-[14px] font-semibold text-ga-ink">{log.topic || log.lessonTitle || '—'}</span>
                  {log.note && <span className="block truncate text-[11.5px] text-ga-muted">{log.note}</span>}
                </td>
                <td className="px-[18px] py-[13px] text-right text-[13px] font-semibold text-ga-ink">
                  {ts('attendanceShort', { present, total: log.attendance.length })}
                </td>
                <td className="max-w-[220px] truncate px-[18px] py-[13px] text-right text-[12.5px] text-ga-muted">{log.homework || '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
