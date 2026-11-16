'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { apiMessage } from '@/lib/api'
import {
  getOrgPracticeProgram,
  saveOrgPracticeProgram,
  type OrgPracticeProgram,
} from '@/lib/orgApi'
import { GaBtn, GaCap, GaInput } from '@/components/ui-v2'

// Chương trình luyện của lớp (đặc tả luyendeu ORG-50/51/65): ngày bắt đầu (thứ Hai), số tuần, chỉ tiêu
// phiên/tuần, số tuần đạt yêu cầu. Khai xong thì học viên ACTIVE của lớp chỉ luyện bằng giọng nói đến hết
// chương trình. Sau tuần 1 khoá ngày bắt đầu, chỉ tiêu, số tuần yêu cầu (backend trả 409).

const fmt = (d: string) => {
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

const isMonday = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && new Date(`${d}T00:00:00Z`).getUTCDay() === 1

export function PracticeProgramCard({ classId }: { classId: number }) {
  const t = useTranslations('v2.org.classDetail.practiceProgram')
  const [program, setProgram] = useState<OrgPracticeProgram | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ startDate: '', weeks: 6, targetPerWeek: 3, weeksRequired: 4 })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setProgram(await getOrgPracticeProgram(classId))
      setLoadError('')
    } catch (e: unknown) {
      setLoadError(apiMessage(e))
    } finally {
      setLoading(false)
    }
  }, [classId])
  useEffect(() => { void load() }, [load])

  const openEditor = () => {
    setForm(program
      ? { startDate: program.startDate, weeks: program.weeks, targetPerWeek: program.targetPerWeek, weeksRequired: program.weeksRequired }
      : { startDate: '', weeks: 6, targetPerWeek: 3, weeksRequired: 4 })
    setEditing(true)
  }

  const startInvalid = form.startDate !== '' && !isMonday(form.startDate)
  const canSave = isMonday(form.startDate) && form.weeks >= 1 && form.weeks <= 12
    && form.targetPerWeek >= 1 && form.targetPerWeek <= 14
    && form.weeksRequired >= 1 && form.weeksRequired <= form.weeks

  const save = async () => {
    setSaving(true)
    try {
      setProgram(await saveOrgPracticeProgram(classId, form))
      setEditing(false)
      toast.success(t('saved'))
    } catch (e: unknown) {
      toast.error(apiMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const locked = !!program?.locked
  const num = (key: 'weeks' | 'targetPerWeek' | 'weeksRequired', min: number, max: number, disabled: boolean) => (
    <label className="flex flex-col gap-1">
      <span className="text-[12px] text-ga-muted">{t(`field.${key}`)}</span>
      <GaInput
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={form[key]}
        disabled={disabled}
        onChange={(e) => setForm((f) => ({ ...f, [key]: Number(e.target.value) }))}
        data-testid={`practice-${key}`}
      />
    </label>
  )

  return (
    <div className="border border-ga-line bg-ga-card p-4 lg:p-[22px]" data-testid="practice-program-card">
      <GaCap className="mb-3.5 block">{t('cap')}</GaCap>
      {loading ? (
        <div className="ga-shimmer h-[60px] border border-ga-line" aria-hidden />
      ) : loadError ? (
        <div className="flex flex-col gap-2">
          <p className="text-[12.5px] text-ga-red">{t('loadError')}</p>
          <GaBtn variant="ghost" size="sm" onClick={load}>{t('retry')}</GaBtn>
        </div>
      ) : editing ? (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[12px] text-ga-muted">{t('field.startDate')}</span>
            <GaInput
              type="date"
              value={form.startDate}
              invalid={startInvalid}
              disabled={locked}
              onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
              data-testid="practice-startDate"
            />
            {startInvalid && <span className="text-[11.5px] text-ga-red">{t('mustBeMonday')}</span>}
          </label>
          <div className="grid grid-cols-3 gap-2">
            {num('weeks', 1, 12, false)}
            {num('targetPerWeek', 1, 14, locked)}
            {num('weeksRequired', 1, form.weeks, locked)}
          </div>
          {locked && <p className="text-[11.5px] text-ga-muted">{t('lockedNote')}</p>}
          <p className="text-[11.5px] text-ga-muted">{t('speakOnlyNote')}</p>
          <div className="flex gap-2">
            <GaBtn variant="primary" size="sm" disabled={!canSave || saving} onClick={() => void save()} data-testid="practice-save">
              {saving ? t('saving') : t('save')}
            </GaBtn>
            <GaBtn variant="ghost" size="sm" disabled={saving} onClick={() => setEditing(false)}>{t('cancel')}</GaBtn>
          </div>
        </div>
      ) : program ? (
        <div className="flex flex-col gap-2 text-[13px] text-ga-ink">
          <p>{t('summary', { start: fmt(program.startDate), end: fmt(program.endDate), weeks: program.weeks })}</p>
          <p>{t('target', { target: program.targetPerWeek, required: program.weeksRequired, weeks: program.weeks })}</p>
          <p className="text-[12px] text-ga-muted">
            {program.currentWeek === 0
              ? t('notStarted')
              : program.currentWeek > program.weeks
                ? t('ended')
                : t('running', { week: program.currentWeek, weeks: program.weeks })}
          </p>
          <GaBtn variant="ghost" size="sm" onClick={openEditor}>{t('edit')}</GaBtn>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-[12.5px] text-ga-muted">{t('empty')}</p>
          <GaBtn variant="primary" size="sm" onClick={openEditor} data-testid="practice-create">{t('create')}</GaBtn>
        </div>
      )}
    </div>
  )
}
