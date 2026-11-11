'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { BadgeCheck, Eye, ShieldCheck } from 'lucide-react'
import {
  approveDraft, patchDraft, verifyDraft,
  type ChecklistKey,
} from '@/lib/adminExamStudioApi'
import { CHECKLIST_KEYS, approveBlockers, blockIdFromDetail, firstItemNumber, teilKind } from '@/lib/examStudioLogic'
import { GaBtn, GaCap, GaCard, GaGlyph, TkBadge } from '@/components/ui-v2'
import { BlockPreviewModal } from './BlockPreviewModal'
import { TeilPreview } from './TeilPreview'
import { LightDot, Note, WarningsBanner, studioMiniBtn, type StudioStepProps } from './ui'

/** Bước 5 — Kiểm & duyệt: tự kiểm, checklist 8 mục owner tích tay, Quelle, xem như học viên, duyệt. */
export function StepReview({ draft, locked, run }: StudioStepProps) {
  const t = useTranslations('v2.adminContent.examStudio')
  const [showAnswers, setShowAnswers] = useState(false)
  const [previewBlock, setPreviewBlock] = useState<number | null>(null)
  const kind = teilKind(draft.teilType)
  const writing = draft.itemCount === 0
  const firstNumber = firstItemNumber(kind, draft.teil)
  const checklist = draft.reviewChecklist ?? {}
  const blockers = approveBlockers(draft, checklist)
  const approved = draft.status === 'APPROVED'

  const tick = (k: ChecklistKey, v: boolean) =>
    run(() => patchDraft(draft.id, { reviewChecklist: { ...checklist, [k]: v } }))

  const approve = () => {
    const full = Object.fromEntries(CHECKLIST_KEYS.map((k) => [k, checklist[k] === true])) as Record<ChecklistKey, boolean>
    return run(() => approveDraft(draft.id, full), t('review.approvedToast'))
  }

  // Mục "Dữ kiện khớp nguồn": máy không phán đạt / chưa đạt mà nêu số câu owner cần đọc.
  const toRead = draft.checks.find((c) => c.key === 'FAITHFUL')?.count ?? null

  const suggestion = (k: ChecklistKey) => {
    const s = draft.checklistSuggestions?.[k]
    return s === true ? 'PASS' : s === false ? 'FAIL' : 'UNKNOWN'
  }

  return (
    <div className="flex flex-col gap-4">
      {approved && (
        <GaCard className="flex flex-wrap items-center gap-3 border-ga-green p-4 sm:p-5">
          <GaGlyph icon={BadgeCheck} tone="green" />
          <div className="min-w-0 flex-1">
            <p className="ga-ui text-ga-h3 text-ga-ink">{t('review.approvedTitle')}</p>
            <p className="ga-ui text-ga-small text-ga-muted">{t('review.approvedBody', { id: draft.blockId ?? '—' })}</p>
          </div>
          <Link href="/v2/admin/exam-studio?tab=blocks"
            className="ga-ui inline-flex min-h-11 items-center rounded-ga border border-ga-line bg-ga-card px-3 text-ga-small font-semibold text-ga-ink hover:bg-ga-surface lg:min-h-9">
            {t('review.toBlocks')}
          </Link>
        </GaCard>
      )}

      <WarningsBanner warnings={draft.warnings} />

      <GaCard className="flex flex-col gap-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <GaBtn variant="yellow" size="sm" disabled={locked || (writing ? !draft.text : draft.items.length === 0)} onClick={() => run(() => verifyDraft(draft.id))}>
            <ShieldCheck size={14} aria-hidden /> {t('review.verify')}
          </GaBtn>
          <span className="ga-ui text-ga-caption text-ga-muted">{t('review.verifyHint')}</span>
        </div>
        {draft.checks.length === 0 ? (
          <p className="ga-ui text-ga-small text-ga-muted">{t('review.noChecks')}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-ga-line">
            {draft.checks.map((c) => {
              // Chống trùng: check DUPLICATE đỏ → chỉ rõ Teil kho bị trùng và cho mở xem.
              const dupId = c.key === 'DUPLICATE' && c.light === 'RED' ? blockIdFromDetail(c.detail) : null
              return (
                <li key={c.key} className="flex items-start gap-2.5 py-2">
                  <LightDot light={c.light} className="mt-1.5" />
                  <div className="min-w-0 flex-1">
                    <p className="ga-ui text-ga-small font-semibold text-ga-ink">{c.label}</p>
                    {c.detail && <p className="ga-ui whitespace-pre-wrap break-words text-ga-caption text-ga-muted">{c.detail}</p>}
                    {dupId != null && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <TkBadge tone="red" variant="solid">{t('review.duplicateOf', { id: dupId })}</TkBadge>
                        <button type="button" className={studioMiniBtn} onClick={() => setPreviewBlock(dupId)}>
                          <Eye size={13} aria-hidden /> {t('review.viewBlock')}
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </GaCard>

      <GaCard className="flex flex-col gap-3 p-4 sm:p-5">
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5"><GaCap>{t('review.checklist')}</GaCap></legend>
          {CHECKLIST_KEYS.map((k) => {
            const s = suggestion(k)
            return (
              <label key={k} className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 rounded-ga border border-ga-line px-3 py-2">
                <input type="checkbox" checked={checklist[k] === true} disabled={locked}
                  onChange={(e) => void tick(k, e.target.checked)} style={{ accentColor: 'var(--ga-accent)' }} />
                <span className="ga-ui min-w-0 flex-1 text-ga-small font-semibold text-ga-ink">
                  {t(`checklist.${k}`)}
                  {writing && k === 'SINGLE_ANSWER' && (
                    <span className="block text-ga-caption font-normal text-ga-muted">{t('review.notApplicableWriting')}</span>
                  )}
                </span>
                {k === 'FACTS_MATCH' && toRead != null ? (
                  <TkBadge tone={toRead === 0 ? 'green' : 'yellow'}>{t('review.machine.toRead', { count: toRead })}</TkBadge>
                ) : (
                  <TkBadge tone={s === 'PASS' ? 'green' : s === 'FAIL' ? 'red' : 'neutral'}>
                    {t(`review.machine.${s}`)}
                  </TkBadge>
                )}
              </label>
            )
          })}
        </fieldset>

        <div>
          <GaCap className="mb-1 block">{t('review.quelle')}</GaCap>
          <p className="ga-ui break-words rounded-ga bg-ga-surface px-3 py-2 text-ga-small italic text-ga-ink" lang="de">
            {draft.quelle || t('review.quelleNone')}
          </p>
        </div>

        {!approved && (
          <div className="flex flex-col gap-2 border-t border-ga-line pt-3">
            {blockers.filter((b) => b !== 'BUSY' && b !== 'NOT_DRAFT').map((b) => (
              <Note key={b} tone={b === 'CHECKLIST' || b === 'NO_ITEMS' ? 'yellow' : 'red'}>{t(`review.blocker.${b}`)}</Note>
            ))}
            <div>
              <GaBtn variant="primary" size="md" disabled={locked || blockers.length > 0} onClick={approve}>
                <BadgeCheck size={15} aria-hidden /> {t('review.approve')}
              </GaBtn>
            </div>
          </div>
        )}
      </GaCard>

      {draft.text && (
        <section aria-labelledby="review-preview-h" className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id="review-preview-h"><GaCap>{t('review.preview')}</GaCap></h3>
            <label className="ga-ui flex items-center gap-1.5 text-ga-caption text-ga-muted">
              <input type="checkbox" checked={showAnswers} onChange={(e) => setShowAnswers(e.target.checked)}
                style={{ accentColor: 'var(--ga-accent)' }} />
              {t('review.showAnswers')}
            </label>
          </div>
          <TeilPreview text={draft.text} items={draft.items} quelle={draft.quelle} showAnswers={showAnswers}
            startNumber={firstNumber} layout={kind} />
        </section>
      )}

      <BlockPreviewModal blockId={previewBlock} onClose={() => setPreviewBlock(null)} />
    </div>
  )
}
