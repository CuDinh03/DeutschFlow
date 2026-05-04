'use client'

import { useTranslations } from 'next-intl'
import { Lock } from 'lucide-react'
import AdminShell from '@/components/admin/AdminShell'
import useAdminData from '@/hooks/useAdminData'

type VoidOk = { _: true }

export default function AdminSettingsPage() {
  const t = useTranslations('adminSettings')

  const { loading, error, refreshing, lastSyncedAt, reload } = useAdminData<VoidOk>({
    initialData: { _: true },
    errorMessage: t('error'),
    fetchData: async () => ({ _: true }),
    intervalMs: 600_000,
  })

  if (loading) {
    return (
      <AdminShell title={t('title')} subtitle={t('subtitle')} activeNav="settings" onRefresh={() => reload({ silent: true })}>
        <p className="text-[#94A3B8] text-sm">{t('loading')}</p>
      </AdminShell>
    )
  }

  return (
    <AdminShell
      title={t('title')}
      subtitle={t('subtitle')}
      activeNav="settings"
      error={error}
      refreshing={refreshing}
      onRefresh={() => reload({ silent: true })}
      lastSyncedAt={lastSyncedAt}
    >
      <div className="flex flex-col items-center justify-center py-20 gap-4 rounded-[14px] border border-[#E2E8F0] bg-white">
        <Lock size={48} className="text-[#E2E8F0]" />
        <p className="font-bold text-lg text-[#64748B]">{t('soon')}</p>
        <p className="text-sm text-[#94A3B8] max-w-md text-center">{t('body')}</p>
      </div>
    </AdminShell>
  )
}
