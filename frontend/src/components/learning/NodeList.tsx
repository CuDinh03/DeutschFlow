'use client'

import * as React from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { BookOpen, Check, Dumbbell, Lock } from 'lucide-react'
import { GaProgress, TkBadge } from '@/components/ui-v2'
import { nodeStatus, nodeProgressPercent } from '@/lib/learning/currentNode'
import type { RoadmapNode } from '@/lib/roadmap-tree/types'

/**
 * NodeList — bản trình bày DẠNG DANH SÁCH của cùng dữ liệu lộ trình (P4-D6).
 *
 * Đây KHÔNG phải một mental model thứ hai ngang hàng với cây: nó là bản thay thế accessible
 * của cùng `GET /roadmap/me` (đọc được bằng screen reader, đi được bằng bàn phím) và là mặc
 * định trên mobile vì canvas SVG ở 390px vừa khó dùng vừa tốn CPU (P4-D4).
 *
 * Mật độ giảm theo plan S-03: mỗi node còn **một** badge trạng thái + **một** CTA chính;
 * CEFR/tiến độ xuống dòng meta, luyện tập là hành động phụ. Node khoá nói rõ ĐIỀU KIỆN MỞ
 * bằng câu chữ thay vì chỉ một ổ khoá.
 */
export function NodeList({ nodes }: { nodes: RoadmapNode[] }) {
  const t = useTranslations('v2.student.roadmap')

  return (
    <ol className="divide-y divide-ga-line border-y border-ga-line">
      {nodes.map((node, i) => {
        const status = nodeStatus(node)
        const locked = status === 'locked'
        const done = status === 'completed'
        const percent = nodeProgressPercent(node)
        // Điều kiện mở suy ra từ THỨ TỰ THẬT của lộ trình — không bịa dữ liệu backend không có.
        const prev = i > 0 ? nodes[i - 1] : undefined
        const unlockHint = prev
          ? t('nodeLockedBy', { prev: prev.subtitle || prev.title })
          : t('nodeLockedGeneric')

        return (
          <li key={node.id} className="py-4">
            <div className="flex items-start gap-3 lg:gap-4">
              <span
                aria-hidden
                className={[
                  'grid h-11 w-11 shrink-0 place-items-center rounded-ga text-ga-h2',
                  locked ? 'bg-ga-locked-bg' : 'bg-ga-surface',
                ].join(' ')}
              >
                {locked ? <Lock size={18} className="text-ga-locked-fg" /> : done ? <Check size={20} className="text-ga-green" /> : node.emoji}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3
                    className={[
                      'min-w-0 break-words text-ga-h3',
                      locked ? 'text-ga-locked-fg' : 'text-ga-ink',
                    ].join(' ')}
                  >
                    {node.subtitle || node.title}
                  </h3>
                  {/* ĐÚNG MỘT badge cho mỗi node (plan S-03). */}
                  <TkBadge tone={done ? 'green' : locked ? 'neutral' : 'yellow'}>
                    {t(`nodeStatus.${status}`)}
                  </TkBadge>
                </div>

                {/* Meta gộp một dòng: tiêu đề Đức + CEFR — không còn mỗi thứ một badge. */}
                <p className="mt-0.5 break-words text-ga-caption text-ga-subtle">
                  {node.subtitle && node.title && (
                    <span lang="de" className="italic">
                      {node.title}
                      {' · '}
                    </span>
                  )}
                  {node.cefrLevel}
                </p>

                {locked ? (
                  <p className="mt-2 text-ga-small text-ga-muted">{unlockHint}</p>
                ) : (
                  <>
                    <div className="mt-2.5 max-w-xs">
                      <GaProgress value={percent} label={t('nodeProgressLabel')} showValue />
                      <p className="mt-1 text-ga-caption text-ga-muted">
                        {t('nodeLessons', { done: node.lessonsCompleted, total: node.lessonsTotal })}
                      </p>
                    </div>

                    <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-2">
                      {/* MỘT hành động chính. */}
                      <Link
                        href={`/v2/student/learn/${node.id}`}
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-ga-touch bg-ga-accent px-4 text-ga-small font-semibold text-ga-accent-ink transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ga-bg"
                      >
                        <BookOpen size={15} aria-hidden />
                        {done ? t('nodeRelearn') : t('nodeLearn')}
                      </Link>
                      {/* Hành động phụ: link im lặng, không cạnh tranh với CTA chính. */}
                      <Link
                        href={`/v2/student/practice/${node.id}`}
                        className="inline-flex min-h-11 items-center gap-1.5 text-ga-small font-semibold text-ga-muted transition-colors hover:text-ga-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus focus-visible:ring-inset lg:min-h-0"
                      >
                        <Dumbbell size={15} aria-hidden />
                        {t('nodePractice')}
                      </Link>
                    </div>
                  </>
                )}
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
