'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ExternalLink, Download, RotateCw } from 'lucide-react'
import { apiMessage } from '@/lib/api'
import { getMaterialPreview, type Material, type MaterialPreview } from '@/lib/materialApi'
import { TkModal, GaBtn, LoadingState, ErrorBanner } from '@/components/ui-v2'

/**
 * Reads a material in-browser instead of downloading it. Word/PowerPoint/Excel arrive here as
 * `mode=PDF` — the backend converted them (in our own container, see MaterialPreviewService), so this
 * component only ever has to render PDF / image / audio / video.
 *
 * The download link stays available in the footer at all times: preview is the default, not the only
 * way out, and for UNSUPPORTED/FAILED it is the only way.
 */
export function MaterialPreviewModal({
  material,
  onClose,
}: {
  material: Material | null
  onClose: () => void
}) {
  const t = useTranslations('v2.teacher.materials')
  const [preview, setPreview] = useState<MaterialPreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const id = material?.id

  const load = useCallback(async () => {
    if (id == null) return
    setLoading(true)
    setError(null)
    try {
      setPreview(await getMaterialPreview(id))
    } catch (e: unknown) {
      setError(apiMessage(e))
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (id == null) {
      setPreview(null)
      setError(null)
      return
    }
    void load()
  }, [id, load])

  return (
    <TkModal
      open={material != null}
      onOpenChange={(open) => { if (!open) onClose() }}
      size="lg"
      title={material?.title}
      description={t('previewHint')}
      footer={
        <>
          {material && (
            <GaBtn asChild variant="ghost">
              {/* Presigned GET — `download` asks the browser to save rather than navigate. */}
              <a href={material.url} download target="_blank" rel="noopener noreferrer">
                <Download size={14} />
                {t('download')}
              </a>
            </GaBtn>
          )}
          <GaBtn variant="ink" onClick={onClose}>{t('close')}</GaBtn>
        </>
      }
    >
      {loading && <LoadingState label={t('previewLoading')} />}

      {!loading && error && <ErrorBanner message={error} onRetry={() => void load()} />}

      {!loading && !error && preview && material && (
        <PreviewBody preview={preview} title={material.title} onRetry={() => void load()} />
      )}
    </TkModal>
  )
}

function PreviewBody({
  preview,
  title,
  onRetry,
}: {
  preview: MaterialPreview
  title: string
  onRetry: () => void
}) {
  const t = useTranslations('v2.teacher.materials')
  const { mode, url } = preview

  if (mode === 'PDF' && url) {
    return (
      <iframe
        src={url}
        title={t('previewOf', { title })}
        className="h-[68vh] w-full rounded-ga border border-ga-line bg-ga-surface"
      />
    )
  }

  if (mode === 'IMAGE' && url) {
    // eslint-disable-next-line @next/next/no-img-element -- presigned S3 URL, not an optimizable static asset
    return <img src={url} alt={title} className="mx-auto max-h-[68vh] w-auto max-w-full rounded-ga" />
  }

  if (mode === 'AUDIO' && url) {
    return <audio src={url} controls className="w-full" />
  }

  if (mode === 'VIDEO' && url) {
    return <video src={url} controls className="max-h-[68vh] w-full rounded-ga bg-black" />
  }

  if (mode === 'LINK' && url) {
    // An external site's X-Frame-Options is theirs to set — don't gamble on an iframe that renders blank.
    return (
      <Notice text={t('previewLink')}>
        <GaBtn asChild variant="primary">
          <a href={url} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={14} />
            {t('openExternal')}
          </a>
        </GaBtn>
      </Notice>
    )
  }

  if (mode === 'FAILED') {
    return (
      <Notice text={t('previewFailed')}>
        <GaBtn variant="ghost" onClick={onRetry}>
          <RotateCw size={14} />
          {t('retry')}
        </GaBtn>
      </Notice>
    )
  }

  return <Notice text={t('previewUnsupported')} />
}

function Notice({ text, children }: { text: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-4 py-12 text-center">
      <p className="ga-ui max-w-md text-[14px] text-ga-muted">{text}</p>
      {children}
    </div>
  )
}
