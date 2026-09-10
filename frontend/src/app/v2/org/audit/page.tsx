'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { apiMessage } from '@/lib/api'
import { listOrgAuditLogs, type OrgAuditLog } from '@/lib/orgApi'
import { GaPageHdr, GaBtn, GaCap, GaIcon, TkBadge, ErrorBanner, LoadingState } from '@/components/ui-v2'
import { useFmt } from '@/lib/i18n/useFmt'
import { OrgOwnerOnly } from '../OwnerOnly'
import { ORG_AUDIT_PAGE_SIZE } from './pagination'
import { parseAuditMetadata } from './metadata'

// ─────────────────────────────────────────────────────────────────────────────
// Sổ hoạt động của trung tâm (C6) — GET /api/org/audit-logs, OWNER-only.
//
// Endpoint lên production 08/09/2026 cùng migration V315 nhưng KHÔNG có màn nào đọc: web không
// gọi tới, nav không có mục. Trang này là bề mặt đọc đó — bảng phân trang thật (phong bì
// {items,total,page,size}), ô tìm gửi `q` lên máy chủ, bộ lọc danh mục gửi `cat`.
//
// Bộ lọc danh mục KHÔNG hardcode enum: `target_type` do ~60 điểm gọi tự đặt, không có endpoint
// liệt kê, nên chip được tích lũy từ chính các dòng đã tải (cùng cách màn nhật ký ADMIN làm).
// Bịa sẵn danh sách sẽ hiện những chip lọc ra rỗng vĩnh viễn.
//
// DEC-13 (owner chốt 09/09/2026): admin nền tảng KHÔNG BAO GIỜ là thành viên trung tâm. Vết họ ghi
// ra chỉ vào được sổ này nhờ `org_id` truyền tường minh phía máy chủ, và khi đã vào thì phải NHÌN
// RA NGAY — nếu không, một thao tác của người ngoài trung tâm sẽ nằm lẫn giữa các dòng của nhân sự
// nội bộ. Vì thế dòng `actorRole === 'ADMIN'` mang huy hiệu riêng; cả đợt này tồn tại vì nó.
// ─────────────────────────────────────────────────────────────────────────────

const ALL = 'all'

/** Vai trò của người NGOÀI trung tâm — `users.org_id` của họ luôn NULL (DEC-13). */
const PLATFORM_ADMIN_ROLE = 'ADMIN'

export default function V2OrgAuditPage() {
  return (
    <OrgOwnerOnly>
      <AuditInner />
    </OrgOwnerOnly>
  )
}

function AuditInner() {
  const t = useTranslations('v2.org.audit')
  const fmt = useFmt()

  const [rows, setRows] = useState<OrgAuditLog[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [cat, setCat] = useState<string>(ALL)
  const [query, setQuery] = useState('')
  // Danh mục đã từng thấy — tích lũy qua các trang để chip không biến mất khi sang trang khác.
  const [seenCats, setSeenCats] = useState<string[]>([])

  const load = useCallback(async (p: number, q: string, c: string) => {
    setLoading(true)
    try {
      const data = await listOrgAuditLogs(p, ORG_AUDIT_PAGE_SIZE, {
        q,
        cat: c === ALL ? undefined : c,
      })
      setRows(data.items)
      setTotal(data.total)
      setSeenCats((prev) => {
        const next = new Set(prev)
        data.items.forEach((r) => { if (r.category) next.add(r.category) })
        return Array.from(next).sort()
      })
      setError('')
    } catch (e: unknown) {
      setError(apiMessage(e))
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  // Gõ tìm kiếm: hoãn 350ms rồi gọi máy chủ (cùng nhịp với màn nhật ký ADMIN).
  useEffect(() => {
    const id = setTimeout(() => { void load(page, query.trim(), cat) }, query ? 350 : 0)
    return () => clearTimeout(id)
  }, [load, page, query, cat])

  // Đổi từ khoá/bộ lọc thì phải quay về trang đầu, nếu không sẽ đứng ở trang 3 của kết quả 1 trang
  // và thấy bảng rỗng.
  const applyQuery = (v: string) => { setQuery(v); setPage(0) }
  const applyCat = (v: string) => { setCat(v); setPage(0) }

  const totalPages = Math.max(1, Math.ceil(total / ORG_AUDIT_PAGE_SIZE))
  const chips = useMemo(() => [ALL, ...seenCats], [seenCats])

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr accent title={t('title')} subtitle={t('subtitle')} />

      <div className="flex-1 overflow-auto px-4 py-6 sm:px-6 lg:px-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {chips.map((c) => {
              const on = cat === c
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => applyCat(c)}
                  className={`ga-ui min-h-[40px] border px-3.5 py-2 text-ga-caption font-semibold transition-colors lg:min-h-0 ${
                    on
                      ? 'border-ga-ink bg-ga-ink text-ga-bg'
                      : 'border-ga-line bg-ga-card text-ga-muted hover:text-ga-ink'
                  }`}
                >
                  {c === ALL ? t('filterAll') : c}
                </button>
              )
            })}
          </div>
          <div className="flex w-full min-w-0 items-center gap-2 border border-ga-line bg-ga-card px-3 py-2 sm:w-auto">
            <GaIcon name="search" size={15} className="shrink-0 text-ga-subtle" />
            <input
              value={query}
              onChange={(e) => applyQuery(e.target.value)}
              placeholder={t('searchPlaceholder')}
              aria-label={t('searchPlaceholder')}
              className="ga-ui w-full min-w-0 border-none bg-transparent text-ga-small text-ga-ink outline-none placeholder:text-ga-subtle sm:w-[260px]"
            />
          </div>
        </div>

        {error ? (
          <ErrorBanner message={error} onRetry={() => void load(page, query.trim(), cat)} />
        ) : loading ? (
          <LoadingState variant="skeleton" rows={5} />
        ) : (
          <>
            <div className="overflow-x-auto border border-ga-line bg-ga-card">
              <table className="w-full min-w-[880px] border-collapse text-ga-small">
                <thead>
                  <tr className="bg-ga-side-active">
                    <Th>{t('colTime')}</Th>
                    <Th>{t('colActor')}</Th>
                    <Th>{t('colAction')}</Th>
                    <Th>{t('colTarget')}</Th>
                    <Th>{t('colDetails')}</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-10 text-center text-ga-small text-ga-muted">
                        {query.trim() || cat !== ALL ? t('emptyFiltered') : t('empty')}
                      </td>
                    </tr>
                  ) : (
                    rows.map((r) => (
                      <tr key={r.id} className="border-t border-ga-line">
                        <Td>
                          <span className="whitespace-nowrap text-ga-muted">
                            {r.createdAt ? fmt.dateTime(r.createdAt) : '—'}
                          </span>
                        </Td>
                        <Td>
                          <div className="font-semibold text-ga-ink">{r.actorEmail ?? t('system')}</div>
                          {r.actorRole === PLATFORM_ADMIN_ROLE ? (
                            <TkBadge
                              tone="navy"
                              className="mt-1"
                              title={t('outsiderHint')}
                            >
                              <GaIcon name="admin_panel_settings" size={12} />
                              {t('outsiderBadge')}
                            </TkBadge>
                          ) : (
                            r.actorRole && <GaCap className="mt-0.5 block">{r.actorRole}</GaCap>
                          )}
                        </Td>
                        <Td><span className="break-words text-ga-ink">{r.eventName}</span></Td>
                        <Td>
                          <span className="break-words text-ga-muted">
                            {r.targetType ?? '—'}{r.targetId ? ` · ${r.targetId}` : ''}
                          </span>
                        </Td>
                        <Td><MetaCell raw={r.metadataJson} /></Td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p className="ga-ui text-ga-caption text-ga-muted">
                {t('pageOf', { page: page + 1, pages: totalPages, total: fmt.num(total) })}
              </p>
              <div className="flex gap-2">
                <GaBtn variant="ghost" size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                  {t('prevPage')}
                </GaBtn>
                <GaBtn variant="ghost" size="sm" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  {t('nextPage')}
                </GaBtn>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th scope="col" className="border-b border-ga-line px-3 py-2 text-left font-bold text-ga-ink">
      {children}
    </th>
  )
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-2 align-top text-ga-ink">{children}</td>
}

/**
 * Ô "Chi tiết" — `metadata_json` bày thành cặp khoá–giá trị.
 *
 * Đây là chỗ duy nhất trả lời "đã đổi cái gì thành cái gì" (fromStatus → toStatus, seatLimit cũ →
 * mới). Giá trị dài đã bị `parseAuditMetadata` cắt; nguyên văn giữ ở `title` để giám đốc rê chuột
 * vẫn đọc được đủ, không phải mở DevTools.
 */
function MetaCell({ raw }: { raw: string | null }) {
  const pairs = parseAuditMetadata(raw)
  if (pairs.length === 0) return <span className="text-ga-subtle">—</span>
  return (
    <dl className="m-0 flex max-w-[360px] flex-col gap-0.5">
      {pairs.map((p) => (
        <div key={p.key || p.full} className="flex flex-wrap items-baseline gap-x-1.5">
          {p.label && (
            <dt className="ga-ui text-ga-caption font-semibold text-ga-subtle">{p.label}</dt>
          )}
          <dd className="m-0 break-all text-ga-caption text-ga-ink" title={p.full}>
            {p.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}
