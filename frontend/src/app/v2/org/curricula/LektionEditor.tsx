'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { apiMessage } from '@/lib/api'
import {
  deleteLektion,
  replaceItems,
  replaceObjectives,
  updateLektion,
  type CurriculumLektion,
} from '@/lib/orgCurriculumApi'
import { GaBtn, GaCap, ConfirmDialog } from '@/components/ui-v2'
import { parseItemLines, parseObjectiveLines, serializeItems, serializeObjectives } from './parse'

/**
 * Một Lektion trong bản DRAFT: sửa tiêu đề/mô tả, mục nội dung bắt buộc và mục tiêu bằng textarea
 * (mỗi dòng một mục — cú pháp tag ở `parse.ts`). `readonly` khi phiên bản đã PUBLISHED/ARCHIVED.
 * Xóa Lektion đi qua ConfirmDialog nêu hệ quả (plan §2.11).
 */
export function LektionEditor({ lektion, readonly, onChanged }: {
  lektion: CurriculumLektion
  readonly: boolean
  onChanged: () => void
}) {
  const t = useTranslations('v2.org.curricula')
  const [title, setTitle] = useState(lektion.title)
  const [description, setDescription] = useState(lektion.description ?? '')
  const [itemsText, setItemsText] = useState(() => serializeItems(lektion.items))
  const [objectivesText, setObjectivesText] = useState(() => serializeObjectives(lektion.objectives))
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const totalMinutes = lektion.items.reduce((sum, i) => sum + (i.estimatedMinutes ?? 0), 0)

  const save = async (): Promise<void> => {
    setSaving(true)
    try {
      if (title.trim() !== lektion.title || description !== (lektion.description ?? '')) {
        await updateLektion(lektion.id, { title: title.trim(), description })
      }
      await replaceItems(lektion.id, parseItemLines(itemsText))
      await replaceObjectives(lektion.id, parseObjectiveLines(objectivesText))
      toast.success(t('savedToast'))
      onChanged()
    } catch (e) {
      toast.error(apiMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (): Promise<void> => {
    setSaving(true)
    try {
      await deleteLektion(lektion.id)
      toast.success(t('lektionDeletedToast'))
      setConfirmDelete(false)
      onChanged()
    } catch (e) {
      toast.error(apiMessage(e))
    } finally {
      setSaving(false)
    }
  }

  if (readonly) {
    return (
      <div className="border border-ga-line bg-ga-card p-4">
        <GaCap>{t('lektionCap', { no: lektion.orderIndex + 1 })}</GaCap>
        <div className="text-[15px] font-bold text-ga-ink">{lektion.title}</div>
        {lektion.description && (
          <p className="mt-1 text-[13px] leading-relaxed text-ga-muted">{lektion.description}</p>
        )}
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-wide text-ga-muted">
              {t('itemsLabel')} · {t('estimatedTotal', { min: totalMinutes })}
            </div>
            <ul className="mt-1 list-disc pl-5 text-[13px] leading-relaxed text-ga-ink">
              {lektion.items.map((i) => (
                <li key={i.id}>
                  {i.text}
                  <span className="text-ga-muted">
                    {i.skillTag ? ` · ${i.skillTag}` : ''}{i.contentTag ? ` · ${i.contentTag}` : ''}
                    {i.estimatedMinutes != null ? ` · ~${i.estimatedMinutes}′` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-wide text-ga-muted">{t('objectivesLabel')}</div>
            <ul className="mt-1 list-disc pl-5 text-[13px] leading-relaxed text-ga-ink">
              {lektion.objectives.map((o) => (
                <li key={o.id}>
                  {o.text}
                  <span className="text-ga-muted">
                    {o.cefrLevel ? ` · ${o.cefrLevel}` : ''}{o.skillTag ? ` · ${o.skillTag}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="border border-ga-line bg-ga-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <GaCap>{t('lektionCap', { no: lektion.orderIndex + 1 })}</GaCap>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-label={t('lektionTitleLabel')}
            className="mt-1 w-full border border-ga-line bg-ga-bg px-2.5 py-2 text-[14px] font-bold text-ga-ink"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('lektionDescLabel')}
            rows={2}
            className="mt-2 w-full border border-ga-line bg-ga-bg px-2.5 py-2 text-[13px] text-ga-ink"
          />
        </div>
        <button
          type="button"
          className="shrink-0 text-[12px] text-ga-muted underline-offset-2 hover:text-red-700 hover:underline"
          onClick={() => setConfirmDelete(true)}
        >
          {t('deleteLektionBtn')}
        </button>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="ga-ui text-[11.5px] font-semibold uppercase tracking-wide text-ga-muted">
            {t('itemsLabel')} · {t('estimatedTotal', { min: totalMinutes })}
          </span>
          <textarea
            value={itemsText}
            onChange={(e) => setItemsText(e.target.value)}
            rows={6}
            placeholder={t('itemsHint')}
            className="border border-ga-line bg-ga-bg px-2.5 py-2 font-mono text-[12.5px] leading-relaxed text-ga-ink"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="ga-ui text-[11.5px] font-semibold uppercase tracking-wide text-ga-muted">{t('objectivesLabel')}</span>
          <textarea
            value={objectivesText}
            onChange={(e) => setObjectivesText(e.target.value)}
            rows={6}
            placeholder={t('objectivesHint')}
            className="border border-ga-line bg-ga-bg px-2.5 py-2 font-mono text-[12.5px] leading-relaxed text-ga-ink"
          />
        </label>
      </div>
      <p className="mt-1 text-[11.5px] leading-relaxed text-ga-muted">{t('lineSyntaxHint')}</p>

      <div className="mt-2 flex justify-end">
        <GaBtn size="sm" loading={saving} onClick={() => void save()}>{t('saveLektion')}</GaBtn>
      </div>

      {confirmDelete && (
        <ConfirmDialog
          open
          onOpenChange={(o) => { if (!o) setConfirmDelete(false) }}
          title={t('confirmDeleteLektionTitle')}
          description={t('confirmDeleteLektionDesc', { title: lektion.title })}
          details={[
            t('confirmDeleteLektionDetailItems', { count: lektion.items.length }),
            t('confirmDeleteLektionDetailObjectives', { count: lektion.objectives.length }),
          ]}
          confirmLabel={t('confirmDeleteLektionOk')}
          cancelLabel={t('cancel')}
          loading={saving}
          onConfirm={() => void remove()}
        />
      )}
    </div>
  )
}
