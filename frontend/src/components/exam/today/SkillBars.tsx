'use client'

import * as React from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ChevronRight, Mic, Play } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Bar, Glyph, SECTION_ICON, STATUS_TEXT_CLASS } from './visual'
import type { Skill } from './todayModel'

interface Props {
  skills: Skill[]
  /** Link mở Teil yếu nhất của một kỹ năng; `null` khi không có đề nào mở được Teil đó. */
  teilHref: (key: string) => string | null
  oralHref: string
}

/**
 * Bốn kỹ năng (màn Hôm nay): ô icon · tên · thanh có vạch 60% · % + trạng thái · mũi tên. Bấm một kỹ
 * năng mở điểm từng Teil và nút luyện Teil yếu nhất; một kỹ năng mở một lúc.
 */
export function SkillBars({ skills, teilHref, oralHref }: Props) {
  const t = useTranslations('v2.student.examHub')
  const tp = useTranslations('v2.student.practice')
  const [open, setOpen] = React.useState<string | null>(null)
  const teilName = (section: string, teil: number) =>
    section === 'SPRECHEN' ? `Sprechen T${teil}` : `${t(`short.${section}`)} T${teil}`

  return (
    <div className="border-t border-ga-line">
      {skills.map((s) => {
        const expanded = open === s.id
        const panelId = `skill-${s.id}`
        const weakHref = s.id === 'SPRECHEN' ? oralHref : s.weakest ? teilHref(s.weakest.key) : null
        return (
          <div key={s.id} className="border-b border-ga-line">
            <button
              type="button"
              aria-expanded={expanded}
              aria-controls={panelId}
              onClick={() => setOpen(expanded ? null : s.id)}
              className="group ga-ui grid min-h-16 w-full grid-cols-[36px_minmax(0,1fr)_84px_18px] items-center gap-x-3.5 gap-y-2 px-1 py-3 text-left transition-colors duration-150 hover:bg-ga-side-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ga-focus sm:grid-cols-[36px_120px_minmax(0,1fr)_96px_18px]"
            >
              <Glyph icon={SECTION_ICON[s.id]} />
              <span lang="de" className="font-ga-display text-ga-h3 text-ga-ink">{t(`skill.${s.id}`)}</span>
              <Bar pct={s.pct} className="col-span-3 col-start-2 row-start-2 sm:col-span-1 sm:col-start-auto sm:row-start-auto" />
              <span className={cn('text-right tabular-nums', STATUS_TEXT_CLASS[s.status])}>
                <b className="block text-ga-body font-bold">{s.pct == null ? '–' : `${s.pct}%`}</b>
                <span className="block text-ga-caption font-medium">{t(`status.${s.status}`)}</span>
              </span>
              <ChevronRight size={16} aria-hidden className={cn('text-ga-subtle transition-transform duration-200', expanded && 'rotate-90')} />
            </button>
            <div
              id={panelId}
              hidden={!expanded}
              className={cn('ga-ui gap-4 px-1 pb-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:pl-[52px]', expanded ? 'grid' : 'hidden')}
            >
              {s.teile.length > 0 ? (
                <ul className="space-y-2.5">
                  {s.teile.map((x) => (
                    <li key={x.key} className="grid grid-cols-[96px_minmax(0,1fr)_44px] items-center gap-3 text-ga-small sm:grid-cols-[130px_minmax(0,1fr)_44px]">
                      <span lang="de" className="truncate text-ga-ink">{teilName(x.section, x.teil)}</span>
                      <Bar pct={x.pct} />
                      <span className={cn('text-right font-semibold tabular-nums', x.pct != null && x.pct < 60 ? 'text-ga-red' : 'text-ga-ink')}>
                        {x.pct == null ? '–' : `${x.pct}%`}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-ga-small text-ga-muted">{t('skillEmpty')}</p>
              )}
              {weakHref && (
                <Link
                  href={weakHref}
                  className="inline-flex min-h-10 items-center gap-1.5 self-start rounded-ga-touch border-[1.5px] border-ga-line-strong bg-ga-card px-3.5 text-ga-small font-semibold text-ga-ink transition-colors hover:bg-ga-side-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus"
                >
                  {s.id === 'SPRECHEN' ? <Mic size={15} aria-hidden /> : <Play size={15} aria-hidden />}
                  {s.id === 'SPRECHEN'
                    ? tp('oralTitle')
                    : t('practiceWeak', { name: teilName(s.weakest!.section, s.weakest!.teil) })}
                </Link>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
