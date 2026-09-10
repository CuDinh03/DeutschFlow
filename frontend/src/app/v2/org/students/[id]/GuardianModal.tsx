'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { apiMessage } from '@/lib/api'
import {
  addStudentGuardian,
  updateStudentGuardian,
  type GuardianRelationship,
  type OrgStudentGuardian,
} from '@/lib/orgApi'
import { TkModal, GaBtn, GaCap, ErrorBanner } from '@/components/ui-v2'

/**
 * Thêm / sửa MỘT người giám hộ (R11, 10/09/2026). Đường sửa chỉ chạm thông tin liên lạc — bằng chứng
 * đồng ý đã thu nằm ở sổ khác, không bị ảnh hưởng (máy chủ: `MinorLearnerService.updateGuardian`).
 *
 * Không có nút xoá — cố ý, cùng lý do với sổ đồng ý: người giám hộ từng đồng ý mà biến mất khỏi bảng
 * thì dòng đồng ý mất câu trả lời "ai". Gõ nhầm người thì sửa lại thông tin trên chính dòng đó.
 *
 * Email giám hộ KHÔNG được trùng email học viên (R6/R11): đó là nơi nhận phiếu đánh giá. Kiểm sớm ở
 * đây bằng `studentEmail` để báo tại chỗ; máy chủ vẫn là thẩm quyền cuối (400
 * `GUARDIAN_EMAIL_IS_STUDENT_EMAIL`) — thiếu prop thì bỏ qua kiểm sớm, không bỏ qua chốt của máy chủ.
 */

const INPUT_CLS =
  'ga-ui mt-1 w-full rounded-ga border border-ga-line bg-ga-card px-3 py-2 text-ga-small text-ga-ink outline-none placeholder:text-ga-subtle focus:border-ga-accent'
const RELATIONSHIPS: GuardianRelationship[] = ['MOTHER', 'FATHER', 'LEGAL_GUARDIAN', 'OTHER']
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function GuardianModal({
  studentId,
  studentEmail,
  existing,
  hasGuardians,
  onClose,
  onSaved,
}: {
  studentId: number
  /** Email học viên — để chặn sớm email giám hộ trùng (máy chủ vẫn chặn khi thiếu). */
  studentEmail?: string | null
  /** Có = sửa; không = thêm. */
  existing: OrgStudentGuardian | null
  /** Học viên đã có người giám hộ nào chưa — quyết định mặc định "người liên lạc chính" khi thêm. */
  hasGuardians: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const t = useTranslations('v2.org.studentDetail.minor')
  const [fullName, setFullName] = useState(existing?.fullName ?? '')
  const [relationship, setRelationship] = useState<GuardianRelationship>(existing?.relationship ?? 'MOTHER')
  const [phone, setPhone] = useState(existing?.phone ?? '')
  const [email, setEmail] = useState(existing?.email ?? '')
  const [primary, setPrimary] = useState(existing ? existing.primary : !hasGuardians)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    setError('')
    const name = fullName.trim()
    const ph = phone.trim()
    const em = email.trim().toLowerCase()
    // Cùng chốt với máy chủ (chk_student_guardians_contactable): phải liên lạc được bằng ít nhất một đường.
    if (!name || (!ph && !em) || (em && !EMAIL_RE.test(em))) {
      setError(t('guardianModal.invalid'))
      return
    }
    if (em && studentEmail && em === studentEmail.trim().toLowerCase()) {
      setError(t('guardianModal.emailIsStudent'))
      return
    }
    setSaving(true)
    try {
      const body = { fullName: name, relationship, phone: ph || undefined, email: em || undefined, primary }
      if (existing) await updateStudentGuardian(studentId, existing.id, body)
      else await addStudentGuardian(studentId, body)
      toast.success(t('guardianModal.saved', { name }))
      onSaved()
      onClose()
    } catch (e: unknown) {
      setError(apiMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <TkModal
      open
      onOpenChange={(o) => !o && onClose()}
      size="md"
      title={existing ? t('guardianModal.titleEdit') : t('guardianModal.titleAdd')}
      description={t('guardianModal.description')}
      footer={
        <>
          <GaBtn variant="ghost" onClick={onClose}>{t('guardianModal.cancel')}</GaBtn>
          <GaBtn variant="primary" loading={saving} onClick={submit} data-testid="guardian-submit">
            {t('guardianModal.submit')}
          </GaBtn>
        </>
      }
    >
      {error && <ErrorBanner className="mb-4" message={error} />}

      <div className="space-y-4">
        <label className="block">
          <GaCap>{t('guardianModal.nameLabel')}</GaCap>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={INPUT_CLS} aria-label={t('guardianModal.nameLabel')} autoComplete="off" />
        </label>
        <label className="block">
          <GaCap>{t('guardianModal.relationshipLabel')}</GaCap>
          <select value={relationship} onChange={(e) => setRelationship(e.target.value as GuardianRelationship)} className={INPUT_CLS} aria-label={t('guardianModal.relationshipLabel')}>
            {RELATIONSHIPS.map((r) => (
              <option key={r} value={r}>{t(`relationship.${r}`)}</option>
            ))}
          </select>
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <GaCap>{t('guardianModal.phoneLabel')}</GaCap>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className={INPUT_CLS} aria-label={t('guardianModal.phoneLabel')} inputMode="tel" autoComplete="off" />
          </label>
          <label className="block">
            <GaCap>{t('guardianModal.emailLabel')}</GaCap>
            <input value={email} onChange={(e) => setEmail(e.target.value)} className={INPUT_CLS} aria-label={t('guardianModal.emailLabel')} type="email" autoComplete="off" />
          </label>
        </div>
        <label className="ga-ui flex items-center gap-2 text-ga-small text-ga-ink">
          <input type="checkbox" checked={primary} onChange={(e) => setPrimary(e.target.checked)} aria-label={t('guardianModal.primaryLabel')} />
          {t('guardianModal.primaryLabel')}
        </label>
        <p className="ga-ui text-ga-caption text-ga-subtle">{t('guardianModal.contactHint')}</p>
      </div>
    </TkModal>
  )
}
