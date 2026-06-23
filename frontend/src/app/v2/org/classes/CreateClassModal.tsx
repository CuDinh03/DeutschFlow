'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { apiMessage } from '@/lib/api'
import { createOrgClass, listMembers, type OrgMember } from '@/lib/orgApi'
import { TkModal, GaBtn, GaCap, ErrorBanner } from '@/components/ui-v2'

/**
 * Org-admin (OWNER/MANAGER) tạo lớp cho trung tâm (G-3 follow-up).
 * teacher_id là NOT NULL nên phải chọn giáo viên phụ trách — dropdown nạp từ listMembers('TEACHER')
 * (chỉ giáo viên ACTIVE của chính org). Nếu org chưa có giáo viên thì chặn tạo + hướng dẫn thêm GV trước.
 */

const INPUT_CLS =
  'ga-ui mt-1 w-full rounded-ga border border-ga-line bg-ga-card px-3 py-2 text-[13px] text-ga-ink outline-none placeholder:text-ga-subtle focus:border-ga-accent'

export function CreateClassModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('')
  const [teacherId, setTeacherId] = useState('')
  const [teachers, setTeachers] = useState<OrgMember[]>([])
  const [loadingTeachers, setLoadingTeachers] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setLoadingTeachers(true)
    listMembers('TEACHER')
      .then((ts) => {
        if (!active) return
        const activeTeachers = ts.filter((t) => t.status === 'ACTIVE')
        setTeachers(activeTeachers)
        if (activeTeachers.length === 1) setTeacherId(String(activeTeachers[0].userId))
      })
      .catch((e: unknown) => active && setError(apiMessage(e)))
      .finally(() => active && setLoadingTeachers(false))
    return () => {
      active = false
    }
  }, [])

  const submit = async () => {
    setError('')
    if (!name.trim()) {
      setError('Nhập tên lớp.')
      return
    }
    if (!teacherId) {
      setError('Chọn giáo viên phụ trách.')
      return
    }
    setSaving(true)
    try {
      await createOrgClass({ name: name.trim(), teacherId: Number(teacherId) })
      toast.success(`Đã tạo lớp ${name.trim()}.`)
      onCreated()
      onClose()
    } catch (e: unknown) {
      setError(apiMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const noTeachers = !loadingTeachers && teachers.length === 0

  return (
    <TkModal
      open
      onOpenChange={(o) => !o && onClose()}
      size="md"
      title="Tạo lớp"
      description="Tạo lớp cho trung tâm và gán giáo viên phụ trách"
      footer={
        <>
          <GaBtn variant="ghost" onClick={onClose}>
            Hủy
          </GaBtn>
          <GaBtn variant="primary" loading={saving} disabled={noTeachers} onClick={submit}>
            Tạo lớp
          </GaBtn>
        </>
      }
    >
      {error && <ErrorBanner className="mb-4" message={error} />}

      {noTeachers ? (
        <div className="border border-dashed border-ga-line px-6 py-8 text-center text-[13.5px] text-ga-muted">
          Trung tâm chưa có giáo viên nào. Hãy thêm giáo viên trước rồi mới tạo lớp.
        </div>
      ) : (
        <div className="space-y-4">
          <label className="block">
            <GaCap>Tên lớp</GaCap>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              placeholder="VD: A1.1 — Tối T2-T4-T6"
              className={INPUT_CLS}
            />
          </label>
          <label className="block">
            <GaCap>Giáo viên phụ trách</GaCap>
            <select
              value={teacherId}
              onChange={(e) => setTeacherId(e.target.value)}
              disabled={loadingTeachers}
              className={INPUT_CLS}
            >
              <option value="" disabled>
                {loadingTeachers ? 'Đang tải giáo viên…' : 'Chọn giáo viên…'}
              </option>
              {teachers.map((t) => (
                <option key={t.userId} value={t.userId}>
                  {t.displayName || t.email}
                </option>
              ))}
            </select>
            <p className="ga-ui mt-1 text-[12px] text-ga-subtle">
              Lớp sẽ thuộc về trung tâm và do giáo viên này phụ trách.
            </p>
          </label>
        </div>
      )}
    </TkModal>
  )
}
