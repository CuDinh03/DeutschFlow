'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { apiMessage } from '@/lib/api'
import { getBlock, type OptionKey, type StudioText } from '@/lib/adminExamStudioApi'
import { ErrorBanner, LoadingState, TkModal, GaBtn } from '@/components/ui-v2'
import { TeilPreview, type PreviewItem } from './TeilPreview'

type Block = Awaited<ReturnType<typeof getBlock>>

const str = (v: unknown): string => (typeof v === 'string' ? v : '')
const rec = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}

/**
 * `content` của block là JSON tự do (hợp đồng API để Record<string, unknown>). Đọc phòng thủ:
 * nhận cả dạng lồng `{ text: {...}, items: [...] }` lẫn dạng phẳng `{ titleDe, context, items }`.
 */
export function blockContentToPreview(content: Record<string, unknown>): {
  text: StudioText
  items: PreviewItem[]
  quelle: string | null
} {
  const textNode = rec(content.text ?? content)
  const glossaryRaw = Array.isArray(textNode.glossary) ? textNode.glossary : []
  const text: StudioText = {
    titleDe: str(textNode.titleDe ?? textNode.title),
    vorspannDe: str(textNode.vorspannDe ?? textNode.vorspann),
    context: str(textNode.context ?? textNode.body),
    glossary: glossaryRaw.map((g) => {
      const r = rec(g)
      return { term: str(r.term), explanationDe: str(r.explanationDe ?? r.explanation) }
    }),
  }
  const itemsRaw = Array.isArray(content.items) ? content.items : []
  const items: PreviewItem[] = itemsRaw.map((raw, i) => {
    const r = rec(raw)
    const opts = rec(r.options)
    const correct = str(r.correct ?? r.answer)
    return {
      id: str(r.id) || String(i),
      question: str(r.question),
      options: { a: str(opts.a), b: str(opts.b), c: str(opts.c) },
      correct: correct === 'a' || correct === 'b' || correct === 'c' ? (correct as OptionKey) : null,
      explanationVi: str(r.explanationVi) || null,
    }
  })
  const quelle = str(content.quelle ?? textNode.quelle) || null
  return { text, items, quelle }
}

export function BlockPreviewModal({ blockId, onClose }: { blockId: number | null; onClose: () => void }) {
  const t = useTranslations('v2.adminContent.examStudio')
  const tc = useTranslations('v2.common')
  const [block, setBlock] = useState<Block | null>(null)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)

  useEffect(() => {
    if (blockId == null) return
    let alive = true
    setBlock(null)
    setError('')
    getBlock(blockId)
      .then((b) => { if (alive) setBlock(b) })
      .catch((e: unknown) => { if (alive) setError(apiMessage(e)) })
    return () => { alive = false }
  }, [blockId, reload])

  const preview = block ? blockContentToPreview(block.content ?? {}) : null

  return (
    <TkModal
      open={blockId != null}
      onOpenChange={(o) => { if (!o) onClose() }}
      size="lg"
      title={block?.titleDe || t('blocks.previewTitle', { id: blockId ?? 0 })}
      description={block ? `${block.examFormat} · ${block.cefrLevel} · ${block.section} · Teil ${block.teil}${block.theme ? ` · ${block.theme}` : ''}` : undefined}
      footer={<GaBtn variant="ghost" size="sm" onClick={onClose}>{tc('close')}</GaBtn>}
    >
      {error ? (
        <ErrorBanner title={t('blocks.loadError')} message={error} onRetry={() => setReload((n) => n + 1)} />
      ) : !preview ? (
        <LoadingState label={t('loading')} />
      ) : (
        <TeilPreview text={preview.text} items={preview.items} quelle={preview.quelle} showAnswers startNumber={6} />
      )}
    </TkModal>
  )
}
