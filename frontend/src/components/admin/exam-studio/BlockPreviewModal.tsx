'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { apiMessage } from '@/lib/api'
import { getBlock, type StudioText } from '@/lib/adminExamStudioApi'
import { isMatchHeadline } from '@/lib/examStudioLogic'
import { ErrorBanner, LoadingState, TkModal, GaBtn } from '@/components/ui-v2'
import { TeilPreview, type PreviewItem, type PreviewLayout } from './TeilPreview'

type Block = Awaited<ReturnType<typeof getBlock>>

const str = (v: unknown): string => (typeof v === 'string' ? v : '')
const rec = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}

export interface BlockPreview {
  layout: PreviewLayout
  text: StudioText
  items: PreviewItem[]
  quelle: string | null
  /** T1: bảng 10 tiêu đề a–j của content. */
  headlines: Record<string, string> | null
  startNumber: number
}

/**
 * `content` của block là JSON tự do (hợp đồng API để Record<string, unknown>). Đọc phòng thủ:
 * - T2: dạng lồng `{ text: {...}, items: [...] }` hoặc phẳng `{ titleDe, context, items }`;
 * - T1 (MATCH_HEADLINE, khuôn đề thật): `{ type, headlines: {a..j}, source: { quelle }, items: [{ id, question,
 *   text, correct, explanation_vi, … }] }` — câu không mang phương án, chỉ chữ đáp án trỏ vào `headlines`.
 * Nhận cả camelCase lẫn snake_case.
 */
export function blockContentToPreview(content: Record<string, unknown>): BlockPreview {
  const itemsRaw = Array.isArray(content.items) ? content.items : []
  const source = rec(content.source)
  const isMatch = isMatchHeadline(str(content.type)) || (Number(content.teil) === 1 && content.headlines != null)

  if (isMatch) {
    const headlinesRaw = rec(content.headlines)
    const headlines: Record<string, string> = {}
    for (const k of Object.keys(headlinesRaw).sort()) headlines[k] = str(headlinesRaw[k])
    const items: PreviewItem[] = itemsRaw.map((raw, i) => {
      const r = rec(raw)
      const correct = str(r.correct ?? r.answer) || null
      return {
        id: str(r.id) || `LV1-${i + 1}`,
        question: str(r.question) || `Text ${i + 1}`,
        options: correct ? { [correct]: headlines[correct] ?? '' } : {},
        correct,
        explanationVi: str(r.explanationVi ?? r.explanation_vi) || null,
        text: str(r.text),
      }
    })
    return {
      layout: 'MATCH_HEADLINE',
      text: { titleDe: '', vorspannDe: '', context: items.map((it) => it.text ?? '').join('\n\n'), glossary: [] },
      items,
      quelle: str(source.quelle ?? content.quelle) || null,
      headlines,
      startNumber: 1,
    }
  }

  const textNode = rec(content.text ?? content)
  const glossaryRaw = Array.isArray(textNode.glossary) ? textNode.glossary : []
  const text: StudioText = {
    titleDe: str(textNode.titleDe ?? textNode.title),
    vorspannDe: str(textNode.vorspannDe ?? textNode.vorspann),
    context: str(textNode.context ?? textNode.body),
    glossary: glossaryRaw.map((g) => {
      const r = rec(g)
      return { term: str(r.term), explanationDe: str(r.explanationDe ?? r.explanation_de ?? r.explanation) }
    }),
  }
  const items: PreviewItem[] = itemsRaw.map((raw, i) => {
    const r = rec(raw)
    const opts = rec(r.options)
    const options: Record<string, string> = {}
    for (const k of Object.keys(opts).sort()) options[k] = str(opts[k])
    const correct = str(r.correct ?? r.answer)
    return {
      id: str(r.id) || String(i),
      question: str(r.question),
      options,
      correct: correct && correct in options ? correct : null,
      explanationVi: str(r.explanationVi ?? r.explanation_vi) || null,
    }
  })
  const quelle = str(content.quelle ?? textNode.quelle ?? source.quelle) || null
  return { layout: 'ARTICLE', text, items, quelle, headlines: null, startNumber: Number(content.teil) === 2 || content.teil == null ? 6 : 1 }
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
        <TeilPreview layout={preview.layout} text={preview.text} items={preview.items} quelle={preview.quelle}
          headlines={preview.headlines} showAnswers startNumber={preview.startNumber} />
      )}
    </TkModal>
  )
}
