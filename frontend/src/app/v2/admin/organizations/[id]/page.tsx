'use client'

import { useCallback } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import useAdminData from '@/hooks/useAdminData'
import {
  getOrganization,
  listAdminPlans,
  listOrgInvoices,
  type AdminOrgDetail,
  type AdminPlanOption,
  type OrgInvoice,
} from '@/lib/adminOrgApi'
import { ErrorBanner, GaBtn, GaPageHdr, GaStatStrip, LoadingState } from '@/components/ui-v2'
import { useFmt } from '@/lib/i18n/useFmt'
import { LicenceForm } from '../LicenceForm'
import { OrgStatusCard } from '../OrgStatusCard'
import { InvoicePanel } from '../InvoicePanel'
import { poolSummary } from '../orgLicence'

/**
 * /v2/admin/organizations/[id] — hồ sơ MỘT trung tâm cho admin nền tảng: T-03 (gói/ghế/hạn mức
 * AI/hạn giấy phép + trạng thái) và T-01 (hoá đơn tạo/gửi/đã thu/huỷ). Cùng khuôn route chi tiết
 * với exam-golden/[id]. Admin chỉ thấy hợp đồng + tài chính; dữ liệu học tập của trung tâm không
 * có ở đây (DEC-13 / privacyNotice).
 */

// Cùng tông tím của màn danh sách, nhưng qua token (file mới không được mang hex literal).
const orgsAccentVars = {
  '--ga-accent': 'var(--ga-violet)',
  '--ga-hdr-bg': 'var(--ga-violet-soft)',
  '--ga-hdr-line': 'var(--ga-line)',
} as React.CSSProperties

interface DetailData {
  org: AdminOrgDetail | null
  invoices: OrgInvoice[]
  plans: AdminPlanOption[]
}

export default function V2AdminOrgDetailPage() {
  const params = useParams<{ id: string }>()
  const orgId = Number(params?.id)
  const t = useTranslations('v2.adminOps.organizations')
  const fmt = useFmt()

  const fetchData = useCallback(async (): Promise<DetailData> => {
    const [org, invoices, plans] = await Promise.all([
      getOrganization(orgId),
      listOrgInvoices(orgId),
      // Danh sách gói chỉ là tiện ích chọn — hỏng thì form vẫn mở được với gói hiện tại.
      listAdminPlans().catch(() => [] as AdminPlanOption[]),
    ])
    return { org, invoices, plans }
  }, [orgId])

  const { data, loading, error, reload } = useAdminData<DetailData>({
    initialData: { org: null, invoices: [], plans: [] },
    errorMessage: t('detail.loadError'),
    fetchData,
    // Poll thưa hơn màn danh sách: form đang gõ dở không cần dữ liệu tươi mỗi hai phút.
    intervalMs: 600_000,
  })
  const refresh = () => void reload({ silent: true })
  const { org, invoices, plans } = data

  if (!Number.isFinite(orgId)) {
    return <ErrorBanner variant="page" message={t('detail.notFound')} />
  }
  if (error && !org) {
    return <ErrorBanner variant="page" message={error} onRetry={() => void reload({ silent: false })} />
  }
  if (loading && !org) {
    return <LoadingState label={t('detail.loading')} />
  }
  if (!org) {
    return <ErrorBanner variant="page" message={t('detail.notFound')} />
  }

  const pool = poolSummary(org)
  const poolLabel =
    pool === 'unlimited'
      ? t('aiPool.unlimited')
      : pool === 'metered'
        ? t('aiPool.metered', { count: fmt.num(org.monthlyTokenPool) })
        : t('aiPool.unset')

  return (
    <div className="flex min-h-full flex-col" style={orgsAccentVars}>
      <GaPageHdr
        accent
        eyebrow={t('detail.eyebrow')}
        title={org.name}
        subtitle={t('detail.subtitle', {
          slug: org.slug ?? '—',
          students: fmt.num(org.studentCount),
          teachers: fmt.num(org.teacherCount),
        })}
        right={
          <GaBtn asChild variant="ghost">
            <Link href="/v2/admin/organizations">
              <ArrowLeft size={14} aria-hidden /> {t('detail.back')}
            </Link>
          </GaBtn>
        }
      />

      <div className="flex-1 space-y-5 px-4 py-6 sm:px-6 lg:px-10">
        <div
          className="flex items-start gap-3 border px-4 py-3 lg:items-center"
          style={{ background: 'var(--ga-navy-soft)', borderColor: 'var(--ga-line)' }}
        >
          <ShieldCheck size={18} aria-hidden style={{ color: 'var(--ga-navy)', flexShrink: 0 }} />
          <p className="ga-ui text-ga-small text-ga-ink">{t('detail.privacy')}</p>
        </div>

        {error && <ErrorBanner message={error} onRetry={() => void reload({ silent: false })} />}

        <GaStatStrip
          items={[
            { label: t('detail.stats.plan'), value: org.planCode || t('noPlan'), tone: 'violet' },
            {
              label: t('detail.stats.seats'),
              value: `${fmt.num(org.studentCount)} / ${org.seatLimit > 0 ? fmt.num(org.seatLimit) : '∞'}`,
              tone: 'blue',
              sub: org.seatLimit > 0 && org.studentCount > org.seatLimit ? t('detail.stats.seatsOver') : undefined,
              alert: org.seatLimit > 0 && org.studentCount > org.seatLimit,
            },
            { label: t('detail.stats.aiPool'), value: poolLabel, tone: pool === 'unset' ? 'red' : 'teal', alert: pool === 'unset' },
            {
              label: t('detail.stats.validUntil'),
              value: org.validUntil ? fmt.date(org.validUntil) : t('perpetual'),
              tone: 'green',
            },
          ]}
        />

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <LicenceForm org={org} plans={plans} onSaved={refresh} />
          <OrgStatusCard org={org} onChanged={refresh} />
        </div>

        <InvoicePanel org={org} invoices={invoices} onChanged={refresh} />
      </div>
    </div>
  )
}
