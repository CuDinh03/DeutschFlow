'use client'

import * as React from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ChevronRight, Lock, Mic } from 'lucide-react'
import { getMockPack, getMockPacks, type PackExam } from '@/lib/mockPackApi'
import { getPracticeAccess, getPracticeOverview, type PracticeOverview } from '@/lib/telcPracticeApi'
import { listMyAttempts, type MyAttempt } from '@/lib/exam/mockAttemptApi'
import { apiMessage } from '@/lib/api'
import { useFmt } from '@/lib/i18n/useFmt'
import { ErrorBanner, GaPageHdr, LoadingState, TkBadge } from '@/components/ui-v2'

/**
 * Luyện thi — `/v2/student/exam` (06/11/2026, owner chốt "bỏ toàn bộ phần luyện thi cũ").
 *
 * Một lối vào duy nhất cho chuẩn bị thi telc trên web: mỗi đề có hai cách làm — **Luyện từng Teil**
 * (không ép giờ, kiểm tra từng Teil, phân tích vì sao đúng/sai) và **Thi thử trọn đề** (đồng hồ tổng,
 * nộp một lần, vào lịch sử, hai ngưỡng đỗ). Phần Nói thi ở phòng thi nói AI. Đề Goethe ẩn trên web
 * cho tới đợt riêng (dữ liệu và lịch sử giữ nguyên; mobile vẫn dùng như cũ).
 *
 * Thay cho: hub cũ, danh sách gói `/mock-exam`, trình thi `/mock-exam/run`, Đánh giá B1 và kế hoạch
 * thi — các route đó giờ chuyển về đây.
 */

interface ExamRow {
  exam: PackExam
  packTitle: string
  level: string
}

interface LockedPack {
  id: number
  title: string
}

export default function V2StudentExamHubPage() {
  const t = useTranslations('v2.student.examHub')
  const [access, setAccess] = React.useState<boolean | null>(null)
  const [rows, setRows] = React.useState<ExamRow[] | null>(null)
  const [locked, setLocked] = React.useState<LockedPack[]>([])
  const [attempts, setAttempts] = React.useState<MyAttempt[]>([])
  const [overviews, setOverviews] = React.useState<Record<number, PracticeOverview>>({})
  const [error, setError] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    setError(null)
    try {
      const [enabled, packs, mine] = await Promise.all([getPracticeAccess(), getMockPacks(), listMyAttempts().catch(() => [])])
      setAccess(enabled)
      setAttempts(mine)
      const telc = packs.filter((p) => p.examFormat?.toUpperCase() === 'TELC')
      setLocked(telc.filter((p) => p.locked).map((p) => ({ id: p.id, title: p.title })))
      const details = await Promise.all(telc.filter((p) => !p.locked).map((p) => getMockPack(p.id).catch(() => null)))
      const list: ExamRow[] = []
      details.forEach((d) => d?.exams.forEach((exam) => list.push({ exam, packTitle: d.title, level: d.cefrLevel })))
      setRows(list)
      if (enabled) {
        const ready = list.filter((r) => !r.exam.comingSoon)
        const ovs = await Promise.all(ready.map((r) => getPracticeOverview(r.exam.id).catch(() => null)))
        const map: Record<number, PracticeOverview> = {}
        ovs.forEach((o) => {
          if (o) map[o.examId] = o
        })
        setOverviews(map)
      }
    } catch (e) {
      setError(apiMessage(e) || t('loadError'))
    }
  }, [t])
  React.useEffect(() => {
    void load()
  }, [load])

  const examIds = new Set((rows ?? []).map((r) => r.exam.id))
  const history = attempts.filter((a) => examIds.has(a.exam_id) && a.status === 'COMPLETED')

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr accent title={t('title')} subtitle={t('subtitle')} />
      <div className="flex-1 px-4 py-6 sm:px-6 lg:px-10">
        {error && (
          <div className="mb-5">
            <ErrorBanner message={error} onRetry={load} />
          </div>
        )}
        {!rows && !error && <LoadingState label={t('loading')} />}
        {rows && access === false && (
          <p className="ga-ui mb-5 max-w-[60ch] border border-ga-line bg-ga-card px-4 py-3 text-ga-body text-ga-muted">{t('notOpen')}</p>
        )}
        {rows && access !== false && (
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-4">
              <p className="ga-ui max-w-[62ch] text-ga-body text-ga-muted">{t('lead')}</p>
              {rows.length === 0 && locked.length === 0 && (
                <p className="ga-ui border border-ga-line bg-ga-card px-4 py-3 text-ga-body text-ga-muted">{t('empty')}</p>
              )}
              {rows.map((r) => (
                <ExamCard key={r.exam.id} row={r} overview={overviews[r.exam.id]} attempts={attempts.filter((a) => a.exam_id === r.exam.id)} />
              ))}
              {locked.map((p) => (
                <div key={p.id} className="flex items-center gap-3 border border-ga-line bg-ga-card px-4 py-3.5">
                  <Lock size={18} className="shrink-0 text-ga-subtle" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <b className="block text-ga-body-lg font-semibold text-ga-ink">{p.title}</b>
                    <span className="ga-ui block text-ga-small text-ga-muted">{t('lockedPack')}</span>
                  </span>
                  <TkBadge tone="yellow">PRO</TkBadge>
                </div>
              ))}

              <Link
                href="/v2/student/speaking/exam"
                className="ga-ui flex min-h-16 items-center gap-3.5 border border-ga-line bg-ga-card px-4 py-3 hover:bg-ga-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus"
              >
                <Mic size={18} className="shrink-0 text-ga-muted" aria-hidden />
                <span className="min-w-0 flex-1">
                  <b className="block font-ga-display text-ga-h3 text-ga-ink">Mündliche Prüfung</b>
                  <span className="block text-ga-small text-ga-muted">{t('oralDesc')}</span>
                </span>
                <ChevronRight size={16} className="shrink-0 text-ga-subtle" aria-hidden />
              </Link>
            </div>

            <aside className="space-y-3.5">
              <div className="border border-ga-line bg-ga-card p-4">
                <p className="ga-ui mb-2 text-ga-eyebrow uppercase text-ga-muted">{t('modesCap')}</p>
                <p className="ga-ui text-ga-small text-ga-ink"><b>{t('practiceMode')}</b> — {t('practiceModeDesc')}</p>
                <p className="ga-ui mt-2 text-ga-small text-ga-ink"><b>{t('fullMode')}</b> — {t('fullModeDesc')}</p>
              </div>
              <History attempts={history} />
            </aside>
          </div>
        )}
      </div>
    </div>
  )
}

function ExamCard({ row, overview, attempts }: { row: ExamRow; overview?: PracticeOverview; attempts: MyAttempt[] }) {
  const t = useTranslations('v2.student.examHub')
  const fmt = useFmt()
  const { exam } = row
  const inProgress = attempts.find((a) => a.status === 'IN_PROGRESS')
  const last = attempts.filter((a) => a.status === 'COMPLETED').sort((a, b) => (b.finished_at ?? '').localeCompare(a.finished_at ?? ''))[0]
  const teile = overview?.teile ?? []
  const done = teile.filter((x) => x.progress?.checked).length

  return (
    <article className="border border-ga-line bg-ga-card">
      <div className="flex flex-wrap items-baseline gap-2.5 border-b border-ga-line px-4 py-3">
        <h2 className="min-w-0 flex-1 font-ga-display text-ga-h2 text-ga-ink">{exam.title}</h2>
        {exam.comingSoon && <TkBadge tone="yellow">{t('comingSoon')}</TkBadge>}
      </div>
      {exam.comingSoon ? (
        <p className="ga-ui px-4 py-3 text-ga-small text-ga-muted">{t('comingSoonHint')}</p>
      ) : (
        <>
          <dl className="ga-ui grid grid-cols-1 gap-x-6 gap-y-1 px-4 py-3 text-ga-small sm:grid-cols-2">
            <div className="flex justify-between gap-3 sm:block">
              <dt className="text-ga-muted">{t('practiceProgress')}</dt>
              <dd className="font-semibold text-ga-ink">{overview ? t('teilDone', { done, total: teile.length }) : '—'}</dd>
            </div>
            <div className="flex justify-between gap-3 sm:block">
              <dt className="text-ga-muted">{t('lastMock')}</dt>
              <dd className="font-semibold text-ga-ink">
                {last ? t('lastMockValue', { score: last.total_score ?? 0, date: fmt.date(last.finished_at ?? last.started_at) }) : t('noMock')}
              </dd>
            </div>
          </dl>
          <div className="flex flex-wrap gap-2.5 border-t border-ga-line px-4 py-3">
            <Link
              href={`/v2/student/mock-exam/practice?examId=${exam.id}`}
              className="ga-ui inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-ga-touch bg-ga-yellow px-4 text-ga-body font-semibold text-ga-ink hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus sm:flex-none"
            >
              {t('practiceCta')} <ChevronRight size={16} aria-hidden />
            </Link>
            <Link
              href={`/v2/student/mock-exam/full?examId=${exam.id}`}
              className="ga-ui inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-ga-touch border-[1.5px] border-ga-line-strong bg-ga-card px-4 text-ga-body font-semibold text-ga-ink hover:bg-ga-side-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus sm:flex-none"
            >
              {inProgress ? t('fullContinue') : t('fullCta')}
              {exam.timeLimitMinutes != null && !inProgress && (
                <span className="font-normal text-ga-muted">· {t('minutes', { n: exam.timeLimitMinutes })}</span>
              )}
            </Link>
          </div>
        </>
      )}
    </article>
  )
}

function History({ attempts }: { attempts: MyAttempt[] }) {
  const t = useTranslations('v2.student.examHub')
  const fmt = useFmt()
  const list = [...attempts].sort((a, b) => (b.finished_at ?? '').localeCompare(a.finished_at ?? '')).slice(0, 8)
  return (
    <div className="border border-ga-line bg-ga-card">
      <p className="ga-ui border-b border-ga-line px-4 py-3 text-ga-eyebrow uppercase text-ga-muted">{t('historyCap')}</p>
      {list.length === 0 ? (
        <p className="ga-ui px-4 py-3 text-ga-small text-ga-muted">{t('historyEmpty')}</p>
      ) : (
        <ul>
          {list.map((a) => (
            <li key={a.id}>
              <Link
                href={`/v2/student/mock-exam/full?attemptId=${a.id}`}
                className="ga-ui flex min-h-12 items-center gap-3 border-b border-ga-line px-4 py-2 text-ga-small last:border-b-0 hover:bg-ga-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ga-focus"
              >
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-ga-ink">{a.exam_title ?? '—'}</b>
                  <span className="block text-ga-muted">{fmt.date(a.finished_at ?? a.started_at)}</span>
                </span>
                <span className="shrink-0 tabular-nums font-semibold text-ga-ink">{a.total_score ?? 0}</span>
                <ChevronRight size={14} className="shrink-0 text-ga-subtle" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
