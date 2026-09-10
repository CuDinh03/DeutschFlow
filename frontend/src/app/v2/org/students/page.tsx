'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Download, Clock, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { apiMessage } from '@/lib/api'
import { listMembers, getAnalytics, type OrgMember, type OrgAnalytics } from '@/lib/orgApi'
import { studentsToCsv, downloadTextFile } from '@/lib/orgCsv'
import { GaPageHdr, GaBtn, GaCap, GaStatStrip, TkSearch } from '@/components/ui-v2'
import { ImportRosterModal } from './ImportRosterModal'

// ─────────────────────────────────────────────────────────────────────────────
// Học viên của tổ chức (GaOrgStudents) — teal, roster LIST.
// Plumbing reused 1:1 (zero backend): orgApi.listMembers('STUDENT') + getAnalytics.
// Option-1: OrgMember carries name/email/status/joinedAt only — the proto's per-student
// CLASS / LEVEL / PROGRESS bar / lastActive have no backing → dropped (roster columns +
// real org-wide stats from /org/analytics instead).
// Đợt 0 OWNER (F03): "Xuất danh sách" xuất CSV THẬT từ đúng các dòng đang hiển thị
// (danh sách tải trọn qua GET /org/members, không phân trang) — hết toast "sắp ra mắt".
// PR-A2 (BF-03, 07/09/2026): số liệu toàn trung tâm có trạng thái RIÊNG loading/ok/error.
// Trước đây `getAnalytics().catch(() => null)` rồi `?? 0` — API lỗi hiện ra như trung tâm
// "không lớp / không ai dùng AI". Nay lỗi → ô KPI hiện "—" + banner thử lại; 0 thật vẫn là 0.
// ─────────────────────────────────────────────────────────────────────────────

const TEAL = '#11888A'
const fmtDate = (d: string | null | undefined) => (d ? format(new Date(d), 'dd/MM/yyyy') : '—')
const initial = (n: string | null) => ((n ?? '?').trim()[0] ?? '?').toUpperCase()

/** Nguồn số liệu toàn trung tâm — tách khỏi danh sách để một API lỗi không kéo cả trang. */
type AnalyticsState = 'loading' | 'ok' | 'error'

/** Dấu "chưa có số" — KHÔNG phải 0. Dùng khi analytics chưa tải hoặc lỗi. */
const NO_VALUE = '—'

export default function V2OrgStudentsPage() {
  const t = useTranslations('v2.org.students')
  const tc = useTranslations('v2.common')
  const router = useRouter()
  const [members, setMembers] = useState<OrgMember[]>([])
  const [analytics, setAnalytics] = useState<OrgAnalytics | null>(null)
  const [analyticsState, setAnalyticsState] = useState<AnalyticsState>('loading')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [onlyMissingBirthDate, setOnlyMissingBirthDate] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setMembers(await listMembers('STUDENT'))
      setError('')
    } catch (e: unknown) {
      setError(apiMessage(e))
    } finally {
      setLoading(false)
    }
  }, [])

  const loadAnalytics = useCallback(async () => {
    setAnalyticsState('loading')
    try {
      setAnalytics(await getAnalytics())
      setAnalyticsState('ok')
    } catch {
      setAnalytics(null)
      setAnalyticsState('error')
    }
  }, [])

  useEffect(() => { void load(); void loadAnalytics() }, [load, loadAnalytics])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return members.filter((m) => {
      const matchesQuery = (m.displayName ?? '').toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
      // `=== false` chứ không phải `!m.birthDateRecorded`: null = backend không tính ở đường này,
      // gộp vào là thổi phồng số học viên trung tâm phải đi đòi giấy tờ (xem OrgMember.birthDateRecorded).
      return matchesQuery && (!onlyMissingBirthDate || m.birthDateRecorded === false)
    })
  }, [members, query, onlyMissingBirthDate])

  /** D4 — số học viên chưa khai ngày sinh: các em này đang bị khoá luyện nói VÀ chấm bài bằng AI. */
  const missingBirthDateN = useMemo(
    () => members.filter((m) => m.birthDateRecorded === false).length,
    [members],
  )

  const activeN = members.filter((m) => m.status === 'ACTIVE').length

  /**
   * Ô KPI có nguồn từ DANH SÁCH thành viên: loading → shimmer; lỗi tải danh sách → "—" + chú thích.
   *
   * Vì sao cần: `members` khởi tạo là `[]`, nên khi `listMembers` hỏng thì `members.length` là 0 —
   * đúng cái "lỗi biến thành 0" mà PR này đi chữa cho nhánh analytics, nhưng còn sót ở nhánh danh
   * sách. Hậu quả thấy được: backend sập thì dải KPI hiện "Tổng học viên: 0" đứng cạnh "Có dùng AI
   * 7 ngày: —", tự mâu thuẫn ngay trên cùng một hàng.
   */
  const memberCell = (value: number, sub: string) => {
    if (loading) {
      return { value: <span className="ga-shimmer inline-block h-6 w-12 align-middle" aria-label={tc('loading')} />, sub, alert: false }
    }
    if (error) return { value: NO_VALUE, sub: t('stats.unavailable'), alert: true }
    return { value, sub, alert: false }
  }

  /** Ô KPI chỉ có nguồn từ analytics: loading → shimmer; error → "—" + chú thích đỏ; ok → số thật (kể cả 0). */
  const analyticsCell = (value: number | undefined, sub: string) => {
    if (analyticsState === 'ok' && value != null) return { value, sub, alert: false }
    if (analyticsState === 'loading') {
      return { value: <span className="ga-shimmer inline-block h-6 w-12 align-middle" aria-label={tc('loading')} />, sub, alert: false }
    }
    return { value: NO_VALUE, sub: t('stats.unavailable'), alert: true }
  }
  const active7d = analyticsCell(analytics?.activeStudents7d, t('stats.activeRecently'))
  const classCount = analyticsCell(analytics?.classCount, t('stats.ofCenter'))

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr
        accent
        title={t('title')}
        subtitle={t('subtitle')}
        right={
          <div className="flex flex-wrap items-center gap-2">
          {/* PR-A5 (BF-07): nối importRoster đã có từ lâu vào UI — hết cảnh nhập từng học viên bằng tay. */}
          <GaBtn variant="yellow" size="sm" onClick={() => setShowImport(true)} data-testid="roster-open">
            <Upload size={15} /> {t('importCsv')}
          </GaBtn>
          <GaBtn
            variant="ghost"
            size="sm"
            disabled={loading}
            onClick={() => {
              if (rows.length === 0) { toast(t('exportEmpty')); return }
              downloadTextFile(`hoc-vien-${format(new Date(), 'yyyy-MM-dd')}.csv`, studentsToCsv(rows, [t('csv.displayName'), t('csv.email'), t('csv.status'), t('csv.joinedAt')]))
              toast.success(t('exportDone', { count: rows.length }))
            }}
          >
            <Download size={15} /> {t('exportList')}
          </GaBtn>
          </div>
        }
      />
      {showImport && (
        <ImportRosterModal onClose={() => setShowImport(false)} onImported={() => void load()} />
      )}

      <div className="flex-1 overflow-auto px-4 py-6 sm:px-6 lg:px-10">
        <GaStatStrip
          items={[
            // Analytics ok thì lấy số của nó; ngược lại rơi về danh sách, nhưng danh sách LỖI thì "—".
            ...(analyticsState === 'ok' && analytics
              ? [{ label: t('stats.totalStudents'), value: analytics.studentCount, sub: t('stats.usingSeats'), alert: false }]
              : [{ label: t('stats.totalStudents'), ...memberCell(members.length, t('stats.usingSeats')) }]),
            { label: t('stats.active'), ...memberCell(activeN, t('stats.activeMembers')), tone: 'green' as const },
            { label: t('stats.active7d'), value: active7d.value, sub: active7d.sub, alert: active7d.alert, tone: 'blue' },
            { label: t('stats.classes'), value: classCount.value, sub: classCount.sub, alert: classCount.alert, tone: 'teal' },
          ]}
        />
        {analyticsState === 'error' && (
          <div
            role="status"
            className="mt-3 flex flex-wrap items-center gap-3 border border-dashed px-3 py-2"
            style={{ borderColor: 'color-mix(in srgb, var(--ga-red) 40%, transparent)' }}
          >
            <p className="ga-ui min-w-0 flex-1 text-ga-caption text-ga-red">{t('analyticsError')}</p>
            <GaBtn variant="ghost" size="sm" onClick={loadAnalytics}>{tc('retry')}</GaBtn>
          </div>
        )}

        {!loading && !error && missingBirthDateN > 0 && (
          <div
            role="status"
            className="mt-3 flex flex-wrap items-start gap-3 border border-dashed px-3 py-2.5"
            style={{ borderColor: 'color-mix(in srgb, var(--ga-warning) 45%, transparent)', background: 'var(--ga-warning-soft)' }}
          >
            <div className="min-w-0 flex-1">
              <p className="ga-ui text-ga-small font-semibold text-ga-ink">
                {t('missingBirthDateBanner', { count: missingBirthDateN })}
              </p>
              <p className="ga-ui mt-0.5 text-ga-caption text-ga-muted">{t('missingBirthDateHow')}</p>
            </div>
            <GaBtn
              variant="ghost"
              size="sm"
              onClick={() => setOnlyMissingBirthDate((v) => !v)}
              aria-pressed={onlyMissingBirthDate}
            >
              {onlyMissingBirthDate ? t('filterAll') : t('filterMissingBirthDate')}
            </GaBtn>
          </div>
        )}

        <div className="mb-3.5 mt-[22px] flex flex-wrap items-center justify-between gap-3">
          <GaCap>{t('count', { count: rows.length })}</GaCap>
          <TkSearch value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('searchPlaceholder')} containerClassName="w-full sm:w-[240px]" />
        </div>

        {loading ? (
          <div className="flex flex-col gap-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="ga-shimmer h-[54px] border border-ga-line" aria-hidden />)}</div>
        ) : error ? (
          <div className="border border-ga-line bg-ga-card px-4 py-8 sm:px-8 lg:px-10 lg:py-[52px] text-center">
            <h2 className="font-ga-display text-[20px] font-medium text-ga-red lg:text-[24px]">{t('loadError')}</h2>
            <p className="ga-ui mx-auto mb-5 mt-3 max-w-sm break-words text-[14px] text-ga-muted">{error} <code className="font-mono text-[12px] text-ga-accent">GET /api/org/members</code></p>
            <GaBtn variant="primary" onClick={load}>{tc('retry')}</GaBtn>
          </div>
        ) : rows.length === 0 ? (
          <div className="border border-dashed border-ga-line px-4 py-8 text-center text-[14px] text-ga-muted sm:px-8 lg:px-10 lg:py-[40px]">
            {members.length === 0 ? t('emptyOrg') : t('emptySearch')}
          </div>
        ) : (
          <div className="overflow-x-auto border border-ga-line bg-ga-card lg:overflow-visible">
            <div className="grid min-w-[620px] items-center gap-2 border-b border-ga-line bg-ga-bg px-5 py-[11px] lg:min-w-0" style={{ gridTemplateColumns: '1fr 130px 120px 84px' }}>
              {[t('colStudent'), t('colStatus'), t('colJoined'), ''].map((h, i) => (
                <span key={i} className="ga-ui text-[10px] font-bold uppercase tracking-[0.1em] text-ga-muted">{h}</span>
              ))}
            </div>
            {rows.map((m, i) => (
              <div key={m.userId} className="grid min-w-[620px] items-center gap-2 px-5 py-3.5 transition-colors hover:bg-ga-surface lg:min-w-0" style={{ gridTemplateColumns: '1fr 130px 120px 84px', borderTop: i ? '1px solid var(--ga-line)' : 'none' }}>
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="grid h-8 w-8 shrink-0 place-items-center font-ga-display text-[13px] font-medium" style={{ color: TEAL, background: 'var(--ga-teal-soft)' }}>{initial(m.displayName)}</span>
                  <span className="min-w-0">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate text-[14px] font-semibold text-ga-ink">{m.displayName || '—'}</span>
                      {m.birthDateRecorded === false && (
                        <span
                          className="ga-ui shrink-0 px-1.5 py-0.5 text-ga-eyebrow uppercase"
                          style={{ color: 'var(--ga-warning)', background: 'var(--ga-warning-soft)' }}
                        >
                          {t('missingBirthDateBadge')}
                        </span>
                      )}
                    </span>
                    <span className="block truncate text-[11.5px] text-ga-muted">{m.email}</span>
                  </span>
                </div>
                <span>
                  <span className="px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.04em]" style={m.status === 'ACTIVE' ? { color: 'var(--ga-green)', background: 'var(--ga-green-soft)' } : { color: 'var(--ga-muted)', background: 'var(--ga-side-active)' }}>
                    {m.status === 'ACTIVE' ? t('statusActive') : t('statusLeft')}
                  </span>
                </span>
                <span className="flex items-center gap-1 text-[12.5px] text-ga-muted"><Clock size={12} /> {fmtDate(m.joinedAt)}</span>
                <button type="button" onClick={() => router.push(`/v2/org/students/${m.userId}`)} className="ga-ui inline-flex min-h-[40px] items-center justify-center justify-self-end border border-ga-line px-2.5 py-1.5 text-[11px] font-semibold text-ga-muted transition-colors hover:border-ga-accent hover:text-ga-accent lg:min-h-0">
                  {t('profile')}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
