'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { apiMessage } from '@/lib/api'
import {
  recordStudentConsent,
  type ConsentMethod,
  type ConsentScope,
  type OrgStudentGuardian,
} from '@/lib/orgApi'
import { TkModal, GaBtn, GaCap, ErrorBanner, ConfirmDialog } from '@/components/ui-v2'

/**
 * Ghi THÊM một dòng vào sổ đồng ý (D1, 10/09/2026): cấp (`mode: 'grant'`, mặc định phiếu giấy cho
 * phạm vi ghi âm) hoặc thu hồi (`mode: 'revoke'`). Hai mode chung một form vì cùng một bản ghi ở
 * máy chủ — chỉ khác `action`.
 *
 * Bước xác nhận bằng `ConfirmDialog` nêu HỆ QUẢ (F-DEL): sổ chỉ ghi thêm, không sửa/xoá được dòng đã
 * ghi; thu hồi khoá lại phần luyện nói của học viên ngay lập tức. Không dùng `window.confirm`.
 *
 * Ngày hiệu lực: ô `date` (ngày ký giấy). Chọn hôm nay ⇒ KHÔNG gửi `effectiveAt` để máy chủ lấy
 * "bây giờ" — gửi giữa trưa hôm nay lúc 9 giờ sáng là "đồng ý ở tương lai" và bị máy chủ từ chối.
 * Ngày quá khứ ⇒ gửi 12:00 giờ máy để không lệch ngày qua múi giờ.
 */

const INPUT_CLS =
  'ga-ui mt-1 w-full rounded-ga border border-ga-line bg-ga-card px-3 py-2 text-ga-small text-ga-ink outline-none placeholder:text-ga-subtle focus:border-ga-accent'
const SCOPES: ConsentScope[] = ['AUDIO_RECORDING', 'AI_PROCESSING', 'DATA_PROCESSING', 'MESSAGING']
const METHODS: ConsentMethod[] = ['PAPER', 'PHONE', 'EMAIL', 'IN_APP']
const NOTE_MAX = 255

function todayIso(): string {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

/** `undefined` khi là hôm nay (máy chủ lấy bây giờ); ngày quá khứ → 12:00 giờ máy, ISO UTC. */
export function effectiveAtFor(dateIso: string): string | undefined {
  if (!dateIso || dateIso === todayIso()) return undefined
  return new Date(`${dateIso}T12:00:00`).toISOString()
}

export function ConsentModal({
  studentId,
  mode,
  guardians,
  onClose,
  onSaved,
}: {
  studentId: number
  mode: 'grant' | 'revoke'
  guardians: OrgStudentGuardian[]
  onClose: () => void
  onSaved: () => void
}) {
  const t = useTranslations('v2.org.studentDetail.minor')
  const primary = guardians.find((g) => g.primary) ?? guardians[0]
  const [scope, setScope] = useState<ConsentScope>('AUDIO_RECORDING')
  const [method, setMethod] = useState<ConsentMethod>(mode === 'grant' ? 'PAPER' : 'PHONE')
  const [guardianId, setGuardianId] = useState<string>(primary ? String(primary.id) : '')
  const [date, setDate] = useState(todayIso())
  const [note, setNote] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const isGrant = mode === 'grant'

  const askConfirm = () => {
    setError('')
    if (!date || date > todayIso()) {
      setError(t('consentModal.invalidDate'))
      return
    }
    setConfirming(true)
  }

  const submit = async () => {
    setSaving(true)
    try {
      await recordStudentConsent(studentId, {
        scope,
        action: isGrant ? 'GRANTED' : 'REVOKED',
        method,
        guardianId: guardianId ? Number(guardianId) : undefined,
        effectiveAt: effectiveAtFor(date),
        note: note.trim() || undefined,
      })
      toast.success(isGrant ? t('consentModal.saved') : t('consentModal.revoked'))
      onSaved()
      onClose()
    } catch (e: unknown) {
      setConfirming(false)
      setError(apiMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <TkModal
        open
        onOpenChange={(o) => !o && !confirming && onClose()}
        size="md"
        title={isGrant ? t('consentModal.titleGrant') : t('consentModal.titleRevoke')}
        description={t('consentModal.description')}
        footer={
          <>
            <GaBtn variant="ghost" onClick={onClose}>{t('consentModal.cancel')}</GaBtn>
            <GaBtn variant={isGrant ? 'primary' : 'ink'} onClick={askConfirm} data-testid="consent-submit">
              {isGrant ? t('consentModal.submitGrant') : t('consentModal.submitRevoke')}
            </GaBtn>
          </>
        }
      >
        {error && <ErrorBanner className="mb-4" message={error} />}

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <GaCap>{t('consentModal.scopeLabel')}</GaCap>
              <select value={scope} onChange={(e) => setScope(e.target.value as ConsentScope)} className={INPUT_CLS} aria-label={t('consentModal.scopeLabel')}>
                {SCOPES.map((s) => <option key={s} value={s}>{t(`scope.${s}`)}</option>)}
              </select>
            </label>
            <label className="block">
              <GaCap>{t('consentModal.methodLabel')}</GaCap>
              <select value={method} onChange={(e) => setMethod(e.target.value as ConsentMethod)} className={INPUT_CLS} aria-label={t('consentModal.methodLabel')}>
                {METHODS.map((m) => <option key={m} value={m}>{t(`method.${m}`)}</option>)}
              </select>
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <GaCap>{t('consentModal.effectiveAtLabel')}</GaCap>
              <input type="date" value={date} max={todayIso()} onChange={(e) => setDate(e.target.value)} className={INPUT_CLS} aria-label={t('consentModal.effectiveAtLabel')} />
              <p className="ga-ui mt-1 text-ga-caption text-ga-subtle">{t('consentModal.effectiveAtHint')}</p>
            </label>
            <label className="block">
              <GaCap>{t('consentModal.guardianLabel')}</GaCap>
              <select value={guardianId} onChange={(e) => setGuardianId(e.target.value)} className={INPUT_CLS} aria-label={t('consentModal.guardianLabel')}>
                <option value="">{t('consentModal.guardianNone')}</option>
                {guardians.map((g) => (
                  <option key={g.id} value={g.id}>{g.fullName} — {t(`relationship.${g.relationship}`)}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="block">
            <GaCap>{t('consentModal.noteLabel')}</GaCap>
            <input value={note} maxLength={NOTE_MAX} onChange={(e) => setNote(e.target.value)} className={INPUT_CLS} aria-label={t('consentModal.noteLabel')} autoComplete="off" />
          </label>
          <p className="ga-ui text-ga-caption text-ga-subtle">{t('consentModal.termsHint')}</p>
        </div>
      </TkModal>

      {confirming && (
        <ConfirmDialog
          open
          onOpenChange={(o) => { if (!o) setConfirming(false) }}
          title={isGrant ? t('consentModal.confirmGrantTitle') : t('consentModal.confirmRevokeTitle')}
          description={isGrant
            ? t('consentModal.confirmGrantDesc', { scope: t(`scope.${scope}`) })
            : t('consentModal.confirmRevokeDesc', { scope: t(`scope.${scope}`) })}
          details={isGrant
            ? [t('consentModal.confirmDetailAppendOnly'), t('consentModal.confirmGrantDetailOpen')]
            : [t('consentModal.confirmRevokeDetailLock'), t('consentModal.confirmDetailAppendOnly')]}
          confirmLabel={isGrant ? t('consentModal.submitGrant') : t('consentModal.submitRevoke')}
          cancelLabel={t('consentModal.cancel')}
          destructive={!isGrant}
          loading={saving}
          onConfirm={() => void submit()}
        />
      )}
    </>
  )
}
