'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { apiMessage } from '@/lib/api'
import {
  listOrgReportIssues,
  reportPublicUrl,
  revokeOrgReportIssue,
  REVOKE_REASON_MAX,
  REVOKE_REASON_MIN,
  type ReportIssueSummary,
} from '@/lib/reportIssueApi'
import { ConfirmDialog, GaBtn, GaCap, GaIcon, GaTextarea, TkBadge } from '@/components/ui-v2'
import { useFmt } from '@/lib/i18n/useFmt'

/**
 * Tab "Đánh giá" của màn học viên trong khu trung tâm (R5/R12, thiết kế 10/09/2026 §3.2).
 *
 * Giáo viên phụ trách là người PHÁT HÀNH; giám đốc/quản lý ở đây chỉ XEM và THU HỒI — không có bước
 * duyệt, đúng khuôn sổ chứng nhận DEC-23. Backend (`ReportIssueService.revokeByOrgAdmin`) cho cả
 * OWNER lẫn MANAGER thu hồi và tự ghi mã người thu hồi vào dòng phiếu, nên ở đây không chặn theo vai.
 *
 * <b>Thu hồi đi qua `ConfirmDialog`</b> với ô LÝ DO bắt buộc (5–300 ký tự, máy chủ kiểm lại) và nêu
 * đủ hệ quả — trong đó có một hệ quả mà không giao diện nào đảo ngược được: bản PDF trung tâm ĐÃ gửi
 * cho gia đình vẫn nằm trong hộp thư của họ. Nói ra trước khi bấm, không nói sau.
 *
 * <b>Cột "lượt mở"</b> là số lần link công khai được mở (backend đếm trong cùng giao dịch với vết
 * `report.viewed`). Không có IP, không có danh tính người mở — §5 mặc định của thiết kế.
 */

export interface StudentReportIssuesSectionProps {
  studentId: number
}

const PAGE_SIZE = 20
const REASON_INPUT_ID = 'org-report-issue-revoke-reason'
const REASON_HINT_ID = 'org-report-issue-revoke-reason-hint'

const STATUS_TONE: Record<string, 'green' | 'yellow' | 'red' | 'neutral'> = {
  ACTIVE: 'green',
  EXPIRED: 'yellow',
  SUPERSEDED: 'neutral',
  REVOKED: 'red',
}

export function StudentReportIssuesSection({ studentId }: StudentReportIssuesSectionProps) {
  const t = useTranslations('v2.org.studentDetail.reportIssues')
  const tc = useTranslations('v2.common')
  const fmt = useFmt()
  // Ngày đọc theo locale giao diện của người đang xem; phiếu bên trong vẫn giữ ngôn ngữ đã đóng băng.
  const formatDay = (iso: string | null) => (iso ? fmt.date(iso) : '—')

  const [rows, setRows] = useState<ReportIssueSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pending, setPending] = useState<ReportIssueSummary | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [copiedId, setCopiedId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const page = await listOrgReportIssues({ studentId, size: PAGE_SIZE })
      setRows(page.items)
      setError('')
    } catch (e: unknown) {
      setError(apiMessage(e))
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [studentId])

  useEffect(() => { void load() }, [load])

  const trimmedReason = reason.trim()
  const reasonOk = trimmedReason.length >= REVOKE_REASON_MIN && trimmedReason.length <= REVOKE_REASON_MAX

  const closeRevoke = () => {
    if (busy) return
    setPending(null)
    setReason('')
  }

  const confirmRevoke = async () => {
    if (!pending || !reasonOk) return
    setBusy(true)
    try {
      const updated = await revokeOrgReportIssue(pending.id, trimmedReason)
      setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
      toast.success(t('revokeSuccess'))
      setPending(null)
      setReason('')
    } catch (e: unknown) {
      toast.error(apiMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const copyLink = async (row: ReportIssueSummary) => {
    if (!row.publicPath) return
    try {
      await navigator.clipboard.writeText(reportPublicUrl(row.publicPath))
      setCopiedId(row.id)
      window.setTimeout(() => setCopiedId(null), 2000)
    } catch {
      toast.error(t('copyError'))
    }
  }

  return (
    <section>
      <div className="mb-3.5"><GaCap>{t('cap')}</GaCap></div>
      <p className="ga-ui m-0 mb-3 text-ga-caption leading-relaxed text-ga-muted">{t('hint')}</p>

      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="ga-shimmer h-[54px] border border-ga-line" aria-hidden />
          ))}
        </div>
      ) : error ? (
        <div className="border border-ga-line bg-ga-card px-4 py-6 text-center">
          <p className="m-0 text-ga-body text-ga-red">{error}</p>
          <GaBtn variant="ghost" size="sm" className="mt-3" onClick={() => void load()}>{tc('retry')}</GaBtn>
        </div>
      ) : rows.length === 0 ? (
        <div className="border border-dashed border-ga-line px-4 py-8 text-center text-ga-body text-ga-muted">
          {t('empty')}
        </div>
      ) : (
        <ul className="m-0 list-none border border-ga-line bg-ga-card p-0">
          {rows.map((row, i) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3.5"
              style={{ borderTop: i ? '1px solid var(--ga-line)' : 'none' }}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-ga-body font-semibold text-ga-ink">{t(`period${row.period}`)}</span>
                  <TkBadge tone={STATUS_TONE[row.status] ?? 'neutral'} variant="soft">
                    {t(`status${row.status}`)}
                  </TkBadge>
                  <span className="font-mono text-ga-caption text-ga-muted">{row.verificationCode ?? '—'}</span>
                </div>
                <p className="ga-ui m-0 mt-1 text-ga-caption text-ga-muted">
                  {t('metaLine', {
                    className: row.className ?? '—',
                    date: formatDay(row.issuedAt),
                    issuer: row.issuedByName ?? '—',
                    views: row.viewCount,
                  })}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                {row.publicPath ? (
                  <GaBtn variant="ghost" size="sm" onClick={() => void copyLink(row)}>
                    <GaIcon name={copiedId === row.id ? 'check' : 'link'} size={14} />
                    {copiedId === row.id ? t('copied') : t('copyLink')}
                  </GaBtn>
                ) : null}
                {row.revokedAt ? null : (
                  <GaBtn variant="ghost" size="sm" onClick={() => { setPending(row); setReason('') }}>
                    <GaIcon name="block" size={14} /> {t('revoke')}
                  </GaBtn>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={pending != null}
        onOpenChange={(o) => { if (!o) closeRevoke() }}
        title={t('revokeTitle')}
        description={
          pending
            ? t('revokeDescription', {
                period: t(`period${pending.period}`),
                date: formatDay(pending.issuedAt),
                issuer: pending.issuedByName ?? '—',
              })
            : undefined
        }
        details={[
          t('revokeConsequenceLink'),
          t('revokeConsequencePdf'),
          t('revokeConsequenceNoUndo'),
          t('revokeConsequenceAudit'),
        ]}
        confirmLabel={t('confirmRevoke')}
        cancelLabel={tc('cancel')}
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
            {t('reasonHint', { count: trimmedReason.length, min: REVOKE_REASON_MIN, max: REVOKE_REASON_MAX })}
          </span>
        </div>
      </ConfirmDialog>
    </section>
  )
}

