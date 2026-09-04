'use client'

import * as React from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ArrowRight } from 'lucide-react'
import { GaProgress, GaCap } from '@/components/ui-v2'
import { nodeProgressPercent } from '@/lib/learning/currentNode'
import type { RoadmapNode } from '@/lib/roadmap-tree/types'

/**
 * ContinueLearning — object CHIẾM ƯU THẾ của màn Heute (S-02, UX-01/UI-04).
 *
 * Trước Wave 1, dashboard mở bằng 4 ô thống kê rồi tới ba thẻ hành động ngang hàng, nên người
 * học phải tự chọn "engine" trước khi học được. Khối này trả lời thẳng "học tiếp cái gì" và là
 * CTA filled DUY NHẤT trong viewport đầu.
 *
 * Microcopy song ngữ theo mẫu handoff §20: nhãn Đức tạo immersion, dòng Việt bảo đảm hiểu.
 */
export interface ContinueLearningProps {
  /** Node để học tiếp; `undefined` = không còn gì để học tiếp. */
  node?: RoadmapNode
  /** Học viên chưa có phiên nào — CTA đổi thành bắt đầu bài đầu tiên. */
  isFirstSession?: boolean
}

export function ContinueLearning({ node, isFirstSession }: ContinueLearningProps) {
  const t = useTranslations('v2.student.dashboard.continue')

  // Người học mới: chưa có lộ trình để "tiếp tục" — đưa vào buổi học đầu tiên.
  if (isFirstSession || !node) {
    const href = isFirstSession ? '/v2/student/beginner' : '/v2/student/roadmap'
    return (
      <section aria-labelledby="continue-heading" className="border border-ga-line bg-ga-card p-5 lg:p-6">
        <GaCap className="block">{isFirstSession ? t('startEyebrow') : t('doneEyebrow')}</GaCap>
        <h2 id="continue-heading" className="mt-2 font-ga-display text-ga-h1-m text-ga-ink lg:text-ga-h1">
          {isFirstSession ? t('startTitle') : t('doneTitle')}
        </h2>
        <p className="mt-2 max-w-prose text-ga-body text-ga-muted">
          {isFirstSession ? t('startDesc') : t('doneDesc')}
        </p>
        <Link
          href={href}
          className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-ga-touch bg-ga-accent px-5 text-ga-body font-semibold text-ga-accent-ink transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ga-bg"
        >
          {isFirstSession ? t('startCta') : t('doneCta')}
          <ArrowRight size={18} aria-hidden />
        </Link>
      </section>
    )
  }

  const percent = nodeProgressPercent(node)
  // Tiêu đề: tiếng Việt dễ hiểu trước, tiếng Đức là dòng ngữ cảnh — cùng dữ liệu node.
  const title = node.subtitle || node.title
  const germanTitle = node.subtitle ? node.title : null

  return (
    <section aria-labelledby="continue-heading" className="border border-ga-line bg-ga-card p-5 lg:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <GaCap className="block">{t('eyebrow')}</GaCap>
        <span className="rounded-ga-pill bg-ga-accent-soft px-2 py-0.5 text-ga-caption font-semibold text-ga-accent">
          {node.cefrLevel}
        </span>
      </div>

      <h2 id="continue-heading" className="mt-2 break-words font-ga-display text-ga-h1-m text-ga-ink lg:text-ga-h1">
        {title}
      </h2>
      {germanTitle && (
        <p lang="de" className="mt-1 break-words font-ga-display text-ga-body-lg italic text-ga-subtle">
          {germanTitle}
        </p>
      )}

      <div className="mt-4 max-w-md">
        <GaProgress value={percent} label={t('progressLabel')} showValue />
        <p className="mt-1.5 text-ga-caption text-ga-muted">
          {t('lessons', { done: node.lessonsCompleted, total: node.lessonsTotal })}
        </p>
      </div>

      {/* CTA filled DUY NHẤT của màn. Nhãn Đức + dòng Việt ngay dưới (handoff §20). */}
      <div className="mt-5">
        <Link
          href={`/v2/student/learn/${node.id}`}
          aria-label={`${t('cta')} — ${title}`}
          className="inline-flex min-h-11 items-center gap-2 rounded-ga-touch bg-ga-accent px-5 text-ga-body font-semibold text-ga-accent-ink transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus focus-visible:ring-offset-2 focus-visible:ring-offset-ga-bg"
        >
          <span lang="de">{t('cta')}</span>
          <ArrowRight size={18} aria-hidden />
        </Link>
        <p className="mt-1.5 text-ga-caption text-ga-muted">{t('ctaHelper')}</p>
      </div>
    </section>
  )
}
