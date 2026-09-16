'use client'

import { useLocale, useTranslations } from 'next-intl'
import Link from 'next/link'
import { Check, Clock, X } from 'lucide-react'
import { pendingGates, type ExamGate } from './examGates'

/** Nhãn của từng cổng; cổng lạ dùng nhãn chung chứ không in khoá máy ra màn hình. */
const GATE_LABEL: Record<string, string> = {
  written: 'gateWritten',
  oral: 'gateOral',
}

const STATUS_STYLE: Record<string, { icon: typeof Check; color: string; labelKey: string }> = {
  PASSED: { icon: Check, color: 'var(--ga-green)', labelKey: 'gatePassed' },
  FAILED: { icon: X, color: 'var(--ga-red)', labelKey: 'gateFailed' },
  PENDING: { icon: Clock, color: 'var(--ga-muted)', labelKey: 'gatePending' },
}

/**
 * Bảng hai ngưỡng đỗ độc lập của đề telc. Có mặt khi và chỉ khi đề khai nhiều cổng, nên đề Goethe
 * không thấy gì đổi.
 *
 * <p>Điểm cổng Nói đến từ một phiên của module luyện thi nói, nên **phải nói rõ lấy từ lần thi
 * ngày nào** — bằng không một kết luận ĐỖ/TRƯỢT hiện ra mà học viên không truy được từ đâu.
 */
export function ExamGatePanel({ gates }: { gates: ExamGate[] }) {
  const t = useTranslations('v2.student.mockExamRun')
  const locale = useLocale()
  if (gates.length === 0) return null

  const conThieu = pendingGates(gates)

  return (
    <section className="rounded-ga border border-ga-line bg-ga-card p-4 lg:p-6">
      <h3 className="ga-ui mb-1 text-ga-caption font-bold uppercase tracking-wide text-ga-muted">
        {t('gatesTitle')}
      </h3>
      <p className="ga-ui mb-4 text-ga-small text-ga-muted">{t('gatesHint')}</p>

      <ul className="space-y-3">
        {gates.map((gate) => {
          const style = STATUS_STYLE[gate.status] ?? STATUS_STYLE.PENDING
          const Icon = style.icon
          const label = GATE_LABEL[gate.id] ? t(GATE_LABEL[gate.id]) : t('gateOther')
          const daThi = gate.status !== 'PENDING'
          return (
            <li key={gate.id} className="flex min-w-0 items-start gap-3 border-b border-ga-line pb-3 last:border-0 last:pb-0">
              <span
                className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full"
                style={{ background: style.color }}
              >
                <Icon size={15} className="text-white" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="ga-ui break-words text-ga-body font-semibold text-ga-ink">{label}</p>
                <p className="ga-ui text-ga-small text-ga-muted">
                  {daThi
                    ? t('gateScore', { raw: gate.raw, max: gate.max, min: gate.min })
                    : t('gateThresholdOnly', { min: gate.min, max: gate.max })}
                </p>
                {gate.achievedAt && (
                  <p className="ga-ui mt-0.5 text-ga-caption text-ga-subtle">
                    {t('gateFromSession', {
                      date: new Date(gate.achievedAt).toLocaleDateString(locale),
                    })}
                  </p>
                )}
              </div>
              <span className="ga-ui shrink-0 text-ga-small font-bold" style={{ color: style.color }}>
                {t(style.labelKey)}
              </span>
            </li>
          )
        })}
      </ul>

      {/* Còn cổng nào chưa thi thì chỉ luôn đường đi tiếp — "chưa đủ kết luận" mà không nói phải
          làm gì tiếp là một ngõ cụt. */}
      {conThieu.some((g) => g.id === 'oral') && (
        <Link
          href="/v2/student/exam"
          className="ga-ui mt-4 inline-flex min-h-11 items-center rounded-ga bg-ga-accent px-4 py-2 text-ga-small font-bold text-ga-accent-ink transition-opacity hover:opacity-90"
        >
          {t('gateGoToSpeaking')}
        </Link>
      )}
    </section>
  )
}
