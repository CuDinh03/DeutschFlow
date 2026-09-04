'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { apiMessage } from '@/lib/api'
import { importCurriculum, type ImportLektionInput } from '@/lib/orgCurriculumApi'
import { GaBtn, TkModal } from '@/components/ui-v2'

/**
 * Nhập bộ giáo trình THẬT thành bản nháp (P03): dán JSON có cấu trúc → tạo bộ + phiên bản 1
 * DRAFT → trung tâm kiểm tra/biên tập → công bố → gán lớp. Validate cấu trúc tối thiểu phía
 * client cho lỗi dễ hiểu; backend vẫn là chốt kiểm cuối (không tin dữ liệu ngoài).
 */

const EXAMPLE = `{
  "name": "Giáo trình A1 của trung tâm",
  "cefrLevel": "A1",
  "sourceNote": "Nhập từ bộ in nội bộ, đợt 09/2026",
  "lektionen": [
    {
      "title": "Lektion 1 — Erste Kontakte",
      "description": "Chào hỏi, giới thiệu",
      "items": [
        { "text": "Chào hỏi và tạm biệt", "skillTag": "SPRECHEN", "contentTag": "REDEMITTEL", "estimatedMinutes": 120 }
      ],
      "objectives": [
        { "text": "Ich kann mich begrüßen.", "cefrLevel": "A1", "skillTag": "SPRECHEN" }
      ]
    }
  ]
}`

interface ParsedImport {
  name: string
  cefrLevel?: string | null
  description?: string | null
  sourceNote?: string | null
  lektionen: ImportLektionInput[]
}

function parseImportJson(raw: string): { ok: true; value: ParsedImport } | { ok: false; error: string } {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return { ok: false, error: 'json' }
  }
  if (typeof data !== 'object' || data === null) return { ok: false, error: 'shape' }
  const obj = data as Record<string, unknown>
  if (typeof obj.name !== 'string' || obj.name.trim() === '') return { ok: false, error: 'name' }
  if (!Array.isArray(obj.lektionen) || obj.lektionen.length === 0) return { ok: false, error: 'lektionen' }
  for (const lek of obj.lektionen) {
    if (typeof lek !== 'object' || lek === null) return { ok: false, error: 'lektionen' }
    const l = lek as Record<string, unknown>
    if (typeof l.title !== 'string' || l.title.trim() === '') return { ok: false, error: 'lektionTitle' }
    if (l.items !== undefined && !Array.isArray(l.items)) return { ok: false, error: 'items' }
    if (l.objectives !== undefined && !Array.isArray(l.objectives)) return { ok: false, error: 'items' }
  }
  return { ok: true, value: data as unknown as ParsedImport }
}

export function ImportModal({ open, onClose, onImported }: {
  open: boolean
  onClose: () => void
  onImported: () => void
}) {
  const t = useTranslations('v2.org.curricula')
  const [json, setJson] = useState('')
  const [parseError, setParseError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)

  const submit = async (): Promise<void> => {
    const parsed = parseImportJson(json)
    if (!parsed.ok) {
      setParseError(parsed.error)
      return
    }
    setParseError(null)
    setImporting(true)
    try {
      await importCurriculum({
        name: parsed.value.name,
        cefrLevel: parsed.value.cefrLevel ?? null,
        description: parsed.value.description ?? null,
        sourceNote: parsed.value.sourceNote ?? null,
        lektionen: parsed.value.lektionen.map((l) => ({
          title: l.title,
          description: l.description ?? null,
          items: l.items ?? [],
          objectives: l.objectives ?? [],
        })),
      })
      toast.success(t('importedToast'))
      setJson('')
      onImported()
    } catch (e) {
      toast.error(apiMessage(e))
    } finally {
      setImporting(false)
    }
  }

  return (
    <TkModal open={open} onOpenChange={(o) => { if (!o) onClose() }} title={t('importTitle')} size="lg">
      <div className="flex flex-col gap-3">
        <p className="text-[13px] leading-relaxed text-ga-muted">{t('importHint')}</p>
        <textarea
          value={json}
          onChange={(e) => { setJson(e.target.value); setParseError(null) }}
          rows={14}
          placeholder={EXAMPLE}
          className="border border-ga-line bg-ga-bg px-2.5 py-2 font-mono text-[12px] leading-relaxed text-ga-ink"
        />
        {parseError && (
          <p className="text-[12.5px] font-semibold text-red-700">
            {t(`importError_${parseError}`)}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <GaBtn variant="ghost" onClick={onClose}>{t('cancel')}</GaBtn>
          <GaBtn loading={importing} disabled={json.trim() === ''} onClick={() => void submit()}>
            {t('importSubmit')}
          </GaBtn>
        </div>
      </div>
    </TkModal>
  )
}
