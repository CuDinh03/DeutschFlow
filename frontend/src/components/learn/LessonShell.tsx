'use client'

import * as React from 'react'
import { ArrowLeft, Clock, Target } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { GaProgress, TkSeg } from '@/components/ui-v2'

/**
 * LessonShell — vỏ dùng chung cho bài Học và bài Luyện (S-04 / B-17).
 *
 * **Vì sao cần.** `/v2/student/learn/{nodeId}` và `/v2/student/practice/{nodeId}/{skill}` là hai
 * bề mặt người học ở lại lâu nhất, nhưng mỗi bên tự dựng header, nút thoát và cách báo tiến độ
 * riêng — runner luyện thì **không báo tiến độ gì cả** (nút nộp chỉ hiện khi đã trả lời hết, không
 * có "còn mấy câu"). Shell giữ orientation: tôi đang ở đâu trong bài, còn bao lâu, thoát thì mất gì.
 *
 * **Học và Luyện là hai CHẾ ĐỘ của cùng một shell**, không phải hai đích rời rạc (plan S-04). URL
 * giữ nguyên theo IA-D8; segmented chỉ đổi đường đi.
 *
 * 🔴 **Không có ô nào được vẽ khi không có dữ liệu.** Plan phác `~12 phút` và `Mục tiêu: …` trong
 * header. Cả hai đều là thật NHƯNG có thể vắng: `estimatedMinutes` (`skill_tree_nodes.estimated_minutes`,
 * cột nullable — trả về từ `GET /skill-tree/node/{id}/session` nhưng kiểu FE trước đây không khai
 * nên UI vứt đi) và `content.overview.vi`. Thiếu thì bỏ hẳn ô, không in "~0 phút" hay ô rỗng —
 * cùng kỷ luật đã bỏ waveform giả và "Câu 3/8".
 */

export type LessonMode = 'learn' | 'practice'

export interface LessonShellProps {
  mode: LessonMode
  /** Bỏ trống ⇒ không render segmented (chưa biết đường sang chế độ kia). */
  onModeChange?: (mode: LessonMode) => void
  /** "Module 8 · Giới thiệu bản thân" — vắng thì bỏ. */
  chapter?: string | null
  title: string
  /** Tiêu đề tiếng Đức. */
  subtitle?: string | null
  /** `content.overview.vi` — mô tả bài, vắng thì bỏ. */
  objective?: string | null
  /** `estimatedMinutes` từ node; vắng hoặc ≤ 0 thì bỏ. */
  estimatedMinutes?: number | null
  /** Tiến độ theo bước; vắng thì bỏ cả thanh lẫn nhãn. */
  progress?: { current: number; total: number } | null
  /**
   * Câu trạng thái nháp. PHẢI nêu đúng phạm vi ("trên thiết bị này") — caller dựng chuỗi, shell
   * chỉ hiển thị, để không bề mặt nào lỡ nói "Đã lưu" trống không.
   */
  savedNote?: React.ReactNode
  onExit: () => void
  children: React.ReactNode
  /** Cột phản hồi ở ≥1280; dưới ngưỡng đó rơi xuống dưới nội dung. */
  aside?: React.ReactNode
}

export function LessonShell({
  mode,
  onModeChange,
  chapter,
  title,
  subtitle,
  objective,
  estimatedMinutes,
  progress,
  savedNote,
  onExit,
  children,
  aside,
}: LessonShellProps) {
  const t = useTranslations('v2.student.lessonShell')

  const hasMinutes = typeof estimatedMinutes === 'number' && estimatedMinutes > 0
  const hasProgress = !!progress && progress.total > 0

  return (
    <div className="ga-ui flex min-h-full flex-col">
      <header className="sticky top-0 z-20 border-b border-ga-line bg-ga-card">
        <div className="mx-auto w-full max-w-6xl px-4 py-3 sm:px-6 lg:px-10">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <button
              type="button"
              onClick={onExit}
              className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-ga px-1.5 text-ga-small font-semibold text-ga-muted transition-colors hover:text-ga-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ga-focus lg:min-h-0 lg:py-2"
            >
              <ArrowLeft size={15} aria-hidden /> {t('exit')}
            </button>

            {/* Chương chỉ là ngữ cảnh: ẩn ở 390 để nhường chỗ cho thoát + tiến độ (plan §Responsive). */}
            {chapter && (
              <span className="hidden min-w-0 flex-1 truncate text-ga-caption text-ga-subtle sm:block">
                {chapter}
              </span>
            )}
            <span className="flex-1 sm:hidden" />

            {onModeChange && (
              <TkSeg
                aria-label={t('modeLabel')}
                value={mode}
                onValueChange={onModeChange}
                options={[
                  { value: 'learn', label: t('modeLearn') },
                  { value: 'practice', label: t('modePractice') },
                ]}
                className="shrink-0 text-ga-caption"
              />
            )}

            {hasMinutes && (
              <span className="hidden shrink-0 items-center gap-1 text-ga-caption text-ga-muted sm:inline-flex">
                <Clock size={12} aria-hidden />
                {t('minutes', { n: estimatedMinutes as number })}
              </span>
            )}
          </div>

          <h1 className="mt-2 font-ga-display text-[19px] font-medium leading-tight text-ga-ink">
            {title}
          </h1>
          {subtitle && <p className="text-ga-caption italic text-ga-muted">{subtitle}</p>}

          {objective && (
            <p className="mt-1.5 flex items-start gap-1.5 text-ga-caption text-ga-muted">
              <Target size={12} className="mt-0.5 shrink-0" aria-hidden />
              <span className="min-w-0">
                <span className="font-semibold text-ga-ink">{t('objective')}: </span>
                {objective}
              </span>
            </p>
          )}

          {hasProgress && (
            <div className="mt-2.5 flex items-center gap-3">
              <GaProgress
                className="min-w-0 flex-1"
                value={progress.current}
                max={progress.total}
                label={t('progressLabel')}
              />
              {/* Đổi bước phải nghe được, không chỉ nhìn được (plan §Accessibility). */}
              <span
                aria-live="polite"
                className="shrink-0 whitespace-nowrap text-ga-caption font-semibold tabular-nums text-ga-ink"
              >
                {t('step', { current: progress.current, total: progress.total })}
              </span>
            </div>
          )}

          {savedNote && <p className="mt-1.5 text-ga-caption text-ga-subtle">{savedNote}</p>}
        </div>
      </header>

      <div className="flex-1 px-4 py-6 sm:px-6 lg:px-10">
        <div
          className={cn(
            'mx-auto w-full max-w-6xl',
            // Ba vùng chỉ khi CÓ cột phản hồi; không có thì nội dung tự căn giữa.
            aside ? 'xl:flex xl:items-start xl:gap-8' : '',
          )}
        >
          {/* ~72ch là giới hạn dễ đọc của plan, không phải một con số tuỳ hứng. */}
          <main className={cn('mx-auto w-full max-w-[72ch] space-y-[22px]', aside && 'xl:mx-0 xl:flex-1')}>
            {children}
          </main>
          {aside && (
            <aside className="mt-[22px] w-full space-y-[22px] xl:mt-0 xl:w-[320px] xl:shrink-0">
              {aside}
            </aside>
          )}
        </div>
      </div>
    </div>
  )
}
