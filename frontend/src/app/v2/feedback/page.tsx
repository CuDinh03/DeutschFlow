'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ArrowRight, Inbox } from 'lucide-react'
import { GaPageHdr, EmptyState, ErrorBanner, LoadingState } from '@/components/ui-v2'
import { FeedbackForm } from '@/components/feedback/FeedbackForm'
import { MyFeedbackList } from '@/components/feedback/MyFeedbackList'
import { httpStatus } from '@/lib/api'
import { getKnownAuthRole } from '@/lib/authSession'
import { feedbackApi, type FeedbackAudience, type MyFeedback } from '@/lib/feedbackApi'
import { RoleShell } from '../RoleShell'

const ADMIN_INBOX_HREF = '/v2/admin/feedback'

/** ADMIN không gửi góp ý (Q6, backend trả 403 có chủ đích): đây không phải lỗi tải. */
function isAdminBlocked(e: unknown): boolean {
  return httpStatus(e) === 403 && getKnownAuthRole() === 'ADMIN'
}

/**
 * /v2/feedback — người dùng gửi góp ý về phần mềm và theo dõi trạng thái (đặc tả gopycapnhat, GĐ1:
 * FBK-01…11, 13). Dùng chung cho học viên, giáo viên và chủ/quản lý trung tâm; danh sách "Phần" theo
 * nhóm người gửi do backend trả về. ADMIN không gửi góp ý (backend 403): trang giải thích và dẫn sang
 * hộp góp ý thay vì báo lỗi tải.
 */
function FeedbackBody() {
  const t = useTranslations('v2.account.feedback')
  const [audience, setAudience] = useState<FeedbackAudience | null>(null)
  const [formError, setFormError] = useState(false)
  const [adminBlocked, setAdminBlocked] = useState(false)
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
    } catch (e) {
      if (isAdminBlocked(e)) setAdminBlocked(true)
      else setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    feedbackApi.form()
      .then((res) => setAudience(res.data.audience))
      .catch((e) => {
        if (isAdminBlocked(e)) setAdminBlocked(true)
        else setFormError(true)
      })
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
        {adminBlocked ? (
          <div className="rounded-ga border border-ga-line bg-ga-card">
            <EmptyState
              variant="neutral"
              icon={Inbox}
              title={t('adminBlockedTitle')}
              description={t('adminBlockedBody')}
              action={
                <Link href={ADMIN_INBOX_HREF} className="ga-ui inline-flex items-center gap-1.5 text-ga-small font-semibold text-ga-accent hover:underline">
                  {t('adminBlockedCta')} <ArrowRight size={14} aria-hidden />
                </Link>
              }
            />
          </div>
        ) : (
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
        )}
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
