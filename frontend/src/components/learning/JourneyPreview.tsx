'use client'

import * as React from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ArrowRight, Check, Lock } from 'lucide-react'
import { GaCap } from '@/components/ui-v2'
import { journeySlice, nodeStatus, courseCompletion } from '@/lib/learning/currentNode'
import type { RoadmapNode } from '@/lib/roadmap-tree/types'

/**
 * JourneyPreview — lát cắt lộ trình quanh node hiện tại (S-02) và compact overview giữ visual
 * signature cho mobile của Lernen (điều kiện P4-D4).
 *
 * KHÔNG tải canvas cây: đây chỉ là dải node rút gọn, nên màn Heute không phải trả chi phí của
 * thành phần nặng nhất khu học (plan S-03 §Performance).
 */
export function JourneyPreview({ nodes, compact = false }: { nodes: RoadmapNode[]; compact?: boolean }) {
  const t = useTranslations('v2.student.dashboard.journey')
  if (nodes.length === 0) return null

  const slice = journeySlice(nodes, compact ? 2 : 2)
  const { done, total, percent } = courseCompletion(nodes)

  return (
    <section aria-labelledby="journey-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <GaCap id="journey-heading" className="block">
          {t('eyebrow')}
        </GaCap>
        <span className="text-ga-caption tabular-nums text-ga-muted">
          {t('completion', { done, total, percent })}
        </span>
      </div>

      <ol className="mt-3 flex gap-2 overflow-x-auto">
        {slice.map((node, i) => {
          const status = nodeStatus(node)
          const isCurrent = i === 0 && status !== 'completed'
          const locked = status === 'locked'
          return (
            <li key={node.id} className="min-w-[9rem] flex-1">
              <Link
                href={locked ? '/v2/student/roadmap' : `/v2/student/learn/${node.id}`}
                aria-current={isCurrent ? 'step' : undefined}
                className={[
                  'flex h-full min-h-11 flex-col gap-1 rounded-ga border p-3 transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus focus-visible:ring-inset',
                  isCurrent
                    ? 'border-ga-accent bg-ga-accent-soft'
                    : locked
                      ? 'border-dashed border-ga-line bg-ga-locked-bg'
                      : 'border-ga-line bg-ga-card hover:bg-ga-surface',
                ].join(' ')}
              >
                <span className="flex items-center gap-1.5 text-ga-eyebrow uppercase text-ga-subtle">
                  {status === 'completed' && <Check size={12} className="text-ga-green" aria-hidden />}
                  {locked && <Lock size={12} aria-hidden />}
                  {/* Trạng thái luôn có NHÃN CHỮ, không chỉ truyền bằng màu/icon. */}
                  {t(`status.${status}`)}
                </span>
                <span
                  className={[
                    'line-clamp-2 text-ga-small font-semibold',
                    locked ? 'text-ga-locked-fg' : 'text-ga-ink',
                  ].join(' ')}
                >
                  {node.subtitle || node.title}
                </span>
              </Link>
            </li>
          )
        })}
      </ol>

      <Link
        href="/v2/student/roadmap"
        className="mt-3 inline-flex min-h-11 items-center gap-1.5 text-ga-small font-semibold text-ga-accent transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus focus-visible:ring-inset lg:min-h-0"
      >
        {t('viewAll')}
        <ArrowRight size={14} aria-hidden />
      </Link>
    </section>
  )
}
