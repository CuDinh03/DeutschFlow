'use client'

import * as React from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ChevronRight, CircleCheck, CircleX, Layers, Mic, MessageCircle, Users, type LucideIcon } from 'lucide-react'
import { examSpeakingApi } from '@/lib/examSpeakingApi'
import { ORAL_OTHER, oralEntryHref, oralSessionHref } from '@/lib/exam/oralRoutes'
import { latestOral } from '@/components/exam/today/todayModel'
import { useFmt } from '@/lib/i18n/useFmt'
import { cn } from '@/lib/utils'
import { GaGlyph } from '@/components/ui-v2'
import type { BlueprintSummary, ExamProvider, ExamResultView } from '@/types/exam-speaking'

const PASS_PCT = 60
const TEIL_ICON: Record<number, LucideIcon> = { 1: MessageCircle, 2: Users, 3: Users }

interface Props {
  provider?: ExamProvider
  level?: string
  /** Trang này — phòng thi nói thoát/thi xong thì quay về đây. */
  ret: string
}

/** Blueprint + kết quả thi nói của kỳ thi này, nạp một lần cho cả nhóm Teil và lịch sử. */
function useOral(provider: ExamProvider, level: string) {
  const [blueprint, setBlueprint] = React.useState<BlueprintSummary | null>(null)
  const [results, setResults] = React.useState<ExamResultView[]>([])
  React.useEffect(() => {
    let alive = true
    // Bọc Promise.resolve: lỗi đồng bộ của lớp gọi API cũng chỉ làm nhóm này trống, không vỡ cả màn Đề.
    Promise.resolve()
      .then(() => examSpeakingApi.listBlueprints({ provider, level }))
      .then((r) => alive && setBlueprint(r?.data?.[0] ?? null))
      .catch(() => {})
    Promise.resolve()
      .then(() => examSpeakingApi.listResults())
      .then((r) => alive && setResults((r?.data ?? []).filter((x) => x.provider === provider && x.level === level)))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [provider, level])
  return { blueprint, results }
}

/**
 * Nhóm "Mündliche Prüfung" ở màn Đề (Đợt 2 phòng thi nói): dòng thi thử phần nói + một dòng mỗi Teil
 * (luyện riêng Teil với giám khảo AI), nhãn theo lần thi nói có điểm gần nhất; cuối nhóm có lối
 * "Kỳ thi khác". Dòng giống dòng Teil viết ở trên.
 */
export function OralTeilGroup({ provider = 'TELC', level = 'B1', ret }: Props) {
  const t = useTranslations('v2.student.practice.oral')
  const { blueprint, results } = useOral(provider, level)
  const latest = latestOral(results, provider, level)
  const parts = blueprint?.parts ?? []
  const practised = parts.filter((p) => latest?.scoreSheet.parts.some((x) => x.teilNo === p.teilNo)).length
  const mockMinutes = Math.round(parts.reduce((s, p) => s + p.durationSec, 0) / 60)

  return (
    <div data-testid="oral-group">
      <div className="mb-2.5 flex items-center gap-2.5">
        <GaGlyph icon={Mic} />
        <h3 lang="de" className="min-w-0 flex-1 font-ga-display text-ga-h3 text-ga-ink">
          Mündliche Prüfung
        </h3>
        {parts.length > 0 && (
          <span className="ga-ui shrink-0 text-ga-small tabular-nums text-ga-muted">{t('groupDone', { done: practised, total: parts.length })}</span>
        )}
      </div>
      <div className="border-t border-ga-line">
        <OralRow
          icon={Layers}
          title={t('mockTitle')}
          meta={mockMinutes > 0 ? t('mockMeta', { minutes: mockMinutes, n: parts.length }) : t('mockMetaShort')}
          href={oralEntryHref({ provider, level, mode: 'MOCK', ret })}
          tag={
            latest?.total != null && latest.max ? (
              <ScoreTag pct={Math.round((latest.total / latest.max) * 100)} label={t('score', { score: latest.total, max: latest.max })} />
            ) : (
              <NewTag label={t('new')} />
            )
          }
          testId="oral-row-mock"
        />
        {parts.map((p) => {
          const part = latest?.scoreSheet.parts.find((x) => x.teilNo === p.teilNo)
          return (
            <OralRow
              key={p.teilNo}
              icon={TEIL_ICON[p.teilNo] ?? MessageCircle}
              title={
                <>
                  Teil {p.teilNo} <span lang="de" className="font-normal text-ga-muted">· {p.title}</span>
                </>
              }
              meta={t('teilMeta', { minutes: Math.max(1, Math.round(p.durationSec / 60)) })}
              href={oralEntryHref({ provider, level, mode: 'DRILL', teil: p.teilNo, ret })}
              tag={part && part.max > 0 ? <ScoreTag pct={Math.round((part.points / part.max) * 100)} label={t('score', { score: part.points, max: part.max })} /> : <NewTag label={t('new')} />}
              testId={`oral-row-teil-${p.teilNo}`}
            />
          )
        })}
      </div>
      <Link
        href={ORAL_OTHER}
        className="ga-ui mt-2 inline-flex min-h-9 items-center gap-1 text-ga-small font-semibold text-ga-navy underline decoration-1 underline-offset-[3px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus"
        data-testid="oral-other-link"
      >
        {t('other')} <ChevronRight size={14} aria-hidden />
      </Link>
    </div>
  )
}

/** Lượt thi thử phần nói đã chấm của kỳ thi này — đặt trong mục "Thi thử đã làm" của màn Đề. */
export function OralHistory({ provider = 'TELC', level = 'B1', ret }: Props) {
  const t = useTranslations('v2.student.practice.oral')
  const fmtd = useFmt()
  const { results } = useOral(provider, level)
  const rows = results.filter((r) => r.total != null).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6)
  if (rows.length === 0) return null
  return (
    <div className="mt-6" data-testid="oral-history">
      <h3 className="ga-ui mb-1 flex items-center gap-2 text-ga-body font-semibold text-ga-ink">
        <Mic size={16} aria-hidden /> {t('historyTitle')}
      </h3>
      <div className="border-t border-ga-line">
        {rows.map((r) => (
          <Link
            key={r.sessionId}
            href={oralSessionHref(r.sessionId, ret)}
            className="group ga-ui flex min-h-14 items-center gap-3.5 border-b border-ga-line px-1 py-2.5 transition-colors duration-150 hover:bg-ga-side-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ga-focus"
          >
            <span className="min-w-0 flex-1">
              <b className="block text-ga-body font-semibold text-ga-ink">{fmtd.date(r.createdAt)}</b>
              <span className="block text-ga-small tabular-nums text-ga-muted">{t('score', { score: r.total ?? 0, max: r.max ?? 0 })}</span>
            </span>
            <PassTag result={r} />
            <ChevronRight size={16} className="shrink-0 text-ga-subtle transition-transform duration-150 group-hover:translate-x-[3px]" aria-hidden />
          </Link>
        ))}
      </div>
    </div>
  )
}

function PassTag({ result }: { result: ExamResultView }) {
  const t = useTranslations('v2.student.practice.oral')
  if (result.borderline) {
    return <span className="shrink-0 rounded-ga-pill bg-ga-yellow-soft px-2.5 py-0.5 text-ga-caption font-semibold text-ga-ink">{t('borderline')}</span>
  }
  if (result.passed == null) return null
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-ga-pill px-2.5 py-0.5 text-ga-caption font-semibold',
        result.passed ? 'bg-ga-green-soft text-ga-green' : 'bg-ga-red-soft text-ga-red',
      )}
    >
      {result.passed ? <CircleCheck size={13} aria-hidden /> : <CircleX size={13} aria-hidden />}
      {result.passed ? t('passed') : t('failed')}
    </span>
  )
}

function ScoreTag({ pct, label }: { pct: number; label: string }) {
  return pct >= PASS_PCT ? (
    <span className="inline-flex items-center gap-1 rounded-ga-pill bg-ga-green-soft px-2.5 py-0.5 text-ga-caption font-semibold tabular-nums text-ga-green">
      <CircleCheck size={13} aria-hidden /> {label}
    </span>
  ) : (
    <span className="rounded-ga-pill bg-ga-red-soft px-2.5 py-0.5 text-ga-caption font-semibold tabular-nums text-ga-red">{label}</span>
  )
}

function NewTag({ label }: { label: string }) {
  return <span className="rounded-ga-pill bg-ga-side-active px-2.5 py-0.5 text-ga-caption font-semibold text-ga-muted">{label}</span>
}

function OralRow({
  icon: Icon,
  title,
  meta,
  href,
  tag,
  testId,
}: {
  icon: LucideIcon
  title: React.ReactNode
  meta: string
  href: string
  tag: React.ReactNode
  testId: string
}) {
  return (
    <div
      className="group relative grid min-h-16 grid-cols-[36px_minmax(0,1fr)_18px] items-center gap-x-3.5 gap-y-1 border-b border-ga-line px-1 py-2.5 transition-colors duration-150 hover:bg-ga-side-active has-[a:focus-visible]:outline has-[a:focus-visible]:outline-2 has-[a:focus-visible]:-outline-offset-2 has-[a:focus-visible]:outline-ga-focus sm:grid-cols-[36px_minmax(0,1fr)_150px_18px]"
      data-testid={testId}
    >
      <GaGlyph icon={Icon} tone="plain" />
      <Link href={href} className="ga-ui min-w-0 text-ga-ink after:absolute after:inset-0 focus-visible:outline-none">
        <b className="block truncate text-ga-body font-semibold">{title}</b>
        <span className="block truncate text-ga-small text-ga-muted">{meta}</span>
      </Link>
      <span className="ga-ui col-start-2 row-start-2 flex sm:col-start-auto sm:row-start-auto sm:justify-end">{tag}</span>
      <ChevronRight size={16} className="row-start-1 shrink-0 text-ga-subtle transition-transform duration-150 group-hover:translate-x-[3px] sm:row-start-auto" aria-hidden />
    </div>
  )
}
