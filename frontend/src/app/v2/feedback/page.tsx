'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { GaPageHdr, ErrorBanner, LoadingState } from '@/components/ui-v2'
import { FeedbackForm } from '@/components/feedback/FeedbackForm'
import { MyFeedbackList } from '@/components/feedback/MyFeedbackList'
import { feedbackApi, type FeedbackAudience, type MyFeedback } from '@/lib/feedbackApi'
import { RoleShell } from '../RoleShell'

/**
 * /v2/feedback — người dùng gửi góp ý về phần mềm và theo dõi trạng thái (đặc tả gopycapnhat, GĐ1:
 * FBK-01…11, 13). Dùng chung cho học viên, giáo viên và chủ/quản lý trung tâm; danh sách "Phần" theo
 * nhóm người gửi do backend trả về. ADMIN không gửi góp ý (backend 403) — trang báo lỗi tải.
 */
function FeedbackBody() {
  const t = useTranslations('v2.account.feedback')
  const [audience, setAudience] = useState<FeedbackAudience | null>(null)
  const [formError, setFormError] = useState(false)
  const [items, setItems] = useState<MyFeedback[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [highlightId, setHighlightId] = useState<number | null>(null)

  const loadMine = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await feedbackApi.mine()
      setItems(res.data ?? [])
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    feedbackApi.form()
      .then((res) => setAudience(res.data.audience))
      .catch(() => setFormError(true))
    void loadMine()
  }, [loadMine])

  const onSent = (item: MyFeedback) => {
    setItems((prev) => [item, ...prev.filter((x) => x.id !== item.id)])
    setHighlightId(item.id)
  }

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr eyebrow={t('eyebrow')} title={t('title')} subtitle={t('subtitle')} />
      <div className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-8 lg:py-8">
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          {formError ? (
            <ErrorBanner message={t('mineLoadError')} onRetry={() => window.location.reload()} retryLabel={t('retry')} />
          ) : audience ? (
            <FeedbackForm audience={audience} onSent={onSent} />
          ) : (
            <LoadingState />
          )}
          <MyFeedbackList items={items} loading={loading} error={error} onRetry={loadMine} highlightId={highlightId} />
        </div>
      </div>
    </div>
  )
}

export default function FeedbackPage() {
  return (
    <RoleShell>
      <FeedbackBody />
    </RoleShell>
  )
}
