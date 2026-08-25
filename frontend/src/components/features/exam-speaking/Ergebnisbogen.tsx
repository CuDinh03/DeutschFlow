'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronDown, ChevronUp, ShieldAlert } from 'lucide-react'
import { GaCap, TkBadge } from '@/components/ui-v2'
import type { CriterionResult, ScoreSheet } from '@/types/exam-speaking'

interface Props {
  sheet: ScoreSheet
}

const BAND_TONE: Record<string, 'green' | 'teal' | 'yellow' | 'red' | 'neutral'> = {
  A: 'green', B: 'teal', C: 'yellow', D: 'red', E: 'red', VOLL: 'green', HALB: 'yellow', NULL: 'red',
}

/** 0.75 → "0.75", 2.5 → "2.5", 20 → "20" (thang A1 có bước 0,75 — không làm tròn mất dữ liệu). */
function fmt(n: number): string {
  return Number(n.toFixed(2)).toString()
}

/**
 * Phiếu kết quả mô phỏng Bewertungsbogen của hệ (Goethe A–E / telc A–D / A1 volle-halbe-null).
 * Trung thực theo kế hoạch 2.4: tổng là KHOẢNG + tâm, mỗi tiêu chí có bằng chứng + nhãn tin cậy,
 * tiêu chí chưa chấm được ghi rõ thay vì bịa số.
 */
export function Ergebnisbogen({ sheet }: Props) {
  const t = useTranslations('v2.student.examSpeaking.result')
  const reduced = sheet.maxPoints + 0.01 < sheet.officialMax
  const range = sheet.totalLow !== sheet.totalHigh ? `${fmt(sheet.totalLow)}–${fmt(sheet.totalHigh)}` : null
  return (
    <section className="space-y-5" data-testid="ergebnisbogen">
      <header className="rounded-ga border-2 border-ga-ink bg-ga-card p-5 shadow-[6px_6px_0_0_var(--ga-yellow)]">
        <GaCap className="mb-1 block">
          {sheet.rubricRef.provider === 'GOETHE' ? 'Goethe-Zertifikat' : 'telc Deutsch'} {sheet.rubricRef.level} · {t('sheetCap')}
        </GaCap>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-ga-display text-[40px] font-semibold leading-none text-ga-ink" data-testid="result-total">
              {fmt(sheet.total)}
              <span className="text-[18px] font-medium text-ga-muted"> / {fmt(sheet.maxPoints)}</span>
            </p>
            {range && (
              <p className="ga-ui mt-1 text-[13px] text-ga-muted">{t('range', { range, passes: sheet.passes })}</p>
            )}
          </div>
          {sheet.passed === null ? (
            <TkBadge tone="neutral">{t('noThreshold')}</TkBadge>
          ) : sheet.passed ? (
            <TkBadge tone="green" data-testid="result-passed">{t('passed')}</TkBadge>
          ) : (
            <TkBadge tone="red" data-testid="result-failed">{t('failed')}</TkBadge>
          )}
        </div>
        <p className="ga-ui mt-3 text-[13px] text-ga-ink">{sheet.passRule}</p>
        {reduced && (
          <p className="ga-ui mt-1 text-[12.5px] text-ga-muted">{t('reducedMax', { max: fmt(sheet.maxPoints), official: fmt(sheet.officialMax) })}</p>
        )}
      </header>

      {sheet.parts.map((p) => (
        <div key={p.teilNo} className="rounded-ga border border-ga-line bg-ga-card p-4" data-testid={`result-part-${p.teilNo}`}>
          <div className="mb-2 flex items-center justify-between">
            <p className="font-ga-display text-[18px] font-medium text-ga-ink">{t('teil', { n: p.teilNo })}</p>
            <p className="ga-ui text-[14px] font-semibold text-ga-ink">{fmt(p.points)} / {fmt(p.max)}</p>
          </div>
          {p.zeroed && (
            <p className="ga-ui mb-2 inline-flex items-center gap-1.5 text-[12.5px] text-ga-red">
              <ShieldAlert size={14} aria-hidden /> {t('zeroed')}
            </p>
          )}
          {p.comment && (
            <p className="ga-ui mb-2 rounded-ga bg-ga-surface px-3 py-2 text-[13px] italic text-ga-ink" data-testid={`part-comment-${p.teilNo}`}>
              {p.comment}
            </p>
          )}
          <ul className="divide-y divide-ga-line">
            {p.criteria.map((c) => (
              <CriterionRow key={c.code} c={c} />
            ))}
          </ul>
        </div>
      ))}

      {sheet.global.length > 0 && (
        <div className="rounded-ga border border-ga-line bg-ga-card p-4" data-testid="result-global">
          <p className="font-ga-display mb-2 text-[18px] font-medium text-ga-ink">{t('global')}</p>
          <ul className="divide-y divide-ga-line">
            {sheet.global.map((c) => (
              <CriterionRow key={c.code} c={c} />
            ))}
          </ul>
        </div>
      )}

      {sheet.errors.length > 0 && (
        <div className="rounded-ga border border-ga-line bg-ga-card p-4">
          <p className="font-ga-display mb-2 text-[18px] font-medium text-ga-ink">{t('errors', { n: sheet.errors.length })}</p>
          <ul className="space-y-1.5">
            {sheet.errors.slice(0, 25).map((e, i) => (
              <li key={i} className="ga-ui text-[13.5px]">
                <span className="text-ga-red line-through">{e.original}</span>
                <span className="mx-1.5 text-ga-muted">→</span>
                <span className="font-semibold text-ga-green">{e.correction}</span>
                <span className="ml-1.5 text-[11px] text-ga-muted">{e.code} · T{e.teilNo}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {sheet.notes.length > 0 && (
        <ul className="ga-ui list-disc space-y-1 pl-5 text-[12.5px] text-ga-muted">
          {sheet.notes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      )}
      <p className="ga-ui rounded-ga bg-ga-surface p-3 text-[12.5px] text-ga-muted" data-testid="result-disclaimer">
        {t('disclaimer')}
      </p>
    </section>
  )
}

function CriterionRow({ c }: { c: CriterionResult }) {
  const t = useTranslations('v2.student.examSpeaking.result')
  const [open, setOpen] = useState(false)
  return (
    <li className="py-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="ga-ui flex-1 text-[14px] text-ga-ink">{c.label || c.code}</span>
        {c.scored && c.band ? (
          <TkBadge tone={BAND_TONE[c.band] ?? 'neutral'}>{c.band}</TkBadge>
        ) : (
          <TkBadge tone="neutral">{t('notScored')}</TkBadge>
        )}
        <span className="ga-ui w-16 text-right text-[13.5px] font-semibold tabular-nums text-ga-ink">
          {c.scored ? `${fmt(c.points)}/${fmt(c.max)}` : `–/${fmt(c.max)}`}
        </span>
        <span className="ga-ui w-20 text-right text-[11px] text-ga-muted">{t(`confidence.${c.confidence || 'none'}`)}</span>
        {c.evidence.length > 0 && (
          <button
            type="button"
            className="ga-ui inline-flex items-center gap-1 text-[12px] text-ga-accent"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
          >
            {t('evidence')} {open ? <ChevronUp size={12} aria-hidden /> : <ChevronDown size={12} aria-hidden />}
          </button>
        )}
      </div>
      {open && (
        <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
          {c.evidence.map((e, i) => (
            <li key={i} className="ga-ui text-[12.5px] text-ga-muted">{e}</li>
          ))}
        </ul>
      )}
    </li>
  )
}
