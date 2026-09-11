'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { apiMessage } from '@/lib/api'
import { ReportSheet } from '@/components/report/ReportSheet'
import {
  downloadReportPdf,
  issueReport,
  listReportIssues,
  reportPublicUrl,
  REPORT_PERIODS,
  type ReportIssueDetail,
  type ReportIssueSummary,
  type ReportPeriod,
} from '@/lib/reportIssueApi'
import { REPORT_LANGS, reportSheetDict, type ReportLang } from '@/lib/reportSheetDict'
import type { StudentEvaluation } from '@/lib/teacherEvaluationApi'
import { GaBtn, GaCap, GaIcon, TkBadge, TkModal, TkSeg, type TkSegOption } from '@/components/ui-v2'
import { useFmt } from '@/lib/i18n/useFmt'
import { buildPreviewPayload } from './reportPreview'

/**
 * Phát hành phiếu đánh giá gửi gia đình (PR-R3, thiết kế 10/09/2026 §3.2).
 *
 * Ba bước trong một hộp thoại: chọn KỲ + NGÔN NGỮ → XEM TRƯỚC → Phát hành. Sau khi phát hành, hộp
 * thoại đổi sang khối kết quả (link công khai + sao chép + tải PDF) vì theo R1 DeutschFlow KHÔNG gửi
 * gì cho phụ huynh — trung tâm cầm link/PDF rồi tự gửi qua kênh của họ.
 *
 * <b>Phát hành lại cùng kỳ là hành động có hậu quả</b>: backend đặt bản cũ thành `SUPERSEDED` và link
 * cũ chết NGAY. Nên khi kỳ đang chọn đã có một phiếu còn sống, hộp thoại nói thẳng điều đó ra trước
 * khi nút được bấm, và nhãn nút đổi thành "Phát hành lại".
 *
 * <b>Cổng đồng ý</b> (R6): 409 `GUARDIAN_REPORT_CONSENT_REQUIRED|_REVOKED|BIRTH_DATE_REQUIRED` — thông
 * điệp tiếng Việt của máy chủ đã nói đúng việc trung tâm cần làm, nên hiện nguyên văn qua `apiMessage`
 * thay vì dịch lại thành câu chung chung.
 */

export interface ReportIssueDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  classId: number
  evaluation: StudentEvaluation
}

const ACTIVE_STATUS = 'ACTIVE'

export function ReportIssueDialog({ open, onOpenChange, classId, evaluation }: ReportIssueDialogProps) {
  const t = useTranslations('v2.teacher.tcReports.reportIssue')
  const tc = useTranslations('v2.common')
  const fmt = useFmt()
  // Ngày trong DANH SÁCH đọc theo locale giao diện giáo viên; ngày TRÊN PHIẾU thì theo ngôn ngữ phiếu.
  const formatDay = (iso: string | null) => (iso ? fmt.date(iso) : '—')

  const [period, setPeriod] = useState<ReportPeriod>('MIDTERM')
  const [lang, setLang] = useState<ReportLang>('vi')
  const [showPreview, setShowPreview] = useState(false)
  const [issuing, setIssuing] = useState(false)
  const [issued, setIssued] = useState<ReportIssueDetail | null>(null)
  const [history, setHistory] = useState<ReportIssueSummary[]>([])
  const [historyError, setHistoryError] = useState('')
  const [pdfBusy, setPdfBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  const loadHistory = useCallback(async () => {
    try {
      setHistory(await listReportIssues(classId, evaluation.studentId))
      setHistoryError('')
    } catch (e: unknown) {
      setHistoryError(apiMessage(e))
    }
  }, [classId, evaluation.studentId])

  // Mỗi lần mở lại: về trạng thái đầu. Giữ lại kết quả lần trước sẽ khiến giáo viên tưởng vừa phát
  // hành cho học viên đang chọn trong khi đó là phiếu của người khác.
  useEffect(() => {
    if (!open) return
    setIssued(null)
    setShowPreview(false)
    setCopied(false)
    void loadHistory()
  }, [open, loadHistory])

  const periodOptions: TkSegOption<ReportPeriod>[] = REPORT_PERIODS.map((p) => ({
    value: p,
    label: t(`period${p}`),
  }))
  const langOptions: TkSegOption<ReportLang>[] = REPORT_LANGS.map((l) => ({
    value: l,
    label: t(`lang${l}`),
  }))

  const activeSamePeriod = history.find((h) => h.period === period && h.status === ACTIVE_STATUS)
  const publicUrl = issued?.issue.publicPath ? reportPublicUrl(issued.issue.publicPath) : null

  const publish = async () => {
    setIssuing(true)
    try {
      const result = await issueReport(classId, evaluation.studentId, period, lang)
      setIssued(result)
      setShowPreview(false)
      toast.success(t('issueSuccess'))
      await loadHistory()
    } catch (e: unknown) {
      toast.error(apiMessage(e))
    } finally {
      setIssuing(false)
    }
  }

  const copyLink = async () => {
    if (!publicUrl) return
    try {
      await navigator.clipboard.writeText(publicUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error(t('copyError'))
    }
  }

  const savePdf = async () => {
    if (!issued) return
    setPdfBusy(true)
    try {
      const blob = await downloadReportPdf(issued.issue.id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `phieu-danh-gia-${issued.issue.period.toLowerCase()}-${issued.issue.verificationCode ?? issued.issue.id}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e: unknown) {
      toast.error(apiMessage(e))
    } finally {
      setPdfBusy(false)
    }
  }

  const previewPayload = buildPreviewPayload(evaluation, period, lang, new Date().toISOString())
  const dict = reportSheetDict(lang)

  return (
    <TkModal
      open={open}
      onOpenChange={(o) => { if (!issuing) onOpenChange(o) }}
      size="lg"
      title={t('title')}
      description={t('subtitle', { name: evaluation.name })}
      footer={
        issued ? (
          <GaBtn variant="primary" onClick={() => onOpenChange(false)}>{tc('close')}</GaBtn>
        ) : (
          <>
            <GaBtn variant="ghost" disabled={issuing} onClick={() => onOpenChange(false)}>{tc('cancel')}</GaBtn>
            <GaBtn variant="primary" loading={issuing} onClick={() => void publish()}>
              {activeSamePeriod ? t('reissueButton') : t('issueButton')}
            </GaBtn>
          </>
        )
      }
    >
      <div className="flex flex-col gap-5">
        {issued ? (
          <section className="border border-ga-green bg-ga-green-soft p-4">
            <GaCap className="mb-2 block">{t('resultCap')}</GaCap>
            <p className="m-0 text-ga-body leading-relaxed text-ga-ink">{t('resultHint')}</p>
            {publicUrl ? (
              <p className="m-0 mt-2.5 break-all border border-ga-line bg-ga-card px-3 py-2 font-mono text-ga-caption text-ga-ink">
                {publicUrl}
              </p>
            ) : null}
            <dl className="m-0 mt-2.5 flex flex-wrap gap-x-6 gap-y-1 text-ga-caption text-ga-muted">
              <div className="flex gap-1.5">
                <dt className="m-0">{t('verificationCodeLabel')}</dt>
                <dd className="m-0 font-mono font-semibold text-ga-ink">{issued.issue.verificationCode ?? '—'}</dd>
              </div>
              <div className="flex gap-1.5">
                <dt className="m-0">{t('expiresLabel')}</dt>
                <dd className="m-0 font-semibold text-ga-ink">{formatDay(issued.issue.tokenExpiresAt)}</dd>
              </div>
            </dl>
            <div className="mt-3 flex flex-wrap gap-2">
              <GaBtn variant="ghost" size="sm" disabled={!publicUrl} onClick={() => void copyLink()}>
                <GaIcon name={copied ? 'check' : 'link'} size={14} />
                {copied ? t('copied') : t('copyLink')}
              </GaBtn>
              <GaBtn variant="ghost" size="sm" loading={pdfBusy} onClick={() => void savePdf()}>
                <GaIcon name="description" size={14} /> {t('downloadPdf')}
              </GaBtn>
            </div>
          </section>
        ) : (
          <>
            <section>
              <GaCap className="mb-2 block">{t('periodCap')}</GaCap>
              <TkSeg options={periodOptions} value={period} onValueChange={setPeriod} aria-label={t('periodCap')} />
            </section>

            <section>
              <GaCap className="mb-2 block">{t('langCap')}</GaCap>
              <TkSeg options={langOptions} value={lang} onValueChange={setLang} aria-label={t('langCap')} />
              <p className="ga-ui m-0 mt-1.5 text-ga-caption leading-relaxed text-ga-muted">{t('langHint')}</p>
            </section>

            {activeSamePeriod ? (
              <p role="status" className="m-0 border border-ga-warning bg-ga-warning-soft px-3.5 py-2.5 text-ga-caption leading-relaxed text-ga-ink">
                {t('reissueWarning', { date: formatDay(activeSamePeriod.issuedAt) })}
              </p>
            ) : null}

            <section>
              <GaBtn variant="ghost" size="sm" onClick={() => setShowPreview((v) => !v)}>
                <GaIcon name="visibility" size={14} /> {showPreview ? t('hidePreview') : t('showPreview')}
              </GaBtn>
              {showPreview ? (
                <div className="mt-3 max-h-[420px] overflow-auto border border-ga-line bg-ga-bg">
                  <ReportSheet dict={dict} lang={lang} payload={previewPayload} header={previewHeader(evaluation)} preview />
                </div>
              ) : null}
            </section>
          </>
        )}

        <section>
          <GaCap className="mb-2 block">{t('historyCap')}</GaCap>
          {historyError ? (
            <p className="m-0 text-ga-caption text-ga-red">{historyError}</p>
          ) : history.length === 0 ? (
            <p className="m-0 text-ga-caption text-ga-muted">{t('historyEmpty')}</p>
          ) : (
            <ul className="m-0 list-none border border-ga-line bg-ga-card p-0">
              {history.map((row, i) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-ga-caption text-ga-ink"
                  style={{ borderTop: i ? '1px solid var(--ga-line)' : 'none' }}
                >
                  <span className="font-semibold">{t(`period${row.period}`)}</span>
                  <span className="text-ga-muted">{formatDay(row.issuedAt)}</span>
                  <StatusBadge status={row.status} label={t(`status${row.status}`)} />
                  <span className="text-ga-muted">{t('viewCount', { count: row.viewCount })}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </TkModal>
  )
}

function previewHeader(evaluation: StudentEvaluation) {
  return {
    orgName: null,
    orgLogoUrl: null,
    studentName: evaluation.name,
    issuedByName: null,
    verificationCode: null,
    issuedAt: new Date().toISOString(),
  }
}

const STATUS_TONE: Record<string, 'green' | 'yellow' | 'red' | 'neutral'> = {
  ACTIVE: 'green',
  EXPIRED: 'yellow',
  SUPERSEDED: 'neutral',
  REVOKED: 'red',
}

function StatusBadge({ status, label }: { status: string; label: string }) {
  return (
    <TkBadge tone={STATUS_TONE[status] ?? 'neutral'} variant="soft">
      {label}
    </TkBadge>
  )
}

