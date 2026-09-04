'use client'

import * as React from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ArrowRight, Mic, Repeat, Wrench, CalendarCheck } from 'lucide-react'
import { GaCap } from '@/components/ui-v2'

/**
 * TodayList — "Heute": tối đa 4 việc cần làm hôm nay, xếp sau ContinueLearning (S-02).
 *
 * Thay cho ba thẻ hành động ngang hàng có màu riêng theo feature (violet/blue/orange — UI-06):
 * đây là DANH SÁCH việc, dùng surface trung tính + một accent, và chỉ hiện việc CÓ THẬT theo
 * dữ liệu `/today/me` (không bịa việc để lấp chỗ).
 */
export interface TodayTask {
  id: string
  icon: 'srs' | 'speaking' | 'repair' | 'weekly'
  label: string
  meta?: string
  href: string
}

const ICONS = { srs: Repeat, speaking: Mic, repair: Wrench, weekly: CalendarCheck } as const

export function TodayList({ tasks }: { tasks: TodayTask[] }) {
  const t = useTranslations('v2.student.dashboard.today')
  if (tasks.length === 0) {
    return (
      <section aria-labelledby="today-heading">
        <GaCap id="today-heading" className="block">
          {t('eyebrow')}
        </GaCap>
        <p className="mt-2 text-ga-body text-ga-muted">{t('empty')}</p>
      </section>
    )
  }

  return (
    <section aria-labelledby="today-heading">
      <GaCap id="today-heading" className="block">
        {t('eyebrow')}
      </GaCap>
      <ul className="mt-2 divide-y divide-ga-line border-y border-ga-line">
        {tasks.slice(0, 4).map((task) => {
          const Icon = ICONS[task.icon]
          return (
            <li key={task.id}>
              <Link
                href={task.href}
                className="flex min-h-11 items-center gap-3 py-3 transition-colors hover:bg-ga-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus focus-visible:ring-inset"
              >
                <Icon size={18} className="shrink-0 text-ga-subtle" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-ga-body font-medium text-ga-ink">{task.label}</span>
                  {task.meta && <span className="block truncate text-ga-caption text-ga-muted">{task.meta}</span>}
                </span>
                <ArrowRight size={16} className="shrink-0 text-ga-subtle" aria-hidden />
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
