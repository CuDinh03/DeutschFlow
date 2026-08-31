'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ChevronRight, UserPlus } from 'lucide-react'
import { apiMessage } from '@/lib/api'
import {
  getOrgSummary, getAnalytics, listClasses, listInvitations,
  type OrgSummary, type OrgAnalytics, type OrgClass, type OrgInvitation,
} from '@/lib/orgApi'
import { seatMetaOf } from '@/lib/orgSeats'
import { GaPageHdr, GaBtn, GaCap, TkStatStrip } from '@/components/ui-v2'

// ─────────────────────────────────────────────────────────────────────────────
// Org dashboard OWNER (GaOrgDashboard) — teal (role=org). Góc nhìn GIÁM ĐỐC: sức khoẻ trung tâm
// (ghế, token pool, phân bố CEFR). MANAGER (nhân sự) có bảng RIÊNG → ManagerDashboard.tsx.
//
// Đợt 0 OWNER (báo cáo 31/08):
//   - F02: analytics/classes/invites lỗi KHÔNG cho về null/[] im lặng nữa — từng vùng nói rõ
//     "chưa tải được" + retry; "Cần xử lý" không dám kết luận "không có việc" khi nguồn lỗi.
//   - F03: mọi CTA điều hướng thật (Lời mời, Gói & thanh toán, danh sách liên quan) — hết toast
//     "sắp ra mắt". Nút "Mua thêm ghế" giả đã gỡ.
//   - F05: seatLimit=0 = KHÔNG GIỚI HẠN (orgSeats), không phải 0% sức chứa; nhãn hoạt động 7
//     ngày đổi thành "có dùng AI" cho đúng nguồn số (ai_token_usage_events).
//   - Trần 50 lớp của cảnh báo thiếu GV vẫn còn — O-2 chuyển aggregate về backend.
// ─────────────────────────────────────────────────────────────────────────────

const TEAL = '#11888A'

/** Trạng thái một nguồn dữ liệu phụ: còn chờ / đã có / lỗi. */
type Src<T> = { state: 'loading' } | { state: 'ok'; data: T } | { state: 'error' }

export function OrgOwnerDashboard() {
  const t = useTranslations('v2.org.overview')
  const tc = useTranslations('v2.common')
  const router = useRouter()
  const [summary, setSummary] = useState<OrgSummary | null>(null)
  const [analytics, setAnalytics] = useState<Src<OrgAnalytics>>({ state: 'loading' })
  const [classes, setClasses] = useState<Src<OrgClass[]>>({ state: 'loading' })
  const [invites, setInvites] = useState<Src<OrgInvitation[]>>({ state: 'loading' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setAnalytics({ state: 'loading' })
    setClasses({ state: 'loading' })
    setInvites({ state: 'loading' })
    try {
      // Summary là xương sống của trang — lỗi thì cả trang là lỗi (panel dưới).
      const s = await getOrgSummary()
      setSummary(s)
      setError('')
    } catch (e: unknown) {
      setError(apiMessage(e))
      setLoading(false)
      return
    }
    // F02: các nguồn phụ tách trạng thái riêng — lỗi hiển thị là lỗi, không thành 0.
    const [a, c, inv] = await Promise.allSettled([
      getAnalytics(),
      // O-2 sẽ thay bằng aggregate backend; tạm giữ trang đầu 50 lớp (trần cũ, đã ghi nhận F05).
      listClasses(0, 50).then((p) => p.content),
      listInvitations(),
    ])
    setAnalytics(a.status === 'fulfilled' ? { state: 'ok', data: a.value } : { state: 'error' })
    setClasses(c.status === 'fulfilled' ? { state: 'ok', data: c.value } : { state: 'error' })
    setInvites(inv.status === 'fulfilled' ? { state: 'ok', data: inv.value } : { state: 'error' })
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  // null khi summary CHƯA tải xong — không được hiểu là "không giới hạn" (review O-1).
  const seats = seatMetaOf(summary)
  const an = analytics.state === 'ok' ? analytics.data : null

  // "Cần xử lý" chỉ tổng hợp từ nguồn ĐÃ tải được; nguồn lỗi → nói rõ, không im lặng bỏ qua.
  const todoSourceFailed = classes.state === 'error' || invites.state === 'error'
  const todos: { key: string; label: string; tone: string; href: string }[] = []
  if (seats && !seats.unlimited && (seats.free ?? 0) > 0) {
    todos.push({ key: 'seats', label: t('todo.freeSeats', { count: seats.free ?? 0 }), tone: 'var(--ga-yellow)', href: '/v2/org/invitations' })
  }
  if (classes.state === 'ok') {
    const teacherless = classes.data.filter((c) => c.teacherId == null).length
    if (teacherless > 0) todos.push({ key: 'teacherless', label: t('todo.teacherless', { count: teacherless }), tone: 'var(--ga-red)', href: '/v2/org/classes' })
  }
  if (invites.state === 'ok') {
    const pending = invites.data.filter((i) => i.status === 'PENDING').length
    if (pending > 0) todos.push({ key: 'invites', label: t('todo.pendingInvites', { count: pending }), tone: 'var(--ga-orange)', href: '/v2/org/invitations' })
  }

  const cefr = an?.cefrDistribution ?? []
  const cefrMax = Math.max(1, ...cefr.map((b) => b.count))

  if (error) {
    return (
      <div className="flex min-h-full flex-col">
        <GaPageHdr accent title={t('title')} subtitle={t('subtitleDashboard')} />
        <div className="flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
          <div className="border border-ga-line bg-ga-card px-4 py-8 sm:px-8 lg:px-10 lg:py-[52px] text-center">
            <h2 className="font-ga-display text-[20px] font-medium text-ga-red lg:text-[24px]">{t('loadError')}</h2>
            <p className="ga-ui mx-auto mb-5 mt-3 max-w-md text-[14px] text-ga-muted">
              {error || t('loadErrorDesc')}
            </p>
            <GaBtn variant="primary" onClick={load}>{tc('retry')}</GaBtn>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr
        accent
        title={summary?.name ?? t('title')}
        subtitle={t('subtitleB2b')}
        right={
          <div className="flex flex-wrap items-center gap-2.5">
            {/* F03: điều hướng thật thay toast "sắp ra mắt". */}
            <GaBtn variant="ghost" size="sm" onClick={() => router.push('/v2/org/billing')}>{t('managePlan')}</GaBtn>
            <GaBtn variant="yellow" size="sm" onClick={() => router.push('/v2/org/invitations')}>
              <UserPlus size={15} /> {t('inviteMember')}
            </GaBtn>
          </div>
        }
      />

      <div className="flex-1 overflow-auto px-4 py-6 sm:px-6 lg:px-10">
        <TkStatStrip
          items={[
            {
              label: t('stats.seatsUsed'),
              value: summary && seats ? (seats.unlimited ? summary.seatUsed.toLocaleString('vi-VN') : `${summary.seatUsed}/${summary.seatLimit}`) : '—',
              // seats=null (summary chưa về) KHÔNG hiển thị "không giới hạn" — chỉ '—'.
              sub: seats ? (seats.unlimited ? t('stats.capacityUnlimited') : t('stats.capacity', { pct: seats.pct ?? 0 })) : '—',
              color: TEAL,
            },
            {
              label: t('stats.totalStudents'),
              value: loading ? '—' : (an?.studentCount ?? summary?.studentCount ?? 0),
              sub: analytics.state === 'error' ? t('statUnavailable') : t('stats.active7d', { count: an?.activeStudents7d ?? 0 }),
              color: '#2F6FC9',
            },
            {
              label: t('stats.openClasses'),
              value: loading ? '—' : (an?.classCount ?? (classes.state === 'ok' ? classes.data.length : '—')),
              sub: loading ? '—' : t('stats.teacherCount', { count: summary?.teacherCount ?? 0 }),
              color: '#7C56C8',
            },
            {
              label: t('stats.tokensThisMonth'),
              value: an ? an.tokensThisMonth.toLocaleString('vi-VN') : analytics.state === 'error' ? '—' : '…',
              sub: analytics.state === 'error' ? t('statUnavailable') : an?.poolUnlimited ? t('stats.poolUnlimited') : an && an.monthlyTokenPool > 0 ? t('stats.poolPercent', { pct: Math.round(an.poolUsagePercent) }) : t('stats.noPool'),
              color: '#1E9E61',
            },
          ]}
        />

        <div className="mt-6 grid grid-cols-1 gap-[22px] lg:grid-cols-[2fr_1fr]">
          {/* CEFR distribution (real) */}
          <div className="border border-ga-line bg-ga-card p-4 lg:p-[22px]">
            <GaCap className="mb-4 block">{t('cefrCap')}</GaCap>
            {analytics.state === 'loading' ? (
              <div className="ga-shimmer h-[170px]" aria-hidden />
            ) : analytics.state === 'error' ? (
              <div className="py-8 text-center">
                <p className="ga-ui mb-3 text-[13.5px] text-ga-red">{t('sectionError')}</p>
                <GaBtn variant="ghost" size="sm" onClick={load}>{tc('retry')}</GaBtn>
              </div>
            ) : cefr.length === 0 ? (
              <p className="py-10 text-center text-[13px] text-ga-muted">{t('cefrEmpty')}</p>
            ) : (
              <div className="flex flex-col gap-3">
                {cefr.map((b) => (
                  <div key={b.level} className="flex items-center gap-3">
                    <span className="w-10 shrink-0 font-ga-display text-[15px] font-medium text-ga-ink">{b.level}</span>
                    <span className="h-6 flex-1 bg-ga-bg">
                      <span className="block h-full" style={{ width: `${(b.count / cefrMax) * 100}%`, background: TEAL, minWidth: b.count > 0 ? 2 : 0 }} />
                    </span>
                    <span className="w-10 shrink-0 text-right text-[13px] font-semibold text-ga-muted">{b.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Seat + token meters (real) */}
          <div className="border border-ga-line bg-ga-card p-4 lg:p-[22px]">
            <GaCap className="mb-4 block">{t('seatUsageCap')}</GaCap>
            {/* seats=null = summary chưa về → shimmer, KHÔNG render "0 · không giới hạn" giả. */}
            {!seats ? (
              <div className="ga-shimmer h-[88px]" aria-hidden />
            ) : (
              <>
                {seats.unlimited ? (
                  <>
                    {/* F05: gói không giới hạn — hiển thị số đang dùng, KHÔNG vẽ % sức chứa giả. */}
                    <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3">
                      <span className="font-ga-display text-[20px] font-medium text-ga-ink lg:text-[26px]">{summary?.seatUsed ?? 0}</span>
                      <span className="min-w-0 text-[12.5px] text-ga-muted">{t('seatsUnlimitedSuffix')}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 lg:flex-nowrap lg:gap-x-0">
                      <span className="font-ga-display text-[20px] font-medium text-ga-ink lg:text-[26px]">{seats.pct ?? 0}%</span>
                      <span className="min-w-0 text-[12.5px] text-ga-muted">{t('seatsSuffix', { used: summary?.seatUsed ?? 0, limit: summary?.seatLimit ?? 0 })}</span>
                    </div>
                    <span className="block h-2.5 bg-ga-bg"><span className="block h-full" style={{ width: `${seats.pct ?? 0}%`, background: TEAL }} /></span>
                  </>
                )}
                <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 text-[12.5px] text-ga-muted lg:flex-nowrap lg:gap-x-0">
                  <span className="min-w-0">{seats.unlimited ? '' : t('freeSuffix', { count: seats.free ?? 0 })}</span>
                  <Link href="/v2/org/billing" className="inline-flex min-h-[40px] items-center font-semibold underline lg:min-h-0" style={{ color: TEAL }}>{t('viewBilling')}</Link>
                </div>
              </>
            )}

            {an && an.monthlyTokenPool > 0 && (
              <>
                <GaCap className="mb-2 mt-5 block">{t('tokenPoolCap')}</GaCap>
                <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 lg:flex-nowrap lg:gap-x-0">
                  <span className="font-ga-display text-[20px] font-medium text-ga-ink">{Math.round(an.poolUsagePercent)}%</span>
                  <span className="min-w-0 break-words text-[12px] text-ga-muted">{an.tokensThisMonth.toLocaleString('vi-VN')} / {an.monthlyTokenPool.toLocaleString('vi-VN')}</span>
                </div>
                <span className="block h-2 bg-ga-bg"><span className="block h-full" style={{ width: `${Math.min(100, an.poolUsagePercent)}%`, background: an.poolUsagePercent >= 90 ? 'var(--ga-red)' : an.poolUsagePercent >= 70 ? 'var(--ga-orange)' : 'var(--ga-green)' }} /></span>
                {/* 2 kênh token (26/07): pool giờ thuần chi phí GV — nói rõ để OWNER khỏi tưởng HV tiêu vào đây */}
                <p className="mt-2 text-[12px] leading-snug text-ga-muted">{t('poolStudentNote')}</p>
              </>
            )}
          </div>
        </div>

        <div className="mt-[22px] grid grid-cols-1 gap-[22px] lg:grid-cols-2">
          {/* Cần xử lý (từ dữ liệu thật; nguồn lỗi phải nói rõ — F02) */}
          <div className="border border-ga-line bg-ga-card p-4 lg:p-[22px]">
            <GaCap className="mb-3.5 block">{t('todoCap')}</GaCap>
            {todoSourceFailed && (
              <div className="mb-2 flex flex-wrap items-center gap-3 border border-dashed px-3 py-2" style={{ borderColor: 'color-mix(in srgb, var(--ga-red) 40%, transparent)' }}>
                <p className="ga-ui min-w-0 flex-1 text-[12.5px] text-ga-red">{t('todoSourceError')}</p>
                <GaBtn variant="ghost" size="sm" onClick={load}>{tc('retry')}</GaBtn>
              </div>
            )}
            {todos.length === 0 && !todoSourceFailed ? (
              <p className="py-4 text-[13.5px] text-ga-muted">{t('todoEmpty')}</p>
            ) : (
              todos.map((td, i) => (
                <Link
                  key={td.key}
                  href={td.href}
                  className="group flex w-full items-center gap-3 py-3 text-left"
                  style={{ borderTop: i ? '1px solid var(--ga-line)' : 'none' }}
                >
                  <span className="h-[7px] w-[7px] shrink-0" style={{ background: td.tone }} />
                  <span className="flex-1 text-[13.5px] text-ga-ink">{td.label}</span>
                  <ChevronRight size={15} className="text-ga-subtle opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
              ))
            )}
          </div>

          {/* Org classes (real) */}
          <div className="border border-ga-line bg-ga-card p-4 lg:p-[22px]">
            <GaCap className="mb-3.5 block">{t('orgClassesCap')}</GaCap>
            {classes.state === 'loading' ? (
              <div className="ga-shimmer h-[120px]" aria-hidden />
            ) : classes.state === 'error' ? (
              <div className="py-6 text-center">
                <p className="ga-ui mb-3 text-[13.5px] text-ga-red">{t('sectionError')}</p>
                <GaBtn variant="ghost" size="sm" onClick={load}>{tc('retry')}</GaBtn>
              </div>
            ) : classes.data.length === 0 ? (
              <p className="py-4 text-[13.5px] text-ga-muted">{t('orgClassesEmpty')}</p>
            ) : (
              classes.data.slice(0, 5).map((c, i) => (
                <div key={c.id} className="flex items-center gap-3 py-2.5" style={{ borderTop: i ? '1px solid var(--ga-line)' : 'none' }}>
                  <span className="grid h-8 w-8 shrink-0 place-items-center font-ga-display text-[14px] font-medium" style={{ color: TEAL, background: 'var(--ga-teal-soft)' }}>
                    {(c.name[0] ?? 'L').toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-semibold text-ga-ink">{c.name}</div>
                    <div className="text-[11.5px] text-ga-muted">{c.teacherId == null ? t('classNoTeacher') : t('classHasTeacher')}</div>
                  </div>
                  {c.inviteCode && <code className="shrink-0 bg-ga-ink px-2 py-1 text-[11px] font-semibold tracking-[0.06em] text-ga-yellow">{c.inviteCode}</code>}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
