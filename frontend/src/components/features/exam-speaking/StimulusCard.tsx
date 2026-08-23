'use client'

import { useTranslations } from 'next-intl'
import {
  Clock, Smartphone, BookOpen, AppWindow, DoorOpen, Pen, Glasses, KeyRound, Coffee, Wine, Lamp,
  Armchair, Scissors, FileText, Radio, Shirt, ShoppingBag, CircleDot, Apple, Newspaper, Laptop,
  Phone, Table2, Lightbulb, Image as ImageIcon,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { GaCap } from '@/components/ui-v2'

// Bildkarte A1 T3: icon theo iconKey của đề (asset hình thật bổ sung ở đợt sau — Galerie pipeline).
const ICONS: Record<string, LucideIcon> = {
  clock: Clock, smartphone: Smartphone, book: BookOpen, window: AppWindow, door: DoorOpen, pen: Pen,
  glasses: Glasses, key: KeyRound, cup: Coffee, bottle: Wine, lamp: Lamp, chair: Armchair, scissors: Scissors,
  paper: FileText, radio: Radio, jacket: Shirt, bag: ShoppingBag, ball: CircleDot, apple: Apple,
  newspaper: Newspaper, laptop: Laptop, phone: Phone, table: Table2, light: Lightbulb,
}

interface Props {
  stimulus: Record<string, unknown> | null
  /** Bước hiện tại trong Teil — thẻ tự giới thiệu chỉ lộ từ đánh vần/số khi giám khảo yêu cầu. */
  stepIndex: number
  candidateAction: string
}

/**
 * Thẻ đề như trong phòng thi thật: Themenkarte (Thema + Wort), Bildkarte (hình), thẻ từ khóa
 * tự giới thiệu, và fallback khóa–giá trị cho các stimulus khác (A2+ ở đợt sau).
 */
export function StimulusCard({ stimulus, stepIndex, candidateAction }: Props) {
  const t = useTranslations('v2.student.examSpeaking.stimulus')
  if (!stimulus) {
    return (
      <div className="rounded-ga border border-dashed border-ga-line bg-ga-surface p-5 text-center">
        <p className="ga-ui text-[13px] text-ga-muted">{t('none')}</p>
      </div>
    )
  }
  const type = String(stimulus.type ?? '')

  if (type === 'THEME_CARD') {
    const owner = candidateAction === 'ANSWER' ? t('partnerCard') : t('yourCard')
    return (
      <div
        className="rounded-ga border-2 border-ga-ink bg-ga-card p-5 shadow-[6px_6px_0_0_var(--ga-yellow)]"
        data-testid="stimulus-theme-card"
      >
        <GaCap className="mb-3 block">{owner}</GaCap>
        <p className="ga-ui text-[12px] uppercase tracking-wide text-ga-muted">{t('thema')}</p>
        <p className="font-ga-display text-[22px] font-medium text-ga-ink">{String(stimulus.thema ?? '')}</p>
        <p className="ga-ui mt-4 text-[12px] uppercase tracking-wide text-ga-muted">{t('wort')}</p>
        <p className="font-ga-display text-[34px] font-semibold leading-tight text-ga-ink">{String(stimulus.wort ?? '')}</p>
      </div>
    )
  }

  if (type === 'PICTURE_CARD') {
    const Icon = ICONS[String(stimulus.iconKey ?? '')] ?? ImageIcon
    const owner = candidateAction === 'ANSWER' ? t('partnerCard') : t('yourCard')
    return (
      <div
        className="rounded-ga border-2 border-ga-ink bg-ga-card p-5 shadow-[6px_6px_0_0_var(--ga-yellow)]"
        data-testid="stimulus-picture-card"
      >
        <GaCap className="mb-3 block">{owner}</GaCap>
        <div className="grid h-32 place-items-center rounded-ga bg-ga-surface text-ga-ink">
          <Icon size={64} aria-hidden />
        </div>
        <p className="font-ga-display mt-3 text-center text-[22px] font-medium text-ga-ink">
          {String(stimulus.article ?? '')} {String(stimulus.object ?? '')}
        </p>
        <p className="ga-ui mt-1 text-center text-[12.5px] text-ga-muted">{t('pictureHint')}</p>
      </div>
    )
  }

  if (type === 'KEYWORD_CARD') {
    const keywords = Array.isArray(stimulus.keywords) ? (stimulus.keywords as unknown[]).map(String) : []
    return (
      <div className="rounded-ga border-2 border-ga-ink bg-ga-card p-5 shadow-[6px_6px_0_0_var(--ga-yellow)]" data-testid="stimulus-keyword-card">
        <GaCap className="mb-3 block">{t('yourCard')}</GaCap>
        <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5">
          {keywords.map((k) => (
            <li key={k} className="font-ga-display text-[18px] text-ga-ink">{k}</li>
          ))}
        </ul>
        {stepIndex >= 1 && (
          <div className="mt-4 rounded-ga bg-ga-surface p-3">
            <p className="ga-ui text-[12px] uppercase tracking-wide text-ga-muted">{t('spell')}</p>
            <p className="font-ga-display text-[22px] font-medium text-ga-ink">{String(stimulus.spell ?? '')}</p>
          </div>
        )}
        {stepIndex >= 2 && (
          <div className="mt-2 rounded-ga bg-ga-surface p-3">
            <p className="ga-ui text-[12px] uppercase tracking-wide text-ga-muted">{t('number')}</p>
            <p className="font-ga-display text-[22px] font-medium tabular-nums text-ga-ink">{String(stimulus.number ?? '')}</p>
          </div>
        )}
      </div>
    )
  }

  // Fallback: các loại đề đợt sau (A2 lịch tuần, B1 Folien…) vẫn hiện được nội dung thô.
  const entries = Object.entries(stimulus).filter(([k]) => k !== 'type')
  return (
    <div className="rounded-ga border-2 border-ga-ink bg-ga-card p-5" data-testid="stimulus-generic-card">
      <GaCap className="mb-3 block">{t('yourCard')}</GaCap>
      <dl className="space-y-2">
        {entries.map(([k, v]) => (
          <div key={k}>
            <dt className="ga-ui text-[12px] uppercase tracking-wide text-ga-muted">{k}</dt>
            <dd className="ga-ui text-[15px] text-ga-ink">{Array.isArray(v) ? v.map(String).join(', ') : String(v)}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
