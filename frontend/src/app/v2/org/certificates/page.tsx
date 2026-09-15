'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { apiMessage } from '@/lib/api'
import {
  certificateVerifyUrl,
  listOrgCertificates,
  revokeOrgCertificate,
  type OrgCertificateRow,
} from '@/lib/certificateApi'
import { listClasses, type OrgClass } from '@/lib/orgApi'
import {
  ConfirmDialog,
  ErrorBanner,
  GaBtn,
  GaCap,
  GaIcon,
  GaPageHdr,
  GaTextarea,
  LoadingState,
  TkBadge,
} from '@/components/ui-v2'
import { useFmt } from '@/lib/i18n/useFmt'
import { useIsOrgOwner } from '../OwnerOnly'
import {
  CLASS_FILTER_PROBE_SIZE,
  ORG_CERTIFICATES_PAGE_SIZE,
  REVOKE_REASON_MAX,
  REVOKE_REASON_MIN,
} from './constants'

// ─────────────────────────────────────────────────────────────────────────────
// Sổ chứng nhận toàn trung tâm (DEC-20, chốt 09/09/2026) — GET /api/org/certificates.
//
// "Giáo viên vẫn cấp, KHÔNG thêm bước duyệt; giám đốc xem được danh sách toàn trung tâm và THU HỒI
// được." Trang này là bề mặt đọc + thu hồi đó. OWNER và MANAGER cùng xem (RoleAreaGuard của khu
// org đã gác cửa), nhưng nút Thu hồi CHỈ hiện với OWNER (`useIsOrgOwner`) — backend gác lại bằng
// `OrgGuard.assertOrgOwner`, lớp này chỉ là UX. Thu hồi đi qua ConfirmDialog có ô LÝ DO (5–300 ký
// tự, máy chủ kiểm lại) và nêu rõ hệ quả: link xác thực công khai báo đã thu hồi, không hoàn tác,
// học viên/giáo viên KHÔNG được báo tự động.
//
// Bộ lọc chạy PHÍA MÁY CHỦ (active / classId / q) — cùng khuôn với sổ hoạt động (C6): đổi bộ lọc
// là quay về trang đầu, gõ tìm hoãn 350ms. Cột "Lớp" là tên HIỆN TẠI của lớp (không chụp lúc cấp);
// lớp đã xoá thì hiện nhãn thay vì ô trống.
// ─────────────────────────────────────────────────────────────────────────────

type StatusFilter = 'all' | 'active' | 'revoked'
const STATUS_FILTERS: StatusFilter[] = ['all', 'active', 'revoked']
const STATUS_LABEL_KEY: Record<StatusFilter, 'filterAll' | 'filterActive' | 'filterRevoked'> = {
  all: 'filterAll',
  active: 'filterActive',
  revoked: 'filterRevoked',
}
/** Sau khi sao chép, nhãn "Đã sao chép" giữ chừng này rồi trả lại nút. */
const COPIED_RESET_MS = 2000
/** Gõ tìm kiếm: hoãn chừng này rồi mới gọi máy chủ (cùng nhịp sổ hoạt động). */
const SEARCH_DEBOUNCE_MS = 350
const REASON_INPUT_ID = 'org-certificate-revoke-reason'
const REASON_HINT_ID = 'org-certificate-revoke-reason-hint'

export default function V2OrgCertificatesPage() {
  const t = useTranslations('v2.org.certificates')
  const fmt = useFmt()
  const isOwner = useIsOrgOwner()

  const [rows, setRows] = useState<OrgCertificateRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [classId, setClassId] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const [classes, setClasses] = useState<OrgClass[]>([])
  const [copiedId, setCopiedId] = useState<number | null>(null)

  // Thu hồi (OWNER): dòng đang chờ xác nhận + lý do gõ ngay trong hộp thoại.
  const [pending, setPending] = useState<OrgCertificateRow | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async (p: number, q: string, s: StatusFilter, cls: number | null) => {
    setLoading(true)
    try {
      const data = await listOrgCertificates(p, ORG_CERTIFICATES_PAGE_SIZE, {
        q,
        classId: cls ?? undefined,
        active: s === 'all' ? undefined : s === 'active',
      })
      setRows(data.items)
      setTotal(data.total)
      setError('')
    } catch (e: unknown) {
      setError(apiMessage(e))
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const id = setTimeout(() => { void load(page, query.trim(), status, classId) }, query ? SEARCH_DEBOUNCE_MS : 0)
    return () => clearTimeout(id)
  }, [load, page, query, status, classId])

  // Danh sách lớp cho bộ lọc — nạp một lần. Lỗi ở đây KHÔNG chặn sổ (bảng có kênh lỗi riêng),
  // nhưng vẫn phải nói ra: bộ lọc rỗng im lặng sẽ bị hiểu là "trung tâm không có lớp".
  useEffect(() => {
    let cancelled = false
    listClasses(0, CLASS_FILTER_PROBE_SIZE)
      .then((p) => { if (!cancelled) setClasses(p.content ?? []) })
      .catch((e: unknown) => { if (!cancelled) toast.error(apiMessage(e)) })
    return () => { cancelled = true }
  }, [])

  // Đổi bộ lọc/từ khoá thì quay về trang đầu — nếu không sẽ đứng ở trang 3 của kết quả 1 trang
  // và thấy bảng rỗng.
  const applyQuery = (v: string) => { setQuery(v); setPage(0) }
  const applyStatus = (v: StatusFilter) => { setStatus(v); setPage(0) }
  const applyClass = (v: string) => { setClassId(v === '' ? null : Number(v)); setPage(0) }

  const totalPages = Math.max(1, Math.ceil(total / ORG_CERTIFICATES_PAGE_SIZE))
  const isFiltered = query.trim() !== '' || status !== 'all' || classId != null
  const showActions = isOwner === true
  const colSpan = showActions ? 9 : 8

  const copyLink = async (r: OrgCertificateRow) => {
    try {
      await navigator.clipboard.writeText(certificateVerifyUrl(r.verifyToken))
      setCopiedId(r.id)
      window.setTimeout(() => setCopiedId((cur) => (cur === r.id ? null : cur)), COPIED_RESET_MS)
    } catch {
      // Clipboard không có (ngữ cảnh không an toàn, quyền bị chặn) — nói ra, đừng im lặng.
      toast.error(t('copyFailed'))
    }
  }

  const trimmedReason = reason.trim()
  const reasonOk = trimmedReason.length >= REVOKE_REASON_MIN && trimmedReason.length <= REVOKE_REASON_MAX

  const openRevoke = (r: OrgCertificateRow) => {
    setReason('')
    setPending(r)
  }

  const closeRevoke = () => {
    if (busy) return
    setPending(null)
    setReason('')
  }

  const confirmRevoke = async () => {
    if (!pending || !reasonOk) return
    setBusy(true)
    try {
      const updated = await revokeOrgCertificate(pending.id, trimmedReason)
      // Thay dòng TẠI CHỖ: giữ nguyên trang + bộ lọc, người dùng thấy ngay "Đã thu hồi" ở đúng dòng
      // vừa bấm thay vì bảng nhảy vì tải lại.
      setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
      toast.success(t('revokeSuccess', { code: updated.certificateCode }))
      setPending(null)
      setReason('')
    } catch (e: unknown) {
      // Hộp thoại giữ nguyên để người dùng đọc lỗi (403 không phải OWNER, 404 khác trung tâm,
      // ORG_READ_ONLY) rồi tự quyết định huỷ.
      toast.error(apiMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr accent title={t('title')} subtitle={t('subtitle')} />

      <div className="flex-1 overflow-auto px-4 py-6 sm:px-6 lg:px-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap gap-2" role="group" aria-label={t('statusFilterLabel')}>
              {STATUS_FILTERS.map((s) => {
                const on = status === s
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => applyStatus(s)}
                    aria-pressed={on}
                    className={`ga-ui min-h-[40px] border px-3.5 py-2 text-ga-caption font-semibold transition-colors lg:min-h-0 ${
                      on
                        ? 'border-ga-ink bg-ga-ink text-ga-bg'
                        : 'border-ga-line bg-ga-card text-ga-muted hover:text-ga-ink'
                    }`}
                  >
                    {t(STATUS_LABEL_KEY[s])}
                  </button>
                )
              })}
            </div>
            <select
              aria-label={t('classFilterLabel')}
              value={classId ?? ''}
              onChange={(e) => applyClass(e.target.value)}
              className="ga-ui min-h-[40px] border border-ga-line bg-ga-card px-3 py-2 text-ga-caption font-semibold text-ga-ink outline-none focus-visible:ring-2 focus-visible:ring-ga-focus lg:min-h-0"
            >
              <option value="">{t('allClasses')}</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
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

        {isOwner === false && (
          <p className="ga-ui mb-3 text-ga-caption text-ga-muted">{t('ownerOnlyHint')}</p>
        )}

        {error ? (
          <ErrorBanner message={error} onRetry={() => void load(page, query.trim(), status, classId)} />
        ) : loading ? (
          <LoadingState variant="skeleton" rows={5} />
        ) : (
          <>
            <div className="overflow-x-auto border border-ga-line bg-ga-card">
              <table className="w-full min-w-[960px] border-collapse text-ga-small">
                <thead>
                  <tr className="bg-ga-side-active">
                    <Th>{t('colStudent')}</Th>
                    <Th>{t('colClass')}</Th>
                    <Th>{t('colLevel')}</Th>
                    <Th>{t('colScore')}</Th>
                    <Th>{t('colIssuedBy')}</Th>
                    <Th>{t('colIssuedAt')}</Th>
                    <Th>{t('colStatus')}</Th>
                    <Th>{t('colVerify')}</Th>
                    {showActions && <Th>{t('colActions')}</Th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={colSpan} className="px-3 py-10 text-center text-ga-small text-ga-muted">
                        {isFiltered ? t('emptyFiltered') : t('empty')}
                      </td>
                    </tr>
                  ) : (
                    rows.map((r) => (
                      <tr key={r.id} className="border-t border-ga-line">
                        <Td>
                          <div className="font-semibold text-ga-ink">{r.studentName}</div>
                          <GaCap className="mt-0.5 block">{r.certificateCode}</GaCap>
                        </Td>
                        <Td>
                          {r.className ?? <span className="text-ga-subtle">{t('classDeleted')}</span>}
                        </Td>
                        <Td><TkBadge tone="navy">{r.cefrLevel}</TkBadge></Td>
                        <Td>{typeof r.score === 'number' ? fmt.num(r.score) : '—'}</Td>
                        <Td>{r.issuedByName ?? '—'}</Td>
                        <Td>
                          <span className="whitespace-nowrap text-ga-muted">{fmt.date(r.issuedAt)}</span>
                        </Td>
                        <Td>
                          {r.active ? (
                            <TkBadge tone="green" dot>{t('statusActive')}</TkBadge>
                          ) : (
                            <TkBadge tone="red" dot>{t('statusRevoked')}</TkBadge>
                          )}
                        </Td>
                        <Td>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <GaBtn
                              variant="ghost"
                              size="sm"
                              onClick={() => void copyLink(r)}
                              aria-label={t('copyLinkAria', { student: r.studentName })}
                            >
                              <GaIcon name={copiedId === r.id ? 'check' : 'link'} size={14} />
                              {copiedId === r.id ? t('copied') : t('copyLink')}
                            </GaBtn>
                            <a
                              href={certificateVerifyUrl(r.verifyToken)}
                              target="_blank"
                              rel="noreferrer"
                              aria-label={t('openVerifyAria', { student: r.studentName })}
                              className="ga-ui inline-flex h-11 items-center gap-1 px-2 text-ga-caption font-semibold text-ga-muted underline-offset-2 hover:text-ga-ink hover:underline lg:h-8"
                            >
                              <GaIcon name="visibility" size={14} />
                              {t('openVerify')}
                            </a>
                          </div>
                        </Td>
                        {showActions && (
                          <Td>
                            {r.active && (
                              <GaBtn
                                variant="ghost"
                                size="sm"
                                className="text-ga-red"
                                onClick={() => openRevoke(r)}
                                aria-label={t('revokeAria', { student: r.studentName })}
                              >
                                <GaIcon name="block" size={14} />
                                {t('revoke')}
                              </GaBtn>
                            )}
                          </Td>
                        )}
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

      {/* Thu hồi = hành động không hoàn tác lên giấy tờ đã trao — ConfirmDialog nêu đối tượng, hệ quả,
          và đòi LÝ DO ngay trong hộp thoại (feedback: mọi nút xoá/huỷ hoại phải có dialog). */}
      <ConfirmDialog
        open={pending != null}
        onOpenChange={(o) => { if (!o) closeRevoke() }}
        title={t('revokeTitle')}
        description={
          pending
            ? t('revokeDescription', {
                code: pending.certificateCode,
                level: pending.cefrLevel,
                student: pending.studentName,
                issuer: pending.issuedByName ?? '—',
              })
            : undefined
        }
        details={[
          t('revokeConsequenceLink'),
          t('revokeConsequenceNoUndo'),
          t('revokeConsequenceNoNotify'),
          t('revokeConsequenceAudit'),
        ]}
        confirmLabel={t('confirmRevoke')}
        cancelLabel={t('cancel')}
        confirmDisabled={!reasonOk}
        loading={busy}
        onConfirm={() => void confirmRevoke()}
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor={REASON_INPUT_ID} className="ga-ui text-ga-caption font-semibold text-ga-ink">
            {t('reasonLabel')}
          </label>
          <GaTextarea
            id={REASON_INPUT_ID}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('reasonPlaceholder')}
            maxLength={REVOKE_REASON_MAX}
            rows={3}
            invalid={reason.length > 0 && !reasonOk}
            disabled={busy}
            aria-describedby={REASON_HINT_ID}
          />
          <span id={REASON_HINT_ID} className="ga-ui text-ga-caption text-ga-muted">
            {t('reasonHint', { count: trimmedReason.length, max: REVOKE_REASON_MAX, min: REVOKE_REASON_MIN })}
          </span>
        </div>
      </ConfirmDialog>
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
