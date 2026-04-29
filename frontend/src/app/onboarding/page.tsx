'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'

type FieldErrors = Record<string, string>

type GoalType = 'WORK' | 'CERT'
type Cefr = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'
type Current = 'A0' | Cefr
type AgeRange = 'UNDER_18' | 'AGE_18_24' | 'AGE_25_34' | 'AGE_35_44' | 'AGE_45_PLUS'
type LearningSpeed = 'SLOW' | 'NORMAL' | 'FAST'

const INTEREST_IDS = ['TRAVEL', 'BUSINESS', 'TECH', 'HEALTH', 'EDUCATION'] as const
const AGE_OPTIONS: AgeRange[] = ['UNDER_18', 'AGE_18_24', 'AGE_25_34', 'AGE_35_44', 'AGE_45_PLUS']

export default function OnboardingPage() {
  const t = useTranslations('onboarding')
  const router = useRouter()

  const [form, setForm] = useState({
    goalType: 'WORK' as GoalType,
    targetLevel: 'A1' as Cefr,
    currentLevel: 'A0' as Current,
    ageRange: 'AGE_25_34' as AgeRange,
    industry: '',
    interests: [] as string[],
    learningSpeed: 'NORMAL' as LearningSpeed,
    sessionsPerWeek: 4,
    minutesPerSession: 25,
    examType: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  const weeklyMinutes = useMemo(
    () => Number(form.sessionsPerWeek) * Number(form.minutesPerSession),
    [form.sessionsPerWeek, form.minutesPerSession]
  )

  const interestLabel = (id: (typeof INTEREST_IDS)[number]) => t(`interestsLabels.${id}` as never)

  const ageOptionLabel = (value: AgeRange) => t(`age_${value}` as never)

  const toggleInterest = (id: string) => {
    setForm((f) => ({
      ...f,
      interests: f.interests.includes(id) ? f.interests.filter((x) => x !== id) : [...f.interests, id],
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setFieldErrors({})

    try {
      await api.post('/onboarding/profile', {
        goalType: form.goalType,
        targetLevel: form.targetLevel,
        currentLevel: form.currentLevel,
        ageRange: form.ageRange,
        interests: form.interests,
        industry: form.industry || null,
        examType: form.goalType === 'CERT' ? form.examType || null : null,
        sessionsPerWeek: Number(form.sessionsPerWeek),
        minutesPerSession: Number(form.minutesPerSession),
        learningSpeed: form.learningSpeed,
      })
      router.push('/student')
    } catch (err: unknown) {
      const res = (err as { response?: { data?: { detail?: string; errors?: FieldErrors } } })?.response?.data
      if (res?.errors) setFieldErrors(res.errors)
      else setError(res?.detail ?? t('error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-shell">
      <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary-hover to-navy-blue-dark opacity-5 pointer-events-none" />

      <div className="relative w-full max-w-2xl">
        <div className="auth-card">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
            <p className="text-muted-foreground mt-1">{t('subtitle')}</p>
          </div>

          {error && (
            <div className="mb-6 alert-error">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="form-grid-2">
              <div className="form-field">
                <label className="label">{t('goalType')}</label>
                <select
                  value={form.goalType}
                  onChange={(e) => setForm((f) => ({ ...f, goalType: e.target.value as GoalType }))}
                  className="input"
                >
                  <option value="WORK">{t('goalWork')}</option>
                  <option value="CERT">{t('goalCert')}</option>
                </select>
              </div>

              <div className="form-field">
                <label className="label">{t('targetLevel')}</label>
                <select
                  value={form.targetLevel}
                  onChange={(e) => setForm((f) => ({ ...f, targetLevel: e.target.value as Cefr }))}
                  className="input"
                >
                  {(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as Cefr[]).map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-field">
                <label className="label">{t('currentLevel')}</label>
                <select
                  value={form.currentLevel}
                  onChange={(e) => setForm((f) => ({ ...f, currentLevel: e.target.value as Current }))}
                  className="input"
                >
                  {(['A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as Current[]).map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-field">
                <label className="label">{t('ageRange')}</label>
                <select
                  value={form.ageRange}
                  onChange={(e) => setForm((f) => ({ ...f, ageRange: e.target.value as AgeRange }))}
                  className="input"
                >
                  {AGE_OPTIONS.map((value) => (
                    <option key={value} value={value}>
                      {ageOptionLabel(value)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2 form-field">
                <label className="label">{t('industry')}</label>
                <input
                  value={form.industry}
                  onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))}
                  className={`input ${fieldErrors.industry ? 'border-destructive focus:ring-destructive' : ''}`}
                  placeholder={t('industryPlaceholder')}
                />
                {fieldErrors.industry && <p className="form-error">{fieldErrors.industry}</p>}
              </div>
            </div>

            <div className="form-field">
              <label className="label">{t('interests')}</label>
              <div className="grid sm:grid-cols-2 gap-3">
                {INTEREST_IDS.map((id) => (
                  <label key={id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-background">
                    <input
                      type="checkbox"
                      checked={form.interests.includes(id)}
                      onChange={() => toggleInterest(id)}
                    />
                    <span className="text-sm text-foreground">{interestLabel(id)}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="form-grid-3">
              <div className="form-field">
                <label className="label">{t('sessionsPerWeek')}</label>
                <input
                  type="number"
                  min={1}
                  max={14}
                  value={form.sessionsPerWeek}
                  onChange={(e) => setForm((f) => ({ ...f, sessionsPerWeek: Number(e.target.value) }))}
                  className={`input ${fieldErrors.sessionsPerWeek ? 'border-destructive focus:ring-destructive' : ''}`}
                />
                {fieldErrors.sessionsPerWeek && <p className="form-error">{fieldErrors.sessionsPerWeek}</p>}
              </div>

              <div className="form-field">
                <label className="label">{t('minutesPerSession')}</label>
                <input
                  type="number"
                  min={5}
                  max={180}
                  value={form.minutesPerSession}
                  onChange={(e) => setForm((f) => ({ ...f, minutesPerSession: Number(e.target.value) }))}
                  className={`input ${fieldErrors.minutesPerSession ? 'border-destructive focus:ring-destructive' : ''}`}
                />
                {fieldErrors.minutesPerSession && <p className="form-error">{fieldErrors.minutesPerSession}</p>}
              </div>

              <div className="form-field">
                <label className="label">{t('learningSpeed')}</label>
                <select
                  value={form.learningSpeed}
                  onChange={(e) => setForm((f) => ({ ...f, learningSpeed: e.target.value as LearningSpeed }))}
                  className="input"
                >
                  <option value="SLOW">{t('learningSpeedSlow')}</option>
                  <option value="NORMAL">{t('learningSpeedNormal')}</option>
                  <option value="FAST">{t('learningSpeedFast')}</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
              <span>{t('intensityLine', { sessions: form.sessionsPerWeek, minutes: form.minutesPerSession })}</span>
              <span>{t('weeklyTotalLine', { total: weeklyMinutes })}</span>
            </div>

            {form.goalType === 'CERT' && (
              <div className="form-field">
                <label className="label">{t('examType')}</label>
                <input
                  value={form.examType}
                  onChange={(e) => setForm((f) => ({ ...f, examType: e.target.value }))}
                  className={`input ${fieldErrors.examType ? 'border-destructive focus:ring-destructive' : ''}`}
                  placeholder={t('examTypePlaceholder')}
                />
                {fieldErrors.examType && <p className="form-error">{fieldErrors.examType}</p>}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary btn-md w-full">
              {loading ? t('submitting') : t('submit')}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
