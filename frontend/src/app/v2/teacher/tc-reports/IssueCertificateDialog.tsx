'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { apiMessage } from '@/lib/api'
import {
  CERTIFICATE_LEVELS,
  certificateVerifyUrl,
  issueCertificate,
  type Certificate,
  type CefrLevel,
} from '@/lib/certificateApi'
import type { StudentEvaluation } from '@/lib/teacherEvaluationApi'
import { GaBtn, GaCap, GaIcon, TkModal, TkSeg, type TkSegOption } from '@/components/ui-v2'

/**
 * Cấp chứng nhận hoàn thành khoá học (đợt 4A A+B+E). Nút chỉ hiện khi học viên đã đạt ngưỡng của trung
 * tâm; máy chủ kiểm lại ngưỡng, trùng giấy và đồng ý của người giám hộ, thông điệp 409 hiện nguyên văn.
 *
 * Không có ô điểm: giấy xác nhận hoàn thành khoá học, không xác nhận trình độ. Trình độ không có giá
 * trị mặc định vì giấy đã cấp chỉ thu hồi được chứ không sửa được, nên giáo viên phải tự chọn.
 */
const NOTE_MAX = 500

export interface IssueCertificateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  classId: number
  evaluation: StudentEvaluation
}

export function IssueCertificateDialog({ open, onOpenChange, classId, evaluation }: IssueCertificateDialogProps) {
  const t = useTranslations('v2.teacher.tcReports.certificateIssue')
  const tc = useTranslations('v2.common')

  const [level, setLevel] = useState<CefrLevel | ''>('')
  const [note, setNote] = useState('')
  const [issuing, setIssuing] = useState(false)
  const [issued, setIssued] = useState<Certificate | null>(null)

  const options: TkSegOption<CefrLevel | ''>[] = CERTIFICATE_LEVELS.map((value) => ({ value, label: value }))
  const verifyUrl = issued ? certificateVerifyUrl(issued.verifyToken) : ''

  const submit = async (): Promise<void> => {
    if (!level) return
    setIssuing(true)
    try {
      const cert = await issueCertificate({
        classId,
        studentId: evaluation.studentId,
        cefrLevel: level,
        note: note.trim() === '' ? null : note.trim(),
      })
      setIssued(cert)
      toast.success(t('success', { code: cert.certificateCode }))
    } catch (e) {
      toast.error(apiMessage(e))
    } finally {
      setIssuing(false)
    }
  }

  const copyLink = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(verifyUrl)
      toast.success(t('copied'))
    } catch {
      toast.error(t('copyFailed'))
    }
  }

  return (
    <TkModal
      open={open}
      onOpenChange={onOpenChange}
      size="sm"
      title={t('title', { name: evaluation.name })}
      description={issued ? undefined : t('description')}
      footer={
        issued ? (
          <GaBtn type="button" variant="primary" onClick={() => onOpenChange(false)}>{t('close')}</GaBtn>
        ) : (
          <>
            <GaBtn type="button" variant="ghost" onClick={() => onOpenChange(false)}>{tc('cancel')}</GaBtn>
            <GaBtn type="button" variant="primary" loading={issuing} disabled={!level} onClick={() => void submit()}>
              {t('submit')}
            </GaBtn>
          </>
        )
      }
    >
      {issued ? (
        <div>
          <p className="text-ga-body font-semibold text-ga-ink">{t('doneTitle', { code: issued.certificateCode })}</p>
          <p className="mt-1 text-ga-small text-ga-muted">{t('doneBody')}</p>
          <p className="mt-2 break-all font-mono text-ga-caption text-ga-ink">{verifyUrl}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <GaBtn type="button" variant="ghost" size="sm" onClick={() => void copyLink()}>
              <GaIcon name="content_copy" size={13} /> {t('copyLink')}
            </GaBtn>
            <GaBtn
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => window.open(verifyUrl, '_blank', 'noopener,noreferrer')}
            >
              <GaIcon name="open_in_new" size={13} /> {t('open')}
            </GaBtn>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div>
            <GaCap className="mb-2 block">{t('levelLabel')}</GaCap>
            <TkSeg options={options} value={level} onValueChange={setLevel} aria-label={t('levelLabel')} />
          </div>
          <div>
            <label className="mb-1 block text-ga-caption font-medium text-ga-muted" htmlFor="certificate-note">
              {t('noteLabel')}
            </label>
            <textarea
              id="certificate-note"
              rows={3}
              maxLength={NOTE_MAX}
              placeholder={t('notePlaceholder')}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full resize-none rounded-ga border border-ga-line bg-ga-bg px-3 py-2 text-ga-small text-ga-ink outline-none focus:border-ga-accent"
            />
            <p className="ga-ui mt-1 text-ga-caption text-ga-muted">{t('noteHint')}</p>
          </div>
        </div>
      )}
    </TkModal>
  )
}
