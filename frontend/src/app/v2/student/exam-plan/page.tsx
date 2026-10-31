'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { apiMessage } from '@/lib/api'
import { GaPageHdr, LoadingState, ErrorBanner } from '@/components/ui-v2'
import { ExamPlanView } from '@/components/exam/plan/ExamPlanView'
import { examPlanApi, type ExamPlan } from '@/lib/examPlanApi'

/** /v2/student/exam-plan — lộ trình đếm ngược tới ngày thi (LT3). */
export default function V2ExamPlanPage() {
  const t = useTranslations('v2.student.examPlan')
  const [plan, setPlan] = useState<ExamPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    examPlanApi
      .get()
      .then((r) => setPlan(r.data))
      .catch((e) => setError(apiMessage(e)))
      .finally(() => setLoading(false))
  }, [])
  useEffect(load, [load])

  const saveDate = async (date: string) => {
    try {
      const { data } = await examPlanApi.updateTargetDate(date)
      setPlan(data)
      return null
    } catch (e) {
      return apiMessage(e)
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr accent title={t('title')} subtitle={t('subtitle')} />
      <div className="flex-1 px-4 py-6 sm:px-6 lg:px-10">
        {loading ? (
          <LoadingState variant="skeleton" rows={4} label={t('loading')} />
        ) : error || !plan ? (
          <ErrorBanner message={error ?? t('loadError')} onRetry={load} />
        ) : (
          <div className="max-w-3xl">
            <ExamPlanView plan={plan} onSaveDate={saveDate} />
          </div>
        )}
      </div>
    </div>
  )
}
