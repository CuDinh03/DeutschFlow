'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import useAdminData from '@/hooks/useAdminData'
import { listMedia, type MediaAsset } from '@/lib/mediaApi'
import { GaPageHdr, GaBtn, AdStatStrip } from '@/components/ui-v2'

// ── Blue header accent (media screen overrides admin-navy chrome) ─────────────
const BLUE = '#2F6FC9'
const mediaAccentVars = {
  '--ga-accent': BLUE,
  '--ga-hdr-bg': 'rgba(47,111,201,0.07)',
  '--ga-hdr-line': 'rgba(47,111,201,0.20)',
} as React.CSSProperties

// Category → labelKey + accent (mirrors proto AD_MEDIA tag colours). labelKey resolves
// via t(`cat${labelKey}`); unknown categories fall back to the raw value or catOther.
const CAT: Record<string, { labelKey: string; color: string }> = {
  WORD_IMAGE: { labelKey: 'WordImage', color: '#1E9E61' },
  AI_IMAGE: { labelKey: 'AiImage', color: '#7C56C8' },
  VIDEO_SCENE: { labelKey: 'VideoScene', color: '#2F6FC9' },
  PERSONA: { labelKey: 'Persona', color: '#E07B39' },
  AVATAR: { labelKey: 'Avatar', color: '#11888A' },
  MARKETING: { labelKey: 'Marketing', color: '#DA291C' },
}

function fmtSize(bytes: number): string {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1).replace('.', ',')} GB`
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1).replace('.', ',')} MB`
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`
  return `${bytes} B`
}

export default function V2AdminMediaPage() {
  const t = useTranslations('v2.adminContent.media')
  const tc = useTranslations('v2.common')
  const { data, loading, error, reload } = useAdminData<MediaAsset[]>({
    initialData: [],
    errorMessage: t('loadDataError'),
    fetchData: async () => {
      const res = await listMedia('ALL', 0, 100)
      return res.content ?? []
    },
  })

  const catOf = (c: string): { label: string; color: string } => {
    const hit = CAT[c?.toUpperCase()]
    if (hit) return { label: t(`cat${hit.labelKey}`), color: hit.color }
    return { label: c || t('catOther'), color: '#76716A' }
  }

  const stats = useMemo(() => {
    const total = data.length
    const size = data.reduce((s, m) => s + (Number(m.fileSize) || 0), 0)
    const ai = data.filter((m) => /AI|BEDROCK/i.test(m.category ?? '') || /AI/i.test(m.source ?? '')).length
    const video = data.filter((m) => /VIDEO/i.test(m.category ?? '')).length
    return { total, size, ai, video }
  }, [data])

  return (
    <div className="flex min-h-full flex-col" style={mediaAccentVars}>
      <GaPageHdr
        accent
        title={t('title')}
        subtitle={t('subtitle')}
        right={
          <GaBtn variant="yellow" onClick={() => toast(t('uploadSoon'))}>
            <span aria-hidden className="inline-block h-[7px] w-[7px] bg-ga-ink" />
            {t('upload')}
          </GaBtn>
        }
      />

      <div className="flex-1 px-4 py-6 sm:px-6 lg:px-10">
        <AdStatStrip
          className="mb-6"
          cells={[
            { label: t('statTotal'), value: stats.total.toLocaleString('vi-VN'), color: BLUE },
            { label: t('statSize'), value: fmtSize(stats.size), color: '#E07B39' },
            { label: t('statAi'), value: stats.ai.toLocaleString('vi-VN'), color: '#7C56C8' },
            { label: t('statVideo'), value: stats.video.toLocaleString('vi-VN'), color: '#1E9E61' },
          ]}
        />

        {loading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="ga-shimmer h-[164px] border border-ga-line" aria-hidden />
            ))}
          </div>
        ) : error ? (
          <div className="border border-ga-line bg-ga-card px-4 py-10 text-center sm:px-6 lg:px-10 lg:py-[52px]">
            <h2 className="font-ga-display text-[20px] font-medium leading-[1.2] text-ga-red lg:text-[26px]">
              {t('loadError')}
            </h2>
            <p className="ga-ui mx-auto mb-5 mt-3 max-w-sm break-words text-[14.5px] text-ga-muted">
              {error} <code className="break-words font-mono text-[12px] text-ga-accent">GET /api/v2/media</code>
            </p>
            <GaBtn variant="primary" onClick={() => reload({ silent: false })}>
              {tc('retry')}
            </GaBtn>
          </div>
        ) : data.length === 0 ? (
          <div className="border border-dashed border-ga-line px-4 py-10 text-center sm:px-6 lg:px-10">
            <p className="ga-ui text-[14.5px] text-ga-muted">{t('empty')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {data.map((m) => {
              const c = catOf(m.category)
              return (
                <div key={m.id} className="overflow-hidden border border-ga-line bg-ga-card">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={m.url}
                    alt={m.altText ?? m.originalName ?? ''}
                    className="h-[120px] w-full bg-ga-surface object-cover"
                    loading="lazy"
                  />
                  <div className="flex items-center gap-2 px-3 py-2.5">
                    <span aria-hidden className="h-2 w-2 shrink-0" style={{ background: c.color }} />
                    <span className="min-w-0 truncate text-[12.5px] text-ga-ink" title={m.originalName ?? ''}>
                      {m.tag || c.label}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
