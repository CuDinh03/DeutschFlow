'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Download, MessageSquare, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import api, { apiMessage } from '@/lib/api'
import { getAccessToken } from '@/lib/authSession'
import { GaPageHdr, GaBtn, GaCap, TkStatStrip } from '@/components/ui-v2'

// ─────────────────────────────────────────────────────────────────────────────
// Training Dataset Export (admin) — navy (W1.7 migrate admin/training-dataset).
// GET /api/admin/training-dataset/stats; export qua authenticated fetch (Bearer) →
//   /api/admin/training-dataset/export/{conversations|errors} (blob JSON download).
// ─────────────────────────────────────────────────────────────────────────────

interface DatasetStats {
  total_conversations: number
  total_messages: number
  total_errors: number
  last_exported_at?: string
}

async function downloadJson(path: string, filename: string, token: string, failMsg: string) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL ?? ''}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(failMsg)
  const blob = await res.blob()
  const link = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = link
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(link)
}

// key = API path segment (kept), titleKey/descKey resolve via t().
const EXPORTS: { key: 'conversations' | 'errors'; titleKey: string; descKey: string; tone: string }[] = [
  { key: 'conversations', titleKey: 'exportConversationsTitle', descKey: 'exportConversationsDesc', tone: 'var(--ga-violet)' },
  { key: 'errors', titleKey: 'exportErrorsTitle', descKey: 'exportErrorsDesc', tone: 'var(--ga-orange)' },
]

export default function V2AdminTrainingDatasetPage() {
  const t = useTranslations('v2.adminContent.training')
  const tc = useTranslations('v2.common')
  const [stats, setStats] = useState<DatasetStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [downloading, setDownloading] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get<DatasetStats>('/admin/training-dataset/stats')
      setStats(data)
      setError('')
    } catch (e: unknown) { setError(apiMessage(e)) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])

  const handleDownload = async (type: 'conversations' | 'errors') => {
    setDownloading(type)
    try {
      const token = getAccessToken() ?? ''
      const stamp = new Date().toISOString().slice(0, 10)
      await downloadJson(`/api/admin/training-dataset/export/${type}`, `deutschflow-training-${type}-${stamp}.json`, token, t('downloadFailed'))
      toast.success(t('downloaded'))
    } catch (e: unknown) { toast.error(apiMessage(e)) }
    finally { setDownloading(null) }
  }

  return (
    <div className="flex min-h-full flex-col">
      <GaPageHdr accent title={t('title')} subtitle={t('subtitle')} />

      <div className="flex-1 overflow-auto px-10 py-6">
        {loading ? (
          <div className="flex flex-col gap-3">{Array.from({ length: 2 }).map((_, i) => <div key={i} className="ga-shimmer h-[120px] border border-ga-line" aria-hidden />)}</div>
        ) : error ? (
          <div className="border border-ga-line bg-ga-card px-10 py-[52px] text-center">
            <h2 className="font-ga-display text-[24px] font-medium text-ga-red">{t('loadError')}</h2>
            <p className="ga-ui mx-auto mb-5 mt-3 max-w-sm text-[14px] text-ga-muted">{error} <code className="font-mono text-[12px] text-ga-accent">GET /api/admin/training-dataset/stats</code></p>
            <GaBtn variant="primary" onClick={load}>{tc('retry')}</GaBtn>
          </div>
        ) : (
          <>
            <TkStatStrip
              items={[
                { label: t('statConversations'), value: (stats?.total_conversations ?? 0).toLocaleString(), sub: t('statConversationsSub') },
                { label: t('statMessages'), value: (stats?.total_messages ?? 0).toLocaleString(), sub: t('statMessagesSub'), color: '#2F6FC9' },
                { label: t('statErrors'), value: (stats?.total_errors ?? 0).toLocaleString(), sub: t('statErrorsSub'), color: '#E07B39' },
              ]}
            />

            <div className="mb-3.5 mt-[22px]"><GaCap>{t('exportCap')}</GaCap></div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {EXPORTS.map(({ key, titleKey, descKey, tone }) => (
                <div key={key} className="border border-ga-line bg-ga-card p-[22px]">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="grid h-9 w-9 place-items-center" style={{ background: `color-mix(in srgb, ${tone} 14%, transparent)`, color: tone }}>
                      {key === 'conversations' ? <MessageSquare size={18} /> : <AlertTriangle size={18} />}
                    </span>
                    <h2 className="font-ga-display text-[16px] font-medium text-ga-ink">{t(titleKey)}</h2>
                  </div>
                  <p className="ga-ui mb-4 text-[13px] leading-relaxed text-ga-muted">{t(descKey)}</p>
                  <GaBtn variant="primary" size="sm" loading={downloading === key} onClick={() => handleDownload(key)}>
                    {downloading !== key && <Download size={15} />} {t('downloadJson')}
                  </GaBtn>
                </div>
              ))}
            </div>

            <div className="mt-5 border border-ga-line bg-ga-bg px-4 py-3">
              <p className="ga-ui text-[12.5px] text-ga-muted">{t('anonymizedNote')}</p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
