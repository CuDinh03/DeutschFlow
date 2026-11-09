'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ArrowLeft } from 'lucide-react'
import { apiMessage, httpStatus } from '@/lib/api'
import { adminUsersApi, type PlanRow, type QuotaDetail, type UserProfile } from '@/lib/adminUsersApi'
import { LearningDetailPanel } from '@/components/admin/LearningDetailModal'
import {
  GaPageHdr,
  GaCard,
  TkBadge,
  TkTabs,
  TkTabsList,
  TkTabsTrigger,
  TkTabsContent,
  LoadingState,
  ErrorBanner,
  EmptyState,
} from '@/components/ui-v2'
import { useUrlFilters } from '@/hooks/useUrlFilters'
import { defineFilters } from '@/lib/urlFilters'
import { useFmt } from '@/lib/i18n/useFmt'
import { useUserStore } from '@/stores/useUserStore'
import { UserAccessPanel } from '../_components/UserAccessPanel'
import { UserPlanPanel } from '../_components/UserPlanPanel'
import { UserQuotaSummary } from '../_components/UserQuotaSummary'
import { UserUsageTab } from '../_components/UserUsageTab'
import { UserAuditTab } from '../_components/UserAuditTab'

const TABS = defineFilters({
  tab: { kind: 'enum', values: ['overview', 'usage', 'learning', 'audit'] as const, default: 'overview' },
})

/**
 * Hồ sơ một người dùng (đợt 1 "Nền móng + Người dùng", 09/11/2026) — thay cho UserDetailModal.
 * Có URL riêng nên CSKH gửi link "xem người này" cho nhau được; tab đang mở nằm trên `?tab=`.
 *
 * Mỗi lần mở trang gọi GET /admin/users/{id} (ghi vết `admin.user.profile.read` vào sổ của trung
 * tâm người đó — DEC-13). Tab Học tập và Nhật ký chỉ nạp khi được mở.
 */
export default function AdminUserProfilePage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <AdminUserProfileInner />
    </Suspense>
  )
}

function AdminUserProfileInner() {
  const t = useTranslations('v2.adminOps.users.detail')
  const fmt = useFmt()
  const params = useParams<{ id: string }>()
  const userId = Number(params?.id)
  const { values, set } = useUrlFilters(TABS)
  // Id của admin đang đăng nhập — để ẩn "Đặt lại 2FA" trên hồ sơ của chính mình.
  const currentUserId = useUserStore((s) => s.user?.id ?? null)

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [quota, setQuota] = useState<QuotaDetail | null>(null)
  const [plans, setPlans] = useState<PlanRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  // Đổi khoá mỗi lần nạp lại để các panel nhận lại giá trị ban đầu từ hồ sơ mới.
  const [version, setVersion] = useState(0)

  const load = useCallback(async () => {
    if (!Number.isFinite(userId) || userId <= 0) {
      setNotFound(true)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [p, q] = await Promise.all([adminUsersApi.profile(userId), adminUsersApi.quota(userId).catch(() => null)])
      setProfile(p.data)
      setQuota(q?.data ?? null)
      setVersion((v) => v + 1)
    } catch (e) {
      if (httpStatus(e) === 404) setNotFound(true)
      else setError(apiMessage(e))
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    adminUsersApi
      .plans()
      .then((r) => setPlans(r.data ?? []))
      .catch(() => {})
  }, [])

  const back = (
    <Link
      href="/v2/admin/users"
      className="ga-ui inline-flex items-center gap-1.5 rounded-ga border border-ga-line bg-ga-card px-4 py-2.5 text-ga-small font-semibold text-ga-ink hover:bg-ga-surface"
    >
      <ArrowLeft size={14} aria-hidden /> {t('back')}
    </Link>
  )

  if (notFound) {
    return (
      <div className="flex min-h-full flex-col">
        <GaPageHdr accent title={t('notFoundTitle')} right={back} />
        <div className="px-4 py-10 sm:px-6 lg:px-10">
          <EmptyState title={t('notFoundTitle')} description={t('notFound', { id: String(params?.id ?? '') })} />
        </div>
      </div>
    )
  }

  if (loading && !profile) return <LoadingState label={t('loadingProfile')} />

  if (!profile) {
    return (
      <div className="px-4 py-10 sm:px-6 lg:px-10">
        <ErrorBanner message={error ?? t('loadError')} onRetry={() => void load()} />
      </div>
    )
  }

  const subtitle = [
    `#${profile.id}`,
    profile.email,
    profile.orgName ? t('orgOf', { name: profile.orgName }) : t('noOrg'),
    profile.createdAt ? t('createdAt', { date: fmt.date(profile.createdAt) }) : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="flex min-h-full flex-col" data-testid="admin-user-profile">
      <GaPageHdr accent title={profile.displayName || profile.email} subtitle={subtitle} right={back} />
      <div className="flex-1 space-y-5 px-4 py-5 sm:px-6 lg:px-10">
        {error && <ErrorBanner message={error} onRetry={() => void load()} />}
        <div className="flex flex-wrap items-center gap-2">
          <TkBadge>{profile.role}</TkBadge>
          <TkBadge tone={profile.isActive ? 'green' : 'red'}>
            {profile.isActive ? t('statusActive') : t('statusLocked')}
          </TkBadge>
          <TkBadge>{profile.planCode}</TkBadge>
        </div>

        <TkTabs value={values.tab} onValueChange={(v) => set({ tab: v })}>
          <TkTabsList aria-label={t('tabs.label')}>
            <TkTabsTrigger value="overview" data-testid="profile-tab-overview">{t('tabs.overview')}</TkTabsTrigger>
            <TkTabsTrigger value="usage" data-testid="profile-tab-usage">{t('tabs.usage')}</TkTabsTrigger>
            <TkTabsTrigger value="learning" data-testid="profile-tab-learning">{t('tabs.learning')}</TkTabsTrigger>
            <TkTabsTrigger value="audit" data-testid="profile-tab-audit">{t('tabs.audit')}</TkTabsTrigger>
          </TkTabsList>

          <TkTabsContent value="overview" className="pt-5">
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <GaCard className="space-y-6 p-4 lg:p-6">
                <UserQuotaSummary quota={quota} />
                <UserPlanPanel
                  key={`plan-${version}`}
                  userId={profile.id}
                  userName={profile.displayName}
                  currentPlan={profile.planCode}
                  quota={quota}
                  plans={plans}
                  onChanged={() => void load()}
                />
              </GaCard>
              <GaCard className="p-4 lg:p-6">
                <UserAccessPanel
                  key={`access-${version}`}
                  userId={profile.id}
                  userName={profile.displayName}
                  email={profile.email}
                  role={profile.role}
                  isActive={profile.isActive}
                  isSelf={String(profile.id) === currentUserId}
                  onChanged={() => void load()}
                />
              </GaCard>
            </div>
          </TkTabsContent>

          <TkTabsContent value="usage" className="pt-5">
            {values.tab === 'usage' && <UserUsageTab userId={profile.id} />}
          </TkTabsContent>

          <TkTabsContent value="learning" className="pt-5">
            {values.tab === 'learning' && (
              <GaCard className="flex flex-col overflow-hidden">
                <p className="ga-ui border-b border-ga-line px-4 py-3 text-ga-caption text-ga-muted lg:px-6">
                  {t('learningIntro')}
                </p>
                <LearningDetailPanel userId={profile.id} />
              </GaCard>
            )}
          </TkTabsContent>

          <TkTabsContent value="audit" className="pt-5">
            {values.tab === 'audit' && <UserAuditTab userId={profile.id} />}
          </TkTabsContent>
        </TkTabs>
      </div>
    </div>
  )
}
