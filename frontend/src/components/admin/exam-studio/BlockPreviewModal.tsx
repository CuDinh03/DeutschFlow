'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { apiMessage } from '@/lib/api'
import { getBlock, type StudioAudioTurn, type StudioText } from '@/lib/adminExamStudioApi'
import { isMatchHeadline, teilKind, type TeilKind } from '@/lib/examStudioLogic'
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
  /** Sprachbausteine: thư có ô `___21___`. */
  gappedText: string | null
}

const strMap = (v: unknown): Record<string, string> => {
  const r = rec(v)
  const out: Record<string, string> = {}
  for (const k of Object.keys(r).sort()) out[k] = str(r[k])
  return out
}

/**
 * Content kho của các Teil soạn theo tình huống (khuôn đề telc thật, snake_case — SituationalTeile.content):
 * - MATCH_AD_X: `examples` [{label, situation, answer}], `ads` {a..l}, `allow_none`, items[].question;
 * - GAP_MC: `gapped_text` có `___21___`, items[].gap + options;
 * - GAP_WORDBANK: `stimulus_ad`, `word_bank` {a..o}, `gapped_text`, items[].gap + correct;
 * - WRITE_EMAIL: `stimulus` {from, subject, body}, `writing_points`.
 */
function situationalPreview(kind: TeilKind, content: Record<string, unknown>): BlockPreview {
  const itemsRaw = Array.isArray(content.items) ? content.items : []
  const items: PreviewItem[] = itemsRaw.map((raw, i) => {
    const r = rec(raw)
    const gap = r.gap != null ? String(r.gap) : null
    return {
      id: str(r.id) || String(i),
      question: str(r.question),
      options: strMap(r.options),
      correct: str(r.correct ?? r.answer) || null,
      explanationVi: str(r.explanationVi ?? r.explanation_vi) || null,
      meta: gap ? { gap } : null,
    }
  })
  const examplesRaw = Array.isArray(content.examples) ? content.examples : []
  const st = rec(content.stimulus)
  const text: StudioText = {
    titleDe: '', vorspannDe: '', context: '', glossary: [],
    ads: kind === 'MATCH_AD_X' ? strMap(content.ads) : null,
    examples: examplesRaw.map((e) => {
      const r = rec(e)
      return { label: str(r.label), situation: str(r.situation), answer: str(r.answer) }
    }),
    stimulusAd: str(content.stimulus_ad ?? content.stimulusAd) || null,
    wordBank: kind === 'GAP_WORDBANK' ? strMap(content.word_bank ?? content.wordBank) : null,
    stimulus: kind === 'WRITE_EMAIL'
      ? { type: str(st.type) || 'EMAIL', from: str(st.from), subject: str(st.subject), body: str(st.body) }
      : null,
    writingPoints: Array.isArray(content.writing_points) ? content.writing_points.map(str) : null,
  }
  const first = { MATCH_AD_X: 11, GAP_MC: 21, GAP_WORDBANK: 31 } as Partial<Record<TeilKind, number>>
  return {
    layout: kind, text, items, headlines: null,
    quelle: str(rec(content.source).quelle ?? content.quelle) || null,
    startNumber: first[kind] ?? 1,
    gappedText: str(content.gapped_text ?? content.gappedText) || null,
  }
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
  // Schreiben không ghi `type` trong content — nhận ra qua `stimulus` + `writing_points`.
  // Phần Nghe cũng không ghi `type` (đúng khuôn đề viết tay) — nhận ra qua `ansage_de` / `max_plays`.
  if (content.ansage_de != null || content.max_plays != null) return hoerenBlockPreview(content)
  const kind = content.writing_points != null && content.stimulus != null ? 'WRITE_EMAIL' : teilKind(str(content.type))
  if (kind === 'FILL_FORM') return formBlockPreview(content)
  if (kind === 'WRITE_NOTE') return noteBlockPreview(content)
  // TRUE_FALSE (telc A2 Lesen 2) dựng như bài đọc, câu không khai options ⇒ gắn richtig/falsch.
  if (kind !== 'ARTICLE' && kind !== 'MATCH_HEADLINE' && kind !== 'TRUE_FALSE') return situationalPreview(kind, content)
  const trueFalse = kind === 'TRUE_FALSE'

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
      gappedText: null,
    }
  }

  const textNode = rec(content.text ?? content)
  const glossaryRaw = Array.isArray(textNode.glossary) ? textNode.glossary : []
  const text: StudioText = {
    titleDe: str(textNode.titleDe ?? textNode.title_de ?? textNode.title),
    vorspannDe: str(textNode.vorspannDe ?? textNode.vorspann_de ?? textNode.vorspann),
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
    if (trueFalse && Object.keys(options).length === 0) Object.assign(options, { richtig: 'richtig', falsch: 'falsch' })
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
  return {
    layout: trueFalse ? 'TRUE_FALSE' : 'ARTICLE', text, items, quelle, headlines: null, gappedText: null,
    startNumber: Number(content.teil) === 2 || content.teil == null ? 6 : 1,
  }
}

/**
 * Phần Nghe (content kho, khuôn phần HOEREN của đề viết tay): T2 có `audio_script` cấp Teil là mảng lượt lời
 * `{speaker, name, text}`; T1/T3 mỗi câu mang `speaker` + `audio_script` (T3 thêm `lead_in_de`), T1 có `framing_de`.
 */
function hoerenBlockPreview(content: Record<string, unknown>): BlockPreview {
  const itemsRaw = Array.isArray(content.items) ? content.items : []
  const voice = (v: unknown): StudioAudioTurn['speaker'] => (str(v) === 'PARTNER' ? 'PARTNER' : 'PRUEFER')
  const interview = Array.isArray(content.audio_script)
  const layout: PreviewLayout = interview ? 'HOEREN_INTERVIEW'
    : itemsRaw.some((raw) => rec(raw).lead_in_de != null) ? 'HOEREN_ANNOUNCEMENTS' : 'HOEREN_STATEMENTS'
  const audioTurns: StudioAudioTurn[] = interview
    ? (content.audio_script as unknown[]).map((raw) => {
      const r = rec(raw)
      return { speaker: voice(r.speaker), name: str(r.name) || null, text: str(r.text), leadInDe: null }
    })
    : itemsRaw.map((raw) => {
      const r = rec(raw)
      return { speaker: voice(r.speaker), name: null, text: str(r.audio_script), leadInDe: str(r.lead_in_de) || null }
    })
  const items: PreviewItem[] = itemsRaw.map((raw, i) => {
    const r = rec(raw)
    return {
      id: str(r.id) || String(i),
      question: str(r.question),
      options: { richtig: 'richtig', falsch: 'falsch' },
      correct: str(r.correct) || null,
      explanationVi: str(r.explanation_vi ?? r.explanationVi) || null,
    }
  })
  const first = { HOEREN_STATEMENTS: 41, HOEREN_INTERVIEW: 46, HOEREN_ANNOUNCEMENTS: 56 } as Partial<Record<TeilKind, number>>
  return {
    layout, items, headlines: null, gappedText: null, quelle: null, startNumber: first[layout] ?? 1,
    text: {
      titleDe: '', vorspannDe: '', context: audioTurns.map((x) => x.text).join('\n\n'), glossary: [],
      audioTurns, framingDe: str(content.framing_de) || null,
    },
  }
}

/** telc A2 Schreiben 1 (content kho): `context`, `form_title`, `form_fields[{field, answer, accept, explanation_vi}]`. */
function formBlockPreview(content: Record<string, unknown>): BlockPreview {
  const fields = Array.isArray(content.form_fields) ? content.form_fields : []
  const items: PreviewItem[] = fields.map((raw, i) => {
    const r = rec(raw)
    const accept = Array.isArray(r.accept) ? r.accept.map(str).filter(Boolean) : []
    return {
      id: `SA1-${i + 1}`,
      question: str(r.field),
      options: {},
      correct: str(r.answer) || null,
      explanationVi: str(r.explanation_vi ?? r.explanationVi) || null,
      meta: accept.length ? { accept: accept.join('|') } : null,
    }
  })
  return {
    layout: 'FILL_FORM', items, headlines: null, gappedText: null, startNumber: 1,
    text: { titleDe: str(content.form_title), vorspannDe: '', context: str(content.context), glossary: [] },
    quelle: null,
  }
}

/** telc A2 Schreiben 2 (content kho): `prompt` (tình huống), `writing_points`, `choose_points`, `word_target`. */
function noteBlockPreview(content: Record<string, unknown>): BlockPreview {
  return {
    layout: 'WRITE_NOTE', items: [], headlines: null, gappedText: null, startNumber: 1, quelle: null,
    text: {
      titleDe: '', vorspannDe: '', context: '', glossary: [],
      stimulus: { type: 'SITUATION', from: '', subject: '', body: str(content.prompt) },
      writingPoints: Array.isArray(content.writing_points) ? content.writing_points.map(str) : [],
    },
  }
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
          headlines={preview.headlines} gappedText={preview.gappedText} showAnswers startNumber={preview.startNumber} />
      )}
    </TkModal>
  )
}
