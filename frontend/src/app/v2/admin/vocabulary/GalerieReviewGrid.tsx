'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { RefreshCw, Sparkles, ImagePlus } from 'lucide-react'
import { toast } from 'sonner'
import api, { apiMessage } from '@/lib/api'
import { GaBtn, GaCap, GaStatStrip } from '@/components/ui-v2'

// Tab Galerie (plan mục 16/30–31): review CẢ COLLECTION cạnh nhau, không review lẻ.
//   GET  /api/v2/admin/vocabulary/galerie/overview?status&limit&offset   → rows (snake_case)
//   GET  /api/v2/admin/vocabulary/galerie/concepts/missing-count         → { missing }
//   GET  /api/v2/admin/vocabulary/galerie/generate/ready-count           → { ready }
//   POST /api/v2/admin/vocabulary/galerie/concepts?limit=                → batch response
//   POST /api/v2/admin/vocabulary/galerie/generate?limit=                → batch response (chậm ~5–15s/ảnh)
//   POST /api/v2/admin/vocabulary/galerie/{id}/decision {decision}       → 200 | 409

// Bucket S3 private (nợ bucket-policy 14/07) → render artwork qua endpoint public của backend.
const BACKEND_ORIGIN = (process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080')
  .replace(/\/+$/, '')
  .replace(/\/api$/, '')
const artworkSrc = (wordId: number) => `${BACKEND_ORIGIN}/api/public/galerie/artwork/${wordId}.svg`
const GRID_LIMIT = 60
// Sinh SVG sync ~5–15s/ảnh — giữ chunk nhỏ để không đụng timeout HTTP phía client.
const GENERATE_CHUNK = 5
const CONCEPT_CHUNK = 30

const STATUSES = ['QA_PENDING', 'APPROVED', 'REJECTED', 'CONCEPT_READY', 'GENERATING'] as const
type GalerieStatus = (typeof STATUSES)[number]

const STATUS_COLORS: Record<GalerieStatus, string> = {
  QA_PENDING: '#C79A00',
  APPROVED: '#1E9E61',
  REJECTED: '#DA291C',
  CONCEPT_READY: '#2F6FC9',
  GENERATING: '#8A8578',
}

interface GalerieRow {
  id: number
  base_form: string | null
  gender: string | null
  dtype: string | null
  cefr_level: string | null
  meaning: string | null
  image_family: string | null
  image_concept: string | null
  image_status: string | null
  image_url: string | null
  image_style: string | null
}

interface BatchResponse {
  requested?: number
  succeeded?: number
  failed?: number
  remaining?: number
}

export default function GalerieReviewGrid() {
  const t = useTranslations('v2.adminContent.vocabulary.galerie')
  const tc = useTranslations('v2.common')
  const [status, setStatus] = useState<string>('QA_PENDING')
  const [rows, setRows] = useState<GalerieRow[]>([])
  const [conceptMissing, setConceptMissing] = useState<number | null>(null)
  const [svgReady, setSvgReady] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState<'' | 'concepts' | 'generate'>('')
  const [deciding, setDeciding] = useState<number | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number> = { limit: GRID_LIMIT, offset: 0 }
      if (status) params.status = status
      const [grid, missing, ready] = await Promise.all([
        api.get<GalerieRow[]>('/v2/admin/vocabulary/galerie/overview', { params }),
        api.get<{ missing?: number }>('/v2/admin/vocabulary/galerie/concepts/missing-count'),
        api.get<{ ready?: number }>('/v2/admin/vocabulary/galerie/generate/ready-count'),
      ])
      setRows(grid.data ?? [])
      setConceptMissing(missing.data?.missing ?? null)
      setSvgReady(ready.data?.ready ?? null)
      setError('')
    } catch (e: unknown) {
      setError(apiMessage(e))
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => {
    void load()
  }, [load])

  const runBatch = async (kind: 'concepts' | 'generate') => {
    setRunning(kind)
    try {
      const limit = kind === 'concepts' ? CONCEPT_CHUNK : GENERATE_CHUNK
      const res = await api.post<BatchResponse>(
        `/v2/admin/vocabulary/galerie/${kind}?limit=${limit}`,
        undefined,
        // Sinh SVG sync — nới timeout riêng cho request này thay vì đổi default toàn app.
        kind === 'generate' ? { timeout: 5 * 60 * 1000 } : undefined,
      )
      const d = res.data ?? {}
      toast.success(
        t('runDone', {
          requested: d.requested ?? 0,
          succeeded: d.succeeded ?? 0,
          failed: d.failed ?? 0,
          remaining: d.remaining ?? 0,
        }),
      )
      await load()
    } catch (e: unknown) {
      toast.error(apiMessage(e))
    } finally {
      setRunning('')
    }
  }

  const decide = async (wordId: number, decision: 'APPROVE' | 'REGENERATE' | 'REJECT') => {
    setDeciding(wordId)
    try {
      await api.post(`/v2/admin/vocabulary/galerie/${wordId}/decision`, { decision })
      toast.success(t('decisionOk', { decision }))
      await load()
    } catch (e: unknown) {
      toast.error(apiMessage(e))
    } finally {
      setDeciding(null)
    }
  }

  return (
    <div className="flex-1 px-4 py-6 sm:px-6 lg:px-10">
      <GaStatStrip
        className="mb-5"
        items={[
          {
            label: t('statConceptMissing'),
            value: conceptMissing === null ? '—' : conceptMissing.toLocaleString('vi-VN'),
            tone: 'blue',
          },
          {
            label: t('statReady'),
            value: svgReady === null ? '—' : svgReady.toLocaleString('vi-VN'),
            tone: 'gold',
            alert: (svgReady ?? 0) > 0,
          },
          {
            label: t('statShowing'),
            value: rows.length.toLocaleString('vi-VN'),
            tone: 'green',
          },
        ]}
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <label className="ga-ui text-[13px] font-semibold text-ga-muted" htmlFor="galerie-status">
          {t('filterLabel')}
        </label>
        <select
          id="galerie-status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="ga-ui min-h-[36px] border border-ga-line bg-ga-card px-2 text-[13px]"
        >
          <option value="">{t('statusAll')}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <div className="ml-auto flex flex-wrap gap-2">
          <GaBtn
            variant="ghost"
            disabled={running !== ''}
            onClick={() => void runBatch('concepts')}
          >
            <Sparkles size={15} aria-hidden />
            {running === 'concepts' ? tc('loading') : t('runConcepts', { count: CONCEPT_CHUNK })}
          </GaBtn>
          <GaBtn
            variant="primary"
            disabled={running !== ''}
            onClick={() => void runBatch('generate')}
          >
            <ImagePlus size={15} aria-hidden />
            {running === 'generate' ? t('generating') : t('runGenerate', { count: GENERATE_CHUNK })}
          </GaBtn>
          <GaBtn variant="ghost" disabled={loading} onClick={() => void load()}>
            <RefreshCw size={15} aria-hidden />
            {tc('retry')}
          </GaBtn>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="ga-shimmer aspect-square border border-ga-line" aria-hidden />
          ))}
        </div>
      ) : error ? (
        <div className="border border-ga-line bg-ga-card px-4 py-10 text-center">
          <p className="ga-ui mb-4 text-[14.5px] text-ga-red">{error}</p>
          <GaBtn variant="primary" onClick={() => void load()}>
            {tc('retry')}
          </GaBtn>
        </div>
      ) : rows.length === 0 ? (
        <div className="border border-dashed border-ga-line px-4 py-10 text-center">
          <p className="font-ga-display text-[18px] italic text-ga-ink">{t('empty')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
          {rows.map((row) => {
            const st = (row.image_status ?? '') as GalerieStatus
            const stColor = STATUS_COLORS[st] ?? '#8A8578'
            return (
              <figure key={row.id} className="flex flex-col border border-ga-line bg-ga-card">
                <div className="relative aspect-square" style={{ background: '#F6F3EC' }}>
                  {row.image_url ? (
                    // SVG đã qua sanitizer backend (chặn script/event) — an toàn render qua <img>.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={artworkSrc(row.id)}
                      alt={row.image_concept ?? row.base_form ?? ''}
                      className="h-full w-full object-contain"
                      loading="lazy"
                    />
                  ) : (
                    <div className="grid h-full w-full place-items-center px-3 text-center">
                      <span className="ga-ui text-[12px] text-ga-muted">{t('noArtwork')}</span>
                    </div>
                  )}
                  <span
                    className="absolute left-2 top-2 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-white"
                    style={{ background: stColor }}
                  >
                    {row.image_status ?? '—'}
                  </span>
                </div>
                <figcaption className="flex flex-1 flex-col gap-1 p-3">
                  <div className="flex items-baseline gap-1.5">
                    <strong className="font-ga-display text-[15px] text-ga-ink">
                      {row.gender ? `${row.gender} ` : ''}
                      {row.base_form}
                    </strong>
                    <span className="ga-ui text-[11px] text-ga-muted">{row.cefr_level}</span>
                  </div>
                  <span className="ga-ui truncate text-[12.5px] text-ga-muted" title={row.meaning ?? ''}>
                    {row.meaning}
                  </span>
                  {row.image_concept && (
                    <GaCap className="line-clamp-2 text-[11px]" title={row.image_concept}>
                      {row.image_family}: {row.image_concept}
                    </GaCap>
                  )}
                  <div className="mt-auto flex gap-1.5 pt-2">
                    <GaBtn
                      variant="primary"
                      className="min-h-[30px] flex-1 px-1 text-[11.5px]"
                      disabled={deciding === row.id || st !== 'QA_PENDING'}
                      onClick={() => void decide(row.id, 'APPROVE')}
                    >
                      {t('approve')}
                    </GaBtn>
                    <GaBtn
                      variant="ghost"
                      className="min-h-[30px] flex-1 px-1 text-[11.5px]"
                      disabled={deciding === row.id}
                      onClick={() => void decide(row.id, 'REGENERATE')}
                    >
                      {t('regenerate')}
                    </GaBtn>
                    <GaBtn
                      variant="ghost"
                      className="min-h-[30px] flex-1 px-1 text-[11.5px] text-ga-red"
                      disabled={deciding === row.id || (st !== 'QA_PENDING' && st !== 'APPROVED')}
                      onClick={() => void decide(row.id, 'REJECT')}
                    >
                      {t('reject')}
                    </GaBtn>
                  </div>
                </figcaption>
              </figure>
            )
          })}
        </div>
      )}
    </div>
  )
}
