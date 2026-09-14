'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { apiMessage } from '@/lib/api'
import { getStudentBirthDate, setStudentBirthDate, type OrgStudentBirthDate } from '@/lib/orgApi'
import { TkModal, GaBtn, GaCap, ErrorBanner } from '@/components/ui-v2'

/**
 * Đặt / sửa ngày sinh của một học viên (Q-02/Q-05/Q-07, owner chốt 14/09/2026).
 *
 * Đây là đường DUY NHẤT sửa được một ngày sinh đã ghi. Trước bản này giá trị chỉ vào được qua cột
 * CSV và chỉ vào được một lần: gõ nhầm là khoá nhầm phần luyện nói của một em cho tới hết khoá học.
 *
 * Hai thứ modal này cố ý nói thẳng, vì chúng là cái giá của quyền sửa:
 * - **học viên sẽ nhận thông báo** — người bị sửa phải biết mình bị sửa;
 * - **nhóm tuổi đổi thì quyền đổi theo** — hạ tuổi xuống dưới 18 là khoá phần nói cho tới khi trung
 *   tâm ghi nhận phiếu đồng ý của người giám hộ.
 *
 * Giá trị hiện tại tải KHI MỞ (`getStudentBirthDate`) chứ không lấy từ trang cha: `OrgStudentDetail`
 * cố ý chỉ mang nhóm tuổi, không mang ngày sinh thô.
 */

const INPUT_CLS =
  'ga-ui mt-1 w-full rounded-ga border border-ga-line bg-ga-card px-3 py-2 text-ga-small text-ga-ink outline-none placeholder:text-ga-subtle focus:border-ga-accent'
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function BirthDateModal({
  studentId,
  onClose,
  onSaved,
}: {
  studentId: number
  onClose: () => void
  onSaved: () => void
}) {
  const t = useTranslations('v2.org.studentDetail.minor')
  const [current, setCurrent] = useState<OrgStudentBirthDate | null>(null)
  const [value, setValue] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const data = await getStudentBirthDate(studentId)
        if (!alive) return
        setCurrent(data)
        setValue(data.birthDate ?? '')
      } catch (e: unknown) {
        if (alive) setError(apiMessage(e))
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [studentId])

  const submit = async () => {
    setError('')
    const iso = value.trim()
    // Cùng hai chốt với máy chủ: đúng định dạng, và không ở tương lai. Kiểm sớm để người dùng biết
    // ngay tại ô nhập; máy chủ vẫn là thẩm quyền cuối.
    if (!ISO_DATE_RE.test(iso) || Number.isNaN(Date.parse(iso))) {
      setError(t('birthDateModal.invalid'))
      return
    }
    if (iso > new Date().toISOString().slice(0, 10)) {
      setError(t('birthDateModal.future'))
      return
    }
    setSaving(true)
    try {
      const saved = await setStudentBirthDate(studentId, iso)
      toast.success(t('birthDateModal.saved'))
      setCurrent(saved)
      onSaved()
      onClose()
    } catch (e: unknown) {
      setError(apiMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const isEdit = Boolean(current?.birthDate)

  return (
    <TkModal
      open
      onOpenChange={(o) => !o && onClose()}
      size="md"
      title={isEdit ? t('birthDateModal.titleEdit') : t('birthDateModal.titleAdd')}
      description={t('birthDateModal.description')}
      footer={
        <>
          <GaBtn variant="ghost" onClick={onClose}>{t('birthDateModal.cancel')}</GaBtn>
          <GaBtn variant="primary" loading={saving} disabled={loading} onClick={submit} data-testid="birth-date-submit">
            {t('birthDateModal.submit')}
          </GaBtn>
        </>
      }
    >
      {error && <ErrorBanner className="mb-4" message={error} />}

      {loading ? (
        <div className="ga-shimmer h-[64px] border border-ga-line" aria-hidden />
      ) : (
        <div className="space-y-4">
          <label className="block">
            <GaCap>{t('birthDateModal.label')}</GaCap>
            <input
              type="date"
              value={value}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setValue(e.target.value)}
              className={INPUT_CLS}
              aria-label={t('birthDateModal.label')}
              data-testid="birth-date-input"
            />
          </label>

          {current?.recordedAt && (
            <p className="ga-ui text-ga-caption text-ga-muted" data-testid="birth-date-provenance">
              {t('birthDateModal.recordedBy', {
                name: current.recordedByName ?? t('birthDateModal.unknownRecorder'),
                at: format(new Date(current.recordedAt), 'dd/MM/yyyy HH:mm'),
              })}
            </p>
          )}

          {/* Hai câu này là cái giá của quyền sửa — không giấu trong tooltip. */}
          <p className="ga-ui text-ga-caption text-ga-subtle" data-testid="birth-date-notice-hint">
            {t('birthDateModal.noticeHint')}
          </p>
          <p className="ga-ui text-ga-caption text-ga-subtle">{t('birthDateModal.gateHint')}</p>
        </div>
      )}
    </TkModal>
  )
}
