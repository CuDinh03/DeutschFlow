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

const INTERESTS = [
  { id: 'TRAVEL', labelVi: 'Du lịch', labelEn: 'Travel', labelDe: 'Reisen' },
  { id: 'BUSINESS', labelVi: 'Công việc', labelEn: 'Business', labelDe: 'Business' },
  { id: 'TECH', labelVi: 'Công nghệ', labelEn: 'Tech', labelDe: 'Technik' },
  { id: 'HEALTH', labelVi: 'Sức khoẻ', labelEn: 'Health', labelDe: 'Gesundheit' },
  { id: 'EDUCATION', labelVi: 'Giáo dục', labelEn: 'Education', labelDe: 'Bildung' },
]

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

  const interestLabel = (x: (typeof INTERESTS)[number]) => {
    // Minimal: keep Vi copy since app default is vi; translations can be refined later.
    return x.labelVi
  }

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
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary-hover to-navy-blue-dark opacity-5 pointer-events-none" />

      <div className="relative w-full max-w-2xl">
        <div className="card p-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
            <p className="text-muted-foreground mt-1">{t('subtitle')}</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-5">
              <div>
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

              <div>
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

              <div>
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

              <div>
                <label className="label">{t('ageRange')}</label>
                <select
                  value={form.ageRange}
                  onChange={(e) => setForm((f) => ({ ...f, ageRange: e.target.value as AgeRange }))}
                  className="input"
                >
                  <option value="UNDER_18">&lt; 18</option>
                  <option value="AGE_18_24">18–24</option>
                  <option value="AGE_25_34">25–34</option>
                  <option value="AGE_35_44">35–44</option>
                  <option value="AGE_45_PLUS">45+</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="label">{t('industry')}</label>
                <input
                  value={form.industry}
                  onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))}
                  className={`input ${fieldErrors.industry ? 'border-destructive focus:ring-destructive' : ''}`}
                  placeholder="VD: IT, Điều dưỡng, Du lịch..."
                />
                {fieldErrors.industry && <p className="mt-2 text-sm text-destructive">{fieldErrors.industry}</p>}
              </div>
            </div>

            <div>
              <label className="label">{t('interests')}</label>
              <div className="grid sm:grid-cols-2 gap-3">
                {INTERESTS.map((x) => (
                  <label key={x.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-background">
                    <input
                      type="checkbox"
                      checked={form.interests.includes(x.id)}
                      onChange={() => toggleInterest(x.id)}
                    />
                    <span className="text-sm text-foreground">{interestLabel(x)}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-5">
              <div>
                <label className="label">{t('sessionsPerWeek')}</label>
                <input
                  type="number"
                  min={1}
                  max={14}
                  value={form.sessionsPerWeek}
                  onChange={(e) => setForm((f) => ({ ...f, sessionsPerWeek: Number(e.target.value) }))}
                  className={`input ${fieldErrors.sessionsPerWeek ? 'border-destructive focus:ring-destructive' : ''}`}
                />
                {fieldErrors.sessionsPerWeek && <p className="mt-2 text-sm text-destructive">{fieldErrors.sessionsPerWeek}</p>}
              </div>

              <div>
                <label className="label">{t('minutesPerSession')}</label>
                <input
                  type="number"
                  min={5}
                  max={180}
                  value={form.minutesPerSession}
                  onChange={(e) => setForm((f) => ({ ...f, minutesPerSession: Number(e.target.value) }))}
                  className={`input ${fieldErrors.minutesPerSession ? 'border-destructive focus:ring-destructive' : ''}`}
                />
                {fieldErrors.minutesPerSession && <p className="mt-2 text-sm text-destructive">{fieldErrors.minutesPerSession}</p>}
              </div>

              <div>
                <label className="label">{t('learningSpeed')}</label>
                <select
                  value={form.learningSpeed}
                  onChange={(e) => setForm((f) => ({ ...f, learningSpeed: e.target.value as LearningSpeed }))}
                  className="input"
                >
                  <option value="SLOW">Slow</option>
                  <option value="NORMAL">Normal</option>
                  <option value="FAST">Fast</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Cường độ: <span className="text-foreground font-medium">{form.sessionsPerWeek} buổi/tuần</span> ·{' '}
                <span className="text-foreground font-medium">{form.minutesPerSession} phút</span>
              </span>
              <span>
                Tổng: <span className="text-foreground font-medium">{weeklyMinutes} phút/tuần</span>
              </span>
            </div>

            {form.goalType === 'CERT' && (
              <div>
                <label className="label">{t('examType')}</label>
                <input
                  value={form.examType}
                  onChange={(e) => setForm((f) => ({ ...f, examType: e.target.value }))}
                  className={`input ${fieldErrors.examType ? 'border-destructive focus:ring-destructive' : ''}`}
                  placeholder="VD: Goethe, TELC..."
                />
                {fieldErrors.examType && <p className="mt-2 text-sm text-destructive">{fieldErrors.examType}</p>}
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

